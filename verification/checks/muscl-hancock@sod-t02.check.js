#!/usr/bin/env node
/* Reviewer check: muscl-hancock @ sod-t02 (Sod shock tube, profiles at t = 0.2).
 * Reviewer: reviewer-muscl-hancock-sod-t02-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/muscl-hancock@sod-t02.check.js
 * Prints a JSON summary on stdout.
 *
 * Metrics follow references/sod.js:
 *   L1(q) = sum_i |q_i - q_exact(x_i, 0.2)| dx   (cell average vs exact value at cell centre, x_i = (i+1/2)dx)
 *   observed order p = log2(L1(N)/L1(2N))
 *   smooth-region L1: same sum restricted to cells farther than a FIXED distance (0.04) from every
 *     wave/kink (rarefaction head, tail, contact, shock); expected to approach order 2 for a second-order scheme
 *   star plateaus read at the cell nearest the middle of each exact plateau (rho*_L, rho*_R, p*, u*), band 1% (second order, ref NOTE)
 *   wave positions: shock = p crossing (p*+pR)/2; contact = rho crossing (rho*L+rho*R)/2;
 *                   rarefaction head/tail = intersection of an LSQ line fitted to u in the fan interior with u=0 / u=u*
 *   oscillations: total variation TV(q) = sum |q_{i+1}-q_i| vs exact TV (rho 0.875, u 2u*, p 0.9), and over/undershoots
 *     beyond the local range of the exact solution
 *   totals vs sod-totals: mass 0.5625, energy (derived) 1.375, momentum 0.9 t
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['muscl-hancock', 'hllc-godunov'], verification: false });
const R = LAB.references;
const exact = R['sod-exact-profile'].fn;
const T = 0.2;
const wall0 = Date.now();
const MID = 'muscl-hancock';

function run(N, extra, methodId) {
  methodId = methodId || MID;
  const sim = LAB.methods[methodId].create('sod', H.params(methodId, 'sod', Object.assign({ N: N, tEnd: T }, extra || {})));
  let maxCfl = 0, minRho = Infinity, minP = Infinity, nan = false, div = false, maxFallback = 0, maxTVrho = 0;
  let steps = 0;
  while (sim.t < T - 1e-14 && steps < 1e6) {
    sim.step(); steps++;
    const m = {}; sim.metrics().forEach(r => { m[r.key] = r.value; });
    if (m.cfl !== undefined && sim.t < T) maxCfl = Math.max(maxCfl, m.cfl); // clipped last step excluded
    if (m.rhomin !== undefined) { minRho = Math.min(minRho, m.rhomin); minP = Math.min(minP, m.pmin); }
    if (m.fallback !== undefined) maxFallback = Math.max(maxFallback, m.fallback);
    if (methodId === MID && (N <= 400) && steps % 1 === 0) {
      const pr = sim.probe('profile'); let tv = 0; for (let i = 0; i + 1 < N; i++) tv += Math.abs(pr.rho[i + 1] - pr.rho[i]);
      maxTVrho = Math.max(maxTVrho, tv);
    }
    if (!isFinite(m.rhomin) || !isFinite(m.pmin)) { nan = true; break; }
    if (sim.diverged()) { div = true; break; }
  }
  return { sim, steps, maxCfl, minRho, minP, nan, maxFallback, maxTVrhoOverTime: maxTVrho, diverged: div || sim.diverged() };
}

const st = exact.star();
const wp = exact.wavePositions(T);
const waveXs = [wp.rarefactionHead, wp.rarefactionTail, wp.contact, wp.shock];

function l1(pr, N, opts) {
  const dx = 1 / N; let er = 0, eu = 0, ep = 0;
  const excl = opts && opts.exclude;
  for (let i = 0; i < N; i++) {
    if (excl && waveXs.some(w => Math.abs(pr.x[i] - w) < excl)) continue;
    const e = exact(pr.x[i], T);
    er += Math.abs(pr.rho[i] - e.rho); eu += Math.abs(pr.u[i] - e.u); ep += Math.abs(pr.p[i] - e.p);
  }
  return { rho: er * dx, u: eu * dx, p: ep * dx };
}
function orders(arr, key) {
  return arr.slice(1).map((r, i) => ({ from: arr[i].N, to: r.N,
    rho: Math.log2(arr[i][key].rho / r[key].rho), u: Math.log2(arr[i][key].u / r[key].u), p: Math.log2(arr[i][key].p / r[key].p) }));
}

const nearest = (pr, x) => { let b = 0; for (let i = 0; i < pr.x.length; i++) if (Math.abs(pr.x[i] - x) < Math.abs(pr.x[b] - x)) b = i; return b; };
function crossing(x, y, level, lo, hi) {
  for (let i = 0; i + 1 < x.length; i++) {
    if (x[i] < lo || x[i + 1] > hi) continue;
    if ((y[i] - level) * (y[i + 1] - level) <= 0 && y[i] !== y[i + 1]) return x[i] + (level - y[i]) * (x[i + 1] - x[i]) / (y[i + 1] - y[i]);
  }
  return NaN;
}
function fanFit(pr, f) {
  const L = wp.rarefactionTail - wp.rarefactionHead;
  const a = wp.rarefactionHead + f * L, b = wp.rarefactionTail - f * L;
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < pr.x.length; i++) if (pr.x[i] > a && pr.x[i] < b) { n++; sx += pr.x[i]; sy += pr.u[i]; sxx += pr.x[i] ** 2; sxy += pr.x[i] * pr.u[i]; }
  const s = (n * sxy - sx * sy) / (n * sxx - sx * sx), c = (sy - s * sx) / n;
  return { head: -c / s, tail: (st.u - c) / s, slope: s };
}
function wavesOf(pr) {
  const shock = crossing(pr.x, pr.p, 0.5 * (st.p + 0.1), 0.75, 0.95);
  const contact = crossing(pr.x, pr.rho, 0.5 * (st.rhoL + st.rhoR), 0.6, 0.78);
  const f = fanFit(pr, 0.04 / (wp.rarefactionTail - wp.rarefactionHead)); // same 0.04 trim as hllc-godunov review
  return { shock, contact, rarefactionHead: f.head, rarefactionTail: f.tail, fanSlope: f.slope, fanSlopeExact: 2 / 2.4 / T };
}
function width(pr, q, lo, hi, qa, qb) {
  let c = 0; const l = Math.min(qa, qb) + 0.1 * Math.abs(qa - qb), h = Math.max(qa, qb) - 0.1 * Math.abs(qa - qb);
  for (let i = 0; i < pr.x.length; i++) if (pr.x[i] > lo && pr.x[i] < hi && pr[q][i] > l && pr[q][i] < h) c++;
  return c;
}
function oscill(pr) {
  const N = pr.x.length; const tv = { rho: 0, u: 0, p: 0 };
  for (const q of ['rho', 'u', 'p']) for (let i = 0; i + 1 < N; i++) tv[q] += Math.abs(pr[q][i + 1] - pr[q][i]);
  const tvEx = { rho: 1 - 0.125, u: 2 * st.u, p: 0.9 };
  // over/undershoot beyond global exact range [min,max] for each variable
  const rng = { rho: [0.125, 1], u: [0, st.u], p: [0.1, 1] };
  const over = {};
  for (const q of ['rho', 'u', 'p']) {
    let o = 0; for (let i = 0; i < N; i++) o = Math.max(o, pr[q][i] - rng[q][1], rng[q][0] - pr[q][i]);
    over[q] = o;
  }
  // local overshoot at the star plateau left of the contact (rho must stay in [rho*R, rho*L] between tail and shock)
  let locRho = 0, locU = 0, locP = 0;
  for (let i = 0; i < N; i++) {
    const x = pr.x[i];
    if (x > wp.rarefactionTail + 0.02 && x < wp.shock - 0.02) {
      locRho = Math.max(locRho, pr.rho[i] - st.rhoL, st.rhoR - pr.rho[i]);
      locU = Math.max(locU, Math.abs(pr.u[i] - st.u)); locP = Math.max(locP, Math.abs(pr.p[i] - st.p));
    }
  }
  return { TV: tv, TVexact: tvEx, TVexcessRel: { rho: tv.rho / tvEx.rho - 1, u: tv.u / tvEx.u - 1, p: tv.p / tvEx.p - 1 },
    overshootGlobal: over, starRegion: { rhoOutside: locRho, uDev: locU, pDev: locP } };
}

/* ---- (c1) L1 errors and convergence, method defaults (minmod, conserved vars, Davis, CFL 0.9) */
const band = R['sod-exact-profile'].tolerance.value;
const Ns = [100, 200, 400, 800, 1600, 3200, 6400];
const conv = [];
const runs = {};
for (const N of Ns) {
  const r = run(N, { CFL: 0.9 });
  const pr = r.sim.probe('profile');
  const tot = r.sim.probe('totals');
  const row = { N, steps: r.steps, t_end: r.sim.t, L1: l1(pr, N), L1smooth: l1(pr, N, { exclude: 0.04 }), maxCfl: r.maxCfl, minRho: r.minRho, minP: r.minP,
    nan: r.nan, diverged: r.diverged, maxFallbackCells: r.maxFallback, maxTVrhoOverTime: r.maxTVrhoOverTime || undefined,
    mass: tot.mass, momentum: tot.momentum, energy: tot.energy, osc: oscill(pr) };
  if (band['second-order N=' + N] !== undefined) { row.band = band['second-order N=' + N]; row.pass = row.L1.rho <= row.band; }
  conv.push(row); runs[N] = { r, pr };
}
const ord = orders(conv, 'L1'), ordS = orders(conv, 'L1smooth');
// Reviewer criteria (fixed before looking at results, from the task protocol hints):
//  overall L1 order (rho, u, p) for every pair in [0.6, 1.2]  (discontinuity-limited; theory for second-order
//    schemes at a linear discontinuity ~2/3, shock-dominated ~1; calibration 0.84-0.88)
//  smooth-region L1(rho) order >= 1.7 on the finest two pairs (second order in smooth regions)
const convPass = conv.every((r, i) => i === 0 || r.L1.rho < conv[i - 1].L1.rho) &&
  ord.every(o => o.rho >= 0.6 && o.rho <= 1.2 && o.u >= 0.6 && o.p >= 0.6);
