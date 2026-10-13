# lbm-d2q9 @ cavity-re100 — review round 2

Reviewer: reviewer-lbm-d2q9-cavity-re100-r2 (not the builder; independent of the r1 reviewer) · 2026-10-13 · **Status: matched**

Check script: `verification/checks/lbm-d2q9@cavity-re100.check.js` (about 3.8 min; with `N256=1` it adds the N = 256 run, about 9 min more). It prints JSON.
Record: `verification/results/lbm-d2q9@cavity-re100.js`.

## What changed since round 1

Refinement round 1 changed two things in `methods/lbm-d2q9.js` (uncommitted diff read in full):
- the non-equilibrium factor in `Lattice.setEq`, which only applies when velocity gradients are passed (Taylor–Green init);
- the Zou–He outlet corner handling, which only applies on `outlet` columns (cylinder).

The cavity calls `setEq(x, 1, 0, 0)` with no gradients and has no outlet. So the cavity code path is unchanged. Everything was still re-run from scratch, and the round-2 numbers match round 1 to every printed digit.

## Check script review

I read the r1 script critically and kept its protocol. Points checked:
- Ghia coordinates snap to j/128. The probe profiles are cell centres plus the wall values (u = 1 at the lid, v = 0 at x = 1), interpolated linearly to the snapped points.
- The probe `u_vcl` samples bilinearly at index 0.5N − 0.5, which is x = 0.5. `v_hcl` does the same in the other direction.
- Tolerances come from the reference records and are not changed: 0.02 U, psi 3 % rel, centre 0.02.
- Mass bound is 10 ε per step. Steadiness requires the change over the last 5–10 time units to be under 1 % of each tolerance.

The only change is an optional `N256=1` run, for information only.

## Protocol

- Scene `cavity`, Re = 100. Method defaults: N = 128, Ulat = 0.1, tau = 0.884.
- Halfway bounce-back on the stationary walls; moving-wall bounce-back on the lid.
- Start from rest.
- The primary run marches until the residual is below 1e-8. The extra runs (N = 64; N = 128 at Ulat 0.05; N = 256) stop at a residual below 1e-7.

## Raw numbers (N = 128, Ulat = 0.1)

| quantity | sim | reference | gap | tol | pass |
|---|---|---|---|---|---|
| max \|u − u_Ghia\|, x = 0.5 | worst at y = 0.8516 | Table I | 0.00513 | 0.02 | yes |
| max \|v − v_Ghia\|, y = 0.5 | worst at x = 0.8594 | Table II | 0.00597 | 0.02 | yes |
| psi_min | −0.1021606 | −0.103423 | 1.22 % rel | 3 % | yes |
| vortex centre | (0.6158, 0.7369) | (0.6172, 0.7344) | 0.00245 | 0.02 | yes |

- Run: 67968 steps to t = 53.1, final residual 9.98e-9.
- Steadiness: over the previous 8.1 time units, u_vcl changed by 7.5e-11, v_hcl by 1.1e-10 and psi_min by 2.6e-11.
- Stability: tau = 0.884 and maximum Mach 0.169 (below the method's limit of 0.3). No NaN.
- Mass: Σρ drift 1.68e-12 relative after 67968 steps, against a bound of 1.5e-10. This is round-off.
- Information only: max |div u| = 4.1 U/L, a single maximum, presumably at the lid corners.

## Runs

| N | Ulat | tau | Ma max | steps | u gap | v gap | psi_min | rel | centre err | mass drift |
|---|---|---|---|---|---|---|---|---|---|---|
| 64 | 0.1 | 0.692 | 0.165 | 29550 | 0.0063 | 0.0036 | −0.100913 | 2.43 % | 0.0026 | 1.1e-12 |
| 128 | 0.1 | 0.884 | 0.169 | 67968 | 0.0051 | 0.0060 | −0.102161 | 1.22 % | 0.0025 | 1.7e-12 |
| 128 | 0.05 | 0.692 | 0.085 | 116480 | 0.0051 | 0.0064 | −0.102209 | 1.17 % | 0.0023 | 4.3e-12 |
| 256 | 0.1 | 1.268 | 0.172 | 100096 | 0.0049 | 0.0074 | −0.102803 | 0.60 % | 0.0029 | 1.8e-12 |

- **Grid trend.** The psi_min error halves at each refinement (2.43 → 1.22 → 0.60 %), which is first order at fixed Ulat.
  - At fixed Ulat, tau rises with N. BGK halfway bounce-back puts the wall at a position that depends on tau, so this error behaviour is expected.
  - This is a known scheme property, not evidence of a coding defect.
- **u and v gaps.** These level off at a few 1e-3, about the accuracy of Ghia's own second-order 129² grid.
  - The v gap grows slightly with N (0.0036 → 0.0074) near the downward jet at x ≈ 0.86.
  - At N = 256 it is still only 37 % of the tolerance.
  - It may reflect Ghia's own discretisation error at that location, or the tau-dependent wall error. It is not a failure.
- **Mach.** Halving Ulat changes every gap by less than 5e-4.

## Classification

**matched** (CONTRACTS §6):
- All four gaps are within their reference tolerances at the primary resolution, and also at N = 64 and N = 256. No tolerance was loosened.
- The mass conservation, steadiness and stability checks pass.
- The reference values come from open transcriptions that agree with one another (the copies are `verified:true`). The original Ghia paper is `verified:false`; see below.
- I found no implementation defect.

## Missing / caveats

- `ghia1982` is `verified:false`. The original is paywalled and was not read. The tables come from identical open copies, and the table numbers are unverified.
- psi_min (−0.103423) and the vortex centre each have a single full-text copy.
- The LBM method sources were seen only as abstracts or snippets. No LBM-specific cavity numbers (e.g. Hou et al.) are registered.
- The N = 256 run converged to residual 1e-7, not 1e-8, and the steadiness test was not applied to it. It is used for the trend only.
- No diffusive-scaling sequence (fixed tau) was run.
- Ghia's 129² solution is itself second order, and no higher-accuracy reference is registered.
- The steadiness and mass criteria are set by the reviewer.
