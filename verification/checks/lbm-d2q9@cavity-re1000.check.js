#!/usr/bin/env node
/* Reviewer check: lbm-d2q9 @ cavity-re1000 (lid-driven cavity, Re = 1000, steady state).
 * Reviewer: reviewer-lbm-d2q9-cavity-re1000-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node "verification/checks/lbm-d2q9@cavity-re1000.check.js"
 * Prints a JSON summary on stdout. Runtime about 9.5 min wall: two worker threads in parallel. Measured on this
 * container: ~12 MLUPS per worker with 1-2 workers, but only ~7 MLUPS each with 3 workers (about 2 cores of
 * memory/CPU throughput), so the runs are packed into two workers.
 *
 * Protocol (method defaults except Re and N): Re = 1000, Ulat = 0.1 (Ma 0.17 nominal), tau = 0.5 + 3 Ulat N / Re.
 *   N = 192, Ulat 0.1 (tau 0.558): PRIMARY, the largest grid that gets close to steady in the budget. One time
 *            unit = 1920 steps (~6.5 s); run until residual < 1e-7 or the worker's wall cap (WALL_CAP s).
 *   N = 256 is NOT run: one time unit = 2560 steps on 65536 nodes (~13.5 s at 12 MLUPS) and the N = 128 history
 *            shows t >= 60 is needed for the profiles to settle within 1e-3 U, i.e. > 13 min for one run. A first
 *            attempt (4 workers, contended) reached only t = 19.25 in 530 s, far from steady (u gap 0.069).
 *   N = 128, Ulat 0.1 (tau 0.538): method default and recommended minimum at Re = 1000; run to residual < 1e-7.
 *            Its time history (every 10 time units) estimates the remaining transient of the truncated runs.
 *   N = 64,  Ulat 0.1 (tau 0.519): grid trend only (near the BGK tau limit), cap t = 150.
 *   N = 128, Ulat 0.05 (tau 0.519): Mach sensitivity; truncated by the wall cap, compared with the Ulat 0.1 run
 *            at the same time t (from the 10-unit snapshots).
 * All runs start from rest. Snapshots of all comparisons are recorded every 10 time units.
 * Gaps per references/cavity.js (cavity-re1000-*): max-abs over the table rows for profiles (tol 0.03 U),
 * rel for psi_min (tol 0.03), max(|dx|,|dy|) for the vortex centre (tol 0.02). LBM nodes are cell centres,
 * the u_vcl / v_hcl probes add the wall values; the sim profile is evaluated at the table coordinate
 * (Ghia's 4-decimal coordinates snapped to j/128) by 4-point Lagrange interpolation on that profile.
 * Conservation: total mass sum(rho), criterion |M-M0|/M0 < 10 eps per step (reviewer-set; exact in exact arithmetic).
 * Stability: no NaN; tau > 1/2; Mach |u|/c_s < 0.3 (method's stated criteria).
 */
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const H = require('../../tools/harness.js');

const RE = 1000;
const WALL_CAP = +process.env.WALL_CAP || 555;  // seconds per worker (env override for smoke tests only)
const GROUPS = [
  [{ N: 192, Ulat: 0.1, resTol: 1e-7, tCap: 200 }],
  [{ N: 128, Ulat: 0.1, resTol: 1e-7, tCap: 150 }, { N: 64, Ulat: 0.1, resTol: 1e-7, tCap: 150 }, { N: 128, Ulat: 0.05, resTol: 1e-7, tCap: 200 }]
];

function lagr(xs, ys, x) {
  let k = 1; while (k < xs.length - 1 && xs[k] < x) k++;   // xs[k-1] < x <= xs[k]
  let a = Math.max(0, Math.min(xs.length - 4, k - 2));
  let s = 0;
  for (let i = a; i < a + 4; i++) {
    let l = 1; for (let j = a; j < a + 4; j++) if (j !== i) l *= (x - xs[j]) / (xs[i] - xs[j]);
    s += l * ys[i];
  }
  return s;
}

function compare(prof, xKey, yKey, ref, snapGhia) {
  let maxAbs = 0, at = null; const rows = [];
  ref.rows.forEach(r => {
    const c = snapGhia ? Math.round(r[0] * 128) / 128 : r[0];
    const s = lagr(prof[xKey], prof[yKey], c), d = s - r[1];
    rows.push({ coord: r[0], ref: r[1], sim: +s.toFixed(5), diff: +d.toFixed(5) });
    if (Math.abs(d) > maxAbs) { maxAbs = Math.abs(d); at = r[0]; }
  });
  return { maxAbs, at, tol: ref.tolerance.value, pass: maxAbs <= ref.tolerance.value, rows };
}

