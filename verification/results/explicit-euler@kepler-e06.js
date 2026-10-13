/* Verification record: explicit-euler @ kepler-e06. Reviewer: reviewer-explicit-euler-kepler-e06-r1 (not the builder).
 * Numbers from verification/checks/explicit-euler@kepler-e06.check.js; report in
 * verification/reports/explicit-euler@kepler-e06.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'explicit-euler@kepler-e06',
    method: 'explicit-euler', scene: 'kepler', experiment: 'kepler-e06',
    status: 'matched',
    claim: 'Explicit Euler on Kepler (e = 0.6) reproduces the theoretical behaviour stated by Hairer (lecture notes) and Hairer–Lubich–Wanner: ' +
      'order-1 energy and global error at t_end = T (observed 0.963 / 0.998 against the exact Kepler solution), secular linear energy drift ' +
      '(growth exponent 0.999; H(nT) - H0 positive, monotone and linear in n with r^2 >= 0.998, drift rate proportional to h), ' +
      'quadratic global-error growth (k = 2.000), angular momentum not conserved (per-step change equals h^2 p x F to 3e-16), and an outward spiral.',
    conditions: {
      e: 0.6, order_protocol: 't_end = T, h = 1e-4, 5e-5 (published pair) and 2.5e-5 (info)',
      growth_protocol: 'h = 1e-6, t1 = T, t2 = 4T (25.1M steps), also 2T and 3T samples for a log-log fit',
      secular_drift: 'H(nT) - H0 at n = 1..20 for h = 1e-4 and 5e-5; h = 1e-3 info only',
      figure_protocol: 'h = 5e-4 (inferred), t = 200 (4e5 steps), qualitative spiral-out',
      check: 'verification/checks/explicit-euler@kepler-e06.check.js (about 3 s)'
    },
    reference: ['kepler-exact-solution', 'kepler-H0', 'kepler-L0', 'kepler-order-energy-explicit-euler',
      'kepler-order-global-explicit-euler', 'kepler-growth-global-explicit-euler', 'kepler-growth-energy-explicit-euler',
      'kepler-L-conservation', 'kepler-hairer-figure-protocol'],
    gaps: [
      { quantity: 'observed order of max energy error at t_end = T, h=1e-4 -> 5e-5 (theory 1)', value: 0.9625, tolerance: 0.3, unit: 'order (|p_obs - 1| = 0.037)', pass: true },
      { quantity: 'observed order of global error at t_end = T, h=1e-4 -> 5e-5 (theory 1)', value: 0.9976, tolerance: 0.3, unit: 'order (|p_obs - 1| = 0.002)', pass: true },
      { quantity: 'observed order of max energy error, h=5e-5 -> 2.5e-5 (theory 1)', value: 0.9816, tolerance: 0.3, unit: 'order', pass: true },
      { quantity: 'observed order of global error, h=5e-5 -> 2.5e-5 (theory 1)', value: 0.9993, tolerance: 0.3, unit: 'order', pass: true },
      { quantity: 'time-growth exponent of global error, T -> 4T, h=1e-6 (theory 2)', value: 1.9999, tolerance: 0.3, unit: 'exponent', pass: true },
      { quantity: 'time-growth exponent of max energy error, T -> 4T, h=1e-6 (theory 1)', value: 0.9989, tolerance: 0.3, unit: 'exponent', pass: true },
      { quantity: 'energy drift rate scaling with h: (slope/h at 1e-4) / (slope/h at 5e-5) (theory 1, O(h t))', value: 0.9454, tolerance: 0.3, unit: 'ratio', pass: true },
      { quantity: '|H(y0) - H0| and |L(y0) - L0| (initial conditions)', value: 0, tolerance: 1e-14, unit: 'abs', pass: true }
    ],
    checks: [
      { name: 'energy (secular linear drift, as theory requires)', status: 'pass',
        detail: 'H(nT) - H0 > 0 and strictly increasing for n = 1..20. h=1e-4: slope 2.04e-3 per period, r^2 = 0.9976, 8% of |H0| by 20T; ' +
          'h=5e-5: slope 1.08e-3 per period, r^2 = 0.99989. Drift rate / h = 20.4 vs 21.6 (ratio 0.945). Max energy error never below H0 (min signed 0). ' +
          'Info: h=1e-3 drifts 0.21 (42% of |H0|) by 20T; the orbit period then changes, so whole-period sampling is no longer phase-locked (r^2 0.95); not used for pass/fail.' },
      { name: 'angular momentum (not conserved, as kepler-L-conservation states)', status: 'pass',
        detail: 'max |L-L0| over T = 9.5e-4 / 4.8e-4 / 2.4e-4 at h = 1e-4 / 5e-5 / 2.5e-5 (O(h), ratio 1.97). Per-step change L_{n+1}-L_n matches h^2 p_n x F(q_n) to 2.9e-16 over one period at h=1e-3, confirming the discretisation is the stated scheme.' },
      { name: 'stability', status: 'pass',
        detail: 'no NaN or divergence in any run (up to 25.1M steps). The method has no bounded-energy step size by design (stated criterion: energy grows for every h > 0); at h <= 1e-4 the practical-accuracy criterion of the method holds for one period (global error 0.14 at h=1e-4, 1.4e-3 at h=1e-6).' },
      { name: 'quantitative (orders, growth)', status: 'pass', detail: 'all four order/growth references within +-0.3 (worst |gap| 0.037); second pairs and log-log fits (k = 2.000, 0.999) agree' },
      { name: 'qualitative Hairer figure protocol (spiral out)', status: 'pass',
        detail: 'h = 5e-4 for t = 200: H - H0 = +0.189 (38% of |H0|), never negative; final radius 2.35 vs aphelion 1.6 of the exact orbit. Matches "explicit Euler spirals outward". h inferred, not read.' }
    ],
    missing: [
      'All theoretical references cite sources registered verified:false (search-snippet access only; hlw2006, hairer1999notes, blanes2008splitting PDFs not consulted in full). ' +
        'The cited locations (Kepler long-time table in hairer1999notes, hlw2006 Sec. I.1/I.2.3) are unverified.',
      'No numeric values from the Hairer figures/table (e.g. energy-error magnitude at a given h) were extracted; the result is checked against theoretical orders/growth laws ' +
        'and an analytically derived exact solution, not against published figure numbers.',
      'Order/growth protocols (h, t_end) are the researcher\'s pilot choices, not source protocols. The Hairer figure step h = 5e-4 is inferred from "100 times larger".',
      'The secular-drift criterion (monotone, r^2 >= 0.99, slope proportional to h within 0.3) is reviewer-set; no source gives a numeric drift rate.',
      'Matched status rests on the reference values being standard, uncontested theory (order 1, linear energy drift, quadratic error growth, L not conserved); re-review if full-text access changes any cited claim or protocol.'
    ],
    reviewer: 'reviewer-explicit-euler-kepler-e06-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'matched',
      reason: 'All 8 quantitative gaps within tolerance (orders 0.963/0.998, growth 2.000/0.999); energy drift secular, linear in t and h; L change equals h^2 p x F; stable; spirals outward. Sources snippet-only (verified:false), recorded in missing.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
