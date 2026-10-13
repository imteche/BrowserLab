#!/usr/bin/env node
/* Reviewer check: stormer-verlet @ kepler-e06 (e = 0.6).
 * Reviewer: reviewer-pilot, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/stormer-verlet@kepler-e06.check.js
 * Prints a JSON summary on stdout.
 *
 * Metrics follow references/kepler.js:
 *   dH  = max_{0<=n<=N} |H(y_n) - H0|               (max energy error over the run)
 *   err = |y_N - y_exact(t_N)|, Euclidean over (q1,q2,p1,p2), t_N = N h, N = round(t_end/h)
 *   p_obs = log2(m(h)/m(h/2)) at fixed t_end;  k = log(m(t2)/m(t1))/log(t2/t1) at fixed h
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['stormer-verlet'], verification: false });
const M = LAB.methods['stormer-verlet'];
const R = LAB.references;
const exact = R['kepler-exact-solution'].fn;
const E = 0.6, T = 2 * Math.PI, H0 = -0.5, L0 = Math.sqrt(1 - E * E);
const wall0 = Date.now();

function mk(h) { return M.create('kepler', H.params('stormer-verlet', 'kepler', { e: E, h: h })); }

function globalErr(sim) {
  const s = sim.probe('state'), x = exact(sim.t, { e: E });
  const d = [s.q[0] - x.q[0], s.q[1] - x.q[1], s.p[0] - x.p[0], s.p[1] - x.p[1]];
  return Math.hypot(d[0], d[1], d[2], d[3]);
}

/* Run N steps at h, tracking max |H-H0|, max |L-L0|; call hook(sim, n) at requested step indices. */
function run(h, N, marks) {
  const sim = mk(h);
  let dH = 0, dL = 0, nan = false;
  const out = {};
  const markSet = new Map();   // step index -> list of keys (several keys may share a step)
  (marks || []).forEach(m => { if (!markSet.has(m.n)) markSet.set(m.n, []); markSet.get(m.n).push(m.key); });
  const dHat = {};
  for (let n = 1; n <= N; n++) {
    sim.step();
    const inv = sim.probe('invariants');
    if (!isFinite(inv.H) || !isFinite(inv.L)) { nan = true; break; }
    dH = Math.max(dH, Math.abs(inv.H - H0));
    dL = Math.max(dL, Math.abs(inv.L - L0));
    if (markSet.has(n)) { const g = globalErr(sim); markSet.get(n).forEach(k => { out[k] = g; dHat[k] = dH; }); }
  }
  return { sim, dH, dL, nan, diverged: sim.diverged(), errAt: out, dHat };
}

const log2 = x => Math.log(x) / Math.LN2;
const within = (v, ref) => Math.abs(v - ref.value) <= ref.tolerance.value;

/* ---- check 0: initial invariants vs kepler-H0 / kepler-L0 */
const s0 = mk(0.01).probe('invariants');
const init = { H0_err: Math.abs(s0.H - R['kepler-H0'].value), L0_err: Math.abs(s0.L - R['kepler-L0'].fn(E)) };
init.pass = init.H0_err <= R['kepler-H0'].tolerance.value && init.L0_err <= R['kepler-L0'].tolerance.value;

