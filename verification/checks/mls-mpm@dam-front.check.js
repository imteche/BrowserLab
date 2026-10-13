#!/usr/bin/env node
/* Reviewer check: mls-mpm @ dam-front (2D dam break, surge-front history Z(T)).
 * Reviewer: reviewer-mls-mpm-dam-front-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/mls-mpm@dam-front.check.js     (about 4-6 min single-threaded)
 * Prints a JSON summary on stdout.
 *
 * Protocol (references/dam-break.js, research/ptc.md "Tolerance suggestion"):
 *   Z = front/a, T = t*sqrt(2g/a). Primary metric: max |Z_sim - Z_ref| over the Lethe points with
 *   0 < T <= 3 (dam-break-mm-front-lethe), tolerance 0.25, allowing ONE time shift dT in [0, 0.25]
 *   (simulated curve delayed: Z_ref(T) is compared with Z_sim(T - dT)); dT is reported, as is the
 *   unshifted error. Secondary: PySPH a = 2.25 in digitised series (dam-break-mm-front-a225), scored in
 *   the suggested window 0 < T <= 3 in an extended tank (Lx = 12a); T > 3 (Z <= 0.9*12) is information only.
 *   Ritter bound (dam-break-ritter-front-bound): Z_sim(T) <= 1 + 2T at every step.
 *   a = 0.05715 m (2.25 in), g = 9.81: the Martin & Moyce a = 2.25 in case. Other parameters are the
 *   method defaults (cfac = 10, i.e. c0 = 10 sqrt(2 g 2a), the WCSPH rule from pysph-dbexp; cfl = 0.4; bc = 0).
 *   Resolution study N = 16, 32, 64, 96 grid cells across a (4 particles/cell: 2k ... 74k particles);
 *   primary = N = 96 (finest that fits the budget). Sensitivity at N = 32: cfac = 20, bc = 1, cfl = 0.2.
 * Conservation:
 *   mass: particle masses fixed -> exact (probe totals).
 *   momentum of the transfers: the method's own diagnostics p2g = |sum_i (m v)_i - sum_p m_p v_p| / (M vmax)
 *     (P2G, before gravity/walls) and g2p = |sum_i m_i v_i - sum_p m_p v_p| / (M vmax) (G2P, after grid update);
 *     both must be at round-off (reviewer criterion <= 1e-10). Step 1 is skipped (vmax = 0 normalisation).
 *     Total momentum is not conserved by the physics (gravity, walls).
 *   energy: E = KE + PE + elastic, elastic = sum_p V_p E (J_p - 1)^2 / 2 (work of p = -E(J-1) on V_p = V0 J_p,
 *     reviewer-derived). A dam break only dissipates: reviewer criterion max (E - E0)/E0 <= 1e-3 (same as the
 *     PBF/WCSPH reviews). The elastic term uses Float32 J from sim.view('J') (enough for |J-1| ~ 1e-2).
 * Stability: no NaN / diverged(); acoustic CFL dt(c0+|v|)/dx <= 0.51 (mpm88 value, research/ptc.md) and
 *   |v| dt/dx < 1 (method's stated stencil criterion); no position clamps.
 * Compressibility: max and particle-mean |J - 1| over 0 < T <= 3 and Mach max|v|/c0; reported. Reviewer check
 *   (weakly compressible assumption, the delta rho/rho ~ Ma^2 ~ 1% rule behind c0 = 10 U): time-averaged mean |J-1| <= 1%.
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['mls-mpm'], verification: false });
const M = LAB.methods['mls-mpm'];
const R = LAB.references;
const refL = R['dam-break-mm-front-lethe'], refA = R['dam-break-mm-front-a225'], ritter = R['dam-break-ritter-front-bound'];
const wall0 = Date.now();
const A = 0.05715, G = 9.81;

function run(over, Tend) {
  const p = H.params('mls-mpm', 'dam-break', Object.assign({ a: A, g: G }, over));
  const sim = M.create('dam-break', p);
  const a = p.a, g = p.g, k = Math.sqrt(2 * g / a), N = Math.round(p.N), dx = a / N;
  const rho0 = 1000, c0 = p.cfac * Math.sqrt(2 * g * 2 * a), Emod = rho0 * c0 * c0, Vp = dx * dx / 4;
  const elastic = () => { const J = sim.view('J').value; let s = 0; for (let i = 0; i < J.length; i++) s += (J[i] - 1) * (J[i] - 1); return 0.5 * Emod * Vp * s; };
  const Ts = [0], Zs = [sim.probe('front') / a];
  const tot0 = sim.probe('totals'), el0 = elastic(), E0 = tot0.ke + tot0.pe + el0, m0 = tot0.mass;
  let maxRel = -Infinity, maxRelAt = null, ritterExcess = -Infinity, ritterAt = null, nan = false, massDrift = 0;
  let maxP2G = 0, maxG2P = 0, maxCfl = 0, maxStencil = 0, maxMach = 0, maxDJ = 0, dJsum = 0, dJn = 0, clamp = 0;
  const t0 = Date.now();
  while (sim.t * k < Tend) {
    sim.step();
    const T = sim.t * k, f = sim.probe('front');
    if (f == null || !isFinite(f)) { nan = true; break; }
    const Z = f / a;
    Ts.push(T); Zs.push(Z);
    const ex = Z - ritter.fn(T); if (ex > ritterExcess) { ritterExcess = ex; ritterAt = T; }
    if (sim.steps % 5 === 0 || T >= Tend) {
      const met = {}; sim.metrics().forEach(q => { met[q.key] = q.value; });
      if (sim.steps > 1) { maxP2G = Math.max(maxP2G, met.p2g); maxG2P = Math.max(maxG2P, met.g2p); }
      maxCfl = Math.max(maxCfl, met.cfl); maxStencil = Math.max(maxStencil, met.stencil); maxMach = Math.max(maxMach, met.mach);
      clamp = met.clamp;
      massDrift = Math.max(massDrift, Math.abs(met.mass - m0) / m0);
      if (T <= 3) {
        maxDJ = Math.max(maxDJ, met.dJ);
        const J = sim.view('J').value; let s = 0; for (let i = 0; i < J.length; i++) s += Math.abs(J[i] - 1);
        dJsum += s / J.length; dJn++;
      }
      const rel = (met.ke + met.pe + elastic() - E0) / E0;
      if (rel > maxRel) { maxRel = rel; maxRelAt = T; }
    }
    if (sim.steps % 200 === 0 && sim.diverged()) { nan = true; break; }
  }
  const tf = sim.probe('totals'), elf = elastic();
  return {
    params: p, np: (2 * N) * (4 * N), steps: sim.steps, dt_last: sim.dt, wall_s: (Date.now() - t0) / 1000, Ts, Zs,
    nan: nan || sim.diverged(), massDriftRel: massDrift,
    momentum: { maxP2G, maxG2P },
    energy: { E0, elastic0_over_E0: el0 / E0, maxRelGain: maxRel, maxRelGainAtT: maxRelAt, finalRel: (tf.ke + tf.pe + elf - E0) / E0 },
    stability: { maxCfl, maxStencil, clampCount: clamp },
    compress: { maxMach, maxAbsJm1: maxDJ, meanAbsJm1_timeavg: dJsum / Math.max(1, dJn) },
    ritter: { maxExcess: ritterExcess, atT: ritterAt },
    column_height_over_2a_final: sim.probe('column_height') / (2 * a)
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
  // diagnostic only (NOT allowed by the protocol): shift needed to bring the error under tolerance, if any up to 1.0
  let needed = null;
  for (let i = 0; i <= 200; i++) { const dT = 0.005 * i; if (errFor(dT).maxAbs <= 0.25) { needed = dT; break; } }
  return { unshifted: { maxAbs: unshifted.maxAbs, atT: unshifted.atT, pts: unshifted.pts }, best, diag_shift_needed_for_0p25: needed };
}

const fitSlope = (r, T1, T2) => { let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < r.Ts.length; i++) if (r.Ts[i] >= T1 && r.Ts[i] <= T2) { n++; sx += r.Ts[i]; sy += r.Zs[i]; sxx += r.Ts[i] ** 2; sxy += r.Ts[i] * r.Zs[i]; }
  return (n * sxy - sx * sy) / (n * sxx - sx * sx); };
const lethe = refL.rows.filter(r => r[0] > 0 && r[0] <= 3);
const strip = r => { const o = Object.assign({}, r); delete o.Ts; delete o.Zs; return o; };
const summarize = r => Object.assign(strip(r), { lethe: compare(r, lethe),
  Z_at: [0.5, 1, 1.5, 2, 2.5, 3].map(T => [T, +zAt(r, T).toFixed(4)]),
  slope_T1p5_3: +fitSlope(r, 1.5, 3).toFixed(4) });

/* 1. resolution study (default tank 5a x 3a) to T = 3.05 */
const res = {};
[16, 32, 64, 96].forEach(N => { res['N' + N] = summarize(run({ N }, 3.05)); });

