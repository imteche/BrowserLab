/* Verification record: rk4 @ kepler-e06. Reviewer: reviewer-rk4-kepler-e06-r1 (not the builder).
 * Numbers from verification/checks/rk4@kepler-e06.check.js; report in
 * verification/reports/rk4@kepler-e06.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'rk4@kepler-e06',
    method: 'rk4', scene: 'kepler', experiment: 'kepler-e06',
    status: 'matched',
    claim: 'Classical RK4 on Kepler (e = 0.6) shows the theoretical non-symplectic behaviour: observed order 4 in the max energy error (4.18) ' +
      'and the global error against the exact Kepler solution (4.07) on the published pair h = 1.25e-3 -> 6.25e-4 at t_end = 10.5T; linear secular energy drift ' +
      '(k = 0.968) and quadratic global-error growth (k = 1.925) between 40T and 160T at h = 1e-2; angular momentum not conserved (|L - L0| grows linearly in t, ' +
      '3.1e-7 at 160T, h = 1e-2), as the reference table states.',
    conditions: {
      e: 0.6, order_protocol: 't_end = 10.5T (apocentre), published pair h = 1.25e-3 -> 6.25e-4; info at h = 5e-3, 2.5e-3, 3.125e-4, 1.5625e-4',
      growth_protocol: 'h = 1e-2, t1 = 40T, t2 = 160T (whole periods); info series 10T..640T (pericentre) and 10.5T..640.5T (apocentre)',
      faithfulness: 'module vs inline independent RK4, 2000 steps at h = 1e-2',
      large_h_info: 'h = 0.02, 0.05, 0.1 for 100 periods',
      check: 'verification/checks/rk4@kepler-e06.check.js', runtime: '< 1 s'
    },
    reference: ['kepler-exact-solution', 'kepler-H0', 'kepler-L0', 'kepler-order-energy-rk4', 'kepler-order-global-rk4',
      'kepler-growth-global-rk4', 'kepler-growth-energy-rk4', 'kepler-L-conservation'],
    gaps: [
      { quantity: 'observed order of max energy error, t_end = 10.5T, h = 1.25e-3 -> 6.25e-4 (theory 4; pilot 4.22)', value: 4.181, tolerance: 0.3, unit: 'order (|p - 4| = 0.181)', pass: true },
      { quantity: 'observed order of global error at t_N ~ 10.5T, h = 1.25e-3 -> 6.25e-4 (theory 4; pilot 4.09)', value: 4.068, tolerance: 0.3, unit: 'order (|p - 4| = 0.068)', pass: true },
      { quantity: 'time-growth exponent of global error, h = 1e-2, 40T -> 160T (theory 2; pilot 1.92)', value: 1.925, tolerance: 0.3, unit: 'exponent (|k - 2| = 0.075)', pass: true },
      { quantity: 'time-growth exponent of max energy error, h = 1e-2, 40T -> 160T (theory 1; pilot 0.97)', value: 0.968, tolerance: 0.3, unit: 'exponent (|k - 1| = 0.032)', pass: true },
      { quantity: 'angular momentum NOT conserved (kepler-L-conservation row rk4 = false): max |L - L0| at h = 1e-2 over 640T must exceed round-off tol', value: 1.24e-6, tolerance: 1e-12, unit: 'abs (value > tol expected)', pass: true },
      { quantity: '|H(y0) - H0| and |L(y0) - L0| (initial conditions)', value: 0, tolerance: 1e-14, unit: 'abs', pass: true }
    ],
    checks: [
      { name: 'discretization faithfulness', status: 'pass',
        detail: 'Module state vs an independent inline classical-tableau RK4 after 2000 steps at h = 1e-2: |diff| = 2.1e-13 (op-order round-off); sim.t = N h exactly.' },
      { name: 'energy (drift, as expected for a non-symplectic method)', status: 'pass',
        detail: 'max |H - H0| at h = 1e-2: 4.62e-7 (40T), 1.77e-6 (160T), 6.99e-6 (640T); LSQ log-log slope 40T..640T = 0.981 (linear drift). ' +
          'Energy is conserved only to O(h^4 t), consistent with the reference; no conservation claim is made for this method.' },
      { name: 'angular momentum', status: 'pass',
        detail: 'Not conserved, as referenced: |L - L0| = 7.7e-8 (40T), 3.1e-7 (160T), 1.24e-6 (640T) at h = 1e-2 (growth exponent 1.000); ' +
          'scales as ~h^4.5 on the published pair (6.0e-13 -> 2.7e-14 at 10.5T), reaching round-off below h = 6.25e-4.' },
      { name: 'stability', status: 'pass',
        detail: 'No NaN/divergence in any run (up to 640T at h = 1e-2, 422k steps at h = 1.56e-4). Info: 100T at h = 0.02/0.05/0.1 stay finite, rel. max energy error 7.0e-5 / 6.8e-3 / 0.23 ' +
          '(energy decays: H_end = -0.6148 at h = 0.1, orbit shrinks), phase error O(1) for h >= 0.05. No reference stability criterion for Kepler.' },
      { name: 'quantitative (orders, growth)', status: 'pass',
        detail: 'All four published order/growth references within +-0.3 and within 0.04 of the researcher pilot values. Info: global order on (6.25e-4, 3.125e-4) = 4.08; ' +
          'pre-asymptotic pairs 5e-3->2.5e-3 give 4.56 (energy) / 4.27 (global), confirming research/ode.md pitfall 3. Growth: apocentre 10.5T->40.5T k = 1.67, 40.5T->160.5T k = 1.89, ' +
          'pericentre LSQ 40T..640T k = 1.95 (quadratic regime only after ~40T, as stated).' },
      { name: 'energy order at (h/2, h/4) — round-off floor', status: 'n/a',
        detail: 'Info only (not part of the published protocol): p = 3.36 on 6.25e-4 -> 3.125e-4 because dH = 6.1e-14 is at the double-precision floor; an h/8 run gives 5.1e-14 ' +
          '(no decrease, truncation would cut it 16x). The global error at the same h (6.6e-12, 3.1e-12) is above the floor and still shows order 4.08.' }
    ],
    missing: [
      'Theoretical references cite sources registered verified:false: kutta1901 (secondary/textbook copy; original not consulted), hairer1997varsymp (search snippet only; DOI from recollection), ' +
        'hlw2006 (paywalled; Kepler ICs from secondary copies). No full text was reachable from the container.',
      'No published numeric values (e.g. HLW figure amplitudes for RK4 on Kepler) were available; the result is checked against theoretical orders/growth laws and an analytically derived exact solution (research/test-kepler-exact.js), not against published figure numbers.',
      'Order/growth protocols (h, t_end, 40T/160T sampling) are the researcher\'s pilot choices, not source protocols. The RK4 linear-stability bound |h lambda| <= 2.83 in the method file is unsourced and was not tested (no reference criterion).',
      'Matched status rests on standard, uncontested theory (order 4, O(h^4 t) energy drift, quadratic error growth for non-symplectic methods, L not conserved) evaluated against an independently tested exact solution; re-review if full-text access changes any cited claim or protocol.'
    ],
    reviewer: 'reviewer-rk4-kepler-e06-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'matched',
      reason: 'All 6 gaps within tolerance on the published protocols (orders 4.18 / 4.07, growth 1.925 / 0.968, L non-conservation as referenced); faithful to the classical tableau; stable. ' +
        'Sources verified:false (snippet/secondary only), recorded in missing.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
