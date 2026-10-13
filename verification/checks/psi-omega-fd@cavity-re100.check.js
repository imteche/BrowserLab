#!/usr/bin/env node
/* Reviewer check: psi-omega-fd @ cavity-re100 (lid-driven cavity, Re = 100, steady state).
 * Reviewer: reviewer-psi-omega-fd-cavity-re100-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node "verification/checks/psi-omega-fd@cavity-re100.check.js"
 * Prints a JSON summary on stdout (runtime ~2 min on one core).
 *
 * Protocol
 *   - Method defaults except Re = 100: central convection (scheme 0), cfl 0.8, mgCycles 10.
 *   - Primary run N = 128 (nodes coincide with Ghia's 129^2 grid, which the reference
 *     tolerances assume). Grid sequence N = 32, 64, 128 for convergence information.
 *   - March from rest until the method's residual probe (max |du|,|dv| per unit time) < 1e-9,
 *     with a hard cap t <= 200. Steadiness is also confirmed by comparing probes at the stop
 *     time with probes 5 time units earlier.
 *   - Table comparison: Ghia's tabulated coordinates are 129-grid nodes printed to 4 dp, so each
 *     is snapped to the nearest j/128 and the sim profile is linearly interpolated there (exact
 *     node lookup at N = 128). Metric max-abs over all 17 rows, tolerance from the reference.
 *   - psi_min: rel error vs -0.103423 (tol 0.03). Vortex centre: max(|dx|,|dy|) (tol 0.02).
 *   - Conservation for a psi-omega scheme: discrete divergence (central) of the velocity, the
 *     Poisson residual |lap psi + omega|, circulation integral of omega vs -U_lid*L = -1
 *     (Stokes; trapezoidal with Thom wall values, so O(h) deviation expected), and stationarity
 *     of kinetic energy at steady state. Steadiness criterion (reviewer-set): over the last ~5 time
 *     units the u-centreline changes by < 1% of the 0.02 table tolerance and psi_min by < 1% of its
 *     3% relative tolerance, so the remaining transient cannot affect any pass/fail decision.
 *     Circulation: with Thom wall vorticity and zero corner values, the trapezoidal integral equals
 *     -(1 - h) analytically at steady state; criterion |circ + 1| <= 1.01 h.
 *   - Stability: no NaN, |u| bounded, diffusion number <= 1/4, CFL <= 1, cell Peclet <= 2
 *     (method's stated criteria for central convection).
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['psi-omega-fd'], verification: false });
const M = LAB.methods['psi-omega-fd'];
const R = LAB.references;
const RE = 100, RES_TOL = 1e-9, T_CAP = 200;
const wall0 = Date.now();

const refU = R['cavity-re100-ghia-u'], refV = R['cavity-re100-ghia-v'];
const refP = R['cavity-re100-ghia-psimin'], refC = R['cavity-re100-ghia-center'];

function metricsObj(sim) { const o = {}; sim.metrics().forEach(m => { o[m.key] = m.value; }); return o; }
function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) if (x <= xs[i] + 1e-15) {
    const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return (1 - f) * ys[i - 1] + f * ys[i];
  }
  return ys[ys.length - 1];
}
const snap = c => Math.round(c * 128) / 128;

function compareTable(prof, ref, xKey, yKey) {
  let maxAbs = 0, at = null; const rows = [];
  ref.rows.forEach(r => {
    const c = snap(r[0]);
    const s = interp(prof[xKey], prof[yKey], c);
    const d = s - r[1];
    rows.push({ coord: r[0], ref: r[1], sim: +s.toFixed(6), diff: +d.toFixed(6) });
    if (Math.abs(d) > maxAbs) { maxAbs = Math.abs(d); at = r[0]; }
  });
  return { maxAbs, at, tol: ref.tolerance.value, pass: maxAbs <= ref.tolerance.value, rows };
}

function runCase(N) {
  const sim = M.create('cavity', H.params('psi-omega-fd', 'cavity', { Re: RE, N: N }));
  const t0 = Date.now();
  let nan = false, maxStab = { cfl: 0, diff: 0, pe: 0 }, maxU = 0;
  let snapPrev = null, nextSnapT = 5, snaps = [];
  while (sim.t < T_CAP) {
    sim.step();
    if (sim.steps % 50 === 0) {
      if (sim.diverged()) { nan = true; break; }
      const m = metricsObj(sim);
      maxStab.cfl = Math.max(maxStab.cfl, m.cfl); maxStab.diff = Math.max(maxStab.diff, m.diff);
      maxStab.pe = Math.max(maxStab.pe, m.pe); maxU = Math.max(maxU, m.umax);
      if (sim.t >= nextSnapT) {
        snaps.push({ t: sim.t, psimin: sim.probe('psi_min'), ke: m.ke, u: sim.probe('u_vcl').u.slice() });
        if (snaps.length > 2) snaps.shift();
        nextSnapT += 5;
      }
      if (sim.probe('residual') < RES_TOL) break;
    }
  }
  const m = metricsObj(sim);
  const u = sim.probe('u_vcl'), v = sim.probe('v_hcl');
  const psimin = sim.probe('psi_min'), ctr = sim.probe('vortex_center');
  const prev = snaps.length ? snaps[0] : null;
  let dU5 = NaN;
  if (prev) { dU5 = 0; for (let j = 0; j < u.u.length; j++) dU5 = Math.max(dU5, Math.abs(u.u[j] - prev.u[j])); }
  return {
    N, steps: sim.steps, t_end: sim.t, wall_s: (Date.now() - t0) / 1000,
    residual: sim.probe('residual'), converged: sim.probe('residual') < RES_TOL, nan: nan || sim.diverged(),
    stationarity: prev ? { dt_back: sim.t - prev.t, max_du_vcl: dU5, dpsimin: Math.abs(psimin - prev.psimin), dke: Math.abs(m.ke - prev.ke) } : null,
    dt: m.dt, maxStab, maxU,
    conservation: { div_max: m.div, poisson_res: m.poisson, circulation: m.circ, ke: m.ke, enstrophy: m.enstrophy, last_mg_cycles: m.mg },
    psimin, center: ctr,
    u: compareTable(u, refU, 'y', 'u'), v: compareTable(v, refV, 'x', 'v'),
    psiRel: Math.abs(psimin - refP.value) / Math.abs(refP.value),
    centerErr: Math.max(Math.abs(ctr.x - refC.value.x), Math.abs(ctr.y - refC.value.y))
  };
}

const runs = [32, 64, 128].map(runCase);
const P = runs[2];
// observed convergence order of psi_min (information): p = log2(|e32-e64|... ) via three-grid estimate
const p32 = runs[0].psimin, p64 = runs[1].psimin, p128 = runs[2].psimin;
const pObs = Math.log(Math.abs((p32 - p64) / (p64 - p128))) / Math.LN2;
const richardson = p128 + (p128 - p64) / (Math.pow(2, pObs) - 1);
const uOrder = Math.log(runs[0].u.maxAbs / runs[1].u.maxAbs) / Math.LN2;

const stabOK = !P.nan && P.maxStab.diff <= 0.25 + 1e-12 && P.maxStab.cfl <= 1 + 1e-12 && P.maxStab.pe <= 2;
const consOK = P.conservation.div_max < 1e-10 && P.conservation.poisson_res < 1e-6 &&
  Math.abs(P.conservation.circulation + 1) <= 1.01 / P.N;
const steadyOK = P.converged && !!P.stationarity && P.stationarity.max_du_vcl < 0.01 * refU.tolerance.value &&
  P.stationarity.dpsimin / Math.abs(P.psimin) < 0.01 * refP.tolerance.value;

const summary = {
  method: 'psi-omega-fd', experiment: 'cavity-re100', Re: RE,
  protocol: { scheme: 'central', cfl: 0.8, mgCycles: 10, stop: 'residual < ' + RES_TOL + ' or t >= ' + T_CAP },
  primary: {
    N: P.N, steps: P.steps, t_end: P.t_end, wall_s: P.wall_s, residual: P.residual, converged: P.converged,
    stationarity: P.stationarity, dt: P.dt, maxStab: P.maxStab, maxU: P.maxU, conservation: P.conservation,
    u_vcl: { maxAbs: P.u.maxAbs, at_y: P.u.at, tol: P.u.tol, pass: P.u.pass, rows: P.u.rows },
    v_hcl: { maxAbs: P.v.maxAbs, at_x: P.v.at, tol: P.v.tol, pass: P.v.pass, rows: P.v.rows },
    psi_min: { value: P.psimin, ref: refP.value, rel: P.psiRel, tol: refP.tolerance.value, pass: P.psiRel <= refP.tolerance.value },
    vortex_center: { value: P.center, ref: refC.value, maxAbs: P.centerErr, tol: refC.tolerance.value, pass: P.centerErr <= refC.tolerance.value }
  },
  gridSequence: runs.map(r => ({ N: r.N, steps: r.steps, t_end: +r.t_end.toFixed(3), converged: r.converged, wall_s: r.wall_s,
    u_maxAbs: r.u.maxAbs, v_maxAbs: r.v.maxAbs, psimin: r.psimin, psiRel: r.psiRel, center: r.center, centerErr: r.centerErr,
    circulation: r.conservation.circulation, div_max: r.conservation.div_max, maxStab: r.maxStab })),
  convergence: { psimin_observed_order: pObs, psimin_richardson: richardson,
    psimin_richardson_rel_vs_ghia: Math.abs(richardson - refP.value) / Math.abs(refP.value), u_order_32_64: uOrder },
  passes: {
    u_vcl: P.u.pass, v_hcl: P.v.pass, psi_min: P.psiRel <= refP.tolerance.value,
    vortex_center: P.centerErr <= refC.tolerance.value, converged_steady: steadyOK,
    stability: stabOK, conservation: consOK
  },
  wall_s: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(summary, null, 1));
