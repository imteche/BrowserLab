#!/usr/bin/env node
/* Reviewer check: hllc-godunov @ sod-t02 (Sod shock tube, profiles at t = 0.2).
 * Reviewer: reviewer-hllc-godunov-sod-t02-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/hllc-godunov@sod-t02.check.js
 * Prints a JSON summary on stdout.
 *
 * Metrics follow references/sod.js:
 *   L1(q) = sum_i |q_i - q_exact(x_i, 0.2)| dx   (cell average vs exact value at cell centre, x_i = (i+1/2)dx)
 *   observed order p = log2(L1(N)/L1(2N))
 *   star plateaus read at the cell nearest the middle of each exact plateau (rho*_L, rho*_R, p*, u*)
 *   wave positions: shock = p crossing (p*+pR)/2; contact = rho crossing (rho*L+rho*R)/2;
 *                   rarefaction head/tail = intersection of an LSQ line fitted to u in the fan interior with u=0 / u=u*
 *   totals vs sod-totals: mass 0.5625, energy 2.75, momentum 0.9 t
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['hllc-godunov', 'lax-friedrichs'], verification: false });
const M = LAB.methods['hllc-godunov'];
const R = LAB.references;
const exact = R['sod-exact-profile'].fn;
const T = 0.2;
const wall0 = Date.now();

function run(N, extra, methodId) {
  methodId = methodId || 'hllc-godunov';
  const sim = LAB.methods[methodId].create('sod', H.params(methodId, 'sod', Object.assign({ N: N, tEnd: T }, extra || {})));
  let maxCfl = 0, minRho = Infinity, minP = Infinity, nan = false, div = false;
  let steps = 0;
  while (sim.t < T - 1e-14 && steps < 1e6) {
    sim.step(); steps++;
    if (methodId === 'hllc-godunov') {
      const m = {}; sim.metrics().forEach(r => { m[r.key] = r.value; });
      if (sim.t < T) maxCfl = Math.max(maxCfl, m.cfl); // the clipped last step has smaller CFL
      minRho = Math.min(minRho, m.rhomin); minP = Math.min(minP, m.pmin);
      if (!isFinite(m.rhomin) || !isFinite(m.pmin)) { nan = true; break; }
      if (sim.diverged()) { div = true; break; }
    }
  }
  return { sim, steps, maxCfl, minRho, minP, nan, diverged: div || sim.diverged() };
}

function l1(pr, N, params) {
  const dx = 1 / N; let er = 0, eu = 0, ep = 0;
  for (let i = 0; i < N; i++) {
    const e = exact(pr.x[i], T, params);
    er += Math.abs(pr.rho[i] - e.rho); eu += Math.abs(pr.u[i] - e.u); ep += Math.abs(pr.p[i] - e.p);
  }
  return { rho: er * dx, u: eu * dx, p: ep * dx };
}

const st = exact.star();
const wp = exact.wavePositions(T);
const nearest = (pr, x) => { let b = 0; for (let i = 0; i < pr.x.length; i++) if (Math.abs(pr.x[i] - x) < Math.abs(pr.x[b] - x)) b = i; return b; };
function crossing(x, y, level, lo, hi) { // first crossing of level in [lo,hi], linear interpolation
  for (let i = 0; i + 1 < x.length; i++) {
    if (x[i] < lo || x[i + 1] > hi) continue;
    if ((y[i] - level) * (y[i + 1] - level) <= 0 && y[i] !== y[i + 1]) return x[i] + (level - y[i]) * (x[i + 1] - x[i]) / (y[i + 1] - y[i]);
  }
  return NaN;
}
function wavesOf(pr) {
  const shock = crossing(pr.x, pr.p, 0.5 * (st.p + 0.1), 0.75, 0.95);
  const contact = crossing(pr.x, pr.rho, 0.5 * (st.rhoL + st.rhoR), 0.6, 0.78);
  // LSQ line for u in the fan interior (exact u is linear in x there)
  const a = wp.rarefactionHead + 0.04, b = wp.rarefactionTail - 0.04;
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < pr.x.length; i++) if (pr.x[i] > a && pr.x[i] < b) { n++; sx += pr.x[i]; sy += pr.u[i]; sxx += pr.x[i] ** 2; sxy += pr.x[i] * pr.u[i]; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
  return { shock, contact, rarefactionHead: -icpt / slope, rarefactionTail: (st.u - icpt) / slope, fanSlope: slope, fanSlopeExact: 2 / 2.4 / T };
}
function width(pr, q, lo, hi, qa, qb) { // number of cells with q strictly between 10% and 90% of the jump qa->qb in [lo,hi]
  let c = 0; const l = Math.min(qa, qb) + 0.1 * Math.abs(qa - qb), h = Math.max(qa, qb) - 0.1 * Math.abs(qa - qb);
  for (let i = 0; i < pr.x.length; i++) if (pr.x[i] > lo && pr.x[i] < hi && pr[q][i] > l && pr[q][i] < h) c++;
  return c;
}

/* ---- (c1) L1 errors and convergence (Davis speeds, CFL 0.9 = method defaults; Einfeldt info) */
const band = R['sod-exact-profile'].tolerance.value;
const Ns = [100, 200, 400, 800, 1600, 3200, 6400];
const conv = { davis: [], einfeldt: [] };
const runs = {};
for (const sp of [0, 1]) {
  for (const N of Ns) {
    const r = run(N, { speeds: sp, CFL: 0.9 });
    const pr = r.sim.probe('profile');
    const e = l1(pr, N);
    const tot = r.sim.probe('totals');
    const row = { N, steps: r.steps, t_end: r.sim.t, L1: e, maxCfl: r.maxCfl, minRho: r.minRho, minP: r.minP, nan: r.nan, diverged: r.diverged,
      mass: tot.mass, momentum: tot.momentum, energy: tot.energy };
    if (band['first-order N=' + N] !== undefined) { row.band = band['first-order N=' + N]; row.pass = e.rho <= row.band; }
    (sp ? conv.einfeldt : conv.davis).push(row);
    if (sp === 0) runs[N] = { r, pr };
  }
}
for (const k of ['davis', 'einfeldt']) {
  const a = conv[k];
  conv[k + '_orders'] = a.slice(1).map((r, i) => ({ from: a[i].N, to: r.N,
    rho: Math.log2(a[i].L1.rho / r.L1.rho), u: Math.log2(a[i].L1.u / r.L1.u), p: Math.log2(a[i].L1.p / r.L1.p) }));
}
// reviewer convergence criterion (documented): L1(rho) strictly decreasing and every observed order in [0.5, 1.05]
// (first-order scheme with a contact: theory/calibration ~0.5-0.7; >1.05 would be suspicious for a first-order method)
const ordD = conv.davis_orders;
const convPass = conv.davis.every((r, i) => i === 0 || r.L1.rho < conv.davis[i - 1].L1.rho) &&
  ordD.every(o => o.rho >= 0.5 && o.rho <= 1.05 && o.u >= 0.5 && o.p >= 0.5);

