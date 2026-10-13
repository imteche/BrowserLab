/* Verification record: lbm-d2q9 @ cyl-2d2. Reviewer: reviewer-lbm-d2q9-cyl-2d2-r1 (not the builder).
 * Numbers from verification/checks/lbm-d2q9@cyl-2d2.check.js; report in
 * verification/reports/lbm-d2q9@cyl-2d2.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'lbm-d2q9@cyl-2d2',
    method: 'lbm-d2q9', scene: 'cylinder', experiment: 'cyl-2d2',
    status: 'flagged',
    claim: 'D2Q9 BGK reproduces the DFG 2D-2 (Re = 100) shedding benchmark: St, max C_D, max C_L within the reference tolerances. ' +
      'Result: NOT reproduced at the method defaults. At res = 20 cells/D (Ulat 0.1, tau 0.54) the run diverges at t = 8.15 s (staircase) / 6.8 s (interpolated bounce-back), ' +
      'and at Ulat 0.05 (tau 0.52) at t = 5.8 s; the instability starts at the Zou-He pressure outlet column (mass grows monotonically from t ~ 5 s). ' +
      'At res = 30 staircase is stable but max C_D = 3.372 (+4.5%, tol 3%) and max C_L = 1.049 (+6.3%, tol 5%) fail; St = 0.2976 (-1.4%) passes. ' +
      'res = 30 with interpolated bounce-back gives St 0.3005, max C_D 3.286 (+1.8%), max C_L 0.9856 (-0.1%), all within tolerance, but its domain mass is not stationary (same outlet drift).',
    conditions: {
      Re: 100, Um: 1.5, Ubar: 1.0, nu: 1e-3, T_end: 10, window: 't in [6, 10] s (~12 periods)',
      runs: 'A res20 Ulat0.1 ibb0 (method defaults, tau 0.54): diverged t=8.15 s; B res20 Ulat0.1 ibb1: diverged t=6.8 s; ' +
        'C res30 Ulat0.1 ibb0 (tau 0.56, 660x123, 45000 steps): stable; D res30 Ulat0.1 ibb1: stable to 10 s, mass drifting; E res20 Ulat0.05 ibb0 (tau 0.52): diverged t=5.8 s',
      Mach_max_window: 0.260, Mach_startup_peak: 0.3004,
      not_run: 'res 40 to 10 s (~11 min single-core at ~13 MLUPS) and longer horizons (to see whether D also diverges) exceed the review budget',
      check: 'verification/checks/lbm-d2q9@cyl-2d2.check.js'
    },
    reference: ['cylinder-2d2-st', 'cylinder-2d2-cdmax', 'cylinder-2d2-clmax', 'cylinder-2d2-dp'],
    gaps: [
      { quantity: 'St, res 20 (method default), any variant', value: null, tolerance: 0.03, unit: 'rel', pass: false },
      { quantity: 'St, res 30 staircase (sim 0.29756 vs 0.30184)', value: 0.0142, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'max C_D, res 30 staircase (sim 3.3724 vs 3.227393)', value: 0.0449, tolerance: 0.03, unit: 'rel', pass: false },
      { quantity: 'max C_L, res 30 staircase (sim 1.0489 vs 0.986571)', value: 0.0632, tolerance: 0.05, unit: 'rel', pass: false },
      { quantity: 'St, res 30 interpolated BB (sim 0.30052)', value: 0.0044, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'max C_D, res 30 interpolated BB (sim 3.2856)', value: 0.0181, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'max C_L, res 30 interpolated BB (sim 0.98564)', value: 0.0009, tolerance: 0.05, unit: 'rel', pass: true }
    ],
    checks: [
      { name: 'stability', status: 'fail',
        detail: 'Method defaults (res 20, Ulat 0.1, tau 0.54, inside the stated tau >~ 0.51-0.55 band, notes say "prefer res >= 20") diverge to NaN at t = 8.15 s (staircase) and 6.8 s (ibb); ' +
          'res 20 Ulat 0.05 (tau 0.52, Ma halved) diverges at 5.8 s. Diagnostic (res 20 ibb 0): location of max |u| moves from the cylinder shoulder to the last column x = 2.198 m at t = 5.25 s; ' +
          'Mach there 0.27 -> 0.70 (t 5.25 -> 8.0 s) while (M-M0)/M0 grows monotonically 3.6e-3 -> 0.12, i.e. the Zou-He rho = 1 outlet injects mass and seeds the blow-up. ' +
          'res 30 runs: no NaN; window Mach 0.260 / 0.259 < 0.3; start-up pressure-wave peak 0.3004 at t = 0.05 s (impulsive start, reported only).' },
      { name: 'mass conservation (open domain: stationarity + flux balance)', status: 'fail',
        detail: 'Reviewer bound: domain mass change over the window (mean of last 2 periods - first 2 periods)/M0 < 1e-4. res 30 staircase: 7.5e-5 (pass); res 30 ibb: 7.5e-4 (fail; dmass 1.16e-3 -> 2.28e-3 within the window, rising like the precursor of the res 20 blow-up). ' +
          'Period-averaged volume flux Q_out - Q_in: +0.99% (C), +1.06% (D) vs 1% reviewer bound. Inflow volume flux 0.4061 vs Ubar H = 0.41 (-0.95%, both; moving-wall BB fixes rho0 u, not u, with rho > 1 at the inlet). ' +
          'Momentum and energy are not invariants of this forced, open, viscous problem.' },
      { name: 'periodic state reached', status: 'pass',
        detail: 'res 30 runs: period spread 0.08% / 0.13%, per-period max C_L spread 0.31% / 0.23%, max C_D spread 0.33% / 0.22%; first vs second half of window differ by < 0.03% in St and < 0.3% in maxima.' },
      { name: 'quantitative vs DFG 2D-2', status: 'fail',
        detail: 'Default protocol (res 20) yields no window (diverged). res 30 staircase: St pass (-1.4%), max C_D +4.5% (tol 3%) fail, max C_L +6.3% (tol 5%) fail. ' +
          'res 30 ibb: all three pass (St -0.44%, C_D +1.8%, C_L -0.09%); in-range vs the 1996 intervals: St yes, C_D no (3.286 > 3.24), C_L no (0.986 < 0.99, as is the refined reference). ' +
          'High-frequency (acoustic) content is negligible: rms(signal - P/100 moving average) 3.7e-5 (C_D), 1.2e-4 (C_L); smoothed maxima differ from raw by < 2e-4.' },
      { name: 'pressure difference dp at t0 + 1/(2f) (information)', status: 'n/a',
        detail: 'res 30 staircase 2.4939 (+0.37%), ibb 2.4986 (+0.56%) vs 2.4848, tol 4%; both inside [2.46, 2.50]. Not part of the experiment quantity; t0 = a cL maximum just after the window.' },
      { name: 'raw zero crossings vs mean-removed (information)', status: 'n/a',
        detail: 'mean C_L = -0.018 / -0.020; St from raw C_L zero crossings equals the mean-removed value to 2e-7.' }
    ],
    missing: [
      'schafer1996 is registered verified:false (Springer, paywalled; original not read). The 1996 intervals come from three MIT-licensed copies that agree exactly (copy-vortexlab-dfg, copy-adelowo-dfg, copy-karman-dfg, all verified:true); Table 4 numbering unverified.',
      'featflow-dfg (source of the refined values used as gap targets: St 0.30184, cD,max 3.227393, cL,max 0.986571, dp 2.4848) is verified:false: site unreachable, values extracted by third parties from the official time-series file.',
      'LBM method sources (qian1992, he1997, zou1997, ladd1994, hou1995) not read in full by the researcher; the Zou-He outlet formula is a builder derivation. Bouzidi interpolated bounce-back (ibb) is not among the registered sources.',
      'The benchmark prescribes a do-nothing outflow; the method substitutes a fixed-density Zou-He outlet (stated in its assumptions). That substitution is where the observed instability nucleates.',
      'res 40 and longer horizons (does the res 30 ibb mass drift end in divergence?) not run: over the ~10 min budget (480 s wall for the five runs on a shared 4-core machine).',
      'Mass-stationarity (1e-4), flux-balance (1%) and window-Mach criteria are reviewer-set; no source specifies them.'
    ],
    reviewer: 'reviewer-lbm-d2q9-cyl-2d2-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'flagged',
      reason: 'Method defaults (res 20, tau 0.54) diverge at t = 8.15 s (6.8 s ibb; 5.8 s at Ulat 0.05) from the Zou-He pressure outlet (monotonic mass growth, max |u| at last column). ' +
        'res 30 staircase stable but max C_D +4.5% (tol 3%), max C_L +6.3% (tol 5%); St -1.4% passes. res 30 ibb passes all three gaps but its mass drifts (7.5e-4 per 4 s window).' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
