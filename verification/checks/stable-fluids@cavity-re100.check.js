#!/usr/bin/env node
/* Reviewer check: stable-fluids @ cavity-re100 (lid-driven cavity, Re = 100, steady state vs Ghia 1982).
 * Reviewer: reviewer-stable-fluids-cavity-re100-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node "verification/checks/stable-fluids@cavity-re100.check.js"
 * Prints a JSON summary on stdout. Runs its cases as parallel child processes (4 cores: ~4-5 min wall).
 *
 * Protocol
 *   - PRIMARY (the method as published / as shipped): Stam's solver settings, i.e. the method defaults
 *     cfl = 1 (dt = h), iters = 20 diffusion sweeps, pIters = 20 pressure sweeps, at N = 128 (cell size
 *     equal to Ghia's grid spacing 1/128, which the reference tolerances assume). The method's default
 *     N = 64 is run too.
 *   - DIAGNOSTICS (information; not used to pass the method): the same scheme with the pressure Poisson
 *     solve driven closer to convergence (pIters = 2000 @ N = 32, 1000 @ N = 64, 300 @ N = 128) and one
 *     cfl = 0.5 run, to separate the error of the unconverged 20-sweep projection from the error of the
 *     first-order semi-Lagrangian advection / splitting. N = 128 with a converged projection does not fit
 *     the time budget (GS needs O(N^2) sweeps); 300 sweeps is the largest feasible.
 *   - March from rest until the method's residual probe (max |du|,|dv| per unit time) < RES_TOL, or
 *     t = T_CAP. Steadiness: u_vcl and psi_min compared with a snapshot >= 5 time units earlier;
 *     reviewer criterion: change < 1% of the corresponding tolerance.
 *   - Table comparison (same as the other cavity reviews): each Ghia coordinate is snapped to the 129-grid
 *     node j/128 and the sim centreline profile (cell-centre values averaged across x=0.5 / y=0.5, plus
 *     wall values) is linearly interpolated there. Metric max-abs over all 17 rows, tolerance 0.02 U from
 *     the reference (not changed). psi_min: rel error vs -0.103423 (tol 0.03); centre: max(|dx|,|dy|) (tol 0.02).
 *   - Mass conservation for an incompressible solver in a closed box: (i) net volume flux through every
 *     vertical grid line x = i h and every horizontal line y = j h must vanish (closed cavity); measured as
 *     max |flux| relative to the recirculating flux |psi_min|, reviewer criterion <= 1%; (ii) residual
 *     discrete divergence after the final projection (max, rms, and max excluding the 2 cell layers next to
 *     the walls), and the reduction factor of the projection (div before / after). Momentum is not
 *     conserved (wall and lid forces); KE must be stationary at steady state.
 *   - Stability: no NaN/blow-up, max|u| <= 1 + 1e-9 (semi-Lagrangian max principle with lid speed 1),
 *     CFL = max|u| dt / h reported against the method's accuracy note (CFL of order 1 or less).
 */
'use strict';
const path = require('path');
const { fork } = require('child_process');

const CASES = [
  { key: 'primary_N128_stam', N: 128, cfl: 1, iters: 20, pIters: 20, resTol: 1e-8, tCap: 80, role: 'primary' },
  { key: 'default_N64_stam', N: 64, cfl: 1, iters: 20, pIters: 20, resTol: 1e-8, tCap: 80, role: 'method default N' },
  { key: 'diag_N32_p2000', N: 32, cfl: 1, iters: 20, pIters: 2000, resTol: 1e-8, tCap: 40, role: 'diagnostic' },
  { key: 'diag_N32_p2000_cfl05', N: 32, cfl: 0.5, iters: 20, pIters: 2000, resTol: 1e-8, tCap: 40, role: 'diagnostic' },
  { key: 'diag_N64_p1000', N: 64, cfl: 1, iters: 20, pIters: 1000, resTol: 1e-7, tCap: 30, role: 'diagnostic' },
  { key: 'diag_N128_p300', N: 128, cfl: 1, iters: 20, pIters: 300, resTol: 1e-6, tCap: 22, role: 'diagnostic (largest feasible)' }
];

