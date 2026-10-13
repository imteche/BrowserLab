#!/usr/bin/env node
/* Reviewer check: psi-omega-fd @ cavity-re1000 (lid-driven cavity, Re = 1000, steady state).
 * Reviewer: reviewer-psi-omega-fd-cavity-re1000-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/psi-omega-fd@cavity-re1000.check.js
 * Prints a JSON summary on stdout. Runtime about 8-9 min wall: the three grids run in parallel
 * worker threads (4 cores here).
 *
 * Protocol (method defaults except Re and N): Re = 1000, central convection (scheme 0), cfl = 0.8,
 * mgCycles = 10. The run starts from rest and marches in time until the method's own residual probe
 * (max |du|,|dv| per unit time) drops below RES_TOL[N] or t reaches T_MAX[N].
 *   N = 256 : primary grid (largest feasible in the budget; Ghia nodes j/128 are nodes 2j/256).
 *   N = 128 : nodes coincide with Ghia's 129^2 grid; run to near machine-steady state; also used to
 *             estimate how much the N = 256 profiles can still move after its (shorter) run.
 *   N = 64  : grid-convergence trend only.
 * Gaps follow references/cavity.js (cavity-re1000-*): max-abs over table points for profiles,
 * rel for psi_min, max-abs per coordinate for the vortex centre. Sim profiles are evaluated at the
 * table coordinate by 4-point Lagrange interpolation along the centreline, snapped to the grid node
 * when the 4-decimal table coordinate lies within 6e-5 of a node. */
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const H = require('../../tools/harness.js');

const RE = 1000;
const RUNS = [
  { N: 256, RES_TOL: 1e-5, T_MAX: 55, SNAP_T: [] },
  { N: 128, RES_TOL: 1e-7, T_MAX: 150, SNAP_T: [55] },
  { N: 64, RES_TOL: 1e-7, T_MAX: 120, SNAP_T: [] }
];

/* ------------------------------------------------------------------ worker: one grid */
function worker(cfg) {
  const LAB = H.load({ methods: ['psi-omega-fd'], verification: false });
  const p = H.params('psi-omega-fd', 'cavity', { Re: RE, N: cfg.N });
  const sim = LAB.methods['psi-omega-fd'].create('cavity', p);
  const met = () => Object.fromEntries(sim.metrics().map(m => [m.key, m.value]));
  const t0 = Date.now();
  const st = { maxCfl: 0, maxDiff: 0, maxPe: 0, maxDiv: 0, maxPoisson: 0, circMin: Infinity, circMax: -Infinity,
    nan: false, diverged: false, maxDtOverBound: 0 };
  const hist = [];
  const snaps = {};
  let snapIdx = 0, nextLog = 5;
  const h = 1 / cfg.N, nu = 1 / RE;
  const prof = () => ({ u: sim.probe('u_vcl'), v: sim.probe('v_hcl'), psimin: sim.probe('psi_min'), center: sim.probe('vortex_center') });
  while (true) {
    sim.step();
    if (sim.steps % 100 === 0 || sim.t >= cfg.T_MAX) {
      if (sim.diverged()) { st.diverged = true; }
      const m = met();
      if (![m.residual, m.ke, m.psimin].every(isFinite)) st.nan = true;
      st.maxCfl = Math.max(st.maxCfl, m.cfl); st.maxDiff = Math.max(st.maxDiff, m.diff);
      st.maxPe = Math.max(st.maxPe, m.pe); st.maxDiv = Math.max(st.maxDiv, m.div);
      st.maxPoisson = Math.max(st.maxPoisson, m.poisson);
      st.circMin = Math.min(st.circMin, m.circ); st.circMax = Math.max(st.circMax, m.circ);
      // central scheme bound dt <= 2 nu / max|u|^2 (method's stated criterion): umax is max |u| over nodes
      st.maxDtOverBound = Math.max(st.maxDtOverBound, m.dt / (2 * nu / Math.max(1, m.umax * m.umax)));
      if (sim.t >= nextLog) { nextLog += 5; hist.push({ t: +sim.t.toFixed(3), residual: m.residual, psimin: m.psimin, ke: m.ke, mg: m.mg }); }
      if (st.nan || st.diverged) break;
      if (snapIdx < cfg.SNAP_T.length && sim.t >= cfg.SNAP_T[snapIdx]) { snaps['t' + cfg.SNAP_T[snapIdx]] = prof(); snapIdx++; }
      if (m.residual < cfg.RES_TOL || sim.t >= cfg.T_MAX) break;
    }
  }
  const m = met();
  return { N: cfg.N, h, params: p, t: sim.t, steps: sim.steps, wall_s: (Date.now() - t0) / 1000,
    final: m, stab: st, hist, snaps, prof: prof(),
    stopReason: m.residual < cfg.RES_TOL ? 'residual < ' + cfg.RES_TOL : 't >= ' + cfg.T_MAX };
}

