#!/usr/bin/env node
/* Reviewer check: stable-fluids @ tg-re100 (2-D decaying Taylor-Green vortex, Re = 100, t in [0, 5]).
 * Reviewer: reviewer-stable-fluids-tg-re100-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node "verification/checks/stable-fluids@tg-re100.check.js"
 * Prints a JSON summary on stdout. Runs its cases as parallel child processes (4 cores: about 4-6 min wall).
 *
 * Protocol
 *   - Scene units: k = 1, U0 = 1, nu = 1/Re = 0.01, periodic box [0, 2 pi]^2, t_end = 5 (experiment horizon).
 *   - PRIMARY (method as published / shipped): Stam's solver settings = method defaults, N = 64, cfl = 1
 *     (dt = h), iters = 20 diffusion sweeps, pIters = 20 pressure sweeps.
 *   - Resolution sequence with Stam settings: N = 32, 64, 128, 256 (cfl = 1).
 *   - Time-step sequence with Stam settings at N = 64: cfl = 1, 0.5, 0.25.
 *   - DIAGNOSTICS (information; not used to pass the method): the same scheme with the pressure Poisson
 *     Gauss-Seidel driven close to convergence for the k = 2 pressure mode (pIters chosen so that the GS
 *     reduction factor of that mode ~ (1 - (2h)^2)^pIters is < 1e-2): N = 32 (300), 64 (500), 128 (1500),
 *     256 (1200, largest feasible in the budget; factor ~ 0.01), plus N = 128 / p1500 at cfl = 0.5.
 *     This separates the error of the unconverged 20-sweep projection from the first-order semi-Lagrangian
 *     (bilinear backtrace) dissipation.
 *   - Quantities (references/taylor-green.js), sampled every 0.5 time units and gated by the max over [0, 5]
 *     (the value at t = 5 is the max because the errors grow monotonically):
 *       KE gap = |KE(t)/E_ref(t) - 1|, E_ref = tgv-kinetic-energy = 0.25 exp(-4 nu t), tol 0.01 (rel).
 *       Ratio form |(KE/KE0)/exp(-4 nu t) - 1| also reported (KE0 = 0.25 exactly on the cell-centre grid).
 *       L2 = method probe 'l2_error', tol 0.02 (tgv-velocity); cross-checked by the reviewer from
 *       sim.view('u'/'v') (Float32, cell centres ((i+1/2)h, (j+1/2)h)) against the tgv-velocity reference fn.
 *     The reference tolerance names t = 1/(2 nu k^2) = 50 as check point; a t = 50 run at N = 64 (Stam settings)
 *     is reported as secondary.
 *   - Numerical dissipation: nu_eff = -ln(KE(t)/KE0)/(4 t); excess nu_num = nu_eff - nu and ratio nu_eff/nu.
 *     Observed order of nu_num under refinement (p = log2(nu_num(N)/nu_num(2N))).
 *   - Conservation (incompressible, periodic): mass <-> discrete divergence after the final projection (method
 *     metrics 'div' max and 'divrms'), reported relative to the velocity-gradient scale |grad u| ~ U0 k = 1;
 *     reviewer criterion rms div < 1e-3 (0.1% of the gradient scale). Momentum: mean (u, v) must stay 0
 *     (TG has zero mean; semi-Lagrangian advection is not conservative, but periodic symmetry keeps it 0);
 *     reviewer criterion |<u>|+|<v>| < 1e-10. Energy: no invariant (viscous decay) -> KE must not increase
 *     from one step to the next (relative slack 1e-12).
 *   - Stability: no NaN / diverged(); max|u| never exceeds the initial max (semi-Lagrangian max principle,
 *     slack 1e-9); CFL = max|u| dt/h <= 1 for the protocol runs (method note: accuracy needs CFL <= O(1)).
 */
'use strict';
const path = require('path');
const { fork } = require('child_process');