/* 2. sensitivity at N = 32 */
const sens = {};
[['cfac20', { N: 32, cfac: 20 }], ['bc1', { N: 32, bc: 1 }], ['cfl0p2', { N: 32, cfl: 0.2 }]].forEach(([key, o]) => {
  const s = summarize(run(o, 3.05)); delete s.lethe.unshifted.pts; delete s.lethe.best.pts; sens[key] = s;
});

/* 3. extended tank (12a x 3a) at N = 32 for the a = 2.25 in digitised series */
const ext = run({ N: 32, Lx: 12 }, 9.4);
const a225 = refA.rows.filter(r => r[1] <= 0.9 * 12);
const extC3 = compare(ext, a225.filter(r => r[0] <= 3)), extC = compare(ext, a225);
const dataSlope = (rows, T1, T2) => fitSlope({ Ts: rows.map(q => q[0]), Zs: rows.map(q => q[1]) }, T1, T2);
let tWall = null; for (let i = 0; i < ext.Ts.length; i++) if (ext.Zs[i] >= 0.9 * 12) { tWall = ext.Ts[i]; break; }
const extended = Object.assign(strip(ext), { a225_T_le_3: extC3, a225_all_info: extC, T_front_reaches_0p9L: tWall,
  lateSlope_sim_5p1_6p85: fitSlope(ext, 5.1, 6.85), lateSlope_data_5p1_6p85: dataSlope(refA.rows, 5.1, 6.85),
  Z_at: [3, 4, 5, 6, 7].map(T => [T, +zAt(ext, T).toFixed(4)]) });

