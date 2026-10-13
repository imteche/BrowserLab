/* Verification record: stormer-verlet @ kepler-e06. Reviewer: reviewer-pilot (not the builder).
 * Numbers from verification/checks/stormer-verlet@kepler-e06.check.js; report in
 * verification/reports/stormer-verlet@kepler-e06.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'stormer-verlet@kepler-e06',
    method: 'stormer-verlet', scene: 'kepler', experiment: 'kepler-e06',
    status: 'matched',
    claim: 'Störmer–Verlet on Kepler (e = 0.6) reproduces the theoretical behaviour stated by Hairer–Lubich–Wanner: ' +
      'order-2 energy and global error (observed 2.001 / 1.9995 against the exact Kepler solution), bounded energy error with no drift ' +
      'over 1000 periods (rel. max 7.41e-4 at h = 0.01, envelope slope -2.2e-13 per period), linear global-error growth (k = 1.001), ' +
      'and angular momentum conserved to round-off (max |L - L0| = 6.8e-14).',
    conditions: {
      e: 0.6, order_protocol: 't_end = 10.5T (apocentre), h = 1e-2, 5e-3, 2.5e-3',
      growth_protocol: 'h = 1e-2, t1 = 10.5T, t2 = 40.5T (also 10.5T..160.5T fit)',
      long_run: 'h = 1e-2, 1000 periods (628319 steps)', large_h_info: 'h = 0.05, 0.1, 0.2 for 100 periods',
      reversibility: 'N steps at +h then N steps at -h (setParam), N = 6597 and 62832',
      check: 'verification/checks/stormer-verlet@kepler-e06.check.js'
    },
    reference: ['kepler-exact-solution', 'kepler-H0', 'kepler-L0', 'kepler-order-energy-stormer-verlet',
      'kepler-order-global-stormer-verlet', 'kepler-growth-global-stormer-verlet', 'kepler-growth-energy-stormer-verlet',
      'kepler-L-conservation'],
    gaps: [
      { quantity: 'observed order of max energy error, h=1e-2 -> 5e-3 (theory 2)', value: 2.0006, tolerance: 0.3, unit: '|p_obs - 2|: 0.0006', pass: true },
      { quantity: 'observed order of global error at t_N ~ 10.5T, h=1e-2 -> 5e-3 (theory 2)', value: 1.9995, tolerance: 0.3, unit: '|p_obs - 2|: 0.0005', pass: true },
      { quantity: 'observed order of max energy error, h=5e-3 -> 2.5e-3 (theory 2)', value: 2.0001, tolerance: 0.3, unit: 'order', pass: true },
      { quantity: 'observed order of global error, h=5e-3 -> 2.5e-3 (theory 2)', value: 2.0000, tolerance: 0.3, unit: 'order', pass: true },
      { quantity: 'time-growth exponent of global error, 10.5T -> 40.5T, h=1e-2 (theory 1)', value: 1.0007, tolerance: 0.3, unit: 'exponent', pass: true },
      { quantity: 'time-growth exponent of max energy error, 10.5T -> 40.5T, h=1e-2 (theory 0)', value: 1.75e-8, tolerance: 0.3, unit: 'exponent', pass: true },
      { quantity: 'max |L_n - L0| over all runs (h <= 1e-2, up to 1000T)', value: 6.79e-14, tolerance: 1e-12, unit: 'abs', pass: true },
      { quantity: '|H(y0) - H0| and |L(y0) - L0| (initial conditions)', value: 0, tolerance: 1e-14, unit: 'abs', pass: true }
    ],
    checks: [
      { name: 'energy, long run (bounded, no drift)', status: 'pass',
        detail: '1000 periods at h=0.01: per-period max |dH|/|H0| between 7.41356e-4 and 7.41361e-4; LSQ slope -2.2e-13/period ' +
          '(projected change over run -3e-7 of the mean); last-100 max <= first-100 max. Non-symplectic Heun baseline at same h drifts at 2.0e-4/period (12x in 100T). ' +
          'Reviewer criterion: |slope*1000T| < 5% of mean and last-100 max <= 1.05 x first-100 max.' },
      { name: 'angular momentum conservation', status: 'pass', detail: 'max |L-L0| = 6.8e-14 over 1000T (tol 1e-12, kepler-L-conservation)' },
      { name: 'stability', status: 'pass',
        detail: 'no NaN/divergence in any run. Info: 100T at h=0.05/0.1/0.2 stay bounded, rel. max energy error 1.9e-2 / 7.8e-2 / 0.51; L still conserved (<1.4e-14); orbit phase error O(1). No reference criterion for large h.' },
      { name: 'quantitative (orders, growth)', status: 'pass', detail: 'all four order/growth references within +-0.3; apocentre log-log fit 10.5T..160.5T gives k = 1.007' },
      { name: 'sampling sensitivity (whole period 10T)', status: 'pass', detail: 'info: orders at t_end = 10T are 2.0006 (energy), 1.977 / 1.998 (global); conclusion not sensitive to apocentre vs pericentre sampling at these h' },
      { name: 'time reversibility', status: 'pass', detail: 'forward N steps at +h, back N at -h: |y - y0| = 1.3e-11 (N=6597), 2.4e-10 (N=62832); round-off level. Structural extra check, not tied to a reference.' }
    ],
    missing: [
      'All theoretical references cite sources registered verified:false (search-snippet access only; hlw2003, hlw2006, hairer1999notes PDFs unreachable). ' +
        'The cited section/theorem locations (hlw2003 Sec. 4-5, hlw2006 Thm IX.8.1 / Sec. X.3) are unverified.',
      'No numeric values from HLW figures (e.g. energy-error amplitude at a given h) were extracted, so the result is checked against theoretical orders/growth laws ' +
        'and an analytically derived exact solution, not against published figure numbers.',
      'Order/growth protocols (h, t_end, apocentre sampling) are the researcher\'s pilot choices, not source protocols.',
      'Long-run drift criterion (5% of mean envelope over 1000T) is reviewer-set; no source gives a numeric drift bound.',
      'Matched status rests on the reference values being standard, uncontested theory (order 2, bounded energy, linear growth, exact L) evaluated against an independently tested exact solution; re-review if full-text access changes any cited claim or protocol.'
    ],
    reviewer: 'reviewer-pilot', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'matched',
      reason: 'All 8 quantitative gaps within tolerance; energy bounded without drift over 1000T; L conserved to 7e-14; stable; reversible. Sources snippet-only (verified:false), recorded in missing.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