/* ---- (a) conservation vs sod-totals (rel 1e-12), every N */
const tolTot = R['sod-totals'].tolerance.value;
const totRefRaw = R['sod-totals'].fn(0, T);
// REFERENCE DEFECT (reviewer finding): sod-totals states energy = 2.75, but its own derivation
// 0.5*pL/(g-1) + 0.5*pR/(g-1) = 0.5*2.5 + 0.5*0.25 = 1.375 (2.75 omits the half-domain widths; mass 0.5625 does include them).
// Energy flux at both ends is u(E+p) = 0 while the waves stay inside [0,1], so total energy is constant = 1.375.
// We test against the value recomputed from the initial data (same derivation, same 1e-12 tolerance) and also report the raw comparison.
const P0 = LAB.references['sod-exact-profile'].fn.defaults, g = P0.gamma;
const energyDerived = P0.x0 * (P0.pL / (g - 1) + 0.5 * P0.rhoL * P0.uL * P0.uL) + (1 - P0.x0) * (P0.pR / (g - 1) + 0.5 * P0.rhoR * P0.uR * P0.uR);
const totRef = { mass: totRefRaw.mass, momentum: totRefRaw.momentum, energy: energyDerived };
const cons = conv.davis.concat(conv.einfeldt).map(r => ({ N: r.N,
  mass_rel: Math.abs(r.mass - totRef.mass) / totRef.mass,
  energy_rel: Math.abs(r.energy - totRef.energy) / totRef.energy,
  momentum_rel: Math.abs(r.momentum - totRef.momentum) / totRef.momentum,
  energy_rel_vs_raw_reference_2p75: Math.abs(r.energy - totRefRaw.energy) / totRefRaw.energy }));
