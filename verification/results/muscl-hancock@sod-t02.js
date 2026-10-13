/* Verification record: muscl-hancock @ sod-t02. Reviewer: reviewer-muscl-hancock-sod-t02-r1 (not the builder).
 * Numbers from verification/checks/muscl-hancock@sod-t02.check.js; report in
 * verification/reports/muscl-hancock@sod-t02.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'muscl-hancock@sod-t02',
    method: 'muscl-hancock', scene: 'sod', experiment: 'sod-t02',
    status: 'flagged',
    claim: 'MUSCL-Hancock (minmod, conserved-variable slopes, HLLC/Davis, CFL 0.9) on Sod at t = 0.2 is within the second-order (engineering) L1 density bands at N = 100/200/400 ' +
      '(6.581e-3 / 3.581e-3 / 1.997e-3 vs 0.0095 / 0.0052 / 0.0029). Overall L1 orders are 0.77-0.88 (rho) up to N = 6400. Mass, momentum and energy are conserved to <= 4.7e-15. ' +
      'The solution stays positive, star plateaus are within 0.02 %, and all four wave positions are within 0.006 at N = 200. On genuinely smooth data the same kernel converges at second order (1.9 minmod, 2.0-2.1 van Leer). ' +
      'The record is flagged on two reviewer criteria that were fixed before the runs. (1) The total-variation excess and the u overshoot exceed 1 %: there is a single overshoot of u at the rarefaction tail, 1.31 % of u* at N = 100, 0.78 % at N = 400 and 0.46 % at N = 1600; TV(u) excess is 1.55 % at N = 100 and 1.14 % at N = 400. ' +
      '(2) Inside the Sod fan, the L1 order away from waves is only 1.0, not ~2.',
    conditions: {
      t: 0.2, gamma: 1.4, x0: 0.5, data: '(1,0,1)|(0.125,0,0.1)', CFL: 0.9, limiter: 'minmod (default); van Leer, primitive vars, Einfeldt as info',
      vars: 'conserved (default)', speeds: 'Davis (default)', N: [100, 200, 400, 800, 1600, 3200, 6400], boundary: 'transmissive',
      landing: 'last step clipped onto t = 0.2 (all runs land exactly)', L1: 'sum |q_cell - q_exact(x_centre)| dx',
      smooth_window: 'cells farther than 0.04 from head, tail, contact and shock',
      smooth_data_tests: 'entropy wave and isentropic simple wave, N = 50..1600, through an in-memory copy of the method with one IC hook line appended (evolution code byte-identical; file on disk unchanged)',
      plateau_read: 'cell nearest middle of exact plateau, N = 400, 1 % band',
      wave_locators: 'shock: p crossing (p*+pR)/2; contact: rho crossing (rho*L+rho*R)/2; rarefaction head/tail: LSQ line through u in fan interior intersected with u=0 / u=u*',
      oscillation_criterion: 'reviewer (a priori): TV(q)/TV_exact - 1 <= 1 % and global over/undershoot <= 1 % of the jump, for rho, u, p at N = 100..1600',
      check: 'verification/checks/muscl-hancock@sod-t02.check.js (runtime ~6 s)'
    },
    reference: ['sod-exact-profile', 'sod-totals', 'sod-pstar', 'sod-ustar', 'sod-rhostarL', 'sod-rhostarR',
      'sod-x-shock', 'sod-x-contact', 'sod-x-rarefaction-head', 'sod-x-rarefaction-tail', 'sod-modified-exact-profile'],
    gaps: [
      { quantity: 'L1(rho) N=100', value: 6.5806e-3, tolerance: 0.0095, unit: 'L1 (engineering band)', pass: true },
      { quantity: 'L1(rho) N=200', value: 3.5807e-3, tolerance: 0.0052, unit: 'L1 (engineering band)', pass: true },
      { quantity: 'L1(rho) N=400', value: 1.9973e-3, tolerance: 0.0029, unit: 'L1 (engineering band)', pass: true },
      { quantity: 'min overall L1(rho) order N=100..6400 (reviewer window [0.6, 1.2])', value: 0.765, tolerance: 0.6, unit: 'order (lower bound)', pass: true },
      { quantity: 'Sod smooth-window L1(rho) order, finest two pairs (reviewer >= 1.7)', value: 0.991, tolerance: 1.7, unit: 'order (lower bound)', pass: false },
      { quantity: 'smooth-data L1(rho) order, worst over finest two pairs of entropy/simple wave x minmod/van Leer (reviewer >= 1.7)', value: 1.83, tolerance: 1.7, unit: 'order (lower bound)', pass: true },
      { quantity: 'mass drift, max over all runs (vs 0.5625)', value: 5.9e-16, tolerance: 1e-12, unit: 'rel', pass: true },
      { quantity: 'momentum vs 0.9 t = 0.18, max over all runs', value: 2.0e-15, tolerance: 1e-12, unit: 'rel', pass: true },
      { quantity: 'energy drift, max over all runs (vs derived 1.375; reference states 2.75 in error)', value: 4.7e-15, tolerance: 1e-12, unit: 'rel', pass: true },
      { quantity: 'rho*_L plateau N=400', value: 1.7e-4, tolerance: 0.01, unit: 'rel', pass: true },
      { quantity: 'rho*_R plateau N=400', value: 2.4e-5, tolerance: 0.01, unit: 'rel', pass: true },
      { quantity: 'p* plateau N=400 (worse of two reads)', value: 1.2e-5, tolerance: 0.01, unit: 'rel', pass: true },
      { quantity: 'u* plateau N=400 (worse of two reads)', value: 4.1e-5, tolerance: 0.01, unit: 'rel', pass: true },
      { quantity: 'shock position N=200', value: 1.8e-4, tolerance: 0.01, unit: 'abs x', pass: true },
      { quantity: 'contact position N=200', value: 1.4e-3, tolerance: 0.01, unit: 'abs x', pass: true },
      { quantity: 'rarefaction head position N=200', value: 2.5e-3, tolerance: 0.01, unit: 'abs x', pass: true },
      { quantity: 'rarefaction tail position N=200', value: 5.8e-3, tolerance: 0.01, unit: 'abs x', pass: true },
      { quantity: 'u overshoot above u* N=100 (reviewer <= 1 %)', value: 1.31e-2, tolerance: 0.01, unit: 'rel to u*', pass: false },
      { quantity: 'u overshoot above u* N=400', value: 7.8e-3, tolerance: 0.01, unit: 'rel to u*', pass: true },
      { quantity: 'TV(rho) excess N=100 (reviewer <= 1 %)', value: 1.38e-2, tolerance: 0.01, unit: 'rel to exact TV 0.875', pass: false },
      { quantity: 'TV(u) excess N=400 (reviewer <= 1 %)', value: 1.14e-2, tolerance: 0.01, unit: 'rel to exact TV 2u*', pass: false },
      { quantity: 'TV(u) excess N=1600', value: 8.4e-3, tolerance: 0.01, unit: 'rel to exact TV 2u*', pass: true }
    ],
    checks: [
      { name: 'mass/momentum/energy conservation', status: 'pass',
        detail: 'all 7 runs (N=100..6400): rel drift <= 5.9e-16 (mass), 2.0e-15 (momentum vs 0.9t), 4.7e-15 (energy vs 1.375). ' +
          'sod-totals gives energy 2.75, an arithmetic error (0.5*2.5 + 0.5*0.25 = 1.375), already reported by the hllc-godunov review. Compared with 2.75 the error would read 0.5 rel.' },
      { name: 'stability / positivity / CFL', status: 'pass',
        detail: 'No NaN or divergence. Over all steps min rho = 0.125 and min p = 0.1. Realized CFL is 0.9000 (stated bound C <= 1). The positivity fallback never fired (0 cells). All runs land exactly on t = 0.2. ' +
          'Info: C = 1.0 at N = 400 is also stable and positive (L1 rho 2.04e-3).' },
      { name: 'quantitative: L1 and overall convergence', status: 'pass',
        detail: 'L1 rho 6.581e-3, 3.581e-3, 1.997e-3, 1.155e-3, 6.552e-4, 3.855e-4, 2.213e-4 for N = 100..6400. Orders: rho 0.77-0.88, u 0.65-1.37 (non-monotone), p 0.94-1.07. ' +
          'N=100/200/400 match the researcher scratch calibration (6.581e-3/3.581e-3/1.997e-3) to 4 digits. The bands are unpublished engineering bands (~1.4x scratch). L1 rho is 0.38/0.33/0.28 of first-order Godunov-HLLC at N = 200/400/1600.' },
      { name: 'second order in smooth regions: smooth-data tests', status: 'pass',
        detail: 'Same evolution kernel, smooth initial data via an in-memory IC hook. Entropy wave L1(rho) orders: minmod 1.51, 1.57, 1.59, 1.83, 1.89; van Leer 1.73, 2.04, 2.04, 2.10, 2.11 (N = 50..1600). u and p stay constant to 1e-14. ' +
          'Isentropic simple wave: minmod 1.43, 1.78, 1.85, 1.93, 1.91; van Leer 1.86, 1.93, 2.05, 2.04, 2.00.' },
      { name: 'second order in smooth regions: Sod windows (0.04 from waves)', status: 'fail',
        detail: 'Smooth-window L1(rho) orders are 1.29, 1.06, 0.99, 1.00, 1.01, 0.99. The fan interior dominates; its order is 1.00 for every window (0.04 and 0.08), against 0.8 for first-order Godunov. ' +
          'Because the same kernel is second order on smooth data, the reviewer attributes this to O(dx) start-up error from the centred fan, which spreads into the self-similar fan. That attribution is not proven. Under the a priori >= 1.7 criterion this check fails.' },
      { name: 'oscillations / TV increase', status: 'fail',
        detail: 'There is no oscillation train. u has one overshoot just right of the rarefaction tail: +1.31 % of u* at N=100 (x=0.525), +0.78 % at N=400 and +0.46 % at N=1600, shrinking roughly as N^-0.37. Post-shock ripples are < 5e-4 rel. ' +
          'TV excess (rho/u/p): 1.38/1.55/1.31 % at N=100, 1.10/1.38/1.10 % at N=200, 0.89/1.14/0.96 % at N=400, 0.70/1.02/0.76 % at N=800 and 0.63/0.84/0.70 % at N=1600. rho and p never leave the exact range. ' +
          'The reviewer limit of 1 % is exceeded at N <= 200 (rho, p) and N <= 800 (u). Variants: Einfeldt speeds give u overshoot 0.95 % and TV(rho) 1.13 % at N=100; van Leer gives TV(rho) 2.5 %; primitive limiting gives 1.8 %.' },
      { name: 'quantitative: star plateaus (N=400, 1%)', status: 'pass', detail: 'rho*L 0.426247, rho*R 0.265564, p* 0.303130 / 0.303126, u* 0.927458 / 0.927488 (all <= 1.7e-4 rel)' },
      { name: 'quantitative: wave positions (N=200, 0.01)', status: 'pass',
        detail: 'shock 0.85061 (err 1.8e-4), contact 0.68409 (1.4e-3), head 0.26081 (2.5e-3), tail 0.49175 (5.8e-3). The tail is robust across LSQ windows (5.6-6.0e-3). The max-curvature locator gives 0.0116 (info; it is noisy at the cell scale). ' +
          'At N=1600 the errors are <= 7.4e-4. Fitted fan slope at N = 200/400/1600: 4.02/4.09/4.15, exact 4.17.' },
      { name: 'structural: limiter=2 reproduces first-order hllc-godunov', status: 'pass', detail: 'max |diff| in rho,u,p = 1.4e-15 (N=100), 7.3e-15 (N=400)' },
      { name: 'contact resolution vs first order', status: 'pass', detail: 'cells in 10-90% of contact jump: MUSCL 6/8/13 vs Godunov 14/18/36 at N=200/400/1600; shock 1-2 cells for both' },
      { name: 'info: modified Sod (sonic rarefaction)', status: 'pass', detail: 'L1 rho 6.800e-3 (N=100, band 0.0095) and 2.398e-3 (N=400, band 0.0034). This belongs to a different experiment and is recorded as info only.' }
    ],
    missing: [
      'L1 bands in sod-exact-profile are BrowserLab engineering bands (~1.4x researcher scratch errors), not published values (research/hyp.md: no open L1 tables found). The L1 pass shows agreement with the researcher\'s own scratch MUSCL-Hancock, not with literature numbers.',
      'No tolerance exists for L1 in u and p (the experiment quantity names them). They are reported with orders only.',
      'The 1 % TV/overshoot limit, the >= 1.7 smooth-order limit and the [0.6, 1.2] overall-order window are reviewer criteria fixed before the runs from the task protocol hints ("smooth ~2", "overall ~0.7-1", "no oscillations beyond small overshoot"). They are not published tolerances. The reviewer did not relax them after seeing the results.',
      'toro2009 (Sec. 14.4 MUSCL-Hancock, CFL bound, Davis speeds), toro1994hllc, vanleer1979, einfeldt1988, ader2023 and sod1978 are verified:false (secondary copies or snippets; originals not read). The method\'s half-step formula and the van Leer limiter rest on snippets and recollection. ' +
        'The exact solver and star values rest on the open zingale-cha notes and the open sodshock2015 code (verified:true), so the reference values themselves are open.',
      'The attribution of the order-1 error in the Sod fan interior to start-up error from the centred fan is reviewer reasoning, not a cited result.',
      'Smooth-data tests run through an in-memory copy of the method with one appended initial-condition hook line. They are not part of the published sod-t02 protocol.',
      'REFERENCE DEFECT (already reported): sod-totals states energy(t) = 2.75, but the correct value is 1.375. Not yet fixed in references/sod.js.'
    ],
    reviewer: 'reviewer-muscl-hancock-sod-t02-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'flagged',
      reason: 'All reference tolerances pass: L1 rho within the second-order bands, plateaus <0.02 %, waves <0.006 at N=200, conservation <5e-15, positivity, and second order on smooth data. Flagged on two reviewer criteria fixed a priori. (1) TV excess / u overshoot above 1 %: a single overshoot at the rarefaction tail, 1.31 % of u* at N=100, TV(u) excess 1.14 % at N=400. (2) L1 order inside the Sod fan is 1.0, not ~2. Both look inherent to minmod with conserved-variable slopes and to the centred-fan start-up; no implementation defect was found.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
