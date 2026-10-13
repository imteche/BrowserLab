# Review: lbm-d2q9 @ tg-re100

Reviewer: reviewer-lbm-d2q9-tg-re100-r1, round 1, 2026-10-13. I did not write `methods/lbm-d2q9.js` and did not modify any method, reference or js file.
Check script: `node "verification/checks/lbm-d2q9@tg-re100.check.js"` (about 3.6 min on one core, prints JSON).
Result: `verification/results/lbm-d2q9@tg-re100.js`, **status: flagged** (fixable: implementation defect in the initial state).

## Protocol

- Scene `taylor-green`, Re = 100, k = 1, U0 = 1, ν = 0.01, periodic box [0, 2π]², experiment horizon t ∈ [0, 5].
- References (`references/taylor-green.js`):
  - `tgv-kinetic-energy`: E_ref(t) = 0.25 exp(−4νt). Tolerance 1% relative.
  - `tgv-velocity`: u = −cos x sin y e^{−2νt}, v = sin x cos y e^{−2νt}. Tolerance 0.02 relative L2.
- Metrics:
  - KE gap = |KE(t)/E_ref(t) − 1|. KE0 equals 0.25 to round-off, so this is the same as the ratio form (KE/KE0)/exp(−4νt).
  - The KE gap is sampled every 0.5 time units and also after every single step.
  - L2 comes from the method probe `l2_error`. I recomputed it myself from `view('ux'/'uy')` against the `tgv-velocity` function. The two agree to 2.2e-9.
- Primary run: the method defaults N = 128 and Ulat = 0.05. That gives τ = 0.5306 and a nominal Ma of 0.087.
- Secondary run: t = 50 = 1/(2νk²), the check point named in the KE tolerance rationale. By then KE has decayed to e⁻² ≈ 0.135. I ran it at N = 128 and N = 256.
- Refinement:
  - Acoustic scaling (Ulat = 0.05 fixed): N = 64, 128, 256.
  - Diffusive scaling (τ = 0.5306 fixed): N = 64, 128, 256 with Ulat = 0.1, 0.05, 0.025.
- Conservation criteria:
  - Mass: total mass Σρ drifts by less than 10 ε per step.
  - Momentum: |Σρu|/(N²Ulat) < 1e-10.
  - Energy: KE never increases from one step to the next. KE is not an invariant, but the viscous flow must decay.
- Stability criteria, from the method's own stated limits:
  - no NaN and no `diverged()`
  - τ ≥ 0.51
  - Mach number |u|/c_s < 0.3

## Raw numbers

| run | τ | steps | KE gap t=5 | KE gap max (every step) | L2 max [0,5] | L2 t=5 | KE increases (last step) | max Mach |
|---|---|---|---|---|---|---|---|---|
| N=128, Ulat 0.05 (default) | 0.5306 | 2038 | 1.36e-3 | 3.21e-3 (t=0.0025) | 1.27e-3 | 9.49e-4 | 13 (26) | 0.087 |
| N=64, Ulat 0.05 | 0.5153 | 1019 | 6.26e-3 | **1.28e-2** (t=0.0049) | 3.37e-3 | 3.20e-3 | 31 (65) | 0.086 |
| N=256, Ulat 0.05 | 0.5611 | 4075 | 1.12e-4 | 8.04e-4 | 1.03e-3 | 6.71e-4 | 6 (12) | 0.087 |
| N=64, Ulat 0.1 | 0.5306 | 510 | 5.41e-3 | 1.29e-2 | 5.18e-3 | 4.15e-3 | 10 (20) | 0.173 |
| N=256, Ulat 0.025 | 0.5306 | 8149 | 3.41e-4 | 8.03e-4 | 3.39e-4 | 2.24e-4 | 14 (28) | 0.043 |
| N=128, t=50 | 0.5306 | 20372 | 8.9e-5 at t=50 | 3.21e-3 | 1.04e-3 | 3.5e-4 at t=50 | 13 (26) | 0.087 |
| N=256, t=50 | 0.5611 | 40744 | 1.17e-3 at t=50 | 1.17e-3 | 9.1e-4 | 6.8e-4 at t=50 | 6 (12) | 0.087 |

- Effective viscosity from the KE decay, ν_eff = −ln(KE/KE0)/(4t):
  - 0.010068 at t = 5 and 0.0100004 at t = 50 (N = 128)
  - 0.010006 at t = 5 (N = 256)
  - The exact value is 0.01.
