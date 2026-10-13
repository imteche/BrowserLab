#!/usr/bin/env node
/* Reviewer check: lax-friedrichs @ sod-t02 (Sod shock tube, profiles at t = 0.2).
 * Reviewer: reviewer-lax-friedrichs-sod-t02-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/lax-friedrichs@sod-t02.check.js
 * Prints a JSON summary on stdout.
 *
 * Metrics (follow references/sod.js):
 *   L1(q) = sum_i |q_i - q_exact(x_i, 0.2)| * dx, q in {rho, u, p}, x_i cell centres  (sod-exact-profile rationale)
 *   observed order p = log2(L1(N) / L1(2N)), N = 100..3200
 *   totals vs sod-totals: mass 0.5625, momentum 0.9 t (rel 1e-12), tracked at EVERY step to t = 0.2.
 *     ENERGY: sod-totals.fn returns 2.75, but its own derivation (0.5*2.5 + 0.5*0.25) gives 1.375 = 0.5*1/0.4 + 0.5*0.1/0.4.
 *     The reference value is an arithmetic slip (factor 2). Energy is checked against the analytic initial total
 *     E0 = 1.375 with the SAME rel 1e-12 tolerance; the deviation from the registered 2.75 is reported separately.
 *   wave positions vs sodshock README values (abs 0.01):
 *     shock    = where p crosses (p* + pR)/2, searched right of the exact contact
 *     contact  = where rho crosses (rho*L + rho*R)/2, searched between rarefaction tail and the measured shock
 *     rarefaction head / tail = linear LSQ fit of u(x) over the central 60% of the exact fan,
 *               extrapolated to u = 0 (head) and u = u* (tail). A kink cannot be located by a jump criterion;
 *               the fit uses the fact that u is exactly linear in x in the centred rarefaction.
 *   star plateaux p*, u*, rho*_L, rho*_R read at plateau midpoints, band 2% at N = 400 (sod-pstar etc. NOTE).
 *   independent re-implementation of the classic LF update (reviewer-written, same dt rule) for a discretization
 *   faithfulness check.
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['lax-friedrichs'], verification: false });
const M = LAB.methods['lax-friedrichs'];
const R = LAB.references;
const exact = R['sod-exact-profile'].fn;
const T = 0.2, G = 1.4;
const wall0 = Date.now();
const st = exact.star();
const wpos = exact.wavePositions(T);

function mk(N, extra) { return M.create('sod', H.params('lax-friedrichs', 'sod', Object.assign({ N: N }, extra || {}))); }

/* run to exactly t = T, tracking totals and CFL every step */
function runTo(N, extra) {
  const sim = mk(N, extra);
  let maxRelMass = 0, maxRelEnergy = 0, maxAbsMom = 0, maxCfl = 0, nan = false, minRho = Infinity, minP = Infinity;
  const totRef = (x, t) => ({ mass: 0.5625, momentum: 0.9 * t, energy: 1.375 });  // see header: energy corrected
  const regE = R['sod-totals'].fn(0, 0).energy;
  while (sim.t < T - 1e-14) {
    sim.step();
    const tot = sim.probe('totals'), ref = totRef(0, sim.t);
    if (!isFinite(tot.mass) || !isFinite(tot.energy) || !isFinite(tot.momentum)) { nan = true; break; }
    maxRelMass = Math.max(maxRelMass, Math.abs(tot.mass - ref.mass) / ref.mass);
    maxRelEnergy = Math.max(maxRelEnergy, Math.abs(tot.energy - ref.energy) / ref.energy);
    maxAbsMom = Math.max(maxAbsMom, Math.abs(tot.momentum - ref.momentum));
    const met = {}; sim.metrics().forEach(m => { met[m.key] = m.value; });
    maxCfl = Math.max(maxCfl, met.cfl);
    minRho = Math.min(minRho, met.rhomin); minP = Math.min(minP, met.pmin);
  }
  const met = {}; sim.metrics().forEach(m => { met[m.key] = m.value; });
  return { sim, t: sim.t, steps: sim.steps, nan, diverged: sim.diverged(),
    cons: { maxRelMass, maxRelEnergy, maxAbsMomVs09t: maxAbsMom, relMomVs09tEnd: Math.abs(met.momentum - 0.9 * sim.t) / (0.9 * sim.t),
      internal_residual: met.cons_res, energy_end: met.energy, relDevFromRegisteredEnergy: Math.abs(met.energy - regE) / regE },
    maxCfl, minRho, minP };
}

