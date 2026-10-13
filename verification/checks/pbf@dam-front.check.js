#!/usr/bin/env node
/* Reviewer check: pbf @ dam-front (2D dam break, surge-front history Z(T)).
 * Reviewer: reviewer-pbf-dam-front-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/pbf@dam-front.check.js     (about 6-8 min single-threaded)
 * Prints a JSON summary on stdout.
 *
 * Protocol (references/dam-break.js, research/ptc.md "Tolerance suggestion"):
 *   Z = front/a, T = t*sqrt(2g/a). Primary metric: max |Z_sim - Z_ref| over the Lethe points with
 *   0 < T <= 3 (dam-break-mm-front-lethe), tolerance 0.25, allowing ONE time shift dT in [0, 0.25]
 *   (simulated curve delayed: Z_ref(T) is compared with Z_sim(T - dT)); dT is reported. The unshifted
 *   error is also reported. Secondary: PySPH a = 2.25 in digitised series (dam-break-mm-front-a225)
 *   up to Z <= 0.9 L_tank/a in an extended tank (tankL = 12); scored within the suggested window 0 < T <= 3,
 *   the T > 3 part (to T = 6.8) is reported for information only (outside the reference's suggested check).
 *   Ritter bound (dam-break-ritter-front-bound): Z_sim(T) <= 1 + 2T at every step.
 *   a = 0.05715 m (2.25 in), g = 9.81 (method defaults) match the Martin & Moyce a = 2.25 in case.
 * Conservation: mass (exact, n*m); total energy E = KE + PE must not exceed E0 (physical dam break only
 *   dissipates; reviewer criterion: max (E - E0)/E0 <= 1e-3). Momentum is not conserved (walls, gravity): n/a.
 * Stability: no NaN/divergence; max |v| dt <= h/2 (the method's stated criterion) i.e. cfl metric <= hdx/2.
 * Density-constraint error: mean (rho/rho0 - 1) over particles, mean positive compression, max,
 *   time-averaged over 0 < T <= 3; iteration-count sensitivity at nx = 40 (iters 1, 2, 4, 8, 16).
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['pbf'], verification: false });
const M = LAB.methods.pbf;
const R = LAB.references;
const refL = R['dam-break-mm-front-lethe'], refA = R['dam-break-mm-front-a225'], ritter = R['dam-break-ritter-front-bound'];
const wall0 = Date.now();

function run(over, Tend) {
  const p = H.params('pbf', 'dam-break', over);
  const sim = M.create('dam-break', p);
  const a = p.a, g = p.g, k = Math.sqrt(2 * g / a), dx = a / p.nx, h = p.hdx * dx;
  const Ts = [0], Zs = [sim.probe('front') / a];
  const tot0 = sim.probe('totals'), E0 = tot0.ke + tot0.pe, m0 = tot0.mass;
  let maxRel = -Infinity, minRel = Infinity, maxDisp = 0, ritterExcess = -Infinity, ritterAt = null, nan = false, massDrift = 0;
  let dSum = 0, dPosSum = 0, dMax = -Infinity, dN = 0;
  const t0 = Date.now();
  while (sim.t * k < Tend) {
    sim.step();
    const T = sim.t * k, Z = sim.probe('front') / a;
    if (!isFinite(Z)) { nan = true; break; }
    Ts.push(T); Zs.push(Z);
    const ex = Z - ritter.fn(T); if (ex > ritterExcess) { ritterExcess = ex; ritterAt = T; }
    const tt = sim.probe('totals'), rel = (tt.ke + tt.pe - E0) / E0;
    if (rel > maxRel) maxRel = rel; if (rel < minRel) minRel = rel;
    massDrift = Math.max(massDrift, Math.abs(tt.mass - m0) / m0);
    const met = {}; sim.metrics().forEach(q => { met[q.key || q.id || q.name] = q.value; });
    const cfl = met.cfl; if (cfl > maxDisp) maxDisp = cfl;
    if (sim.steps % 10 === 0 && T <= 3) {
      const v = sim.view('density').value; let s = 0, sp = 0, mx = -Infinity;
      for (let i = 0; i < v.length; i++) { const c = v[i] - 1; s += c; if (c > 0) sp += c; if (c > mx) mx = c; }
      dSum += s / v.length; dPosSum += sp / v.length; dMax = Math.max(dMax, mx); dN++;
    }
    if (sim.steps % 200 === 0 && sim.diverged()) { nan = true; break; }
  }
  const tf = sim.probe('totals');
  return {
    params: p, steps: sim.steps, dt: sim.dt, wall_s: (Date.now() - t0) / 1000, Ts, Zs,
    nan: nan || sim.diverged(), massDriftRel: massDrift,
    energy: { E0, maxRelGain: maxRel, finalRel: (tf.ke + tf.pe - E0) / E0, minRel },
    maxCfl: maxDisp, cflLimit: p.hdx / 2,
    ritter: { maxExcess: ritterExcess, atT: ritterAt },
    density: { meanC: dSum / dN, meanCompression: dPosSum / dN, maxC: dMax, samples: dN }
  };
}

function zAt(r, T) {
  if (T <= 0) return r.Zs[0];
  const Ts = r.Ts; let lo = 0, hi = Ts.length - 1;
  if (T >= Ts[hi]) return NaN;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (Ts[mid] <= T) lo = mid; else hi = mid; }
  const s = (T - Ts[lo]) / (Ts[hi] - Ts[lo]); return r.Zs[lo] * (1 - s) + r.Zs[hi] * s;
}

function compare(r, rows) {
  const errFor = dT => {
    let mx = 0, at = null; const pts = [];
    rows.forEach(([T, Z]) => { const zs = zAt(r, T - dT), e = zs - Z; pts.push([T, Z, +zs.toFixed(4), +e.toFixed(4)]); if (Math.abs(e) > mx) { mx = Math.abs(e); at = T; } });
    return { maxAbs: mx, atT: at, pts };
  };
  const unshifted = errFor(0);
  let best = null;
  for (let i = 0; i <= 50; i++) { const dT = 0.005 * i, e = errFor(dT); if (!best || e.maxAbs < best.maxAbs - 1e-12) best = Object.assign({ dT }, e); }
  return { unshifted: { maxAbs: unshifted.maxAbs, atT: unshifted.atT, pts: unshifted.pts }, best };
}

const lethe = refL.rows.filter(r => r[0] > 0 && r[0] <= 3);
const strip = r => { const o = Object.assign({}, r); delete o.Ts; delete o.Zs; return o; };

/* 1. resolution study (default parameters, tank 5a), T up to 3.05 */
const res = {};
[20, 40, 80].forEach(nx => {
  const r = run({ nx }, 3.05);
  res['nx' + nx] = Object.assign(strip(r), { lethe: compare(r, lethe),
    Z_at: [0.5, 1, 1.5, 2, 2.5, 3].map(T => [T, +zAt(r, T).toFixed(4)]) });
});