const smoothTail = ordS.slice(-2);
const smoothPass = smoothTail.every(o => o.rho >= 1.7);

/* ---- (a) conservation vs sod-totals (rel 1e-12) */
const tolTot = R['sod-totals'].tolerance.value;
const totRefRaw = R['sod-totals'].fn(0, T);
// REFERENCE DEFECT (already recorded in hllc-godunov@sod-t02): sod-totals states energy 2.75; its own derivation
// 0.5*2.5 + 0.5*0.25 = 1.375. We test against the derived value with the same tolerance and report the raw comparison.
const P0 = exact.defaults, g = P0.gamma;
const energyDerived = P0.x0 * (P0.pL / (g - 1)) + (1 - P0.x0) * (P0.pR / (g - 1));
const totRef = { mass: totRefRaw.mass, momentum: totRefRaw.momentum, energy: energyDerived };
const cons = conv.map(r => ({ N: r.N,
  mass_rel: Math.abs(r.mass - totRef.mass) / totRef.mass,
  energy_rel: Math.abs(r.energy - totRef.energy) / totRef.energy,
  momentum_rel: Math.abs(r.momentum - totRef.momentum) / totRef.momentum,
  energy_rel_vs_raw_reference_2p75: Math.abs(r.energy - totRefRaw.energy) / totRefRaw.energy }));
