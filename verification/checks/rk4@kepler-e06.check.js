#!/usr/bin/env node
/* Reviewer check: rk4 @ kepler-e06 (e = 0.6).
 * Reviewer: reviewer-rk4-kepler-e06-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/rk4@kepler-e06.check.js
 * Prints a JSON summary on stdout.
 *
 * Metrics follow references/kepler.js:
 *   dH  = max_{0<=n<=N} |H(y_n) - H0|               (max energy error over the run)
 *   err = |y_N - y_exact(t_N)|, Euclidean over (q1,q2,p1,p2), t_N = N h, N = round(t_end/h)
 *   p_obs = log2(m(h)/m(h/2)) at fixed t_end;  k = log(m(t2)/m(t1))/log(t2/t1) at fixed h
 * Published protocols (references/kepler.js, research/ode.md):
 *   kepler-order-{energy,global}-rk4 : t_end = 10.5T, h = 1.25e-3 -> 6.25e-4
 *   kepler-growth-{global,energy}-rk4: h = 1e-2, t1 = 40T, t2 = 160T
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['rk4'], verification: false });
const M = LAB.methods['rk4'];
const R = LAB.references;
const exact = R['kepler-exact-solution'].fn;
const E = 0.6, T = 2 * Math.PI, H0 = -0.5, L0 = Math.sqrt(1 - E * E);
const wall0 = Date.now();

function mk(h) { return M.create('kepler', H.params('rk4', 'kepler', { e: E, h: h })); }

function globalErr(sim) {
  const s = sim.probe('state'), x = exact(sim.t, { e: E });
  return Math.hypot(s.q[0] - x.q[0], s.q[1] - x.q[1], s.p[0] - x.p[0], s.p[1] - x.p[1]);
}

/* Run N steps at h, tracking max |H-H0|, max |L-L0|; record err and running dH at requested step indices. */
function run(h, N, marks) {
  const sim = mk(h);
  let dH = 0, dL = 0, nan = false;
  const errAt = {}, dHat = {}, dLat = {};
  const markSet = new Map();
  (marks || []).forEach(m => { if (!markSet.has(m.n)) markSet.set(m.n, []); markSet.get(m.n).push(m.key); });
  for (let n = 1; n <= N; n++) {
    sim.step();
    const inv = sim.probe('invariants');
    if (!isFinite(inv.H) || !isFinite(inv.L)) { nan = true; break; }
    dH = Math.max(dH, Math.abs(inv.H - H0));
    dL = Math.max(dL, Math.abs(inv.L - L0));
    if (markSet.has(n)) { const g = globalErr(sim); markSet.get(n).forEach(k => { errAt[k] = g; dHat[k] = dH; dLat[k] = dL; }); }
  }
  return { sim, dH, dL, nan, diverged: sim.diverged(), errAt, dHat, dLat };
}

const log2 = x => Math.log(x) / Math.LN2;
const within = (v, ref) => Math.abs(v - ref.value) <= ref.tolerance.value;

/* ---- check 0: initial invariants */
const s0 = mk(0.01).probe('invariants');
const init = { H0_err: Math.abs(s0.H - R['kepler-H0'].value), L0_err: Math.abs(s0.L - R['kepler-L0'].fn(E)) };
init.pass = init.H0_err <= R['kepler-H0'].tolerance.value && init.L0_err <= R['kepler-L0'].tolerance.value;

/* ---- check 1: discretization faithfulness. Inline independent RK4 (classical tableau, Kutta 1901 as
 * restated in kutta1901 accessNote) vs the module, 2000 steps at h = 1e-2. */
