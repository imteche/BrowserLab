/* Verification record: lbm-d2q9 @ cyl-2d1. Reviewer: reviewer-lbm-d2q9-cyl-2d1-r1 (not the builder).
 * Numbers from verification/checks/lbm-d2q9@cyl-2d1.check.js; report in
 * verification/reports/lbm-d2q9@cyl-2d1.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'lbm-d2q9@cyl-2d1',
    method: 'lbm-d2q9', scene: 'cylinder', experiment: 'cyl-2d1',
    status: 'flagged',
    claim: 'At the method defaults (20 cells/D, Um_lat = 0.1, tau = 0.7, staircase bounce-back) D2Q9 BGK reaches a steady 2D-1 state ' +
      'with cD = 5.6974 (+2.11% vs 5.5795, tol 3%), cL = 0.01158 (+0.00096, tol 0.003) and dp = 0.11945 (+1.64% vs 0.11752, tol 3%); ' +
      'none of the three lies inside the narrow 1996 intervals. Grid refinement moves cD and dp toward the reference ' +
      '(res 30: +1.69% / 0.00%; res 40 at t = 25 s, not yet steady: +0.83% / -0.21%). FLAGGED because at res = 10 cells/D, inside the ' +
      'method\'s parameter range and its stated stability criterion (tau 0.6 / 0.55, Ma 0.24 / 0.12), the run drifts away from the ' +
      'steady state after t ~ 40 s through an instability that starts in the outlet column and blows up (Ma 1.34 by t = 150 s; NaN at t = 139 s with Ulat 0.05).',
    conditions: {
      Re: 20, res: 20, Ulat: 0.1, ibb: 0, tau: 0.7, nx: 440, ny: 82, steps: 36000, t_end: 60, Mach_max: 0.239,
      convergence: 'over the last 10 s: |dcD|/cD = 1.8e-6, |dcL| = 5.5e-6, |ddp|/dp = 1.8e-6, |dM|/M0 = 6.4e-7 (reviewer bound 1e-5 / 1e-6)',
      extra_runs: 'res 20 ibb=1 (T 60 s); res 30 (T 35 s); res 40 (T 25 s, not converged); res 10 Ulat 0.1 and 0.05 (T 150 s)',
      not_run: 'converged res 40 / res 80 (~40 s physical at res 40 needs > 9 min alone; over budget)',
      check: 'verification/checks/lbm-d2q9@cyl-2d1.check.js'
    },
    reference: ['cylinder-2d1-cd', 'cylinder-2d1-cl', 'cylinder-2d1-dp'],
    gaps: [
      { quantity: 'cD relative gap vs 5.57953523384 (res 20, sim 5.69743; interval [5.57, 5.59] not met)', value: 0.02113, tolerance: 0.03, unit: 'rel', pass: true },
      { quantity: 'cL absolute gap vs 0.010618948146 (res 20, sim 0.011578; interval [0.0104, 0.0110] not met)', value: 0.00096, tolerance: 0.003, unit: 'abs', pass: true },
      { quantity: 'dp relative gap vs 0.11752016697 (res 20, sim 0.119450; interval [0.1172, 0.1176] not met)', value: 0.01643, tolerance: 0.03, unit: 'rel', pass: true }
    ],
    checks: [
      { name: 'stability (method criterion, all allowed resolutions)', status: 'fail',
        detail: 'res 10 (lowest value of the method\'s cylinder res range 10-80), Ulat 0.1: tau 0.6, Ma 0.235 on the plateau, yet after t ~ 40 s total mass and the outlet ' +
          'velocity grow without bound: at t = 53 s the speed maximum (0.465 m/s) sits on the outlet column (x = 2.195, y = 0.205) and the outlet wall-adjacent rows carry ' +
          'u = 0.187 m/s (no-slip walls; 0.007 m/s at res 20); by t = 150 s Ma = 1.34, mass +42%, Q_out/Q_in = 6.3. Ulat 0.05 (tau 0.55, Ma 0.12): same outlet onset, NaN at t = 139 s. ' +
          'Both runs satisfy the stated criterion "tau > 1/2, Ma < 0.3" and the method notes only warn about res 10 at Re 100.' },
      { name: 'stability (primary, res 20)', status: 'pass',
        detail: 'no NaN; tau = 0.7; max Mach 0.239 (initial transient; 0.233 steady) < 0.3; steady to 1.8e-6 relative over the last 10 s of 60 s. Also stable at res 30 (T 35 s), res 40 (T 25 s), res 20 ibb (T 60 s). ' +
          'Exploratory runs outside the check (same method, scratch script): res 20 stays steady to t = 150 s at Ulat 0.1 and to t = 100 s at Ulat 0.05 (tau 0.6); res 15 stays steady to t = 120 s.' },
      { name: 'mass conservation (open channel, primary)', status: 'pass',
        detail: 'total mass is not an invariant (open inflow/outflow). Steady-state checks: |M(60) - M(50)|/M0 = 6.4e-7 (< 1e-6); mass-flux balance |Q_out - Q_in|/Q_in = 1.6e-4 (< 1%); ' +
          'Q_in = 0.081994 m^2/s vs Ubar H = 0.082 (-7e-5). Momentum/energy are not invariants of this forced, dissipative, open problem.' },
      { name: 'quantitative vs Schafer-Turek / Nabh (primary, res 20)', status: 'pass',
        detail: 'cD +2.11%, dp +1.64% (tol 3% rel), cL +0.00096 (tol 0.003 abs). In-interval (information): none of cD, cL, dp in the 1996 intervals at res 20.' },
      { name: 'grid trend (information)', status: 'n/a',
        detail: 'staircase, Ulat 0.1: cD +5.85% (res 10, t 25 s plateau) -> +2.11% (20) -> +1.69% (30, t 35 s) -> +0.83% (40, t 25 s, still falling ~0.18%/10 s); ' +
          'dp -2.1% -> +1.64% -> 0.00% -> -0.21%; cL 0.0156 -> 0.01158 -> 0.01147 -> 0.01147 (stays ~+0.00085 above the reference). Roughly first-order, non-monotone between grids ' +
          '(staircase geometry and tau = 0.5 + 0.15 res change together). Interpolated bounce-back at res 20: cD +0.78%, cL -0.00025, dp +1.28%.' },
      { name: 'interpolated bounce-back mass balance (information)', status: 'n/a',
        detail: 'ibb = 1 (non-default) at res 20 is steady (|dM|/M0 = 3.9e-7 over 10 s) but Q_out is 1.10% below Q_in: the linear Bouzidi rule is not mass conserving and removes ~1% of the throughput at the cylinder. Not used for classification.' }
    ],
    missing: [
      'schafer1996 (intervals) is verified:false and paywalled: values come from three mutually identical MIT-licensed GitHub copies (copy-vortexlab-dfg, copy-adelowo-dfg, copy-karman-dfg, verified:true copies, all 2026 repos) plus DD2365_FEniCSx; Table 3 not checked against the original.',
      'nabh1998 (refined value cD 5.57953523384, cL 0.010618948146, dp 0.11752016697) is verified:false; quoted from the FeatFlow page through the same copies (FeatFlow site not reachable). john2001 (cL cross-check) verified:false.',
      'LBM method sources (qian1992, he1997, zou1997, ladd1994, hou1995) verified:false (abstracts/snippets). The Zou-He pressure outlet and the Bouzidi bounce-back are builder additions not taken from a read source; the outlet replaces the benchmark do-nothing outflow.',
      'No converged run beyond res 30: res 40 stopped at t = 25 s (cD still drifting 0.18% per 10 s), res 80 not run (runtime budget). Grid convergence order therefore not established.',
      'Mach sensitivity not part of the check script; an exploratory run (res 20, Ulat 0.05, tau 0.6) gave cD = 5.7253 (+2.61%) vs 5.6974 at Ulat 0.1, i.e. the staircase/tau-dependent wall error dominates over Ma^2.',
      'Recirculation length La (cylinder-2d1-la) is not in the probe contract and was not measured.',
      'Steadiness (1e-5 per 10 s), mass-stationarity (1e-6) and flux-balance (1%) bounds are reviewer-set; no source specifies them.'
    ],
    reviewer: 'reviewer-lbm-d2q9-cyl-2d1-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'flagged',
      reason: 'Default protocol (res 20, Ulat 0.1) passes all three suggested tolerances (cD +2.11%, cL +0.00096, dp +1.64%; none inside the 1996 intervals), steady, mass-flux balanced, Ma 0.24. ' +
        'Flagged: at res 10 (in the method range; tau 0.6/0.55, Ma 0.24/0.12 satisfy its stated criterion) the solution leaves the steady state at t ~ 40-50 s via an instability that starts at the Zou-He outlet column (outlet wall-row u 0.19 m/s at onset) and blows up (Ma 1.34 at 150 s; NaN at 139 s).' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
