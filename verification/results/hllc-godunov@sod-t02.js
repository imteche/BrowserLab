/* Verification record: hllc-godunov @ sod-t02. Reviewer: reviewer-hllc-godunov-sod-t02-r1 (not the builder).
 * Numbers from verification/checks/hllc-godunov@sod-t02.check.js; report in
 * verification/reports/hllc-godunov@sod-t02.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'hllc-godunov@sod-t02',
    method: 'hllc-godunov', scene: 'sod', experiment: 'sod-t02',
    status: 'flagged',
    claim: 'First-order Godunov/HLLC on Sod at t = 0.2 is within the (engineering) L1 density bands at N = 100/200/400 ' +
      '(1.475e-2 / 9.366e-3 / 5.970e-3 vs 0.021 / 0.013 / 0.0085), converges at observed L1 orders 0.65-0.67 (rho), 0.74-0.96 (u), 0.74-0.84 (p) up to N = 6400, ' +
      'conserves mass/momentum/energy to ~3e-15, stays positive, holds star plateaus to <0.4% and the shock/contact/rarefaction head within 0.01 at N = 200, ' +
      'and resolves the contact in about half the cells of Lax-Friedrichs. It is flagged because the rarefaction-tail kink sits 0.017 from the exact position at N = 200 ' +
      '(tolerance 0.01; robust across locators 0.0166-0.0216), an inherent first-order smearing (fan slope 3.82 vs exact 4.17) that converges at ~order 0.85 (0.0094 at N = 400, 0.0052 at N = 800).',
    conditions: {
      t: 0.2, gamma: 1.4, x0: 0.5, data: '(1,0,1)|(0.125,0,0.1)', CFL: 0.9, speeds: 'Davis (default); Einfeldt as info',
      N: [100, 200, 400, 800, 1600, 3200, 6400], boundary: 'transmissive', landing: 'last step clipped onto t = 0.2 (all runs land exactly)',
      L1: 'sum |q_cell - q_exact(x_centre)| dx', plateau_read: 'cell nearest middle of exact plateau, N = 400',
      wave_locators: 'shock: p crossing (p*+pR)/2; contact: rho crossing (rho*L+rho*R)/2; rarefaction head/tail: LSQ line through u in fan interior intersected with u=0 / u=u*',
      check: 'verification/checks/hllc-godunov@sod-t02.check.js (runtime ~4 s)'
    },
    reference: ['sod-exact-profile', 'sod-totals', 'sod-pstar', 'sod-ustar', 'sod-rhostarL', 'sod-rhostarR',
      'sod-x-shock', 'sod-x-contact', 'sod-x-rarefaction-head', 'sod-x-rarefaction-tail', 'sod-exact-profile-laxfriedrichs-band', 'sod-modified-exact-profile'],
    gaps: [
      { quantity: 'L1(rho) N=100', value: 1.4751e-2, tolerance: 0.021, unit: 'L1 (engineering band)', pass: true },
      { quantity: 'L1(rho) N=200', value: 9.3656e-3, tolerance: 0.013, unit: 'L1 (engineering band)', pass: true },
      { quantity: 'L1(rho) N=400', value: 5.9696e-3, tolerance: 0.0085, unit: 'L1 (engineering band)', pass: true },
      { quantity: 'min observed L1(rho) order N=100..6400 (reviewer: within [0.5, 1.05])', value: 0.650, tolerance: 0.5, unit: 'order (lower bound)', pass: true },
      { quantity: 'mass drift, max over all runs (vs 0.5625)', value: 2.8e-15, tolerance: 1e-12, unit: 'rel', pass: true },
      { quantity: 'momentum vs 0.9 t = 0.18, max over all runs', value: 1.5e-15, tolerance: 1e-12, unit: 'rel', pass: true },
      { quantity: 'energy drift, max over all runs (vs derived 1.375; reference states 2.75 in error)', value: 2.6e-15, tolerance: 1e-12, unit: 'rel', pass: true },
      { quantity: 'rho*_L plateau N=400', value: 3.6e-3, tolerance: 0.02, unit: 'rel', pass: true },
      { quantity: 'rho*_R plateau N=400', value: 1.1e-5, tolerance: 0.02, unit: 'rel', pass: true },
      { quantity: 'p* plateau N=400 (worse of two reads)', value: 1.2e-4, tolerance: 0.02, unit: 'rel', pass: true },
      { quantity: 'u* plateau N=400 (worse of two reads)', value: 1.3e-4, tolerance: 0.02, unit: 'rel', pass: true },
      { quantity: 'shock position N=200', value: 2.4e-4, tolerance: 0.01, unit: 'abs x', pass: true },
      { quantity: 'contact position N=200', value: 3.3e-3, tolerance: 0.01, unit: 'abs x', pass: true },
      { quantity: 'rarefaction head position N=200', value: 4.2e-3, tolerance: 0.01, unit: 'abs x', pass: true },
      { quantity: 'rarefaction tail position N=200', value: 1.71e-2, tolerance: 0.01, unit: 'abs x', pass: false }
    ],
    checks: [
      { name: 'mass/momentum/energy conservation', status: 'pass',
        detail: 'all 14 runs (N=100..6400, Davis and Einfeldt): rel drift <= 2.8e-15 (mass), 1.5e-15 (momentum vs 0.9t), 2.6e-15 (energy). ' +
          'sod-totals gives energy 2.75, which is an arithmetic error (0.5*2.5 + 0.5*0.25 = 1.375); the method gives 1.375 and the raw comparison would read 0.5 rel.' },
      { name: 'stability / positivity / CFL', status: 'pass',
        detail: 'no NaN or divergence; min rho = 0.125, min p = 0.1 over all steps (no undershoot); realized CFL = 0.9000 (bound C <= 1); all runs land on t = 0.2 exactly. ' +
          'Info: C = 1.0 at N = 400 also stable and positive (L1 rho 5.69e-3).' },
      { name: 'quantitative: L1 and convergence', status: 'pass',
        detail: 'L1 rho 1.475e-2, 9.366e-3, 5.970e-3, 3.779e-3, 2.373e-3, 1.511e-3, 9.576e-4 for N = 100..6400; orders rho 0.650-0.671, u 0.737-0.959, p 0.736-0.840. ' +
          'Equals researcher scratch Godunov-HLLC calibration (1.475e-2/9.366e-3/5.970e-3) to 4 digits. Bands are unpublished engineering bands (~1.4x scratch). Einfeldt speeds: within 0.4% of Davis.' },
      { name: 'quantitative: star plateaus (N=400, 2%)', status: 'pass', detail: 'rho*L 0.42479 (-0.36%), rho*R 0.265567, p* 0.303119 / 0.303165, u* 0.927563 / 0.927575' },
      { name: 'quantitative: wave positions (N=200, 0.01)', status: 'fail',
        detail: 'shock 0.85067 (err 2.4e-4), contact 0.68218 (3.3e-3), rarefaction head 0.25919 (4.2e-3), rarefaction tail 0.50302 (1.71e-2 > 0.01). ' +
          'Tail error robust to locator: LSQ windows 0.0166-0.0176, max curvature 0.0216; it converges (0.0093-0.0101 at N=400, 0.0051-0.0056 at N=800). Fitted fan slope 3.82 vs exact 4.17 at N=200.' },
      { name: 'contact resolution vs Lax-Friedrichs', status: 'pass',
        detail: 'cells in 10-90% of the contact density jump: HLLC 14/18/36 vs LF 26/38/72 at N=200/400/1600; shock 2 cells vs 4-6. L1 rho HLLC/LF = 0.46/0.44/0.42. ' +
          'Isolated stationary contact (p, u equal) preserved exactly (max error 0) - HLLC contact-restoring property.' },
      { name: 'info: modified Sod (sonic rarefaction)', status: 'pass',
        detail: 'L1 rho 1.354e-2 (N=100, band 0.019), 5.778e-3 (N=400, band 0.0081); no entropy-violating jump in the fan (max adjacent jump 0.011 at N=400). Different experiment; recorded as info only.' }
    ],
    missing: [
      'L1 bands in sod-exact-profile are BrowserLab engineering bands (~1.4x researcher scratch errors), not published values (research/hyp.md Sec. 4: no open L1 tables found). The L1 pass shows agreement with the researcher\'s own scratch Godunov-HLLC, not with literature numbers.',
      'No tolerance exists for L1 in u and p (the experiment quantity names them); they are reported with orders only.',
      'toro2009, toro1994hllc, einfeldt1988 and sod1978 are verified:false (secondary copies; originals not read). The exact solver and star values rest on the open zingale-cha notes and the open sodshock2015 code (verified:true), so the reference values themselves are open.',
      'Wave-position tolerance (0.01 = 2 cells at N=200) and plateau band (2%) are engineering choices; the wave tolerance is phrased for jumps ("steepest gradient / midpoint of jump") and no locator is prescribed for rarefaction kinks. The reviewer used LSQ extrapolation and checked robustness; all locators exceed 0.01 for the tail at N=200.',
      'REFERENCE DEFECT: sod-totals states energy(t) = 2.75; the correct value from the stated derivation is 1.375. Reviewer tested against 1.375. references/sod.js should be fixed by the researcher.',
      'Convergence-order window [0.5, 1.05] is a reviewer criterion (textbook contact-limited rates for first-order schemes are recollection, not cited).'
    ],
    reviewer: 'reviewer-hllc-godunov-sod-t02-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'flagged',
      reason: 'Rarefaction-tail position error 0.0171 at N=200 exceeds the 0.01 tolerance (inherent first-order kink smearing; converges with N). All else passes: L1 rho within engineering bands, orders ~0.65, conservation ~3e-15, positivity, plateaus <0.4%, contact ~2x sharper than LF. Also found reference error: sod-totals energy 2.75 should be 1.375.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
