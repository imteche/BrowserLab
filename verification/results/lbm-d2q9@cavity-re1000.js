/* Verification record: lbm-d2q9 @ cavity-re1000. Reviewer: reviewer-lbm-d2q9-cavity-re1000-r1 (not the builder).
 * Numbers from verification/checks/lbm-d2q9@cavity-re1000.check.js; report in
 * verification/reports/lbm-d2q9@cavity-re1000.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'lbm-d2q9@cavity-re1000',
    method: 'lbm-d2q9', scene: 'cavity', experiment: 'cavity-re1000',
    status: 'matched',
    claim: 'D2Q9 BGK (halfway bounce-back walls, moving-wall bounce-back lid) on 192^2 cells at Ulat = 0.1 (tau = 0.558) reproduces ' +
      'the Re = 1000 cavity centreline profiles of Ghia et al. (1982) to 0.0074 U (u) and 0.0067 U (v) and of Erturk et al. (2005) to 0.0102 U (tol 0.03); ' +
      'psi_min = -0.116291 is 1.39% from Ghia and 2.10% from Erturk (tol 3%); primary-vortex centre (0.5317, 0.5655) within 0.0030 of Ghia (tol 0.02). ' +
      'Also passes at the method default N = 128 except psi_min vs Erturk (3.15%, tol 3%). Total mass conserved to round-off. ' +
      'psi_min converges at first order in N (acoustic scaling); a first-order Richardson estimate from N = 128/192 gives -0.11879, 0.003% from Erturk.',
    conditions: {
      Re: 1000, N: 192, Ulat: 0.1, tau: 0.5576, Mach_max: 0.167, steps: 180768, t_end: 94.15,
      convergence: 'stopped by the wall-clock cap at residual 7.4e-6 (max |du| per unit time); the converged N = 128 history shows changes after t = 90 of <= 3e-5 U in the profile gaps and 1.7e-5 in psi_min',
      extra_runs: 'N = 128 Ulat 0.1 (tau 0.538, residual 9.8e-8 at t = 146.9); N = 64 Ulat 0.1 (tau 0.519, t = 150, residual 1.6e-7); N = 128 Ulat 0.05 (tau 0.519, truncated at t = 77.75, compared at t = 70)',
      not_run: 'N = 256 (about 13.5 s per time unit at 12 MLUPS; t >= 60 needed, i.e. > 13 min; a contended first attempt reached only t = 19 in 530 s)',
      check: 'verification/checks/lbm-d2q9@cavity-re1000.check.js'
    },
    reference: ['cavity-re1000-ghia-u', 'cavity-re1000-ghia-v', 'cavity-re1000-erturk-u', 'cavity-re1000-ghia-psimin', 'cavity-re1000-erturk-psimin', 'cavity-re1000-ghia-center'],
    gaps: [
      { quantity: 'max |u - u_Ghia| on x = 0.5 (17 rows; worst at y = 0.0703), N = 192', value: 0.00739, tolerance: 0.03, unit: 'U_lid', pass: true },
      { quantity: 'max |v - v_Ghia| on y = 0.5 (17 rows; worst at x = 0.8594), N = 192', value: 0.00670, tolerance: 0.03, unit: 'U_lid', pass: true },
      { quantity: 'max |u - u_Erturk| on x = 0.5 (23 rows; worst at y = 0.12), N = 192', value: 0.01017, tolerance: 0.03, unit: 'U_lid', pass: true },
      { quantity: 'psi_min relative error vs Ghia -0.117929 (sim -0.116291), N = 192', value: 0.01389, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'psi_min relative error vs Erturk -0.118781 (sim -0.116291), N = 192', value: 0.02096, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'primary-vortex centre max(|dx|,|dy|) vs Ghia (0.5313, 0.5625) (sim (0.5317, 0.5655)), N = 192', value: 0.00303, tolerance: 0.02, unit: 'L', pass: true }
    ],
    checks: [
      { name: 'mass conservation', status: 'pass',
        detail: 'sum(rho) relative drift 8.9e-12 after 180768 steps at N = 192 (4.9e-17 per step), below the reviewer bound 10 eps per step (4.0e-10). ' +
          'N = 128: 9.3e-12 / 188032 steps; N = 64: 4.7e-12 / 96000; N = 128 Ulat 0.05: 9.8e-12 / 199040. Momentum and energy are not invariants of the driven viscous cavity.' },
      { name: 'steady state', status: 'pass',
        detail: 'N = 192 truncated by the wall cap at t = 94.15, residual 7.4e-6; over t = 80 -> 94 its gaps change by <= 3e-5 U and psi_min by 2.2e-5. ' +
          'The N = 128 run (residual 9.8e-8 at t = 146.9) changes by <= 3e-5 U in the gaps and 1.7e-5 in psi_min after t = 90, so the remaining N = 192 transient is far below every margin.' },
      { name: 'stability', status: 'pass',
        detail: 'no NaN/blow-up in any run; tau = 0.558 (N = 192), 0.538 (N = 128), 0.519 (N = 64 and N = 128 Ulat 0.05), all > 0.5 and at or above the method\'s practical BGK floor ~0.51-0.55; ' +
          'max Mach |u|/c_s = 0.167 < 0.3 (method criterion; 0.082 at Ulat 0.05).' },
      { name: 'quantitative vs Ghia / Erturk', status: 'pass',
        detail: 'All six gaps within reference tolerances at N = 192. N = 128 (method default): u 0.0124, v 0.0096, Erturk u 0.0156, psi_min 2.45% (Ghia) pass, but 3.15% vs Erturk psi_min (tol 3%) fails, centre 0.0032. ' +
          'N = 64: u 0.0288, v 0.0250 pass, Erturk u 0.0330 fails, psi_min 5.6% / 6.3% fail.' },
      { name: 'grid convergence (information)', status: 'n/a',
        detail: 'psi_min -0.111346 / -0.115044 / -0.116291 at N = 64 / 128 / 192: difference ratio 2.97 vs 3.0 expected for first order (h ratio 2, 1.5). At fixed Ulat tau varies with N, so this mixes the O(h) tau-dependent wall location of BGK halfway bounce-back with O(h^2) terms; ' +
          'first-order Richardson from N = 128/192: -0.11879 (Erturk -0.118781, Botella ~-0.1189). Profile gaps: Ghia u 0.029 -> 0.012 -> 0.0074. Known BGK behaviour, not evidence of an implementation defect.' },
      { name: 'Mach sensitivity (information)', status: 'n/a',
        detail: 'N = 128, Ulat 0.05 vs 0.1 at equal t = 70: psi_min differs by 0.095%, Ghia u gap by 3e-5, v gap by 6e-4, Erturk u gap by 5e-5. Compressibility error is not the dominant error at Ulat 0.1.' },
      { name: 'weak compressibility (information)', status: 'n/a',
        detail: 'max |div u| of the lattice velocity = 14.4 U/L at N = 192 (10.2 at N = 128, 5.5 at N = 64), a single maximum growing with N, consistent with the lid-corner singularity. No stated criterion; not used for classification.' }
    ],
    missing: [
      'ghia1982 is registered verified:false: original paper paywalled and not read. Re = 1000 u/v tables come from open transcriptions (copy-ivanpi-ghia, copy-sujaldave-ghia, copy-xuaoxiqi-ghia; verified:true) which disagree at one point (v at x = 0.9063: -0.51550 vs -0.51500; majority used; the sim gap there is 0.0006 vs the majority value, 0.0001 vs -0.51500).',
      'Ghia psi_min -0.117929 and vortex centre (0.5313, 0.5625) at Re = 1000 come from search snippets and a single copy (copy-sujaldave-ghia); table numbers unverified.',
      'erturk2005 is registered verified:false: arXiv not reachable from the container. Erturk u table is from the lethe copy (first three entries confirmed by a search snippet); Erturk psi_min -0.118781 from a single search snippet.',
      'botella1998 (spectral) not read; only snippet values in the reference range; not used as a gap.',
      'N = 256 not run (runtime budget); the primary N = 192 run stopped at residual 7.4e-6 rather than 1e-7 (transient remainder bounded from the N = 128 history). A fixed-tau (diffusive scaling) grid sequence was not run, so the order estimate mixes grid and tau effects.',
      'LBM method sources (qian1992, he1997, ladd1994, zou1997, hou1995) were not read in full by the researcher; hou1995 LBM cavity numbers not obtained for an LBM-specific comparison.',
      'Steadiness and mass (10 eps per step) criteria are reviewer-set; no source specifies them. Sim profiles are evaluated at table coordinates by 4-point Lagrange interpolation of the cell-centre profile (reviewer choice).'
    ],
    reviewer: 'reviewer-lbm-d2q9-cavity-re1000-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'matched',
      reason: 'N=192 Ulat=0.1 (tau 0.558): Ghia u/v and Erturk u gaps 0.0074/0.0067/0.0102 U (tol 0.03), psi_min 1.39% Ghia / 2.10% Erturk (tol 3%), centre 0.0030 (tol 0.02); mass drift 8.9e-12, Ma 0.167, no NaN; run truncated at residual 7.4e-6 with remaining transient <= 3e-5 bounded from converged N=128. N=128 default fails only Erturk psi_min (3.15%). Ghia/Erturk verified:false via open copies/snippets, recorded in missing.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
