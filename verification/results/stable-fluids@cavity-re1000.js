/* Verification record: stable-fluids @ cavity-re1000. Reviewer: reviewer-stable-fluids-cavity-re1000-r1 (not the builder).
 * Numbers from verification/checks/stable-fluids@cavity-re1000.check.js; report in
 * verification/reports/stable-fluids@cavity-re1000.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'stable-fluids@cavity-re1000',
    method: 'stable-fluids', scene: 'cavity', experiment: 'cavity-re1000',
    status: 'flagged',
    claim: 'Stable Fluids at its defaults (Stam settings: N = 64, dt = h, 20 diffusion and 20 pressure Gauss-Seidel sweeps) does NOT reproduce the Re = 1000 cavity: ' +
      'the steady u-centreline is off by up to 0.208 U vs Ghia and 0.220 U vs Erturk, the v-centreline by 0.226 U (tol 0.03), and psi_min = -0.0615 is 48% weaker than Ghia\'s -0.1179 (tol 3%); ' +
      'the net volume flux through grid lines reaches 15% of |psi_min|. The vortex centre (0.529, 0.574) is within 0.012 of Ghia, the only passing gap. ' +
      'With Stam settings the error grows with N (N = 128: u 0.243, v 0.220, psi 57%). With the projection converged (diagnostic) the dominant error is semi-Lagrangian/first-order numerical dissipation: ' +
      'psi_min 42% low at N = 32 and 26% low at N = 64 (pIters 2000), u/v gaps 0.17-0.32 U; halving dt makes it worse (43.5% at N = 32). The flow is a heavily over-damped Re = 1000 cavity. Stable at all settings.',
    conditions: {
      Re: 1000, N: 64, cfl: 1, dt: 0.015625, iters: 20, pIters: 20, steps: 4000, t_end: 62.5,
      convergence: 'residual (max |du|,|dv| per unit time) < 1e-6 (9.3e-7); u_vcl changed 1.7e-5 and psi_min 6.3e-5 (rel) over the last 7.4 time units',
      other_runs: 'Stam settings N = 128 (t = 56.6, residual 9.7e-7); diagnostic converged projection N = 32 pIters 1000 at cfl 1 and 0.5 (continued 3 time units at pIters 8000: psi_min moved 5e-5 rel); N = 64 pIters 2000 to t = 50 (residual 2.3e-5, psi_min drift 4.6e-5 rel over 4.7 time units)',
      comparison: 'Ghia coordinates snapped to j/128, Erturk coordinates used as given; sim centreline profile linearly interpolated; tolerances from the references, unchanged',
      check: 'verification/checks/stable-fluids@cavity-re1000.check.js (5 cases, ~6 min on 4 cores)'
    },
    reference: ['cavity-re1000-ghia-u', 'cavity-re1000-ghia-v', 'cavity-re1000-erturk-u', 'cavity-re1000-ghia-psimin', 'cavity-re1000-erturk-psimin', 'cavity-re1000-ghia-center'],
    gaps: [
      { quantity: 'max |u - u_Ghia| on x = 0.5, method defaults N = 64 (17 rows; worst at y = 0.8516: sim 0.1247 vs 0.3330)', value: 0.20836, tolerance: 0.03, unit: 'U_lid', pass: false },
      { quantity: 'max |v - v_Ghia| on y = 0.5, method defaults N = 64 (17 rows; worst at x = 0.9063: sim -0.2894 vs -0.5155)', value: 0.22614, tolerance: 0.03, unit: 'U_lid', pass: false },
      { quantity: 'max |u - u_Erturk| on x = 0.5, method defaults N = 64 (23 rows; worst at y = 0.90: sim 0.1634 vs 0.3838)', value: 0.22038, tolerance: 0.03, unit: 'U_lid', pass: false },
      { quantity: 'psi_min relative error vs Ghia -0.117929, method defaults N = 64 (sim -0.061514; vs Erturk -0.118781: 48.2%)', value: 0.47838, tolerance: 0.03, unit: 'rel', pass: false },
      { quantity: 'primary-vortex centre max(|dx|,|dy|) vs Ghia (0.5313, 0.5625), method defaults N = 64 (sim (0.5286, 0.5743))', value: 0.01181, tolerance: 0.02, unit: 'L', pass: true },
      { quantity: 'max |net volume flux through a grid line| / |psi_min|, method defaults N = 64 (closed cavity: exact 0; reviewer tol 1%)', value: 0.15057, tolerance: 0.01, unit: 'rel', pass: false },
      { quantity: 'Stam settings N = 128: max |u - u_Ghia| (0.243), |v - v_Ghia| 0.220, Erturk u 0.256, psi_min 56.8% low, centre 0.032; value = u gap', value: 0.24285, tolerance: 0.03, unit: 'U_lid', pass: false },
      { quantity: 'diagnostic, projection converged-ish, N = 64 pIters 2000: psi_min relative error vs Ghia (sim -0.08775; u 0.173, v 0.160, centre 0.035)', value: 0.25589, tolerance: 0.03, unit: 'rel', pass: false }
    ],
    checks: [
      { name: 'quantitative vs Ghia/Erturk (u, v tables, psi_min, centre) at method defaults', status: 'fail',
        detail: 'N = 64, pIters = 20: u 0.208 (Ghia), 0.220 (Erturk), v 0.226 (tol 0.03), psi_min 47.8% low (tol 3%); centre passes (0.012 <= 0.02). Centreline extrema are about half of the reference: u_min -0.181 vs -0.383 (y = 0.1719), v_max 0.174 vs 0.371, v_min -0.292 vs -0.516. Near-lid u (y >= 0.97) within 0.08-0.11 because the ghost-cell lid condition imposes the wall value.' },
      { name: 'mass conservation (incompressibility)', status: 'fail',
        detail: 'N = 64, pIters = 20: max net flux through a grid line 15.1% of |psi_min| (closed box, exact 0; reviewer tol 1%); divergence after the final projection max 10.9 (top-right lid corner cell), rms 0.240, max away from walls (>= 2 cells) 1.84; the projection reduces max divergence only by 2.47x. N = 128 Stam: flux 28%, max div 22.3. With converged projection still 9.8% (N = 32, cfl 1), 6.0% (N = 32, cfl 0.5), 3.4% (N = 64, pIters 2000): the collocated projection (5-point Laplacian vs central 2h div/grad) is approximate. Momentum is not an invariant of the driven cavity; KE stationary (rel change 5.7e-5 over 7.4 time units).' },
      { name: 'steady state reached', status: 'pass',
        detail: 'Primary residual 9.3e-7 < 1e-6 at t = 62.5 (4000 steps); u_vcl change 1.7e-5 (< 1% of 0.03) and psi_min 6.3e-5 rel (< 1% of 3%) over 7.4 time units. N = 128 and both N = 32 runs also reach 1e-6; N = 64 pIters 2000 stopped at t = 50 (residual 2.3e-5, psi_min drift 4.6e-5 rel over 4.7 units: quasi-steady, diagnostic only).' },
      { name: 'stability', status: 'pass',
        detail: 'No NaN/blow-up in any of the 5 runs; max|u| = 0.885 (N = 64), 0.942 (N = 128) <= 1 (semi-Lagrangian max principle), CFL = max|u| dt/h <= 0.94; diffusion number 0.064 (N = 64) handled implicitly. Unconditional stability as claimed.' },
      { name: 'error attribution (diagnostic, information)', status: 'pass',
        detail: 'Unconverged projection: at N = 64, raising pIters 20 -> 2000 changes psi_min from -0.0615 to -0.0878 (error 48% -> 26%) and u gap 0.208 -> 0.173. Projection convergence verified at N = 32: continuing the pIters 1000 steady state for 3 time units at pIters 8000 moves psi_min by 5e-5 rel and u_vcl by 1.6e-5. ' +
          'Numerical dissipation: with converged projection psi_min error is 42.0% (N = 32) and 25.6% (N = 64), observed order ~0.7; a crude extrapolation puts the 3% psi tolerance near N ~ 1000 (not measured). Halving dt at N = 32 makes it worse (42.0% -> 43.5%), consistent with semi-Lagrangian interpolation diffusion ~ h^2/dt. ' +
          'With Stam settings refinement makes it worse (psi 47.8% at N = 64 -> 56.8% at N = 128) because 20 sweeps converge the Poisson solve less on finer grids (same finding as stable-fluids@cavity-re100).' }
    ],
    missing: [
      'ghia1982 is registered verified:false: original paper paywalled and not read. u/v tables come from open, mutually identical transcriptions (copy-ivanpi-ghia, copy-sujaldave-ghia, copy-xuaoxiqi-ghia; verified:true copies); one copy differs at v(x = 0.9063) by 5e-4, immaterial here (gap 0.226). psi_min -0.117929 confirmed only to 4 digits via search snippets.',
      'erturk2005 (open arXiv) is verified:false: Re = 1000 u table from a single open copy (copy-lethe-cavity) with 3 entries confirmed by snippet; psi_min -0.118781 from a snippet. Conclusions do not depend on the 4th digit of any reference (all failing gaps exceed tolerance by >= 5x).',
      'stam1999 (search snippet) and stam2003 (code via JS port) are verified:false; neither reports a quantitative benchmark, so there is no source-side accuracy claim to check. The cavity no-slip/lid ghost-cell BC is a builder modification of Stam\'s free-slip set_bnd.',
      'A fully converged projection at N = 64 (pIters 2000 is ~4x the count verified converged at N = 32, but an exploratory 1000 -> 4000 switch still drifted psi_min by ~0.5% over 5 time units) and any converged run at N >= 128 did not fit the ~10 min budget; the N = 64 diagnostic psi_min may be ~1% too weak. This does not affect the classification.',
      'Mass-flux criterion (|net line flux| <= 1% of |psi_min|) and steadiness criterion (1% of each tolerance) are reviewer-set; no source specifies them.'
    ],
    reviewer: 'reviewer-stable-fluids-cavity-re1000-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'flagged',
      reason: 'Method defaults (N=64, pIters=20, dt=h): u gap 0.208 (Ghia) / 0.220 (Erturk), v gap 0.226 (tol 0.03), psi_min 48% low (tol 3%), line flux 15% of |psi_min|; centre within 0.012 (pass); stable and steady. N=128 Stam is worse (u 0.243, psi 57%). Converged projection only partly helps (psi 42% at N=32, 26% at N=64): first-order semi-Lagrangian dissipation dominates at Re=1000.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
