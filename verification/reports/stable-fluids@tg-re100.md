# Review: stable-fluids @ tg-re100

Reviewer: reviewer-stable-fluids-tg-re100-r1, round 1, 2026-10-13. I did not write `methods/stable-fluids.js`, and I did not modify any method, reference or `js/` file.

- Check script: `node verification/checks/stable-fluids@tg-re100.check.js`. It runs 12 cases as parallel child processes, takes about 4.8 min on 4 cores, and prints JSON.
- Result: `verification/results/stable-fluids@tg-re100.js`, **status: flagged**.

## Protocol

**Scene.** `taylor-green`, experiment `tg-re100`:
- Re = 100, so ν = 0.01; k = U0 = 1.
- Periodic box [0, 2π]², run to t = 5.
- Initial field: the analytic field at cell centres. KE0 = 0.25 exactly.

**Primary run.** The method as shipped, with defaults equal to Stam's solver settings:
- N = 64, cfl = 1 (dt = h = 0.098, 51 steps).
- 20 Gauss–Seidel (GS) sweeps for diffusion and 20 for pressure.

**Sequences with Stam settings:**
- N = 32, 64, 128 and 256 at cfl 1.
- cfl = 1, 0.5 and 0.25 at N = 64.
- t = 50 at N = 64. This is the check point named by the tgv-kinetic-energy tolerance (t = 1/(2νk²)).

**Diagnostic (information only, not used to pass the method).** The same scheme, but with the pressure GS run close to convergence for the k = 2 pressure mode that the nonlinear term generates:
- pIters = 300, 500, 1500 and 1200 at N = 32, 64, 128 and 256.
- Also N = 128 at cfl 0.5.
- N = 256 with 1200 sweeps is the largest run that fits the budget. It reduces the k = 2 mode to about 1%.

**Metrics.** Each run is sampled every 0.5 time units and gated by the maximum over [0, 5]:
- KE gap = |KE/E_ref − 1|, with E_ref = 0.25·exp(−4νt). Tolerance 0.01.
- L2 = probe `l2_error`. Tolerance 0.02. I recomputed it independently from `view('u'/'v')` against the `tgv-velocity` function; the maximum difference was 8.4e−10.
- ν_eff = −ln(KE/KE0)/(4t), and the numerical-viscosity excess ν_eff − ν.

**Conservation:**
- Mass: discrete divergence after the final projection, from the method metrics `div` and `divrms`. My criterion: rms < 1e−3, against a velocity-gradient scale of 1.
- Momentum: the mean velocity should be exactly 0. My criterion: < 1e−10.
- Energy: KE must not increase from one step to the next.

**Stability:**
- No NaN and no `diverged()`.
- max|u| ≤ its initial value (the semi-Lagrangian maximum principle).
- CFL ≤ 1.

## Raw numbers

**Primary run** (N = 64, Stam settings):

| t | KE gap | L2 | ν_eff | rms div |
|---|---|---|---|---|
| 0.59 | 0.069 | 0.094 | 0.0403 | 0.117 |
| 1.57 | 0.192 | 0.132 | 0.0440 | 0.097 |
| 3.04 | 0.324 | 0.198 | 0.0422 | 0.075 |
| 5.01 | **0.444** | **0.269** | 0.0393 | 0.056 |

**Resolution and time-step sequences** (values at t = 5):

| run | KE gap | L2 | ν_eff | ν excess | max rms div | wall |
|---|---|---|---|---|---|---|
| Stam N = 32 | 0.497 | 0.292 | 0.0437 | 0.0337 | 0.053 | 0.1 s |
| **Stam N = 64 (default)** | **0.444** | **0.269** | **0.0393** | 0.0293 | 0.118 | 0.4 s |
| Stam N = 128 | 0.547 | 0.373 | 0.0496 | 0.0396 | 0.214 | 1.7 s |
| Stam N = 256 | 0.698 | 0.516 | 0.0698 | 0.0598 | 0.358 | 16 s |
| Stam N = 64, cfl 0.5 | 0.388 | 0.222 | 0.0345 | 0.0245 | 0.062 | |
| Stam N = 64, cfl 0.25 | 0.354 | 0.198 | 0.0318 | 0.0218 | 0.031 | |
| Stam N = 64, t = 50 | 0.873 | 0.646 | 0.0203 | 0.0103 | 0.118 | |
| conv. N = 32, p300 | 0.481 | 0.280 | 0.0422 | 0.0322 | 7.2e-3 | |
| conv. N = 64, p500 | 0.290 | 0.158 | 0.0271 | 0.0171 | 9.5e-4 | |
| conv. N = 128, p1500 | 0.162 | 0.085 | 0.0188 | 0.0088 | 1.6e-4 | 53 s |
| conv. N = 128, p1500, cfl 0.5 | 0.172 | 0.090 | 0.0194 | 0.0094 | 7.9e-5 | 84 s |
| conv. N = 256, p1200 | 0.091 | 0.047 | 0.0148 | 0.0048 | 6.2e-3 | 288 s |