function L1(prof, N, t) {
  const dx = 1 / N; let er = 0, eu = 0, ep = 0;
  for (let i = 0; i < N; i++) {
    const e = exact(prof.x[i], t);
    er += Math.abs(prof.rho[i] - e.rho); eu += Math.abs(prof.u[i] - e.u); ep += Math.abs(prof.p[i] - e.p);
  }
  return { rho: er * dx, u: eu * dx, p: ep * dx };
}

/* crossing of level v by array y between x-indices [i0, i1], scanning from i0; linear interpolation */
function crossing(x, y, v, a, b, dir) {
  const n = x.length;
  const idx = []; for (let i = 0; i < n - 1; i++) if (x[i] >= a && x[i + 1] <= b) idx.push(i);
  if (dir < 0) idx.reverse();
  for (const i of idx) {
    if ((y[i] - v) * (y[i + 1] - v) <= 0 && y[i] !== y[i + 1]) return x[i] + (v - y[i]) * (x[i + 1] - x[i]) / (y[i + 1] - y[i]);
  }
  return NaN;
}
function waves(prof) {
  const x = prof.x;
  // shock: scan from right to left for p crossing the midpoint (p* + pR)/2
  const shock = crossing(x, prof.p, 0.5 * (st.p + 0.1), wpos.contact, 1, -1);
  // contact: density midpoint between star densities, scanning from left, between fan tail and measured shock
  const contact = crossing(x, prof.rho, 0.5 * (st.rhoL + st.rhoR), wpos.rarefactionTail, shock, +1);
  // rarefaction: LSQ line for u over central 60% of exact fan
  const a = wpos.rarefactionHead, b = wpos.rarefactionTail, lo = a + 0.2 * (b - a), hi = b - 0.2 * (b - a);
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < x.length; i++) if (x[i] >= lo && x[i] <= hi) { n++; sx += x[i]; sy += prof.u[i]; sxx += x[i] * x[i]; sxy += x[i] * prof.u[i]; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
  const slopeExact = 2 / ((G + 1) * T);   // du/dx in a centred rarefaction = 2/((gamma+1) t)
  return { shock, contact, rarefactionHead: -icpt / slope, rarefactionTail: (st.u - icpt) / slope,
    fan_slope: slope, fan_slope_exact: slopeExact, fan_points: n };
}

function plateaux(prof) {
  const x = prof.x;
  function at(xq) { // average of the 2 cells nearest xq
    let k = 0; while (k < x.length - 1 && x[k + 1] < xq) k++;
    return k;
  }
  const xR = 0.5 * (wpos.contact + wpos.shock), xL = 0.5 * (wpos.rarefactionTail + wpos.contact);
  const kR = at(xR), kL = at(xL);
  const avg = (arr, k) => 0.5 * (arr[k] + arr[k + 1]);  // pair average removes odd-even pattern
  return { x_rightPlateau: xR, x_leftPlateau: xL,
    pstar: avg(prof.p, kR), ustar: avg(prof.u, kR), rhostarR: avg(prof.rho, kR), rhostarL: avg(prof.rho, kL),
    pstar_left: avg(prof.p, kL), ustar_left: avg(prof.u, kL) };
}

/* ---- independent reviewer implementation of the classic LF update (for discretization check) */
function refLF(N, cfl) {
  const g = G, dx = 1 / N, r = new Float64Array(N + 2), m = new Float64Array(N + 2), E = new Float64Array(N + 2);
  for (let i = 0; i < N; i++) { const x = (i + 0.5) * dx; const L = x < 0.5; r[i + 1] = L ? 1 : 0.125; E[i + 1] = (L ? 1 : 0.1) / (g - 1); }
  let t = 0;
  const pr = (k) => (g - 1) * (E[k] - 0.5 * m[k] * m[k] / r[k]);
  while (t < T - 1e-14) {
    r[0] = r[1]; m[0] = m[1]; E[0] = E[1]; r[N + 1] = r[N]; m[N + 1] = m[N]; E[N + 1] = E[N];
    let s = 0; for (let k = 1; k <= N; k++) s = Math.max(s, Math.abs(m[k] / r[k]) + Math.sqrt(g * pr(k) / r[k]));
    let dt = cfl * dx / s; if (t + dt > T) dt = T - t;
    const f = (k) => { const u = m[k] / r[k], p = pr(k); return [m[k], m[k] * u + p, u * (E[k] + p)]; };
    const F = []; for (let k = 0; k < N + 2; k++) F.push(f(k));
    const nr = new Float64Array(N + 2), nm = new Float64Array(N + 2), nE = new Float64Array(N + 2), lam = dt / (2 * dx);
    for (let k = 1; k <= N; k++) {
      nr[k] = 0.5 * (r[k - 1] + r[k + 1]) - lam * (F[k + 1][0] - F[k - 1][0]);
      nm[k] = 0.5 * (m[k - 1] + m[k + 1]) - lam * (F[k + 1][1] - F[k - 1][1]);
      nE[k] = 0.5 * (E[k - 1] + E[k + 1]) - lam * (F[k + 1][2] - F[k - 1][2]);
    }
    r.set(nr); m.set(nm); E.set(nE);
    t += dt;
  }
  const rho = [], u = [], p = [];
  for (let k = 1; k <= N; k++) { rho.push(r[k]); u.push(m[k] / r[k]); p.push(pr(k)); }
  return { rho, u, p };
}

