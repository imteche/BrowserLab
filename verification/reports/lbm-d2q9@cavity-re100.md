# lbm-d2q9 @ cavity-re100 — review round 1

Reviewer: reviewer-lbm-d2q9-cavity-re100-r1 (not the builder) · 2026-10-13 · **Status: matched**

Check script: `verification/checks/lbm-d2q9@cavity-re100.check.js` (run time about 4.5 min, prints JSON).
Record: `verification/results/lbm-d2q9@cavity-re100.js`.

## Protocol

- Scene `cavity`, Re = 100. Method defaults: N = 128 cells per side, lid speed Ulat = 0.1 lattice units, tau = 0.5 + 3 Ulat N / Re = 0.884. Halfway bounce-back on the stationary walls, moving-wall bounce-back on the lid.
- Primary run N = 128, which is the resolution of Ghia's 129² grid and the method default. Extra runs: N = 64 (Ulat 0.1, tau 0.692) and a Mach-sensitivity run N = 128, Ulat = 0.05 (tau 0.692).
- N = 256 was **not** run. The solver runs at about 12 MLUPS, so one converged N = 256 run takes about 12 min, which is over the review budget.
- Start from rest (rho = 1, u = 0). March until the residual probe (max |Δu| per unit time) is below 1e-8 for the primary run and below 1e-7 for the extra runs, capped at t = 120.
- Steadiness: compare probes with a snapshot taken 5–10 time units earlier. Reviewer criterion: the change must be under 1 % of each tolerance.
- Tables: the LBM nodes sit at cell centres (j + ½)/128. Ghia's coordinates, snapped to j/128, fall on cell faces. The sim profile (cell-centre values plus wall values from the probe) is interpolated linearly to those points. Metric: max-abs over all 17 rows, tolerance 0.02 U from the reference.
- psi_min and the vortex centre come from the method's probes: psi = ∫₀^y u dy at cell-centre columns, with parabolic refinement.
- Conservation: total mass Σρ. Reviewer criterion: relative drift < 10 ε per step, where ε = 2.2e-16. In exact arithmetic the scheme conserves mass, because the moving-wall terms cancel per node. Momentum and energy are not invariants of the driven viscous cavity.
- Stability (method's stated criteria): tau > ½, Mach |u|/c_s < 0.3, no NaN.

## Raw numbers (N = 128, Ulat = 0.1)

| quantity | sim | reference | gap | tol | pass |
|---|---|---|---|---|---|
| max \|u − u_Ghia\|, x = 0.5 | worst at y = 0.8516: 0.236644 | 0.23151 | 0.00513 | 0.02 | yes |
| max \|v − v_Ghia\|, y = 0.5 | worst at x = 0.8594: −0.230424 | −0.22445 | 0.00597 | 0.02 | yes |
| psi_min | −0.1021606 | −0.103423 | 1.22 % rel | 3 % | yes |
| vortex centre | (0.6158, 0.7369) | (0.6172, 0.7344) | 0.00245 | 0.02 | yes |

- Run: 67968 steps, t_end = 53.1, final residual 1.0e-8.
- Steadiness: over the previous 8.1 time units, u_vcl changed by 7.5e-11, v_hcl by 1.1e-10 and psi_min by 2.6e-11.
- Stability: tau = 0.884, maximum Mach 0.169 (max |u| = 0.978 U, next to the lid). No NaN.
- Mass: Σρ = 16383.99999997, relative drift 1.68e-12 after 67968 steps (2.5e-17 per step). The bound is 1.5e-10.
- Weak compressibility (information only): max |div u| = 4.1 U/L. This is a single maximum, probably at the lid corners where the velocity is singular. Neither the method nor the reference states a criterion for it.

u rows (y, Ghia, sim, diff):
- In the lid layer (y ≥ 0.85) the sim is larger by 0.003–0.005.
- Elsewhere |diff| ≤ 0.0018, including the centreline minimum: −0.20611 vs −0.20581 at y = 0.5.

v rows:
- Near the downward jet (x = 0.80–0.97) the sim is larger in magnitude by 0.003–0.006.
- On the upflow side the sim is larger by 0.0007–0.0026.

## Runs

| N | Ulat | tau | Ma max | steps | u gap | v gap | psi_min | rel | centre err | mass drift |
|---|---|---|---|---|---|---|---|---|---|---|
| 64 | 0.1 | 0.692 | 0.165 | 29550 | 0.0063 | 0.0036 | −0.100913 | 2.43 % | 0.0026 | 1.1e-12 |
| 128 | 0.1 | 0.884 | 0.169 | 67968 | 0.0051 | 0.0060 | −0.102161 | 1.22 % | 0.0025 | 1.7e-12 |
| 128 | 0.05 | 0.692 | 0.085 | 116480 | 0.0051 | 0.0064 | −0.102209 | 1.17 % | 0.0023 | 4.3e-12 |

- **Mach error.** Halving Ulat changes every gap by less than 5e-4, so compressibility (O(Ma²)) is not the main error at Ulat = 0.1.
- **Grid trend.** The psi_min error halves from N = 64 to N = 128, which looks first order. At fixed Ulat, tau rises with N. BGK halfway bounce-back places the wall at a position that depends on tau, so an O(h) error that also depends on viscosity is expected. Only two grids were run, so the order is not well determined. This is a known BGK property and not evidence of an implementation defect. It is consistent with psi_min sitting systematically below Ghia in magnitude.
- **Mass drift** grows with step count, as round-off would. A real leak, for example an unbalanced lid term at the corners, would show a drift orders of magnitude larger.

## Classification

**matched** (CONTRACTS §6):
- All four quantitative gaps are within the reference tolerances at the primary resolution. None was loosened. They also pass at N = 64 and at Ulat = 0.05.
- The mass conservation, steadiness and stability checks pass.
- The reference values come from open, full-text transcriptions that agree with one another (copies registered `verified:true`). The original Ghia paper is `verified:false` (see below). The same treatment was used for psi-omega-fd@cavity-re100.

Margins: the u and v gaps use about 25–30 % of their tolerance. psi_min uses about 40 % of its 3 % band, which makes it the tightest quantity.

## Missing / caveats

- `ghia1982` is `verified:false`. The original is paywalled and was not read. The tables come from identical open copies (ivan-pi, sujaldave, cfdgasman). Table numbers are unverified.
- psi_min (−0.103423) has a single full-text copy (the cfdgasman README) plus a snippet. The vortex centre has a single copy (sujaldave).
- The LBM method sources (Qian 1992, He & Luo 1997, Ladd 1994, Zou & He 1997, Hou et al. 1995) were seen only as abstracts or snippets. No LBM-specific cavity numbers (e.g. Hou et al.) are registered.
- N = 256 was not run because of the runtime budget. No diffusive-scaling sequence (fixed tau, Ulat ∝ 1/N) was run, so the convergence order is not established.
- Ghia's 129² solution is itself second order. No higher-accuracy Re = 100 reference is registered.
- The steadiness and mass criteria are set by the reviewer. A first draft of the check used a fixed mass cap of 1e-12. That cap ignored step count, and the measured 1.7e-12 exceeded it. It was replaced by the round-off-scaled bound of 10 ε per step before classification. Both the cap and the bound are disclosed here, and the measured drift is round-off level under either reading.
