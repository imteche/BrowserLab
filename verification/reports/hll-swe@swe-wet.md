# Review: hll-swe @ swe-wet

Reviewer: reviewer-hll-swe-swe-wet-r1, round 1, 2026-10-13. I did not write `methods/hll-swe.js` and did not modify any method, reference or js file.
Check script: `node verification/checks/hll-swe@swe-wet.check.js` (about 2 s, prints JSON).
Result: `verification/results/hll-swe@swe-wet.js`, **status: matched**.

## Protocol

- Scene `swe-dambreak`, experiment `swe-wet`: hl = 0.005 m, hr = 0.001 m, x0 = 5 m, L = 10 m, g = 9.81, t = 6 s (SWASHES 4.1.1 set-up as registered).
- Method defaults: CFL 0.9, hDry 1e-12, transmissive ghost cells; the method clips its last step onto t = 6 (every run landed exactly).
- N = 100, 200, 400, 800, 1600, 3200, 6400. Only the public API was used (`create`, `step`, `probe`, `metrics`, `diverged`).
- Ground truth: `swe-dambreak-stoker` (exact Stoker profile, corrected c_m equation). Exact waves at t = 6: rarefaction head x_A = 3.6712, tail x_B = 4.8167, shock x_C = 6.2598 m; h_m = 0.0025393571723 m, u_m = 0.12728 m/s, shock speed 0.209963 m/s.
- Reference sanity: I re-derived h_m independently by bisection of the 1-rarefaction integral curve against the 2-shock Hugoniot locus. It agrees with the reference to round-off (rel diff 0) and with the orchestrator value 0.0025393571723 to its print precision (6.6e-12). The shock speed equals the RH mass speed and the RH momentum residual is 0.
- Metrics:
  - relL1(h) = Σ|h_i − h_ex(x_i)| dx / Σ h_ex(x_i) dx at cell centres (the form behind the reference bands). A cell-average variant is reported as info.
  - Plateau: the cell nearest the middle of [x_B, x_C].
  - Shock: linear-interpolated crossing of h = (h_m + h_r)/2.
  - Mass vs x0 hl + (L−x0) hr = 0.03 m²; momentum vs g/2 (hl² − hr²) t (`swe-dambreak-totals`, 1e-12). Both are checked at every step.
  - Energy E = ∫(hu²/2 + g h²/2) dx. With u = 0 at both ends there is no boundary energy flux, so E must not increase.

## Raw numbers

| N | steps | relL1(h) | relL1(h) cell-avg | relL1(u) | h_m rel err | u_m rel err | shock err [m] (cells) | max mass drift | max mom err |
|---|---|---|---|---|---|---|---|---|---|
| 100 | 19 | 1.359e-2 | 1.164e-2 | 9.25e-2 | 6.0e-3 | 4.4e-3 | −0.0066 (−0.07) | 8.1e-16 | 4.7e-16 |
| 200 | 38 | 7.548e-3 | 7.036e-3 | 5.46e-2 | 1.71e-3 | 4.0e-3 | −0.0077 (−0.15) | 9.3e-16 | 7.4e-16 |
| 400 | 76 | 4.326e-3 | 3.940e-3 | 3.15e-2 | 7.47e-4 | 2.37e-3 | −0.0061 (−0.25) | 1.8e-14 | 9.5e-16 |
| 800 | 152 | 2.542e-3 | 2.421e-3 | 1.75e-2 | 4.04e-4 | 1.25e-3 | −0.0040 (−0.32) | 2.7e-14 | 1.1e-15 |
| 1600 | 304 | 1.497e-3 | 1.356e-3 | 1.02e-2 | 2.05e-4 | 6.6e-4 | −0.0026 (−0.42) | 4.3e-14 | 1.9e-15 |
| 3200 | 608 | 7.879e-4 | 7.677e-4 | 5.34e-3 | 1.03e-4 | 3.4e-4 | −0.0015 (−0.48) | 1.1e-13 | 2.8e-15 |
| 6400 | 1216 | 4.347e-4 | 4.328e-4 | 2.92e-3 | 5.1e-5 | 1.8e-4 | −0.0009 (−0.57) | 2.6e-13 | 3.8e-15 |

- Observed relL1(h) orders: 0.85, 0.80, 0.77, 0.76, 0.93, 0.86. For u: 0.76, 0.80, 0.85, 0.77, 0.94, 0.87.
- Shock 10–90 % width: 2–3 cells at every N.
- Energy: the exact loss by t = 6 is 0.696 % of E0. The numerical loss is 1.583 %, 1.217 %, 0.998 %, 0.869 %, 0.794 %, 0.751 % and 0.726 % for N = 100 … 6400. The excess over exact falls from 8.9e-3 to 3.0e-4 at about order 0.8. E was non-increasing at every step of every run.
- Stability: no NaN or divergence. Realized CFL is 0.9000 (criterion C ≤ 1). min h = 0.001 m = h_r, so there is no undershoot. There were 0 negative-depth clips.
- Mass drift grows from 8e-16 to 2.6e-13 with N × steps. That is consistent with summation round-off. It stays inside 1e-12.

## Gaps vs tolerances

| quantity | value | tolerance | pass |
|---|---|---|---|
| relL1(h) N=200 | 7.548e-3 | 0.0126 (engineering band) | yes |
| relL1(h) N=400 | 4.326e-3 | 0.0073 (engineering band) | yes |
| h_m N=200 / 400 / 800 | 1.71e-3 / 7.47e-4 / 4.04e-4 | 1 % (swe-stoker-hm-swashes) | yes |
| u_m N=400 | 2.37e-3 | 1 % (reviewer, mirrors h_m) | yes |
| min L1(h) order | 0.764 | reviewer window [0.5, 1.05] | yes |
| mass drift | 2.6e-13 | 1e-12 (swe-dambreak-totals) | yes |
| momentum vs g/2(hl²−hr²)t | 3.8e-15 | 1e-12 | yes |
| shock position N=200 / 400 / 800 | 0.0077 / 0.0061 / 0.0040 m | 1 dx (reviewer) | yes |

## Classification rationale

- All 12 gaps are within tolerance. The conservation, energy-monotonicity, positivity and CFL checks pass.
- The reference value is the exact Riemann solution for the stated data. It was re-derived independently twice, so the source-access caveats do not leave it under-determined.
- That fits §6 **matched**.
- No tolerance was loosened. The L1 values reproduce the researcher's scratch HLL calibration (7.548e-3 / 4.326e-3) to 4 digits. The L1 pass therefore confirms consistency with that calibration, not with a published number.
- The method is first order and smears the shock over 2–3 cells. It sits slightly behind the exact shock (0.07–0.57 cell, shrinking in metres as N grows). It over-dissipates energy by 0.5 % of E0 at N = 200. All of this is expected and converges.

## Missing / caveats

- `swashes2013` is verified:false (secondary copy). The PDF was unreachable, and the formulas were read in tilupy, whose c_m equation is wrong. The corrected equation is re-derived from riemannbook2020, and I confirmed it independently. Which form SWASHES prints was not checked.
- Stoker h_r = 0.001 m and t = 6 s come from researcher recollection. The comparison is exact for the stated configuration. Whether it is literally SWASHES 4.1.1 is unverified.
- `stoker1957` was not read (verified:false).
- The L1 depth bands are unpublished BrowserLab engineering bands. `swe-stoker-hm-swashes` is computed, not published.
- No reference tolerance exists for u(x) L1, shock position or energy. The shock criterion (≤ 1 dx), the u_m 1 % band and the order window are reviewer criteria.