const RE = 100, NU = 1 / RE;
const CASES = [
  { key: 'primary_N64_stam', N: 64, cfl: 1, pIters: 20, tEnd: 5, dtS: 0.5, role: 'primary (method defaults = Stam settings)' },
  { key: 'stam_N32', N: 32, cfl: 1, pIters: 20, tEnd: 5, dtS: 0.5, role: 'resolution sequence' },
  { key: 'stam_N128', N: 128, cfl: 1, pIters: 20, tEnd: 5, dtS: 0.5, role: 'resolution sequence' },
  { key: 'stam_N256', N: 256, cfl: 1, pIters: 20, tEnd: 5, dtS: 0.5, role: 'resolution sequence' },
  { key: 'stam_N64_cfl05', N: 64, cfl: 0.5, pIters: 20, tEnd: 5, dtS: 0.5, role: 'time-step sequence' },
  { key: 'stam_N64_cfl025', N: 64, cfl: 0.25, pIters: 20, tEnd: 5, dtS: 0.5, role: 'time-step sequence' },
  { key: 'stam_N64_t50', N: 64, cfl: 1, pIters: 20, tEnd: 50, dtS: 5, role: 'secondary: t = 1/(2 nu k^2)' },
  { key: 'conv_N32_p300', N: 32, cfl: 1, pIters: 300, tEnd: 5, dtS: 0.5, role: 'diagnostic: converged projection' },
  { key: 'conv_N64_p500', N: 64, cfl: 1, pIters: 500, tEnd: 5, dtS: 0.5, role: 'diagnostic: converged projection' },
  { key: 'conv_N128_p1500', N: 128, cfl: 1, pIters: 1500, tEnd: 5, dtS: 0.5, role: 'diagnostic: converged projection' },
  { key: 'conv_N128_p1500_cfl05', N: 128, cfl: 0.5, pIters: 1500, tEnd: 5, dtS: 0.5, role: 'diagnostic: converged projection, half dt' },
  { key: 'conv_N256_p1200', N: 256, cfl: 1, pIters: 1200, tEnd: 5, dtS: 0.5, role: 'diagnostic: converged projection (largest feasible)' }
];

function runCase(C) {
  const H = require('../../tools/harness.js');
  const LAB = H.load({ methods: ['stable-fluids'], verification: false });
  const M = LAB.methods['stable-fluids'];
  const R = LAB.references;
  const refKE = R['tgv-kinetic-energy'], refV = R['tgv-velocity'];
  const metricsObj = sim => { const o = {}; sim.metrics().forEach(m => { o[m.key] = m.value; }); return o; };
  const N = C.N, h = 2 * Math.PI / N;
  function l2Indep(sim, t) {
    const vu = sim.view('u'), vv = sim.view('v');
    let num = 0, den = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = refV.fn([(i + 0.5) * h, (j + 0.5) * h], t, { Re: RE });
      const du = vu.data[j * N + i] - a[0], dv = vv.data[j * N + i] - a[1];
      num += du * du + dv * dv; den += a[0] * a[0] + a[1] * a[1];
    }
    return Math.sqrt(num / den);
  }
  const sim = M.create('taylor-green', H.params('stable-fluids', 'taylor-green', { Re: RE, N, cfl: C.cfl, iters: 20, pIters: C.pIters }));
  const m0 = metricsObj(sim);
  const ke0 = sim.probe('kinetic_energy'), umax0 = m0.umax;
  const out = Object.assign({}, C, { h, dt: sim.dt, ke0, ke0_ref: refKE.fn(null, 0, { Re: RE }), div0: m0.div, samples: [] });
  let next = C.dtS, prevKE = ke0, nUp = 0, maxUp = 0, nan = false;
  let maxU = umax0, maxCfl = m0.cfl, maxDiv = 0, maxDivRms = 0, maxDivPre = 0, maxMom = m0.mom;
  const t0 = Date.now();
  while (sim.t < C.tEnd - 1e-9) {
    sim.step();
    const ke = sim.probe('kinetic_energy');
    if (!isFinite(ke)) { nan = true; break; }
    if (ke > prevKE * (1 + 1e-12)) { nUp++; maxUp = Math.max(maxUp, ke / prevKE - 1); }
    prevKE = ke;
    const m = metricsObj(sim);
    maxU = Math.max(maxU, m.umax); maxCfl = Math.max(maxCfl, m.cfl);
    maxDiv = Math.max(maxDiv, m.div); maxDivRms = Math.max(maxDivRms, m.divrms); maxDivPre = Math.max(maxDivPre, m.divpre);
    maxMom = Math.max(maxMom, m.mom);
    if (sim.t >= next - 1e-9) {
      if (sim.diverged()) { nan = true; break; }
      const t = sim.t, Eref = refKE.fn(null, t, { Re: RE });
      out.samples.push({
        t: +t.toFixed(5), ke, Eref,
        keGap: Math.abs(ke / Eref - 1),
        keRatioGap: Math.abs((ke / ke0) / Math.exp(-4 * NU * t) - 1),
        l2: sim.probe('l2_error'), l2_indep: l2Indep(sim, t),
        nuEff: -Math.log(ke / ke0) / (4 * t), div: m.div, divrms: m.divrms, mom: m.mom
      });
      next += C.dtS;
    }
  }
  const last = out.samples[out.samples.length - 1] || {};
  const max = k => Math.max(...out.samples.map(s => s[k]));
  Object.assign(out, {
    steps: sim.steps, t_end: sim.t, nan, diverged: sim.diverged(), wall_s: (Date.now() - t0) / 1000,
    keGap_end: last.keGap, keRatioGap_end: last.keRatioGap, l2_end: last.l2, l2_indep_end: last.l2_indep, nuEff_end: last.nuEff,
    nuNum_end: last.nuEff - NU, nuRatio_end: last.nuEff / NU,
    keGap_max: max('keGap'), l2_max: max('l2'), l2_indep_max: max('l2_indep'),
    ke_increase_steps: nUp, ke_max_step_increase_rel: maxUp,
    umax0, maxU, maxCfl, maxDiv, maxDivRms, maxDivPre, maxMom
  });
  return out;
}

