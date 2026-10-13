#!/usr/bin/env node
/* Reviewer check: explicit-euler @ kepler-e06 (e = 0.6).
 * Reviewer: reviewer-explicit-euler-kepler-e06-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/explicit-euler@kepler-e06.check.js
 * Prints a JSON summary on stdout.
 *
 * Metrics follow references/kepler.js:
 *   dH  = max_{0<=n<=N} |H(y_n) - H0|               (max energy error over the run)
 *   err = |y_N - y_exact(t_N)|, Euclidean over (q1,q2,p1,p2), t_N = N h, N = round(t_end/h)
 *   p_obs = log2(m(h)/m(h/2)) at fixed t_end;  k = log(m(t2)/m(t1))/log(t2/t1) at fixed h
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['explicit-euler'], verification: false });
const M = LAB.methods['explicit-euler'];
const R = LAB.references;
const exact = R['kepler-exact-solution'].fn;
const E = 0.6, T = 2 * Math.PI, H0 = -0.5, L0 = Math.sqrt(1 - E * E);
const wall0 = Date.now();

function mk(h) { return M.create('kepler', H.params('explicit-euler', 'kepler', { e: E, h: h })); }

function globalErr(sim) {
  const s = sim.probe('state'), x = exact(sim.t, { e: E });
  return Math.hypot(s.q[0] - x.q[0], s.q[1] - x.q[1], s.p[0] - x.p[0], s.p[1] - x.p[1]);
}

/* Run N steps at h, tracking max |H-H0|, signed H-H0, max |L-L0|; sample at requested step indices. */
function run(h, N, marks) {
  const sim = mk(h);
  let dH = 0, dL = 0, nan = false, minSigned = 0;
  const errAt = {}, dHat = {}, Hat = {}, Lat = {};
  const markSet = new Map();
  (marks || []).forEach(m => { if (!markSet.has(m.n)) markSet.set(m.n, []); markSet.get(m.n).push(m.key); });
  for (let n = 1; n <= N; n++) {
    sim.step();
    const inv = sim.probe('invariants');
    if (!isFinite(inv.H) || !isFinite(inv.L)) { nan = true; break; }
    const d = inv.H - H0;
    if (d < minSigned) minSigned = d;
    dH = Math.max(dH, Math.abs(d));
    dL = Math.max(dL, Math.abs(inv.L - L0));
    if (markSet.has(n)) {
      const g = globalErr(sim);
      markSet.get(n).forEach(k => { errAt[k] = g; dHat[k] = dH; Hat[k] = d; Lat[k] = inv.L - L0; });
    }
  }
  return { sim, dH, dL, nan, minSigned, diverged: sim.diverged(), errAt, dHat, Hat, Lat };
}

const log2 = x => Math.log(x) / Math.LN2;
const within = (v, ref) => Math.abs(v - ref.value) <= ref.tolerance.value;
function lsq(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
  return { slope: sxy / sxx, intercept: my - (sxy / sxx) * mx, r2: (sxy * sxy) / (sxx * syy) };
}

/* ---- check 0: initial invariants vs kepler-H0 / kepler-L0 */
const s0 = mk(1e-4).probe('invariants');
const init = { H0_err: Math.abs(s0.H - R['kepler-H0'].value), L0_err: Math.abs(s0.L - R['kepler-L0'].fn(E)) };
init.pass = init.H0_err <= R['kepler-H0'].tolerance.value && init.L0_err <= R['kepler-L0'].tolerance.value;

/* ---- check b: observed order at t_end = T, h = 1e-4, 5e-5 (published pair), plus 2.5e-5 (info) */
const refOE = R['kepler-order-energy-explicit-euler'], refOG = R['kepler-order-global-explicit-euler'];
const tEnd = refOE.protocol.t_end;
const hs = [refOE.protocol.h, refOE.protocol.h / 2, refOE.protocol.h / 4];
const ord = hs.map(h => {
  const N = Math.round(tEnd / h);
  const r = run(h, N, [{ n: N, key: 'end' }]);
  return { h, N, t_N: r.sim.t, dH: r.dH, H_end_minus_H0: r.Hat.end, err: r.errAt.end, dL: r.dL, nan: r.nan };
});
const order = {
  energy: { p_h_h2: log2(ord[0].dH / ord[1].dH), p_h2_h4: log2(ord[1].dH / ord[2].dH) },
  global: { p_h_h2: log2(ord[0].err / ord[1].err), p_h2_h4: log2(ord[1].err / ord[2].err) },
  runs: ord
};
order.energy.pass = within(order.energy.p_h_h2, refOE);
order.global.pass = within(order.global.p_h_h2, refOG);
order.energy.pass_h2_h4 = within(order.energy.p_h2_h4, refOE);
order.global.pass_h2_h4 = within(order.global.p_h2_h4, refOG);