**Observed order of the ν excess:**
- Stam settings: 0.20, −0.43, −0.60. The error grows with N, so the scheme does not converge.
- Converged projection: 0.91, 0.95, 0.88 (L2: 0.83, 0.89, 0.85). This is first order.

**Conservation and stability:**
- Mean momentum |⟨u⟩|+|⟨v⟩|:
  - Stam settings: up to 1.4e−3 at t = 5 and 2.8e−3 at t = 50.
  - Converged projection: ≤ 1.8e−8 for N ≤ 128 and 5.4e−6 at N = 256.
- KE increased at no step in any of the 12 runs.
- max|u| never exceeded its initial value.
- Maximum CFL in the protocol runs was 0.9998.
- No NaN.

## Numerical dissipation (effective viscosity)

At the default settings the KE decay corresponds to ν_eff ≈ 0.039, which is **3.9 times the physical ν**. About 3 times ν is numerical. There are two sources.

1. **The unconverged 20-sweep projection.** This is the dominant source at Stam's settings, and it grows with N.
   - Advecting the TG field produces a k = 2 gradient component (u·∇u = −∇p).
   - Lexicographic GS reduces that mode by a factor of about (1 − (2h)²) per sweep. For 20 sweeps that is about 0.46 at N = 64, about 0.82 at N = 128 and about 0.95 at N = 256.
   - The unremoved part (rms divergence 0.1–0.36) is then advected and interpolated every step.
   - This is why refining the grid at fixed sweep count makes things worse. Raising pIters to 500 at N = 64 alone lowers ν_eff from 0.039 to 0.027.

2. **Euler backtrace with bilinear interpolation.** This remains after the projection converges.
   - The interpolation diffusivity per direction is about h²·s(1−s)/(2dt), where s is the fractional cell displacement. At cfl ≈ 1 that is O(h·|u|), so it is first order in h. The measured order is 0.88–0.95.
   - Shrinking dt at fixed h does not help: cfl 0.5 at N = 128 gives 0.0194 against 0.0188 at cfl 1.
   - Extrapolating the converged-projection sequence (ν excess ≈ 0.0048·(256/N), L2 ≈ 0.047·(256/N)^0.85):
     - L2 < 0.02 needs N ≈ 700.
     - KE gap < 1% at t = 5 needs ν excess ≲ 5e−4, i.e. N ≈ 2400.
   - With Gauss–Seidel, neither fits the budget.

## Classification rationale

The verdict is **flagged** under CONTRACTS §6:
- Every quantitative gap exceeds its tolerance by a wide margin: 44× for the KE gap and 13× for L2 at the default.
- No run, including the converged-projection N = 256 diagnostic, passes either tolerance.
- The mass (divergence) and momentum checks fail at the shipped settings.
- Stability and KE monotonicity pass.

It is not **incomplete**:
- The reference values are fixed by an exact analytic solution that was verified by substitution.
- The full published protocol (t ∈ [0, 5]) ran to completion at the default N and beyond.

I did not change any tolerance. The divergence and momentum thresholds are my own criteria. I report the raw values with them, and the failures are not marginal: 0.12 against 1e−3, and 1.4e−3 against 1e−10.

**This is not an implementation defect:**
- The step order (diffuse, project, advect, project), the 20-sweep GS with p reset to 0, the central-difference collocated divergence and gradient, and the Euler backtrace with bilinear interpolation all match Stam's solver03.c as read through the JS port.
- Periodic wrapping and ghost layers are handled correctly. The maximum principle holds, and momentum and divergence go to round-off once the projection converges.
- The probe L2 agrees with my independent recomputation to 1e−9.
- The excess dissipation is the known, documented property of the method: the stam2003 abstract says it prioritises stability over accuracy, and the method's own `assumptions` and `stability` text state it.
- The tgv-velocity rationale suggests a smaller dt might let stable-fluids pass. The data show that is not true for this scheme: smaller dt adds dissipation at fixed h.

## Missing / caveats

- `taylor1937` is verified:false (original not read) and `lehmann2022` was seen as a search snippet only. The formula was verified by substitution, so the reference values do not depend on those sources.
- `stam1999` and `stam2003` are verified:false. The PDFs were unreachable, so fidelity was checked against the ISC JS port of solver03.c (npm stam-stable-fluids@1.0.3).
- No published Taylor–Green error values exist for Stable Fluids, so the tolerances come from the analytic references.
- The t = 50 check point (from the tolerance rationale) was run only at N = 64 with Stam settings. The KE gap there is 0.87.
- A converged-projection run at N ≥ 512 would be needed to approach the tolerances. It is beyond the 10-minute budget with Gauss–Seidel.
- The N = 256 diagnostic projection is only about 99% converged: rms div is 6e−3.
