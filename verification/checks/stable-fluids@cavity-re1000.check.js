#!/usr/bin/env node
/* Reviewer check: stable-fluids @ cavity-re1000 (lid-driven cavity, Re = 1000, steady state vs Ghia 1982 / Erturk 2005).
 * Reviewer: reviewer-stable-fluids-cavity-re1000-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node "verification/checks/stable-fluids@cavity-re1000.check.js"
 * Prints a JSON summary on stdout. Cases run as parallel child processes (4 cores: ~7-8 min wall).
 * Adapted from verification/checks/stable-fluids@cavity-re100.check.js; changes: Re = 1000 references,
 * Erturk table compared at its exact coordinates (no snapping), looser residual target (Re = 1000 relaxes
 * slowly), an explicit projection-convergence test (pIters raised mid-run on a converged case), and the
 * primary case is the method default N = 64 (the experiment is "at method defaults").
 *
 * Protocol
 *   - PRIMARY: method defaults (= Stam's solver settings) N = 64, cfl = 1 (dt = h), iters = 20, pIters = 20.
 *   - Stam settings at N = 128 (finer grid, Ghia's spacing 1/128).
 *   - DIAGNOSTICS (information; separate the unconverged 20-sweep projection from first-order
 *     semi-Lagrangian dissipation): N = 32 with pIters = 1000 at cfl 1 and cfl 0.5, then continued for 3
 *     time units with pIters = 8000 to show the projection is converged at this N; N = 64 with
 *     pIters = 2000 (~4x the N = 32 count, since Gauss-Seidel needs O(N^2) sweeps). N = 128 with a
 *     converged projection (~8000 sweeps per projection) does not fit the ~10 min budget.
 *   - March from rest until residual probe (max |du|,|dv| per unit time) < resTol or t >= tCap. Steadiness:
 *     u_vcl / psi_min change vs a snapshot >= 5 time units earlier; reviewer criterion < 1% of each tolerance.
 *   - Tables: Ghia coordinates snapped to the 129-grid node j/128 (as in the other cavity reviews); Erturk
 *     coordinates (exact 0.01 multiples) used as given. Sim profile linearly interpolated. Tolerances from the
 *     references, unchanged (max-abs 0.03 U; psi_min rel 0.03; centre max-abs 0.02).
 *   - Mass: net volume flux through every interior grid line (closed cavity -> 0) relative to |psi_min|,
 *     reviewer criterion <= 1%; discrete divergence after the final projection (max, rms, max excluding
 *     2 wall layers) and projection reduction factor.
 *   - Stability: no NaN, max|u| <= 1 + 1e-9, CFL = max|u| dt/h.
 */
'use strict';
const { fork } = require('child_process');

const CASES = [
  { key: 'primary_N64_stam', N: 64, cfl: 1, pIters: 20, resTol: 1e-6, tCap: 150, role: 'primary (method defaults)' },
  { key: 'stam_N128', N: 128, cfl: 1, pIters: 20, resTol: 1e-6, tCap: 150, role: 'Stam settings, finer grid' },
  { key: 'diag_N32_p1000', N: 32, cfl: 1, pIters: 1000, resTol: 1e-6, tCap: 120, extend: { pIters: 8000, dt: 3 }, role: 'diagnostic converged projection' },
  { key: 'diag_N32_p1000_cfl05', N: 32, cfl: 0.5, pIters: 1000, resTol: 1e-6, tCap: 120, role: 'diagnostic converged projection, half dt' },
  { key: 'diag_N64_p2000', N: 64, cfl: 1, pIters: 2000, resTol: 1e-5, tCap: 50, role: 'diagnostic near-converged projection (largest feasible)' }
];

