/* Verification record: wcsph @ tg-re100. Reviewer: reviewer-wcsph-tg-re100-r1 (not the builder).
 * Numbers from verification/checks/wcsph@tg-re100.check.js; report in verification/reports/wcsph@tg-re100.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'wcsph@tg-re100',
    method: 'wcsph', scene: 'taylor-green', experiment: 'tg-re100',
    status: 'flagged',
    claim: 'WCSPH (Tait EOS, cubic spline h = 1.3dx, Morris laminar viscosity, c0 = 10 U0, dx/5 initial perturbation) does NOT reproduce ' +
      'the analytic Taylor-Green decay at Re = 100 over t in [0, 5]: KE(5)/KE0 is 34% / 22% / 17% below exp(-4 nu t) at N = 40 / 80 / 140 ' +
      'particles per side (tolerance 1%), and the relative L2 velocity error at t = 5 is 0.28 / 0.15 / 0.10 (tolerance 0.02). ' +
      'Errors fall with resolution at observed order about 0.5-0.9. The viscous operator itself gives the correct nu (nu_eff = 0.0101 on the ' +
      'unperturbed lattice for t < 0.2); the extra dissipation comes from particle disorder and pressure noise, which also push max Mach above ' +
      '0.1 and density variation above 1%. Mass and momentum are conserved to round-off and the runs are stable.',
    conditions: {
      Re: 100, nu: 0.01, t_end: 5, N: '40 / 80 / 140 particles per side (1600 / 6400 / 19600); finest N = 140 (UI maximum)',
      hdx: 1.3, cfac: 10, cfl: 0.25, perturb: 0.2, steps: '1082 / 2149 / 3754',
      metric: 'KE: |KE(t)/KE0 / exp(-4 nu t) - 1|; L2: probe l2_error (rel. L2 vs tgv-velocity at particle positions); evaluated at t = 5 and every 0.5',
      diagnostics: 'early nu_eff (N = 80, t <= 0.2); near-inviscid Re = 1e6; unperturbed lattice N = 40, 80; c0 = 20 U0 at N = 80; t = 50 at N = 40',
      check: 'verification/checks/wcsph@tg-re100.check.js (about 6.5 min)'
    },
    reference: ['tgv-kinetic-energy', 'tgv-velocity'],
    gaps: [
      { quantity: 'KE(5)/KE0 relative to exp(-4 nu t), N = 140', value: 0.1705, tolerance: 0.01, unit: 'relative', pass: false },
      { quantity: 'KE(5)/KE0 relative to exp(-4 nu t), N = 80', value: 0.2229, tolerance: 0.01, unit: 'relative', pass: false },
      { quantity: 'KE(5)/KE0 relative to exp(-4 nu t), N = 40 (default)', value: 0.3443, tolerance: 0.01, unit: 'relative', pass: false },
      { quantity: 'relative L2 velocity error at t = 5, N = 140', value: 0.1023, tolerance: 0.02, unit: 'rel-l2', pass: false },
      { quantity: 'relative L2 velocity error at t = 5, N = 80', value: 0.1468, tolerance: 0.02, unit: 'rel-l2', pass: false },
      { quantity: 'relative L2 velocity error at t = 5, N = 40 (default)', value: 0.2826, tolerance: 0.02, unit: 'rel-l2', pass: false }
    ],
    checks: [
      { name: 'mass conservation', status: 'pass', detail: 'equal-mass particles, count constant; total mass exact by construction' },
      { name: 'momentum conservation', status: 'pass', detail: 'max drift of |sum m v| 2.6e-15 / 1.9e-15 / 4.0e-14 at N = 40 / 80 / 140 (pairwise-antisymmetric forces)' },
      { name: 'energy (KE decay monotone)', status: 'pass', detail: 'no step-to-step KE increase in any run; but decay is too fast (see quantitative)' },
      { name: 'stability (NaN / blow-up, CFL)', status: 'pass', detail: 'no NaN or diverged() in any run incl. t = 50; acoustic CFL max 0.2506 / 0.2501 / 0.2500 (criterion 0.25); dt <= 0.125 h^2/nu always (ratio <= 0.032)' },
      { name: 'Mach criterion (c0 >= 10 Umax)', status: 'fail', detail: 'max |v|/c0 = 0.123 / 0.110 / 0.103 at N = 40 / 80 / 140: particle velocity noise exceeds U0. With c0 = 20 U0 (N = 80) max Mach 0.054.' },
      { name: 'density variation <= 1% (becker2007 eta)', status: 'fail', detail: 'max |rho/rho0 - 1| = 0.066 / 0.044 / 0.034 at N = 40 / 80 / 140; 0.019 with c0 = 20 U0 at N = 80' },
      { name: 'quantitative (KE decay, L2 velocity)', status: 'fail', detail: 'all 6 gaps exceed tolerance by 10-34x (KE) and 5-14x (L2). Observed order N40->80->140: KE 0.63, 0.48; L2 0.95, 0.65. ' +
          'Extrapolating at order ~0.5 to reach 1% KE would need N of order 10^4 per side.' },
      { name: 'diagnostic: viscous operator', status: 'pass', detail: 'unperturbed lattice N = 80: nu_eff = -ln(KE/KE0)/(4t) = 0.01013 / 0.01018 / 0.00991 at t = 0.05 / 0.10 / 0.20 (exact 0.01), L2 <= 0.003. ' +
          'Perturbed N = 80: nu_eff rises 0.0102 -> 0.0132 by t = 0.2 as disorder grows.' },
      { name: 'diagnostic: numerical dissipation', status: 'n/a', detail: 'near-inviscid Re = 1e6, N = 80: KE(5)/KE0 = 0.936 (exact 1.000), L2 = 0.41. Unperturbed lattice: KE gap 0.665 (N = 40), 0.547 (N = 80), worse than perturbed, ' +
          'as the method notes describe. c0 = 20 U0 at N = 80: KE gap 0.276 (worse than 0.223 at c0 = 10). t = 50 at N = 40: KE(50)/KE0 = 0.0055 vs 0.135 exact.' }
    ],
    missing: [
      'No published numeric SPH Taylor-Green error values are available (research/ptc.md): adami2013 is paywalled (verified:false), and ramachandran2019edac / negi2022convergence give only qualitative statements ' +
        '(standard WCSPH least accurate; WCSPH/TVF do not converge with resolution); their figures are not in the open repos. The tolerances are therefore the analytic-solution tolerances of tgv-velocity / tgv-kinetic-energy, not SPH-specific ones.',
      'Analytic reference source taylor1937 and secondary lehmann2022 are verified:false (original not read; search snippet only). The formula was independently verified by substitution (research/ins.md), so this does not affect the verdict.',
      'Reference tolerance for KE suggests checking at t = 1/(2 nu k^2) = 50; the experiment is defined on t in [0, 5], so t = 5 was used as the primary point (less demanding). At t = 50 (N = 40) the KE gap is 0.96.',
      'The Morris laminar viscosity operator has no registered source (builder knowledge, unverified); the reviewer diagnostic shows it yields nu_eff = 0.0101 on an ordered lattice.',
      'Kernel and setup differ from the published SPH TG runs (cubic spline h = 1.3dx vs quintic spline h = dx; 2pi box vs unit box); no transport-velocity / shifting correction, which the cited literature uses to obtain accurate TG results.',
      'Resolution limited to N = 140 (UI maximum, 19600 particles, 179 s); larger N not run within the time budget.'
    ],
    reviewer: 'reviewer-wcsph-tg-re100-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'flagged',
      reason: 'KE(5) 17-34% below exact (tol 1%) and rel. L2 0.10-0.28 (tol 0.02) at N = 140/80/40; slow sub-first-order convergence. Mach > 0.1 and density variation > 1% from particle noise. ' +
        'Viscous operator verified correct (nu_eff = 0.0101 on lattice); excess dissipation is disorder/pressure noise inherent to standard WCSPH, no implementation defect found. Mass/momentum to round-off; stable.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
