# stable-fluids @ cavity-re1000 — review round 1

Reviewer: reviewer-stable-fluids-cavity-re1000-r1 (independent of the builder), 2026-10-13.
Check: `verification/checks/stable-fluids@cavity-re1000.check.js` (5 cases as parallel child processes; 352 s wall on 4 cores).
Status: **flagged**

## Protocol

* Scene `cavity`, Re = 1000, started from rest. Each run marches until the `residual` probe (max |Δu|,|Δv| per unit time) drops below 1e-6, or until a time cap. Steadiness is checked against a snapshot taken at least 5 time units earlier.
* **Primary run:** the method defaults, which are also Stam's settings: N = 64, `cfl = 1` (dt = h), `iters = 20`, `pIters = 20`.
* **Finer grid:** Stam settings at N = 128.
* **Diagnostics** (information only; they separate solver under-convergence from method dissipation):
  * N = 32, pIters = 1000, at cfl 1 and at cfl 0.5. The cfl-1 run was then continued for 3 time units at pIters = 8000. psi_min moved by only 5e-5 (relative), so the projection is converged at this N.
  * N = 64, pIters = 2000, run to t = 50. This was the largest setting that fit the budget, and it is quasi-steady: residual 2.3e-5, psi_min drift 4.6e-5 (relative) over 4.7 time units.
* **Comparison:**
  * Ghia coordinates are snapped to the nodes j/128. Erturk coordinates (multiples of 0.01) are used as given.
  * The sim centreline profile is linearly interpolated at those points.
  * Tolerances come from the references and were not changed: max-abs 0.03 U for u and v, relative 3% for psi_min, and 0.02 for the vortex centre.
* **Mass:** the cavity is closed, so the net flux through every interior grid line should be zero. The criterion is |flux| ≤ 1% of |psi_min| (reviewer-set). I also report the divergence after the final projection.
* **Stability:** no NaN, max|u| ≤ 1, and the CFL number is reported.

This check is adapted from the Re = 100 sibling check. I reviewed that script critically and changed four things:

* The Erturk table is compared at its exact coordinates.
* The residual target is relaxed from 1e-8 to 1e-6, because Re = 1000 relaxes slowly. psi_min was already stable to about 1e-4 at that point.
* An explicit test of projection convergence was added.
* The primary run is the method's own default, N = 64.

## Raw numbers

| case | N | cfl | pIters | t_end | u gap (Ghia) | v gap (Ghia) | u gap (Erturk) | psi_min | psi err | centre err | line flux / abs(psi_min) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **primary (defaults)** | 64 | 1 | 20 | 62.5 | **0.208** | **0.226** | **0.220** | -0.06151 | **47.8%** | 0.0118 | **15.1%** |
| Stam, finer grid | 128 | 1 | 20 | 56.6 | 0.243 | 0.220 | 0.256 | -0.05098 | 56.8% | 0.032 | 28.0% |
| diag (converged projection) | 32 | 1 | 1000 | 78.8 | 0.291 | 0.316 | 0.301 | -0.06840 | 42.0% | 0.087 | 9.8% |
| diag (converged projection) | 32 | 0.5 | 1000 | 75.8 | 0.297 | 0.327 | 0.306 | -0.06663 | 43.5% | 0.094 | 6.0% |
| diag (near-converged) | 64 | 1 | 2000 | 50.0 | 0.173 | 0.160 | 0.192 | -0.08775 | 25.6% | 0.035 | 3.4% |

Tolerances: u and v 0.03 U; psi_min 3% (Ghia -0.117929; the Erturk value -0.118781 gives 48.2% for the primary run); centre 0.02; flux 1% (reviewer-set).

**Primary centrelines.** All the interior extrema are about half of the reference values:

| quantity | sim | Ghia |
|---|---|---|
| u min, at y = 0.1719 | -0.181 | -0.383 |
| v max, at x = 0.1563 | 0.174 | 0.371 |
| v min, at x = 0.9063 | -0.289 | -0.516 |
| u, at x = 0.5 and y = 0.8516 (worst u point) | 0.125 | 0.333 |

Near the lid the u profile is closer, within 0.04–0.11 for y ≥ 0.95, because the ghost-cell lid condition imposes the wall value there. The vortex centre is at (0.529, 0.574), within 0.012 of Ghia's (0.5313, 0.5625). It is the only gap that passes. The other runs put the centre between 0.032 and 0.094 away, which suggests the primary pass is partly coincidental.

**Primary divergence.** After the final projection, max div is 10.9, at the top-right lid-corner cell. rms div is 0.240, and the max away from the walls is 1.84. The projection reduces the divergence by only a factor of 2.47.

**Primary steadiness.** The residual reached 9.3e-7. Over the last 7.4 time units, u_vcl changed by 1.7e-5, psi_min by 6.3e-5 (relative) and KE by 5.7e-5 (relative).

**Stability.** No run produced a NaN. max|u| was 0.885 at N = 64 and 0.942 at N = 128, and the CFL number stayed ≤ 0.94.

## Classification rationale

The status is flagged under CONTRACTS §6. Every centreline gap and the psi_min gap exceed tolerance, by factors of 7 to 16, and the mass-flux check fails.

* **Method defaults.** The flow is a heavily over-damped Re = 1000 cavity. The centreline extrema reach about half their reference values, and psi_min is 48% weak.
* **Unconverged projection.** As at Re = 100, Stam's fixed 20 sweeps get worse with refinement: at N = 128 the psi error is 57%. At N = 64, raising pIters from 20 to 2000 cuts the psi error from 48% to 26%.
* **Method dissipation.** Unlike Re = 100, a converged projection is far from enough:
  * psi_min error is 42% at N = 32 and 26% at N = 64, an observed order of about 0.7.
  * The u and v gaps stay between 0.16 and 0.33 U.
  * Halving dt makes things worse (42.0% → 43.5%), as expected for semi-Lagrangian interpolation diffusion, which scales as h²/dt.
  * The bilinear Euler backtrace adds an effective viscosity of order h·|u|, which is several times ν = 0.001 at these grids.
  * A crude extrapolation suggests N ≈ 1000 would be needed for 3% on psi_min. This was not measured.
* **Mass leak.** Even with a converged solve, the collocated approximate projection leaks 3–10% net line flux.
* **Implementation.** I found no defect. The step sequence and the boundary conditions are as reviewed for Re = 100, and the failure is a property of the method as specified.
* **Stability.** Unconditional stability is confirmed.

## Missing / caveats

* **ghia1982** is registered verified:false. The paper is paywalled and was not read. The tables come from mutually identical open transcriptions. One copy differs at v(0.9063) by 5e-4, which is immaterial here. psi_min is confirmed to only 4 digits, through search snippets.
* **erturk2005** is open on arXiv but registered verified:false. The u table comes from a single copy (lethe), with 3 entries confirmed by a search snippet, and psi_min comes from a snippet. No conclusion depends on reference digits, because every failing gap is at least 5× its tolerance.
* **Stam sources** (stam1999 and stam2003) are verified:false. Neither reports a quantitative benchmark. The no-slip/lid boundary condition is a builder modification of Stam's free-slip set_bnd.
* **Converged runs not completed.** Neither a fully converged N = 64 run nor any converged run at N ≥ 128 fit the ~10 min budget. In an exploratory run at N = 64, switching pIters from 1000 to 4000 still moved psi_min by about 0.5% over 5 time units. The N = 64 diagnostic may therefore understate |psi_min| by about 1%, which does not change the classification.
* **Reviewer-set criteria.** The mass-flux (1%) and steadiness (1% of each tolerance) criteria are set by the reviewer, not by a source.
