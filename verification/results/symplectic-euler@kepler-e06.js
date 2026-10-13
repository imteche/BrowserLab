/* Verification record: symplectic-euler @ kepler-e06. Reviewer: reviewer-symplectic-euler-kepler-e06-r1 (not the builder).
 * Numbers from verification/checks/symplectic-euler@kepler-e06.check.js; report in
 * verification/reports/symplectic-euler@kepler-e06.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'symplectic-euler@kepler-e06',
    method: 'symplectic-euler', scene: 'kepler', experiment: 'kepler-e06',
    status: 'matched',
    claim: 'Symplectic Euler (p-first variant) on Kepler (e = 0.6) reproduces the theoretical behaviour stated by Hairer et al.: ' +
      'order-1 energy error (observed 1.003) and order-1 global error at half periods (observed 0.936 / 0.969) against the exact Kepler solution, ' +
      'bounded energy error without drift over 1000 periods (rel. max 2.73e-3 at h = 1e-3, envelope slope -2.3e-15 per period), ' +
      'linear global-error growth at whole periods (k = 0.9998), and angular momentum conserved to round-off (max |L - L0| = 1.7e-13).',
    conditions: {
      e: 0.6, order_protocol: 't_end = 10.5T (apocentre), h = 5e-4, 2.5e-4, 1.25e-4',
      growth_protocol: 'h = 1e-3, t1 = 10T, t2 = 40T (whole periods; also LSQ fit over 10..160T)',
      long_run: '1000 periods at h = 1e-3 (6,283,186 steps) and at h = 1e-2 (628,319 steps)',
      precession_info: 'Hairer figure protocol h = 0.05, 4000 steps; and h = 1e-3, 40T',
      large_h_info: 'h = 0.05, 0.1, 0.2 for 100 periods',
      check: 'verification/checks/symplectic-euler@kepler-e06.check.js'
    },
    reference: ['kepler-exact-solution', 'kepler-H0', 'kepler-L0', 'kepler-order-energy-symplectic-euler',
      'kepler-order-global-symplectic-euler', 'kepler-growth-global-symplectic-euler', 'kepler-growth-energy-symplectic-euler',
      'kepler-L-conservation', 'kepler-hairer-figure-protocol', 'kepler-runge-lenz'],
    gaps: [
      { quantity: 'observed order of max energy error, h=5e-4 -> 2.5e-4, t_end = 10.5T (theory 1)', value: 1.0027, tolerance: 0.3, unit: 'order (|p-1| = 0.003)', pass: true },
      { quantity: 'observed order of global error at t_N = 10.5T, h=5e-4 -> 2.5e-4 (theory 1)', value: 0.9361, tolerance: 0.3, unit: 'order (|p-1| = 0.064)', pass: true },
      { quantity: 'observed order of max energy error, h=2.5e-4 -> 1.25e-4 (theory 1)', value: 1.0013, tolerance: 0.3, unit: 'order', pass: true },
      { quantity: 'observed order of global error, h=2.5e-4 -> 1.25e-4 (theory 1)', value: 0.9689, tolerance: 0.3, unit: 'order', pass: true },
      { quantity: 'time-growth exponent of global error, 10T -> 40T, h=1e-3 (theory 1)', value: 0.9998, tolerance: 0.3, unit: 'exponent', pass: true },
      { quantity: 'time-growth exponent of max energy error, 10T -> 40T, h=1e-3 (theory 0)', value: 8.1e-9, tolerance: 0.3, unit: 'exponent', pass: true },
      { quantity: 'max |L_n - L0| over all runs (h <= 1e-2, up to 1000T)', value: 1.69e-13, tolerance: 1e-12, unit: 'abs', pass: true },
      { quantity: '|H(y0) - H0| and |L(y0) - L0| (initial conditions)', value: 0, tolerance: 1e-14, unit: 'abs', pass: true }
    ],
    checks: [
      { name: 'energy, long run (bounded, no drift)', status: 'pass',
        detail: '1000T at h=1e-3: per-period max |dH|/|H0| in [2.730789e-3, 2.730799e-3], LSQ slope -2.3e-15/period (projected change -8.6e-10 of mean); ' +
          '1000T at h=1e-2: 2.918e-2, slope -4.2e-11/period (-1.4e-6 of mean); last-100 max <= 1.05 x first-100 max in both. ' +
          'Reviewer criterion (same as the stormer-verlet review): |slope*1000T| < 5% of mean. dH ~ 1.37 h, i.e. O(h) as claimed.' },
      { name: 'angular momentum conservation', status: 'pass', detail: 'max |L-L0| = 1.7e-13 over 6.3e6 steps (tol 1e-12, kepler-L-conservation)' },
      { name: 'stability', status: 'pass',
        detail: 'no NaN/divergence in any run. Info: 100T at h=0.05/0.1/0.2 rel. max energy error 0.19 / 0.53 / 2.27 (at h=0.2 the pericentre is unresolved, as the method notes warn); L still conserved < 6e-15. No reference criterion for large h.' },
      { name: 'quantitative (orders, growth)', status: 'pass', detail: 'all four order/growth references within +-0.3 (both h pairs for orders); whole-period LSQ fit 10..160T gives k = 0.999' },
      { name: 'superconvergence artefact (whole period 10T)', status: 'pass', detail: 'info: global order at t=10T is 2.000 / 2.000 (h=1e-3..2.5e-4), reproducing the documented conjugacy-to-Verlet pitfall; at half periods the bounded O(h) offset dominates growth (err 5.4e-3 at 10.5T, 2.8e-3 at 40.5T, 1.2e-2 at 160.5T)' },
      { name: 'precession direction (diagnostic)', status: 'pass', detail: 'Runge-Lenz angle after 4000 steps at h=0.05: -0.260 rad (clockwise), consistent with hairer1999notes snippet; at h=1e-3 over 40T: -2.6e-4 rad (clockwise). Qualitative, variant of the source figure unconfirmed.' },
      { name: 'update rule', status: 'pass', detail: 'first step from y0 at h=0.01 equals the stated p-first map p1 = p0 + hF(q0), q1 = q0 + h p1 to 6.9e-18' }
    ],
    missing: [
      'All theoretical references cite sources registered verified:false (hairer1999notes, hairer2010week2, blanes2008splitting: search-snippet access only; hlw2006: secondary copy, paywalled). ' +
        'Cited locations (hlw2006 Thm IX.8.1, Sec. X.3, Sec. I.2.3; Hairer notes Kepler table/figure) are unverified.',
      'No numeric values were extracted from source figures/tables (e.g. Hairer long-time table amplitudes), so the check is against theoretical orders/growth laws and the analytically derived exact solution, not published numbers.',
      'Which symplectic-Euler variant the hairer1999notes figure uses is unconfirmed, so the clockwise-precession agreement is a diagnostic only.',
      'Order/growth protocols (h, t_end, half- vs whole-period sampling) are the researcher\'s pilot choices, not source protocols.',
      'Long-run drift criterion (5% of mean envelope over 1000T) is reviewer-set; no source gives a numeric drift bound.'
    ],
    reviewer: 'reviewer-symplectic-euler-kepler-e06-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'matched',
      reason: 'All 8 quantitative gaps within tolerance (orders 1.003/0.936, growth 0.9998/8e-9); energy bounded without drift over 1000T at two h; L conserved to 1.7e-13; stable. Sources snippet/secondary only (verified:false), recorded in missing.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
