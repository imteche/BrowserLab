#!/usr/bin/env node
/* Reviewer check: wcsph @ tg-re100 (taylor-green scene, viscous decay at Re = 100, t in [0, 5]).
 * Reviewer: reviewer-wcsph-tg-re100-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/wcsph@tg-re100.check.js [--quick]
 *   --quick skips the N = 140 run and the long t = 50 run. Default runtime about 6-8 min.
 * Prints a JSON summary on stdout.
 *
 * Protocol (js/scenes.js experiment tg-re100; references/taylor-green.js; research/ptc.md "SPH on Taylor-Green"):
 *   - Periodic box [0, 2pi]^2, U0 = 1, k = 1, Re = 100 (nu = 0.01), method defaults otherwise:
 *     hdx = 1.3 (cubic spline), c0 = 10 U0 (cfac 10, as in pysph-tg / ramachandran2019edac / negi2022convergence),
 *     acoustic CFL 0.25 (pysph-tg dt = min(0.25 h/(c0+U), 0.125 h^2/nu)), initial perturbation dx/5 (ramachandran2019edac).
 *   - Resolution study N = 40 (default), 80, 140 (largest the method's UI exposes) particles per side; run to t = 5.
 *     PySPH / EDAC use nx = 50 on a unit box: N = 40-80 brackets that per-wavelength resolution.
 *   - Gaps (evaluated at t = 5, the experiment window end, and as max over sample times in (0, 5]):
 *       KE: |KE(t)/KE0 / exp(-4 nu t) - 1|   tolerance 0.01 (tgv-kinetic-energy, metric 'rel')
 *       L2: probe l2_error (relative L2 velocity error vs tgv-velocity at particle positions)  tolerance 0.02 (tgv-velocity)
 *     Deviation (documented): tgv-kinetic-energy suggests checking at t = 1/(2 nu k^2) = 50; the experiment is defined on
 *     t in [0, 5], so t = 5 is the primary check point (less demanding, errors accumulate in time). t = 50 is run at N = 40
 *     for information.
 *   - Conservation: mass (particle count x m, exact by construction), linear momentum |sum m v| drift (pairwise-antisymmetric
 *     forces => round-off), energy: KE must decay monotonically (no spurious KE growth); KE decay vs exact is the
 *     quantitative check.
 *   - Stability: no NaN / diverged(); Mach max|v|/c0 <= 0.1 (method's criterion c0 >= 10 Umax);
 *     max |rho/rho0 - 1| <= 0.01 (becker2007 eta = 0.01 as stated by the method);
 *     acoustic CFL dt(c0+|v|max)/h <= 0.25 (+1%); dt <= 0.125 h^2/nu.
 *   - Diagnostics (information, to locate the error source):
 *       (d1) early-time effective viscosity on the unperturbed lattice, N = 80, t in [0, 0.2]:
 *            nu_eff = -ln(KE(t)/KE0)/(4 t); checks the Morris viscous operator delivers nu = 0.01 before disorder sets in.
 *       (d2) near-inviscid run Re = 1e6 at N = 80 (outside UI range; create() does not clamp): KE loss with nu ~ 0
 *            measures purely numerical (pressure-noise / disorder) dissipation.
 *       (d3) unperturbed lattice (perturb = 0, the pysph-tg setup) at N = 40 and 80.
 *       (d4) c0 = 20 U0 at N = 80 (compressibility sensitivity).
 */
'use strict';
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['wcsph'], verification: false });
const M = LAB.methods.wcsph;
const R = LAB.references;
const QUICK = process.argv.includes('--quick');
const wall0 = Date.now();

const RE = 100, NU = 1 / RE, T_END = 5;
const refV = R['tgv-velocity'], refKE = R['tgv-kinetic-energy'];
const TOL_KE = refKE.tolerance.value, TOL_L2 = refV.tolerance.value;
const CFL_MAX = 0.25, MACH_MAX = 0.1, DRHO_MAX = 0.01;

function metricsMap(sim) { const o = {}; sim.metrics().forEach(m => { o[m.key] = m.value; }); return o; }

