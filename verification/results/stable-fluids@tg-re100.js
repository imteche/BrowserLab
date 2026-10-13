/* Verification record: stable-fluids @ tg-re100. Reviewer: reviewer-stable-fluids-tg-re100-r1 (not the builder).
 * Numbers from verification/checks/stable-fluids@tg-re100.check.js; report in verification/reports/stable-fluids@tg-re100.md. */
(function (LAB) {
  'use strict';
  LAB.registerVerification({
    id: 'stable-fluids@tg-re100',
    method: 'stable-fluids', scene: 'taylor-green', experiment: 'tg-re100',
    status: 'flagged',
    claim: 'Stable Fluids with Stam\'s settings (method defaults N = 64, dt = h (cfl 1), 20 diffusion and 20 pressure Gauss-Seidel sweeps) does NOT ' +
      'reproduce the analytic Taylor-Green decay at Re = 100 on [0, 5]: KE(5) is 44% below 0.25 exp(-4 nu t) (tol 1%) and the relative L2 velocity ' +
      'error is 0.27 (tol 0.02). The effective viscosity from the KE decay is nu_eff = 0.039, 3.9x the physical nu = 0.01. With Stam\'s fixed 20 ' +
      'pressure sweeps the error does not converge: it grows with N (KE gap 0.50 / 0.44 / 0.55 / 0.70, nu_eff 0.044 / 0.039 / 0.050 / 0.070 at ' +
      'N = 32 / 64 / 128 / 256), because the unconverged projection leaves O(0.1-0.4) rms divergence. With the projection driven close to convergence ' +
      '(diagnostic) the scheme converges at first order (nu excess 0.032 / 0.017 / 0.0088 / 0.0048, p = 0.88-0.95), but even at N = 256 the KE gap is ' +
      '9.1% and L2 0.047; extrapolation needs N of about 700 (L2) and 2400 (KE) to meet the tolerances. Halving dt does not help (semi-Lagrangian ' +
      'interpolation dissipation scales as h^2/dt). KE decays monotonically and all runs are stable (max principle holds, CFL <= 1).',
    conditions: {
      Re: 100, nu: 0.01, k: 1, U0: 1, box: '[0, 2 pi]^2 periodic', N: 64, cfl: 1, dt: 'h = 2 pi / 64 = 0.0982', iters: 20, pIters: 20,
      steps: '51 (t = 5.007), 510 (t = 50)', t_end: '5 (experiment horizon); 50 (= 1/(2 nu k^2), tolerance check point) secondary',
      refinement: 'Stam settings: N = 32/64/128/256 at cfl 1; cfl = 1/0.5/0.25 at N = 64. Diagnostic converged projection: N = 32/64/128/256 with pIters 300/500/1500/1200, plus N = 128 at cfl 0.5',
      metric: 'KE gap |KE(t)/E_ref(t) - 1| and probe l2_error sampled every 0.5 (max over [0, 5]); L2 cross-checked by reviewer from view(u/v) vs tgv-velocity fn (max diff 8.4e-10); nu_eff = -ln(KE/KE0)/(4t)',
      check: 'verification/checks/stable-fluids@tg-re100.check.js (about 4.8 min on 4 cores)'
    },
    reference: ['tgv-kinetic-energy', 'tgv-velocity'],
    gaps: [
      { quantity: 'KE gap vs tgv-kinetic-energy, max over t in [0, 5] (at t = 5), N = 64 Stam settings (default)', value: 0.4442, tolerance: 0.01, unit: 'relative', pass: false },
      { quantity: 'relative L2 velocity error vs tgv-velocity, max over t in [0, 5], N = 64 Stam settings (default)', value: 0.2688, tolerance: 0.02, unit: 'rel-l2', pass: false },
      { quantity: 'KE gap at t = 5, N = 256 Stam settings (finest; error grows with N)', value: 0.6979, tolerance: 0.01, unit: 'relative', pass: false },
      { quantity: 'relative L2 velocity error at t = 5, N = 256 Stam settings', value: 0.5157, tolerance: 0.02, unit: 'rel-l2', pass: false },
      { quantity: 'KE gap at t = 50 = 1/(2 nu k^2), N = 64 Stam settings', value: 0.8733, tolerance: 0.01, unit: 'relative', pass: false },
      { quantity: 'KE gap at t = 5, N = 256, projection near-converged (pIters 1200; diagnostic, best case)', value: 0.0914, tolerance: 0.01, unit: 'relative', pass: false },
      { quantity: 'relative L2 velocity error at t = 5, N = 256, projection near-converged (diagnostic, best case)', value: 0.0470, tolerance: 0.02, unit: 'rel-l2', pass: false },
      { quantity: 'numerical viscosity excess nu_eff - nu at t = 5, N = 64 Stam settings (informational; no reference tolerance)', value: 0.0293, tolerance: null, unit: 'nu (1/(k U0) units; nu = 0.01)', pass: false }
    ],
    checks: [
      { name: 'mass conservation (discrete divergence after projection)', status: 'fail', detail: 'rms div after the final projection up to 0.118 (max 0.373) at N = 64 with 20 pressure sweeps, 0.214 at N = 128, 0.358 (max 0.984) at N = 256, relative to the velocity-gradient scale 1; ' +
          'reviewer criterion rms < 1e-3. With near-converged projection: rms 9.5e-4 (N = 64), 1.6e-4 (N = 128).' },
      { name: 'momentum conservation (mean velocity, exact value 0)', status: 'fail', detail: '|<u>| + |<v>| grows to 1.4e-3 at t = 5 (N = 64, Stam settings), 2.8e-3 at t = 50; semi-Lagrangian advection is not conservative and the lexicographic GS breaks the TG symmetry. ' +
          'With near-converged projection <= 1.8e-8 (N <= 128). Reviewer criterion 1e-10; small in absolute terms (0.14% of U0).' },
      { name: 'energy (KE never increases; viscous decay)', status: 'pass', detail: 'KE decreased at every step in all 12 runs (0 increases); the problem is excess decay, not growth.' },
      { name: 'stability (NaN / blow-up, max principle, CFL)', status: 'pass', detail: 'no NaN or diverged() in any run incl. t = 50; max|u| never exceeds its initial value; CFL max|u| dt/h <= 0.9998 in protocol runs (method: unconditionally stable, accuracy needs CFL <= O(1)).' },
      { name: 'quantitative (KE decay, L2 velocity) at default N = 64', status: 'fail', detail: 'KE gap 0.444 (tol 0.01), L2 0.269 (tol 0.02); nu_eff 0.0393 = 3.9 nu. No run of the 12 (incl. converged projection at N = 256) passes either tolerance.' },
      { name: 'convergence under refinement (Stam settings)', status: 'fail', detail: 'nu excess 0.0337 / 0.0293 / 0.0396 / 0.0598 at N = 32/64/128/256 (observed order 0.20, -0.43, -0.60): non-convergent because 20 GS sweeps reduce the k = 2 pressure mode less and less as N grows. ' +
          'dt refinement at N = 64: nu_eff 0.0393 / 0.0345 / 0.0318 at cfl 1 / 0.5 / 0.25.' },
      { name: 'diagnostic: converged projection', status: 'fail', detail: 'nu excess 0.0322 / 0.0171 / 0.0088 / 0.0048 (p = 0.91, 0.95, 0.88) and L2 0.280 / 0.158 / 0.085 / 0.047 (p = 0.83, 0.89, 0.85) at N = 32/64/128/256: first-order convergence as expected for Euler backtrace + bilinear interpolation. ' +
          'N = 128 at cfl 0.5: nu_eff 0.0194 vs 0.0188 at cfl 1 (smaller dt slightly worse, interpolation dissipation ~ h^2/dt).' }
    ],
    missing: [
      'Analytic reference source taylor1937 is verified:false (original not read, openAccess false, site unreachable) and lehmann2022 (arXiv:2112.08926) was seen as a search snippet only (verified:false, equation number unverified). ' +
        'The formula was independently verified by substitution (research/ins.md), so the reference values are fixed by mathematics and this does not affect the verdict.',
      'Method sources stam1999 and stam2003 are verified:false: neither PDF was reachable; Stam\'s solver was read through an ISC JS port of solver03.c (npm stam-stable-fluids@1.0.3). Fidelity of the sweep counts and step order is therefore checked against the port, not the paper.',
      'Neither Stam source reports a quantitative Taylor-Green (or any) benchmark (research/ins.md), so no method-specific published error values exist; tolerances are those of the analytic references, and the tgv-velocity rationale itself anticipates that stable-fluids may fail.',
      'The tgv-kinetic-energy tolerance names t = 1/(2 nu k^2) = 50 as the check point; the experiment is defined on [0, 5]. t = 5 is primary, t = 50 run at N = 64 (Stam settings) only.',
      'A converged-projection run at N >= 512 (needed to approach the tolerances) does not fit the 10-minute budget with Gauss-Seidel; N = 256 with 1200 sweeps (k = 2 mode reduced to about 1%) is the largest run, and its divergence (rms 6e-3) is not fully converged.'
    ],
    reviewer: 'reviewer-stable-fluids-tg-re100-r1', round: 1, date: '2026-10-13',
    history: [ { round: 1, status: 'flagged',
      reason: 'Default (Stam settings, N = 64): KE gap 44% (tol 1%), L2 0.27 (tol 0.02), nu_eff = 3.9 nu; error grows with N because the fixed 20-sweep projection leaves rms divergence 0.12-0.36. ' +
        'Even with a converged projection the semi-Lagrangian scheme is first order (N = 256: KE gap 9.1%, L2 0.047). Inherent dissipation of the published scheme, not an implementation defect. Stable, KE monotone.' } ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
