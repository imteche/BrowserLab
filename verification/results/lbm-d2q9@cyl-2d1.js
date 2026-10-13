/* Verification record: lbm-d2q9 @ cyl-2d1. Reviewer: reviewer-lbm-d2q9-cyl-2d1-r2 (not the builder), round 2.
 * Numbers from verification/checks/lbm-d2q9@cyl-2d1.check.js (8 runs, re-run from scratch after refinement round 1);
 * report in verification/reports/lbm-d2q9@cyl-2d1.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'lbm-d2q9@cyl-2d1',
    method: 'lbm-d2q9', scene: 'cylinder', experiment: 'cyl-2d1',
    status: 'matched',
    claim: 'At the method defaults (20 cells/D, Um_lat = 0.1, tau = 0.7, staircase bounce-back, Zou-He pressure outlet) D2Q9 BGK reaches a steady 2D-1 state ' +
      'with cD = 5.6974 (+2.11% vs 5.5795, tol 3%), cL = 0.01158 (+0.00096, tol 0.003) and dp = 0.11945 (+1.64% vs 0.11752, tol 3%); ' +
      'none of the three lies inside the narrow 1996 intervals. After the round-1 outlet-corner fix every run in the method range ' +
      '(res 10/20/30/40, Ulat 0.02-0.1) stays stable; the res-10 runs that diverged in round 1 are now steady to 1e-12 over 150 s.',
    conditions: {
      Re: 20, res: 20, Ulat: 0.1, ibb: 0, tau: 0.7, nx: 440, ny: 82, steps: 36000, t_end: 60, Mach_max: 0.239,
      convergence: 'over the last 10 s: |dcD|/cD = 1.8e-6, |dcL| = 5.5e-6, |ddp|/dp = 1.8e-6, |dM|/M0 = 6.4e-7 (reviewer bound 1e-5 / 1e-6)',
      extra_runs: 'res 20 ibb=1 (T 60 s); res 20 Ulat 0.05 (T 100 s); res 30 (T 35 s); res 40 (T 25 s, not converged); res 10 Ulat 0.1 / 0.05 / 0.02 (T 150 s)',
      not_run: 'converged res 40 / res 80 (runtime budget); Ulat > ~0.12 (peak Mach would exceed the stated 0.3 criterion)',
      check: 'verification/checks/lbm-d2q9@cyl-2d1.check.js'
    },
    reference: ['cylinder-2d1-cd', 'cylinder-2d1-cl', 'cylinder-2d1-dp'],
    gaps: [
      { quantity: 'cD relative gap vs 5.57953523384 (res 20, sim 5.69743; interval [5.57, 5.59] not met)', value: 0.02113, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'cL absolute gap vs 0.010618948146 (res 20, sim 0.011578; interval [0.0104, 0.0110] not met)', value: 0.00096, tolerance: 0.003, unit: 'abs', pass: true },
      { quantity: 'dp relative gap vs 0.11752016697 (res 20, sim 0.119450; interval [0.1172, 0.1176] not met)', value: 0.01642, tolerance: 0.03, unit: 'rel', pass: true }
    ],
    checks: [
      { name: 'stability (method criterion, all allowed resolutions)', status: 'pass',
        detail: '8 runs, none NaN, max Mach <= 0.2414 in every run. res 10 (lowest of range 10-80) at Ulat 0.1 / 0.05 / 0.02 (tau 0.6 / 0.55 / 0.52): steady from t ~ 40 s to t = 150 s ' +
          '(|dcD|/cD <= 1.1e-12, |dM|/M0 <= 5e-14 over the last 10 s); outlet wall-adjacent rows u = 0.0145 m/s (res 20: 0.0073, res 30: 0.0049, res 40: 0.0037, i.e. first-order wall slip), ' +
          'outlet mid-channel u = 0.297 m/s. The round-1 outlet-column blow-up (Ma 1.34, NaN at 139 s) no longer occurs.' },
      { name: 'stability (primary, res 20)', status: 'pass',
        detail: 'no NaN; tau = 0.7; max Mach 0.239 (initial transient; 0.233 steady) < 0.3; steady to 1.8e-6 relative over the last 10 s of 60 s. Also steady at res 20 ibb (60 s) and res 20 Ulat 0.05 (100 s, 1.6e-10).' },
      { name: 'mass conservation (open channel, primary)', status: 'pass',
        detail: 'total mass is not an invariant (open inflow/outflow). Steady-state checks: |M(60) - M(50)|/M0 = 6.4e-7 (< 1e-6); mass-flux balance |Q_out - Q_in|/Q_in = 5.1e-5 (< 1%); ' +
          'Q_in = 0.081994 m^2/s vs Ubar H = 0.082 (-7e-5). Momentum/energy are not invariants of this forced, dissipative, open problem.' },
      { name: 'quantitative vs Schafer-Turek / Nabh (primary, res 20)', status: 'pass',
        detail: 'cD +2.11%, dp +1.64% (tol 3% rel), cL +0.00096 (tol 0.003 abs). In-interval (information): none of cD, cL, dp in the 1996 intervals at res 20.' },
      { name: 'grid / Mach trend (information, non-default parameters)', status: 'n/a',
        detail: 'staircase, Ulat 0.1: cD +5.82% (res 10) -> +2.11% (20) -> +1.69% (30, 35 s, drifting 2e-4/10 s) -> +0.83% (40, 25 s, drifting 1.8e-3/10 s); ' +
          'dp -2.16% -> +1.64% -> 0.00% -> -0.21%; cL 0.01564 -> 0.01158 -> 0.01147 -> 0.01147. res 10 is outside the 3% band for cD (+5.8..+6.7%), cL (+0.0038..+0.0054 > 0.003) and, at low Ulat, dp (-7.6% at 0.05, -14.2% at 0.02). ' +
          'res 20 Ulat 0.05 (tau 0.6): cD +2.61%, cL +0.00109, dp +3.72% (just outside 3%). Interpolated bounce-back at res 20: cD +0.78%, cL -0.00025, dp +1.28%. ' +
          'These are discretisation/tau-dependent staircase errors at non-default settings, not part of the published protocol; reported, not used for classification.' },
      { name: 'interpolated bounce-back mass balance (information)', status: 'n/a',
        detail: 'ibb = 1 (non-default) at res 20 is steady but Q_out is 0.62% below Q_in (linear Bouzidi rule is not mass conserving). Not used for classification.' }
    ],
    missing: [
      'schafer1996 (intervals) is verified:false and paywalled: values come from three mutually identical MIT-licensed GitHub copies (copy-vortexlab-dfg, copy-adelowo-dfg, copy-karman-dfg, verified:true copies) plus DD2365_FEniCSx; Table 3 not checked against the original.',
      'nabh1998 (refined value cD 5.57953523384, cL 0.010618948146, dp 0.11752016697) is verified:false; quoted from the FeatFlow page through the same copies (FeatFlow site not reachable). john2001 (cL cross-check) verified:false.',
      'LBM method sources (qian1992, he1997, zou1997, ladd1994, hou1995) verified:false. The Zou-He pressure outlet (including the round-1 corner-node closure) and the Bouzidi bounce-back are builder additions not taken from a read source; the reviewer checked algebraically that the corner closure enforces rho = 1 and rho u_y = 0. The outlet replaces the benchmark do-nothing outflow.',
      'No converged run beyond res 30 (res 30 itself drifts 2e-4/10 s at 35 s): res 40 stopped at t = 25 s, res 80 not run (runtime budget). Grid convergence order not established.',
      'Ulat above ~0.12 (allowed up to 0.2) was not run: it violates the method\'s stated Mach < 0.3 criterion, so it is outside the stability claim.',
      'Recirculation length La (cylinder-2d1-la) is not in the probe contract and was not measured.',
      'Steadiness (1e-5 per 10 s), mass-stationarity (1e-6) and flux-balance (1%) bounds are reviewer-set; no source specifies them.'
    ],
    reviewer: 'reviewer-lbm-d2q9-cyl-2d1-r2', round: 2, date: '2026-10-13',
    history: [
      { round: 1, status: 'flagged',
        reason: 'Default protocol (res 20, Ulat 0.1) passes all three suggested tolerances (cD +2.11%, cL +0.00096, dp +1.64%; none inside the 1996 intervals), steady, mass-flux balanced, Ma 0.24. ' +
          'Flagged: at res 10 (in the method range; tau 0.6/0.55, Ma 0.24/0.12 satisfy its stated criterion) the solution leaves the steady state at t ~ 40-50 s via an instability that starts at the Zou-He outlet column (outlet wall-row u 0.19 m/s at onset) and blows up (Ma 1.34 at 150 s; NaN at 139 s).' },
      { round: 2, status: 'matched',
        reason: 'After the outlet-corner fix, re-run from scratch: defaults unchanged (cD +2.11%, cL +0.00096, dp +1.64%, all within tolerance; steady; flux balance 5e-5). ' +
          'All 8 runs in the allowed range (res 10-40, Ulat 0.02-0.1, ibb 0/1) stable; res 10 at Ulat 0.1/0.05/0.02 steady to 150 s. Coarse/low-Ulat non-default runs miss the 3% band (information only).' }
    ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
