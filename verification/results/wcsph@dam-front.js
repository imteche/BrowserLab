/* Verification record: wcsph @ dam-front. Reviewer: reviewer-wcsph-dam-front-r1 (not the builder).
 * Numbers from verification/checks/wcsph@dam-front.check.js (--full); report in
 * verification/reports/wcsph@dam-front.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'wcsph@dam-front',
    method: 'wcsph', scene: 'dam-break', experiment: 'dam-front',
    status: 'flagged',
    claim: 'WCSPH with the method defaults (PySPH dam_break_2d settings: c0 = 10 sqrt(2g·2a), alpha = 0.1, h = 1.3dx, CFL 0.125) reproduces the ' +
      'Martin & Moyce (1952) surge front: with one time shift dT = 0.13 (allowed range [0, 0.25]) max |Z_sim - Z_ref| = 0.077 over 0 < T <= 3 at N = 33 ' +
      '(Lethe copy; tolerance 0.25), and 0.096 against the PySPH a = 2.25 in cross-copy with the same shift. The gap is 0.075-0.078 at N = 24, 33, 48 and 64. ' +
      'Without a shift it is 0.19-0.30, and grows with N. The Ritter bound Z <= 1 + 2T holds at every step. Mass is exact. KE + PE + fluid EOS energy never rises by more than 1.1e-4 E0. ' +
      'It is flagged because the method\'s own weak-compressibility criterion Ma = max|v|/c0 <= 0.1 is exceeded: 0.104-0.107 at all resolutions from T ~ 2.6, in the front tongue, ' +
      'because the a priori Umax = sqrt(2gH) underestimates the real front speed. With c0 = 15 sqrt(2g·2a), every check passes (Ma 0.070, gap 0.073, Z changes by <= 0.036).',
    conditions: {
      a: 1, g: 9.81, Lx: '5a', N_primary: 33, N_study: [24, 33, 48, 64], hdx: 1.3, cfac: 10, alpha: 0.1, xsph: 0.5, cfl: 0.125,
      T_end: 3.0, steps_primary: 9227, sensitivity: 'N = 33 with cfac = 15; scale run a = 0.05715 m (2.25 in), N = 24',
      gap_metric: 'max |Z_sim(T - dT) - Z_ref(T)| over reference rows 0 < T <= 3; dT fitted on the Lethe copy (grid 0.005 in [0, 0.25]) and reused for a225',
      check: 'verification/checks/wcsph@dam-front.check.js (default ~5 min: N = 24, 33, 48 + cfac 15 + scale run; --full adds N = 64, ~10.5 min)'
    },
    reference: ['dam-break-mm-front-lethe', 'dam-break-mm-front-a225', 'dam-break-ritter-front-bound'],
    gaps: [
      { quantity: 'max |Z - Z_ref| vs dam-break-mm-front-lethe, 0<T<=3, N=33, best shift dT=0.13', value: 0.0769, tolerance: 0.25, unit: 'Z = x/a', pass: true },
      { quantity: 'max |Z - Z_ref| vs dam-break-mm-front-a225 (T<=3, same dT=0.13), N=33', value: 0.0956, tolerance: 0.25, unit: 'Z = x/a', pass: true },
      { quantity: 'best-fit time shift dT (Lethe), N=33 (N=24/48/64: 0.09/0.16/0.175)', value: 0.13, tolerance: 0.25, unit: 'T', pass: true },
      { quantity: 'max |Z - Z_ref| (Lethe, best shift) at N=24 / 48 / 64', value: 0.0776, tolerance: 0.25, unit: 'Z (worst of 0.0748 / 0.0775 / 0.0776)', pass: true },
      { quantity: 'Ritter bound violations Z > 1+2T (all steps, all runs); min margin 0.008 (N=64, at T=0)', value: 0, tolerance: 0, unit: 'count', pass: true },
      { quantity: 'max Mach max|v|/c0, N=33 (N=24/48/64: 0.1037/0.1059/0.1069)', value: 0.1051, tolerance: 0.1, unit: 'Ma (method criterion Ma <= 0.1)', pass: false },
      { quantity: 'max over time of particle-mean |rho/rho0 - 1|, N=33', value: 0.00229, tolerance: 0.01, unit: 'rel', pass: true },
      { quantity: 'fluid mass drift / particle count change / particles outside tank', value: 0, tolerance: 1e-12, unit: 'rel / count', pass: true },
      { quantity: 'largest rise of KE+PE+E_el(fluid) above its running minimum, N=33', value: 1.07e-4, tolerance: 1e-3, unit: 'E0 (reviewer criterion)', pass: true }
    ],
    checks: [
      { name: 'mass conservation', status: 'pass', detail: 'equal-mass particles: particle count and total mass constant to 0 in all runs; no fluid particle left the tank (x<0, x>Lx, y<0).' },
      { name: 'energy budget', status: 'pass',
        detail: 'KE+PE falls monotonically after an initial release: it rises by 1.69e-3 E0 at T~0.08, which equals the released initial EOS storage (El0 = 32 J = 1.63e-3 E0). ' +
          'KE+PE+E_el(fluid), with Tait internal energy, rises at most 1.07e-4 E0 (N=33) and 4e-5 E0 (N=64). Mechanical loss by T=3: 6.5% (N=33), 7.9/5.4/4.9% at N=24/48/64. ' +
          'Wall-particle elastic storage cannot be observed through the API, so it is excluded.' },
      { name: 'stability: no NaN / divergence, acoustic CFL', status: 'pass', detail: 'no NaN, diverged() false in all runs; acoustic CFL dt(c0+|v|)/h = 0.125 = stated C_cfl.' },
      { name: 'stability: weak-compressibility (Mach) criterion', status: 'fail',
        detail: 'Method states c0 >= 10 Umax / Ma <= 0.1. Measured max|v|/c0 = 0.1037/0.1051/0.1059/0.1069 at N = 24/33/48/64. It first exceeds 0.1 at T = 2.53-2.70, ' +
          'in up to ~40 particles in the front tongue. Real front speed ~1.05 sqrt(2gH) > the a priori estimate sqrt(2gH) used for c0. With cfac = 15, Ma = 0.070 and all checks pass. ' +
          'The front moves by <= 0.036 in Z, so the Z(T) claim does not depend on this violation.' },
      { name: 'density error', status: 'pass',
        detail: 'particle-mean |rho/rho0-1| <= 0.24% at all N (criterion 1%). Info: the per-particle max is 1.4-2.1%, from 1-8 particles at floor impact. It does not scale as 1/c0^2: 1.23% at cfac 15.' },
      { name: 'quantitative (Z(T) vs Martin & Moyce)', status: 'pass',
        detail: 'Lethe gap 0.077 (dT=0.13) at N=33; dT=0 gives 0.240 (N=33) and 0.299 (N=64). Lethe\'s own dT=0.175 gives 0.088 (N=33). a225 cross-copy 0.096 (own best dT=0.19: 0.021). ' +
          'The gap is resolution-independent, but the best shift drifts up with N (0.09 to 0.175) as the front speeds up (Z(3) = 3.86/3.92/3.97/4.00), and is not yet converged.' },
      { name: 'Ritter bound', status: 'pass', detail: 'Z_sim <= 1+2T at every step in every run. Tightest margin is at T=0 (particle-centre offset dx/2). Late-time dZ/dT ~1.4 < 2.' },
      { name: 'scale invariance', status: 'pass', detail: 'info: a = 0.05715 m (2.25 in) gives Z(T) identical to a = 1 m at N = 24 (max diff 0). The nondimensional set-up is exact.' }
    ],
    missing: [
      'martin1952 is verified:false (paywalled; original table not read). Z(T) comes from two open secondary copies, Lethe dam-break-2d.py and PySPH db_exp_data.py (digitised from Fig. 3). They agree to ~0.08.',
      'ritter1892-pysph is verified:false (original not read; formula from the PySPH SWE example).',
      'No Martin & Moyce residual column-height H/2a(T) reference is available, so the column_height probe was not verified.',
      'The time-shift allowance (dT <= 0.25) and Lethe\'s +0.175 correction are empirical (gate-opening lag), not stated by Martin & Moyce. Without the shift, the gap is 0.19-0.30, which exceeds 0.25 at N >= 48.',
      'Resolution study up to N = 64 (8192 fluid particles). The best-fit shift is still rising with N, and convergence of Z(T) is not demonstrated.',
      'Energy-rise threshold (1e-3 E0) and the use of the particle-mean density error are reviewer choices. Wall-particle elastic energy is not observable.',
      'becker2007 (c0 >= 10 Umax, eta = 0.01) is search-snippet only (verified:false).'
    ],
    reviewer: 'reviewer-wcsph-dam-front-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'flagged',
      reason: 'Z(T) within tolerance (0.077 vs 0.25, dT=0.13; robust over N=24-64), Ritter bound, mass and energy pass. Method\'s own Ma <= 0.1 criterion exceeded (0.104-0.107 at all N) with default c0 = 10 sqrt(2gH). cfac=15 passes all checks.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