/* ---- main convergence study */
const Ns = [100, 200, 400, 800, 1600, 3200];
const runs = Ns.map(N => {
  const r = runTo(N);
  const prof = r.sim.probe('profile');
  return { N, t: r.t, steps: r.steps, nan: r.nan, diverged: r.diverged, maxCfl: r.maxCfl, minRho: r.minRho, minP: r.minP,
    cons: r.cons, L1: L1(prof, N, r.t), waves: waves(prof), plateaux: plateaux(prof), prof };
});
const orders = [];
for (let k = 0; k + 1 < runs.length; k++) {
  const a = runs[k].L1, b = runs[k + 1].L1;
  orders.push({ from: runs[k].N, to: runs[k + 1].N,
    rho: Math.log2(a.rho / b.rho), u: Math.log2(a.u / b.u), p: Math.log2(a.p / b.p) });
}

/* ---- engineering bands (NOT published values; ~1.4x researcher scratch LF errors) */
const band = R['sod-exact-profile-laxfriedrichs-band'].tolerance.value;
const bandChecks = [100, 200, 400].map(N => {
  const r = runs.find(x => x.N === N);
  return { N, L1rho: r.L1.rho, band: band['N=' + N], pass: r.L1.rho <= band['N=' + N] };
});

/* ---- wave positions vs sodshock values, tol 0.01 (sod-x-* tolerance) */
const wref = { shock: 'sod-x-shock', contact: 'sod-x-contact', rarefactionHead: 'sod-x-rarefaction-head', rarefactionTail: 'sod-x-rarefaction-tail' };
const waveChecks = {};
[100, 200, 400, 800, 1600, 3200].forEach(N => {
  const r = runs.find(x => x.N === N);
  waveChecks[N] = {};
  for (const k in wref) {
    const ref = R[wref[k]];
    const err = Math.abs(r.waves[k] - ref.value);
    waveChecks[N][k] = { value: r.waves[k], ref: ref.value, err, tol: ref.tolerance.value, pass: err <= ref.tolerance.value };
  }
});

/* ---- plateaux at N = 400, 2% band (sod-pstar NOTE) */
const plat = {};
[400, 800, 3200].forEach(N => {
  const r = runs.find(x => x.N === N), P = r.plateaux;
  plat[N] = {};
  [['pstar', 'sod-pstar'], ['ustar', 'sod-ustar'], ['rhostarL', 'sod-rhostarL'], ['rhostarR', 'sod-rhostarR']].forEach(([k, id]) => {
    const ref = R[id].value, rel = Math.abs(P[k] - ref) / ref;
    plat[N][k] = { value: P[k], ref, rel, tol: 0.02, pass: rel <= 0.02 };
  });
});

/* ---- odd-even decoupling diagnostic (info): max |rho_i - rho_{i+1}| in left constant state x < 0.2 and right x > 0.9 */
function oddEven(prof) {
  let mL = 0, mR = 0;
  for (let i = 0; i + 1 < prof.x.length; i++) {
    const d = Math.abs(prof.rho[i + 1] - prof.rho[i]);
    if (prof.x[i + 1] < 0.2) mL = Math.max(mL, d);
    if (prof.x[i] > 0.9) mR = Math.max(mR, d);
    }
  // in the star region between contact and shock: alternating component
  let alt = 0;
  for (let i = 1; i + 1 < prof.x.length; i++) if (prof.x[i] > 0.72 && prof.x[i] < 0.82)
    alt = Math.max(alt, Math.abs(prof.p[i] - 0.5 * (prof.p[i - 1] + prof.p[i + 1])));
  return { maxJumpLeftState: mL, maxJumpRightState: mR, pressureZigzagStarRegion: alt };
}
const oddeven = [200, 800].map(N => Object.assign({ N }, oddEven(runs.find(x => x.N === N).prof)));

/* ---- discretization faithfulness: independent classic-form LF at N = 200, CFL 0.9 */
const ind = refLF(200, 0.9), p200 = runs.find(x => x.N === 200).prof;
let dmax = 0; for (let i = 0; i < 200; i++) dmax = Math.max(dmax, Math.abs(ind.rho[i] - p200.rho[i]), Math.abs(ind.u[i] - p200.u[i]), Math.abs(ind.p[i] - p200.p[i]));
const indep = { N: 200, maxAbsDiff_rho_u_p: dmax, pass: dmax < 1e-10,
  L1rho_independent: L1({ x: p200.x, rho: ind.rho, u: ind.u, p: ind.p }, 200, T).rho };

