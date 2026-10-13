/* Verification record: lbm-d2q9 @ cavity-re100. Reviewer: reviewer-lbm-d2q9-cavity-re100-r2 (not the builder).
 * Numbers from verification/checks/lbm-d2q9@cavity-re100.check.js (N = 256 row: same script with N256=1); report in
 * verification/reports/lbm-d2q9@cavity-re100.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'lbm-d2q9@cavity-re100',
    method: 'lbm-d2q9', scene: 'cavity', experiment: 'cavity-re100',
    status: 'matched',
    claim: 'D2Q9 BGK (halfway bounce-back walls, moving-wall bounce-back lid) on 128^2 cells at Ulat = 0.1 (tau = 0.884) reproduces ' +
      'Ghia et al. (1982) at Re = 100: max |u - u_Ghia| = 0.0051 U on x = 0.5 and max |v - v_Ghia| = 0.0060 U on y = 0.5 (tol 0.02), ' +
      'psi_min = -0.102161 (1.22% from -0.103423, tol 3%), primary-vortex centre (0.6158, 0.7369) within 0.0025 of (0.6172, 0.7344) (tol 0.02); ' +
      'total mass conserved to round-off (1.7e-12 relative after 67968 steps). Also within all tolerances at N = 64 and N = 256.',
    conditions: {
      Re: 100, N: 128, Ulat: 0.1, tau: 0.884, Mach_max: 0.169, steps: 67968, t_end: 53.1,
      convergence: 'residual (max |du| per unit time) < 1e-8; u_vcl / v_hcl changed < 1.2e-10 over the last 8.1 time units',
      extra_runs: 'N = 64, Ulat = 0.1 (tau 0.692); N = 128, Ulat = 0.05 (tau 0.692); N = 256, Ulat = 0.1 (tau 1.268); all to residual < 1e-7',
      method_change_since_r1: 'refinement round 1 changed only setEq with gradients (Taylor-Green init) and the cylinder pressure outlet; neither code path is used by the cavity, and r2 numbers reproduce r1 to all printed digits',
      check: 'verification/checks/lbm-d2q9@cavity-re100.check.js'
    },
    reference: ['cavity-re100-ghia-u', 'cavity-re100-ghia-v', 'cavity-re100-ghia-psimin', 'cavity-re100-ghia-center'],
    gaps: [
      { quantity: 'max |u - u_Ghia| on x = 0.5 (17 rows; worst at y = 0.8516)', value: 0.00513, tolerance: 0.02, unit: 'U_lid', pass: true },
      { quantity: 'max |v - v_Ghia| on y = 0.5 (17 rows; worst at x = 0.8594)', value: 0.00597, tolerance: 0.02, unit: 'U_lid', pass: true },
      { quantity: 'psi_min relative error vs -0.103423 (sim -0.1021606)', value: 0.01221, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'primary-vortex centre max(|dx|,|dy|) vs (0.6172, 0.7344) (sim (0.6158, 0.7369))', value: 0.00245, tolerance: 0.02, unit: 'L', pass: true }
    ],
    checks: [
      { name: 'mass conservation', status: 'pass',
        detail: 'sum(rho) relative drift 1.68e-12 after 67968 steps (2.5e-17 per step), below the reviewer bound 10 eps per step (1.5e-10 total). ' +
          'N = 64: 1.1e-12 / 29550 steps; N = 128, Ulat 0.05: 4.3e-12 / 116480 steps; N = 256: 1.8e-12 / 100096 steps. ' +
          'Momentum and energy are not invariants of the driven viscous cavity.' },
      { name: 'steady state reached', status: 'pass',
        detail: 'residual 1.0e-8 at t = 53.1; over the preceding 8.1 time units u_vcl changes by 7.5e-11, v_hcl by 1.1e-10, psi_min by 2.6e-11 (all << 1% of tolerances).' },
      { name: 'stability', status: 'pass',
        detail: 'no NaN/blow-up in any run; tau = 0.884 > 0.5 (0.692 / 1.268 in the other runs); max Mach |u|/c_s = 0.169 < 0.3 (method criterion; Ulat 0.05 run: 0.085; N = 256: 0.172).' },
      { name: 'quantitative vs Ghia (u, v tables; psi_min; centre)', status: 'pass',
        detail: 'all four gaps within reference tolerances at N = 128; also at N = 64 (u 0.0063, v 0.0036, psi 2.43%, centre 0.0026) and N = 256 (u 0.0049, v 0.0074, psi 0.60%, centre 0.0029). ' +
          'Halving Ulat to 0.05 at N = 128 changes gaps by < 5e-4 (u 0.0051, v 0.0064, psi 1.17%), so Mach (compressibility) error is not the dominant error.' },
      { name: 'weak compressibility (information)', status: 'n/a',
        detail: 'max |div u| of the lattice velocity = 4.1 U/L at N = 128 (3.3 at N = 64, 6.6 at Ulat 0.05). Maximum only; presumably at the lid-corner singularity. No criterion stated; not used for classification.' },
      { name: 'grid trend (information)', status: 'n/a',
        detail: 'psi_min error 2.43% (N = 64) -> 1.22% (128) -> 0.60% (256): ratio 2.0 each step, first-order at fixed Ulat (tau 0.692 -> 0.884 -> 1.268). ' +
          'Consistent with the tau-dependent wall position of BGK halfway bounce-back (known property, not a demonstrated defect). u gap 0.0063 -> 0.0051 -> 0.0049 and v gap 0.0036 -> 0.0060 -> 0.0074 level off at a few 1e-3, ' +
          'comparable to the accuracy of Ghia\'s own 129^2 second-order solution; v gap growth is near the downward jet (x = 0.86) and stays at 37% of tolerance.' }
    ],
    missing: [
      'ghia1982 is registered verified:false: original paper paywalled and not read. u/v tables come from open, mutually identical transcriptions (copy-ivanpi-ghia, copy-sujaldave-ghia, copy-cfdgasman-ghia; verified:true copies); table numbers (I, II) not checked against the original.',
      'psi_min = -0.103423 is quoted from a single copy (copy-cfdgasman-ghia README) plus a 5-digit search snippet; vortex-centre value from a single copy (copy-sujaldave-ghia, Table V per that copy). Table numbers III/V unverified.',
      'LBM method sources (qian1992, he1997, ladd1994, zou1997, hou1995) were not read in full by the researcher (abstracts/snippets only); equation numbers unverified. Hou et al. LBM cavity numbers not obtained for an LBM-specific comparison.',
      'N = 256 converged only to residual < 1e-7 (not 1e-8) and without the steadiness snapshot test; it is used for the grid trend only. A diffusive-scaling sequence (fixed tau, Ulat ~ 1/N) was not run.',
      'Ghia values are themselves a 2nd-order 129^2 solution; no higher-accuracy Re = 100 reference is registered.',
      'Steadiness (1% of tolerances) and mass (10 eps per step) criteria are reviewer-set; no source specifies them.'
    ],
    reviewer: 'reviewer-lbm-d2q9-cavity-re100-r2', round: 2, date: '2026-10-13',
    history: [
      { round: 1, status: 'matched',
        reason: 'N=128 Ulat=0.1 steady run (residual<1e-8): u gap 0.0051, v gap 0.0060 (tol 0.02), psi_min 1.22% (tol 3%), centre 0.0025 (tol 0.02); mass drift 1.7e-12 (round-off), Ma 0.17, tau 0.884, no NaN. Ghia original verified:false, values from open verified copies; recorded in missing.' },
      { round: 2, status: 'matched',
        reason: 'Re-run after refinement round 1 (TG init and cylinder outlet changes; cavity code path untouched): identical numbers (u 0.0051, v 0.0060, psi_min 1.22%, centre 0.0025; mass 1.7e-12, Ma 0.17). Added N=256 (tau 1.268): u 0.0049, v 0.0074, psi_min 0.60%, centre 0.0029, all within tolerance.' }
    ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