/* 2. iteration sensitivity at nx = 40 */
const itr = {};
[1, 2, 8, 16].forEach(it => {
  const r = run({ nx: 40, iters: it }, 3.05);
  const c = compare(r, lethe);
  itr['iters' + it] = { wall_s: r.wall_s, nan: r.nan, density: r.density, energy: r.energy, maxCfl: r.maxCfl,
    lethe_unshifted: c.unshifted.maxAbs, lethe_best: c.best.maxAbs, lethe_best_dT: c.best.dT, Z_T3: +zAt(r, 3).toFixed(4) };
});
itr.iters4 = { from: 'resolution study nx40', density: res.nx40.density, lethe_unshifted: res.nx40.lethe.unshifted.maxAbs,
  lethe_best: res.nx40.lethe.best.maxAbs, lethe_best_dT: res.nx40.lethe.best.dT, Z_T3: res.nx40.Z_at[5][1] };

/* 3. extended tank (12a) at nx = 40 for the a = 2.25 in digitised series up to Z <= 0.9*12 */
const ext = run({ nx: 40, tankL: 12 }, 9.4);
const a225 = refA.rows.filter(r => r[1] <= 0.9 * 12);
const extC = compare(ext, a225);
// late-time slope dZ/dT over T in [5.1, 9.2] (data value ~1.69 per research/ptc.md; Ritter 2)
const fitSlope = (r, T1, T2) => { let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < r.Ts.length; i++) if (r.Ts[i] >= T1 && r.Ts[i] <= T2) { n++; sx += r.Ts[i]; sy += r.Zs[i]; sxx += r.Ts[i] ** 2; sxy += r.Ts[i] * r.Zs[i]; }
  return (n * sxy - sx * sy) / (n * sxx - sx * sx); };
// window limited to T <= 6.85 so the front stays clear of the 12a end wall (Z < 10.8)
const dataSlope = (rows, T1, T2) => { const r = { Ts: rows.map(q => q[0]), Zs: rows.map(q => q[1]) }; return fitSlope(r, T1, T2); };
const extC3 = compare(ext, a225.filter(r => r[0] <= 3));
const extended = Object.assign(strip(ext), { a225_all: extC, a225_T_le_3: extC3,
  lateSlope_sim_5p1_6p85: fitSlope(ext, 5.1, 6.85), lateSlope_data_5p1_6p85: dataSlope(refA.rows, 5.1, 6.85) });

/* summary / passes (primary = finest nx = 80) */
const P = res.nx80;
const all = [res.nx20, res.nx40, res.nx80, ext];
const passes = {
  'lethe max|dZ| (best dT) <= 0.25 (nx80)': P.lethe.best.maxAbs <= refL.tolerance.value,
  'lethe max|dZ| (best dT) <= 0.25 (nx40)': res.nx40.lethe.best.maxAbs <= refL.tolerance.value,
  'a225 max|dZ| (best dT) <= 0.25, 0 < T <= 3 (nx40, tank 12a)': extC3.best.maxAbs <= refA.tolerance.value,
  'INFO (outside suggested window) a225 max|dZ| (best dT) <= 0.25, T up to 6.8': extC.best.maxAbs <= refA.tolerance.value,
  'Ritter bound Z <= 1 + 2T (all runs)': all.every(r => r.ritter.maxExcess <= 0),
  'mass conserved': all.every(r => r.massDriftRel < 1e-12),
  'energy not increasing (max gain <= 1e-3 E0), default iters': all.every(r => r.energy.maxRelGain <= 1e-3),
  'INFO energy not increasing, iteration study': Object.values(itr).every(r => !r.energy || r.energy.maxRelGain <= 1e-3),
  'stability (no NaN, max|v|dt <= h/2)': all.every(r => !r.nan && r.maxCfl <= r.cflLimit) &&
    Object.values(itr).every(r => r.nan === undefined || (!r.nan && r.maxCfl <= 1))
};
console.log(JSON.stringify({ method: 'pbf', experiment: 'dam-front', resolution: res, iterations: itr, extended, passes,
  wall_s: (Date.now() - wall0) / 1000 }, null, 1));
