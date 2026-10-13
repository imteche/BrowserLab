#!/usr/bin/env node
/* Reviewer check: symplectic-euler @ kepler-e06 (e = 0.6).
 * Reviewer: reviewer-symplectic-euler-kepler-e06-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/symplectic-euler@kepler-e06.check.js
 * Prints a JSON summary on stdout.
 *
 * Metrics follow references/kepler.js:
 *   dH  = max_{0<=n<=N} |H(y_n) - H0|
 *   err = |y_N - y_exact(t_N)|, Euclidean over (q1,q2,p1,p2), t_N = N h, N = round(t_end/h)
 *   p_obs = log2(m(h)/m(h/2)) at fixed t_end;  k = log(m(t2)/m(t1))/log(t2/t1) at fixed h
 * Protocols are read from the references (kepler-order-*-symplectic-euler: t_end = 10.5T, h = 5e-4;
 * kepler-growth-*-symplectic-euler: h = 1e-3, t1 = 10T, t2 = 40T, whole periods).
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['symplectic-euler'], verification: false });
const M = LAB.methods['symplectic-euler'];
const R = LAB.references;
const exact = R['kepler-exact-solution'].fn;
const KA = LAB.keplerAnalytic;
const E = 0.6, T = 2 * Math.PI, H0 = -0.5, L0 = Math.sqrt(1 - E * E);
const wall0 = Date.now();

function mk(h) { return M.create('kepler', H.params('symplectic-euler', 'kepler', { e: E, h: h })); }
function globalErr(sim) {
  const s = sim.probe('state'), x = exact(sim.t, { e: E });
  return Math.hypot(s.q[0] - x.q[0], s.q[1] - x.q[1], s.p[0] - x.p[0], s.p[1] - x.p[1]);
}
function run(h, N, marks) {
  const sim = mk(h);
  let dH = 0, dL = 0, nan = false;
  const errAt = {}, dHat = {}, markSet = new Map();
  (marks || []).forEach(m => { if (!markSet.has(m.n)) markSet.set(m.n, []); markSet.get(m.n).push(m.key); });
  for (let n = 1; n <= N; n++) {
    sim.step();
    const inv = sim.probe('invariants');
    if (!isFinite(inv.H) || !isFinite(inv.L)) { nan = true; break; }
    dH = Math.max(dH, Math.abs(inv.H - H0));
    dL = Math.max(dL, Math.abs(inv.L - L0));
    if (markSet.has(n)) { const g = globalErr(sim); markSet.get(n).forEach(k => { errAt[k] = g; dHat[k] = dH; }); }
  }
  return { sim, dH, dL, nan, diverged: sim.diverged(), errAt, dHat };
}
const log2 = x => Math.log(x) / Math.LN2;
const within = (v, ref) => Math.abs(v - ref.value) <= ref.tolerance.value;

/* ---- check 0: initial invariants */
const s0 = mk(0.01).probe('invariants');
const init = { H0_err: Math.abs(s0.H - R['kepler-H0'].value), L0_err: Math.abs(s0.L - R['kepler-L0'].fn(E)) };
init.pass = init.H0_err <= R['kepler-H0'].tolerance.value && init.L0_err <= R['kepler-L0'].tolerance.value;

