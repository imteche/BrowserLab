/* Verification record: stable-fluids @ cavity-re100. Reviewer: reviewer-stable-fluids-cavity-re100-r1 (not the builder).
 * Numbers from verification/checks/stable-fluids@cavity-re100.check.js; report in
 * verification/reports/stable-fluids@cavity-re100.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'stable-fluids@cavity-re100',
    method: 'stable-fluids', scene: 'cavity', experiment: 'cavity-re100',
    status: 'flagged',
    claim: 'Stable Fluids with Stam\'s solver settings (20 Gauss-Seidel pressure sweeps, dt = h) does NOT reproduce Ghia et al. (1982) at Re = 100: ' +
      'on a 128^2 grid the steady u-centreline is off by up to 0.116 U and the v-centreline by 0.109 U (tol 0.02), psi_min = -0.0473 is 54% weaker than -0.1034 (tol 3%), ' +
      'and the net volume flux through grid lines reaches 128% of |psi_min| (the 20-sweep projection removes only ~57% of the divergence). ' +
      'The error grows with N (N = 64: u 0.077, psi 35%) because 20 sweeps converge the Poisson solve less on finer grids. ' +
      'Diagnostic runs with the projection driven toward convergence (1000 sweeps at N = 64) bring the centrelines inside 0.02 U (u 0.0094, v 0.0061), leaving a first-order psi_min error (3.0% at N = 64) and a 2-5% residual mass leak from the collocated approximate projection.',
    conditions: {
      Re: 100, N: 128, cfl: 1, dt: 0.0078125, iters: 20, pIters: 20, steps: 3425, t_end: 26.76,
      convergence: 'residual (max |du|,|dv| per unit time) < 1e-8; u_vcl changed 7.6e-7 and psi_min 2.4e-6 (rel) over the last 6.6 time units',
      diagnostics: 'same scheme with pIters = 2000 (N = 32, cfl 1 and 0.5), 1000 (N = 64), 300 (N = 128, largest feasible in budget); method default N = 64 with pIters = 20',
      check: 'verification/checks/stable-fluids@cavity-re100.check.js'
    },
    reference: ['cavity-re100-ghia-u', 'cavity-re100-ghia-v', 'cavity-re100-ghia-psimin', 'cavity-re100-ghia-center'],
    gaps: [
      { quantity: 'max |u - u_Ghia| on x = 0.5, N = 128, pIters = 20 (17 rows; worst at y = 0.4531: sim -0.0948 vs -0.2109)', value: 0.11615, tolerance: 0.02, unit: 'U_lid', pass: false },
      { quantity: 'max |v - v_Ghia| on y = 0.5, N = 128, pIters = 20 (17 rows; worst at x = 0.8047: sim -0.1360 vs -0.2453)', value: 0.10932, tolerance: 0.02, unit: 'U_lid', pass: false },
      { quantity: 'psi_min relative error vs -0.103423, N = 128, pIters = 20 (sim -0.047250)', value: 0.54314, tolerance: 0.03, unit: 'rel', pass: false },
      { quantity: 'primary-vortex centre max(|dx|,|dy|) vs (0.6172, 0.7344), N = 128, pIters = 20 (sim (0.6182, 0.7077))', value: 0.02667, tolerance: 0.02, unit: 'L', pass: false },
      { quantity: 'max |net volume flux through a grid line| / |psi_min|, N = 128, pIters = 20 (closed cavity: exact value 0; reviewer tol 1%)', value: 1.2845, tolerance: 0.01, unit: 'rel', pass: false }
    ],
    checks: [
      { name: 'mass conservation (incompressibility)', status: 'fail',
        detail: 'N = 128, pIters = 20: max net flux through a vertical grid line 0.0607 (|psi_min| = 0.0473), i.e. 128% of the recirculating flux; central divergence after the final projection: max 21.7 (lid corner), rms 0.396, max away from walls (>= 2 cells) 4.76; the projection reduces max divergence only 50.5 -> 21.7 (factor 2.3). ' +
          'With a converged projection the leak is smaller but still fails the 1% criterion: 5.0% (N = 32, 2000 sweeps), 2.3% (N = 64, 1000 sweeps), 5.6% (N = 128, 300 sweeps); interior rms divergence 0.19-0.21 remains because Stam\'s collocated projection (5-point Laplacian, central 2h gradient/divergence) is approximate. Momentum is not an invariant of the driven cavity; KE is stationary (rel change 1.2e-6 over 6.6 time units).' },
      { name: 'steady state reached', status: 'pass',
        detail: 'all six runs reach their residual target (primary: 9.0e-9 at t = 26.76, 3425 steps); primary u_vcl change 7.6e-7 (<1% of 0.02) and psi_min 2.4e-6 rel (<1% of 3%) over the last 6.6 time units.' },
      { name: 'stability', status: 'pass',
        detail: 'no NaN/blow-up in any run; max|u| = 0.975 <= 1 (semi-Lagrangian max principle holds), CFL = max|u| dt/h = 0.975 (<= 1, method accuracy note), diffusion number 1.28 handled implicitly. Unconditional stability as claimed.' },
      { name: 'quantitative vs Ghia (u, v tables; psi_min; centre) with Stam settings', status: 'fail',
        detail: 'N = 128, pIters = 20: u 0.116, v 0.109 (tol 0.02), psi_min 54% (tol 3%), centre 0.027 (tol 0.02). N = 64 (method default), pIters = 20: u 0.077, v 0.063, psi_min 35%, centre 0.010. The interior flow is too weak by a factor ~2 at N = 128.' },
      { name: 'error attribution (diagnostic, information)', status: 'pass',
        detail: 'Raising only pIters at N = 128 from 20 to 300 cuts the gaps to u 0.0122, v 0.0076, centre 0.0041 (all within tol) and psi_min 5.8% (still above 3%; 300 sweeps not converged at N = 128). Converged projection: N = 32 psi 6.2%, u 0.020, v 0.021; N = 64 psi 3.05%, u 0.0094, v 0.0061, centre 0.0083 -> observed order ~1.0 (psi and u), consistent with first-order semi-Lagrangian advection/splitting. cfl 0.5 vs 1 at N = 32 changes psi_min by 0.2% only, so time-step dissipation is minor at CFL <= 1; the dominant error with Stam settings is the unconverged 20-sweep pressure solve.' }
    ],
    missing: [
      'ghia1982 is registered verified:false: original paper paywalled and not read. u/v tables come from open, mutually identical transcriptions (copy-ivanpi-ghia, copy-sujaldave-ghia, copy-cfdgasman-ghia; verified:true copies); table numbers (I, II) not checked against the original.',
      'psi_min = -0.103423 is quoted from a single copy (copy-cfdgasman-ghia README) plus a search snippet; vortex-centre value from a single copy (copy-sujaldave-ghia). Table numbers III/V unverified.',
      'stam1999 (search-snippet) and stam2003 (code read via a JS port, paper PDF unreachable) are verified:false; the 20-sweep default and dt choice are taken from the ported solver03.c, not the paper text. Neither Stam source reports a quantitative benchmark, so there is no source-side accuracy claim to check against.',
      'The cavity no-slip/lid ghost-cell boundary condition is a builder modification (Stam\'s set_bnd is free-slip); results apply to this modified scheme.',
      'N = 128 with a fully converged pressure solve (O(N^2) Gauss-Seidel sweeps) did not fit the ~10 min budget; the largest feasible was 300 sweeps. Whether a converged N = 128 run passes psi_min (first-order extrapolation from 6.2%/3.05% suggests ~1.5%) is not established.',
      'Mass-flux criterion (|net line flux| <= 1% of |psi_min|) and steadiness criterion (1% of each tolerance) are reviewer-set; no source specifies them.'
    ],
    reviewer: 'reviewer-stable-fluids-cavity-re100-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'flagged',
      reason: 'Stam settings (pIters=20, dt=h) at N=128: u gap 0.116, v gap 0.109 (tol 0.02), psi_min 54% low (tol 3%), centre 0.027 (tol 0.02), net line flux 128% of |psi_min|; stable and steady. Dominant cause: unconverged 20-sweep projection (300 sweeps: u 0.012, v 0.008, psi 5.8%); with converged projection the scheme is first-order (psi 3.05% at N=64) and still leaks 2-5% mass (approximate collocated projection).' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
