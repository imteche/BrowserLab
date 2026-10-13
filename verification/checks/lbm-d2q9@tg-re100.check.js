#!/usr/bin/env node
/* Reviewer check: lbm-d2q9 @ tg-re100 (2-D decaying Taylor-Green vortex, Re = 100, t in [0, 5]).
 * Reviewer: reviewer-lbm-d2q9-tg-re100-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node "verification/checks/lbm-d2q9@tg-re100.check.js"
 * Prints a JSON summary on stdout.
 *
 * Protocol
 *   - Scene units: k = 1, U0 = 1, nu = 1/Re = 0.01, box [0, 2 pi]^2, fully periodic.
 *   - Primary run: method defaults (N = 128 cells per side, Ulat = 0.05, Ma = 0.087 nominal,
 *     tau = 0.5 + 3 Ulat N / (2 pi Re) = 0.5306), integrated to t = 5 (the experiment's horizon).
 *   - Quantities (references/taylor-green.js):
 *       KE gap  = |KE(t) / E_ref(t) - 1|, E_ref = tgv-kinetic-energy = 0.25 exp(-4 nu t), tol 0.01 (rel).
 *                 Also reported in ratio form |(KE(t)/KE0) / exp(-4 nu t) - 1| (identical up to KE0 discretisation).
 *       L2      = method probe 'l2_error' (rel. L2 of (u, v) vs tgv-velocity at the nodes), tol 0.02.
 *                 Cross-checked independently by the reviewer: rel. L2 recomputed from sim.view('ux'/'uy')
 *                 (Float32 fields, cell-centre nodes x = (i+1/2) 2pi/N) against the tgv-velocity reference fn.
 *     Evaluated every 0.5 time units on [0, 5]; the pass/fail value is the max over the samples.
 *   - The reference's KE tolerance rationale names t = 1/(2 nu k^2) = 50 as the check point. The experiment
 *     is defined on [0, 5] (KE decays only to exp(-0.2) = 0.82 there), so t = 5 is primary and a t = 50 run
 *     (KE -> exp(-2) = 0.135, "decays notably") is the more demanding secondary check; both are gated.
 *   - Grid sequences (order under refinement):
 *       acoustic scaling  (Ulat fixed 0.05): N = 64, 128, 256   -> tau 0.515, 0.531, 0.561
 *       diffusive scaling (tau fixed 0.5306, Ulat ~ 1/N): N = 64 (Ulat 0.10), 128 (0.05), 256 (0.025)
 *     Observed order p = log2(e(N)/e(2N)) for the KE gap and L2 at t = 5.
 *   - Viscosity diagnostic: nu_eff = -ln(KE(t)/KE0)/(4 t) vs 0.01.
 *   - Conservation: total mass sum(rho) relative drift (periodic BGK: exact to round-off);
 *     total momentum |sum rho u| (initial value 0 by symmetry; periodic BGK conserves it to round-off).
 *     Reviewer criterion: mass drift < 10 eps * steps; |momentum| / (N^2 Ulat) < 1e-10.
 *     Energy is not conserved (viscous decay); "energy" check = KE never increases from one step to the next
 *     (relative 1e-12 slack). The KE gap is also evaluated after EVERY step (not only at the 0.5 samples).
 *   - Diagnostic: initial non-equilibrium populations (see initDiag below).
 *   - Stability: no NaN / diverged(); tau > 1/2 and tau >= 0.51 (method's practical BGK criterion);
 *     Mach max|u|/c_s < 0.3 (method's stated criterion; <= 0.17 preferred).
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['lbm-d2q9'], verification: false });
const M = LAB.methods['lbm-d2q9'];
const R = LAB.references;
const RE = 100, NU = 1 / RE;
const refKE = R['tgv-kinetic-energy'], refV = R['tgv-velocity'];
const TOL_KE = refKE.tolerance.value, TOL_L2 = refV.tolerance.value;
const EPS = 2.220446049250313e-16;
const wall0 = Date.now();

function metricsObj(sim) { const o = {}; sim.metrics().forEach(m => { o[m.key] = m.value; }); return o; }

/* Reviewer-side rel. L2 velocity error from the rendered fields vs the reference function. */
function l2Indep(sim, N, t) {
  const vu = sim.view('ux'), vv = sim.view('uy');
  const h = 2 * Math.PI / N;
  let num = 0, den = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = refV.fn([(i + 0.5) * h, (j + 0.5) * h], t, { Re: RE });
    const du = vu.data[j * N + i] - a[0], dv = vv.data[j * N + i] - a[1];
    num += du * du + dv * dv; den += a[0] * a[0] + a[1] * a[1];
  }
  return Math.sqrt(num / den);
}