/* ---- check 1: observed orders, t_end = 10.5T (half period / apocentre), h = 5e-4, 2.5e-4, 1.25e-4 */
const refOE = R['kepler-order-energy-symplectic-euler'], refOG = R['kepler-order-global-symplectic-euler'];
const tEnd = refOE.protocol.t_end, h0 = refOE.protocol.h;
const hs = [h0, h0 / 2, h0 / 4];
const ord = hs.map(h => {
  const N = Math.round(tEnd / h);
  const r = run(h, N, [{ n: N, key: 'end' }]);
  return { h, N, t_N: r.sim.t, dH: r.dH, err: r.errAt.end, dL: r.dL, nan: r.nan };
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

/* ---- info: superconvergence artefact at whole periods (10T), h = 1e-3, 5e-4, 2.5e-4 */
const ordW = [1e-3, 5e-4, 2.5e-4].map(h => {
  const N = Math.round(10 * T / h);
  const r = run(h, N, [{ n: N, key: 'end' }]);
  return { h, N, dH: r.dH, err: r.errAt.end };
});
order.wholePeriod10T = { global_p_1: log2(ordW[0].err / ordW[1].err), global_p_2: log2(ordW[1].err / ordW[2].err), runs: ordW };

/* ---- check 2: growth exponents, h = 1e-3, t1 = 10T, t2 = 40T (whole periods) */
const refGG = R['kepler-growth-global-symplectic-euler'], refGE = R['kepler-growth-energy-symplectic-euler'];
const gp = refGG.protocol, hG = gp.h;
const n1 = Math.round(gp.t1 / hG), n2 = Math.round(gp.t2 / hG);
const extra = [10, 20, 40, 80, 160].map(k => ({ n: Math.round(k * T / hG), key: 'w' + k }));
const extraHalf = [10.5, 40.5, 160.5].map(k => ({ n: Math.round(k * T / hG), key: 'a' + k }));
const gr = run(hG, Math.round(160.5 * T / hG), [{ n: n1, key: 't1' }, { n: n2, key: 't2' }].concat(extra, extraHalf));
const growth = {
  global: { k: Math.log(gr.errAt.t2 / gr.errAt.t1) / Math.log(gp.t2 / gp.t1), err_t1: gr.errAt.t1, err_t2: gr.errAt.t2 },
  energy: { k: Math.log(gr.dHat.t2 / gr.dHat.t1) / Math.log(refGE.protocol.t2 / refGE.protocol.t1), dH_t1: gr.dHat.t1, dH_t2: gr.dHat.t2 },
  wholeSeries: extra.map(m => ({ periods: +m.key.slice(1), err: gr.errAt[m.key], dHmax: gr.dHat[m.key] })),
  halfSeries: extraHalf.map(m => ({ periods: +m.key.slice(1), err: gr.errAt[m.key] })),
  maxDL_160T: gr.dL
};
{
  const xs = growth.wholeSeries.map(a => Math.log(a.periods)), ys = growth.wholeSeries.map(a => Math.log(a.err));
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  growth.global.k_fit_10_160T = sxy / sxx;
}
growth.global.pass = within(growth.global.k, refGG);
growth.energy.pass = within(growth.energy.k, refGE);

/* ---- check 3: long run, 1000 periods at h = 1e-3 (6.28e6 steps); per-period max |dH|/|H0| envelope */
function longRun(h, NP) {
  const sim = mk(h);
  const env = new Float64Array(NP);
  let maxDL = 0, nan = false;
  for (;;) {
    sim.step();
    const per = Math.floor(sim.t / T);
    if (per >= NP) break;
    const inv = sim.probe('invariants');
    if (!isFinite(inv.H) || !isFinite(inv.L)) { nan = true; break; }
    const rel = Math.abs(inv.H - H0) / Math.abs(H0);
    if (rel > env[per]) env[per] = rel;
    maxDL = Math.max(maxDL, Math.abs(inv.L - L0));
  }
  const y = Array.from(env), n = y.length;
  const mx = (n - 1) / 2, my = y.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (i - mx) * (y[i] - my); sxx += (i - mx) ** 2; }
  const slope = sxy / sxx;
  const first = Math.max(...y.slice(0, 100)), last = Math.max(...y.slice(n - 100));
  const out = { h, periods: NP, steps: sim.steps, nan, diverged: sim.diverged(), relDH_max: Math.max(...y), relDH_env_min: Math.min(...y),
    envelope_first100_max: first, envelope_last100_max: last, slope_per_period: slope, mean: my,
    projected_change_rel_to_mean: slope * NP / my, maxDL };
  // reviewer criterion (same as stormer-verlet@kepler-e06 review): |slope*NP| < 5% of mean, last-100 max <= 1.05 x first-100 max
  out.pass = !nan && Math.abs(out.projected_change_rel_to_mean) < 0.05 && last <= 1.05 * first;
  return out;
}
const long1 = longRun(1e-3, 1000);
const long2 = longRun(1e-2, 1000);

/* ---- check 4: angular momentum (kepler-L-conservation) */
const refL = R['kepler-L-conservation'];
const Lrow = refL.rows.find(r => r[0] === 'symplectic-euler');
const allDL = [long1.maxDL, long2.maxDL, gr.dL].concat(ord.map(o => o.dL));
const angmom = { expected_conserved: Lrow[1], tolerance: refL.tolerance.value, maxDL_long_1e3: long1.maxDL, maxDL_long_1e2: long2.maxDL,
  maxDL_growth: gr.dL, maxDL_order: ord.map(o => o.dL), max: Math.max(...allDL) };
angmom.pass = angmom.max <= refL.tolerance.value;

/* ---- check 5 (diagnostic): precession direction via Runge-Lenz angle, Hairer figure protocol h = 0.05, 4000 steps */
function precession(h, N) {
  const sim = mk(h);
  let prev = 0, unwrapped = 0, nan = false;
  for (let i = 0; i < N; i++) {
    sim.step();
    const s = sim.probe('state');
    if (!LAB.util.finiteAll([s.q[0], s.q[1], s.p[0], s.p[1]])) { nan = true; break; }
    const A = KA.invariants(s.q, s.p).A, ang = Math.atan2(A[1], A[0]);
    let d = ang - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    unwrapped += d; prev = ang;
  }
  const s = sim.probe('state'), inv = KA.invariants(s.q, s.p);
  return { h, N, t: sim.t, nan, LRL_angle_total_rad: unwrapped, direction: unwrapped < 0 ? 'clockwise' : 'anticlockwise',
    LRL_norm_end: Math.hypot(inv.A[0], inv.A[1]), relDH_end: Math.abs(inv.H - H0) / 0.5 };
}
const prec = [precession(0.05, 4000), precession(1e-3, Math.round(40 * T / 1e-3))];

/* ---- check 6 (info): large h, 100 periods */
const large = [0.05, 0.1, 0.2].map(h => {
  const N = Math.round(100 * T / h);
  const r = run(h, N, [{ n: N, key: 'end' }]);
  return { h, steps: N, nan: r.nan, diverged: r.diverged, relDH_max: r.dH / 0.5, maxDL: r.dL, err_end: r.errAt.end };
});

/* ---- check 7 (structural): first step from y0 equals the stated p-first map
 * p1 = p0 - h q0/|q0|^3, q1 = q0 + h p1 (inline re-implementation, used only for this comparison). */
function stepMap(y, h) {
  let [qx, qy, px, py] = y;
  const r3 = Math.pow(qx * qx + qy * qy, 1.5);
  px -= h * qx / r3; py -= h * qy / r3; qx += h * px; qy += h * py;
  return [qx, qy, px, py];
}
const oneStep = (() => {
  const h = 0.01, sim = mk(h); sim.step();
  const s = sim.probe('state'), y = stepMap([1 - E, 0, 0, Math.sqrt((1 + E) / (1 - E))], h);
  return { h, diff_vs_inline_p_first_map: Math.hypot(s.q[0] - y[0], s.q[1] - y[1], s.p[0] - y[2], s.p[1] - y[3]) };
})();

const summary = {
  method: 'symplectic-euler', experiment: 'kepler-e06', e: E,
  initial: init, order, growth, energyLong: { h1e3: long1, h1e2: long2 }, angmom, precession: prec, largeH: large, oneStep,
  passes: {
    initial: init.pass,
    'order-energy': order.energy.pass, 'order-global': order.global.pass,
    'order-energy-h2h4': order.energy.pass_h2_h4, 'order-global-h2h4': order.global.pass_h2_h4,
    'growth-global': growth.global.pass, 'growth-energy': growth.energy.pass,
    'energy-long-bounded-1e3': long1.pass, 'energy-long-bounded-1e2': long2.pass,
    'L-conservation': angmom.pass,
    stability: !large.some(l => l.nan) && !long1.nan && !long2.nan && !ord.some(o => o.nan) && !gr.nan
  },
  wall_s: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(summary, null, 1));