/* ---- check b: observed order at t_end = 10.5T, h = 1e-2, 5e-3, 2.5e-3 */
const refOE = R['kepler-order-energy-stormer-verlet'], refOG = R['kepler-order-global-stormer-verlet'];
const tEnd = refOE.protocol.t_end;
const hs = [refOE.protocol.h, refOE.protocol.h / 2, refOE.protocol.h / 4];
const ord = hs.map(h => {
  const N = Math.round(tEnd / h);
  const r = run(h, N, [{ n: N, key: 'end' }]);
  return { h, N, t_N: r.sim.t, dH: r.dH, err: r.errAt.end, dL: r.dL };
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

/* ---- check b': sampling sensitivity (information): same orders at a whole period t_end = 10T (pericentre) */
const ordW = hs.map(h => {
  const N = Math.round(10 * T / h);
  const r = run(h, N, [{ n: N, key: 'end' }]);
  return { h, N, dH: r.dH, err: r.errAt.end };
});
order.wholePeriod10T = {
  energy_p_h_h2: log2(ordW[0].dH / ordW[1].dH), global_p_h_h2: log2(ordW[0].err / ordW[1].err),
  global_p_h2_h4: log2(ordW[1].err / ordW[2].err), runs: ordW
};

/* ---- check c: growth exponents, h = 1e-2, t1 = 10.5T, t2 = 40.5T (apocentre) */
const refGG = R['kepler-growth-global-stormer-verlet'], refGE = R['kepler-growth-energy-stormer-verlet'];
const gp = refGG.protocol, hG = gp.h;
const n1 = Math.round(gp.t1 / hG), n2 = Math.round(gp.t2 / hG);
// extra apocentre samples for a log-log fit of err(t)
const extraT = [10.5, 20.5, 40.5, 80.5, 160.5].map(k => ({ n: Math.round(k * T / hG), key: 'a' + k }));
const gr = run(hG, Math.round(160.5 * T / hG), [{ n: n1, key: 't1' }, { n: n2, key: 't2' }].concat(extraT));
const growth = {
  global: { k: Math.log(gr.errAt.t2 / gr.errAt.t1) / Math.log(gp.t2 / gp.t1), err_t1: gr.errAt.t1, err_t2: gr.errAt.t2 },
  energy: { k: Math.log(gr.dHat.t2 / gr.dHat.t1) / Math.log(refGE.protocol.t2 / refGE.protocol.t1), dH_t1: gr.dHat.t1, dH_t2: gr.dHat.t2 },
  apocentreSeries: extraT.map(m => ({ periods: +m.key.slice(1), err: gr.errAt[m.key], dHmax: gr.dHat[m.key] }))
};
{ // least-squares log-log slope of err over the apocentre series
  const xs = growth.apocentreSeries.map(a => Math.log(a.periods)), ys = growth.apocentreSeries.map(a => Math.log(a.err));
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  growth.global.k_fit_10_160T = sxy / sxx;
}
growth.global.pass = within(growth.global.k, refGG);
growth.energy.pass = within(growth.energy.k, refGE);

/* ---- check a: long run, 1000 periods at h = 1e-2; per-period max |dH|/|H0| envelope */
const NP = 1000, hL = 0.01;
const longSim = mk(hL);
const envelope = new Float64Array(NP);
let longMaxDL = 0, longNaN = false;
for (let n = 1; ; n++) {
  longSim.step();
  const per = Math.floor(longSim.t / T);
  if (per >= NP) break;
  const inv = longSim.probe('invariants');
  if (!isFinite(inv.H)) { longNaN = true; break; }
  const rel = Math.abs(inv.H - H0) / Math.abs(H0);
  if (rel > envelope[per]) envelope[per] = rel;
  longMaxDL = Math.max(longMaxDL, Math.abs(inv.L - L0));
}
function linfit(y) {
  const n = y.length; let mx = (n - 1) / 2, my = 0; for (const v of y) my += v; my /= n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (i - mx) * (y[i] - my); sxx += (i - mx) ** 2; }
  return { slope: sxy / sxx, mean: my };
}
const env = Array.from(envelope);
const fit = linfit(env);
const firstMax = Math.max(...env.slice(0, 100)), lastMax = Math.max(...env.slice(NP - 100));
const envMax = Math.max(...env), envMin = Math.min(...env);
// Baseline for "explicit drift": an inline non-symplectic 2nd-order RK (Heun) at the same h, 100 periods,
// same envelope metric. Reviewer-side comparison only; it is not a method under test.
function heunEnvelope(h, periods) {
  let q0 = 1 - E, q1 = 0, p0 = 0, p1 = Math.sqrt((1 + E) / (1 - E)), t = 0;
  const env = new Float64Array(periods);
  const F = (x, y) => { const r3 = Math.pow(x * x + y * y, 1.5); return [-x / r3, -y / r3]; };
  for (;;) {
    const a = F(q0, q1);
    const qa0 = q0 + h * p0, qa1 = q1 + h * p1, pa0 = p0 + h * a[0], pa1 = p1 + h * a[1];
    const b = F(qa0, qa1);
    q0 += 0.5 * h * (p0 + pa0); q1 += 0.5 * h * (p1 + pa1);
    p0 += 0.5 * h * (a[0] + b[0]); p1 += 0.5 * h * (a[1] + b[1]);
    t += h; const per = Math.floor(t / T); if (per >= periods) break;
    const Hn = 0.5 * (p0 * p0 + p1 * p1) - 1 / Math.hypot(q0, q1);
    const rel = Math.abs(Hn - H0) / 0.5; if (rel > env[per]) env[per] = rel;
  }
  return Array.from(env);
}
const heun = heunEnvelope(hL, 100);
const heunFit = linfit(heun);
const energyLong = {
  periods: NP, h: hL, steps: longSim.steps, nan: longNaN, diverged: longSim.diverged(),
  relDH_max: envMax, relDH_envelope_min: envMin, envelope_first100_max: firstMax, envelope_last100_max: lastMax,
  envelope_slope_per_period: fit.slope, envelope_mean: fit.mean,
  projected_change_over_run: fit.slope * NP, projected_change_rel_to_mean: fit.slope * NP / fit.mean,
  baseline_heun_100T: { slope_per_period: heunFit.slope, env_first: heun[0], env_last: heun[99] },
  maxDL: longMaxDL
};
// bounded / no drift criterion (reviewer-set, documented): slope*NP must be < 5% of the mean envelope
// AND the last-100-period max must not exceed the first-100-period max by more than 5%.
energyLong.pass = !longNaN && Math.abs(energyLong.projected_change_rel_to_mean) < 0.05 && lastMax <= 1.05 * firstMax;

/* ---- check d: angular momentum, tolerance from kepler-L-conservation */
const refL = R['kepler-L-conservation'];
const Lrow = refL.rows.find(r => r[0] === 'stormer-verlet');
const angmom = {
  expected_conserved: Lrow[1], tolerance: refL.tolerance.value,
  maxDL_long_1000T: longMaxDL, maxDL_growth_160T: gr.dL, maxDL_order_runs: ord.map(o => o.dL)
};
angmom.pass = Math.max(longMaxDL, gr.dL, ...ord.map(o => o.dL)) <= refL.tolerance.value;

/* ---- check e: stability at large h (information only; no reference criterion) */
const large = [0.05, 0.1, 0.2].map(h => {
  const N = Math.round(100 * T / h);
  const r = run(h, N, [{ n: N, key: 'end' }]);
  return { h, periods: 100, steps: N, nan: r.nan, diverged: r.diverged, relDH_max: r.dH / 0.5, maxDL: r.dL, err_end: r.errAt.end };
});

/* ---- check f: time reversibility via the public API: N steps at +h, then setParam('h', -h), N steps.
 * For a symmetric method Phi_{-h} = Phi_h^{-1}, equivalent to the momentum-flip test. */
function reversal(h, N) {
  const sim = mk(h);
  for (let i = 0; i < N; i++) sim.step();
  sim.setParam('h', -h);
  for (let i = 0; i < N; i++) sim.step();
  const s = sim.probe('state'), y0 = [1 - E, 0, 0, Math.sqrt((1 + E) / (1 - E))];
  return { h, N, t_back: sim.t, dist: Math.hypot(s.q[0] - y0[0], s.q[1] - y0[1], s.p[0] - y0[2], s.p[1] - y0[3]) };
}
const reversibility = [reversal(0.01, 6597), reversal(0.01, 62832)];
reversibility.forEach(r => { r.pass = r.dist < 1e-9; });

/* ---- summary */
const summary = {
  method: 'stormer-verlet', experiment: 'kepler-e06', e: E,
  initial: init,
  order, growth, energyLong, angmom, largeH: large, reversibility,
  passes: {
    initial: init.pass,
    'order-energy': order.energy.pass, 'order-global': order.global.pass,
    'growth-global': growth.global.pass, 'growth-energy': growth.energy.pass,
    'energy-long-bounded': energyLong.pass, 'L-conservation': angmom.pass,
    stability: !large.some(l => l.nan) && !energyLong.nan,
    reversibility: reversibility.every(r => r.pass)
  },
  wall_s: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(summary, null, 1));
