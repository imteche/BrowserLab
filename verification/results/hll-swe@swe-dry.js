/* Verification record: hll-swe @ swe-dry. Reviewer: reviewer-hll-swe-swe-dry-r1 (not the builder).
 * Numbers from verification/checks/hll-swe@swe-dry.check.js; report in verification/reports/hll-swe@swe-dry.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'hll-swe@swe-dry',
    method: 'hll-swe', scene: 'swe-dambreak', experiment: 'swe-dry',
    status: 'flagged',
    claim: 'First-order HLL/Einfeldt on the SWASHES Ritter dry-bed dam break (hl = 0.005 m, x0 = 5 m, L = 10 m, t = 6 s) is within the first-order relative L1 depth ' +
      'bands (1.165e-2 / 6.809e-3 vs 0.017 / 0.010 at N = 200 / 400), converges at order 0.73-0.80, keeps h >= 0 with no clipping, conserves mass to 2e-14 and is stable at CFL 0.9 (and 1.0). ' +
      'It is flagged because the wet/dry front (h > 1e-6 hl) lags the exact front x_B = 7.6577 m by 0.508 m (10.2 cells) at N = 200 and 0.433 m (17.3 cells) at N = 400, ' +
      'outside a several-cell band (5 cells), converging only at order ~0.35 (0.170 m at N = 6400); an independent HLLE re-implementation reproduces the same lag to the cell, so it is inherent first-order behaviour. ' +
      'Secondary: the default dry threshold hDry = 1e-12 zeroes hu in near-dry cells and loses 3.1e-11 (N = 200) to 1.1e-10 (N = 6400) of the momentum (tolerance 1e-12); with hDry = 0 momentum is exact.',
    conditions: {
      t: 6, g: 9.81, hl: 0.005, hr: 0, x0: 5, L: 10, CFL: 0.9, hDry: 1e-12, boundary: 'transmissive', landing: 'last step clipped onto t = 6 (all runs land exactly)',
      N: [100, 200, 400, 800, 1600, 3200, 6400],
      L1: 'relL1(h) = sum|h_i - h_ex(x_i)| dx / sum h_ex(x_i) dx at cell centres',
      front: 'right face of the last cell with h > 1e-6 hl (reference suggestion); also 1e-3 hl, 1e-2 hl as info',
      front_band: '5 cells (reviewer reading of the reference text "band of several cells"; no number given)',
      check: 'verification/checks/hll-swe@swe-dry.check.js (runtime ~2 s)'
    },
    reference: ['swe-dambreak-ritter', 'swe-dambreak-totals'],
    gaps: [
      { quantity: 'relL1(h) N=200', value: 1.1647e-2, tolerance: 0.017, unit: 'rel L1 (engineering band)', pass: true },
      { quantity: 'relL1(h) N=400', value: 6.8093e-3, tolerance: 0.010, unit: 'rel L1 (engineering band)', pass: true },
      { quantity: '|front(h>1e-6 hl) - x_B| N=200 (lag)', value: 0.5077, tolerance: 0.25, unit: 'm (5 cells)', pass: false },
      { quantity: '|front(h>1e-6 hl) - x_B| N=400 (lag)', value: 0.4327, tolerance: 0.125, unit: 'm (5 cells)', pass: false },
      { quantity: 'mass rel drift vs x0 hl = 0.025, max over N', value: 2.0e-14, tolerance: 1e-12, unit: 'rel', pass: true },
      { quantity: 'momentum vs g/2 hl^2 t = 7.3575e-4, max rel over N (hDry = 1e-12 default)', value: 1.07e-10, tolerance: 1e-12, unit: 'rel', pass: false },
      { quantity: 'min h over all steps and N (positivity)', value: 0, tolerance: 0, unit: 'm (>= 0)', pass: true }
    ],
    checks: [
      { name: 'mass conservation', status: 'pass',
        detail: 'all 7 runs: |mass - 0.025|/0.025 <= 2.0e-14 (no flux through either end: cell 1 stays hl, cell N stays dry). Zero negative-depth clips.' },
      { name: 'momentum conservation', status: 'fail',
        detail: 'rel error vs g/2 hl^2 t: 0 (N=100), 3.1e-11 (200), 4.7e-11 (400) ... 1.07e-10 (6400) > 1e-12. Cause: step() sets hu = 0 where h <= hDry. ' +
          'Scales with hDry at N=200: hDry 0 -> 0, 1e-15 -> 1.3e-14, 1e-12 -> 3.1e-11, 1e-10 -> 2.7e-9, 1e-8 -> 4.8e-7. Documented as a design assumption; physically negligible but non-conservative.' },
      { name: 'stability / positivity / CFL', status: 'pass',
        detail: 'no NaN or divergence; min h = 0 over every step of every run, 0 clips; realised CFL 0.9000 (bound C <= 1). Info at N=400: C = 1.0 and C = 0.5 also positive (relL1 6.69e-3 / 7.52e-3); hDry = 0 runs positive and clip-free.' },
      { name: 'energy (info)', status: 'pass',
        detail: 'E monotonically non-increasing every step (0 increases); E(6)/E0 - 1 = -1.85e-2, -1.09e-2, -6.34e-3, -3.64e-3, -2.07e-3, -1.16e-3, -6.47e-4 for N = 100..6400 (exact Ritter conserves energy; loss is numerical dissipation, first order).' },
      { name: 'quantitative: relative L1 depth', status: 'pass',
        detail: 'relL1(h) 1.936e-2, 1.165e-2, 6.809e-3, 4.017e-3, 2.364e-3, 1.375e-3, 7.901e-4 for N = 100..6400; orders 0.73, 0.77, 0.76, 0.77, 0.78, 0.80. ' +
          'Researcher scratch HLL: 1.146e-2 / 6.771e-3 (within 1.6% / 0.6%). L1(u) (info, no tolerance): 0.289 ... 0.070 m^2/s, order ~0.35, dominated by the front region.' },
      { name: 'quantitative: wet/dry front position', status: 'fail',
        detail: 'front(h > 1e-6 hl) - x_B = -0.458 (N=100), -0.508 (200), -0.433 (400), -0.358 (800), -0.283 (1600), -0.220 (3200), -0.170 m (6400): a lag of 4.6, 10.2, 17.3, 28.6, 45, 70, 109 cells; order ~0.35 in metres. ' +
          'Same picture at thresholds 1e-3 hl and 1e-2 hl and against the exact position where h_ex = threshold. The time-step count (47 steps at N=200) is below the 53 cells the exact front crosses: ' +
          'u + 2c in the smeared front cells is below 2 sqrt(g hl), so the numerical front speed is too low. Rarefaction head (h < hl(1-1e-6)) leads x_A by 0.72 m at N=200 (info, smearing).' },
      { name: 'independent re-implementation (info)', status: 'pass',
        detail: 'reviewer HLLE written from clawpack shallow_hll_1D formulas, hDry = 0: relL1(h) equal to 1e-12 and identical step counts and front positions at N = 200, 400, 1600, with momentum exact (1e-15). ' +
          'So the front lag is inherent to first-order HLLE, not an implementation defect; the momentum defect comes only from the hDry zeroing.' }
    ],
    missing: [
      'swashes2013 is verified:false (secondary copy): arXiv/HAL PDF unreachable; Ritter formulas read in tilupy analytic_sol.Ritter_dry. ritter1892 original not read (verified:false). The Ritter solution itself is classical and closed-form, so reference values are determined.',
      'Test set-up hl = 0.005, x0 = 5, L = 10 confirmed only by search snippets (swashes2013, fullswof2014 verified:false); t = 6 s is from recollection (not seen in any retrieved text).',
      'L1 bands are BrowserLab engineering bands (~1.4x researcher scratch errors), not published values; passing them shows agreement with the researcher\'s scratch HLL, not with literature numbers.',
      'No numeric front tolerance in the reference ("band of several cells"); reviewer used 5 cells. The lag (10 and 17 cells at N = 200/400) also exceeds a 10-cell band at N = 400, so the verdict does not hinge on this choice.',
      'No tolerance for u(x) (the experiment quantity names it); L1(u) reported as info only.',
      'hll1983 and einfeldt1988 originals not read (verified:false); the scheme was checked against an independent re-implementation from the open riemannbook2020/clawpack formulas.'
    ],
    reviewer: 'reviewer-hll-swe-swe-dry-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'flagged',
      reason: 'Wet/dry front (h > 1e-6 hl) lags the exact Ritter front by 0.508 m (10 cells) at N=200 and 0.433 m (17 cells) at N=400, outside a several-cell band; converges at order ~0.35, reproduced exactly by an independent HLLE, so inherent first-order behaviour. Momentum off by 3e-11..1e-10 rel (tol 1e-12) because hu is zeroed where h <= hDry = 1e-12 (exact with hDry = 0). L1 depth within bands (1.165e-2, 6.809e-3), mass to 2e-14, h >= 0, stable.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