if (!isMainThread) { parentPort.postMessage(worker(workerData)); return; }

/* ------------------------------------------------------------------ helpers (main) */
function interp(xs, ys, x) {
  const n = xs.length - 1, hx = xs[1] - xs[0];
  const s = x / hx, jn = Math.round(s);
  if (Math.abs(x - jn * hx) < 6e-5) return ys[jn];
  let j0 = Math.floor(s) - 1; j0 = Math.max(0, Math.min(n - 3, j0));
  let val = 0;
  for (let a = 0; a < 4; a++) {
    let L = 1;
    for (let b = 0; b < 4; b++) if (b !== a) L *= (x - xs[j0 + b]) / (xs[j0 + a] - xs[j0 + b]);
    val += L * ys[j0 + a];
  }
  return val;
}
function tableGap(ref, pr) {
  const xs = ref.columns[0] === 'y' ? pr.u.y : pr.v.x, ys = ref.columns[0] === 'y' ? pr.u.u : pr.v.v;
  let worst = 0, at = null; const pts = [];
  ref.rows.forEach(([x, r]) => { const s = interp(xs, ys, x), d = Math.abs(s - r); pts.push([x, r, +s.toFixed(5), +d.toFixed(5)]); if (d > worst) { worst = d; at = x; } });
  return { id: ref.id, maxAbs: worst, at, tol: ref.tolerance.value, pass: worst <= ref.tolerance.value, points: pts };
}
function countExtrema(a) { // interior sign changes of the first difference (wiggle indicator)
  let c = 0, prev = 0;
  for (let i = 1; i < a.length; i++) { const d = a[i] - a[i - 1]; const s = Math.abs(d) < 1e-12 ? 0 : Math.sign(d); if (s && prev && s !== prev) c++; if (s) prev = s; }
  return c;
}
function profDiff(a, b) { // max |a-b| over nodes for both profiles (same grid)
  let d = 0;
  for (let i = 0; i < a.u.u.length; i++) d = Math.max(d, Math.abs(a.u.u[i] - b.u.u[i]), Math.abs(a.v.v[i] - b.v.v[i]));
  return d;
}

