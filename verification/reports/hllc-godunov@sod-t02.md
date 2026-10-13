# Review: hllc-godunov @ sod-t02

Reviewer: reviewer-hllc-godunov-sod-t02-r1, round 1, 2026-10-13. I did not write `methods/hllc-godunov.js` and did not modify any method or reference file.
Check script: `node verification/checks/hllc-godunov@sod-t02.check.js` (about 4 s; prints JSON).
Result: `verification/results/hllc-godunov@sod-t02.js`, **status: flagged**.

## Protocol

- Scene `sod`: γ = 1.4, x0 = 0.5, (ρ,u,p) = (1,0,1) | (0.125,0,0.1), domain [0,1], transmissive boundaries. Comparison at t = 0.2. Every run lands exactly on t = 0.2 because the method clips the last step.
- Method defaults: CFL 0.9 and Davis wave speeds. I also ran Einfeldt speeds as information.
- Resolutions: N = 100, 200, 400 (the banded resolutions), then 800, 1600, 3200 and 6400 for convergence. All N are even, so the diaphragm lies on a cell face.
- I used only the public API: `create`, `step`, `metrics`, `probe('profile'|'totals')`, `diverged`.
- Ground truth: `sod-exact-profile`, an exact Riemann solver. It was independently validated against the open sodshock code to 1e-15.
- L1(q) = Σ |q_cell − q_exact(x_centre)| dx, for ρ, u and p. Observed order = log2(L1(N)/L1(2N)).
- Plateaus: I read the cell nearest the middle of each exact plateau at N = 400.
  - Left of the contact: x = 0.586 gives ρ*L, p* and u*.
  - Right of the contact: x = 0.769 gives ρ*R, p* and u*.
- Wave positions, at N = 200 (tolerance 0.01) and at N = 400 and 1600 for information:
  - Shock: where p crosses (p*+pR)/2.
  - Contact: where ρ crosses (ρ*L+ρ*R)/2.
  - Rarefaction head and tail: these are kinks, and the reference prescribes no locator for them. I fitted a least-squares line to u inside the fan, where exact u is linear in x, and intersected it with u = 0 and u = u*. To test robustness I trimmed the window by 10, 25 and 35 % of the fan width and also used the maximum of −u_xx.
- Conservation: compared with `sod-totals` at relative tolerance 1e-12 for every run.
- Contact resolution: counted the cells inside the 10–90 % band of the jump. The comparison baseline is the repository `lax-friedrichs` method at the same N and CFL. I also ran an isolated stationary contact (equal p and u).
- Information only: the modified Sod test (u_L = 0.75, x0 = 0.3) against its band.

## Raw numbers

| quantity | value | reference / tol | pass |
|---|---|---|---|
| L1 ρ, N=100 / 200 / 400 | 1.4751e-2 / 9.3656e-3 / 5.9696e-3 | engineering bands 0.021 / 0.013 / 0.0085 | yes |
| L1 ρ, N=800 / 1600 / 3200 / 6400 | 3.779e-3 / 2.373e-3 / 1.511e-3 / 9.576e-4 | — | info |
| L1 u, N=100…6400 | 2.210e-2, 1.263e-2, 7.342e-3, 4.243e-3, 2.183e-3, 1.310e-3, 6.784e-4 | no band | info |
| L1 p, N=100…6400 | 1.217e-2, 7.307e-3, 4.363e-3, 2.564e-3, 1.461e-3, 8.414e-4, 4.699e-4 | no band | info |
| observed orders ρ (6 pairs) | 0.655, 0.650, 0.660, 0.671, 0.651, 0.658 | reviewer: in [0.5, 1.05] | yes |
| observed orders u / p | 0.74–0.96 / 0.74–0.84 | reviewer: ≥ 0.5 | yes |
| Einfeldt vs Davis L1 ρ | within 0.4 % at every N | — | info |
| mass drift (max over 14 runs) | 2.8e-15 rel | 0.5625, 1e-12 | yes |
| momentum vs 0.9t = 0.18 | 1.5e-15 rel | 1e-12 | yes |
| energy drift | 2.6e-15 rel vs 1.375 | 1e-12 (see reference defect below) | yes |
| min ρ / min p over all steps | 0.125 / 0.1 | > 0 | yes |
| realized CFL | 0.9000 | ≤ 1 | yes |
| C = 1.0, N=400 | stable, positive, L1 ρ 5.69e-3 | info | — |
| ρ*L at N=400 | 0.42479 (−0.36 %) | 0.42632 ± 2 % | yes |
| ρ*R | 0.265567 (1e-5 rel) | 0.26557 ± 2 % | yes |
| p* (two reads) | 0.303119 / 0.303165 (≤ 1.2e-4 rel) | 0.30313 ± 2 % | yes |
| u* (two reads) | 0.927563 / 0.927575 (≤ 1.3e-4 rel) | 0.92745 ± 2 % | yes |
| shock x, N=200 | 0.85067 (err 2.4e-4) | 0.85043 ± 0.01 | yes |
| contact x, N=200 | 0.68218 (err 3.3e-3) | 0.68549 ± 0.01 | yes |
| rarefaction head x, N=200 | 0.25919 (err 4.2e-3) | 0.26336 ± 0.01 | yes |
| **rarefaction tail x, N=200** | **0.50302 (err 1.71e-2)** | 0.48595 ± 0.01 | **no** |
| tail error, other locators, N=200 | LSQ 0.0166 / 0.0168 / 0.0176; max curvature 0.0216 | ± 0.01 | no |
| tail error, N=400 / 800 (LSQ) | 0.0093–0.0101 / 0.0051–0.0056 | info | — |
| fitted fan slope du/dx, N=200 / 400 / 800 | 3.82 / 3.98 / 4.07 | exact 4.167 | info |
| contact width (cells), N=200 / 400 / 1600 | HLLC 14 / 18 / 36 vs LF 26 / 38 / 72 | HLLC sharper | yes |
| shock width (cells) | HLLC 2 vs LF 4–6 | — | info |
| L1 ρ ratio HLLC/LF | 0.46 / 0.44 / 0.42 | — | info |
| stationary contact, N=200 | max error 0 (exact) | HLLC property | yes |
| modified Sod L1 ρ, N=100 / 400 | 1.354e-2 / 5.778e-3 | 0.019 / 0.0081 | info (pass) |

