# psi-omega-fd @ cavity-re100 — review round 1

Reviewer: reviewer-psi-omega-fd-cavity-re100-r1 (not the builder) · 2026-10-13 · **Status: matched**

Check script: `verification/checks/psi-omega-fd@cavity-re100.check.js` (run time about 90 s, prints JSON).
Record: `verification/results/psi-omega-fd@cavity-re100.js`.

## Protocol

- Scene `cavity`, Re = 100. Method defaults: central convection, cfl 0.8, up to 10 multigrid V-cycles per step (stops at a psi correction below 1e-10).
- Primary run N = 128. Its 129^2 nodes coincide with Ghia's grid, which is the resolution the reference tolerances assume. Grid sequence N = 32, 64, 128.
- Start from rest and march until the residual probe (max |du|,|dv| per unit time) drops below 1e-9, capped at t = 200. All three grids converged near t ≈ 35.
- Steadiness: the reviewer compares probes with a snapshot taken about 5–10 time units earlier.
- Tables: each Ghia coordinate is snapped to its 129-grid node j/128 (they are printed to 4 dp). The sim profile is interpolated linearly there, which is an exact node lookup at N = 128. Metric: max-abs over all 17 rows.
- psi_min and the vortex centre come from the method's probes: the nodal minimum refined by separable parabolas.

## Raw numbers (N = 128)

| quantity | sim | reference | gap | tol | pass |
|---|---|---|---|---|---|
| max \|u − u_Ghia\|, x = 0.5 | worst at y = 0.8516: 0.235713 | 0.23151 | 0.00420 | 0.02 | yes |
| max \|v − v_Ghia\|, y = 0.5 | worst at x = 0.8594: −0.232890 | −0.22445 | 0.00844 | 0.02 | yes |
| psi_min | −0.1033377 | −0.103423 | 0.082 % rel | 3 % | yes |
| vortex centre | (0.6154, 0.7378) | (0.6172, 0.7344) | 0.00339 | 0.02 | yes |

- Run: 28550 steps, dt = 1.2207e-3, t_end = 34.85, residual 9.9e-10.
- Steadiness: over the previous 9.8 time units, u_vcl changed by 3.5e-7 and psi_min by 5.1e-8.
- Stability: diffusion number 0.20 (limit 0.25), CFL 0.156 (limit 1), cell Péclet 0.78 (limit 2). No NaN.
- Conservation / consistency:
  - max |div u| = 7.1e-15
  - max |lap psi + omega| = 3.0e-12
  - circulation = −0.9921875. This equals −(1 − h), the exact discrete value for Thom walls with zero corners (Stokes value −1).
  - Kinetic energy 0.0344363, which moves by 2.6e-8 over 9.8 time units.

u rows (y, Ghia, sim, diff): every |diff| ≤ 0.0042. The largest are at y = 0.8516 (+0.0042) and in the lid layer (+0.0019 to +0.0034). There is an isolated +0.0013 at y = 0.0703 whose neighbours are ≤ 2e-4, which looks like a local irregularity in the Ghia column.
v rows: the sim is systematically larger in magnitude by 0.002–0.008. The peak is near the downward jet (x = 0.86–0.91).

## Grid sequence (information)

| N | u gap | v gap | psi_min | rel | centre err | circulation | cell Pe |
|---|---|---|---|---|---|---|---|
| 32 | 0.0089 | 0.0086 | −0.100431 | 2.89 % | 0.0087 | −0.96875 | 3.1 |
| 64 | 0.0027 | 0.0059 | −0.102762 | 0.64 % | 0.0032 | −0.98438 | 1.56 |
| 128 | 0.0042 | 0.0084 | −0.103338 | 0.08 % | 0.0034 | −0.99219 | 0.78 |

- psi_min observed order: 2.02. The Richardson-extrapolated value, −0.103526, lies 0.10 % from Ghia.
- The u/v table gaps do not fall monotonically. Ghia's own 129^2 second-order solution carries error of the same magnitude (about 1e-3 to 1e-2), so beyond N ≈ 64 the gap mostly measures the reference's error rather than the method's. Every grid, even N = 32, meets every tolerance.

## Classification

**matched** (CONTRACTS §6):
- All four quantitative gaps are within the reference tolerances. None was loosened.
- The conservation / consistency and stability checks pass.
- The reference values come from open, full-text transcriptions that agree with one another (copies registered `verified:true`).

## Missing / caveats

- `ghia1982` is `verified:false`. The original is paywalled and was not read. The tables come from identical open copies (ivan-pi, sujaldave, cfdgasman). Table numbers are unverified.
- psi_min (−0.103423) has a single full-text copy (the cfdgasman README) plus a snippet. The vortex centre has a single copy (sujaldave).
- No higher-accuracy Re = 100 reference (Botella, Erturk) is registered. The comparison is against a benchmark of similar order of accuracy.
- The steadiness criterion (< 1 % of each tolerance) and the circulation criterion (|circ + 1| ≤ 1.01 h) are set by the reviewer.
- Only the default central scheme was verified. The upwind option was not run.
