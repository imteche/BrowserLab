/* Verification record: pbf @ dam-front. Reviewer: reviewer-pbf-dam-front-r1 (not the builder).
 * Numbers from verification/checks/pbf@dam-front.check.js; report in verification/reports/pbf@dam-front.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'pbf@dam-front',
    method: 'pbf', scene: 'dam-break', experiment: 'dam-front',
    status: 'matched',
    claim: 'PBF (default solver settings, 4 Jacobi iterations) reproduces the Martin & Moyce (1952) surge-front history Z(T) for the ' +
      'a = 2.25 in, n^2 = 2 column over 0 < T <= 3 within the reference tolerance 0.25 after one time shift dT in [0, 0.25]: ' +
      'max |Z - Z_ref| = 0.073 (dT = 0.20) at nx = 80 and 0.072 (dT = 0.19) at nx = 40 against the Lethe copy; never exceeds the Ritter ' +
      'bound Z <= 1 + 2T; mass exact, energy non-increasing, stable. Without the shift the error is 0.34 (nx = 80), as the reference anticipates.',
    conditions: {
      a: 0.05715, g: 9.81, rho0: 1000, nx: '20 / 40 / 80 particles across a (800 / 3200 / 12800 particles); primary nx = 80',
      tank: '5a x 4a (default); extended 12a x 4a at nx = 40 for the a = 2.25 in digitised series',
      hdx: 2, cfl: 0.3, dt: '4.05e-4 / 2.02e-4 / 1.01e-4 s', iters: '4 (default); sensitivity 1, 2, 8, 16 at nx = 40',
      eps: 0.01, k: 0.001, dq: 0.3, n: 4, c: 0.01, unilateral: 1, vort: 0,
      T_end: '3.05 (default tank), 9.4 (extended tank)',
      metric: 'max |Z_sim(T - dT) - Z_ref(T)| over reference points 0 < T <= 3, single dT in [0, 0.25] (step 0.005)',
      check: 'verification/checks/pbf@dam-front.check.js (about 6-7 min)'
    },
    reference: ['dam-break-mm-front-lethe', 'dam-break-mm-front-a225', 'dam-break-ritter-front-bound'],
    gaps: [
      { quantity: 'max |Z - Z_ref| vs Lethe copy, 0 < T <= 3, best shift dT = 0.20, nx = 80', value: 0.0726, tolerance: 0.25, unit: 'Z = x/a', pass: true },
      { quantity: 'max |Z - Z_ref| vs Lethe copy, 0 < T <= 3, best shift dT = 0.19, nx = 40', value: 0.0722, tolerance: 0.25, unit: 'Z = x/a', pass: true },
      { quantity: 'max |Z - Z_ref| vs Lethe copy, 0 < T <= 3, best shift dT = 0.13, nx = 20', value: 0.0604, tolerance: 0.25, unit: 'Z = x/a', pass: true },
      { quantity: 'max |Z - Z_ref| vs PySPH a = 2.25 in series, 0 < T <= 3, best shift dT = 0.24, nx = 40 (tank 12a)', value: 0.0181, tolerance: 0.25, unit: 'Z = x/a', pass: true },
      { quantity: 'max over all steps of Z - (1 + 2T) (Ritter bound; must be <= 0), all runs', value: -0.0037, tolerance: 0, unit: 'Z = x/a', pass: true }
    ],
    checks: [
      { name: 'mass conservation', status: 'pass', detail: 'equal fixed particle masses; relative mass drift 0 in every run' },
      { name: 'energy (dissipative scheme: must not increase)', status: 'pass',
        detail: 'default iters = 4: max (E - E0)/E0 = -1.3e-5 / -3.2e-6 / +1.3e-6 at nx = 20/40/80 (reviewer criterion <= 1e-3); E(T=3)/E0 - 1 = -4.5% / -3.0% / -2.0%. ' +
          'Info: with iters = 16 an early transient (T ~ 0.36) raises E by +3.0e-3 E0 (iters = 1: +8.5e-4, iters = 8: +3.6e-4), coinciding with the column expanding (mean rho/rho0 - 1 = -5.4%).' },
      { name: 'momentum', status: 'n/a', detail: 'not conserved by the physics (walls, gravity)' },
      { name: 'stability', status: 'pass',
        detail: 'no NaN/divergence in any run (up to T = 9.4). max |v| dt/dx = 0.233-0.236 (default tank), 0.316 (extended tank, front at wall); stated criterion |v| dt < h/2 = 1.0 dx' },
      { name: 'density-constraint error', status: 'pass',
        detail: 'time average over 0 < T <= 3 (iters = 4): mean (rho/rho0 - 1) = -2.6% / -2.0% / -1.8% at nx = 20/40/80 (includes free-surface kernel deficit); mean compression <max(C,0)> = 5.3e-4 / 5.5e-4 / 5.6e-4; max C <= 1.15%. ' +
          'Iterations at nx = 40: mean C = -2.05% / -1.31% / -2.02% / -3.29% / -5.45% and mean compression 1.6e-3 / 1.1e-3 / 5.5e-4 / 2.6e-4 / 1.1e-4 for iters 1/2/4/8/16. No reference criterion; reported as requested.' },
      { name: 'iteration sensitivity of Z(T)', status: 'pass',
        detail: 'nx = 40: Z(T=3) = 4.006 / 4.009 / 4.001 / 4.002 / 3.986 and best-shift error 0.073 / 0.078 / 0.072 / 0.071 / 0.071 for iters 1/2/4/8/16: front history insensitive to iteration count' },
      { name: 'resolution sensitivity', status: 'pass',
        detail: 'Z(T=3) = 3.938 / 4.001 / 4.050 at nx = 20/40/80 (not converged; increments 0.063, 0.048). Best-shift error stable at 0.06-0.07; unshifted error grows 0.226 / 0.285 / 0.343 as the front speeds up with resolution' },
      { name: 'late-time front, T > 3 (outside the suggested window; information only)', status: 'n/a',
        detail: 'extended tank 12a, nx = 40, vs PySPH a = 2.25 in series to T = 6.82: max |dZ| = 0.313 at dT = 0.25 (bound of allowed shift; unshifted 0.78). Exceedances at T = 4.03 (0.313; the datum implies a local slope 2.44 > Ritter 2 to the next point, likely digitisation scatter) and T = 6.31 (0.311). ' +
          'Fitted slope dZ/dT over T 5.1-6.85: 1.84 (sim) vs 1.79 (data). Not scored because the reference\'s suggested check is 0 < T <= 3 and the run needs a non-default tank.' }
    ],
    missing: [
      'martin1952 is verified:false: the original paper is paywalled and was not read. Reference values come from two open copies (Lethe dam-break-2d.py, PySPH db_exp_data.py; both verified:true) that agree to |dZ| <= 0.08; the original table/figure was not checked.',
      'ritter1892-pysph is verified:false for bibliographic details; the bound 2 sqrt(g H0) itself was confirmed in the PySPH SWE code.',
      'macklin2013 (method source) is verified:false (snippets only); the method\'s equations were cross-checked by the builder against open code, not reviewed here.',
      'Research gap: no published quantitative PBF dam-break validation exists (research/ptc.md), so there is no PBF-specific protocol or published PBF Z(T) to compare against; the check is against experiment only.',
      'The time shift dT (0.19-0.20 here, cf. Lethe +0.175) is an allowance for gate-opening delay that the reference permits but no source quantifies; without it the gap is 0.34 (> 0.25).',
      'Front position is not resolution-converged (Z(3) still rises by ~0.05 per doubling); a finer run (nx = 160) did not fit the 10-minute budget.',
      'No reference for the residual column height H/2a(T) (no open copy of Martin & Moyce); not checked.',
      'The 1e-3 E0 energy-gain criterion and the T > 3 treatment are reviewer choices; no source gives an energy bound for PBF.'
    ],
    reviewer: 'reviewer-pbf-dam-front-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'matched',
      reason: 'Lethe Z(T) within 0.073 of 0.25 (dT = 0.20, nx = 80; 0.072 at nx = 40); a225 copy within 0.018 for T <= 3; Ritter bound respected; mass exact, energy non-increasing at default settings; stable. ' +
        'Unshifted gap 0.34 and T > 3 late-time gap 0.31 (info) recorded; source caveats in missing.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