/* Run to tEnd, sampling every dtS. Returns time series and run-wide diagnostics. */
function run(N, Ulat, tEnd, dtS, Mth) {
  const p = H.params('lbm-d2q9', 'taylor-green', { Re: RE, N: N, Ulat: Ulat });
  const sim = (Mth || M).create('taylor-green', p);
  const m0 = metricsObj(sim);
  const ke0 = sim.probe('kinetic_energy');
  const out = { N, Ulat, tau: m0.tau, nu_lat: m0.nu, dt: sim.dt, ke0, ke0_ref: refKE.fn(null, 0, { Re: RE }), samples: [] };
  let next = dtS, keMax = 0, l2Max = 0, keRatioMax = 0, maxMach = m0.mach, maxDm = 0, maxMom = m0.mom, nan = false;
  let prevKE = ke0, monotone = true, maxDiv = m0.div, maxKEup = 0, l2iMax = 0, nUp = 0, lastUpStep = 0;
  let keGapStepMax = 0, keGapStepMaxT = 0;
  const t0 = Date.now();
  while (sim.t < tEnd - 1e-12) {
    sim.step();
    const ke = sim.probe('kinetic_energy');
    if (!isFinite(ke)) { nan = true; break; }
    if (ke > prevKE * (1 + 1e-12)) { monotone = false; maxKEup = Math.max(maxKEup, ke / prevKE - 1); nUp++; lastUpStep = sim.steps; }
    const gStep = Math.abs(ke / refKE.fn(null, sim.t, { Re: RE }) - 1);
    if (gStep > keGapStepMax) { keGapStepMax = gStep; keGapStepMaxT = sim.t; }
    prevKE = ke;
    if (sim.t >= next - 1e-12) {
      if (sim.diverged()) { nan = true; break; }
      const m = metricsObj(sim);
      const t = sim.t;
      const Eref = refKE.fn(null, t, { Re: RE });
      const keGap = Math.abs(ke / Eref - 1);
      const keRatioGap = Math.abs((ke / ke0) / Math.exp(-4 * NU * t) - 1);
      const l2 = sim.probe('l2_error');
      const nuEff = -Math.log(ke / ke0) / (4 * t);
      const l2i = l2Indep(sim, N, t);
      l2iMax = Math.max(l2iMax, l2i);
      out.samples.push({ t: +t.toFixed(6), ke, Eref, keGap, keRatioGap, l2, l2_indep: l2i, nuEff, mach: m.mach, dmass: m.dmass, mom: m.mom });
      keMax = Math.max(keMax, keGap); keRatioMax = Math.max(keRatioMax, keRatioGap); l2Max = Math.max(l2Max, l2);
      maxMach = Math.max(maxMach, m.mach); maxDm = Math.max(maxDm, m.dmass); maxMom = Math.max(maxMom, m.mom);
      maxDiv = Math.max(maxDiv, m.div);
      next += dtS;
    }
  }
  const last = out.samples[out.samples.length - 1];
  Object.assign(out, {
    steps: sim.steps, t_end: sim.t, nan, diverged: sim.diverged(), wall_s: (Date.now() - t0) / 1000,
    keGap_end: last.keGap, keRatioGap_end: last.keRatioGap, l2_end: last.l2, nuEff_end: last.nuEff,
    keGap_max: keMax, keRatioGap_max: keRatioMax, l2_max: l2Max,
    l2_indep_end: last.l2_indep, l2_indep_max: l2iMax, ke_max_step_increase_rel: maxKEup,
    ke_increase_steps: nUp, ke_last_increase_step: lastUpStep, keGap_everystep_max: keGapStepMax, keGap_everystep_max_t: keGapStepMaxT,
    maxMach, maxDmass: maxDm, maxMom, momNorm: maxMom / (N * N * Ulat), maxDiv, keMonotone: monotone
  });
  return out;
}

