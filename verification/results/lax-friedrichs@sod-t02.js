/* Verification record: lax-friedrichs @ sod-t02. Reviewer: reviewer-lax-friedrichs-sod-t02-r1 (not the builder).
 * Numbers from verification/checks/lax-friedrichs@sod-t02.check.js; report in
 * verification/reports/lax-friedrichs@sod-t02.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'lax-friedrichs@sod-t02',
    method: 'lax-friedrichs', scene: 'sod', experiment: 'sod-t02',
    status: 'flagged',
    claim: 'Classic (global) Lax–Friedrichs on Sod at t = 0.2 is conservative to round-off, stable at CFL 0.9 and converges to the exact ' +
      'Riemann solution with L1(rho) = 2.85e-2 / 2.02e-2 / 1.36e-2 / 8.87e-3 at N = 100/200/400/800 (observed order 0.50 -> 0.65, the expected ' +
      'sub-first-order range for discontinuous solutions); shock and contact positions and the star plateaux agree with the exact solution, but its ' +
      'large numerical diffusion distorts the rarefaction fan: fitted fan head/tail are off by 0.019/0.042 at N = 200 (tolerance 0.01), and the tail ' +
      'only comes within 0.01 at N = 1600.',
    conditions: {
      t_end: 0.2, CFL: 0.9, gamma: 1.4, x0: 0.5, N: [100, 200, 400, 800, 1600, 3200], boundaries: 'transmissive (zero-gradient ghost)',
      landing: 'last step clipped to land exactly on t = 0.2', error_metric: 'L1 = sum |q_i - q_exact(x_i)| dx at cell centres',
      wave_estimators: 'shock: p crosses (p*+pR)/2; contact: rho crosses (rho*L+rho*R)/2; fan head/tail: LSQ line of u over central 60% of exact fan extrapolated to u=0 / u=u*',
      info_runs: 'CFL 0.5 / 1.0 at N = 400; independent reviewer LF at N = 200; continuation to t = 0.6',
      check: 'verification/checks/lax-friedrichs@sod-t02.check.js', wall_s: 0.4
    },
    reference: ['sod-exact-profile', 'sod-exact-profile-laxfriedrichs-band', 'sod-totals', 'sod-x-shock', 'sod-x-contact',
      'sod-x-rarefaction-head', 'sod-x-rarefaction-tail', 'sod-pstar', 'sod-ustar', 'sod-rhostarL', 'sod-rhostarR'],
    gaps: [
      { quantity: 'L1(rho) N=100 vs LF engineering band (unpublished, ~1.4x researcher scratch LF)', value: 0.02848, tolerance: 0.040, unit: 'density', pass: true },
      { quantity: 'L1(rho) N=200 vs LF engineering band', value: 0.02017, tolerance: 0.028, unit: 'density', pass: true },
      { quantity: 'L1(rho) N=400 vs LF engineering band', value: 0.01363, tolerance: 0.019, unit: 'density', pass: true },
      { quantity: 'observed L1(rho) order N=100->200 / 200->400 / 400->800 (expected ~0.5-1 for first order with discontinuities; reviewer range 0.4-1.1)', value: 0.498, tolerance: '0.4-1.1', unit: 'order (0.498 / 0.566 / 0.620)', pass: true },
      { quantity: 'observed L1(u), L1(p) order N=100->800 (info)', value: 0.678, tolerance: '0.4-1.1', unit: 'order u: 0.68/0.72/0.78, p: 0.63/0.68/0.73', pass: true },
      { quantity: 'max rel. mass drift vs 0.5625, every step to t=0.2, all N', value: 3.9e-16, tolerance: 1e-12, unit: 'rel', pass: true },
      { quantity: 'max rel. energy drift vs analytic E0 = 1.375 (registered sod-totals value 2.75 is an arithmetic slip, see missing)', value: 6.5e-16, tolerance: 1e-12, unit: 'rel', pass: true },
      { quantity: 'momentum at t=0.2 vs 0.9 t, all N', value: 4.6e-16, tolerance: 1e-12, unit: 'rel', pass: true },
      { quantity: 'shock position N=200 (p midpoint)', value: 0.85314, tolerance: 0.01, unit: 'abs err 2.7e-3', pass: true },
      { quantity: 'contact position N=200 (rho midpoint)', value: 0.67621, tolerance: 0.01, unit: 'abs err 9.3e-3', pass: true },
      { quantity: 'rarefaction head N=200 (fan fit)', value: 0.24447, tolerance: 0.01, unit: 'abs err 1.89e-2', pass: false },
      { quantity: 'rarefaction tail N=200 (fan fit)', value: 0.52834, tolerance: 0.01, unit: 'abs err 4.24e-2', pass: false },
      { quantity: 'rarefaction head N=400 (fan fit)', value: 0.25210, tolerance: 0.01, unit: 'abs err 1.13e-2', pass: false },
      { quantity: 'rarefaction tail N=400 (fan fit)', value: 0.51213, tolerance: 0.01, unit: 'abs err 2.62e-2', pass: false },
      { quantity: 'p* plateau N=400 (pair-averaged, mid-plateau)', value: 0.303169, tolerance: 0.02, unit: 'rel err 1.3e-4', pass: true },
      { quantity: 'u* plateau N=400', value: 0.927595, tolerance: 0.02, unit: 'rel err 1.6e-4', pass: true },
      { quantity: 'rho*_L plateau N=400', value: 0.419894, tolerance: 0.02, unit: 'rel err 1.5e-2', pass: true },
      { quantity: 'rho*_R plateau N=400', value: 0.266043, tolerance: 0.02, unit: 'rel err 1.8e-3', pass: true }
    ],
    checks: [
      { name: 'mass/momentum/energy conservation', status: 'pass',
        detail: 'Tracked every step to t=0.2 for N=100..3200: mass rel. drift <= 3.9e-16, energy rel. drift vs 1.375 <= 6.5e-16, momentum - 0.9t rel. <= 4.6e-16; ' +
          'method internal boundary-flux residual <= 1.1e-15. Energy compared with analytic E0 = 1.375 because sod-totals.fn returns 2.75 (factor-2 slip in the reference; ' +
          'its own derivation 0.5*2.5+0.5*0.25 = 1.375). Tolerance 1e-12 unchanged.' },
      { name: 'stability', status: 'pass',
        detail: 'No NaN, no divergence, rho and p positive in all runs; max(|u|+c)dt/dx = 0.900 (method criterion <= 1). Info: CFL 1.0 also stable (L1 rho 1.24e-2 at N=400); ' +
          'CFL 0.5 more diffusive (2.07e-2). Continuation to t=0.6 stays bounded as waves exit.' },
      { name: 'convergence under refinement', status: 'pass',
        detail: 'L1(rho,u,p) decrease monotonically N=100..3200. rho orders 0.50/0.57/0.62/0.64/0.65; u 0.68/0.72/0.78/0.81/0.76; p 0.63/0.68/0.73/0.75/0.76. ' +
          'Consistent with first-order schemes on solutions with contact + shock (contact-dominated ~N^-1/2 pre-asymptotically).' },
      { name: 'wave positions (sodshock values, tol 0.01 at N=200)', status: 'fail',
        detail: 'Shock err 2.7e-3 and contact err 9.3e-3 pass at N=200. Rarefaction head/tail by u-fan fit err 1.89e-2 / 4.24e-2 at N=200, 1.13e-2 / 2.62e-2 at N=400, ' +
          '6.0e-3 / 1.52e-2 at N=800, 3.1e-3 / 8.6e-3 at N=1600 (first pass of both), 1.5e-3 / 4.7e-3 at N=3200. Fitted fan slope 3.27 vs exact 4.17 at N=200 ' +
          '(window 60/40/20% gives the same head/tail within 2e-3, so not an estimator artefact); fan centre (u = u*/2) displaced by +1.1e-2 at N=200. ' +
          'Errors converge (~order 0.8-0.9); failure is LF numerical diffusion at the stated resolution.' },
      { name: 'star plateaux (2% band at N=400)', status: 'pass', detail: 'p*, u*, rho*_R within 0.2%; rho*_L 1.5% low at N=400 (0.8% at N=800, 0.23% at N=3200).' },
      { name: 'L1 engineering band', status: 'pass', detail: 'L1(rho) 2.85e-2 / 2.02e-2 / 1.36e-2 vs bands 0.040 / 0.028 / 0.019. Matches the researcher scratch LF (2.848e-2/2.017e-2/1.363e-2) to 3 digits. Bands are not published values.' },
      { name: 'discretization faithfulness', status: 'pass',
        detail: 'Reviewer-written classic LF update U^{n+1}_i = (U_{i-1}+U_{i+1})/2 - dt/(2dx)(F_{i+1}-F_{i-1}), same dt rule, N=200: max |diff| in rho,u,p = 1.1e-15.' },
      { name: 'odd-even decoupling (info)', status: 'n/a',
        detail: 'Expected LF artefact visible: max neighbour jump in left constant state x<0.2 is 4.2e-3 at N=200 (5.7e-5 at N=800); pressure zigzag in star region 3.3e-4 at N=200.' }
    ],
    missing: [
      'No published L1 error table for Sod was found (research/hyp.md §4); the L1 bands in sod-exact-profile-laxfriedrichs-band are BrowserLab engineering bands (~1.4x the researcher\'s own LF errors), so passing them is not an independent quantitative confirmation.',
      'Wave-position tolerance 0.01 ("~2 cells at N=200") and plateau band 2% are engineering choices in references/sod.js, not published; wave-position values come from sodshock2015 (verified: true, computed values). The tolerance is defined for jumps; for kinks (fan head/tail) the reviewer used a u-fan LSQ fit, which is a reviewer-chosen estimator.',
      'Reference defect: sod-totals.fn returns energy 2.75, but the initial data give E0 = 0.5*1/0.4 + 0.5*0.1/0.4 = 1.375 (factor-2 slip). The reference file should be corrected by the researcher; the check uses 1.375.',
      'Source access: toro2009, sod1978 and lax1954 are verified:false (paywalled originals not read). Exact solver formulas were taken from zingale-cha (verified:true) and validated against sodshock2015 (verified:true); Toro star values confirmed via sodshock to 17 digits and a search snippet of rusanov2024 (verified:false).',
      'Expected convergence-order range (~0.5-1 for first-order schemes on discontinuous solutions) is textbook recollection (research/hyp.md says uncited); the reviewer range 0.4-1.1 is reviewer-set.'
    ],
    reviewer: 'reviewer-lax-friedrichs-sod-t02-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'flagged',
      reason: 'Conservation (round-off), stability, L1 convergence (order 0.50-0.65) and shock/contact/plateau checks pass, but rarefaction head/tail positions miss the 0.01 tolerance at N=200 (1.9e-2 / 4.2e-2) and N=400 because of LF numerical diffusion; ' +
        'implementation matches an independent classic-LF re-implementation to 1e-15, so not an implementation defect. L1 bands are unpublished engineering bands. sod-totals energy reference value (2.75) is wrong; correct value 1.375.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
