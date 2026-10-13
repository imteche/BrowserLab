/* Verification record: lbm-d2q9 @ cyl-2d2. Reviewer: reviewer-lbm-d2q9-cyl-2d2-r2 (not the builder).
 * Numbers from verification/checks/lbm-d2q9@cyl-2d2.check.js (re-run in round 2 after refinement round 1);
 * report in verification/reports/lbm-d2q9@cyl-2d2.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'lbm-d2q9@cyl-2d2',
    method: 'lbm-d2q9', scene: 'cylinder', experiment: 'cyl-2d2',
    status: 'flagged',
    claim: 'D2Q9 BGK reproduces the DFG 2D-2 (Re = 100) shedding benchmark: St, max C_D, max C_L within the reference tolerances. ' +
      'Result (round 2): the outlet instability is fixed. All five runs (res 20/30, staircase/interpolated, Ulat 0.1/0.05) stay stable to 10 s with stationary domain mass (|dM| < 1e-5 M0 over the window). ' +
      'At the method defaults (res 20, staircase, tau 0.54) St = 0.2966 (-1.7%) passes, but max C_D = 3.439 (+6.6%, tol 3%) and max C_L = 1.080 (+9.4%, tol 5%) fail. ' +
      'res 30 staircase: C_D +4.5%, C_L +6.3% (fail). Interpolated bounce-back (ibb = 1) passes all three at res 20 (St -0.65%, C_D +2.95%, C_L -1.4%) and res 30 (St -0.40%, C_D +1.8%, C_L -0.11%). ' +
      'The remaining failure is the first-order staircase cylinder used by default, not an implementation defect.',
    conditions: {
      Re: 100, Um: 1.5, Ubar: 1.0, nu: 1e-3, T_end: 10, window: 't in [6, 10] s (~12 periods, 11 full periods analysed)',
      runs: 'A res20 Ulat0.1 ibb0 (method defaults, tau 0.54, 440x82, 30000 steps); B res20 Ulat0.1 ibb1; C res30 Ulat0.1 ibb0 (tau 0.56, 660x123, 45000 steps); ' +
        'D res30 Ulat0.1 ibb1; E res20 Ulat0.05 ibb0 (tau 0.52). All stable to t = 10 s.',
      Mach_max_window: 0.261, Mach_startup_peak: 0.3056,
      not_run: 'res 40 (~11 min single-core) exceeds the review budget; 7.0 min wall for the five runs on 4 cores',
      check: 'verification/checks/lbm-d2q9@cyl-2d2.check.js'
    },
    reference: ['cylinder-2d2-st', 'cylinder-2d2-cdmax', 'cylinder-2d2-clmax', 'cylinder-2d2-dp'],
    gaps: [
      { quantity: 'St, res 20 staircase = method defaults (sim 0.29661 vs 0.30184)', value: 0.0173, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'max C_D, res 20 staircase = method defaults (sim 3.4389 vs 3.227393)', value: 0.0655, tolerance: 0.03, unit: 'rel', pass: false },
      { quantity: 'max C_L, res 20 staircase = method defaults (sim 1.0798 vs 0.986571)', value: 0.0945, tolerance: 0.05, unit: 'rel', pass: false },
      { quantity: 'St, res 30 staircase (sim 0.29757)', value: 0.0141, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'max C_D, res 30 staircase (sim 3.3724)', value: 0.0449, tolerance: 0.03, unit: 'rel', pass: false },
      { quantity: 'max C_L, res 30 staircase (sim 1.0489)', value: 0.0632, tolerance: 0.05, unit: 'rel', pass: false },
      { quantity: 'St, res 20 interpolated BB (sim 0.29986)', value: 0.0065, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'max C_D, res 20 interpolated BB (sim 3.3226)', value: 0.0295, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'max C_L, res 20 interpolated BB (sim 0.97267)', value: 0.0141, tolerance: 0.05, unit: 'rel', pass: true },
      { quantity: 'St, res 30 interpolated BB (sim 0.30063)', value: 0.0040, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'max C_D, res 30 interpolated BB (sim 3.2859)', value: 0.0181, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'max C_L, res 30 interpolated BB (sim 0.98550)', value: 0.0011, tolerance: 0.05, unit: 'rel', pass: true }
    ],
    checks: [
      { name: 'stability', status: 'pass',
        detail: 'All five runs reach t = 10 s with no NaN (round 1: A diverged at 8.15 s, B at 6.8 s, E at 5.8 s). tau 0.52-0.56 > 1/2. Window max Mach 0.261 (A), 0.259 (B), 0.260 (C), 0.259 (D), 0.131 (E) < 0.3. ' +
          'Impulsive-start pressure-wave peak at t = 0.05 s: 0.3056 (A), 0.3022 (B), 0.3004 (C), 0.3001 (D), 0.144 (E); reported only, as in round 1.' },
      { name: 'mass conservation (open domain: stationarity + flux balance)', status: 'pass',
        detail: 'Reviewer bound |mean M(last 2 periods) - mean M(first 2 periods)|/M0 < 1e-4: A -2.5e-6, B -1.5e-6, C -6.7e-6, D -9.1e-6, E -5.7e-6 (all pass; round 1 D failed with 7.5e-4, res 20 runs grew to 0.12 before NaN). ' +
          '(M - M0)/M0 stays in [1.1e-3, 1.9e-3] in the window (initial pressure field fill-up). Period-averaged VOLUME flux Q_out - Q_in (1% reviewer bound): A +0.92%, C +0.96%, D +0.94%, E +0.17% pass; B -1.37% fails. ' +
          'Inflow Q_in vs Ubar H = 0.41: -1.01% (A, marginal fail of the 1% bound), -0.93 to -0.99% (B-D), -0.26% (E). Volume flux is not conserved in weakly compressible LBM (inlet rho > 1, outlet rho = 1; the +0.9% at Ulat 0.1 shrinks to +0.17% at Ulat 0.05, as compressibility predicts), ' +
          'and the 0.05 s sampling of a strongly fluctuating outlet column is coarse; the mass-stationarity result is the conservation verdict. Momentum and energy are not invariants of this forced, open, viscous problem.' },
      { name: 'periodic state reached', status: 'pass',
        detail: 'Period spread 0.10% (A), 0.04% (B), 0.07% (C), 0.04% (D), 0.18% (E). Per-period max C_L spread 1.04% (A, just over the 1% reviewer criterion; the window maximum is 1.080 vs per-period minimum 1.069, both far outside tolerance), 0.29% (B), 0.31% (C), 0.21% (D), 0.83% (E). ' +
          'First vs second half of window: St within 0.03%, maxima within 0.25%.' },
      { name: 'quantitative vs DFG 2D-2', status: 'fail',
        detail: 'Method defaults (res 20 staircase): St -1.7% pass, max C_D +6.6% fail (tol 3%), max C_L +9.4% fail (tol 5%). res 20 Ulat 0.05 (E): C_D +6.5%, C_L +7.4% fail, so not a Mach effect. ' +
          'res 30 staircase: C_D +4.5%, C_L +6.3% fail. ibb = 1 passes all three at res 20 and res 30. Staircase error decreases with resolution (C_D +6.6% -> +4.5% for res 20 -> 30) and vanishes with the interpolated wall: a first-order geometry error of the default boundary, not a defect. ' +
          'In-range vs the 1996 intervals: St yes (all); C_D no (all > 3.24); C_L no. Acoustic content negligible: rms(signal - P/100 moving average) <= 1.8e-4; smoothed maxima within 8e-4 of raw.' },
      { name: 'pressure difference dp at t0 + 1/(2f) (information)', status: 'n/a',
        detail: 'A 2.687 (+8.1%), B 2.608 (+5.0%), C 2.494 (+0.38%), D 2.503 (+0.72%), E 2.757 (+11.0%) vs 2.4848, tol 4%. Not part of the experiment quantity.' },
      { name: 'raw zero crossings vs mean-removed (information)', status: 'n/a',
        detail: 'mean C_L -0.016 to -0.025; St from raw C_L zero crossings equals the mean-removed value to 4e-6.' }
    ],
    missing: [
      'schafer1996 is registered verified:false (Springer, paywalled; original not read). The 1996 intervals come from three MIT-licensed copies that agree exactly (copy-vortexlab-dfg, copy-adelowo-dfg, copy-karman-dfg, all verified:true); Table 4 numbering unverified.',
      'featflow-dfg (source of the refined values used as gap targets: St 0.30184, cD,max 3.227393, cL,max 0.986571, dp 2.4848) is verified:false: site unreachable, values extracted by third parties from the official time-series file.',
      'LBM method sources (qian1992, he1997, zou1997, ladd1994, hou1995) not read in full; the Zou-He outlet formulas, including the round-1 corner-node closure, are builder derivations (reviewer re-derived: the corner formulas impose rho = rhoOut and rho u_y = 0 exactly). Bouzidi interpolated bounce-back (ibb) is not among the registered sources.',
      'The benchmark prescribes a do-nothing outflow; the method substitutes a fixed-density Zou-He outlet (stated in its assumptions).',
      'res 40 and horizons beyond 10 s not run (budget). Mass is stationary to < 1e-5 over the window, so no drift toward divergence is visible.',
      'Mass-stationarity (1e-4), flux-balance (1%), periodicity (1%) and window-Mach criteria are reviewer-set; no source specifies them.'
    ],
    reviewer: 'reviewer-lbm-d2q9-cyl-2d2-r2', round: 2, date: '2026-10-13',
    history: [
      { round: 1, status: 'flagged',
        reason: 'Method defaults (res 20, tau 0.54) diverge at t = 8.15 s (6.8 s ibb; 5.8 s at Ulat 0.05) from the Zou-He pressure outlet (monotonic mass growth, max |u| at last column). ' +
          'res 30 staircase stable but max C_D +4.5% (tol 3%), max C_L +6.3% (tol 5%); St -1.4% passes. res 30 ibb passes all three gaps but its mass drifts (7.5e-4 per 4 s window).' },
      { round: 2, status: 'flagged',
        reason: 'Outlet corner fix works: all runs stable to 10 s, mass stationary (< 1e-5). Defaults (res 20 staircase) give St -1.7% (pass) but max C_D +6.6% (tol 3%) and max C_L +9.4% (tol 5%); res 30 staircase C_D +4.5%, C_L +6.3%. ' +
          'Interpolated bounce-back (ibb = 1) passes all three at res 20 and 30. Remaining gap is the first-order staircase default, not an implementation defect.' }
    ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