function evaluate(sim, R) {
  const u = sim.probe('u_vcl'), v = sim.probe('v_hcl'), psimin = sim.probe('psi_min'), c = sim.probe('vortex_center');
  const gu = compare(u, 'y', 'u', R['cavity-re1000-ghia-u'], true);
  const gv = compare(v, 'x', 'v', R['cavity-re1000-ghia-v'], true);
  const eu = compare(u, 'y', 'u', R['cavity-re1000-erturk-u'], false);
  const pg = R['cavity-re1000-ghia-psimin'].value, pe = R['cavity-re1000-erturk-psimin'].value, cc = R['cavity-re1000-ghia-center'].value;
  return {
    t: sim.t, ghia_u: gu, ghia_v: gv, erturk_u: eu, psimin,
    psiRelGhia: Math.abs(psimin - pg) / Math.abs(pg), psiRelErturk: Math.abs(psimin - pe) / Math.abs(pe),
    center: c, centerErr: Math.max(Math.abs(c.x - cc.x), Math.abs(c.y - cc.y)),
    u_mid: lagr(u.y, u.u, 0.5)
  };
}
const brief = e => ({ t: +e.t.toFixed(2), ghia_u: +e.ghia_u.maxAbs.toFixed(5), ghia_v: +e.ghia_v.maxAbs.toFixed(5),
  erturk_u: +e.erturk_u.maxAbs.toFixed(5), psimin: +e.psimin.toFixed(6), psiRelGhia: +e.psiRelGhia.toFixed(5),
  centerErr: +e.centerErr.toFixed(5), center: { x: +e.center.x.toFixed(4), y: +e.center.y.toFixed(4) } });

function runCase(cfg, deadline) {
  const LAB = H.load({ methods: ['lbm-d2q9'], verification: false });
  const R = LAB.references;
  const sim = LAB.methods['lbm-d2q9'].create('cavity', H.params('lbm-d2q9', 'cavity', { Re: RE, N: cfg.N, Ulat: cfg.Ulat }));
  const met = () => Object.fromEntries(sim.metrics().map(m => [m.key, m.value]));
  const t0 = Date.now();
  const chunk = Math.max(50, Math.round(cfg.N / cfg.Ulat / 20));
  let nan = false, maxMach = 0, maxDmass = 0, nextSnap = 10, stop = 'tCap';
  const hist = [];
  while (sim.t < cfg.tCap) {
    for (let s = 0; s < chunk; s++) sim.step();
    if (sim.diverged()) { nan = true; stop = 'NaN'; break; }
    const m = met(); maxMach = Math.max(maxMach, m.mach); maxDmass = Math.max(maxDmass, m.dmass);
    if (sim.t >= nextSnap - 1e-9) { const e = evaluate(sim, R); hist.push(Object.assign(brief(e), { residual: m.residual })); nextSnap += 10; }
    if (m.residual < cfg.resTol) { stop = 'residual'; break; }
    if (Date.now() > deadline) { stop = 'wallclock'; break; }
  }
  const m = met();
  const out = { N: cfg.N, Ulat: cfg.Ulat, tau: m.tau, steps: sim.steps, t_end: sim.t, wall_s: (Date.now() - t0) / 1000,
    stop, residual: m.residual, nan: nan || sim.diverged(), maxMach, umax: m.umax,
    conservation: { mass: m.mass, dmass_final: m.dmass, dmass_max: maxDmass, div_max: m.div }, history: hist };
  if (!out.nan) { const e = evaluate(sim, R); out.final = e; hist.push(Object.assign(brief(e), { residual: m.residual })); }
  return out;
}