const consMax = { mass: Math.max(...cons.map(c => c.mass_rel)), energy: Math.max(...cons.map(c => c.energy_rel)), momentum: Math.max(...cons.map(c => c.momentum_rel)) };
const consPass = consMax.mass <= tolTot && consMax.energy <= tolTot && consMax.momentum <= tolTot;

/* ---- (b) stability / positivity / CFL */
const stab = { anyNaN: conv.some(r => r.nan), anyDiverged: conv.some(r => r.diverged), minRho: Math.min(...conv.map(r => r.minRho)),
  minP: Math.min(...conv.map(r => r.minP)), maxCfl: Math.max(...conv.map(r => r.maxCfl)), allLandOnT: conv.every(r => r.t_end === T),
  maxFallbackCells: Math.max(...conv.map(r => r.maxFallbackCells)) };
stab.pass = !stab.anyNaN && !stab.anyDiverged && stab.minRho > 0 && stab.minP > 0 && stab.maxCfl <= 0.9 + 1e-12 && stab.allLandOnT;
const c1 = run(400, { CFL: 1.0 });
stab.cfl1_N400 = { nan: c1.nan, diverged: c1.diverged, minRho: c1.minRho, minP: c1.minP, maxFallback: c1.maxFallback, L1rho: l1(c1.sim.probe('profile'), 400).rho };

