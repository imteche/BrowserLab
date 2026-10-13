#!/usr/bin/env node
/* Reviewer check: hll-swe @ swe-dry (Ritter dry-bed dam break, SWASHES 4.1.2, t = 6 s).
 * Reviewer: reviewer-hll-swe-swe-dry-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node "verification/checks/hll-swe@swe-dry.check.js"   (prints a JSON summary on stdout)
 *
 * Protocol (experiment swe-dry in js/scenes.js: hl = 0.005, hr = 0, x0 = 5, L = 10; reference swe-dambreak-ritter t = 6):
 *   method defaults otherwise (g = 9.81, CFL = 0.9, hDry = 1e-12), N = 100 .. 6400, run to t = 6 exactly.
 * Metrics:
 *   relL1(h) = sum|h_i - h_ex(x_i)| dx / sum h_ex(x_i) dx (x_i cell centres)  -> tolerance from swe-dambreak-ritter
 *   L1(u) over cells wet in the exact solution (info; no reference tolerance)
 *   front: right face of the last cell with h > thr; thr = 1e-6 hl (reference suggestion), also 1e-3, 1e-2 hl (info).
 *          compared with the exact front x_B = x0 + 2 t sqrt(g hl) and with the exact position where h_ex = thr.
 *   head (rarefaction head, x_A = x0 - t sqrt(g hl)): first cell from the left with h < hl (1 - 1e-6)  (info)
 *   totals vs swe-dambreak-totals: mass = x0 hl, momentum = g/2 hl^2 t (rel 1e-12), energy monotone non-increasing (info)
 *   positivity: min h >= 0 every step, negative-depth clips = 0; CFL realised <= 0.9; no NaN.
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['hll-swe'], verification: false });
const M = LAB.methods['hll-swe'];
const R = LAB.references;
const REF = R['swe-dambreak-ritter'], TOT = R['swe-dambreak-totals'];
const exact = REF.fn;
const EXP = LAB.scenes['swe-dambreak'].experiments.find(e => e.id === 'swe-dry');
const SP = Object.assign({}, EXP.params);           // hl 0.005, hr 0, x0 5, L 10
const g = 9.81, T = REF.params.t, hl = SP.hl, x0 = SP.x0, Ldom = SP.L;
const sl = Math.sqrt(g * hl), xB = exact.front(T, SP), xA = exact.head(T, SP);
const wall0 = Date.now();

function metric(sim, key) { return sim.metrics().find(m => m.key === key).value; }

function run(N, extra) {
  const p = H.params('hll-swe', 'swe-dambreak', Object.assign({}, SP, { N, tEnd: T }, extra || {}));
  const sim = M.create('swe-dambreak', p);
  const dx = Ldom / N;
  let hminAll = Infinity, nan = false, cflMax = 0, Eprev = metric(sim, 'energy'), Einc = 0, n = 0;
  const E0 = Eprev, mass0 = sim.probe('totals').mass;
  while (sim.t < T - 1e-13 && n < 5e6) {
    sim.step(); n++;
    const pr = sim.probe('profile');
    for (let i = 0; i < N; i++) { const h = pr.h[i]; if (!isFinite(h) || !isFinite(pr.u[i])) nan = true; if (h < hminAll) hminAll = h; }
    const cfl = metric(sim, 'cfl'); if (sim.t < T - 1e-13 && cfl > cflMax) cflMax = cfl;  // last (clipped) step excluded
    const E = metric(sim, 'energy'); if (E > Eprev * (1 + 1e-13)) Einc++; Eprev = E;
    if (nan) break;
  }
  const pr = sim.probe('profile'), tot = sim.probe('totals');
  let e1 = 0, den = 0, eu = 0, uwet = 0;
  for (let i = 0; i < N; i++) {
    const ex = exact(pr.x[i], sim.t, SP);
    e1 += Math.abs(pr.h[i] - ex.h) * dx; den += ex.h * dx;
    if (ex.h > 0) { eu += Math.abs(pr.u[i] - ex.u) * dx; uwet += dx; }
  }
  function front(thr) { let k = -1; for (let i = 0; i < N; i++) if (pr.h[i] > thr) k = i; return (k + 1) * dx; }
  function exactAt(thr) { return x0 + 2 * T * (sl - Math.sqrt(9 * g * thr / 4)); }
  const fronts = {};
  [1e-6, 1e-3, 1e-2].forEach(f => {
    const thr = f * hl, xf = front(thr);
    fronts[f] = { x: xf, minus_xB: xf - xB, minus_xB_cells: (xf - xB) / dx, x_exact_thr: exactAt(thr), minus_exact_thr: xf - exactAt(thr) };
  });
  let ih = 0; while (ih < N && pr.h[ih] >= hl * (1 - 1e-6)) ih++;
  const head = ih * dx;
  const ref = TOT.fn(0, sim.t, SP);
  return {
    N, dx, t: sim.t, steps: sim.steps, nan, diverged: sim.diverged(),
    relL1h: e1 / den, L1u: eu,     hminAll, clips: metric(sim, 'clips'), cflMax,
    mass: tot.mass, massRel: Math.abs(tot.mass - ref.mass) / ref.mass, mass0Rel: Math.abs(mass0 - ref.mass) / ref.mass,
    momentum: tot.momentum, momRel: Math.abs(tot.momentum - ref.momentum) / ref.momentum,
    energyRel: Eprev / E0 - 1, energyIncreases: Einc,
    hRightBoundary: pr.h[N - 1], hLeftBoundary: pr.h[0],
    fronts, head, headErr: head - xA, wet: metric(sim, 'wet')
  };
}

const Ns = [100, 200, 400, 800, 1600, 3200, 6400];
const runs = Ns.map(N => run(N));
const byN = {}; runs.forEach(r => { byN[r.N] = r; });
const orders = [];
for (let k = 1; k < runs.length; k++) orders.push({ from: runs[k - 1].N, to: runs[k].N,
  relL1h: Math.log2(runs[k - 1].relL1h / runs[k].relL1h),
  L1u: Math.log2(runs[k - 1].L1u / runs[k].L1u),
  front1e6: Math.log2(Math.abs(runs[k - 1].fronts[1e-6].minus_xB) / Math.abs(runs[k].fronts[1e-6].minus_xB)) });

/* sensitivity (info): CFL 1.0, CFL 0.5, hDry = 0 and hDry = 1e-8, N = 400 */
const sens = {
  cfl1: run(400, { CFL: 1.0 }), cfl05: run(400, { CFL: 0.5 }),
  hdry0: run(400, { hDry: 0 }), hdry1e8: run(400, { hDry: 1e-8 })
};
function brief(r) { return { relL1h: r.relL1h, hmin: r.hminAll, clips: r.clips, nan: r.nan, massRel: r.massRel, front1e6_minus_xB: r.fronts[1e-6].minus_xB, cflMax: r.cflMax }; }