const consMax = { mass: Math.max(...cons.map(c => c.mass_rel)), energy: Math.max(...cons.map(c => c.energy_rel)), momentum: Math.max(...cons.map(c => c.momentum_rel)) };
const consPass = consMax.mass <= tolTot && consMax.energy <= tolTot && consMax.momentum <= tolTot;

/* ---- (b) stability / positivity / CFL */
const all = conv.davis.concat(conv.einfeldt);
const stab = { anyNaN: all.some(r => r.nan), anyDiverged: all.some(r => r.diverged), minRho: Math.min(...all.map(r => r.minRho)),
  minP: Math.min(...all.map(r => r.minP)), maxCfl: Math.max(...all.map(r => r.maxCfl)), allLandOnT: all.every(r => r.t_end === T) };
stab.pass = !stab.anyNaN && !stab.anyDiverged && stab.minRho > 0 && stab.minP > 0 && stab.maxCfl <= 0.9 + 1e-12;
// CFL sweep info: C = 1.0 (method's stated bound) at N = 400
const c1 = run(400, { CFL: 1.0 });
stab.cfl1_N400 = { nan: c1.nan, diverged: c1.diverged, minRho: c1.minRho, minP: c1.minP, L1rho: l1(c1.sim.probe('profile'), 400).rho };

/* ---- (c2) star plateaus at N = 400 (2% band for first order, reference NOTE) */
const pr400 = runs[400].pr;
const xL = 0.5 * (wp.rarefactionTail + wp.contact), xR = 0.5 * (wp.contact + wp.shock);
const iL = nearest(pr400, xL), iR = nearest(pr400, xR);
const plateau = {
  xL: pr400.x[iL], xR: pr400.x[iR],
  rhoStarL: { got: pr400.rho[iL], ref: R['sod-rhostarL'].value },
  rhoStarR: { got: pr400.rho[iR], ref: R['sod-rhostarR'].value },
  pStar_left: { got: pr400.p[iL], ref: R['sod-pstar'].value }, pStar_right: { got: pr400.p[iR], ref: R['sod-pstar'].value },
  uStar_left: { got: pr400.u[iL], ref: R['sod-ustar'].value }, uStar_right: { got: pr400.u[iR], ref: R['sod-ustar'].value }
};
for (const k of Object.keys(plateau)) if (plateau[k].ref) { plateau[k].rel = Math.abs(plateau[k].got - plateau[k].ref) / plateau[k].ref; plateau[k].pass = plateau[k].rel <= 0.02; }

/* ---- (c3) wave positions at N = 200 (tol 0.01) and N = 400 (info) */
const waveRef = { shock: R['sod-x-shock'].value, contact: R['sod-x-contact'].value, rarefactionHead: R['sod-x-rarefaction-head'].value, rarefactionTail: R['sod-x-rarefaction-tail'].value };
const waves = {};
for (const N of [200, 400, 1600]) {
  const w = wavesOf(runs[N].pr); waves[N] = { measured: w, err: {} };
  for (const k in waveRef) waves[N].err[k] = Math.abs(w[k] - waveRef[k]);
}
const wavePass = Object.keys(waveRef).every(k => waves[200].err[k] <= 0.01);
// locator-robustness for the rarefaction kinks (no locator is prescribed for kinks): LSQ windows trimmed by 10/25/35 % of the fan width,
// plus the max of -u_xx near the tail
const kinkRobust = {};
for (const N of [200, 400, 800]) {
  const pr = N === 800 ? runs[800].pr : runs[N].pr; const L = wp.rarefactionTail - wp.rarefactionHead; const rows = [];
  for (const f of [0.1, 0.25, 0.35]) {
    const a = wp.rarefactionHead + f * L, b = wp.rarefactionTail - f * L;
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < N; i++) if (pr.x[i] > a && pr.x[i] < b) { n++; sx += pr.x[i]; sy += pr.u[i]; sxx += pr.x[i] ** 2; sxy += pr.x[i] * pr.u[i]; }
    const s = (n * sxy - sx * sy) / (n * sxx - sx * sx), c = (sy - s * sx) / n;
    rows.push({ trim: f, headErr: -c / s - wp.rarefactionHead, tailErr: (st.u - c) / s - wp.rarefactionTail, fanSlope: s });
  }
  let best = 0, bx = 0;
  for (let i = 1; i < N - 1; i++) { if (pr.x[i] < 0.42 || pr.x[i] > 0.56) continue; const d2 = -(pr.u[i + 1] - 2 * pr.u[i] + pr.u[i - 1]); if (d2 > best) { best = d2; bx = pr.x[i]; } }
  kinkRobust[N] = { lsq: rows, tailErr_maxCurvature: bx - wp.rarefactionTail };
}