/* ---- (c2) star plateaus at N = 400 (1% band for second order, reference NOTE) */
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
for (const k of Object.keys(plateau)) if (plateau[k].ref) { plateau[k].rel = Math.abs(plateau[k].got - plateau[k].ref) / plateau[k].ref; plateau[k].pass = plateau[k].rel <= 0.01; }

/* ---- (c3) wave positions at N = 200 (tol 0.01) and N = 400/1600 (info) */
const waveRef = { shock: R['sod-x-shock'].value, contact: R['sod-x-contact'].value, rarefactionHead: R['sod-x-rarefaction-head'].value, rarefactionTail: R['sod-x-rarefaction-tail'].value };
const waves = {};
for (const N of [200, 400, 1600]) {
  const w = wavesOf(runs[N].pr); waves[N] = { measured: w, err: {} };
  for (const k in waveRef) waves[N].err[k] = Math.abs(w[k] - waveRef[k]);
}
const wavePass = Object.keys(waveRef).every(k => waves[200].err[k] <= 0.01);
const kinkRobust = {};
for (const N of [200, 400, 800]) {
  const pr = runs[N].pr; const rows = [];
  for (const f of [0.1, 0.25, 0.35]) { const r = fanFit(pr, f); rows.push({ trim: f, headErr: r.head - wp.rarefactionHead, tailErr: r.tail - wp.rarefactionTail, fanSlope: r.slope }); }
  let best = 0, bx = 0;
  for (let i = 1; i < N - 1; i++) { if (pr.x[i] < 0.42 || pr.x[i] > 0.56) continue; const d2 = -(pr.u[i + 1] - 2 * pr.u[i] + pr.u[i - 1]); if (d2 > best) { best = d2; bx = pr.x[i]; } }
  kinkRobust[N] = { lsq: rows, tailErr_maxCurvature: bx - wp.rarefactionTail };
}

/* ---- (d) oscillation check: TV excess and overshoots, defaults; reviewer limits:
 *   TV(rho) excess <= 1% of exact TV and global over/undershoot <= 1% of the jump (0.875 for rho, u* for u, 0.9 for p) at N = 100..1600 */
const oscRows = conv.filter(r => r.N <= 1600).map(r => ({ N: r.N, TVexcessRel: r.osc.TVexcessRel, overshootGlobal: r.osc.overshootGlobal, starRegion: r.osc.starRegion, maxTVrhoOverTime: r.maxTVrhoOverTime }));
const oscPass = oscRows.every(o => o.TVexcessRel.rho <= 0.01 && o.TVexcessRel.p <= 0.01 && o.TVexcessRel.u <= 0.01 &&
  o.overshootGlobal.rho <= 0.01 * 0.875 && o.overshootGlobal.u <= 0.01 * st.u && o.overshootGlobal.p <= 0.01 * 0.9);

/* ---- (e) structural: limiter = 2 must reproduce the repository first-order hllc-godunov (Davis) to round-off */
const red = {};
for (const N of [100, 400]) {
  const a = run(N, { limiter: 2 }).sim.probe('profile'), b = run(N, {}, 'hllc-godunov').sim.probe('profile');
  let d = 0; for (let i = 0; i < N; i++) d = Math.max(d, Math.abs(a.rho[i] - b.rho[i]), Math.abs(a.u[i] - b.u[i]), Math.abs(a.p[i] - b.p[i]));
  red[N] = { maxAbsDiff: d, L1rho_first: l1(a, N).rho };
}
const reductionPass = Object.values(red).every(r => r.maxAbsDiff < 1e-12);

/* ---- info: variants (van Leer limiter, primitive variables, Einfeldt speeds) and contact/shock widths vs first order */
const variants = {};
for (const [name, ex] of [['vanleer_cons', { limiter: 1 }], ['minmod_prim', { vars: 1 }], ['vanleer_prim', { limiter: 1, vars: 1 }], ['minmod_einfeldt', { speeds: 1 }]]) {
  variants[name] = [100, 200, 400].map(N => { const r = run(N, ex); const pr = r.sim.probe('profile');
    return { N, L1rho: l1(pr, N).rho, nan: r.nan, minRho: r.minRho, minP: r.minP, fallback: r.maxFallback, osc: oscill(pr).overshootGlobal, TVexcessRho: oscill(pr).TVexcessRel.rho }; });
}
const widths = {};
for (const N of [200, 400, 1600]) {
  const prM = runs[N].pr, prG = run(N, {}, 'hllc-godunov').sim.probe('profile');
  widths[N] = { muscl_contact: width(prM, 'rho', wp.contact - 0.08, wp.contact + 0.06, st.rhoL, st.rhoR),
    godunov_contact: width(prG, 'rho', wp.contact - 0.08, wp.contact + 0.06, st.rhoL, st.rhoR),
    muscl_shock: width(prM, 'rho', wp.contact + 0.06, 0.95, st.rhoR, 0.125), godunov_shock: width(prG, 'rho', wp.contact + 0.06, 0.95, st.rhoR, 0.125),
    L1rho_ratio_muscl_over_godunov: l1(prM, N).rho / l1(prG, N).rho };
}