/* ---- CFL sensitivity (info): LF numerical viscosity ~ dx^2/(2dt) grows as CFL falls */
const cflInfo = [0.5, 0.9, 1.0].map(c => {
  const r = runTo(400, { CFL: c }), prof = r.sim.probe('profile');
  return { CFL: c, N: 400, L1: L1(prof, 400, r.t), nan: r.nan, diverged: r.diverged, maxCfl: r.maxCfl };
});

/* ---- continuation past t = 0.2 (behaviour as waves exit; info) */
const cont = (() => {
  const s = mk(400); while (s.t < 0.2 - 1e-14) s.step();
  const tot02 = s.probe('totals');
  let n = 0; while (s.t < 0.6 && n < 200000) { s.step(); n++; }
  const met = {}; s.metrics().forEach(m => { met[m.key] = m.value; });
  return { t: s.t, diverged: s.diverged(), mass_at_0_2: tot02.mass, mass_at_end: met.mass, cons_residual_boundary_accounted: met.cons_res };
})();

/* ---- estimator robustness (info): fan fit window 60% / 40% / 20% of the exact fan, and fan-centre crossing u = ustar/2 */
function fanFit(prof, f) {
  const x = prof.x, a = wpos.rarefactionHead, b = wpos.rarefactionTail, lo = a + f * (b - a), hi = b - f * (b - a);
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < x.length; i++) if (x[i] >= lo && x[i] <= hi) { n++; sx += x[i]; sy += prof.u[i]; sxx += x[i] * x[i]; sxy += x[i] * prof.u[i]; }
  const sl = (n * sxy - sx * sy) / (n * sxx - sx * sx), ic = (sy - sl * sx) / n;
  return { window: 1 - 2 * f, head: -ic / sl, tail: (st.u - ic) / sl, slope: sl };
}
const estimatorRobustness = [200, 400, 800].map(N => {
  const prof = runs.find(x => x.N === N).prof;
  return { N, fits: [0.2, 0.3, 0.4].map(f => fanFit(prof, f)),
    u_half_ustar_crossing: crossing(prof.x, prof.u, 0.5 * st.u, 0.1, wpos.contact, +1),
    u_half_ustar_exact: wpos.rarefactionHead + (wpos.rarefactionTail - wpos.rarefactionHead) * 0.5 };
});

const R0 = runs.map(r => { const o = Object.assign({}, r); delete o.prof; return o; });
const asym = orders.filter(o => o.from >= 100 && o.to <= 800);
const ordersInRange = asym.every(o => o.rho >= 0.4 && o.rho <= 1.1);
const summary = {
  method: 'lax-friedrichs', experiment: 'sod-t02', t: T, CFL: 0.9,
  exact_star: st, exact_waves: wpos,
  runs: R0, orders,
  passes: {
    stability: runs.every(r => !r.nan && !r.diverged && r.maxCfl <= 0.9 + 1e-12 && r.minRho > 0 && r.minP > 0),
    conservation_mass_energy: runs.every(r => r.cons.maxRelMass <= 1e-12 && r.cons.maxRelEnergy <= 1e-12),
    conservation_momentum_0_9t: runs.every(r => r.cons.relMomVs09tEnd <= 1e-12),
    L1_monotone_decrease: runs.every((r, i) => i === 0 || (r.L1.rho < runs[i - 1].L1.rho && r.L1.u < runs[i - 1].L1.u && r.L1.p < runs[i - 1].L1.p)),
    order_rho_100_800_in_0_4_to_1_1: ordersInRange,
    engineering_band_L1rho: bandChecks.every(b => b.pass),
    waves_N200: Object.values(waveChecks[200]).every(w => w.pass),
    waves_N400: Object.values(waveChecks[400]).every(w => w.pass),
    waves_shock_contact_N200: waveChecks[200].shock.pass && waveChecks[200].contact.pass,
    waves_rarefaction_N200: waveChecks[200].rarefactionHead.pass && waveChecks[200].rarefactionTail.pass,
    plateaux_N400_2pct: Object.values(plat[400]).every(w => w.pass),
    independent_LF_agrees: indep.pass
  },
  registered_energy_total: R['sod-totals'].fn(0, 0).energy, analytic_energy_total: 1.375,
  bandChecks, waveChecks, estimatorRobustness, plateaux: plat, oddeven, independent: indep, cflInfo, continuation: cont,
  wall_s: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(summary, null, 1));
