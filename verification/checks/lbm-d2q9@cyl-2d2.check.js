#!/usr/bin/env node
/* Reviewer check: lbm-d2q9 @ cyl-2d2 (DFG / Schafer-Turek benchmark 2D-2, Re = 100, periodic shedding).
 * Reviewer: reviewer-lbm-d2q9-cyl-2d2-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/lbm-d2q9@cyl-2d2.check.js        (all runs in parallel, ~5-6 min on 4 cores)
 *        node verification/checks/lbm-d2q9@cyl-2d2.check.js --quick (res 20 only, T = 6 s; smoke test)
 * Prints a JSON summary on stdout.
 *
 * Protocol (references/cylinder.js, cylinder-2d2-*):
 *   Re = 100 (Um = 1.5 m/s, Ubar = 1 m/s, nu = 1e-3, D = 0.1), started from the inflow profile (method default),
 *   integrated to T_end = 10 s physical time. Analysis window = last 4 s (t in [6, 10] s, ~12 shedding periods).
 *   St  = D f / Ubar with f from upward zero crossings of cL - mean(cL) (linear interpolation between steps),
 *         f = (#crossings - 1) / (t_last - t_first). Raw cL zero crossings reported as well (cL has nonzero mean).
 *   cD,max, cL,max = maxima of the per-step momentum-exchange coefficients over the window (raw, as the reference
 *         defines them), plus per-period maxima to show periodicity, plus a smoothed (moving average over 1/100 period)
 *         maximum to quantify high-frequency (acoustic) content of the LBM force signal.
 *   dp (information only; not part of the experiment's quantity) = pressure_drop probe at t0 + 1/(2f), t0 = time of
 *         the last cL maximum in the window whose half-period later still lies in the window.
 * Runs (each a child process):
 *   A: res 20 cells/D, Ulat 0.1, staircase bounce-back (method defaults apart from Re)  -> published protocol
 *   B: res 20, Ulat 0.1, ibb 1 (interpolated bounce-back)
 *   C: res 30, Ulat 0.1, ibb 0
 *   D: res 30, Ulat 0.1, ibb 1
 *   E: res 20, Ulat 0.05, ibb 0 (Mach sensitivity: halves Ma, tau 0.52 -- near the BGK limit the method states)
 *   res 40 to 10 s (60 000 steps x 144 k nodes, ~11 min alone at ~13 MLUPS) does not fit in the review budget.
 * Checks:
 *   conservation: open channel, so total mass is not an invariant; we check (i) the domain mass is statistically
 *     stationary over the window (|mean(last 2 periods) - mean(first 2 periods)|/M0 < 1e-4, reviewer bound) and
 *     (ii) period-averaged volume flux balance |Q_out - Q_in|/Q_in < 1% at the inlet column vs the last column, and
 *     Q_in vs the analytic Ubar H = 0.41 m^2/s (reviewer bound 1%: halfway walls / node-height profile sampling).
 *     Momentum/energy are not invariants of this forced, dissipative, open problem.
 *   stability: no NaN / divergence; tau > 0.5 (method: tau >~ 0.51-0.55 for BGK); max Mach |u|/c_s < 0.3 (method).
 *   quantitative: gaps vs reference 'value' with the reference tolerance (rel 3% cD,max; rel 5% cL,max; rel 3% St);
 *     in-range vs the 1996 interval reported separately (information).
 */
'use strict';
const path = require('path');
const { fork } = require('child_process');
const H = require('../../tools/harness.js');

const TEND = 10, WIN = 4;

