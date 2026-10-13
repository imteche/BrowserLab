/* Verification record: lbm-d2q9 @ tg-re100. Reviewer: reviewer-lbm-d2q9-tg-re100-r2 (not the builder).
 * Numbers from verification/checks/lbm-d2q9@tg-re100.check.js; report in verification/reports/lbm-d2q9@tg-re100.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'lbm-d2q9@tg-re100',
    method: 'lbm-d2q9', scene: 'taylor-green', experiment: 'tg-re100',
    status: 'matched',
    claim: 'D2Q9 BGK at the method defaults (N = 128, Ulat = 0.05, tau = 0.5306) reproduces the analytic Taylor-Green decay at Re = 100: ' +
      'KE gap vs 0.25 exp(-4 nu t) is 0.034% at t = 5 (max 0.034% over every step in [0, 5], tol 1%) and 0.16% at t = 50; ' +
      'relative L2 velocity error <= 0.0010 on [0, 5] (tol 0.02); KE decays monotonically in every run (0 step-to-step increases); ' +
      'second-order convergence under diffusive scaling (p = 1.99-2.24 for KE gap and L2). Mass and momentum conserved to round-off; all runs stable. ' +
      'The round-1 start-up transient is gone after the refinement changed the initial non-equilibrium factor from -tau to -(tau - 1).',
    conditions: {
      Re: 100, nu: 0.01, k: 1, U0: 1, box: '[0, 2 pi]^2 periodic', N: 128, Ulat: 0.05, tau: 0.5306, Mach_max: 0.087,
      steps: '2038 (t = 5), 20372 (t = 50)', t_end: '5 (experiment horizon) and 50 (= 1/(2 nu k^2), tolerance check point named by tgv-kinetic-energy)',
      refinement: 'acoustic scaling Ulat = 0.05, N = 64/128/256 (tau 0.515/0.531/0.561); diffusive scaling tau = 0.5306, N = 64/128/256 with Ulat = 0.1/0.05/0.025; t = 50 also at N = 256',
      metric: 'KE gap |KE(t)/E_ref(t) - 1| sampled every 0.5 and after every step; L2 = probe l2_error, cross-checked by reviewer recomputation from view(ux/uy) vs tgv-velocity fn (max diff 1.8e-9)',
      check: 'verification/checks/lbm-d2q9@tg-re100.check.js (about 3.6 min)'
    },
    reference: ['tgv-kinetic-energy', 'tgv-velocity'],
    gaps: [
      { quantity: 'KE gap vs tgv-kinetic-energy, max over every step t in [0, 5], N = 128 (default)', value: 0.000342, tolerance: 0.01, unit: 'relative', pass: true },
      { quantity: 'KE gap vs tgv-kinetic-energy at t = 5, N = 128 (default)', value: 0.000339, tolerance: 0.01, unit: 'relative', pass: true },
      { quantity: 'KE gap vs tgv-kinetic-energy at t = 50 = 1/(2 nu k^2), N = 128', value: 0.00162, tolerance: 0.01, unit: 'relative', pass: true },
      { quantity: 'relative L2 velocity error vs tgv-velocity, max over samples t in [0, 5], N = 128 (default)', value: 0.00103, tolerance: 0.02, unit: 'rel-l2', pass: true },
      { quantity: 'relative L2 velocity error vs tgv-velocity at t = 50, N = 128', value: 0.00088, tolerance: 0.02, unit: 'rel-l2', pass: true },
      { quantity: 'KE gap vs tgv-kinetic-energy, max over every step t in [0, 5], N = 64 (Ulat 0.05, tau 0.515)', value: 0.000341, tolerance: 0.01, unit: 'relative', pass: true }
    ],
    checks: [
      { name: 'mass conservation', status: 'pass', detail: 'sum(rho) max relative drift 2.0e-12 over 40744 steps (all runs below 10 eps per step)' },
      { name: 'momentum conservation', status: 'pass', detail: '|sum rho u| / (N^2 Ulat) <= 1.5e-15 in all runs (initial total momentum 0)' },
      { name: 'energy (KE never increases; viscous decay)', status: 'pass', detail: '0 step-to-step KE increases in all 7 runs (N = 64/128/256, both scalings, t = 5 and t = 50). Round-1 period-2 transient removed.' },
      { name: 'stability (NaN / blow-up, tau, Mach)', status: 'pass', detail: 'no NaN or diverged() in any run incl. t = 50; tau min 0.5153 (>= 0.51 practical BGK bound); max Mach |u|/c_s 0.087 (0.173 in the Ulat = 0.1 run; < 0.3 criterion)' },
      { name: 'quantitative (KE decay, L2 velocity) at default N = 128', status: 'pass', detail: 'KE gap 0.034% at t = 5 and over every step, 0.16% at t = 50 (tol 1%); L2 <= 0.0010 (tol 0.02). Effective nu from KE: 0.009983 (t = 5), 0.009992 (t = 50); exact 0.01.' },
      { name: 'order under refinement', status: 'pass', detail: 'diffusive scaling (tau fixed, Ulat ~ 1/N): KE gap 1.42e-3 / 3.39e-4 / 8.5e-5, p = 2.07, 1.99; L2 3.2e-3 / 6.8e-4 / 1.5e-4, p = 2.24, 2.16. ' +
          'Acoustic scaling (Ulat fixed): KE gap 3.40e-4 / 3.39e-4 / 3.39e-4, L2 6.0e-4 / 6.8e-4 / 6.9e-4, flat at the O(Ma^2) compressibility floor, as expected for LBM at fixed Ulat.' },
      { name: 'diagnostic: initial non-equilibrium populations', status: 'pass', detail: 'as published (-(tau-1)): KE gap at t = 5 3.4e-4 at N = 64 and 128, 0 KE increases. In-memory reversion to round-1 -tau: 6.3e-3 / 1.36e-3, 31 / 13 KE increases, N = 64 per-step gap 1.28%; no non-eq part: 2.9e-3 / 4.6e-4, 25 / 10 increases. The fix is confirmed.' }
    ],
    missing: [
      'Analytic reference source taylor1937 is verified:false (original not read, openAccess false; site unreachable) and lehmann2022 (arXiv:2112.08926) was seen as a search snippet only (verified:false, equation number unverified). ' +
        'The formula was independently verified by substitution (research/ins.md), so the reference values are fixed by mathematics and this does not affect the verdict.',
      'The tgv-kinetic-energy tolerance rationale names t = 1/(2 nu k^2) = 50 as the check point; the experiment is defined on [0, 5]. Both were run and gated (t = 5 primary; t = 50 secondary at N = 128 and 256).',
      'No published LBM-specific numeric TG error values were used (none obtained in research/ins.md); tolerances are those of the analytic references.',
      'D2Q9 equilibrium, weights and nu = (tau - 1/2)/3 are standard forms with unverified equation numbers (qian1992 / he1997 paywalled, research/ins.md).',
      'At t = 50 the KE gap (0.16%) is the same at N = 128 and 256 with Ulat fixed: it is the O(Ma^2) compressibility floor, not a resolution error. Lower Ulat reduces it (diffusive scaling, t = 5).'
    ],
    reviewer: 'reviewer-lbm-d2q9-tg-re100-r2', round: 2, date: '2026-10-13',
    history: [
      { round: 1, status: 'flagged',
        reason: 'All reference gaps pass at default N = 128 (KE 0.32% max over every step, tol 1%; L2 0.0013, tol 0.02; 2nd order under diffusive scaling), mass/momentum to round-off, stable. ' +
          'Energy check fails: initial non-equilibrium written with the pre-collision factor -tau into the post-collision buffer (should be -(tau-1)) causes a period-2 transient with KE increasing on alternate steps; ' +
          'at N = 64 the KE gap reaches 1.28% (> 1%). Reviewer in-memory fix removes it (KE monotone, t = 5 gap 0.034%).' },
      { round: 2, status: 'matched',
        reason: 'Refinement applied -(tau-1). Re-run from scratch: KE monotone in all 7 runs, KE gap max 0.034% on [0, 5] (0.16% at t = 50), L2 <= 0.0010, second order under diffusive scaling, mass/momentum to round-off, stable. All gaps within tolerance, no tolerances loosened.' }
    ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
