#!/usr/bin/env node
/* Reviewer check: hll-swe @ swe-wet (Stoker wet-bed dam break, SWASHES 4.1.1 set-up, t = 6 s).
 * Reviewer: reviewer-hll-swe-swe-wet-r1, round 1, 2026-10-13. Does not modify the method or references.
 * Usage: node verification/checks/hll-swe@swe-wet.check.js     (prints a JSON summary on stdout)
 *
 * Protocol: hl = 0.005, hr = 0.001, x0 = 5, L = 10, g = 9.81, CFL = 0.9 (method default), tEnd = 6 (the method
 * clips the last step onto t = 6). N = 100 ... 6400. Only the public API is used (create/step/probe/metrics/diverged).
 * Metrics:
 *   relL1(h) = sum|h_i - h_ex(x_i)| dx / sum h_ex(x_i) dx  at cell centres x_i (as in references/swe-dambreak.js rationale);
 *              cell-average exact (16-point midpoint sub-quadrature) reported as info.
 *   plateau h_m, u_m: cell nearest the middle of the exact plateau [x_B, x_C].
 *   shock position: linear-interpolated crossing of h = (h_m + h_r)/2 right of the plateau middle.
 *   mass: vs x0 hl + (L-x0) hr = 0.03 m^2 and vs the method's boundary-flux bookkeeping;
 *   momentum: vs g/2 (hl^2 - hr^2) t (swe-dambreak-totals; valid while waves are inside the domain);
 *   energy: E = int(h u^2/2 + g h^2/2) must not increase (u = 0 at both ends so no boundary energy flux);
 *           numeric loss compared (info) with the exact Stoker loss from quadrature of the exact profile.
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['hll-swe'], verification: false });
const M = LAB.methods['hll-swe'];
const R = LAB.references;
const wall0 = Date.now();

const P = { hl: 0.005, hr: 0.001, x0: 5, L: 10, g: 9.81 };
const T = 6;
const stoker = R['swe-dambreak-stoker'].fn;
const st = stoker.state(P);
const hmRef = R['swe-stoker-hm-swashes'];
const totRef = R['swe-dambreak-totals'];

/* ---- independent re-derivation of the middle state (reviewer): 1-rarefaction integral curve
 *      u = 2(sqrt(g hl) - sqrt(g h)) intersected with 2-shock Hugoniot locus u = (h - hr) sqrt(g (h+hr)/(2 h hr)), bisection. */
function indepHm() {
  const g = P.g, f = h => 2 * (Math.sqrt(g * P.hl) - Math.sqrt(g * h)) - (h - P.hr) * Math.sqrt(g * (h + P.hr) / (2 * h * P.hr));
  let a = P.hr, b = P.hl;
  for (let i = 0; i < 200; i++) { const m = 0.5 * (a + b); if (f(m) > 0) a = m; else b = m; }
  const hm = 0.5 * (a + b), um = 2 * (Math.sqrt(g * P.hl) - Math.sqrt(g * hm));
  const s = (hm * um) / (hm - P.hr);                       // RH mass
  const momRes = s * (hm * um) - (hm * um * um + 0.5 * g * hm * hm - 0.5 * g * P.hr * P.hr); // RH momentum residual
  return { hm, um, s, momRes };
}
const ind = indepHm();
const refSanity = {
  hm_reference: st.hm, hm_reviewer: ind.hm, hm_orchestrator: 0.0025393571723,
  rel_ref_vs_reviewer: Math.abs(st.hm - ind.hm) / ind.hm,
  rel_ref_vs_orchestrator: Math.abs(st.hm - 0.0025393571723) / 0.0025393571723,
  um_reference: st.um, um_reviewer: ind.um,
  shock_speed_reference: st.speedC, shock_speed_RH: ind.s, RH_momentum_residual: ind.momRes,
  hmRef_registered_value: hmRef.value
};
refSanity.pass = refSanity.rel_ref_vs_reviewer < 1e-9 && refSanity.rel_ref_vs_orchestrator < 1e-9 &&
  Math.abs(st.speedC - ind.s) / ind.s < 1e-9 && Math.abs(hmRef.value - st.hm) / st.hm < 1e-12;

const xA = P.x0 + st.speedA * T, xB = P.x0 + st.speedB * T, xC = P.x0 + st.speedC * T;