Notes:
- The L1 ρ values agree to 4 digits with the researcher's scratch Godunov-HLLC calibration (1.475e-2 / 9.366e-3 / 5.970e-3). The method therefore behaves exactly like the scheme the bands were calibrated on.
- The HLLC flux formula in the method matches the clawpack form: S*, U*_K = ρ_K(S_K−u_K)/(S_K−S*)·[1, S*, E/ρ + (S*−u)(S* + p/(ρ(S_K−u)))]. The isolated stationary contact stays exact, which is the HLLC contact-restoring property.
- The tail error comes from the first-order corner smearing at the weak discontinuity, plus the known start-up slope deficit inside the fan: the fitted slope is 3.82 against 4.17 at N = 200. The error converges at roughly order 0.85, from 0.017 to 0.0094 to 0.0052.

## Classification rationale

- 14 of 15 gaps are within tolerance. The conservation, stability/positivity and contact-resolution checks pass.
- One gap fails: the rarefaction-tail position at N = 200 is off by 0.0171, against a tolerance of 0.01.
  - Every locator I tried exceeds the tolerance (0.0166–0.0216). The failure therefore does not come from my choice of locator.
  - I did not loosen the tolerance.
  - The reference phrases its tolerance for jumps ("steepest gradient / midpoint of jump", "~2 cells at N=200"). Applied to a kink, it is strict for any first-order scheme. That is a statement about the method class, not a defect.
- Under §6, any gap that exceeds its tolerance gives **flagged**.
- Not fixable: I have no evidence of an implementation defect.
  - L1 matches an independent scratch implementation to 4 digits.
  - The HLLC formula matches the open clawpack form.
  - Conservation holds to round-off.
  - The stationary contact is exact.
  - The error converges with N.
  - The failing quantity is inherent first-order dissipation. A second-order method (muscl-hancock) is the right tool if the tail position must be within 2 cells at N = 200.

## Reference defect found

`sod-totals` (references/sod.js) states energy(t) = 2.75. Its own derivation, 0.5·pL/(γ−1) + 0.5·pR/(γ−1) = 0.5·2.5 + 0.5·0.25, gives **1.375**. The 2.75 figure leaves out the half-domain widths, which the mass value 0.5625 does include. Against 2.75, any correct scheme shows a 50 % "drift". I tested against the value recomputed from the initial data (1.375) with the reference's own 1e-12 tolerance, and I report the raw comparison in the JSON. The researcher should fix this. I did not edit the reference.

## Missing / caveats

1. The L1 bands are unpublished BrowserLab engineering bands, set at about 1.4× the researcher's scratch errors (research/hyp.md §4: no open L1 tables were found).
2. The experiment quantity names L1 in u and p, but no tolerance exists for either. They are reported with orders only.
3. toro2009, toro1994hllc, einfeldt1988 and sod1978 are verified:false (secondary copies). The exact solution and star values rest on open sources: zingale-cha and sodshock2015 (verified:true).
4. The wave-position band (0.01) and the plateau band (2 %) are engineering choices. No locator is prescribed for kinks.
5. The convergence window [0.5, 1.05] is my own criterion.
6. The sod-totals energy value is wrong; see above.
