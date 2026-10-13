# Review: lax-friedrichs @ sod-t02 (round 1)

Reviewer: reviewer-lax-friedrichs-sod-t02-r1 · 2026-10-13 · I did not build this method and made no changes to `methods/`, `references/` or `js/`.
Check script: `node verification/checks/lax-friedrichs@sod-t02.check.js` (runs in about 0.4 s and prints JSON).

**Verdict: flagged.** The scheme is a faithful, conservative and stable classic Lax–Friedrichs scheme. Its large numerical diffusion puts the rarefaction head and tail outside the 0.01 wave-position tolerance at N = 200 and N = 400. I found no implementation defect.

## Protocol
- Scene `sod`: γ = 1.4, x0 = 0.5, (ρ,u,p) = (1,0,1) | (0.125,0,0.1), transmissive boundaries, CFL 0.9. The last step is shortened so the run ends exactly at t = 0.2.
- Grids: N = 100, 200, 400, 800, 1600, 3200 (the protocol asked for 100–800; I added 1600 and 3200 because they are cheap).
- L1 error: L1(q) = Σ|q_i − q_exact(x_i, 0.2)| dx, with q_exact from `sod-exact-profile` evaluated at cell centres. Observed order is log2(L1(N)/L1(2N)).
- Conservation: domain totals checked at every step against mass 0.5625, momentum 0.9t and energy 1.375 (see the reference defect below), with relative tolerance 1e-12.
- Wave positions compared with the `sod-x-*` values (from sodshock), tolerance 0.01:
  - Shock: the point where p crosses (p* + p_R)/2.
  - Contact: the point where ρ crosses (ρ*L + ρ*R)/2.
  - Rarefaction head and tail: a least-squares line through u over the central 60 % of the exact fan, extrapolated to u = 0 (head) and u = u* (tail). In a centred rarefaction u is exactly linear in x, so this works for kinks, which have no jump midpoint.
- Star plateaux: pairs of cells averaged at the middle of each plateau, with the 2 % band at N = 400 that the `sod-pstar` note gives.
- Faithfulness: I wrote my own classic-form LF update, U_i^{n+1} = ½(U_{i−1}+U_{i+1}) − dt/(2dx)(F_{i+1}−F_{i−1}), using the same dt rule, and ran it at N = 200.

## Raw numbers
| N | steps | L1 ρ | L1 u | L1 p | shock err | contact err | head err | tail err |
|---|---|---|---|---|---|---|---|---|
| 100 | 46 | 2.848e-2 | 5.146e-2 | 2.764e-2 | 5.4e-3 | 8.6e-3 | 3.25e-2 | 6.94e-2 |
| 200 | 95 | 2.017e-2 | 3.217e-2 | 1.784e-2 | 2.7e-3 | 9.3e-3 | **1.89e-2** | **4.24e-2** |
| 400 | 193 | 1.363e-2 | 1.958e-2 | 1.117e-2 | 1.3e-3 | 4.0e-3 | **1.13e-2** | **2.62e-2** |
| 800 | 387 | 8.867e-3 | 1.138e-2 | 6.750e-3 | 5.3e-4 | 3.7e-3 | 6.0e-3 | 1.52e-2 |
| 1600 | 777 | 5.683e-3 | 6.473e-3 | 4.006e-3 | 1.6e-4 | 2.1e-3 | 3.1e-3 | 8.6e-3 |
| 3200 | 1556 | 3.624e-3 | 3.823e-3 | 2.357e-3 | 1.3e-4 | 1.1e-3 | 1.5e-3 | 4.7e-3 |

Observed orders, refinement step by step (100→200, 200→400, 400→800, 800→1600, 1600→3200):
- ρ: 0.50, 0.57, 0.62, 0.64, 0.65
- u: 0.68, 0.72, 0.78, 0.81, 0.76
- p: 0.63, 0.68, 0.73, 0.75, 0.76

These are all in the expected sub-first-order range for a first-order scheme on a solution with a contact and a shock.

**Engineering band** (`sod-exact-profile-laxfriedrichs-band`, which is not a published value): L1 ρ is 0.0285, 0.0202 and 0.0136 against bands of 0.040, 0.028 and 0.019, so all three pass. These errors reproduce the researcher's scratch LF errors (2.848e-2, 2.017e-2, 1.363e-2) to all printed digits.

