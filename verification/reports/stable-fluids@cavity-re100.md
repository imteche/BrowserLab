# stable-fluids @ cavity-re100 — review round 1

Reviewer: reviewer-stable-fluids-cavity-re100-r1 (independent of the builder), 2026-10-13.
Check: `verification/checks/stable-fluids@cavity-re100.check.js` (runs 6 cases as parallel child processes; 242 s wall on 4 cores).
Status: **flagged**

## Protocol

* Scene `cavity`, Re = 100, starting from rest, marched until the method's `residual` probe (max |Δu|,|Δv| per unit time) falls below 1e-8 (primary). Steadiness was confirmed against a snapshot taken at least 5 time units earlier.
* **Primary run:** Stam's solver settings, which are also the method defaults: `cfl = 1` (dt = h), `iters = 20` diffusion sweeps, `pIters = 20` pressure sweeps. The grid is N = 128 cells, so h = 1/128, the spacing of Ghia's 129² grid that the reference tolerances assume. The method's default N = 64 was run as well.
* **Diagnostics** (for information only; they are not counted toward a pass): the same scheme with the pressure Poisson solve pushed closer to convergence. These were pIters = 2000 at N = 32 (cfl 1 and 0.5), 1000 at N = 64, and 300 at N = 128. A converged N = 128 run needs O(N²) Gauss–Seidel sweeps per projection and does not fit the ~10 min budget, so 300 sweeps was the largest feasible.
* **Comparison:** each Ghia coordinate is snapped to the node j/128, and the sim centreline profile is linearly interpolated there. The metric is max-abs over the 17 rows, with the reference tolerance of 0.02 U left unchanged. psi_min is compared by relative error (tol 3%). The vortex centre is compared by max(|dx|,|dy|) (tol 0.02).
* **Mass conservation:** the cavity is closed, so the net volume flux through every interior grid line x = ih or y = jh must be zero. The check measures max |flux| / |psi_min|, with a reviewer-set criterion of ≤ 1%. This flux equals h² times the sum of the central divergence over a strip of cells, so it is a consistent integral measure. Max, rms and interior divergence after the final projection are also reported, along with the projection's reduction factor. Momentum is not an invariant here, because the walls and lid exert forces. KE must be stationary.
* **Stability:** no NaN; max|u| ≤ 1 (semi-Lagrangian max principle); CFL ≤ 1 (the method's accuracy note).

## Raw numbers

| case | N | cfl | pIters | t_end | u gap | v gap | psi_min | psi err | centre err | line flux / abs(psi_min) | interior max div |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **primary (Stam)** | 128 | 1 | 20 | 26.76 | **0.116** | **0.109** | -0.04725 | **54.3%** | **0.0267** | **128%** | 4.76 |
| default N | 64 | 1 | 20 | 27.34 | 0.077 | 0.063 | -0.06710 | 35.1% | 0.0100 | 56% | 1.76 |
| diag | 32 | 1 | 2000 | 26.56 | 0.0197 | 0.0213 | -0.09706 | 6.2% | 0.0149 | 5.0% | 0.137 |
| diag | 32 | 0.5 | 2000 | 26.56 | 0.0204 | 0.0231 | -0.09686 | 6.4% | 0.0165 | 3.2% | 0.150 |
| diag | 64 | 1 | 1000 | 24.61 | 0.0094 | 0.0061 | -0.10027 | 3.05% | 0.0083 | 2.3% | 0.102 |
| diag (largest feasible) | 128 | 1 | 300 | 21.29 | 0.0122 | 0.0076 | -0.09739 | 5.8% | 0.0041 | 5.6% | 0.131 |

Tolerances: u, v 0.02 U; psi_min 3%; centre 0.02; flux 1% (reviewer-set).

Primary centrelines: the interior flow is about half as strong as Ghia's.

* u(0.5, 0.4531) = -0.0948 vs -0.2109.
* u(0.5, 0.5) = -0.0921 vs -0.2058.
* v(0.8047, 0.5) = -0.1360 vs -0.2453.
* v(0.2344, 0.5) = 0.0946 vs 0.1753.

Near the lid the u profile is close to Ghia's (within 0.011 for y ≥ 0.95), because the ghost-cell lid condition imposes it there.

Primary run, other measurements:

* **Divergence:** the projection reduces max divergence only from 50.5 to 21.7, a factor of 2.3. The maximum, 21.7, is at the top-right lid corner cell. rms divergence is 0.396.
* **Steadiness:** residual 9.0e-9 after 3425 steps. Over the last 6.6 time units, u_vcl changed by 7.6e-7, psi_min by 2.4e-6 (relative) and KE by 1.2e-6 (relative).
* **Stability:** max|u| = 0.975 and CFL = 0.975; there was no NaN in any run.

## Classification rationale

The status is flagged under CONTRACTS §6, because several checks fail and several gaps exceed tolerance.

* **Stam settings** (the published 20-sweep projection, dt = h): every Ghia gap exceeds its tolerance by a factor of 1.3 (centre) to 18 (psi_min). The mass-flux check also fails badly. The error grows with resolution: psi error is 35% at N = 64 and 54% at N = 128. A fixed 20 Gauss–Seidel sweeps converges the Poisson problem less as N increases, so the projected field keeps a large divergent part and the recirculation is weakened.
* **What causes the error:**
  * Raising only pIters (20 → 300 at N = 128) brings u, v and the centre within tolerance. psi_min stays 5.8% off.
  * With a converged projection the scheme converges at first order. psi error is 6.2% at N = 32 and 3.05% at N = 64, and the observed order is ≈ 1.0 for both psi and u. This matches the first-order semi-Lagrangian advection and operator splitting.
  * Halving the CFL changes psi_min by only 0.2%, so time-step dissipation is minor at CFL ≤ 1.
  * Even with a converged pressure solve, the collocated approximate projection leaves 2–5% net line flux and an interior rms divergence of about 0.2. The 5-point Laplacian is not div∘grad of the central 2h operators. This is inherent to Stam's discretisation.
* **Implementation:** I found no defect. The step sequence (diffuse → project → advect → project), the Gauss–Seidel sweeps with p reset to 0, the central divergence and gradient, and the bilinear Euler backtrace all match the described solver03.c. The cavity no-slip/lid ghost condition gives the exact wall values. The failure comes from the method as specified (fixed 20 sweeps, approximate collocated projection, first-order advection), not from a coding error. A configuration with many more pressure sweeps, or a better pressure solver, is a different method setting. On the diagnostic evidence it would probably pass the centreline tables at N ≥ 64, but it would still fail the 1% mass-flux criterion and is borderline on psi_min.
* **Stability:** unconditional stability is confirmed. No run blew up, and max|u| stayed ≤ 1.

## Missing / caveats

* ghia1982 is registered verified:false. The original paper is paywalled and was not read. The u/v tables come from open, mutually identical transcriptions (verified:true copies), and table numbers were not checked against the original.
* psi_min (-0.103423) and the vortex centre each come from a single open copy.
* stam1999 (search snippet only) and stam2003 (code read through a JS port; paper PDF unreachable) are both verified:false. Neither reports a quantitative benchmark. The 20-sweep default is taken from the ported code.
* The cavity no-slip/lid boundary condition is the builder's modification of Stam's free-slip set_bnd.
* A converged-projection N = 128 run did not fit the budget. First-order extrapolation from N = 32/64 suggests a psi error of about 1.5%, but this was not measured.
* The mass-flux (1%) and steadiness (1% of each tolerance) criteria are reviewer-set.
