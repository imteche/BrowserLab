#!/usr/bin/env node
/* Reviewer check: wcsph @ dam-front (dam-break scene, surge-front history Z(T)).
 * Reviewer: reviewer-wcsph-dam-front-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/wcsph@dam-front.check.js [--quick]
 *   --quick runs only the primary resolution (N = 33); --full adds N = 64 (about +6 min).
 *   Default runtime about 5-6 min (N = 24, 33, 48; N = 33 with c0 factor 15; scale run a = 2.25 in).
 * Prints a JSON summary on stdout.
 *
 * Protocol (references/dam-break.js, research/ptc.md):
 *   - Column a = 1 m wide, 2a high, g = 9.81, tank Lx = 5a (method defaults), c0 = 10 sqrt(2 g 2a), alpha = 0.1,
 *     XSPH 0.5, h = 1.3 dx, acoustic CFL 0.125 (PySPH dam_break_2d settings, kernel differs: cubic spline vs Wendland).
 *   - Primary resolution N = 33 particles across a (dx = 0.0303 m, PySPH uses dx = 0.03 m). Resolution study N = 24, 33, 48 (64 with --full).
 *   - Z = front/a, T = t sqrt(2g/a); run to T = 3.0 (reference window 0 < T <= 3).
 *   - Gap: max |Z_sim(T - dT) - Z_ref(T)| over reference rows with 0 < T <= 3, with ONE best-fit time shift dT in [0, 0.25]
 *     (grid step 0.005) fitted on the primary copy (dam-break-mm-front-lethe) and applied unchanged to the a225 cross-copy.
 *     Tolerance 0.25 (both references). dT = 0 and Lethe's dT = 0.175 are reported for information.
 *   - Ritter bound: Z_sim(T) <= 1 + 2T at every step (unshifted).
 *   - Mass: particle count / total mass constant; no fluid particle leaves the tank (x < 0, x > Lx, y < 0).
 *   - Energy: E_mech = KE + PE (fluid); E_el = sum_fluid m e(rho) with Tait internal energy
 *       e(rho) = B[(rho^(g-1) - rho0^(g-1)) / ((g-1) rho0^g) + 1/rho - 1/rho0]  (from de = p/rho^2 drho).
 *     Largest rise of E_mech and of E_mech + E_el above their running minimum must be <= 1e-3 E0 (reviewer criterion;
 *     wall-particle elastic storage is not observable through the public API and is excluded).
 *   - Stability: no NaN / diverged(); Mach = max|v|/c0 <= 0.1 (method's stated criterion c0 >= 10 Umax);
 *     particle-mean |rho/rho0 - 1| <= 0.01 (Becker & Teschner eta = 0.01, as stated by the method: a bulk ~Ma^2 estimate);
 *     the per-particle max is reported (information; it is set by 1-4 particles near the floor impact and does not
 *     scale with 1/c0^2, see the c0-factor-15 run);
 *     acoustic CFL dt(c0+|v|max)/h <= cfl parameter (0.125) + 1%.
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['wcsph'], verification: false });
const M = LAB.methods.wcsph;
const R = LAB.references;
const QUICK = process.argv.includes('--quick');
const wall0 = Date.now();

const refL = R['dam-break-mm-front-lethe'], refA = R['dam-break-mm-front-a225'], refR = R['dam-break-ritter-front-bound'];
const T_END = 3.0, DT_MAX = 0.25, TOL = refL.tolerance.value, TOL_A = refA.tolerance.value;
const GAMMA = 7, RHO0 = 1000;

function interp(Ts, Zs, T) {
  if (T <= Ts[0]) return Zs[0];
  let lo = 0, hi = Ts.length - 1;
  if (T >= Ts[hi]) return Zs[hi];
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (Ts[mid] <= T) lo = mid; else hi = mid; }
  const w = (T - Ts[lo]) / (Ts[hi] - Ts[lo]);
  return Zs[lo] + w * (Zs[hi] - Zs[lo]);
}

function gapAt(series, rows, dT) {
  let mx = 0, worst = null; const per = [];
  rows.forEach(([T, Z]) => {
    if (!(T > 0 && T <= T_END + 1e-9)) return;
    const Ts = T - dT; const zs = Ts <= 0 ? series.Z[0] : interp(series.T, series.Z, Ts);
    const d = zs - Z; per.push([T, Z, +zs.toFixed(4), +d.toFixed(4)]);
    if (Math.abs(d) > mx) { mx = Math.abs(d); worst = T; }
  });
  return { maxAbs: mx, worstT: worst, points: per };
}

function bestShift(series, rows) {
  let best = { dT: 0, maxAbs: Infinity };
  for (let k = 0; k <= Math.round(DT_MAX / 0.005); k++) {
    const dT = k * 0.005, g = gapAt(series, rows, dT).maxAbs;
    if (g < best.maxAbs - 1e-12) best = { dT, maxAbs: g };
  }
  return best;
}

function tait_e(rho, B) {
  return B * ((Math.pow(rho, GAMMA - 1) - Math.pow(RHO0, GAMMA - 1)) / ((GAMMA - 1) * Math.pow(RHO0, GAMMA)) + 1 / rho - 1 / RHO0);
}

function run(N, a, g, extra) {
  a = a || 1; g = g || 9.81;
  const P = H.params('wcsph', 'dam-break', Object.assign({ N, a, g }, extra || {}));
  const sim = M.create('dam-break', P);
  const sT = Math.sqrt(2 * g / a), Lx = P.Lx * a, dx = a / N, h = P.hdx * dx;
  const c0 = P.cfac * Math.sqrt(2 * g * 2 * a), B = c0 * c0 * RHO0 / GAMMA;
  const tot0 = sim.probe('totals'), nf0 = sim.metrics().find(m => m.key === 'nf').value, mass0 = tot0.mass, m = mass0 / nf0;
  let lastMeanDrho = 0, lastMaxDrhoCount = 0;
  function elastic() {   // also records mean |rho/rho0 - 1| and the count of particles above 1 %
    const d = sim.view('density'); let s = 0, md = 0, c = 0;
    for (let q = 0; q < d.n; q++) { s += m * tait_e(RHO0 * d.value[q], B); const e = Math.abs(d.value[q] - 1); md += e; if (e > 0.01) c++; }
    lastMeanDrho = md / d.n; lastMaxDrhoCount = c;
    return s;
  }
  function escaped() {
    const d = sim.view('speed'); let c = 0;
    for (let q = 0; q < d.n; q++) if (d.x[q] < 0 || d.x[q] > Lx || d.y[q] < 0) c++;
    return c;
  }
  const E0m = tot0.ke + tot0.pe, El0 = elastic();
  const series = { T: [0], Z: [sim.probe('front') / a] };
  let ritterViol = 0, ritterWorst = null, ritterMinMargin = Infinity;
  let maxMach = 0, maxDrho = 0, maxMeanDrho = 0, maxCount1pc = 0, machOverT = null, maxCfl = 0, nan = false, diverged = false, maxEsc = 0, massDrift = 0, nfDrift = 0;
  let runMinM = E0m, runMinT = E0m + El0, riseM = 0, riseT = 0, riseMT = null, riseTT = null;
  const energy = [];
  let nextE = 0;
  while (sim.t * sT < T_END - 1e-12) {
    sim.step();
    const T = sim.t * sT, fr = sim.probe('front');
    if (fr == null || !isFinite(fr)) { nan = true; break; }
    const Z = fr / a; series.T.push(T); series.Z.push(Z);
    const zb = refR.fn(T);
    if (zb - Z < ritterMinMargin) { ritterMinMargin = zb - Z; ritterWorst = T; }
    if (Z > zb) ritterViol++;
    if (sim.steps % 20 === 0 || T >= T_END - 1e-12) {
      const mt = {}; sim.metrics().forEach(x => { mt[x.key] = x.value; });
      if (mt.mach > 0.1 && machOverT === null) machOverT = T;
      maxMach = Math.max(maxMach, mt.mach); maxDrho = Math.max(maxDrho, mt.drho); maxCfl = Math.max(maxCfl, mt.cfl);
      massDrift = Math.max(massDrift, Math.abs(mt.mass - mass0) / mass0); nfDrift = Math.max(nfDrift, Math.abs(mt.nf - nf0));
      if (sim.diverged()) { diverged = true; break; }
      const tt = sim.probe('totals'), Em = tt.ke + tt.pe, El = elastic(), Et = Em + El;
      maxMeanDrho = Math.max(maxMeanDrho, lastMeanDrho); maxCount1pc = Math.max(maxCount1pc, lastMaxDrhoCount);
      if (!isFinite(Em)) { nan = true; break; }
      if (Em - runMinM > riseM) { riseM = Em - runMinM; riseMT = T; }
      if (Et - runMinT > riseT) { riseT = Et - runMinT; riseTT = T; }
      runMinM = Math.min(runMinM, Em); runMinT = Math.min(runMinT, Et);
      maxEsc = Math.max(maxEsc, escaped());
      if (T >= nextE) { energy.push({ T: +T.toFixed(3), ke: +tt.ke.toFixed(2), pe: +tt.pe.toFixed(2), el: +El.toFixed(3), mechRel: +(Em / E0m).toFixed(6) }); nextE += 0.5; }
    }
  }
  const tt = sim.probe('totals'), Ef = tt.ke + tt.pe, Elf = elastic();
  const zAt = T => +interp(series.T, series.Z, T).toFixed(4);
  const bL = bestShift(series, refL.rows), bA = bestShift(series, refA.rows);
  const gL = gapAt(series, refL.rows, bL.dT), gA = gapAt(series, refA.rows, bL.dT);
  return {
    N, a, g, cfac: P.cfac, dx, h, c0, nf: nf0, steps: sim.steps, T_end: +(sim.t * sT).toFixed(4), wall_s: 0,
    Z_at: { 'T=0.5': zAt(0.5), 'T=1': zAt(1), 'T=1.5': zAt(1.5), 'T=2': zAt(2), 'T=2.5': zAt(2.5), 'T=3': zAt(3) },
    lethe: { bestShift: bL.dT, maxAbs_best: +gL.maxAbs.toFixed(4), worstT_best: gL.worstT,
      maxAbs_dT0: +gapAt(series, refL.rows, 0).maxAbs.toFixed(4), maxAbs_dT0175: +gapAt(series, refL.rows, 0.175).maxAbs.toFixed(4),
      points_best: gL.points },
    a225: { shiftUsed: bL.dT, maxAbs: +gA.maxAbs.toFixed(4), worstT: gA.worstT, ownBestShift: bA.dT, maxAbs_ownBest: +bA.maxAbs.toFixed(4),
      maxAbs_dT0: +gapAt(series, refA.rows, 0).maxAbs.toFixed(4), points: gA.points },
    ritter: { violations: ritterViol, minMargin: +ritterMinMargin.toFixed(4), atT: ritterWorst && +ritterWorst.toFixed(3) },
    mass: { relDrift: massDrift, particleCountDrift: nfDrift, maxEscaped: maxEsc },
    energy: { E0_mech: +E0m.toFixed(3), El0: +El0.toFixed(3), Ef_mech: +Ef.toFixed(3), Elf: +Elf.toFixed(3),
      mechLossRel: +((E0m - Ef) / E0m).toFixed(5), maxRiseMechRel: riseM / E0m, maxRiseMechAtT: riseMT,
      maxRiseTotalRel: riseT / E0m, maxRiseTotalAtT: riseTT, samples: energy },
    stability: { nan, diverged, maxMach: +maxMach.toFixed(4), maxDrho: +maxDrho.toFixed(5), maxMeanDrho: +maxMeanDrho.toFixed(5), maxParticlesAbove1pc: maxCount1pc,
      firstTMachAbove01: machOverT && +machOverT.toFixed(3), maxCfl: +maxCfl.toFixed(4), cflParam: P.cfl }
  };
}

const FULL = process.argv.includes('--full');
const Ns = QUICK ? [33] : FULL ? [24, 33, 48, 64] : [24, 33, 48];
const runs = Ns.map(N => { const t0 = Date.now(); const r = run(N); r.wall_s = (Date.now() - t0) / 1000; return r; });
// Sound-speed sensitivity: N = 33 with c0 = 15 sqrt(2 g 2a) (satisfies Ma <= 0.1 a posteriori if Umax <= 1.5 sqrt(2gH)).
let cfacRun = null;
if (!QUICK) { const t0 = Date.now(); cfacRun = run(33, 1, 9.81, { cfac: 15 }); cfacRun.wall_s = (Date.now() - t0) / 1000; }
const prim = runs.find(r => r.N === 33);
// scale-invariance info run: a = 2.25 in = 0.05715 m (Martin & Moyce column), N = 24
let scaleInfo = null;
if (!QUICK) { const r = run(24, 0.05715, 9.81); const b = runs.find(x => x.N === 24);
  scaleInfo = { a: 0.05715, N: 24, Z_at: r.Z_at, lethe_maxAbs_best: r.lethe.maxAbs_best, bestShift: r.lethe.bestShift,
    maxDiffZ_vs_a1: Math.max(...Object.keys(r.Z_at).map(k => Math.abs(r.Z_at[k] - b.Z_at[k]))) }; }

function passes(r) {
  return {
    lethe: r.lethe.maxAbs_best <= TOL, a225: r.a225.maxAbs <= TOL_A, shiftInRange: r.lethe.bestShift <= DT_MAX,
    ritter: r.ritter.violations === 0,
    mass: r.mass.relDrift < 1e-12 && r.mass.particleCountDrift === 0 && r.mass.maxEscaped === 0,
    // KE+PE may rise only by released EOS storage: the criterion is on KE+PE+E_el (fluid); the KE+PE rise is
    // reported and compared with the initial stored elastic energy El0 (information).
    energy: r.energy.maxRiseTotalRel <= 1e-3 && r.energy.mechLossRel >= 0,
    stability: !r.stability.nan && !r.stability.diverged && r.stability.maxMach <= 0.1 && r.stability.maxMeanDrho <= 0.01 &&
      r.stability.maxCfl <= r.stability.cflParam * 1.01
  };
}
runs.forEach(r => { r.passes = passes(r); });
if (cfacRun) { cfacRun.passes = passes(cfacRun); cfacRun.dZ_vs_cfac10 = Object.fromEntries(Object.keys(cfacRun.Z_at).map(k => [k, +(cfacRun.Z_at[k] - prim.Z_at[k]).toFixed(4)]));
  delete cfacRun.lethe.points_best; delete cfacRun.a225.points; delete cfacRun.energy.samples; }
const summary = {
  method: 'wcsph', experiment: 'dam-front', primaryN: 33, tolerance: { lethe: TOL, a225: TOL_A, dTmax: DT_MAX },
  primary: prim, resolution: runs.filter(r => r !== prim).map(r => ({ N: r.N, nf: r.nf, steps: r.steps, wall_s: r.wall_s, Z_at: r.Z_at,
    lethe: { bestShift: r.lethe.bestShift, maxAbs_best: r.lethe.maxAbs_best, maxAbs_dT0: r.lethe.maxAbs_dT0, maxAbs_dT0175: r.lethe.maxAbs_dT0175 },
    a225: { maxAbs: r.a225.maxAbs, ownBestShift: r.a225.ownBestShift }, ritter: r.ritter, mass: r.mass,
    energy: { mechLossRel: r.energy.mechLossRel, maxRiseMechRel: r.energy.maxRiseMechRel, maxRiseTotalRel: r.energy.maxRiseTotalRel },
    stability: r.stability, passes: r.passes })),
  cfac15: cfacRun,
  scaleInfo,
  allPass: runs.every(r => Object.values(r.passes).every(Boolean)),
  wall_s: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(summary, null, 1));