/* Independent reviewer re-implementation (info): first-order HLLE (Einfeldt/Roe speeds, dry-front speed u +- 2c),
 * written from riemannbook2020/clawpack shallow_hll_1D formulas, NO dry threshold (h <= 0 is dry), same CFL/landing.
 * Used to tell implementation defects from inherent first-order behaviour (front lag, L1). */
function indep(N, C) {
  const dx = Ldom / N, h = new Float64Array(N + 2), q = new Float64Array(N + 2);
  for (let i = 1; i <= N; i++) { const xc = (i - 0.5) * dx; h[i] = xc < x0 ? hl : 0; }
  const Fh = new Float64Array(N + 1), Fq = new Float64Array(N + 1);
  let t = 0, steps = 0;
  while (t < T - 1e-13) {
    h[0] = h[1]; q[0] = q[1]; h[N + 1] = h[N]; q[N + 1] = q[N];
    let smax = 0;
    for (let f = 0; f <= N; f++) {
      const hL = h[f], hR = h[f + 1], qL = q[f], qR = q[f + 1];
      const uL = hL > 0 ? qL / hL : 0, uR = hR > 0 ? qR / hR : 0, cL = Math.sqrt(g * hL), cR = Math.sqrt(g * hR);
      let s1, s2;
      if (hL <= 0 && hR <= 0) { Fh[f] = 0; Fq[f] = 0; continue; }
      if (hL <= 0) { s1 = uR - 2 * cR; s2 = uR + cR; }
      else if (hR <= 0) { s1 = uL - cL; s2 = uL + 2 * cL; }
      else {
        const ub = (Math.sqrt(hL) * uL + Math.sqrt(hR) * uR) / (Math.sqrt(hL) + Math.sqrt(hR)), cb = Math.sqrt(g * (hL + hR) / 2);
        s1 = Math.min(uL - cL, ub - cb); s2 = Math.max(uR + cR, ub + cb);
      }
      smax = Math.max(smax, Math.abs(s1), Math.abs(s2));
      const fhL = qL, fqL = qL * uL + 0.5 * g * hL * hL, fhR = qR, fqR = qR * uR + 0.5 * g * hR * hR;
      if (s1 >= 0) { Fh[f] = fhL; Fq[f] = fqL; }
      else if (s2 <= 0) { Fh[f] = fhR; Fq[f] = fqR; }
      else { Fh[f] = (s2 * fhL - s1 * fhR + s1 * s2 * (hR - hL)) / (s2 - s1); Fq[f] = (s2 * fqL - s1 * fqR + s1 * s2 * (qR - qL)) / (s2 - s1); }
    }
    let dt = C * dx / smax; if (t + dt > T) dt = T - t;
    for (let i = 1; i <= N; i++) { h[i] += dt / dx * (Fh[i - 1] - Fh[i]); q[i] += dt / dx * (Fq[i - 1] - Fq[i]); if (h[i] <= 0) { h[i] = Math.max(h[i], 0); } }
    t += dt; steps++;
  }
  let e1 = 0, den = 0, k = -1, m = 0, mo = 0;
  for (let i = 1; i <= N; i++) { const ex = exact((i - 0.5) * dx, T, SP); e1 += Math.abs(h[i] - ex.h) * dx; den += ex.h * dx; if (h[i] > 1e-6 * hl) k = i; m += h[i] * dx; mo += q[i] * dx; }
  return { N, steps, relL1h: e1 / den, front1e6_minus_xB: k * dx - xB, massRel: Math.abs(m - x0 * hl) / (x0 * hl), momRel: Math.abs(mo - 0.5 * g * hl * hl * T) / (0.5 * g * hl * hl * T) };
}
const independent = [200, 400, 1600].map(N => indep(N, 0.9));
const indepCompare = independent.map(r => ({ N: r.N, indep_relL1h: r.relL1h, method_relL1h: byN[r.N].relL1h, indep_front: r.front1e6_minus_xB, method_front: byN[r.N].fronts[1e-6].minus_xB, indep_steps: r.steps, method_steps: byN[r.N].steps, indep_momRel: r.momRel, indep_massRel: r.massRel }));

