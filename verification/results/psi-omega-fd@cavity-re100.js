/* Verification record: psi-omega-fd @ cavity-re100. Reviewer: reviewer-psi-omega-fd-cavity-re100-r1 (not the builder).
 * Numbers from verification/checks/psi-omega-fd@cavity-re100.check.js; report in
 * verification/reports/psi-omega-fd@cavity-re100.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'psi-omega-fd@cavity-re100',
    method: 'psi-omega-fd', scene: 'cavity', experiment: 'cavity-re100',
    status: 'matched',
    claim: 'Stream-function/vorticity FD (central convection, Thom wall vorticity, multigrid Poisson) on a 129^2 grid reproduces ' +
      'Ghia et al. (1982) at Re = 100: max |u - u_Ghia| = 0.0042 U on x = 0.5 and max |v - v_Ghia| = 0.0084 U on y = 0.5 (tol 0.02), ' +
      'psi_min = -0.103338 (0.08% from -0.103423, tol 3%), primary-vortex centre (0.6154, 0.7378) within 0.0034 of (0.6172, 0.7344) (tol 0.02).',
    conditions: {
      Re: 100, N: 128, scheme: 'central', cfl: 0.8, mgCycles: 10, dt: 0.0012207, steps: 28550, t_end: 34.85,
      convergence: 'residual (max |du|,|dv| per unit time) < 1e-9; u_vcl changed < 3.5e-7 over the last 9.8 time units',
      grid_sequence: 'N = 32, 64, 128 (same stop criterion)',
      check: 'verification/checks/psi-omega-fd@cavity-re100.check.js'
    },
    reference: ['cavity-re100-ghia-u', 'cavity-re100-ghia-v', 'cavity-re100-ghia-psimin', 'cavity-re100-ghia-center'],
    gaps: [
      { quantity: 'max |u - u_Ghia| on x = 0.5 (17 rows; worst at y = 0.8516)', value: 0.00420, tolerance: 0.02, unit: 'U_lid', pass: true },
      { quantity: 'max |v - v_Ghia| on y = 0.5 (17 rows; worst at x = 0.8594)', value: 0.00844, tolerance: 0.02, unit: 'U_lid', pass: true },
      { quantity: 'psi_min relative error vs -0.103423 (sim -0.1033377)', value: 0.000824, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'primary-vortex centre max(|dx|,|dy|) vs (0.6172, 0.7344) (sim (0.6154, 0.7378))', value: 0.00339, tolerance: 0.02, unit: 'L', pass: true }
    ],
    checks: [
      { name: 'conservation (mass / kinematic consistency)', status: 'pass',
        detail: 'max |div u| (central, interior) = 7.1e-15 (velocity from psi, exactly solenoidal); max |lap psi + omega| = 3.0e-12; ' +
          'circulation integral of omega = -0.9921875 = -(1 - h), the exact discrete value for Thom walls with zero corners (Stokes: -1); ' +
          'KE 0.0344363 changes by 2.6e-8 over the last 9.8 time units. No momentum/energy invariant applies to the driven viscous steady state.' },
      { name: 'steady state reached', status: 'pass',
        detail: 'residual 9.9e-10 at t = 34.85 (28550 steps); over the preceding 9.8 time units u_vcl changes by 3.5e-7 (<1% of the 0.02 tol) and psi_min by 5.1e-8 (5e-7 rel, <1% of the 3% tol).' },
      { name: 'stability', status: 'pass',
        detail: 'no NaN/blow-up in any run; N = 128: diffusion number 0.20 <= 0.25, CFL 0.156 <= 1, cell Peclet 0.78 <= 2 (central-scheme criterion). ' +
          'N = 32 runs at cell Peclet 3.1 (> 2) and is still stable and wiggle-free at the probes (info only).' },
      { name: 'quantitative vs Ghia (u, v tables; psi_min; centre)', status: 'pass',
        detail: 'all four gaps within reference tolerances at N = 128; also at N = 64 (u 0.0027, v 0.0059, psi 0.64%, centre 0.0032) and N = 32 (u 0.0089, v 0.0086, psi 2.9%, centre 0.0087).' },
      { name: 'grid convergence (information)', status: 'pass',
        detail: 'psi_min -0.100431 / -0.102762 / -0.103338 for N = 32/64/128: observed order 2.02; Richardson value -0.103526 (0.10% from Ghia). ' +
          'Table gaps do not shrink monotonically to 0 (u 0.0027 at N=64 vs 0.0042 at N=128) because Ghia\'s own 129^2 solution carries O(h^2) error of the same size; the sign pattern at N=128 (v systematically ~0.003-0.008 larger in magnitude) is consistent with that.' }
    ],
    missing: [
      'ghia1982 is registered verified:false: original paper paywalled and not read. u/v tables come from open, mutually identical transcriptions (copy-ivanpi-ghia, copy-sujaldave-ghia, copy-cfdgasman-ghia; verified:true copies); table numbers (I, II) not checked against the original.',
      'psi_min = -0.103423 is quoted from a single copy (copy-cfdgasman-ghia README) plus a 5-digit search snippet; vortex-centre value from a single copy (copy-sujaldave-ghia, Table V per that copy). Table numbers III/V unverified.',
      'Ghia values are themselves a 2nd-order 129^2 solution; no higher-accuracy Re = 100 reference (Botella/Erturk tables) is registered, so agreement is with a comparable-accuracy benchmark, not with the converged continuum solution (the sim\'s Richardson psi_min -0.103526 differs from Ghia by 0.10%).',
      'Steadiness criterion (1% of each tolerance over ~5-10 time units) and the circulation criterion |circ + 1| <= 1.01 h are reviewer-set; no source specifies them.',
      'Only the default central scheme was verified; the first-order upwind option (scheme 1) was not run for this record.'
    ],
    reviewer: 'reviewer-psi-omega-fd-cavity-re100-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'matched',
      reason: 'N=128 steady run (residual<1e-9): u gap 0.0042, v gap 0.0084 (tol 0.02), psi_min 0.08% (tol 3%), centre 0.0034 (tol 0.02); solenoidal to 7e-15, stable within stated FTCS limits. Ghia original verified:false, values from open verified copies; recorded in missing.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
