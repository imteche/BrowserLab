/* Verification record: lbm-d2q9 @ tg-re100. Reviewer: reviewer-lbm-d2q9-tg-re100-r1 (not the builder).
 * Numbers from verification/checks/lbm-d2q9@tg-re100.check.js; report in verification/reports/lbm-d2q9@tg-re100.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'lbm-d2q9@tg-re100',
    method: 'lbm-d2q9', scene: 'taylor-green', experiment: 'tg-re100',
    status: 'flagged',
    claim: 'D2Q9 BGK at the method defaults (N = 128, Ulat = 0.05, tau = 0.5306) reproduces the analytic Taylor-Green decay at Re = 100 ' +
      'well inside the reference tolerances: KE gap vs 0.25 exp(-4 nu t) is 0.14% at t = 5 (max 0.32% over every step in [0, 5], tol 1%) and ' +
      '0.009% at t = 50; relative L2 velocity error <= 0.0013 on [0, 5] (tol 0.02); second-order convergence under diffusive scaling ' +
      '(p = 1.99-2.13 for KE gap and L2). Mass and momentum are conserved to round-off and all runs are stable. FLAGGED because the energy ' +
      'check fails: the initial state injects a spurious period-2 start-up transient, so KE increases on alternate steps for the first 26 steps ' +
      '(65 at N = 64), by up to 0.28% (1.2% at N = 64) per step, and at N = 64 the KE gap briefly reaches 1.28% (> 1% tol) at t = 0.005. ' +
      'Cause identified: createTG writes the pre-collision non-equilibrium part (-tau w rho 3 Q:grad u) into the post-collision buffer; ' +
      'the post-collision value is -(tau - 1) w rho 3 Q:grad u. With that one-line change (reviewer in-memory diagnostic) KE decays monotonically ' +
      'and the t = 5 KE gap falls to 0.034% at both N = 64 and 128.',
    conditions: {
      Re: 100, nu: 0.01, k: 1, U0: 1, box: '[0, 2 pi]^2 periodic', N: 128, Ulat: 0.05, tau: 0.5306, Mach_max: 0.087,
      steps: '2038 (t = 5), 20372 (t = 50)', t_end: '5 (experiment horizon) and 50 (= 1/(2 nu k^2), tolerance check point named by tgv-kinetic-energy)',
      refinement: 'acoustic scaling Ulat = 0.05, N = 64/128/256 (tau 0.515/0.531/0.561); diffusive scaling tau = 0.5306, N = 64/128/256 with Ulat = 0.1/0.05/0.025; t = 50 also at N = 256',
      metric: 'KE gap |KE(t)/E_ref(t) - 1| sampled every 0.5 and after every step; L2 = probe l2_error, cross-checked by reviewer recomputation from view(ux/uy) vs tgv-velocity fn (max diff 2.2e-9)',
      check: 'verification/checks/lbm-d2q9@tg-re100.check.js (about 3.6 min)'
    },
    reference: ['tgv-kinetic-energy', 'tgv-velocity'],
    gaps: [
      { quantity: 'KE gap vs tgv-kinetic-energy, max over every step t in [0, 5], N = 128 (default)', value: 0.00321, tolerance: 0.01, unit: 'relative', pass: true },
      { quantity: 'KE gap vs tgv-kinetic-energy at t = 5, N = 128 (default)', value: 0.00136, tolerance: 0.01, unit: 'relative', pass: true },
      { quantity: 'KE gap vs tgv-kinetic-energy at t = 50 = 1/(2 nu k^2), N = 128', value: 0.000089, tolerance: 0.01, unit: 'relative', pass: true },
      { quantity: 'relative L2 velocity error vs tgv-velocity, max over samples t in [0, 5], N = 128 (default)', value: 0.00127, tolerance: 0.02, unit: 'rel-l2', pass: true },
      { quantity: 'relative L2 velocity error vs tgv-velocity at t = 50, N = 128', value: 0.00035, tolerance: 0.02, unit: 'rel-l2', pass: true },
      { quantity: 'KE gap vs tgv-kinetic-energy, max over every step t in [0, 5], N = 64 (Ulat 0.05; start-up transient at t = 0.005)', value: 0.01281, tolerance: 0.01, unit: 'relative', pass: false }
    ],
    checks: [
      { name: 'mass conservation', status: 'pass', detail: 'sum(rho) max relative drift 2.0e-12 over 40744 steps (all runs below 10 eps per step)' },
      { name: 'momentum conservation', status: 'pass', detail: '|sum rho u| / (N^2 Ulat) <= 9.8e-16 in all runs (initial total momentum 0)' },
      { name: 'energy (KE never increases; viscous decay)', status: 'fail', detail: 'KE rises on alternate steps during a period-2 start-up transient in every run: 13 increases (last at step 26), max +0.28%/step at N = 128; ' +
          '31 increases (last at step 65), max +1.2%/step at N = 64. In-memory diagnostic with the post-collision-consistent initial non-equilibrium (-(tau-1) instead of -tau): 0 increases at N = 64 and 128.' },
      { name: 'stability (NaN / blow-up, tau, Mach)', status: 'pass', detail: 'no NaN or diverged() in any run incl. t = 50; tau min 0.5153 (>= 0.51 practical BGK bound); max Mach |u|/c_s 0.087 (0.173 in the Ulat = 0.1 run; < 0.3 criterion)' },
      { name: 'quantitative (KE decay, L2 velocity) at default N = 128', status: 'pass', detail: 'KE gap 0.14% at t = 5, 0.32% max over every step, 0.009% at t = 50 (tol 1%); L2 <= 0.0013 (tol 0.02). Effective nu from KE(5): 0.010068 (exact 0.01), 0.0100004 at t = 50.' },
      { name: 'order under refinement', status: 'pass', detail: 'diffusive scaling (tau fixed, Ulat ~ 1/N): KE gap 5.4e-3 / 1.36e-3 / 3.4e-4, p = 1.99, 2.00; L2 4.1e-3 / 9.5e-4 / 2.2e-4, p = 2.13, 2.08. ' +
          'Acoustic scaling (Ulat fixed): L2 3.2e-3 / 9.5e-4 / 6.7e-4 (p = 1.75, 0.50, saturating at the O(Ma^2) compressibility floor), as expected for LBM.' },
      { name: 'diagnostic: initial non-equilibrium populations', status: 'fail', detail: 'as published: KE gap at t = 5 6.3e-3 (N = 64) / 1.36e-3 (N = 128); patched -(tau-1): 3.4e-4 / 3.4e-4, KE monotone; no non-eq part: 2.9e-3 / 4.6e-4. ' +
          'The published initialisation is worse than omitting the non-equilibrium term.' }
    ],
    missing: [
      'Analytic reference source taylor1937 is verified:false (original not read, openAccess false; site unreachable) and lehmann2022 (arXiv:2112.08926) was seen as a search snippet only (verified:false, equation number unverified). ' +
        'The formula was independently verified by substitution (research/ins.md), so the reference values are fixed by mathematics and this does not affect the verdict.',
      'The tgv-kinetic-energy tolerance rationale names t = 1/(2 nu k^2) = 50 as the check point; the experiment is defined on [0, 5]. Both were run and gated (t = 5 primary; t = 50 secondary at N = 128 and 256).',
      'No published LBM-specific numeric TG error values were used (none obtained in research/ins.md); tolerances are those of the analytic references.',
      'D2Q9 equilibrium, weights and nu = (tau - 1/2)/3 are standard forms with unverified equation numbers (qian1992 / he1997 paywalled, research/ins.md).',
      'The post-collision non-equilibrium initialisation fix was tested only in memory by the reviewer; the method file was not modified. Round 2 should re-run this check after the builder applies it.'
    ],
    reviewer: 'reviewer-lbm-d2q9-tg-re100-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'flagged',
      reason: 'All reference gaps pass at default N = 128 (KE 0.32% max over every step, tol 1%; L2 0.0013, tol 0.02; 2nd order under diffusive scaling), mass/momentum to round-off, stable. ' +
        'Energy check fails: initial non-equilibrium written with the pre-collision factor -tau into the post-collision buffer (should be -(tau-1)) causes a period-2 transient with KE increasing on alternate steps; ' +
        'at N = 64 the KE gap reaches 1.28% (> 1%). Reviewer in-memory fix removes it (KE monotone, t = 5 gap 0.034%).' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