function child(res, ibb, Ulat, Tend) {
  const LAB = H.load({ methods: ['lbm-d2q9'], verification: false });
  const sim = LAB.methods['lbm-d2q9'].create('cylinder', H.params('lbm-d2q9', 'cylinder', { Re: 100, res, ibb, Ulat }));
  const met = () => { const o = {}; sim.metrics().forEach(m => { o[m.key] = m.value; }); return o; };
  const m0 = met();
  const dt = sim.dt, N = Math.ceil(Tend / dt - 1e-9);
  const T = new Float64Array(N), CD = new Float64Array(N), CL = new Float64Array(N);
  const every = Math.max(1, Math.round(0.05 / dt));
  const samples = [];   // t, mass, dmass, Q_in, Q_out, mach
  let nan = false, maxMach = m0.mach, maxMachWin = 0, tMaxMach = 0, dpAt = null;
  const wall0 = Date.now();
  const nx = m0.nx, ny = m0.ny, dxp = 0.1 / res;
  function flux(view, i) { let s = 0; for (let j = 0; j < ny; j++) s += view.data[j * nx + i]; return s * dxp; }
  for (let n = 0; n < N; n++) {
    sim.step();
    const f = sim.probe('forces');
    T[n] = sim.t; CD[n] = f.cd; CL[n] = f.cl;
    if (!isFinite(f.cd) || !isFinite(f.cl)) { nan = true; break; }
    if ((n + 1) % every === 0) {
      if (sim.diverged()) { nan = true; break; }
      const m = met();
      const v = sim.view('ux');
      if (m.mach > maxMach) { maxMach = m.mach; tMaxMach = sim.t; }
      if (sim.t >= Tend - WIN && m.mach > maxMachWin) maxMachWin = m.mach;
      samples.push([sim.t, m.mass, m.dmass, flux(v, 0), flux(v, nx - 1), m.mach]);
    }
  }
  const wall = (Date.now() - wall0) / 1000;
  const mEnd = met();
  // analysis
  const out = { res, ibb, Ulat, nx, ny, tau: m0.tau, nu_lat: m0.nu, dt, steps: N, t_end: sim.t, links: m0.links,
    wall_s: wall, MLUPS: N * nx * ny / wall / 1e6, nan, diverged: sim.diverged(), maxMach, tMaxMach, maxMachWin, mach_end: mEnd.mach };
  if (nan) return out;
  const n0 = T.findIndex(t => t >= Tend - WIN);
  const idx = [], t = [], cd = [], cl = [];
  for (let n = n0; n < N; n++) { t.push(T[n]); cd.push(CD[n]); cl.push(CL[n]); }
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const clMean = mean(cl), cdMean = mean(cd);
  function upCross(off) {
    const c = [];
    for (let k = 1; k < cl.length; k++) {
      const a = cl[k - 1] - off, b = cl[k] - off;
      if (a < 0 && b >= 0) c.push(t[k - 1] + (t[k] - t[k - 1]) * (-a) / (b - a));
    }
    return c;
  }
  const cr = upCross(clMean), crRaw = upCross(0);
  const freq = c => (c.length - 1) / (c[c.length - 1] - c[0]);
  const f = freq(cr), fRaw = freq(crRaw);
  const periods = []; for (let k = 1; k < cr.length; k++) periods.push(cr[k] - cr[k - 1]);
  // per-period maxima between successive mean-crossings
  const perMaxCl = [], perMaxCd = [], perMinCl = [];
  for (let k = 1; k < cr.length; k++) {
    let mc = -Infinity, md = -Infinity, mn = Infinity;
    for (let q = 0; q < t.length; q++) if (t[q] >= cr[k - 1] && t[q] < cr[k]) {
      if (cl[q] > mc) mc = cl[q]; if (cd[q] > md) md = cd[q]; if (cl[q] < mn) mn = cl[q];
    }
    perMaxCl.push(mc); perMaxCd.push(md); perMinCl.push(mn);
  }
  const spread = a => (Math.max(...a) - Math.min(...a)) / Math.abs(mean(a));
  const maxOf = a => a.reduce((m, x) => x > m ? x : m, -Infinity);
  // smoothed maxima (centred moving average over P/100)
  const Pm = 1 / f, w = Math.max(1, Math.round(Pm / 100 / dt)), half = Math.floor(w / 2);
  function smoothMax(a) {
    let m = -Infinity;
    for (let k = half; k < a.length - half; k++) { let s = 0; for (let q = k - half; q <= k + half; q++) s += a[q]; s /= (2 * half + 1); if (s > m) m = s; }
    return m;
  }
  // high-frequency residual: rms of signal minus smoothed
  function hfRms(a) {
    let s = 0, c = 0;
    for (let k = half; k < a.length - half; k++) { let m = 0; for (let q = k - half; q <= k + half; q++) m += a[q]; m /= (2 * half + 1); s += (a[k] - m) ** 2; c++; }
    return Math.sqrt(s / c);
  }
  // sub-window stability: first and second half of the window
  function sub(t0, t1) {
    const ii = []; for (let k = 0; k < t.length; k++) if (t[k] >= t0 && t[k] < t1) ii.push(k);
    const c = cr.filter(x => x >= t0 && x < t1);
    return { St: 0.1 * freq(c), cdmax: Math.max(...ii.map(k => cd[k])), clmax: Math.max(...ii.map(k => cl[k])) };
  }
  // mass / flux over the window, integer number of periods
  const sw = samples.filter(s => s[0] >= cr[0] && s[0] <= cr[cr.length - 1]);
  const twoP = 2 * Pm;
  const mFirst = mean(sw.filter(s => s[0] < cr[0] + twoP).map(s => s[1]));
  const mLast = mean(sw.filter(s => s[0] > cr[cr.length - 1] - twoP).map(s => s[1]));
  const M0 = mEnd.mass / (1 + mEnd.dmass);
  const Qin = mean(sw.map(s => s[3])), Qout = mean(sw.map(s => s[4]));
  Object.assign(out, {
    window: [t[0], t[t.length - 1]], crossings: cr.length, crossings_raw: crRaw.length,
    f, St: 0.1 * f, St_raw_zero: 0.1 * fRaw, period_mean: mean(periods), period_spread: spread(periods),
    cdmax: maxOf(cd), clmax: maxOf(cl), clmin: Math.min(...cl), cdmean: cdMean, clmean: clMean,
    cdmax_smooth: smoothMax(cd), clmax_smooth: smoothMax(cl), cd_hf_rms: hfRms(cd), cl_hf_rms: hfRms(cl),
    per_period: { clmax: [Math.min(...perMaxCl), Math.max(...perMaxCl)], cdmax: [Math.min(...perMaxCd), Math.max(...perMaxCd)],
      clmax_spread: spread(perMaxCl), cdmax_spread: spread(perMaxCd), n: perMaxCl.length },
    halves: { first: sub(Tend - WIN, Tend - WIN / 2), second: sub(Tend - WIN / 2, Tend + 1) },
    mass: { M0, dmass_end: mEnd.dmass, stationarity: (mLast - mFirst) / M0,
      dmass_range_window: [Math.min(...sw.map(s => s[2])), Math.max(...sw.map(s => s[2]))] },
    flux: { Q_in: Qin, Q_out: Qout, Q_exact: 0.41, imbalance: (Qout - Qin) / Qin, inflow_error: (Qin - 0.41) / 0.41 }
  });
  // dp at t0 + P/2: rerun is too costly, so sample dp on the fly would be needed; done below via a short continuation
  // Continue the simulation: find next cL maximum (after the window end), then step half a period and read dp.
  let prev = sim.probe('forces').cl, rising = false, tmax = null, guard = 0;
  while (guard++ < Math.ceil(2 * Pm / dt)) {
    sim.step(); const c = sim.probe('forces').cl;
    if (c > prev) rising = true; else if (rising && c < prev) { tmax = sim.t - dt; break; }
    prev = c;
  }
  if (tmax !== null) {
    while (sim.t < tmax + Pm / 2 - 1e-12) sim.step();
    dpAt = { t0: tmax, t: sim.t, dp: sim.probe('pressure_drop') };
  }
  out.dp = dpAt;
  return out;
}