function run(over, tEnd, sampleDt) {
  const p = H.params('wcsph', 'taylor-green', Object.assign({ Re: RE }, over));
  const sim = M.create('taylor-green', p);
  const nu = 1 / p.Re;
  const t0w = Date.now();
  const KE0 = sim.probe('kinetic_energy');
  const KE0exact = refKE.fn(null, 0, { Re: p.Re });
  const m0 = metricsMap(sim);
  const h = p.hdx * 2 * Math.PI / Math.round(p.N), c0 = p.cfac;
  let maxMach = 0, maxDrho = m0.drho, maxCfl = 0, maxDtVisc = 0, maxMom = 0, keGrowth = 0, nan = false, diverged = false;
  let prevKE = KE0, nextS = sampleDt;
  const samples = [];
  let maxKEgap = 0, maxL2 = 0;
  while (sim.t < tEnd - 1e-12) {
    sim.step();
    if (sim.diverged()) { diverged = true; }
    const ke = sim.probe('kinetic_energy');
    if (!isFinite(ke)) { nan = true; break; }
    if (ke > prevKE) keGrowth = Math.max(keGrowth, (ke - prevKE) / KE0);
    prevKE = ke;
    const vmax = (function () { const mm = metricsMap(sim); return mm; })();
    maxMach = Math.max(maxMach, vmax.mach); maxDrho = Math.max(maxDrho, vmax.drho);
    maxCfl = Math.max(maxCfl, sim.dt * (c0 + vmax.vmax) / h);
    maxDtVisc = Math.max(maxDtVisc, sim.dt / (0.125 * h * h / nu));
    maxMom = Math.max(maxMom, Math.abs(vmax.mom - m0.mom));
    if (sim.t >= nextS - 1e-9 || sim.t >= tEnd - 1e-12) {
      const exactRatio = Math.exp(-4 * nu * sim.t);
      const keRel = ke / KE0, gap = Math.abs(keRel / exactRatio - 1), l2 = sim.probe('l2_error');
      const keAbs = Math.abs(ke / refKE.fn(null, sim.t, { Re: p.Re }) - 1);
      samples.push({ t: +sim.t.toFixed(4), KE_over_KE0: +keRel.toFixed(5), exact: +exactRatio.toFixed(5), KE_gap: +gap.toFixed(5),
        KE_abs_gap: +keAbs.toFixed(5), l2: +l2.toFixed(5) });
      maxKEgap = Math.max(maxKEgap, gap); maxL2 = Math.max(maxL2, l2);
      if (diverged) break;
      nextS += sampleDt;
    }
    if (diverged) break;
  }
  const last = samples[samples.length - 1];
  const mf = metricsMap(sim);
  return {
    params: p, steps: sim.steps, t: sim.t, wall_s: (Date.now() - t0w) / 1000, nf: mf.nf,
    KE0, KE0_exact: KE0exact, KE0_init_err: Math.abs(KE0 / KE0exact - 1), mom0: m0.mom,
    final: last, maxKEgap, maxL2, samples,
    conservation: { mass_const: mf.mass === undefined ? 'exact (count x m)' : mf.mass, momentum_drift: maxMom, ke_max_step_growth_rel: keGrowth },
    stability: { nan, diverged, maxMach, maxDrho, maxCfl, max_dt_over_visc_limit: maxDtVisc, final_div: mf.div }
  };
}

const res = {};
/* primary resolution study */
const Ns = QUICK ? [40, 80] : [40, 80, 140];
res.study = Ns.map(N => run({ N, perturb: 0.2 }, T_END, 0.5));