- Order under refinement at t = 5:
  - Diffusive scaling: KE gap order p = 1.99 and 2.00; L2 order p = 2.13 and 2.08. This is clean second order.
  - Acoustic scaling: L2 order p = 1.75, then 0.50. The error levels off at the O(Ma²) compressibility floor, which is expected for LBM at fixed Ulat. The KE-gap orders here (2.2 and 3.6) are not meaningful because errors of opposite sign cancel.
- Conservation:
  - Mass: maximum relative drift 2.0e-12 over 40744 steps.
  - Momentum: at most 9.8e-16, normalised.
- Stability:
  - No NaN or blow-up in any run.
  - τ ≥ 0.5153.
  - Mach ≤ 0.173.

## The start-up defect

In every run, KE rises and falls on alternate steps right after t = 0. The oscillation dies out at a rate |1 − ω| per step.

`createTG` calls `setEq` with the velocity gradient. That stores f_eq − τ w ρ 3 Q:∇u into `L.fo`. But `step()` treats `L.fo` as post-collision populations: it streams them first and collides afterwards. The Chapman–Enskog term −τ w ρ 3 Q:∇u is the *pre*-collision non-equilibrium part. After BGK collision it becomes (1 − 1/τ) times that, i.e. −(τ − 1) w ρ 3 Q:∇u. With τ ≈ 0.53, the stored value has the wrong sign and is about 1.13 times too large.

To test this, the check script loads the method source in memory with that one coefficient changed. The file on disk is not touched.

| initial non-eq | N | KE gap t=5 | KE gap max (every step) | L2 t=5 | KE increases |
|---|---|---|---|---|---|
| as published, −τ | 64 | 6.26e-3 | 1.28e-2 | 3.20e-3 | 31 |
| as published, −τ | 128 | 1.36e-3 | 3.21e-3 | 9.49e-4 | 13 |
| −(τ−1), post-collision consistent | 64 | 3.40e-4 | 3.41e-4 | 6.05e-4 | 0 |
| −(τ−1), post-collision consistent | 128 | 3.39e-4 | 3.42e-4 | 6.79e-4 | 0 |
| none (equilibrium only) | 64 | 2.86e-3 | 6.21e-3 | 1.55e-3 | 25 |
| none (equilibrium only) | 128 | 4.60e-4 | 1.51e-3 | 6.97e-4 | 10 |

With the corrected coefficient:

- the transient disappears
- KE decays monotonically
- the KE gap at t = 5 becomes 3.4e-4 at both resolutions, which is the Ma² floor

The published initialisation is worse than leaving the non-equilibrium term out entirely. This is concrete evidence of an implementation defect. It is not a limitation of the D2Q9 BGK scheme.

## Classification

- All quantitative reference gaps pass at the method defaults (N = 128):
  - KE: at most 0.32% over every step on [0, 5]; 0.009% at t = 50. Tolerance 1%.
  - L2: at most 0.0013. Tolerance 0.02.
- Convergence is second order, as expected.
- Mass and momentum are conserved to round-off, and every run is stable.
- **The energy check fails.** KE increases on 13 steps at N = 128 and 31 steps at N = 64, which is unphysical for a decaying vortex.
- At N = 64 (a legal UI setting with τ = 0.515, above the method's own τ bound), the per-step KE gap reaches 1.28% at t = 0.005. That exceeds the 1% tolerance.

Under CONTRACTS §6, a failed check means **flagged**. The cause is identified: the initial non-equilibrium populations use the pre-collision coefficient −τ where the post-collision coefficient −(τ−1) belongs. Fixing it should make this experiment **matched** (the reviewer diagnostic passes every check). I did not loosen any tolerance.

## Missing / caveats

- Source access for the analytic solution:
  - `taylor1937` is verified:false. The original was not read and is not open access.
  - `lehmann2022` (arXiv:2112.08926) was seen only as a search snippet, also verified:false.
  - Neither caveat affects the verdict: the formula was checked independently by substitution (research/ins.md), so the reference values are fixed by the mathematics.
- Check time: the KE tolerance rationale names t = 50, while the experiment is defined on [0, 5]. I ran and gated both.
- No LBM-specific published numeric TG errors were obtained. The tolerances used are those of the analytic references.
- The D2Q9 equilibrium, the weights and ν = (τ−½)/3 are recorded as standard forms with unverified equation numbers. The papers (qian1992, he1997) are paywalled.
- I tested the fix only in memory. Round 2 should re-run this check after the builder updates `createTG`, either by passing a post-collision coefficient to `setEq` or by storing pre-collision populations consistently.