/* ------------------------------------------------------------------ child entry */
if (process.argv[2] === '--child') {
  const [res, ibb, Ulat, Tend] = process.argv.slice(3).map(Number);
  const r = child(res, ibb, Ulat, Tend);
  process.send(r, () => process.exit(0));
  return;
}

/* ------------------------------------------------------------------ parent */
const quick = process.argv.includes('--quick');
const LAB = H.load({ methods: ['lbm-d2q9'], verification: false });
const R = LAB.references;
const refs = { cdmax: R['cylinder-2d2-cdmax'], clmax: R['cylinder-2d2-clmax'], St: R['cylinder-2d2-st'], dp: R['cylinder-2d2-dp'] };
const runs = quick ? [{ name: 'A', res: 20, ibb: 0, Ulat: 0.1, T: 6 }] : [
  { name: 'A', res: 20, ibb: 0, Ulat: 0.1, T: TEND },
  { name: 'B', res: 20, ibb: 1, Ulat: 0.1, T: TEND },
  { name: 'C', res: 30, ibb: 0, Ulat: 0.1, T: TEND },
  { name: 'D', res: 30, ibb: 1, Ulat: 0.1, T: TEND },
  { name: 'E', res: 20, ibb: 0, Ulat: 0.05, T: TEND }
];
const wall0 = Date.now();
Promise.all(runs.map(r => new Promise((resolve, reject) => {
  const c = fork(__filename, ['--child', r.res, r.ibb, r.Ulat, r.T], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  c.on('message', m => resolve(Object.assign({ name: r.name }, m)));
  c.on('exit', code => { if (code) reject(new Error('child ' + r.name + ' exit ' + code)); });
}))).then(results => {
  const rel = (v, ref) => Math.abs(v - ref.value) / Math.abs(ref.value);
  const inR = (v, ref) => v >= ref.range[0] && v <= ref.range[1];
  results.forEach(r => {
    if (r.nan) { r.gaps = null; r.checks = { stability: false, diverged_at_s: r.t_end }; return; }
    r.gaps = {
      St: { value: r.St, rel: rel(r.St, refs.St), tol: refs.St.tolerance.value, pass: rel(r.St, refs.St) <= refs.St.tolerance.value, inRange: inR(r.St, refs.St) },
      cdmax: { value: r.cdmax, rel: rel(r.cdmax, refs.cdmax), tol: refs.cdmax.tolerance.value, pass: rel(r.cdmax, refs.cdmax) <= refs.cdmax.tolerance.value, inRange: inR(r.cdmax, refs.cdmax) },
      clmax: { value: r.clmax, rel: rel(r.clmax, refs.clmax), tol: refs.clmax.tolerance.value, pass: rel(r.clmax, refs.clmax) <= refs.clmax.tolerance.value, inRange: inR(r.clmax, refs.clmax) },
      dp_info: r.dp ? { value: r.dp.dp, rel: rel(r.dp.dp, refs.dp), tol: refs.dp.tolerance.value, pass: rel(r.dp.dp, refs.dp) <= refs.dp.tolerance.value, inRange: inR(r.dp.dp, refs.dp) } : null
    };
    r.checks = {
      // method criterion Ma < ~0.3; judged on the analysis window. The impulsive start (uniform-density field set to the
      // inflow profile) emits a pressure wave whose peak Mach is reported separately (mach_startup_lt_0p3), not used to classify.
      stability: !r.nan && !r.diverged && r.tau > 0.5 && r.maxMachWin < 0.3,
      mach_startup_lt_0p3: r.maxMach < 0.3,
      mass_stationary: Math.abs(r.mass.stationarity) < 1e-4,
      flux_balance: Math.abs(r.flux.imbalance) < 0.01,
      inflow_flux: Math.abs(r.flux.inflow_error) < 0.01,
      periodic: r.per_period.clmax_spread < 0.01 && r.per_period.cdmax_spread < 0.01 && r.period_spread < 0.01,
      quantitative: r.gaps.St.pass && r.gaps.cdmax.pass && r.gaps.clmax.pass
    };
  });
  const summary = {
    method: 'lbm-d2q9', experiment: 'cyl-2d2', T_end: quick ? 6 : TEND, window_s: WIN,
    references: Object.fromEntries(Object.entries(refs).map(([k, r]) => [k, { id: r.id, value: r.value, range: r.range, tol: r.tolerance }])),
    runs: results, wall_total_s: (Date.now() - wall0) / 1000
  };
  console.log(JSON.stringify(summary, null, 1));
}).catch(e => { console.error(e); process.exit(1); });
