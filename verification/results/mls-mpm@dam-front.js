/* Verification record: mls-mpm @ dam-front. Reviewer: reviewer-mls-mpm-dam-front-r1 (not the builder).
 * Numbers from verification/checks/mls-mpm@dam-front.check.js; report in verification/reports/mls-mpm@dam-front.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'mls-mpm@dam-front',
    method: 'mls-mpm', scene: 'dam-break', experiment: 'dam-front',
    status: 'matched',
    claim: 'MLS-MPM (APIC, weakly compressible p = -E(J-1), default cfac = 10, cfl = 0.4, separating walls) reproduces the Martin & Moyce (1952) ' +
      'surge-front history Z(T) for the a = 2.25 in, n^2 = 2 column over 0 < T <= 3 within the reference tolerance 0.25 after one time shift dT in [0, 0.25]: ' +
      'max |Z - Z_ref| = 0.085 (dT = 0.24) at N = 96 cells across a (73 728 particles), 0.087 / 0.090 / 0.097 at N = 64 / 32 / 16. Never exceeds the Ritter bound; ' +
      'mass exact, P2G/G2P momentum at round-off (<= 1.2e-14), energy non-increasing, stable, max |J-1| <= 2.6% (time-mean 0.12%). ' +
      'Without the shift the error is 0.40 (N = 96), and the best shift grows with resolution toward the 0.25 limit (0.20 -> 0.24).',
    conditions: {
      a: 0.05715, g: 9.81, rho0: 1000, N: '16 / 32 / 64 / 96 grid cells across a (2048 / 8192 / 32768 / 73728 particles, 4 per cell); primary N = 96',
      tank: '5a x 3a (default); extended 12a x 3a at N = 32 for the a = 2.25 in digitised series',
      cfac: '10 (c0 = 10 sqrt(2 g 2a) = 14.98 m/s); sensitivity 20 at N = 32', cfl: '0.4 (acoustic, adaptive dt); sensitivity 0.2 at N = 32',
      bc: '0 (separating slip, mpm88); sensitivity bc = 1 (sticky sides) at N = 32',
      steps: '1853 / 3707 / 7420 / 11133 to T = 3.05', T_end: '3.05 (default tank), 9.4 (extended tank)',
      metric: 'max |Z_sim(T - dT) - Z_ref(T)| over reference points 0 < T <= 3, single dT in [0, 0.25] (step 0.005)',
      check: 'verification/checks/mls-mpm@dam-front.check.js (about 6 min)'
    },
    reference: ['dam-break-mm-front-lethe', 'dam-break-mm-front-a225', 'dam-break-ritter-front-bound'],
    gaps: [
      { quantity: 'max |Z - Z_ref| vs Lethe copy, 0 < T <= 3, best shift dT = 0.24, N = 96', value: 0.0850, tolerance: 0.25, unit: 'Z = x/a', pass: true },
      { quantity: 'max |Z - Z_ref| vs Lethe copy, 0 < T <= 3, best shift dT = 0.235, N = 64', value: 0.0869, tolerance: 0.25, unit: 'Z = x/a', pass: true },
      { quantity: 'max |Z - Z_ref| vs Lethe copy, 0 < T <= 3, best shift dT = 0.22, N = 32', value: 0.0902, tolerance: 0.25, unit: 'Z = x/a', pass: true },
      { quantity: 'max |Z - Z_ref| vs Lethe copy, 0 < T <= 3, best shift dT = 0.20, N = 16', value: 0.0966, tolerance: 0.25, unit: 'Z = x/a', pass: true },
      { quantity: 'max |Z - Z_ref| vs PySPH a = 2.25 in series, 0 < T <= 3, best shift dT = 0.25, N = 32 (tank 12a)', value: 0.0625, tolerance: 0.25, unit: 'Z = x/a', pass: true },
      { quantity: 'max over all steps of Z - (1 + 2T) (Ritter bound; must be <= 0), all runs', value: -0.0032, tolerance: 0, unit: 'Z = x/a', pass: true }
    ],
    checks: [
      { name: 'mass conservation', status: 'pass', detail: 'fixed particle masses; relative mass drift 0 in every run' },
      { name: 'P2G / G2P momentum conservation', status: 'pass',
        detail: 'method diagnostics |sum grid momentum - sum particle momentum| / (M vmax), sampled every 5 steps (step 1 skipped): max P2G 1.9e-15 / 4.3e-15 / 8.4e-15 / 1.2e-14 and G2P 2.1e-15 / 3.1e-15 / 6.7e-15 / 1.2e-14 at N = 16/32/64/96 (criterion <= 1e-10, round-off). Total momentum: n/a (gravity, walls).' },
      { name: 'energy (dissipative: must not increase)', status: 'pass',
        detail: 'E = KE + PE + elastic (sum V_p E (J-1)^2/2; initial elastic 1.7e-3 E0). max (E - E0)/E0 = -4.2e-5 / -2.1e-5 / -1.0e-5 / -6.8e-6 at N = 16/32/64/96 (reviewer criterion <= 1e-3). E(T=3)/E0 - 1 = -1.5% / -2.2% / -3.1% / -4.0% (loss grows with resolution); extended run -11.2% at T = 9.4.' },
      { name: 'stability', status: 'pass',
        detail: 'no NaN/diverged() in any run (to T = 9.4). acoustic CFL dt(c0+|v|)/dx <= 0.4001 (cfl = 0.4; mpm88 runs at ~0.51); max |v| dt/dx = 0.040 (0.053 extended tank), stated limit < 1; 0 position clamps.' },
      { name: 'compressibility (J deviation)', status: 'pass',
        detail: 'max Mach |v|max/c0 = 0.109-0.111; max |J-1| over 0 < T <= 3 = 1.19% / 1.58% / 1.83% / 2.59% at N = 16/32/64/96 (grows with resolution, local impact/front peaks); particle-mean |J-1| time-averaged 0.125% / 0.122% / 0.121% / 0.120% (reviewer criterion <= 1%, the delta rho/rho ~ Ma^2 rule behind c0 = 10 U). cfac = 20: Mach 0.055, max |J-1| 0.89%, mean 0.035%.' },
      { name: 'parameter sensitivity of Z(T) (N = 32)', status: 'pass',
        detail: 'best-shift error 0.090 (default) / 0.095 (cfac 20) / 0.089 (bc 1) / 0.091 (cfl 0.2); Z(3) = 4.089 / 4.088 / 4.043 / 4.091. Front insensitive to sound speed and time step.' },
      { name: 'resolution sensitivity', status: 'pass',
        detail: 'Z(3) = 4.077 / 4.089 / 4.112 / 4.116 at N = 16/32/64/96 (increments 0.012, 0.023, 0.005: near converged). Unshifted error 0.365 / 0.372 / 0.393 / 0.398; best shift dT 0.20 / 0.22 / 0.235 / 0.24, i.e. approaching the 0.25 limit of the allowed shift. Minimum shift that brings the error under 0.25: 0.09-0.10.' },
      { name: 'late-time front, T > 3 (outside the suggested window; information only)', status: 'n/a',
        detail: 'extended tank 12a, N = 32, vs PySPH a = 2.25 in series to T = 6.82: max |dZ| = 0.565 at T = 6.31 even at dT = 0.25 (unshifted 1.05); sim leads by 0.43 at T = 4.03 and 0.41 at T = 5.69. Fitted slope dZ/dT over T 5.1-6.85: 1.91 (sim) vs 1.79 (data), Ritter 2. Front reaches 0.9 L_tank at T = 6.71. Not scored (window 0 < T <= 3 per reference).' }
    ],
    missing: [
      'martin1952 is verified:false: the original paper is paywalled and was not read. Reference values come from two open copies (Lethe dam-break-2d.py, PySPH db_exp_data.py; both verified:true) that agree to |dZ| <= 0.08; the original table/figure was not checked.',
      'ritter1892-pysph is verified:false for bibliographic details; the bound 2 sqrt(g H0) itself was confirmed in the PySPH SWE code.',
      'hu2018mlsmpm (method paper) is verified:false (snippets only, host blocked); the update equations come from the open mpm88 / mls-mpm88-explained codes (verified:true). The fluid EOS p = -E(J-1) is a research interpretation (equation marked verified:false).',
      'Research gap: no published quantitative MLS-MPM dam-break validation was found (research/ptc.md), so there is no MLS-MPM-specific protocol or published MPM Z(T) to compare against; the check is against experiment only.',
      'The time shift dT (0.20-0.24 here, at the upper end of the allowed [0, 0.25]; cf. Lethe +0.175) is an allowance for gate-opening delay that the reference permits but no source quantifies. Without it the gap is 0.37-0.40 (> 0.25). The best shift creeps toward the 0.25 edge with refinement; the tolerance would still be met at any dT >= 0.10.',
      'Beyond T = 3 (information only) the front leads the PySPH a = 2.25 in series by up to 0.57 in Z with the maximal shift; the late-time agreement is not established.',
      'No reference for the residual column height H/2a(T) (no open copy of Martin & Moyce); not checked. Note: the column_height probe at T = 3.05 is 0.47 for N <= 64 but 0.36 at N = 96 (probe uses x < dx and a node-mass filter, so it is resolution dependent).',
      'The 1e-3 E0 energy-gain criterion, the 1e-10 transfer-momentum criterion and the 1% mean |J-1| criterion are reviewer choices; no source gives these bounds for MLS-MPM. Elastic energy uses Float32 J from the view buffer.',
      'Finer resolution than N = 96 (and the mpm88 random seeding) were not run within the 10-minute budget; particles here start on a regular 2x2 lattice.'
    ],
    reviewer: 'reviewer-mls-mpm-dam-front-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'matched',
      reason: 'Lethe Z(T) within 0.085 of 0.25 (dT = 0.24, N = 96; 0.087-0.097 at N = 16-64); a225 copy within 0.063 for T <= 3; Ritter bound respected; mass exact, P2G/G2P momentum at round-off, energy non-increasing; stable; max |J-1| 2.6%, mean 0.12%. ' +
        'Unshifted gap 0.40, best shift near the 0.25 edge, and T > 3 late-time lead up to 0.57 (info) recorded; source caveats in missing.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