/* ---- contact resolution vs Lax-Friedrichs (info + structural) */
const contactRes = {};
for (const N of [200, 400, 1600]) {
  const prH = runs[N].pr;
  const lf = run(N, { CFL: 0.9 }, 'lax-friedrichs'); const prL = lf.sim.probe('profile');
  contactRes[N] = {
    hllc_contact_cells: width(prH, 'rho', wp.contact - 0.08, wp.contact + 0.06, st.rhoL, st.rhoR),
    lf_contact_cells: width(prL, 'rho', wp.contact - 0.08, wp.contact + 0.06, st.rhoL, st.rhoR),
    hllc_shock_cells: width(prH, 'rho', wp.contact + 0.06, 0.95, st.rhoR, 0.125),
    lf_shock_cells: width(prL, 'rho', wp.contact + 0.06, 0.95, st.rhoR, 0.125),
    hllc_L1rho: l1(prH, N).rho, lf_L1rho: l1(prL, N).rho
  };
}
// stationary isolated contact: HLLC should keep it exact (structural property of the contact-restoring solver)
const sc = run(200, { rhoL: 1, uL: 0, pL: 1, rhoR: 0.125, uR: 0, pR: 1 });
const scp = sc.sim.probe('profile');
let scErr = 0; for (let i = 0; i < 200; i++) scErr = Math.max(scErr, Math.abs(scp.rho[i] - (scp.x[i] < 0.5 ? 1 : 0.125)), Math.abs(scp.u[i]), Math.abs(scp.p[i] - 1));
const stationaryContact = { N: 200, maxErr: scErr, pass: scErr < 1e-12 };

/* ---- info: modified Sod (sonic rarefaction, uL=0.75, x0=0.3) vs its band */
const ms = R['sod-modified-exact-profile'];
const modSod = [100, 400].map(N => {
  const p = { rhoL: 1, uL: 0.75, pL: 1, rhoR: 0.125, uR: 0, pR: 0.1, x0: 0.3 };
  const r = run(N, p); const pr = r.sim.probe('profile');
  const dx = 1 / N; let e = 0, jump = 0;
  for (let i = 0; i < N; i++) e += Math.abs(pr.rho[i] - ms.fn(pr.x[i], T).rho) * dx;
  for (let i = 0; i + 1 < N; i++) if (pr.x[i] > 0.2 && pr.x[i] < 0.45) jump = Math.max(jump, Math.abs(pr.rho[i + 1] - pr.rho[i]));
  return { N, L1rho: e, band: ms.tolerance.value['first-order N=' + N], maxAdjacentRhoJumpInFan: jump, nan: r.nan };
});

const summary = {
  method: 'hllc-godunov', experiment: 'sod-t02', t: T,
  exactStar: st, exactWaves: wp,
  L1: conv, convergencePass: convPass,
  conservation: { perRun: cons, max: consMax, tol: tolTot, pass: consPass, energyDerived, energyRawReference: totRefRaw.energy,
    note: 'sod-totals energy 2.75 is an arithmetic error in the reference; derived value 1.375 used' },
  stability: stab, plateau, waves, wavePass, kinkRobust, contactRes, stationaryContact, modifiedSodInfo: modSod,
  passes: {
    'L1 rho N=100/200/400 within band': conv.davis.filter(r => r.band).every(r => r.pass),
    convergence: convPass, conservation: consPass, stability: stab.pass,
    plateaus: Object.keys(plateau).filter(k => plateau[k].ref).every(k => plateau[k].pass),
    'wave positions N=200': wavePass, 'stationary contact exact': stationaryContact.pass
  },
  wall_s: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(summary, null, 1));