if (!isMainThread) {
  const deadline = Date.now() + WALL_CAP * 1000;
  const res = workerData.map(cfg => runCase(cfg, deadline));
  parentPort.postMessage(res);
} else {
  const wall0 = Date.now();
  Promise.all(GROUPS.map(g => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: g });
    w.on('message', res); w.on('error', rej);
  }))).then(groups => {
    const runs = [].concat(...groups);
    const find = (N, U) => runs.find(r => r.N === N && r.Ulat === U);
    const P = find(192, 0.1), R192 = find(192, 0.1), R128 = find(128, 0.1), R64 = find(64, 0.1), RMa = find(128, 0.05);
    const EPS = 2.220446049250313e-16;
    const massOK = r => r.conservation.dmass_max < 10 * EPS * r.steps;
    // transient correction estimate: from the converged N=128 history, change in each measure after time t_P
    let transient = null;
    if (R128 && R128.history.length && P) {
      const hs = R128.history, last = hs[hs.length - 1];
      const near = hs.reduce((b, h) => Math.abs(h.t - P.t_end) < Math.abs(b.t - P.t_end) ? h : b, hs[0]);
      transient = { from_t: near.t, to_t: last.t, d_psimin: last.psimin - near.psimin,
        d_ghia_u: last.ghia_u - near.ghia_u, d_ghia_v: last.ghia_v - near.ghia_v, d_erturk_u: last.erturk_u - near.erturk_u,
        d_centerErr: last.centerErr - near.centerErr };
    }
    let machCmp = null;
    if (R128 && RMa && RMa.history.length) {
      const hm = RMa.history.filter(h => Math.abs(h.t / 10 - Math.round(h.t / 10)) < 1e-6).pop();
      const h1 = hm && R128.history.find(h => Math.abs(h.t - hm.t) < 1e-6);
      if (h1) machCmp = { t: hm.t, Ulat01: h1, Ulat005: hm, d_psimin_rel: Math.abs(hm.psimin - h1.psimin) / Math.abs(h1.psimin),
        d_ghia_u: hm.ghia_u - h1.ghia_u, d_ghia_v: hm.ghia_v - h1.ghia_v, d_erturk_u: hm.erturk_u - h1.erturk_u };
    }
    const fin = r => r.final ? {
      ghia_u: { maxAbs: r.final.ghia_u.maxAbs, at: r.final.ghia_u.at, pass: r.final.ghia_u.pass },
      ghia_v: { maxAbs: r.final.ghia_v.maxAbs, at: r.final.ghia_v.at, pass: r.final.ghia_v.pass },
      erturk_u: { maxAbs: r.final.erturk_u.maxAbs, at: r.final.erturk_u.at, pass: r.final.erturk_u.pass },
      psimin: r.final.psimin, psiRelGhia: r.final.psiRelGhia, psiRelErturk: r.final.psiRelErturk,
      center: r.final.center, centerErr: r.final.centerErr, u_mid: r.final.u_mid } : null;
    const summary = {
      method: 'lbm-d2q9', experiment: 'cavity-re1000', Re: RE, wall_cap_s: WALL_CAP,
      runs: runs.map(r => ({ N: r.N, Ulat: r.Ulat, tau: r.tau, steps: r.steps, t_end: +r.t_end.toFixed(2), stop: r.stop,
        residual: r.residual, wall_s: r.wall_s, nan: r.nan, maxMach: r.maxMach, umax: r.umax,
        dmass_max: r.conservation.dmass_max, dmass_bound: 10 * EPS * r.steps, mass_ok: massOK(r), div_max: r.conservation.div_max,
        final: fin(r), history: r.history })),
      primary_rows: P && P.final ? { ghia_u: P.final.ghia_u.rows, ghia_v: P.final.ghia_v.rows, erturk_u: P.final.erturk_u.rows } : null,
      n128_rows: R128 && R128.final ? { ghia_u: R128.final.ghia_u.rows, ghia_v: R128.final.ghia_v.rows, erturk_u: R128.final.erturk_u.rows } : null,
      transient_from_N128: transient,
      mach_sensitivity_N128_equal_t: machCmp,
      passes: P && P.final ? {
        ghia_u: P.final.ghia_u.pass, ghia_v: P.final.ghia_v.pass, erturk_u: P.final.erturk_u.pass,
        psi_min_ghia: P.final.psiRelGhia <= 0.03, psi_min_erturk: P.final.psiRelErturk <= 0.03,
        vortex_center: P.final.centerErr <= 0.02,
        stability: runs.every(r => !r.nan && r.tau > 0.5 && r.maxMach < 0.3),
        mass_conservation: runs.every(massOK),
        primary_steady: P.stop === 'residual'
      } : null,
      wall_s: (Date.now() - wall0) / 1000
    };
    console.log(JSON.stringify(summary, null, 1));
  }).catch(e => { console.error(e); process.exit(1); });
}