/* ---- (f) genuinely smooth problems through the SAME evolution kernel (second order in smooth regions).
 * The method only accepts piecewise-constant Riemann data, so the reviewer evaluates an in-memory copy of
 * methods/muscl-hancock.js (the file on disk is NOT modified) in which ONE line is appended after the
 * initial-condition loop body: an optional hook that overwrites the cell averages. step(), predictor(), hllc()
 * and all metrics are byte-identical. The copy is registered under id 'muscl-hancock-revIC'.
 * Tests (t = 0.2, transmissive BCs, data compactly away from boundaries, 5-point Gauss cell averages):
 *   entropy wave rho = 1 + 0.5 exp(-((x-0.4)/0.05)^2), u = 1, p = 1  -> exact rho(x - t), u = 1, p = 1
 *   isentropic right-running simple wave u0 = 0.1 exp(-((x-0.3)/0.08)^2), c = 1 + 0.2u, rho = c^5, p = rho^1.4/1.4
 *     (Riemann invariant u - 5c constant; exact by characteristics x = xi + (1 + 1.2 u0(xi)) t; breaking time ~0.78 > 0.2)
 * Reviewer criterion (fixed a priori): L1(rho) order >= 1.7 on the finest two pairs (minmod and van Leer). */
const smooth = (function () {
  const fs = require('fs'), vm = require('vm'), path = require('path');
  let src = fs.readFileSync(path.join(H.ROOT, 'methods/muscl-hancock.js'), 'utf8');
  const line = 'E[i + G] = fl * UL[2] + (1 - fl) * UR[2];';
  if (src.split(line).length !== 2) return { error: 'patch anchor not found exactly once; smooth test not run' };
  src = src.replace(line, line + ' if (globalThis.__REV_IC) { var __c = globalThis.__REV_IC(a, b); R[i + G] = __c[0]; MU[i + G] = __c[1]; E[i + G] = __c[2]; }');
  src = src.replace("id: 'muscl-hancock',", "id: 'muscl-hancock-revIC',");
  vm.runInThisContext(src, { filename: 'muscl-hancock-revIC (in-memory)' });
  const Mx = LAB.methods['muscl-hancock-revIC'];
  const gq = [[-0.9061798459386640, 0.2369268850561891], [-0.5384693101056831, 0.4786286704993665], [0, 0.5688888888888889], [0.5384693101056831, 0.4786286704993665], [0.9061798459386640, 0.2369268850561891]];
  const avg = (f, a, b) => { let s = 0; for (const [x, w] of gq) s += w * f(0.5 * (a + b) + 0.5 * (b - a) * x); return 0.5 * s; };
  const gm = 1.4;
  const ent = x => 1 + 0.5 * Math.exp(-(((x - 0.4) / 0.05) ** 2));
  const sw0 = xi => 0.1 * Math.exp(-(((xi - 0.3) / 0.08) ** 2));
  const dsw0 = xi => -2 * (xi - 0.3) / 0.0064 * sw0(xi);
  const swU = (x, t) => { let xi = x - t; for (let k = 0; k < 80; k++) { const F = xi + (1 + 1.2 * sw0(xi)) * t - x, d = F / (1 + 1.2 * dsw0(xi) * t); xi -= d; if (Math.abs(d) < 1e-16) break; } return sw0(xi); };
  const swState = u => { const c = 1 + 0.2 * u, rho = Math.pow(c, 5); return [rho, u, Math.pow(rho, gm) / gm]; };
  const tests = {
    entropyWave: { ic: (a, b) => { const r = avg(ent, a, b); return [r, r, 1 / (gm - 1) + 0.5 * r]; }, rho: x => ent(x - T) },
    simpleWave: { ic: (a, b) => [avg(x => swState(sw0(x))[0], a, b), avg(x => { const s = swState(sw0(x)); return s[0] * s[1]; }, a, b),
      avg(x => { const s = swState(sw0(x)); return s[2] / (gm - 1) + 0.5 * s[0] * s[1] * s[1]; }, a, b)], rho: x => swState(swU(x, T))[0] }
  };
  const out = {};
  for (const [name, tst] of Object.entries(tests)) for (const [ln, lim] of [['minmod', 0], ['vanleer', 1]]) {
    const rows = [];
    for (const N of [50, 100, 200, 400, 800, 1600]) {
      globalThis.__REV_IC = tst.ic;
      const sim = Mx.create('sod', H.params('muscl-hancock', 'sod', { N, tEnd: T, limiter: lim }));
      globalThis.__REV_IC = null;
      while (sim.t < T - 1e-14) sim.step();
      const pr = sim.probe('profile'); let e = 0, eu = 0;
      for (let i = 0; i < N; i++) { e += Math.abs(pr.rho[i] - avg(tst.rho, i / N, (i + 1) / N)) / N; if (name === 'entropyWave') eu = Math.max(eu, Math.abs(pr.u[i] - 1), Math.abs(pr.p[i] - 1)); }
      rows.push({ N, L1rho: e, maxUPdev: name === 'entropyWave' ? eu : undefined });
    }
    const ords = rows.slice(1).map((r, i) => Math.log2(rows[i].L1rho / r.L1rho));
    out[name + '_' + ln] = { rows, orders: ords, pass: ords.slice(-2).every(o => o >= 1.7) };
  }
  out.pass = Object.values(out).every(v => v.pass);
  return out;
})();

