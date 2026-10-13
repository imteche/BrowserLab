# Review: lbm-d2q9 @ tg-re100 (round 2)

Reviewer: reviewer-lbm-d2q9-tg-re100-r2, round 2, 2026-10-13. I did not write `methods/lbm-d2q9.js` and did not modify any method, reference or js file.
Check script: `node "verification/checks/lbm-d2q9@tg-re100.check.js"` (about 3.6 min on one core, prints JSON).
Result: `verification/results/lbm-d2q9@tg-re100.js`, **status: matched**.

## What changed since round 1

Round 1 flagged a start-up defect: `setEq` stored the pre-collision non-equilibrium factor −τ in the post-collision buffer `L.fo`. The refinement changed it to −(τ − 1), which is the value round 1 diagnosed. I read the diff (`git diff HEAD~1 -- methods/lbm-d2q9.js`):

- `setEq` now has `feq -= (tau - 1) * W[i] * rho * 3 * Q;` and an updated comment.
- The cylinder outlet corner treatment also changed. The Taylor-Green scene does not use it, because that scene has no outlet nodes.

I re-ran everything from scratch.

## Changes to the check script

I re-used the round-1 script after reading it in full, and changed one thing. The in-memory diagnostic used to patch `-tau` to `-(tau-1)`, and that line no longer exists. It now does the reverse: it patches the current `-(tau-1)` back to the round-1 `-tau` (variant `pre`), or removes the non-equilibrium term (variant `none`). That gives a controlled before/after comparison. Protocol, metrics, tolerances and gates are unchanged:

- KE tolerance 0.01 relative (`tgv-kinetic-energy`)
- L2 tolerance 0.02 (`tgv-velocity`)
- KE must never increase from one step to the next (1e-12 relative slack)
- Mass drift below 10 ε per step
- Momentum below 1e-10 normalised
- τ ≥ 0.51 and Mach below 0.3

## Raw numbers

| run | τ | steps | KE gap at end | KE gap max (every step) | L2 max | L2 at end | KE increases | max Mach |
|---|---|---|---|---|---|---|---|---|
| N=128, Ulat 0.05 (default), t=5 | 0.5306 | 2038 | 3.39e-4 | 3.42e-4 | 1.03e-3 | 6.79e-4 | 0 | 0.087 |
| N=64, Ulat 0.05 | 0.5153 | 1019 | 3.40e-4 | 3.41e-4 | 1.03e-3 | 6.05e-4 | 0 | 0.086 |
| N=256, Ulat 0.05 | 0.5611 | 4075 | 3.39e-4 | 3.42e-4 | 1.03e-3 | 6.89e-4 | 0 | 0.087 |
| N=64, Ulat 0.1 | 0.5306 | 510 | 1.42e-3 | 1.42e-3 | 4.02e-3 | 3.22e-3 | 0 | 0.173 |
| N=256, Ulat 0.025 | 0.5306 | 8149 | 8.52e-5 | 8.53e-5 | 2.74e-4 | 1.52e-4 | 0 | 0.043 |
| N=128, t=50 | 0.5306 | 20372 | 1.62e-3 | 1.62e-3 | 9.86e-4 | 8.82e-4 | 0 | 0.087 |
| N=256, t=50 | 0.5611 | 40744 | 1.62e-3 | 1.62e-3 | 9.84e-4 | 8.84e-4 | 0 | 0.087 |

- The method's `l2_error` probe agrees with my independent recomputation from `view('ux'/'uy')` to within 1.8e-9.
- Effective viscosity ν_eff = −ln(KE/KE0)/(4t):
  - 0.009983 at t = 5
  - 0.009992 at t = 50
  - The exact value is 0.01.
- Order under refinement at t = 5:
  - Diffusive scaling (τ fixed):
    - KE gap 1.42e-3 → 3.39e-4 → 8.5e-5, so p = 2.07, 1.99.
    - L2 3.2e-3 → 6.8e-4 → 1.5e-4, so p = 2.24, 2.16.
    - This is clean second order.
  - Acoustic scaling (Ulat fixed): KE gap and L2 stay flat at about 3.4e-4 and 6–7e-4. That is the O(Ma²) compressibility floor of LBM at fixed Ulat. The same floor explains why the t = 50 KE gap of 1.62e-3 is identical at N = 128 and 256.
- Conservation:
  - Mass: maximum relative drift 2.0e-12 over 40744 steps.
  - Momentum: at most 1.5e-15, normalised.
  - Energy: KE decays monotonically in all 7 runs.
- Stability:
  - No NaN or blow-up.
  - τ_min = 0.5153.
  - Mach ≤ 0.173.

## Initial-state diagnostic (in memory only)

| initial non-eq | N | KE gap t=5 | KE gap max (every step) | L2 t=5 | KE increases |
|---|---|---|---|---|---|
| as published now, −(τ−1) | 64 | 3.40e-4 | 3.41e-4 | 6.05e-4 | 0 |
| as published now, −(τ−1) | 128 | 3.39e-4 | 3.42e-4 | 6.79e-4 | 0 |
| round-1 −τ (reverted in memory) | 64 | 6.26e-3 | **1.28e-2** | 3.20e-3 | 31 |
| round-1 −τ (reverted in memory) | 128 | 1.36e-3 | 3.21e-3 | 9.49e-4 | 13 |
| none (equilibrium only) | 64 | 2.86e-3 | 6.21e-3 | 1.55e-3 | 25 |
| none (equilibrium only) | 128 | 4.60e-4 | 1.51e-3 | 6.97e-4 | 10 |

The reverted variant reproduces the round-1 numbers exactly. The published fix removes the transient completely.

## Classification

Every quantitative gap is within tolerance at the defaults and at every refinement level:

- KE: at most 0.034% on [0, 5] and 0.16% at t = 50. Tolerance 1%.
- L2: at most 0.0010. Tolerance 0.02.

Mass, momentum, energy monotonicity and stability all pass. Convergence is second order. No tolerance was loosened. Under CONTRACTS §6 the status is **matched**.

## Missing / caveats

- Source access for the analytic solution:
  - `taylor1937` is verified:false. The original was not read.
  - `lehmann2022` was seen only as a search snippet, also verified:false.
  - The analytic formula was verified independently by substitution (research/ins.md), so the reference values are fixed by mathematics. I judge the reference open in substance and this does not change the verdict.
- No LBM-specific published TG error values were obtained. The tolerances are those of the analytic references.
- The D2Q9 equilibrium, the weights and ν = (τ−½)/3 are standard forms with unverified equation numbers (qian1992 and he1997 are paywalled).
- The experiment is defined on [0, 5]. The t = 50 check point named in the KE tolerance rationale was also run and gated.