/* summary / passes (primary N = 96) */
const P = res.N96;
const all = [res.N16, res.N32, res.N64, res.N96, ext].concat(Object.values(sens));
const tol = refL.tolerance.value;
const passes = {
  'lethe max|dZ| (best dT) <= 0.25 (N96, primary)': P.lethe.best.maxAbs <= tol,
  'lethe max|dZ| (best dT) <= 0.25 (N64)': res.N64.lethe.best.maxAbs <= tol,
  'lethe max|dZ| (best dT) <= 0.25 (N32)': res.N32.lethe.best.maxAbs <= tol,
  'a225 max|dZ| (best dT) <= 0.25, 0 < T <= 3 (N32, tank 12a)': extC3.best.maxAbs <= refA.tolerance.value,
  'Ritter bound Z <= 1 + 2T (all runs)': all.every(r => r.ritter.maxExcess <= 0),
  'mass conserved': all.every(r => r.massDriftRel < 1e-12),
  'P2G/G2P momentum at round-off (<= 1e-10)': all.every(r => r.momentum.maxP2G <= 1e-10 && r.momentum.maxG2P <= 1e-10),
  'energy not increasing (max gain <= 1e-3 E0)': all.every(r => r.energy.maxRelGain <= 1e-3),
  'stability (no NaN, CFL <= 0.51, |v|dt/dx < 1, no clamps)': all.every(r => !r.nan && r.stability.maxCfl <= 0.51 && r.stability.maxStencil < 1 && r.stability.clampCount === 0),
  'weak compressibility (time-avg mean |J-1| <= 1%), default runs': [res.N16, res.N32, res.N64, res.N96].every(r => r.compress.meanAbsJm1_timeavg <= 0.01)
};
console.log(JSON.stringify({ method: 'mls-mpm', experiment: 'dam-front', resolution: res, sensitivity: sens, extended, passes,
  wall_s: (Date.now() - wall0) / 1000 }, null, 1));