/* ---- (g) structure of the non-monotone features (info): location/size of the largest u overshoot */
const overshootLoc = [100, 400, 1600].map(N => { const pr = runs[N].pr; let iu = 0; for (let i = 0; i < N; i++) if (pr.u[i] > pr.u[iu]) iu = i;
  return { N, uMax: pr.u[iu], x: pr.x[iu], relToUstar: pr.u[iu] / st.u - 1, distToTail: pr.x[iu] - wp.rarefactionTail }; });

/* ---- info: modified Sod (sonic rarefaction) vs its second-order band */
const ms = R['sod-modified-exact-profile'];
const modSod = [100, 400].map(N => {
  const p = { rhoL: 1, uL: 0.75, pL: 1, rhoR: 0.125, uR: 0, pR: 0.1, x0: 0.3 };
  const r = run(N, p); const pr = r.sim.probe('profile');
  const dx = 1 / N; let e = 0;
  for (let i = 0; i < N; i++) e += Math.abs(pr.rho[i] - ms.fn(pr.x[i], T).rho) * dx;
  return { N, L1rho: e, band: ms.tolerance.value['second-order N=' + N], nan: r.nan };
});

const summary = {
  method: MID, experiment: 'sod-t02', t: T, exactStar: st, exactWaves: wp,
  L1: conv.map(r => { const o = Object.assign({}, r); delete o.osc; return o; }), orders: ord, smoothOrders: ordS,
  convergencePass: convPass, smoothPass,
  conservation: { perRun: cons, max: consMax, tol: tolTot, pass: consPass, energyDerived, energyRawReference: totRefRaw.energy },
  stability: stab, plateau, waves, wavePass, kinkRobust, oscillation: oscRows, oscPass,
  firstOrderReduction: red, reductionPass, smoothTests: smooth, overshootLoc, variants, widths, modifiedSodInfo: modSod,
  passes: {
    'L1 rho N=100/200/400 within second-order band': conv.filter(r => r.band).every(r => r.pass),
    'overall convergence orders in [0.6,1.2]': convPass, 'Sod smooth-window order >= 1.7': smoothPass,
    'smooth-data tests order >= 1.7 (entropy + simple wave)': !!smooth.pass,
    conservation: consPass, stability: stab.pass,
    'plateaus (1%)': Object.keys(plateau).filter(k => plateau[k].ref).every(k => plateau[k].pass),
    'wave positions N=200': wavePass, 'oscillations (TV / overshoot <= 1%)': oscPass, 'limiter=2 == hllc-godunov': reductionPass
  },
  wall_s: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(summary, null, 1));
