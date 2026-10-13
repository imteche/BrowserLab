#!/usr/bin/env node
/* Reviewer check: lbm-d2q9 @ cavity-re100 (lid-driven cavity, Re = 100, steady state).
 * Reviewer: reviewer-lbm-d2q9-cavity-re100-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node "verification/checks/lbm-d2q9@cavity-re100.check.js"
 * Prints a JSON summary on stdout (runtime ~5-6 min on one core).
 *
 * Protocol
 *   - Method defaults except Re = 100: N = 128 cells per side, Ulat = 0.1 (Ma = 0.17 nominal),
 *     tau = 0.5 + 3 Ulat N / Re = 0.884. N = 128 cells means cell-centre nodes; Ghia's 129 grid
 *     nodes j/128 fall on cell faces, so the sim profile (probe returns cell-centre values plus wall
 *     values) is linearly interpolated to the snapped Ghia coordinates (O(h^2) interpolation error).
 *   - Grid sequence N = 64, 128 at Ulat = 0.1 and a Mach-sensitivity run N = 128, Ulat = 0.05.
 *     N = 256 was not run: at the measured ~12 MLUPS it needs ~12 min for one converged run,
 *     beyond the review budget (N = 128 is the resolution of the reference grid and the method default).
 *   - March from rest (rho = 1, u = 0) until the method's residual probe
 *     (max |du| per unit time, in U/(L/U)) < 1e-8 (primary run) or < 1e-7 (other runs), cap t <= 120.
 *     Steadiness also confirmed by probe change over the last ~5 time units
 *     (reviewer criterion: < 1% of each tolerance).
 *   - Table comparison: max-abs over all 17 rows of Ghia Table I / II, tolerance from reference (0.02 U).
 *     psi_min: rel error vs -0.103423 (tol 0.03). Vortex centre: max(|dx|,|dy|) (tol 0.02).
 *   - Conservation for LBM: total mass sum(rho) drift (moving-wall bounce-back conserves mass
 *     exactly per node; expect round-off). Criterion: max |M - M0|/M0 over the run < 10 eps * steps
 *     (i.e. < 10 machine epsilons of relative drift per step). Momentum/energy are not invariants of the driven,
 *     viscous cavity; reported for information only (no criterion): discrete divergence max |div u| (weak compressibility, O(Ma^2))
 *     and max density deviation.
 *   - Stability: no NaN; tau > 1/2; Mach max|u|/c_s < 0.3 (method's stated criterion).
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['lbm-d2q9'], verification: false });
const M = LAB.methods['lbm-d2q9'];
const R = LAB.references;
const RE = 100, T_CAP = 120;
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
    const s = interp(prof[xKey], prof[yKey], snap(r[0]));
    const d = s - r[1];
    rows.push({ coord: r[0], ref: r[1], sim: +s.toFixed(6), diff: +d.toFixed(6) });
    if (Math.abs(d) > maxAbs) { maxAbs = Math.abs(d); at = r[0]; }
  });
  return { maxAbs, at, tol: ref.tolerance.value, pass: maxAbs <= ref.tolerance.value, rows };
}

function runCase(N, Ulat, resTol) {
  const sim = M.create('cavity', H.params('lbm-d2q9', 'cavity', { Re: RE, N: N, Ulat: Ulat }));
  const t0 = Date.now();
  let nan = false, maxMach = 0, maxDmass = 0, nextSnapT = 5, snaps = [];
  const chunk = Math.max(50, Math.round(N / Ulat / 20));   // ~1/20 time unit
  while (sim.t < T_CAP) {
    for (let s = 0; s < chunk; s++) sim.step();
    if (sim.diverged()) { nan = true; break; }
    const m = metricsObj(sim);
    maxMach = Math.max(maxMach, m.mach); maxDmass = Math.max(maxDmass, m.dmass);
    if (sim.t >= nextSnapT) {
      snaps.push({ t: sim.t, psimin: sim.probe('psi_min'), u: sim.probe('u_vcl').u.slice(), v: sim.probe('v_hcl').v.slice() });
      if (snaps.length > 2) snaps.shift();
      nextSnapT += 5;
    }
    if (sim.probe('residual') < resTol) break;
  }
  const m = metricsObj(sim);
  const u = sim.probe('u_vcl'), v = sim.probe('v_hcl');
  const psimin = sim.probe('psi_min'), ctr = sim.probe('vortex_center');
  const prev = snaps.length ? snaps[0] : null;
  let du = NaN, dv = NaN;
  if (prev) {
    du = 0; dv = 0;
    for (let j = 0; j < u.u.length; j++) du = Math.max(du, Math.abs(u.u[j] - prev.u[j]));
    for (let j = 0; j < v.v.length; j++) dv = Math.max(dv, Math.abs(v.v[j] - prev.v[j]));
  }
  return {
    N, Ulat, tau: m.tau, nu_lat: m.nu, steps: sim.steps, t_end: sim.t, wall_s: (Date.now() - t0) / 1000,
    residual: sim.probe('residual'), converged: sim.probe('residual') < resTol, resTol, nan: nan || sim.diverged(),
    stationarity: prev ? { dt_back: sim.t - prev.t, max_du_vcl: du, max_dv_hcl: dv, dpsimin: Math.abs(psimin - prev.psimin) } : null,
    maxMach, umax: m.umax,
    conservation: { mass: m.mass, dmass_final: m.dmass, dmass_max: maxDmass, div_max: m.div },
    psimin, center: ctr,
    u: compareTable(u, refU, 'y', 'u'), v: compareTable(v, refV, 'x', 'v'),
    psiRel: Math.abs(psimin - refP.value) / Math.abs(refP.value),
    centerErr: Math.max(Math.abs(ctr.x - refC.value.x), Math.abs(ctr.y - refC.value.y))
  };
}

const r64 = runCase(64, 0.1, 1e-7);
const P = runCase(128, 0.1, 1e-8);
const rMa = runCase(128, 0.05, 1e-7);
const runs = [r64, P, rMa];

const stabOK = !P.nan && P.tau > 0.5 && P.maxMach < 0.3;
// Mass criterion (reviewer-set): the update conserves sum(f) exactly in exact arithmetic (bounce-back and the
// moving-wall term sum to zero per node), so only floating-point round-off may remain: require the relative
// drift per step to stay below 10 machine epsilons (2.2e-15), i.e. |M - M0|/M0 < 10 eps * steps.
const EPS = 2.220446049250313e-16;
const massBound = r => 10 * EPS * r.steps;
const consOK = P.conservation.dmass_max < massBound(P);
const steadyOK = P.converged && !!P.stationarity && P.stationarity.max_du_vcl < 0.01 * refU.tolerance.value &&
  P.stationarity.max_dv_hcl < 0.01 * refV.tolerance.value &&
  P.stationarity.dpsimin / Math.abs(P.psimin) < 0.01 * refP.tolerance.value;

const summary = {
  method: 'lbm-d2q9', experiment: 'cavity-re100', Re: RE,
  protocol: { primary: 'N=128, Ulat=0.1, residual<1e-8', others: 'N=64 Ulat=0.1, N=128 Ulat=0.05; residual<1e-7', cap_t: T_CAP },
  primary: {
    N: P.N, Ulat: P.Ulat, tau: P.tau, steps: P.steps, t_end: P.t_end, wall_s: P.wall_s, residual: P.residual, converged: P.converged,
    stationarity: P.stationarity, maxMach: P.maxMach, umax: P.umax, conservation: P.conservation,
    u_vcl: { maxAbs: P.u.maxAbs, at_y: P.u.at, tol: P.u.tol, pass: P.u.pass, rows: P.u.rows },
    v_hcl: { maxAbs: P.v.maxAbs, at_x: P.v.at, tol: P.v.tol, pass: P.v.pass, rows: P.v.rows },
    psi_min: { value: P.psimin, ref: refP.value, rel: P.psiRel, tol: refP.tolerance.value, pass: P.psiRel <= refP.tolerance.value },
    vortex_center: { value: P.center, ref: refC.value, maxAbs: P.centerErr, tol: refC.tolerance.value, pass: P.centerErr <= refC.tolerance.value }
  },
  runs: runs.map(r => ({ N: r.N, Ulat: r.Ulat, tau: r.tau, steps: r.steps, t_end: +r.t_end.toFixed(3), converged: r.converged,
    residual: r.residual, wall_s: r.wall_s, maxMach: r.maxMach, u_maxAbs: r.u.maxAbs, u_at: r.u.at, v_maxAbs: r.v.maxAbs, v_at: r.v.at,
    psimin: r.psimin, psiRel: r.psiRel, center: r.center, centerErr: r.centerErr,
    dmass_max: r.conservation.dmass_max, dmass_bound: massBound(r), dmass_per_step: r.conservation.dmass_max / r.steps, div_max: r.conservation.div_max, nan: r.nan })),
  passes: {
    u_vcl: P.u.pass, v_hcl: P.v.pass, psi_min: P.psiRel <= refP.tolerance.value,
    vortex_center: P.centerErr <= refC.tolerance.value, converged_steady: steadyOK,
    stability: stabOK, mass_conservation: consOK
  },
  wall_s: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(summary, null, 1));