const log2 = x => Math.log(x) / Math.LN2;
function orders(runs, key) {
  const o = [];
  for (let i = 0; i + 1 < runs.length; i++) o.push(log2(runs[i][key] / runs[i + 1][key]));
  return o;
}
const strip = r => { const c = Object.assign({}, r); delete c.samples; return c; };

/* ---- primary (method defaults) */
const primary = run(128, 0.05, 5, 0.5);

/* ---- acoustic scaling, Ulat fixed */
const ac64 = run(64, 0.05, 5, 0.5);
const ac256 = run(256, 0.05, 5, 0.5);
const acoustic = [ac64, primary, ac256];

/* ---- diffusive scaling, tau fixed */
const df64 = run(64, 0.10, 5, 0.5);
const df256 = run(256, 0.025, 5, 0.5);
const diffusive = [df64, primary, df256];

/* ---- long run t = 50 (= 1/(2 nu k^2), reference KE tolerance check point) at default N, Ulat */
const long = run(128, 0.05, 50, 5);
const long256 = run(256, 0.05, 50, 5);

const all = [primary, ac64, ac256, df64, df256, long, long256];

/* ---- diagnostic (reviewer-side, in memory only; methods/lbm-d2q9.js is NOT modified):
 * createTG stores feq - tau*w*rho*3*Q(grad u) into L.fo, which the step() loop treats as POST-collision
 * populations (it streams fo, then collides). The Chapman-Enskog non-equilibrium part of the PRE-collision
 * populations is -tau*w*rho*3*Q; after BGK collision it becomes (1 - 1/tau) times that = -(tau - 1)*w*rho*3*Q.
 * Re-run with the method source patched in memory to (a) -(tau-1) (post-collision consistent) and (b) no
 * non-equilibrium part, and compare the start-up transient, KE monotonicity and the t = 5 gaps. */
function patchedMethod(variant) {
  const fs = require('fs'), vm = require('vm'), path = require('path');
  let src = fs.readFileSync(path.join(H.ROOT, 'methods/lbm-d2q9.js'), 'utf8');
  const target = 'feq -= tau * W[i] * rho * 3 * Q;';
  if (src.indexOf(target) < 0) return null;
  src = src.replace(target, variant === 'post' ? 'feq -= (tau - 1) * W[i] * rho * 3 * Q;' : '');
  const L2 = H.load({ methods: [], verification: false });
  vm.runInThisContext(src, { filename: 'lbm-d2q9.patched-' + variant + '.js' });
  return L2.methods['lbm-d2q9'];
}
const initDiag = {};
for (const v of ['post', 'none']) {
  const Mp = patchedMethod(v);
  if (!Mp) { initDiag[v] = 'target line not found'; continue; }
  initDiag[v] = [64, 128].map(N => {
    const r = run(N, 0.05, 5, 0.5, Mp);
    return { N, Ulat: 0.05, keGap_t5: r.keGap_end, l2_t5: r.l2_end, keGap_everystep_max: r.keGap_everystep_max,
      keGap_everystep_max_t: r.keGap_everystep_max_t, ke_increase_steps: r.ke_increase_steps, ke_max_step_increase_rel: r.ke_max_step_increase_rel };
  });
}
initDiag.as_published = [ac64, primary].map(r => ({ N: r.N, Ulat: r.Ulat, keGap_t5: r.keGap_end, l2_t5: r.l2_end,
  keGap_everystep_max: r.keGap_everystep_max, keGap_everystep_max_t: r.keGap_everystep_max_t,
  ke_increase_steps: r.ke_increase_steps, ke_last_increase_step: r.ke_last_increase_step, ke_max_step_increase_rel: r.ke_max_step_increase_rel }));