**Conservation** (N = 100 to 3200, checked at every step):
| quantity | worst value | tolerance |
|---|---|---|
| mass, relative drift | 3.9e-16 | 1e-12 |
| energy, relative drift against 1.375 | 6.5e-16 | 1e-12 |
| momentum − 0.9t, relative | 4.6e-16 | 1e-12 |
| method's internal boundary-flux residual | 1.1e-15 | — |

**Stability:** no NaN, no divergence, and ρ and p stay positive in every run. The maximum CFL number is 0.900. Two informational runs at N = 400:
- CFL 1.0 is stable, with L1 ρ = 1.24e-2.
- CFL 0.5 is more diffusive, with L1 ρ = 2.07e-2. This is expected, since LF viscosity scales as dx²/dt.

Continuing the run to t = 0.6, after the waves leave the domain, stays bounded.

**Plateaux at N = 400** (relative errors; band 2 %):
| plateau | N = 400 | N = 800 | N = 3200 |
|---|---|---|---|
| p* | 1.3e-4 | — | — |
| u* | 1.6e-4 | — | — |
| ρ*R | 1.8e-3 | — | — |
| ρ*L | 1.5e-2 | 0.8e-2 | 0.23e-2 |

All four pass at N = 400.

**Estimator robustness** (N = 200): fit windows of 60 %, 40 % and 20 % give a head between 0.2445 and 0.2463 and a tail between 0.5266 and 0.5283. The fitted fan slope is 3.27–3.31, against an exact value of 2/((γ+1)t) = 4.17. The fan centre, where u = u*/2, sits at 0.3858 against an exact 0.3747. So the fan in the numerical solution is genuinely too shallow and shifted; the failure does not come from the choice of estimator.

**Faithfulness:** my independent classic-LF run agrees with the method to 1.1e-15 (max |Δ| over ρ, u, p at N = 200).

**Odd–even artefact** (informational, expected for LF):
- Neighbour jump in the left constant state: 4.2e-3 at N = 200 and 5.7e-5 at N = 800.
- Pressure zigzag in the star region: 3.3e-4 at N = 200.

## Classification rationale (CONTRACTS §6)
- **Passing checks:** conservation, stability and convergence. These are the scientifically defensible ones, and none of them depends on the unpublished bands. Shock position, contact position and the star plateaux also pass.
- **Failing checks:** the rarefaction head misses the 0.01 tolerance at N = 200 (error 0.019) and N = 400 (0.011). The tail misses it at N = 200 (0.042), N = 400 (0.026) and N = 800 (0.015). Both are first within tolerance at N = 1600. Under §6, any gap that exceeds its tolerance makes the result **flagged**.
- **Cause:** the scheme is inherently too diffusive. The errors shrink at about order 0.8–0.9 under refinement, and the implementation matches an independent re-implementation to round-off.
- **Not fixable** by a code change. A less diffusive scheme (local LF/Rusanov, Godunov) is a different method, not a fix.
- **I did not loosen any tolerance.** The one deviation is the energy target for conservation: the registered value is arithmetically wrong (see below), so I used the correct initial total of 1.375 with the same 1e-12 tolerance.

## Missing / caveats
1. No published Sod L1 tables were found. The LF L1 bands are BrowserLab engineering bands (about 1.4 × the researcher's own LF errors), so passing them is not independent evidence.
2. The 0.01 wave-position tolerance and the 2 % plateau band are engineering choices. The tolerance is written for jumps; for the head and tail kinks I chose the estimator (u-fan least-squares fit).
3. **Reference defect:** `sod-totals` gives energy 2.75, but the initial data give 0.5·2.5 + 0.5·0.25 = 1.375. The researcher should correct `references/sod.js`. The independent hllc-godunov@sod-t02 review reports the same problem.
4. Source access: toro2009, sod1978 and lax1954 are `verified: false` (paywalled originals not read). The exact solver comes from zingale-cha and is validated against sodshock2015 (both `verified: true`). rusanov2024 is snippet-only.
5. The expected-order range (about 0.5–1) is recollection, not a citation. The pass range of 0.4–1.1 is my own choice.
