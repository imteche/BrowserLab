/* Verification record: hll-swe @ swe-wet. Reviewer: reviewer-hll-swe-swe-wet-r1 (not the builder).
 * Numbers from verification/checks/hll-swe@swe-wet.check.js; report in verification/reports/hll-swe@swe-wet.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'hll-swe@swe-wet',
    method: 'hll-swe', scene: 'swe-dambreak', experiment: 'swe-wet',
    status: 'matched',
    claim: 'First-order HLL (Einfeldt speeds) on the Stoker wet-bed dam break (hl = 0.005 m, hr = 0.001 m, x0 = 5 m, L = 10 m, t = 6 s) ' +
      'reproduces the exact solution: plateau depth h_m within 0.17% / 0.075% / 0.040% at N = 200/400/800 (tolerance 1%), relative L1 depth error ' +
      '7.548e-3 / 4.326e-3 at N = 200/400 (engineering bands 0.0126 / 0.0073), converging at observed order 0.76-0.93 up to N = 6400, shock position within ' +
      '0.0077 m at N = 200 (0.15 cell) and converging, mass conserved to <= 2.6e-13 rel and momentum equal to g/2 (hl^2-hr^2) t to <= 3.8e-15 rel, ' +
      'energy non-increasing at every step, positive depths with no clipping at CFL 0.9.',
    conditions: {
      hl: 0.005, hr: 0.001, x0: 5, L: 10, g: 9.81, t: 6, CFL: 0.9, hDry: 1e-12,
      N: [100, 200, 400, 800, 1600, 3200, 6400], boundary: 'transmissive (waves stay inside the domain at t = 6)',
      landing: 'last step clipped onto t = 6 (all runs land exactly)',
      L1: 'sum |h_i - h_exact(x_i)| dx / sum h_exact(x_i) dx at cell centres (cell-average variant reported as info)',
      plateau_read: 'cell nearest the middle of the exact plateau [x_B, x_C] = [4.8167, 6.2598]',
      shock_locator: 'linear-interpolated crossing of h = (h_m + h_r)/2; exact x_C = 6.25978 m',
      check: 'verification/checks/hll-swe@swe-wet.check.js (runtime ~2 s)'
    },
    reference: ['swe-dambreak-stoker', 'swe-stoker-hm-swashes', 'swe-dambreak-totals'],
    gaps: [
      { quantity: 'relL1(h) N=200', value: 7.548e-3, tolerance: 0.0126, unit: 'rel L1 (engineering band)', pass: true },
      { quantity: 'relL1(h) N=400', value: 4.326e-3, tolerance: 0.0073, unit: 'rel L1 (engineering band)', pass: true },
      { quantity: 'plateau h_m N=200 (vs 0.0025393571723 m)', value: 1.71e-3, tolerance: 0.01, unit: 'rel', pass: true },
      { quantity: 'plateau h_m N=400', value: 7.47e-4, tolerance: 0.01, unit: 'rel', pass: true },
      { quantity: 'plateau h_m N=800', value: 4.04e-4, tolerance: 0.01, unit: 'rel', pass: true },
      { quantity: 'plateau u_m N=400 (vs 0.12728 m/s; reviewer: same 1% band as h_m)', value: 2.37e-3, tolerance: 0.01, unit: 'rel', pass: true },
      { quantity: 'min observed relL1(h) order N=100..6400 (reviewer window [0.5, 1.05])', value: 0.764, tolerance: 0.5, unit: 'order (lower bound)', pass: true },
      { quantity: 'mass drift vs 0.03 m^2, max over all runs/steps', value: 2.6e-13, tolerance: 1e-12, unit: 'rel', pass: true },
      { quantity: 'momentum vs g/2 (hl^2-hr^2) t, max over all runs/steps', value: 3.8e-15, tolerance: 1e-12, unit: 'rel', pass: true },
      { quantity: 'shock position N=200 (reviewer: |err| <= 1 dx = 0.05 m)', value: 7.71e-3, tolerance: 0.05, unit: 'm', pass: true },
      { quantity: 'shock position N=400 (reviewer: |err| <= 1 dx = 0.025 m)', value: 6.14e-3, tolerance: 0.025, unit: 'm', pass: true },
      { quantity: 'shock position N=800 (reviewer: |err| <= 1 dx = 0.0125 m)', value: 3.98e-3, tolerance: 0.0125, unit: 'm', pass: true }
    ],
    checks: [
      { name: 'reference sanity (independent re-derivation)', status: 'pass',
        detail: 'reviewer bisection of integral curve u = 2(sqrt(g hl) - sqrt(g h)) vs Hugoniot locus gives h_m = 0.0025393571723 m (rel diff to reference 0, to orchestrator value 6.6e-12 = its print precision), ' +
          'u_m = 0.12728 m/s, shock speed 0.209963 m/s equal to RH mass speed; RH momentum residual 0. The corrected c_m equation is confirmed.' },
      { name: 'mass/momentum conservation', status: 'pass',
        detail: 'all 7 runs, every step: mass vs 0.03 m^2 rel drift <= 2.6e-13 (N=6400; 8e-16 at N=100, growth is summation round-off over 1216 steps x 6400 cells); ' +
          'momentum vs g/2 (hl^2-hr^2) t <= 3.8e-15. Boundary mass fluxes are zero (waves never reach x = 0 or 10).' },
      { name: 'energy', status: 'pass',
        detail: 'E non-increasing at every step of every run (max per-step increase 0). Exact Stoker loss by t = 6: 0.696% of E0; numeric loss 1.217% (N=200), 0.998% (N=400), 0.726% (N=6400): ' +
          'excess numerical dissipation 5.2e-3 -> 3.0e-4, converging at ~0.8 order (info, no reference tolerance).' },
      { name: 'stability / positivity / CFL', status: 'pass',
        detail: 'no NaN or divergence; realized CFL = 0.9000 (criterion C <= 1); min h = 0.001 m = h_r (no undershoot), 0 negative-depth clips; all runs land on t = 6 exactly.' },
      { name: 'quantitative: L1 depth and convergence', status: 'pass',
        detail: 'relL1(h) 1.359e-2, 7.548e-3, 4.326e-3, 2.542e-3, 1.497e-3, 7.879e-4, 4.347e-4 for N = 100..6400; orders 0.85, 0.80, 0.77, 0.76, 0.93, 0.86. ' +
          'relL1(u) 9.25e-2 ... 2.92e-3 (orders 0.76-0.94; no tolerance exists for u). Identical to researcher scratch HLL calibration (7.548e-3 / 4.326e-3) to 4 digits; bands are unpublished engineering bands (~1.7x).' },
      { name: 'quantitative: plateau (1%)', status: 'pass', detail: 'h_m rel err 6.0e-3, 1.7e-3, 7.5e-4, 4.0e-4, 2.1e-4, 1.0e-4, 5.1e-5 (N=100..6400); u_m rel err 4.4e-3 (N=100) ... 1.8e-4 (N=6400).' },
      { name: 'quantitative: shock position', status: 'pass',
        detail: 'x_shock - x_C = -0.0066, -0.0077, -0.0061, -0.0040, -0.0026, -0.0015, -0.0009 m (N=100..6400), i.e. 0.07-0.57 cells behind; 10-90% width 2-3 cells. ' +
          'Reviewer criterion (no reference tolerance): |err| <= 1 dx.' }
    ],
    missing: [
      'swashes2013 is registered verified:false (access: secondary-copy): arXiv/HAL PDF unreachable from the research container; Sec. 4.1.1 formulas were read in tilupy 2.1.1, ' +
        'whose c_m equation is wrong (dimensionally inconsistent). The reference uses a corrected c_m equation re-derived from riemannbook2020; the orchestrator and this reviewer ' +
        're-derived h_m independently (agreement to round-off). Which form the SWASHES PDF prints was not checked.',
      'Stoker set-up h_r = 0.001 m and t = 6 s come from researcher recollection, not from a retrieved text (hl = 0.005, x0 = 5, L = 10 are snippet-confirmed). The comparison is ' +
        'exact for the stated configuration; whether it is literally the SWASHES 4.1.1 configuration is unverified.',
      'stoker1957 original not read (verified:false); the solution rests on the open riemannbook2020 exact Riemann solver.',
      'L1 depth bands in swe-dambreak-stoker are BrowserLab engineering bands (~1.4-1.7x researcher scratch HLL errors), not published values; the L1 pass shows agreement with the researcher\'s own scratch HLL, not with literature numbers.',
      'swe-stoker-hm-swashes is a computed (not published) value. Its 1% numerical-scheme tolerance is a BrowserLab choice.',
      'No reference tolerance exists for u(x) L1, shock position or energy; the shock criterion (|err| <= 1 dx), u_m 1% band and order window [0.5, 1.05] are reviewer criteria.'
    ],
    reviewer: 'reviewer-hll-swe-swe-wet-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'matched',
      reason: 'All 12 gaps within tolerance: h_m 0.17%/0.075% at N=200/400, relL1(h) 7.55e-3/4.33e-3 within engineering bands, order ~0.8, shock within 0.15-0.25 cell, mass 2.6e-13, momentum 3.8e-15, energy monotone, positive, CFL 0.9. Reference h_m re-derived independently. Source caveats (verified:false SWASHES, recollected hr/T, unpublished bands) recorded in missing.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