/* momentum loss vs dry threshold (info): the method zeroes hu where h <= hDry, a non-conservative momentum sink */
const momVsHdry = [0, 1e-15, 1e-12, 1e-10, 1e-8].map(hd => { const r = run(200, { hDry: hd }); return { hDry: hd, momRel: r.momRel, massRel: r.massRel, relL1h: r.relL1h }; });

const tol = REF.tolerance.value;
const FRONT_CELLS = 5;   // reviewer reading of the reference's "band of several cells"
const gaps = [
  { quantity: 'relL1(h) N=200', value: byN[200].relL1h, tolerance: tol['first-order N=200'] },
  { quantity: 'relL1(h) N=400', value: byN[400].relL1h, tolerance: tol['first-order N=400'] },
  { quantity: '|front(h>1e-6 hl) - x_B| N=200', value: Math.abs(byN[200].fronts[1e-6].minus_xB), tolerance: FRONT_CELLS * byN[200].dx },
  { quantity: '|front(h>1e-6 hl) - x_B| N=400', value: Math.abs(byN[400].fronts[1e-6].minus_xB), tolerance: FRONT_CELLS * byN[400].dx },
  { quantity: 'mass rel drift, max over N', value: Math.max(...runs.map(r => r.massRel)), tolerance: TOT.tolerance.value },
  { quantity: 'momentum vs g/2 hl^2 t, max rel over N', value: Math.max(...runs.map(r => r.momRel)), tolerance: TOT.tolerance.value },
  { quantity: 'min h over all steps and N', value: Math.min(...runs.map(r => r.hminAll)), tolerance: 0 }
].map(gp => Object.assign(gp, { pass: gp.quantity.startsWith('min h') ? gp.value >= 0 : gp.value <= gp.tolerance }));

const out = {
  experiment: 'swe-dry', method: 'hll-swe', params: SP, t: T, xB, xA, sqrt_g_hl: sl,
  reference_tolerance: tol, front_tolerance_cells: FRONT_CELLS,
  runs, orders, sensitivity: { cfl1: brief(sens.cfl1), cfl05: brief(sens.cfl05), hdry0: brief(sens.hdry0), hdry1e8: brief(sens.hdry1e8) },
  stability: { anyNaN: runs.some(r => r.nan), anyDiverged: runs.some(r => r.diverged), maxCFL: Math.max(...runs.map(r => r.cflMax)), clips: runs.map(r => r.clips) },
  independent: indepCompare, momentumVsHdry: momVsHdry,
  gaps, allPass: gaps.every(gp => gp.pass), wall_s: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(out, null, 1));