function runCase(C) {
  const H = require('../../tools/harness.js');
  const LAB = H.load({ methods: ['stable-fluids'], verification: false });
  const M = LAB.methods['stable-fluids'];
  const R = LAB.references;
  const refU = R['cavity-re1000-ghia-u'], refV = R['cavity-re1000-ghia-v'], refE = R['cavity-re1000-erturk-u'];
  const refP = R['cavity-re1000-ghia-psimin'], refPE = R['cavity-re1000-erturk-psimin'], refC = R['cavity-re1000-ghia-center'];
  const interp = (xs, ys, x) => {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) if (x <= xs[i] + 1e-15) {
      const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return (1 - f) * ys[i - 1] + f * ys[i];
    }
    return ys[ys.length - 1];
  };
  const snapG = c => Math.round(c * 128) / 128;
  function compareTable(prof, ref, xKey, yKey, snap) {
    let maxAbs = 0, at = null; const rows = [];
    ref.rows.forEach(r => {
      const s = interp(prof[xKey], prof[yKey], snap ? snap(r[0]) : r[0]), d = s - r[1];
      rows.push({ coord: r[0], ref: r[1], sim: +s.toFixed(5), diff: +d.toFixed(5) });
      if (Math.abs(d) > maxAbs) { maxAbs = Math.abs(d); at = r[0]; }
    });
    return { maxAbs, at, tol: ref.tolerance.value, pass: maxAbs <= ref.tolerance.value, rows };
  }
  const metricsObj = sim => { const o = {}; sim.metrics().forEach(m => { o[m.key] = m.value; }); return o; };

  const N = C.N, h = 1 / N;
  const sim = M.create('cavity', H.params('stable-fluids', 'cavity', { Re: 1000, N, cfl: C.cfl, iters: 20, pIters: C.pIters }));
  const t0 = Date.now();
  let nan = false, maxU = 0, maxCfl = 0, snaps = [], nextSnap = 5;
  while (sim.t < C.tCap) {
    sim.step();
    if (sim.steps % 25 === 0) {
      if (sim.diverged()) { nan = true; break; }
      const m = metricsObj(sim);
      maxU = Math.max(maxU, m.umax); maxCfl = Math.max(maxCfl, m.cfl);
      if (sim.t >= nextSnap) {
        snaps.push({ t: sim.t, psimin: sim.probe('psi_min'), ke: m.ke, u: sim.probe('u_vcl').u.slice() });
        if (snaps.length > 2) snaps.shift();
        nextSnap += 5;
      }
      if (sim.probe('residual') < C.resTol) break;
    }
  }
  const residualEnd = sim.probe('residual');
  const m = metricsObj(sim);
  const u = sim.probe('u_vcl'), v = sim.probe('v_hcl');
  const psimin = sim.probe('psi_min'), ctr = sim.probe('vortex_center');
  const prev = snaps.length ? snaps[0] : null;
  let dU = NaN;
  if (prev) { dU = 0; for (let j = 0; j < u.u.length; j++) dU = Math.max(dU, Math.abs(u.u[j] - prev.u[j])); }

  const U = sim.view('u').data, V = sim.view('v').data, D = sim.view('divergence').data;
  let maxFluxX = 0, maxFluxY = 0;
  for (let i = 0; i < N - 1; i++) {
    let f = 0; for (let j = 0; j < N; j++) f += 0.5 * (U[j * N + i] + U[j * N + i + 1]) * h;
    maxFluxX = Math.max(maxFluxX, Math.abs(f));
  }
  for (let j = 0; j < N - 1; j++) {
    let f = 0; for (let i = 0; i < N; i++) f += 0.5 * (V[j * N + i] + V[(j + 1) * N + i]) * h;
    maxFluxY = Math.max(maxFluxY, Math.abs(f));
  }
  let dMax = 0, dIn = 0, s2 = 0, dAt = null;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = Math.abs(D[j * N + i]); s2 += a * a;
    if (a > dMax) { dMax = a; dAt = [(i + 0.5) * h, (j + 0.5) * h]; }
    if (i >= 2 && j >= 2 && i < N - 2 && j < N - 2 && a > dIn) dIn = a;
  }
  const ug = compareTable(u, refU, 'y', 'u', snapG), vg = compareTable(v, refV, 'x', 'v', snapG);
  const eg = compareTable(u, refE, 'y', 'u', null);
  const psiRel = psimin == null ? NaN : Math.abs(psimin - refP.value) / Math.abs(refP.value);
  const psiRelE = psimin == null ? NaN : Math.abs(psimin - refPE.value) / Math.abs(refPE.value);
  const cErr = ctr ? Math.max(Math.abs(ctr.x - refC.value.x), Math.abs(ctr.y - refC.value.y)) : NaN;

  // projection-convergence test: continue with many more pressure sweeps, see whether the state moves
  let extend = null;
  if (C.extend) {
    sim.setParam('pIters', C.extend.pIters);
    const tE = sim.t + C.extend.dt;
    while (sim.t < tE) sim.step();
    const u2 = sim.probe('u_vcl').u; let du = 0;
    for (let j = 0; j < u2.length; j++) du = Math.max(du, Math.abs(u2[j] - u.u[j]));
    const p2 = sim.probe('psi_min');
    extend = { pIters: C.extend.pIters, dt: C.extend.dt, max_du_vcl: du, psimin: p2, dpsimin_rel: Math.abs(p2 - psimin) / Math.abs(psimin) };
  }
  return {
    key: C.key, role: C.role, N, cfl: C.cfl, pIters: C.pIters,
    steps: sim.steps, t_end: +sim.t.toFixed(4), dt: m.dt, wall_s: (Date.now() - t0) / 1000,
    residual: residualEnd, converged: residualEnd < C.resTol, resTol: C.resTol, nan: nan || sim.diverged(),
    stationarity: prev ? { dt_back: +((snaps.length ? sim.t : 0) - prev.t).toFixed(3), max_du_vcl: dU, dpsimin_rel: Math.abs(psimin - prev.psimin) / Math.abs(psimin), dke_rel: Math.abs(m.ke - prev.ke) / m.ke } : null,
    stability: { maxU, maxCfl, diffusion_number: m.diffnum },
    mass: { max_line_flux_x: maxFluxX, max_line_flux_y: maxFluxY,
      flux_rel_psimin: Math.max(maxFluxX, maxFluxY) / Math.abs(psimin),
      div_max: dMax, div_max_at: dAt, div_rms: Math.sqrt(s2 / (N * N)), div_max_excl2: dIn,
      div_before_final_projection: m.divpre, div_after_final_projection: m.div,
      projection_reduction: m.divpre / m.div },
    ke: m.ke,
    psimin, psiRel, psiRelErturk: psiRelE, psiPass: psiRel <= refP.tolerance.value,
    center: ctr, centerErr: cErr, centerPass: cErr <= refC.tolerance.value,
    u: ug, v: vg, erturk_u: eg, extend
  };
}