function exactEnergy(n) {      // midpoint quadrature of exact energy at t = T on [0, L]
  let e = 0; const dx = P.L / n;
  for (let i = 0; i < n; i++) { const s = stoker((i + 0.5) * dx, T, P); e += 0.5 * s.h * s.u * s.u + 0.5 * P.g * s.h * s.h; }
  return e * dx;
}
const E0exact = 0.5 * P.g * (P.x0 * P.hl * P.hl + (P.L - P.x0) * P.hr * P.hr);
const E6exact = exactEnergy(2e6);

function metric(sim, key) { return sim.metrics().find(m => m.key === key).value; }

function run(N) {
  const sim = M.create('swe-dambreak', H.params('hll-swe', 'swe-dambreak', Object.assign({}, P, { N, CFL: 0.9, tEnd: T })));
  const dx = P.L / N;
  const tot0 = sim.probe('totals');
  let Eprev = metric(sim, 'energy');
  const E0 = Eprev;
  let maxMassDrift = 0, maxMomErr = 0, energyIncrease = 0, maxCFL = 0, minH = Infinity, nan = false, steps = 0;
  while (sim.t < T) {
    sim.step(); steps++;
    if (sim.diverged()) { nan = true; break; }
    const tt = sim.probe('totals');
    maxMassDrift = Math.max(maxMassDrift, Math.abs(tt.mass - 0.03) / 0.03);
    const mref = totRef.fn(0, sim.t, P).momentum;
    maxMomErr = Math.max(maxMomErr, Math.abs(tt.momentum - mref) / Math.max(mref, 1e-300));
    const E = metric(sim, 'energy');
    energyIncrease = Math.max(energyIncrease, (E - Eprev) / E0);
    Eprev = E;
    maxCFL = Math.max(maxCFL, metric(sim, 'cfl'));
    minH = Math.min(minH, metric(sim, 'hmin'));
    if (steps > 1e7) break;
  }
  const pr = sim.probe('profile');
  let l1 = 0, l1u = 0, nrm = 0, nrmu = 0, l1avg = 0, nrmavg = 0;
  for (let i = 0; i < N; i++) {
    const ex = stoker(pr.x[i], T, P);
    l1 += Math.abs(pr.h[i] - ex.h); nrm += ex.h;
    l1u += Math.abs(pr.u[i] - ex.u); nrmu += Math.abs(ex.u);
    let av = 0; for (let k = 0; k < 16; k++) av += stoker(i * dx + (k + 0.5) * dx / 16, T, P).h;
    av /= 16; l1avg += Math.abs(pr.h[i] - av); nrmavg += av;
  }
  // plateau: cell nearest the middle of [xB, xC]
  const xm = 0.5 * (xB + xC);
  const im = Math.min(N - 1, Math.max(0, Math.floor(xm / dx)));
  const hPl = pr.h[im], uPl = pr.u[im];
  // shock: crossing of (hm + hr)/2 searching rightwards from the plateau middle
  const hc = 0.5 * (st.hm + P.hr);
  let xs = NaN;
  for (let i = im; i < N - 1; i++) {
    if (pr.h[i] >= hc && pr.h[i + 1] < hc) { xs = pr.x[i] + (pr.h[i] - hc) / (pr.h[i] - pr.h[i + 1]) * dx; break; }
  }
  // shock width: cells with h strictly between hr + 10% and hr + 90% of the jump
  let width = 0;
  for (let i = im; i < N; i++) { const f = (pr.h[i] - P.hr) / (st.hm - P.hr); if (f > 0.1 && f < 0.9) width++; }
  const tot = sim.probe('totals');
  return {
    N, dx, steps, t: sim.t, landed: sim.t === T, nan, diverged: sim.diverged(),
    relL1_h: l1 / nrm, relL1_h_cellavg: l1avg / nrmavg, relL1_u: l1u / nrmu,
    plateau: { x: pr.x[im], h: hPl, relerr_h: Math.abs(hPl - st.hm) / st.hm, u: uPl, relerr_u: Math.abs(uPl - st.um) / st.um },
    shock: { x: xs, exact: xC, err: xs - xC, err_cells: (xs - xC) / dx, width10_90: width },
    mass: { final: tot.mass, initial: tot0.mass, maxRelDrift: maxMassDrift, methodDrift: metric(sim, 'dmass') },
    momentum: { final: tot.momentum, exact: totRef.fn(0, T, P).momentum, maxRelErr: maxMomErr },
    energy: { E0, E6: Eprev, relLoss: 1 - Eprev / E0, maxRelIncreasePerStep: energyIncrease },
    maxCFL, minH, clips: metric(sim, 'clips')
  };
}