/* ---- check c: growth exponents, h = 1e-6, t1 = T, t2 = 4T (whole periods), plus 2T, 3T samples */
const refGG = R['kepler-growth-global-explicit-euler'], refGE = R['kepler-growth-energy-explicit-euler'];
const gp = refGG.protocol, hG = gp.h;
const pts = [1, 2, 3, 4].map(k => ({ n: Math.round(k * T / hG), key: 'P' + k }));
const gr = run(hG, pts[3].n, pts);
const growth = {
  h: hG, steps: pts[3].n, nan: gr.nan,
  global: { k: Math.log(gr.errAt.P4 / gr.errAt.P1) / Math.log(gp.t2 / gp.t1), err_t1: gr.errAt.P1, err_t2: gr.errAt.P4 },
  energy: { k: Math.log(gr.dHat.P4 / gr.dHat.P1) / Math.log(refGE.protocol.t2 / refGE.protocol.t1), dH_t1: gr.dHat.P1, dH_t2: gr.dHat.P4 },
  series: [1, 2, 3, 4].map(k => ({ periods: k, err: gr.errAt['P' + k], dHmax: gr.dHat['P' + k], H_minus_H0: gr.Hat['P' + k], L_minus_L0: gr.Lat['P' + k] }))
};
growth.global.k_fit_1_4T = lsq(growth.series.map(s => Math.log(s.periods)), growth.series.map(s => Math.log(s.err))).slope;
growth.energy.k_fit_1_4T = lsq(growth.series.map(s => Math.log(s.periods)), growth.series.map(s => Math.log(s.dHmax))).slope;
growth.global.pass = within(growth.global.k, refGG);
growth.energy.pass = within(growth.energy.k, refGE);

/* ---- check a: secular (linear) energy drift over many periods at h = 1e-4 (20 periods):
 * H sampled at whole periods; must be monotonically increasing (sign: H - H0 > 0) and linear in t
 * (LSQ r^2 of H(nT)-H0 vs n, plus per-period increments roughly constant). Also the coarse h = 1e-3 run for 20 periods. */
function drift(h, periods) {
  const pp = []; for (let k = 1; k <= periods; k++) pp.push({ n: Math.round(k * T / h), key: 'P' + k });
  const r = run(h, pp[pp.length - 1].n, pp);
  const ns = pp.map((_, i) => i + 1), dHs = pp.map(p => r.Hat[p.key]);
  const fit = lsq(ns, dHs);
  const inc = dHs.map((v, i) => i === 0 ? v : v - dHs[i - 1]);
  const monotone = dHs.every((v, i) => v > 0 && (i === 0 || v > dHs[i - 1]));
  return { h, periods, nan: r.nan, diverged: r.diverged, H_minus_H0_at_periods: dHs, slope_per_period: fit.slope, r2: fit.r2,
    increment_first: inc[0], increment_last: inc[inc.length - 1], increment_ratio_last_first: inc[inc.length - 1] / inc[0],
    monotone_increasing: monotone, slope_over_h: fit.slope / h, minSigned: r.minSigned, maxDL: r.dL,
    final_radius: Math.hypot(r.sim.probe('state').q[0], r.sim.probe('state').q[1]) };
}
const drift4 = drift(1e-4, 20);
const drift5 = drift(5e-5, 20);
const drift3 = drift(1e-3, 20);   // info only: leaves the small-drift regime (see below)
// linear in t AND linear in h: slope/h should agree between h = 1e-4 and 5e-5 (O(h t) drift)
const energySecular = { h1e4: drift4, h5e5: drift5, h1e3_info: drift3, slope_over_h_ratio: drift4.slope_over_h / drift5.slope_over_h };
// Reviewer criterion (documented): H(nT)-H0 > 0 and monotone increasing at whole periods for h = 1e-4 and 5e-5,
// LSQ r^2 >= 0.99 for H(nT)-H0 vs n, and fitted drift rate scales like h (slope/h ratio within 1 +- 0.3, the
// reference order tolerance). Only h with total drift << |H0| over the window are used (8% at h = 1e-4), because
// once H - H0 = O(|H0|) the period itself changes and whole-period sampling is no longer phase-locked;
// h = 1e-3 (drift 0.2 = 40% of |H0| by 20T) is reported as information only.
energySecular.pass = [drift4, drift5].every(d => d.monotone_increasing && d.r2 >= 0.99 && !d.nan) &&
  Math.abs(energySecular.slope_over_h_ratio - 1) <= 0.3;