function runCase(C) {
  const H = require('../../tools/harness.js');
  const LAB = H.load({ methods: ['stable-fluids'], verification: false });
  const M = LAB.methods['stable-fluids'];
  const R = LAB.references;
  const refU = R['cavity-re100-ghia-u'], refV = R['cavity-re100-ghia-v'];
  const refP = R['cavity-re100-ghia-psimin'], refC = R['cavity-re100-ghia-center'];
  const interp = (xs, ys, x) => {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) if (x <= xs[i] + 1e-15) {
      const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return (1 - f) * ys[i - 1] + f * ys[i];
    }
    return ys[ys.length - 1];
  };
  const snap = c => Math.round(c * 128) / 128;
  function compareTable(prof, ref, xKey, yKey) {
    let maxAbs = 0, at = null; const rows = [];
    ref.rows.forEach(r => {
      const s = interp(prof[xKey], prof[yKey], snap(r[0])), d = s - r[1];
      rows.push({ coord: r[0], ref: r[1], sim: +s.toFixed(5), diff: +d.toFixed(5) });
      if (Math.abs(d) > maxAbs) { maxAbs = Math.abs(d); at = r[0]; }
    });
    return { maxAbs, at, tol: ref.tolerance.value, pass: maxAbs <= ref.tolerance.value, rows };
  }
  const metricsObj = sim => { const o = {}; sim.metrics().forEach(m => { o[m.key] = m.value; }); return o; };

  const N = C.N, h = 1 / N;
  const sim = M.create('cavity', H.params('stable-fluids', 'cavity', { Re: 100, N, cfl: C.cfl, iters: C.iters, pIters: C.pIters }));
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
  const m = metricsObj(sim);
  const u = sim.probe('u_vcl'), v = sim.probe('v_hcl');
  const psimin = sim.probe('psi_min'), ctr = sim.probe('vortex_center');
  const prev = snaps.length ? snaps[0] : null;
  let dU = NaN;
  if (prev) { dU = 0; for (let j = 0; j < u.u.length; j++) dU = Math.max(dU, Math.abs(u.u[j] - prev.u[j])); }

  // mass: net volume flux through grid lines (interior data only, from the public view())
  const U = sim.view('u').data, V = sim.view('v').data, D = sim.view('divergence').data;
  let maxFluxX = 0, maxFluxY = 0;
  for (let i = 0; i < N - 1; i++) {   // vertical line between columns i and i+1
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
  const ug = compareTable(u, refU, 'y', 'u'), vg = compareTable(v, refV, 'x', 'v');
  const psiRel = psimin == null ? NaN : Math.abs(psimin - refP.value) / Math.abs(refP.value);
  const cErr = ctr ? Math.max(Math.abs(ctr.x - refC.value.x), Math.abs(ctr.y - refC.value.y)) : NaN;
  return {
    key: C.key, role: C.role, N, cfl: C.cfl, iters: C.iters, pIters: C.pIters,
    steps: sim.steps, t_end: +sim.t.toFixed(4), dt: m.dt, wall_s: (Date.now() - t0) / 1000,
    residual: sim.probe('residual'), converged: sim.probe('residual') < C.resTol, resTol: C.resTol, nan: nan || sim.diverged(),
    stationarity: prev ? { dt_back: +(sim.t - prev.t).toFixed(3), max_du_vcl: dU, dpsimin_rel: Math.abs(psimin - prev.psimin) / Math.abs(psimin), dke_rel: Math.abs(m.ke - prev.ke) / m.ke } : null,
    stability: { maxU, maxCfl, diffusion_number: m.diffnum },
    mass: { max_line_flux_x: maxFluxX, max_line_flux_y: maxFluxY,
      flux_rel_psimin: Math.max(maxFluxX, maxFluxY) / Math.abs(psimin),
      div_max: dMax, div_max_at: dAt, div_rms: Math.sqrt(s2 / (N * N)), div_max_excl2: dIn,
      div_before_final_projection: m.divpre, div_after_final_projection: m.div,
      projection_reduction: m.divpre / m.div },
    ke: m.ke,
    psimin, psiRel, psiPass: psiRel <= refP.tolerance.value,
    center: ctr, centerErr: cErr, centerPass: cErr <= refC.tolerance.value,
    u: ug, v: vg
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
function launch(done) {
  while (running < PAR && next < CASES.length) {
    const C = CASES[next++]; running++;
    const ch = fork(__filename, ['--case', C.key], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    ch.on('message', r => { results[C.key] = r; });
    ch.on('exit', () => { running--; if (next >= CASES.length && running === 0) done(); else launch(done); });
  }
}
launch(function () {
  const P = results.primary_N128_stam, D64 = results.default_N64_stam;
  const tolU = 0.02, tolPsi = 0.03, tolC = 0.02;
  const steady = r => r.converged && !!r.stationarity && r.stationarity.max_du_vcl < 0.01 * tolU && r.stationarity.dpsimin_rel < 0.01 * tolPsi;
  const stab = r => !r.nan && r.stability.maxU <= 1 + 1e-9;
  const mass = r => r.mass.flux_rel_psimin <= 0.01;
  const brief = r => ({ N: r.N, cfl: r.cfl, pIters: r.pIters, steps: r.steps, t_end: r.t_end, converged: r.converged, residual: r.residual,
    u_maxAbs: +r.u.maxAbs.toFixed(5), u_at: r.u.at, v_maxAbs: +r.v.maxAbs.toFixed(5), v_at: r.v.at,
    psimin: r.psimin, psiRel: +r.psiRel.toFixed(5), center: r.center, centerErr: +r.centerErr.toFixed(5),
    flux_rel_psimin: r.mass.flux_rel_psimin, div_rms: r.mass.div_rms, div_max_excl2: r.mass.div_max_excl2,
    projection_reduction: r.mass.projection_reduction, maxU: r.stability.maxU, maxCfl: r.stability.maxCfl, steady: steady(r), wall_s: r.wall_s });
  const ord = (a, b) => Math.log(a / b) / Math.LN2;
  const d32 = results.diag_N32_p2000, d64 = results.diag_N64_p1000, d128 = results.diag_N128_p300;
  const summary = {
    method: 'stable-fluids', experiment: 'cavity-re100', Re: 100,
    protocol: 'primary: N=128, cfl=1, iters=20, pIters=20 (Stam settings = method defaults); stop residual < 1e-8 or t >= 80',
    primary: P,
    cases: CASES.map(c => Object.assign({ key: c.key, role: c.role }, brief(results[c.key]))),
    diagnostics: {
      psimin_err_conv_projection_N32_N64: [d32.psiRel, d64.psiRel],
      observed_order_psimin_conv_projection_32_64: ord(d32.psiRel, d64.psiRel),
      observed_order_u_conv_projection_32_64: ord(d32.u.maxAbs, d64.u.maxAbs),
      psimin_err_stam20_N64_N128: [D64.psiRel, P.psiRel],
      psimin_err_N128_p20_vs_p300: [P.psiRel, d128.psiRel],
      cfl_effect_N32_conv: { cfl1: d32.psimin, cfl05: results.diag_N32_p2000_cfl05.psimin }
    },
    passes: {
      u_vcl: P.u.pass, v_hcl: P.v.pass, psi_min: P.psiPass, vortex_center: P.centerPass,
      steady: steady(P), stability: stab(P), mass_flux: mass(P)
    },
    wall_s: (Date.now() - wall0) / 1000
  };
  console.log(JSON.stringify(summary, null, 1));
});