const Ns = [100, 200, 400, 800, 1600, 3200, 6400];
const runs = Ns.map(run);
const orders = [];
for (let k = 1; k < runs.length; k++) {
  orders.push({ N: runs[k - 1].N + '->' + runs[k].N,
    h: Math.log2(runs[k - 1].relL1_h / runs[k].relL1_h), u: Math.log2(runs[k - 1].relL1_u / runs[k].relL1_u) });
}
const byN = n => runs.find(r => r.N === n);
const band = R['swe-dambreak-stoker'].tolerance.value;
const tolHm = hmRef.tolerance.value;

const gaps = [];
function gap(quantity, value, tolerance, unit, pass) { gaps.push({ quantity, value, tolerance, unit, pass: !!pass }); }
gap('relL1(h) N=200', byN(200).relL1_h, band['first-order N=200'], 'rel L1 (engineering band)', byN(200).relL1_h <= band['first-order N=200']);
gap('relL1(h) N=400', byN(400).relL1_h, band['first-order N=400'], 'rel L1 (engineering band)', byN(400).relL1_h <= band['first-order N=400']);
[200, 400, 800].forEach(n => gap('plateau h_m N=' + n, byN(n).plateau.relerr_h, tolHm, 'rel', byN(n).plateau.relerr_h <= tolHm));
gap('plateau u_m N=400 (reviewer: same 1% band as h_m)', byN(400).plateau.relerr_u, tolHm, 'rel', byN(400).plateau.relerr_u <= tolHm);
const minOrder = Math.min(...orders.map(o => o.h));
gap('min observed relL1(h) order N=100..6400 (reviewer window [0.5, 1.05])', minOrder, 0.5, 'order (lower bound)',
  minOrder >= 0.5 && Math.max(...orders.map(o => o.h)) <= 1.05);
const maxMass = Math.max(...runs.map(r => r.mass.maxRelDrift));
const maxMom = Math.max(...runs.map(r => r.momentum.maxRelErr));
gap('mass drift vs 0.03 m^2, max over all runs/steps', maxMass, totRef.tolerance.value, 'rel', maxMass <= totRef.tolerance.value);
gap('momentum vs g/2 (hl^2-hr^2) t, max over all runs/steps', maxMom, totRef.tolerance.value, 'rel', maxMom <= totRef.tolerance.value);
[200, 400, 800].forEach(n => {
  const s = byN(n).shock;
  gap('shock position N=' + n + ' (reviewer: |err| <= 1 dx = ' + byN(n).dx + ' m)', Math.abs(s.err), byN(n).dx, 'm', Math.abs(s.err) <= byN(n).dx);
});

const stability = {
  anyNaN: runs.some(r => r.nan || r.diverged), maxCFL: Math.max(...runs.map(r => r.maxCFL)),
  minH: Math.min(...runs.map(r => r.minH)), clips: runs.reduce((a, r) => a + r.clips, 0),
  allLanded: runs.every(r => r.landed), maxEnergyIncreasePerStep: Math.max(...runs.map(r => r.energy.maxRelIncreasePerStep))
};
stability.pass = !stability.anyNaN && stability.maxCFL <= 0.9 + 1e-12 && stability.minH > 0 && stability.clips === 0 && stability.allLanded;
const energy = {
  E0_exact: E0exact, E6_exact: E6exact, exactRelLoss: 1 - E6exact / E0exact,
  numericRelLoss: runs.map(r => ({ N: r.N, loss: r.energy.relLoss, excessOverExact: r.energy.relLoss - (1 - E6exact / E0exact) })),
  monotone: stability.maxEnergyIncreasePerStep <= 1e-14
};

const out = {
  check: 'hll-swe@swe-wet', reviewer: 'reviewer-hll-swe-swe-wet-r1', round: 1,
  config: Object.assign({}, P, { tEnd: T, CFL: 0.9, Ns }),
  exactWaves: { xA, xB, xC, hm: st.hm, um: st.um, shockSpeed: st.speedC },
  referenceSanity: refSanity,
  runs, orders, energy, stability, gaps,
  allGapsPass: gaps.every(g => g.pass),
  wallSeconds: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(out, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(6) : v), 2));