const conservation = {
  mass_max_rel_drift: Math.max(...all.map(r => r.maxDmass)),
  mass_bound_10eps_steps: 10 * EPS * Math.max(...all.map(r => r.steps)),
  momentum_max_normalised: Math.max(...all.map(r => r.momNorm)),
  ke_monotone_all: all.every(r => r.keMonotone),
  ke_max_step_increase_rel: Math.max(...all.map(r => r.ke_max_step_increase_rel))
};
// Energy: no invariant (viscous decay). For the incompressible TG flow dKE/dt = -nu <|omega|^2> < 0; with a
// consistent initial state the weakly compressible LBM also decays KE monotonically (see initDiag 'post').
conservation.energy_pass = conservation.ke_monotone_all;
conservation.mass_pass = all.every(r => r.maxDmass < 10 * EPS * r.steps);
conservation.momentum_pass = conservation.momentum_max_normalised < 1e-10;

const stability = {
  nan_any: all.some(r => r.nan || r.diverged),
  tau_min: Math.min(...all.map(r => r.tau)),
  mach_max: Math.max(...all.map(r => r.maxMach)),
  maxDiv_primary: primary.maxDiv
};
stability.pass = !stability.nan_any && stability.tau_min > 0.5 && stability.tau_min >= 0.51 && stability.mach_max < 0.3;

const quantitative = {
  primary_keGap_max_t0_5: primary.keGap_max, primary_keGap_everystep_max: primary.keGap_everystep_max,
  primary_keGap_everystep_max_t: primary.keGap_everystep_max_t, N64_keGap_everystep_max: ac64.keGap_everystep_max, primary_keGap_t5: primary.keGap_end,
  primary_keRatioGap_t5: primary.keRatioGap_end,
  primary_l2_max_t0_5: primary.l2_max, primary_l2_t5: primary.l2_end,
  primary_l2_indep_max_t0_5: primary.l2_indep_max, l2_probe_vs_indep_max_absdiff: Math.max(...all.map(r => Math.abs(r.l2_indep_end - r.l2_end))),
  long_keGap_t50_N128: long.keGap_end, long_l2_t50_N128: long.l2_end,
  long_keGap_t50_N256: long256.keGap_end, long_l2_t50_N256: long256.l2_end,
  tol_ke: TOL_KE, tol_l2: TOL_L2
};
quantitative.pass_primary = primary.keGap_max <= TOL_KE && Math.max(primary.l2_max, primary.l2_indep_max) <= TOL_L2;
quantitative.pass_long = long.keGap_end <= TOL_KE && Math.max(long.l2_end, long.l2_indep_end) <= TOL_L2;

const order = {
  acoustic: { N: [64, 128, 256], keGap_t5: acoustic.map(r => r.keGap_end), l2_t5: acoustic.map(r => r.l2_end),
    p_ke: orders(acoustic, 'keGap_end'), p_l2: orders(acoustic, 'l2_end') },
  diffusive: { N: [64, 128, 256], Ulat: [0.1, 0.05, 0.025], keGap_t5: diffusive.map(r => r.keGap_end), l2_t5: diffusive.map(r => r.l2_end),
    p_ke: orders(diffusive, 'keGap_end'), p_l2: orders(diffusive, 'l2_end') }
};

console.log(JSON.stringify({
  method: 'lbm-d2q9', experiment: 'tg-re100', Re: RE, nu: NU,
  primary_samples: primary.samples,
  runs: all.map(strip),
  long_samples_N128: long.samples,
  conservation, stability, quantitative, order, initDiag,
  passes: {
    mass: conservation.mass_pass, momentum: conservation.momentum_pass, energy_ke_monotone: conservation.energy_pass,
    stability: stability.pass, quantitative_t0_5: quantitative.pass_primary, quantitative_t50: quantitative.pass_long
  },
  wall_s: (Date.now() - wall0) / 1000
}, null, 1));
