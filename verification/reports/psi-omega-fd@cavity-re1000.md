# Review: psi-omega-fd @ cavity-re1000 (round 1)

Reviewer: reviewer-psi-omega-fd-cavity-re1000-r1 · 2026-10-13. I did not build this method and made no changes to `methods/`, `references/` or `js/`.
Check script: `node verification/checks/psi-omega-fd@cavity-re1000.check.js`. It runs three grids in parallel worker threads and prints JSON. Wall time was about 9 min on 4 cores, with other jobs running.
Result: `verification/results/psi-omega-fd@cavity-re1000.js`, **status: matched**.

## Protocol
- Scene `cavity`, experiment `cavity-re1000`: Re = 1000, lid u = 1, start from rest.
- Method defaults except Re and N: central convection (scheme 0), cfl = 0.8, mgCycles = 10. I used only the public API (`create`, `step`, `metrics`, `probe`, `diverged`).
- The time march stops when the method's `residual` probe (max |Δu|,|Δv| per unit time) falls below a threshold, or at T_MAX:
  - **N = 256 (primary, largest feasible)**: stop at residual < 1e-5 or t = 55. It reached t = 55 (34,375 steps, 547 s) with residual 4.2e-5.
  - N = 128 (nodes coincide with Ghia's 129² grid): residual < 1e-7, reached at t = 138.9 (86,800 steps).
  - N = 64 (convergence trend): stopped at t = 120 with residual 2.3e-7.
- dt is the same on every grid (0.0016 = 0.8 · 2ν/max|u|²). An N = 256 run to residual 1e-7 (t ≈ 140) would take about 25 min, so I truncated it at t = 55. I bounded the remaining transient using the N = 128 run, which I snapshotted at t = 55 (see below).
- Gaps use the metrics in `references/cavity.js`:
  - Profiles: max-abs over all table points, including the trivial endpoints.
  - ψ_min: relative gap.
  - Vortex centre: max-abs per coordinate.
  - The sim profile is evaluated at each table coordinate by 4-point Lagrange interpolation. Where a 4-decimal coordinate is within 6e-5 of a node, the node value is used instead; Ghia's coordinates are nodes j/128 on both N = 128 and N = 256.
- Tolerances are as given in the references: 0.03 U for the profiles, 3 % for ψ_min, 0.02 for the centre. None was changed.

## Raw numbers

| quantity | N = 64 | N = 128 | **N = 256** | tol | pass (N=256) |
|---|---|---|---|---|---|
| Ghia u (x=0.5) max gap | 0.0621 @ y=0.1016 | 0.0138 @ 0.1016 | **0.0029** @ 0.0625 | 0.03 | yes |
| Ghia v (y=0.5) max gap | 0.0607 @ x=0.9453 | 0.0080 @ 0.8594 | **0.0131** @ 0.9531 | 0.03 | yes |
| Erturk u (x=0.5) max gap | 0.0679 @ y=0.12 | 0.0167 @ 0.12 | **0.0038** @ 0.12 | 0.03 | yes |
| ψ_min | −0.105257 | −0.115473 | **−0.117893** | | |
| ψ_min rel. gap vs Ghia −0.117929 | 10.7 % | 2.08 % | **0.03 %** | 3 % | yes |
| ψ_min rel. gap vs Erturk −0.118781 | 11.4 % | 2.79 % | **0.75 %** | 3 % | yes |
| vortex centre | (0.5362, 0.5709) | (0.5324, 0.5666) | **(0.5312, 0.5656)** | | |
| centre max-abs gap vs Ghia (0.5313, 0.5625) | 0.0084 | 0.0041 | **0.0031** | 0.02 | yes |
| centre max-abs gap vs Erturk (0.5300, 0.5650) | 0.0062 | 0.0024 | 0.0012 | info | — |
| KE ∫½\|u\|² | 0.03626 | 0.04229 | 0.04388 | info | — |

Selected N = 256 points as (coordinate, reference, sim):
- Ghia v near the right wall: (0.9531, −0.33714, −0.35020) and (0.9063, −0.51550, −0.52208). The N = 256 v-minimum is deeper than Ghia's. That is the expected direction: Ghia's own 129² grid under-resolves this peak, and spectral solutions put it near −0.527.
- At N = 128 the v gap is smaller (0.008), because that run uses Ghia's own grid.
- Ghia u: (0.1719, −0.38289, −0.38499) and (0.9766, 0.65928, 0.66036).
- Erturk u: (0.12, −0.3381, −0.33432) and (0.96, 0.5102, 0.50667).
- u(0.5, 0.5) = −0.06175 on both fine grids, against Ghia −0.06080 and Erturk −0.0620.

**Grid convergence of ψ_min.** The observed order from 64/128/256 is 2.08, so the scheme behaves as second order. The Richardson estimate with p = 2 is −0.118700, which is 0.07 % from Erturk's 601² value −0.118781.

**Transient remainder of the truncated N = 256 run.** In the N = 128 run, everything that changed after t = 55 was small:
- Max change in either centreline profile: 4.4e-4 U.
- Change in ψ_min: 1.3e-4, or 0.11 %.
- Gaps at t = 55 were 0.0139 / 0.0082 / 0.0168, against final values of 0.0138 / 0.0080 / 0.0167.

The N = 256 ψ_min history (−0.117720, −0.117822, −0.117893 at t = 45, 50, 55) is consistent with that size of remainder. Every N = 256 margin is at least 0.017 U or 2.2 % in ψ_min, so the truncation cannot change the verdict.

**Conservation and consistency** (all grids, logged every 100 steps):
- Discrete divergence: max |∇·u| ≤ 1.4e-14, i.e. exactly divergence-free to round-off.
- Poisson residual: max |∇²ψ + ω| ≤ 9.4e-9.
- Circulation: ∫ω dA = −(1 − h) to 2e-11 on every grid at every logged step. This is the discrete Stokes theorem. The −h deficit comes from the two lid-corner nodes, which the method zeroes; in the continuum the value is −1.
- Mass is conserved by construction. Momentum and energy are not invariants of this forced, viscous flow. KE converges to a steady value and does not drift: 0.042291 at N = 128, unchanged in the last 15 time units.

**Stability** (method criterion: central scheme dt = cfl · min(h²Re/4, h/max(|u|+|v|), 2ν/max|u|²)):
- dt/(2ν/max|u|²) = 0.8 on every grid.
- Max CFL: 0.41 / 0.20 / 0.10 for N = 256 / 128 / 64.
- Max diffusion number: 0.105 / 0.026 / 0.007, all ≤ 0.25.
- No NaN and no divergence.
- Cell Péclet is 3.9 / 7.8 / 15.6, above the 2 that the method notes can cause wiggles. I looked for wiggles: the u centreline has exactly 1 interior extremum and the v centreline exactly 2 on every grid, so there are no grid-scale oscillations in the measured profiles.

**Faithfulness spot check.** I re-derived Thom's lid formula from a Taylor expansion with ψ_y = u = 1 and ∂u/∂y = −ω at the wall. It gives ω_lid = −2ψ_{N−1}/h² − 2/h, which matches the implementation. The other walls use −2ψ_{w+1}/h², also correct.

## Classification rationale
- Every quantitative gap at the primary resolution (N = 256) is within the reference tolerance, mostly by a factor of 2 to 100.
- N = 128 also passes everything.
- N = 64 fails, which is expected for 64 cells at Re = 1000. The method makes no claim about N = 64, so this is grid-trend information, not a failure of the claim.
- Conservation checks pass: divergence-free, Poisson solved, discrete circulation exact. Stability checks pass within the method's own dt criterion.
- The reference values are reproduced by several independent open copies of Ghia's tables and by the lethe copy of Erturk's u table.
- The N = 256 result moves toward the finer Erturk/Botella values compared with Ghia: ψ_min, the v minimum, and the vortex centre all do. The second-order Richardson value agrees with Erturk to 0.07 %. Together this is strong evidence that the agreement is genuine and not a coincidence of grid.

That fits §6 **matched**. The verified:false status of `ghia1982` and `erturk2005` is recorded in `missing`. As in the pilot review, the access limitation concerns the original documents and table numbering. The values themselves are pinned by multiple agreeing open copies, and the result passes with large margins against both Ghia and Erturk.

## Missing / caveats
- `ghia1982`, verified:false: the original was not read. Tables I and II come from open copies that disagree only at v(0.9063); the −0.51500 alternative does not change the max v gap. The 6-digit ψ_min was not seen verbatim; it is confirmed to 4 digits by snippets.
- `erturk2005`, verified:false: the u table comes from the lethe copy, and ψ_min and the centre come from a single search snippet. Erturk's v table was not obtained, so v is compared with Ghia only.
- The tolerances are engineering bands set by the researcher, not error bars stated by the sources.
- The N = 256 run was truncated at t = 55 to fit the budget. The remainder was estimated from the N = 128 run, as described above.
- Equation locations cited by the method (`erturk2005`, `e1996`) are unverified. This review checks outputs plus the Thom formula derivation, not the cited text.
