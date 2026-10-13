# Review: wcsph @ tg-re100 (Taylor–Green, Re = 100, t ∈ [0, 5])

Reviewer: reviewer-wcsph-tg-re100-r1 · Round 1 · 2026-10-13 · **Status: flagged**

Check script: `verification/checks/wcsph@tg-re100.check.js` (about 6.5 min; `--quick` skips N = 140 and the t = 50 run).
Record: `verification/results/wcsph@tg-re100.js`. The method file was not modified.

## Protocol

- Scene `taylor-green`: periodic box [0, 2π]², U0 = 1, k = 1, Re = 100 (ν = 0.01). Exact solution: KE(t) = KE0·exp(−4νt) (`tgv-kinetic-energy`) and the velocity field `tgv-velocity`.
- Method settings are the defaults. They match the published SPH Taylor–Green setups (pysph-tg, ramachandran2019edac, negi2022convergence) where the method allows it:
  - c0 = 10 U0
  - acoustic CFL 0.25 and dt ≤ 0.125 h²/ν (pysph-tg)
  - random initial perturbation of at most dx/5 (EDAC)
  - cubic spline with h = 1.3 dx (PySPH uses a quintic spline with h = dx)
- Resolution study: N = 40 (default), 80 and 140 particles per side. N = 140 is the UI maximum.
- Gaps:
  - KE: |KE(t)/KE0 ÷ exp(−4νt) − 1|, tolerance 0.01 (`tgv-kinetic-energy`).
  - L2: the probe `l2_error`, tolerance 0.02 (`tgv-velocity`).
  - Both are evaluated at t = 5 and as the maximum over samples taken every 0.5.
- Deviation: the KE reference suggests checking at t = 1/(2ν) = 50. The experiment window ends at t = 5, so t = 5 is used. It is the less demanding choice. A t = 50 run at N = 40 is reported for information. Neither tolerance was loosened.
- Stability criteria come from the method's own statement:
  - Mach number max|v|/c0 ≤ 0.1
  - |ρ/ρ0 − 1| ≤ 0.01 (η of becker2007)
  - acoustic CFL ≤ 0.25
  - dt ≤ 0.125 h²/ν

## Raw numbers

| N | particles | steps | KE(5)/KE0 rel. gap | L2 at t = 5 | max Mach | max \|Δρ\|/ρ0 | max CFL | momentum drift | wall time |
|---|---|---|---|---|---|---|---|---|---|
| 40 | 1600 | 1082 | **0.344** | **0.283** | 0.123 | 0.066 | 0.2506 | 2.6e-15 | 3.5 s |
| 80 | 6400 | 2149 | **0.223** | **0.147** | 0.110 | 0.044 | 0.2501 | 1.9e-15 | 33 s |
| 140 | 19600 | 3754 | **0.171** | **0.102** | 0.103 | 0.034 | 0.2500 | 4.0e-14 | 179 s |

- The gaps grow monotonically in time, so the maximum over (0, 5] equals the value at t = 5.
- Observed convergence orders:
  - KE: 0.63 (N = 40→80), 0.48 (N = 80→140)
  - L2: 0.95 (N = 40→80), 0.65 (N = 80→140)
- At these rates the KE tolerance of 1% would need roughly N ≈ 10⁴ particles per side.
- KE never increases from one step to the next. No run produced a NaN or tripped `diverged()`.

Diagnostics (to locate the error):

| run | result |
|---|---|
| Unperturbed lattice, N = 80, early time | ν_eff = 0.01013 / 0.01018 / 0.00991 at t = 0.05 / 0.10 / 0.20 (exact 0.01); L2 ≤ 0.003. **The viscous operator is correct.** |
| Perturbed, N = 80, early time | ν_eff rises from 0.0102 to 0.0132 by t = 0.2 as the particles disorder |
| Near-inviscid Re = 10⁶, N = 80 | KE(5)/KE0 = 0.936 (exact 1.000), L2 = 0.41: numerical dissipation comes from pressure noise and disorder |
| Unperturbed lattice, N = 40 / 80 | KE gap 0.665 / 0.547, L2 0.50 / 0.35. Worse than the perturbed runs, consistent with the method notes (abrupt disorder near t ≈ 0.6). |
| c0 = 20 U0, N = 80 | KE gap 0.276, L2 0.18. Mach 0.054 and Δρ 0.019 now meet or nearly meet their criteria, but accuracy gets worse. |
| t = 50, N = 40 | KE/KE0 = 0.0055 against 0.135 exact (gap 0.96); L2 = 0.81 |

## Classification rationale (CONTRACTS §6)

The result is **flagged**. Every quantitative gap exceeds its tolerance by a wide margin:

- KE gap: 17–34% against a tolerance of 1%.
- L2 error: 0.10–0.28 against a tolerance of 0.02.

The Mach and density-variation checks also fail, because velocity and density noise grows from the particle disorder.

Conservation and stability pass:

- Mass is exact.
- Momentum is conserved to round-off.
- There is no blow-up.
- The CFL and viscous dt limits are respected.

The status is not "incomplete":

- The analytic reference is exact and was verified by substitution.
- The protocol ran to completion at three resolutions.
- The missing SPH-specific numbers do not matter, because the method is checked against the analytic solution.

The failure does not come from an implementation defect:

- On the ordered lattice the Morris viscous operator reproduces ν to 1–2%.
- The excess dissipation appears as the particles disorder, and it persists when ν ≈ 0.
- This matches the qualitative literature recorded in research/ptc.md: standard WCSPH is the least accurate SPH scheme on Taylor–Green and does not converge with resolution, and accurate results need transport-velocity or shifting corrections.

So this is a limitation of the scheme, not a code bug. No evidence was found that the code is fixable.

## Missing items

- No published numeric SPH Taylor–Green errors are available:
  - adami2013 is paywalled (verified:false).
  - The ramachandran2019edac and negi2022convergence figures are not in the open repositories.
  - The tolerances therefore come from the analytic references, not from SPH-specific values.
- taylor1937 and lehmann2022 are verified:false (snippet or secondary access only). The formula was checked independently by substitution.
- The Morris viscosity operator has no registered source. The reviewer diagnostic supports its correctness.
- The kernel and box differ from the published SPH Taylor–Green runs (cubic spline with h = 1.3dx instead of quintic with h = dx; a 2π box instead of a unit box).
- Resolution stopped at N = 140, the UI maximum.
- The check time is t = 5 rather than the reference-suggested t = 50. This choice is the more favourable one for the method, and the method still fails.
