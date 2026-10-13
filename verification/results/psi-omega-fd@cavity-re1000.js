/* Verification record: psi-omega-fd @ cavity-re1000. Reviewer: reviewer-psi-omega-fd-cavity-re1000-r1 (not the builder).
 * Numbers from verification/checks/psi-omega-fd@cavity-re1000.check.js; report in
 * verification/reports/psi-omega-fd@cavity-re1000.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'psi-omega-fd@cavity-re1000',
    method: 'psi-omega-fd', scene: 'cavity', experiment: 'cavity-re1000',
    status: 'matched',
    claim: 'Explicit stream-function/vorticity FD (central convection, Thom wall vorticity, multigrid Poisson) on a 257^2 grid ' +
      'reproduces the Re = 1000 cavity centreline profiles of Ghia et al. (1982) and Erturk et al. (2005) to within 0.013 U_lid ' +
      '(tol 0.03), psi_min to 0.03% of Ghia and 0.75% of Erturk (tol 3%), and the primary-vortex centre to 0.003 (tol 0.02). ' +
      'psi_min converges at observed order 2.08 over N = 64/128/256; its Richardson extrapolation (-0.11870) is 0.07% from Erturk (601^2).',
    conditions: {
      Re: 1000, N: 256, scheme: 'central (0)', cfl: 0.8, mgCycles: 10, dt: 0.0016, steps: 34375, t_end: 55,
      convergence: 'stopped at t = 55 (wall budget), residual max|du|/dt = 4.2e-5; N=128 run shows profiles move < 4.4e-4 U after t = 55',
      supporting_runs: 'N = 128 to residual < 1e-7 (t = 138.9); N = 64 to t = 120 (residual 2.3e-7)',
      check: 'verification/checks/psi-omega-fd@cavity-re1000.check.js'
    },
    reference: ['cavity-re1000-ghia-u', 'cavity-re1000-ghia-v', 'cavity-re1000-erturk-u', 'cavity-re1000-ghia-psimin',
      'cavity-re1000-erturk-psimin', 'cavity-re1000-ghia-center'],
    gaps: [
      { quantity: 'max |u - u_ref| on x=0.5, Ghia Table I (17 pts), N=256', value: 0.0029, tolerance: 0.03, unit: 'U_lid', pass: true },
      { quantity: 'max |v - v_ref| on y=0.5, Ghia Table II (17 pts), N=256', value: 0.0131, tolerance: 0.03, unit: 'U_lid', pass: true },
      { quantity: 'max |u - u_ref| on x=0.5, Erturk 601^2 (23 pts), N=256', value: 0.0038, tolerance: 0.03, unit: 'U_lid', pass: true },
      { quantity: 'psi_min rel. gap vs Ghia -0.117929 (sim -0.117893), N=256', value: 0.0003, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'psi_min rel. gap vs Erturk -0.118781, N=256', value: 0.0075, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'vortex centre max-abs gap vs Ghia (0.5313, 0.5625); sim (0.5312, 0.5656), N=256', value: 0.0031, tolerance: 0.02, unit: 'L', pass: true }
    ],
    checks: [
      { name: 'mass conservation (discrete divergence-free)', status: 'pass',
        detail: 'max |div u| (central, interior) <= 1.4e-14 over all runs; Poisson residual max |lap psi + omega| <= 9.4e-9 at every logged step (multigrid tol 1e-10 on psi correction).' },
      { name: 'circulation (Stokes theorem, discrete)', status: 'pass',
        detail: 'integral of omega = -(1 - h) to 2e-11 on every grid at every logged step (-0.99609375 at N=256; the h deficit is the zeroed lid corner nodes in the trapezoid sum). Energy/momentum are not conserved in this forced, dissipative flow; KE settles to 0.04388 (N=256), 0.04229 (N=128).' },
      { name: 'stability', status: 'pass',
        detail: 'no NaN/divergence. dt = 0.0016 set by the central-scheme bound 2 nu/max|u|^2 times cfl 0.8 (dt/bound = 0.8 on all grids); max CFL 0.41, max diffusion number 0.105 (<= 0.25). Cell Peclet 3.9 (N=256), 7.8 (N=128), 15.6 (N=64) exceeds 2, but centreline profiles have exactly the expected extrema (1 in u, 2 in v) on every grid: no wiggles.' },
      { name: 'quantitative', status: 'pass',
        detail: 'All six gaps within tolerance at N=256. N=128 also passes (u 0.0138, v 0.0080, Erturk u 0.0167, psi_min 2.1%/2.8%); N=64 fails (0.062/0.061/0.068, psi_min 10.7%), as expected for 64 cells.' },
      { name: 'grid convergence', status: 'pass',
        detail: 'psi_min -0.105257 / -0.115473 / -0.117893 at N=64/128/256: observed order 2.08; Richardson (p=2) -0.118700, 0.07% from Erturk. Ghia-u and Erturk-u gaps fall ~4-5x from N=128 to 256.' },
      { name: 'steady state (N=256 run truncated)', status: 'pass',
        detail: 'N=256 stopped at t=55 with residual 4.2e-5 (psi_min still moving ~1.4e-5 per unit t). From the N=128 run, the remaining change after t=55 is <= 4.4e-4 U in the profiles and 0.11% in psi_min, far below every margin.' }
    ],
    missing: [
      'ghia1982 is registered verified:false (paywalled original not read); Tables I/II values come from independent open copies (copy-ivanpi-ghia, copy-sujaldave-ghia, copy-xuaoxiqi-ghia, lethe) that agree except v(0.9063), where the majority -0.51550 is used (the -0.51500 alternative changes the v gap by < 0.001).',
      'Ghia psi_min -0.117929 (6 digits) was not seen verbatim in any open copy; 4-digit 0.1179 confirmed by search snippets only. Table numbers III/V unverified.',
      'erturk2005 is registered verified:false (arXiv not reachable): u-centreline column from the lethe copy, psi_min -0.118781 and centre (0.5300, 0.5650) from a single search snippet. Erturk v table not obtained, so v is checked against Ghia only.',
      'Tolerances (0.03 U, 3%, 0.02) are the researcher\'s engineering bands in references/cavity.js, not source-stated error bars; applied unchanged.',
      'N=256 run was stopped at t=55 by the ~10 min budget rather than run to residual 1e-7; transient remainder estimated from the N=128 run (documented in the report).',
      'Equation locations cited by the method (erturk2005, e1996) are search-snippet based and unverified; this review checks outputs, not the cited derivations.'
    ],
    reviewer: 'reviewer-psi-omega-fd-cavity-re1000-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'matched',
      reason: 'N=256: Ghia u/v and Erturk u gaps 0.0029/0.0131/0.0038 U (tol 0.03), psi_min 0.03%/0.75% (tol 3%), centre 0.003 (tol 0.02); divergence-free to 1e-14, stable within the stated dt bound, second-order psi_min convergence. Sources verified:false via open copies/snippets, recorded in missing.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