/* ------------------------------------------------------------------ main */
const LAB = H.load({ methods: ['psi-omega-fd'], verification: false });
const R = LAB.references;
const wall0 = Date.now();
Promise.all(RUNS.map(cfg => new Promise((res, rej) => {
  const w = new Worker(path.resolve(__filename), { workerData: cfg });
  w.on('message', res); w.on('error', rej);
}))).then(results => {
  const byN = {}; results.forEach(r => { byN[r.N] = r; });
  const refIds = ['cavity-re1000-ghia-u', 'cavity-re1000-ghia-v', 'cavity-re1000-erturk-u'];
  const evalGrid = r => {
    const out = { tables: refIds.map(id => tableGap(R[id], r.prof)) };
    const ps = r.prof.psimin;
    out.psimin = ps;
    out.psimin_ghia_rel = Math.abs(ps - R['cavity-re1000-ghia-psimin'].value) / Math.abs(R['cavity-re1000-ghia-psimin'].value);
    out.psimin_erturk_rel = Math.abs(ps - R['cavity-re1000-erturk-psimin'].value) / Math.abs(R['cavity-re1000-erturk-psimin'].value);
    const c = r.prof.center, cr = R['cavity-re1000-ghia-center'].value;
    out.center = c; out.center_maxAbs = Math.max(Math.abs(c.x - cr.x), Math.abs(c.y - cr.y));
    out.center_erturk_maxAbs = Math.max(Math.abs(c.x - 0.5300), Math.abs(c.y - 0.5650));
    out.extrema = { u_vcl: countExtrema(r.prof.u.u), v_hcl: countExtrema(r.prof.v.v), expected: { u_vcl: 1, v_hcl: 2 } };
    return out;
  };
  const grids = {};
  results.forEach(r => {
    const e = evalGrid(r);
    grids['N' + r.N] = {
      t: r.t, steps: r.steps, wall_s: r.wall_s, stopReason: r.stopReason,
      final: { residual: r.final.residual, dt: r.final.dt, ke: r.final.ke, enstrophy: r.final.enstrophy, circ: r.final.circ,
        umax: r.final.umax, div: r.final.div, poisson: r.final.poisson, mg: r.final.mg },
      stab: r.stab, hist: r.hist,
      circ_expected_discrete: -(1 - r.h), circ_err_vs_discrete: Math.abs(r.final.circ + (1 - r.h)), circ_err_vs_minus1: Math.abs(r.final.circ + 1),
      gaps: { ghia_u: { maxAbs: e.tables[0].maxAbs, at: e.tables[0].at, pass: e.tables[0].pass },
        ghia_v: { maxAbs: e.tables[1].maxAbs, at: e.tables[1].at, pass: e.tables[1].pass },
        erturk_u: { maxAbs: e.tables[2].maxAbs, at: e.tables[2].at, pass: e.tables[2].pass },
        psimin: e.psimin, psimin_ghia_rel: e.psimin_ghia_rel, psimin_erturk_rel: e.psimin_erturk_rel,
        center: e.center, center_ghia_maxAbs: e.center_maxAbs, center_erturk_maxAbs: e.center_erturk_maxAbs },
      extrema: e.extrema,
      points: Object.fromEntries(e.tables.map(t => [t.id, t.points]))
    };
  });
  // transient estimate: how much did the N=128 solution still change after t = 55 (the N=256 stop time)?
  const r128 = byN[128];
  const s55 = r128.snaps.t55;
  const transient = s55 ? {
    profile_maxchange_after_t55: profDiff(s55, r128.prof),
    psimin_change_after_t55: r128.prof.psimin - s55.psimin,
    psimin_relchange_after_t55: Math.abs(r128.prof.psimin - s55.psimin) / Math.abs(r128.prof.psimin),
    ghia_u_gap_at_t55: tableGap(R['cavity-re1000-ghia-u'], s55).maxAbs,
    ghia_v_gap_at_t55: tableGap(R['cavity-re1000-ghia-v'], s55).maxAbs,
    erturk_u_gap_at_t55: tableGap(R['cavity-re1000-erturk-u'], s55).maxAbs
  } : null;
  // grid convergence of psi_min: observed order and Richardson estimate from 64/128/256
  const p64 = byN[64].prof.psimin, p128 = byN[128].prof.psimin, p256 = byN[256].prof.psimin;
  const order = Math.log(Math.abs((p64 - p128) / (p128 - p256))) / Math.LN2;
  const richardson2 = p256 + (p256 - p128) / 3;   // assuming 2nd order

  const P = grids.N256, tolU = 0.03, tolRel = 0.03, tolC = 0.02;
  const passes = {
    'ghia-u (N256)': P.gaps.ghia_u.pass, 'ghia-v (N256)': P.gaps.ghia_v.pass, 'erturk-u (N256)': P.gaps.erturk_u.pass,
    'psimin-ghia (N256)': P.gaps.psimin_ghia_rel <= tolRel, 'psimin-erturk (N256)': P.gaps.psimin_erturk_rel <= tolRel,
    'center-ghia (N256)': P.gaps.center_ghia_maxAbs <= tolC,
    stability: results.every(r => !r.stab.nan && !r.stab.diverged && r.stab.maxCfl <= 1 && r.stab.maxDiff <= 0.25 && r.stab.maxDtOverBound <= 1 + 1e-12),
    'divergence-free': results.every(r => r.stab.maxDiv < 1e-10),
    'poisson-solved': results.every(r => r.stab.maxPoisson < 1e-6),
    'circulation': results.every(r => Math.abs(r.final.circ + (1 - r.h)) < 1e-8),
    'no-wiggles (N256 profiles)': P.extrema.u_vcl === 1 && P.extrema.v_hcl === 2
  };
  console.log(JSON.stringify({
    method: 'psi-omega-fd', experiment: 'cavity-re1000', Re: RE,
    protocol: RUNS, grids, transient_N128: transient,
    psimin_convergence: { p64, p128, p256, observed_order: order, richardson_p2: richardson2 },
    tolerances: { profiles_maxAbs: tolU, psimin_rel: tolRel, center_maxAbs: tolC },
    passes, wall_s: (Date.now() - wall0) / 1000
  }, null, 1));
}).catch(e => { console.error(e); process.exit(1); });