if (process.argv[2] === '--case') {
  const C = CASES.find(c => c.key === process.argv[3]);
  process.send(runCase(C));
  process.exit(0);
}

const wall0 = Date.now();
const PAR = 4;
const results = {};
let next = 0, running = 0;
// longest case first
const ORDER = ['diag_N64_p2000', 'diag_N32_p1000_cfl05', 'stam_N128', 'diag_N32_p1000', 'primary_N64_stam'];
function launch(done) {
  while (running < PAR && next < ORDER.length) {
    const want = ORDER[next++]; const C = CASES.find(c => c.key === want); running++;
    const ch = fork(__filename, ['--case', C.key], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    ch.on('message', r => { results[C.key] = r; });
    ch.on('exit', () => { running--; if (next >= ORDER.length && running === 0) done(); else launch(done); });
  }
}
launch(function () {
  const P = results.primary_N64_stam;
  const tolU = 0.03, tolPsi = 0.03;
  const steady = r => r.converged && !!r.stationarity && r.stationarity.max_du_vcl < 0.01 * tolU && r.stationarity.dpsimin_rel < 0.01 * tolPsi;
  const stab = r => !r.nan && r.stability.maxU <= 1 + 1e-9;
  const mass = r => r.mass.flux_rel_psimin <= 0.01;
  const brief = r => ({ N: r.N, cfl: r.cfl, pIters: r.pIters, steps: r.steps, t_end: r.t_end, converged: r.converged, residual: r.residual,
    u_ghia_maxAbs: +r.u.maxAbs.toFixed(5), u_ghia_at: r.u.at, v_ghia_maxAbs: +r.v.maxAbs.toFixed(5), v_ghia_at: r.v.at,
    u_erturk_maxAbs: +r.erturk_u.maxAbs.toFixed(5), u_erturk_at: r.erturk_u.at,
    psimin: r.psimin, psiRel: +r.psiRel.toFixed(5), psiRelErturk: +r.psiRelErturk.toFixed(5), center: r.center, centerErr: +r.centerErr.toFixed(5),
    flux_rel_psimin: r.mass.flux_rel_psimin, div_max: r.mass.div_max, div_max_at: r.mass.div_max_at, div_rms: r.mass.div_rms, div_max_excl2: r.mass.div_max_excl2,
    projection_reduction: r.mass.projection_reduction, maxU: r.stability.maxU, maxCfl: r.stability.maxCfl,
    stationarity: r.stationarity, steady: steady(r), extend: r.extend, wall_s: r.wall_s });
  const sel = (r, tab, coords) => tab.rows.filter(x => coords.indexOf(x.coord) >= 0);
  const summary = {
    method: 'stable-fluids', experiment: 'cavity-re1000', Re: 1000,
    protocol: 'primary: method defaults N=64, cfl=1, iters=20, pIters=20; stop residual < 1e-6 or t >= 150',
    cases: CASES.map(c => Object.assign({ key: c.key, role: c.role }, brief(results[c.key]))),
    primary_rows: { ghia_u: P.u.rows, ghia_v: P.v.rows, erturk_u: P.erturk_u.rows },
    selected_rows_other: CASES.filter(c => c.key !== 'primary_N64_stam').map(c => ({ key: c.key,
      ghia_u: sel(results[c.key], results[c.key].u, [0.9766, 0.5, 0.1719]), ghia_v: sel(results[c.key], results[c.key].v, [0.9063, 0.1563]) })),
    passes: {
      u_vcl_ghia: P.u.pass, v_hcl_ghia: P.v.pass, u_vcl_erturk: P.erturk_u.pass, psi_min: P.psiPass, vortex_center: P.centerPass,
      steady: steady(P), stability: stab(P), mass_flux: mass(P)
    },
    wall_s: (Date.now() - wall0) / 1000
  };
  console.log(JSON.stringify(summary, null, 1));
});