function inlineRK4(h, N) {
  let y = [1 - E, 0, 0, Math.sqrt((1 + E) / (1 - E))];
  const f = v => { const r3 = Math.pow(v[0] * v[0] + v[1] * v[1], 1.5); return [v[2], v[3], -v[0] / r3, -v[1] / r3]; };
  const ax = (a, c, b) => a.map((ai, i) => ai + c * b[i]);
  for (let n = 0; n < N; n++) {
    const k1 = f(y), k2 = f(ax(y, h / 2, k1)), k3 = f(ax(y, h / 2, k2)), k4 = f(ax(y, h, k3));
    y = y.map((yi, i) => yi + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  return y;
}
const faith = (() => {
  const h = 0.01, N = 2000, sim = mk(h);
  for (let i = 0; i < N; i++) sim.step();
  const s = sim.probe('state'), y = inlineRK4(h, N);
  const d = Math.hypot(s.q[0] - y[0], s.q[1] - y[1], s.p[0] - y[2], s.p[1] - y[3]);
  return { h, N, maxdiff: d, t: sim.t, t_expected: N * h, pass: d < 1e-12 && Math.abs(sim.t - N * h) < 1e-9 };
})();

/* ---- check 2: observed order at t_end = 10.5T: published pair h = 1.25e-3 -> 6.25e-4, plus h/4 and
 * pre-asymptotic info at 5e-3, 2.5e-3 */
const refOE = R['kepler-order-energy-rk4'], refOG = R['kepler-order-global-rk4'];
const tEnd = refOE.protocol.t_end, h0 = refOE.protocol.h;
const hsOrd = [4 * h0, 2 * h0, h0, h0 / 2, h0 / 4];
const ord = hsOrd.map(h => {
  const N = Math.round(tEnd / h);
  const r = run(h, N, [{ n: N, key: 'end' }]);
  return { h, N, t_N: r.sim.t, dH: r.dH, err: r.errAt.end, dL: r.dL, nan: r.nan };
});
const pair = (i, key) => log2(ord[i][key] / ord[i + 1][key]);
const order = {
  energy: { p_published: pair(2, 'dH'), p_h2_h4: pair(3, 'dH'), info_5e3_2p5e3: pair(0, 'dH'), info_2p5e3_1p25e3: pair(1, 'dH') },
  global: { p_published: pair(2, 'err'), p_h2_h4: pair(3, 'err'), info_5e3_2p5e3: pair(0, 'err'), info_2p5e3_1p25e3: pair(1, 'err') },
  runs: ord
};
order.energy.pass = within(order.energy.p_published, refOE);
order.global.pass = within(order.global.p_published, refOG);
order.energy.pass_h2_h4 = within(order.energy.p_h2_h4, refOE);
order.global.pass_h2_h4 = within(order.global.p_h2_h4, refOG);
/* Round-off floor diagnostic for the (h/2, h/4) energy pair: the truncation-only prediction at h0/4 is
 * dH(h0/2)/16; if the measured value sits well above it and an h0/8 run does not decrease it further,
 * the max energy error is round-off limited (|H| evaluation ~ few ulp of O(1) terms), not truncation. */
{
  const h8 = h0 / 8, N8 = Math.round(tEnd / h8), r8 = run(h8, N8, [{ n: N8, key: 'end' }]);
  order.energy.roundoff = {
    predicted_dH_h0_over_4: ord[3].dH / 16, measured_dH_h0_over_4: ord[4].dH,
    dH_h0_over_8: r8.dH, err_h0_over_8: r8.errAt.end, steps_h0_over_8: N8,
    // floor declared iff the h0/8 run fails to cut dH by even 2x (order-4 truncation would cut it 16x)
    floor_limited: r8.dH > ord[4].dH / 2
  };
}

/* ---- check 3: growth exponents, h = 1e-2, t1 = 40T, t2 = 160T (published; whole periods = pericentre).
 * Info: apocentre series 10.5T .. 640.5T and pericentre series 10T .. 640T. */
const refGG = R['kepler-growth-global-rk4'], refGE = R['kepler-growth-energy-rk4'];
const gp = refGG.protocol, hG = gp.h;
const n1 = Math.round(gp.t1 / hG), n2 = Math.round(gp.t2 / hG);
const periSer = [10, 20, 40, 80, 160, 320, 640], apoSer = [10.5, 20.5, 40.5, 80.5, 160.5, 320.5, 640.5];
const marks = [{ n: n1, key: 't1' }, { n: n2, key: 't2' }]
  .concat(periSer.map(k => ({ n: Math.round(k * T / hG), key: 'p' + k })))
  .concat(apoSer.map(k => ({ n: Math.round(k * T / hG), key: 'a' + k })));
const gr = run(hG, Math.round(640.5 * T / hG), marks);
function lsq(xs, ys) {
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  return sxy / sxx;
}
const growth = {
  h: hG, nan: gr.nan, diverged: gr.diverged,
  global: { k: Math.log(gr.errAt.t2 / gr.errAt.t1) / Math.log(gp.t2 / gp.t1), err_t1: gr.errAt.t1, err_t2: gr.errAt.t2 },
  energy: { k: Math.log(gr.dHat.t2 / gr.dHat.t1) / Math.log(refGE.protocol.t2 / refGE.protocol.t1), dH_t1: gr.dHat.t1, dH_t2: gr.dHat.t2 },
  pericentre: periSer.map(k => ({ periods: k, err: gr.errAt['p' + k], dHmax: gr.dHat['p' + k] })),
  apocentre: apoSer.map(k => ({ periods: k, err: gr.errAt['a' + k], dHmax: gr.dHat['a' + k] }))
};
growth.global.k_apo_10p5_40p5 = Math.log(gr.errAt['a40.5'] / gr.errAt['a10.5']) / Math.log(40.5 / 10.5);
growth.global.k_apo_40p5_160p5 = Math.log(gr.errAt['a160.5'] / gr.errAt['a40.5']) / Math.log(160.5 / 40.5);
growth.global.k_peri_10_40 = Math.log(gr.errAt.p40 / gr.errAt.p10) / Math.log(4);
growth.global.k_fit_peri_40_640 = lsq(periSer.slice(2).map(Math.log), periSer.slice(2).map(k => Math.log(gr.errAt['p' + k])));
growth.energy.k_fit_40_640 = lsq(periSer.slice(2).map(Math.log), periSer.slice(2).map(k => Math.log(gr.dHat['p' + k])));
growth.global.pass = within(growth.global.k, refGG);
growth.energy.pass = within(growth.energy.k, refGE);

/* ---- check 4: angular momentum. Reference row says rk4 does NOT conserve L; the expected outcome is a
 * drift well above the 1e-12 round-off tolerance, growing with t and decreasing with h. */
const refL = R['kepler-L-conservation'];
const Lrow = refL.rows.find(r => r[0] === 'rk4');
const angmom = {
  expected_conserved: Lrow[1], tolerance: refL.tolerance.value,
  dL_growth_t1_40T: gr.dLat.t1, dL_growth_t2_160T: gr.dLat.t2, dL_growth_640T: gr.dL,
  dL_order_runs: ord.map(o => ({ h: o.h, dL: o.dL })),
  k_dL_40_160: Math.log(gr.dLat.t2 / gr.dLat.t1) / Math.log(4),
  p_dL_published_pair: log2(ord[2].dL / ord[3].dL)
};
// consistent with the reference iff L is not conserved to round-off at h = 1e-2 (expected: rk4 = false)
angmom.pass = (Lrow[1] === false) ? (gr.dL > refL.tolerance.value) : (gr.dL <= refL.tolerance.value);

/* ---- check 5: stability (no reference criterion; info). 100T at larger h; 1000T at 1e-2 handled by growth run (640T). */
const large = [0.02, 0.05, 0.1].map(h => {
  const N = Math.round(100 * T / h);
  const r = run(h, N, [{ n: N, key: 'end' }]);
  return { h, periods: 100, steps: N, nan: r.nan, diverged: r.diverged, relDH_max: r.dH / 0.5, maxDL: r.dL, err_end: r.errAt.end, H_end: r.sim.probe('invariants').H };
});
const stability = {
  published_runs_finite: !ord.some(o => o.nan) && !gr.nan && !gr.diverged,
  largeH: large
};
stability.pass = stability.published_runs_finite;

/* ---- summary */
const summary = {
  method: 'rk4', experiment: 'kepler-e06', e: E,
  initial: init, faithfulness: faith, order, growth, angmom, stability,
  passes: {
    initial: init.pass, faithfulness: faith.pass,
    'order-energy (published pair)': order.energy.pass, 'order-global (published pair)': order.global.pass,
    'order-energy (h/2,h/4)': order.energy.pass_h2_h4, 'order-global (h/2,h/4)': order.global.pass_h2_h4,
    'growth-global': growth.global.pass, 'growth-energy': growth.energy.pass,
    'L-nonconservation-as-referenced': angmom.pass, stability: stability.pass
  },
  wall_s: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(summary, null, 1));