if (process.argv[2] === '--case') {
  const C = CASES.find(c => c.key === process.argv[3]);
  process.send(runCase(C));
  process.exit(0);
}

(async function main() {
  const wall0 = Date.now();
  const results = {};
  const queue = CASES.slice().sort((a, b) => cost(b) - cost(a));
  function cost(c) { return (c.tEnd / (c.cfl * 2 * Math.PI / c.N)) * c.N * c.N * (2 * c.pIters + 40); }
  const NPAR = Math.max(1, Math.min(4, require('os').cpus().length));
  async function worker() {
    while (queue.length) {
      const C = queue.shift();
      await new Promise((res, rej) => {
        const ch = fork(__filename, ['--case', C.key], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
        ch.on('message', r => { results[C.key] = r; });
        ch.on('exit', code => code === 0 ? res() : rej(new Error('case ' + C.key + ' exit ' + code)));
      });
    }
  }
  await Promise.all(Array.from({ length: NPAR }, worker));

  const H = require('../../tools/harness.js');
  const LAB = H.load({ methods: [], verification: false });
  const TOL_KE = LAB.references['tgv-kinetic-energy'].tolerance.value, TOL_L2 = LAB.references['tgv-velocity'].tolerance.value;
  const r = k => results[k];
  const strip = x => { const c = Object.assign({}, x); delete c.samples; return c; };
  const log2 = x => Math.log(x) / Math.LN2;
  const seq = (keys, key) => keys.map(k => r(k)[key]);
  const ord = arr => arr.slice(0, -1).map((v, i) => log2(v / arr[i + 1]));

  const P = r('primary_N64_stam');
  const protocolKeys = CASES.filter(c => !c.key.startsWith('conv')).map(c => c.key);
  const allKeys = CASES.map(c => c.key);

  const stamRes = ['stam_N32', 'primary_N64_stam', 'stam_N128', 'stam_N256'];
  const convRes = ['conv_N32_p300', 'conv_N64_p500', 'conv_N128_p1500', 'conv_N256_p1200'];
  const stamDt = ['primary_N64_stam', 'stam_N64_cfl05', 'stam_N64_cfl025'];
  const refinement = {
    stam_resolution: { N: [32, 64, 128, 256], keGap_t5: seq(stamRes, 'keGap_end'), l2_t5: seq(stamRes, 'l2_end'),
      nuEff: seq(stamRes, 'nuEff_end'), nuNum: seq(stamRes, 'nuNum_end'), p_nuNum: ord(seq(stamRes, 'nuNum_end')), p_l2: ord(seq(stamRes, 'l2_end')) },
    stam_timestep_N64: { cfl: [1, 0.5, 0.25], keGap_t5: seq(stamDt, 'keGap_end'), l2_t5: seq(stamDt, 'l2_end'), nuEff: seq(stamDt, 'nuEff_end') },
    converged_projection_resolution: { N: [32, 64, 128, 256], pIters: [300, 500, 1500, 1200], keGap_t5: seq(convRes, 'keGap_end'), l2_t5: seq(convRes, 'l2_end'),
      nuEff: seq(convRes, 'nuEff_end'), nuNum: seq(convRes, 'nuNum_end'), p_nuNum: ord(seq(convRes, 'nuNum_end')), p_l2: ord(seq(convRes, 'l2_end')),
      N128_cfl05: { keGap_t5: r('conv_N128_p1500_cfl05').keGap_end, l2_t5: r('conv_N128_p1500_cfl05').l2_end, nuEff: r('conv_N128_p1500_cfl05').nuEff_end } }
  };

  const prot = protocolKeys.map(r), all = allKeys.map(r);
  const conservation = {
    div_max_after_projection_primary: P.maxDiv, divrms_max_after_projection_primary: P.maxDivRms, divpre_max_primary: P.maxDivPre,
    divrms_max_protocol_runs: Math.max(...prot.map(x => x.maxDivRms)),
    div_max_protocol_runs: Math.max(...prot.map(x => x.maxDiv)),
    divrms_max_converged_runs: Math.max(...convRes.map(k => r(k).maxDivRms)),
    momentum_max_all: Math.max(...all.map(x => x.maxMom)),
    ke_increase_steps_all: all.reduce((s, x) => s + x.ke_increase_steps, 0)
  };
  conservation.mass_pass = conservation.divrms_max_protocol_runs < 1e-3;
  conservation.momentum_pass = conservation.momentum_max_all < 1e-10;
  conservation.energy_pass = conservation.ke_increase_steps_all === 0;

  const stability = {
    nan_any: all.some(x => x.nan || x.diverged),
    max_u_over_initial: Math.max(...all.map(x => x.maxU / x.umax0)),
    max_cfl_protocol: Math.max(...prot.map(x => x.maxCfl))
  };
  stability.pass = !stability.nan_any && stability.max_u_over_initial <= 1 + 1e-9 && stability.max_cfl_protocol <= 1 + 1e-9;

  const best = k => r(k);
  const quantitative = {
    tol_ke: TOL_KE, tol_l2: TOL_L2,
    primary: { keGap_max: P.keGap_max, keRatioGap_t5: P.keRatioGap_end, l2_max: P.l2_max, l2_indep_max: P.l2_indep_max, nuEff_t5: P.nuEff_end, nuEff_over_nu: P.nuRatio_end },
    finest_stam_N256: { keGap_max: best('stam_N256').keGap_max, l2_max: best('stam_N256').l2_max, nuEff_t5: best('stam_N256').nuEff_end },
    finest_converged_N256: { keGap_max: best('conv_N256_p1200').keGap_max, l2_max: best('conv_N256_p1200').l2_max, nuEff_t5: best('conv_N256_p1200').nuEff_end },
    t50_N64_stam: { keGap_t50: r('stam_N64_t50').keGap_end, l2_t50: r('stam_N64_t50').l2_end, nuEff: r('stam_N64_t50').nuEff_end },
    l2_probe_vs_indep_max_absdiff: Math.max(...all.map(x => Math.abs(x.l2_indep_end - x.l2_end))),
    any_run_passes_both: all.filter(x => x.keGap_max <= TOL_KE && x.l2_max <= TOL_L2).map(x => x.key)
  };
  quantitative.pass_primary = P.keGap_max <= TOL_KE && Math.max(P.l2_max, P.l2_indep_max) <= TOL_L2;

  console.log(JSON.stringify({
    method: 'stable-fluids', experiment: 'tg-re100', Re: RE, nu: NU,
    primary_samples: P.samples,
    runs: all.map(strip),
    refinement, conservation, stability, quantitative,
    passes: { mass_divergence: conservation.mass_pass, momentum: conservation.momentum_pass, energy_ke_monotone: conservation.energy_pass,
      stability: stability.pass, quantitative_primary: quantitative.pass_primary },
    wall_s: (Date.now() - wall0) / 1000
  }, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