/* ---- check d: angular momentum — NOT conserved (kepler-L-conservation row false). Verify that
 * per-step change equals h^2 p_n x F(q_n) (identity of the discrete map) and that |L - L0| is O(h). */
const refL = R['kepler-L-conservation'];
const Lrow = refL.rows.find(r => r[0] === 'explicit-euler');
function Lidentity(h, N) {
  const sim = mk(h); let maxRes = 0, maxStep = 0;
  for (let n = 0; n < N; n++) {
    const s = sim.probe('state'); const L = s.q[0] * s.p[1] - s.q[1] * s.p[0];
    const r3 = Math.pow(s.q[0] ** 2 + s.q[1] ** 2, 1.5), F = [-s.q[0] / r3, -s.q[1] / r3];
    const pred = h * h * (s.p[0] * F[1] - s.p[1] * F[0]);
    sim.step();
    const s2 = sim.probe('state'); const L2 = s2.q[0] * s2.p[1] - s2.q[1] * s2.p[0];
    maxRes = Math.max(maxRes, Math.abs((L2 - L) - pred)); maxStep = Math.max(maxStep, Math.abs(L2 - L));
  }
  return { h, N, max_residual: maxRes, max_step_change: maxStep };
}
const Lid = Lidentity(1e-3, Math.round(T / 1e-3));
const angmom = {
  expected_conserved: Lrow[1], identity: Lid,
  maxDL_order_runs: ord.map(o => o.dL), maxDL_ratio_h_h2: ord[0].dL / ord[1].dL,
  maxDL_growth_4T_h1e6: gr.dL
};
// pass = behaves as the reference table states (not conserved) AND the change matches the discrete identity to round-off
angmom.pass = !Lrow[1] && ord[0].dL > refL.tolerance.value && Lid.max_residual < 1e-12;

/* ---- check e: stability / qualitative Hairer figure protocol (h = 0.0005, t = 200; inferred h) */
const figN = Math.round(200 / 0.0005);
const fig = run(0.0005, figN, [{ n: figN, key: 'end' }]);
const sFig = fig.sim.probe('state');
const figure = { h: 0.0005, steps: figN, t: fig.sim.t, nan: fig.nan, diverged: fig.diverged,
  H_end_minus_H0: fig.Hat.end, relDH_end: fig.Hat.end / 0.5, minSigned: fig.minSigned,
  final_radius: Math.hypot(sFig.q[0], sFig.q[1]), spirals_outward: fig.Hat.end > 0 && fig.minSigned >= -1e-12 };
const large = [0.01, 0.05].map(h => {
  const N = Math.round(10 * T / h); const r = run(h, N, [{ n: N, key: 'end' }]);
  const s = r.sim.probe('state');
  return { h, periods: 10, nan: r.nan, diverged: r.diverged, H_end_minus_H0: r.Hat.end, radius_end: Math.hypot(s.q[0], s.q[1]) };
});

const allNaN = ord.some(o => o.nan) || gr.nan || drift4.nan || drift5.nan || drift3.nan || fig.nan;
const summary = {
  method: 'explicit-euler', experiment: 'kepler-e06', e: E,
  initial: init, order, growth, energySecular, angmom, figureProtocol: figure, largeH_info: large,
  passes: {
    initial: init.pass,
    'order-energy': order.energy.pass, 'order-global': order.global.pass,
    'growth-global': growth.global.pass, 'growth-energy': growth.energy.pass,
    'energy-secular-linear': energySecular.pass, 'L-nonconservation-as-expected': angmom.pass,
    'figure-qualitative-spiral-out': figure.spirals_outward,
    stability: !allNaN && !fig.diverged
  },
  wall_s: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(summary, null, 1));