/* diagnostics */
function earlyNu(N) {
  const p = H.params('wcsph', 'taylor-green', { Re: RE, N, perturb: 0 });
  const sim = M.create('taylor-green', p); const KE0 = sim.probe('kinetic_energy'); const out = [];
  [0.05, 0.1, 0.2].forEach(tt => { while (sim.t < tt) sim.step(); const k = sim.probe('kinetic_energy');
    out.push({ t: +sim.t.toFixed(4), nu_eff: -Math.log(k / KE0) / (4 * sim.t), l2: sim.probe('l2_error') }); });
  return out;
}
res.diag = {
  early_nu_eff_unperturbed_N80: earlyNu(80),
  early_nu_eff_perturbed_N80: (function () {
    const p = H.params('wcsph', 'taylor-green', { Re: RE, N: 80, perturb: 0.2 });
    const sim = M.create('taylor-green', p); const KE0 = sim.probe('kinetic_energy'); const out = [];
    [0.05, 0.1, 0.2].forEach(tt => { while (sim.t < tt) sim.step(); const k = sim.probe('kinetic_energy');
      out.push({ t: +sim.t.toFixed(4), nu_eff: -Math.log(k / KE0) / (4 * sim.t), l2: sim.probe('l2_error') }); });
    return out;
  })(),
  inviscid_Re1e6_N80: run({ N: 80, perturb: 0.2, Re: 1e6 }, T_END, 1.0),
  unperturbed_N40: run({ N: 40, perturb: 0 }, T_END, 1.0),
  unperturbed_N80: run({ N: 80, perturb: 0 }, T_END, 1.0),
  cfac20_N80: run({ N: 80, perturb: 0.2, cfac: 20 }, T_END, 1.0)
};
if (!QUICK) res.diag.long_t50_N40 = run({ N: 40, perturb: 0.2 }, 50, 5.0);
// strip bulky fields from diagnostics
Object.keys(res.diag).forEach(k => { const d = res.diag[k]; if (d && d.samples && k !== 'long_t50_N40') d.samples = d.samples.filter((s, i, a) => i === a.length - 1); });

/* gaps and verdict on the finest resolution, also on each N */
const fin = res.study[res.study.length - 1];
const perN = res.study.map(r => ({
  N: r.params.N, nf: r.nf, steps: r.steps, wall_s: r.wall_s,
  KE_gap_t5: r.final.KE_gap, KE_gap_max: r.maxKEgap, l2_t5: r.final.l2, l2_max: r.maxL2,
  pass_KE: r.final.KE_gap <= TOL_KE && r.maxKEgap <= TOL_KE, pass_L2: r.final.l2 <= TOL_L2 && r.maxL2 <= TOL_L2
}));
// observed convergence of the t = 5 errors between successive N
const conv = [];
for (let i = 1; i < perN.length; i++) {
  const r = Math.log(perN[i - 1].N / perN[i].N);
  conv.push({ N: [perN[i - 1].N, perN[i].N], order_KE: Math.log(perN[i - 1].KE_gap_t5 / perN[i].KE_gap_t5) / -r,
    order_L2: Math.log(perN[i - 1].l2_t5 / perN[i].l2_t5) / -r });
}
const stab = res.study.map(r => r.stability);
const passes = {
  KE_t5_finest: fin.final.KE_gap <= TOL_KE,
  L2_t5_finest: fin.final.l2 <= TOL_L2,
  any_N_KE: perN.some(x => x.pass_KE), any_N_L2: perN.some(x => x.pass_L2),
  stability_no_nan: stab.every(s => !s.nan && !s.diverged),
  mach: stab.every(s => s.maxMach <= MACH_MAX),
  density_variation: stab.every(s => s.maxDrho <= DRHO_MAX),
  cfl: stab.every(s => s.maxCfl <= CFL_MAX * 1.01 && s.max_dt_over_visc_limit <= 1 + 1e-9),
  momentum: res.study.every(r => r.conservation.momentum_drift < 1e-10),
  ke_monotone: res.study.every(r => r.conservation.ke_max_step_growth_rel < 1e-6)
};
const summary = {
  method: 'wcsph', experiment: 'tg-re100', Re: RE, t_end: T_END,
  tolerances: { KE_rel: TOL_KE, L2_rel: TOL_L2 },
  perN, convergence: conv, passes,
  study: res.study.map(r => ({ N: r.params.N, params: r.params, KE0: r.KE0, KE0_init_err: r.KE0_init_err, mom0: r.mom0,
    conservation: r.conservation, stability: r.stability, samples: r.samples })),
  diagnostics: res.diag,
  wall_s: (Date.now() - wall0) / 1000
};
console.log(JSON.stringify(summary, null, 1));
