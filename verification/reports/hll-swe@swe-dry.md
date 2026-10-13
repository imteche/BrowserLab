# Review: hll-swe @ swe-dry

Reviewer: reviewer-hll-swe-swe-dry-r1, round 1, 2026-10-13. I did not write `methods/hll-swe.js` and did not modify any method, reference or `js/` file.
Check script: `node "verification/checks/hll-swe@swe-dry.check.js"` (about 2 s, prints JSON).
Result: `verification/results/hll-swe@swe-dry.js`, **status: flagged**.

## Protocol

- Experiment `swe-dry` (js/scenes.js): scene `swe-dambreak`, hl = 0.005 m, hr = 0, x0 = 5 m, L = 10 m. Reference `swe-dambreak-ritter` at t = 6 s, plus `swe-dambreak-totals`.
- Method defaults otherwise: g = 9.81, CFL = 0.9, hDry = 1e-12, transmissive ends. Every run lands exactly on t = 6.
- N = 100, 200, 400, 800, 1600, 3200, 6400. This is the full protocol, and more, well within the time budget.
- I used only the public API: `create`, `step`, `metrics`, `probe('profile'|'totals')`, `diverged`.
- Metrics:
  - relL1(h) = Σ|h_i − h_ex(x_i)|dx / Σ h_ex(x_i)dx at cell centres. This is the metric of the reference tolerance.
  - Front: the right face of the last cell with h > 1e-6·hl, as the reference suggests. I also used 1e-3·hl and 1e-2·hl. The front is compared with x_B = x0 + 2t√(g hl) = 7.6577 m, and also with the exact position where h_ex equals the threshold.
  - Mass is compared with x0·hl = 0.025. Momentum is compared with g/2·hl²·t = 7.3575e-4. Both waves stay inside the domain: x_A = 3.671 and x_B = 7.658.
  - Positivity is min h over every step. Clip count and realised CFL are also recorded.
- Sensitivity (information): at N = 400, C = 1.0 and C = 0.5, and hDry = 0 and 1e-8. Momentum against hDry at N = 200.
- Independent check: I wrote a separate first-order HLLE in the check script. It uses the clawpack `shallow_hll_1D` / riemannbook formulas: Einfeldt/Roe speeds, dry-front speed u ± 2c, and no dry threshold.

## Raw numbers

| N | steps | relL1(h) | front − x_B [m] (cells) | mass rel | momentum rel | E/E0 − 1 | min h | clips |
|---|---|---|---|---|---|---|---|---|
| 100 | 23 | 1.936e-2 | −0.458 (−4.6) | 4e-16 | 0 | −1.85e-2 | 0 | 0 |
| 200 | 47 | 1.165e-2 | −0.508 (−10.2) | 4e-16 | 3.1e-11 | −1.09e-2 | 0 | 0 |
| 400 | 99 | 6.809e-3 | −0.433 (−17.3) | 8e-16 | 4.7e-11 | −6.34e-3 | 0 | 0 |
| 800 | 206 | 4.017e-3 | −0.358 (−28.6) | 1.5e-15 | 7.1e-11 | −3.64e-3 | 0 | 0 |
| 1600 | 425 | 2.364e-3 | −0.283 (−45) | 7.5e-15 | 9.0e-11 | −2.07e-3 | 0 | 0 |
| 3200 | 872 | 1.375e-3 | −0.220 (−70) | 1.1e-14 | 9.9e-11 | −1.16e-3 | 0 | 0 |
| 6400 | 1778 | 7.901e-4 | −0.170 (−109) | 2.0e-14 | 1.07e-10 | −6.47e-4 | 0 | 0 |

- relL1(h) orders: 0.73, 0.77, 0.76, 0.77, 0.78, 0.80. Front-lag orders in metres: about 0.23 to 0.37. L1(u) orders: about 0.35 (information).
- Gaps against tolerances:
  - relL1 at N = 200 is 1.165e-2 against 0.017: **pass**.
  - relL1 at N = 400 is 6.809e-3 against 0.010: **pass**.
  - The front lag at N = 200 is 0.508 m against a 5-cell band of 0.25 m: **fail**.
  - The front lag at N = 400 is 0.433 m against 0.125 m: **fail**.
  - Mass: 2e-14 against 1e-12: **pass**.
  - Momentum: 1.07e-10 against 1e-12: **fail**.
  - Positivity: min h = 0: **pass**.
- Other front thresholds give the same lag. At N = 200 the lag is −0.66 m at 1e-3·hl and −0.71 m at 1e-2·hl. Against the exact position where h_ex equals the threshold, the lags are −0.50, −0.53 and −0.31 m.
- Rarefaction head (h < hl(1 − 1e-6)): it leads x_A by 0.87, 0.72, 0.52 … 0.14 m, because of smearing. This is information only.
- Stability: no NaN and no divergence. Realised CFL is 0.9000. C = 1.0 is also positive (relL1 6.69e-3) and so is C = 0.5 (7.52e-3). Energy decreases monotonically in every run.
- Independent HLLE: relL1 matches the method to 1e-12 at N = 200, 400 and 1600. The step counts (47, 99, 425) are identical, and so are the front positions to the cell. Its momentum error is 1e-15 because it has no dry threshold.
- Momentum against hDry at N = 200:

  | hDry | momentum error |
  |---|---|
  | 0 | 0 |
  | 1e-15 | 1.3e-14 |
  | 1e-12 (the default) | 3.1e-11 |
  | 1e-10 | 2.7e-9 |
  | 1e-8 | 4.8e-7 |

  The cause is `if (hn <= hDry) qn = 0` in `step()`. Discharge is deleted in near-dry cells at the front.
- The researcher's scratch HLL gave 1.146e-2 and 6.771e-3. The method's values differ from these by 1.6% and 0.6%.

## Classification rationale

The front-position gap fails, and so does the momentum gap. Under CONTRACTS §6 that makes the status **flagged**.

1. **Front lag (main finding).** The numerical dry front lags the exact Ritter front by 10 cells at N = 200 and 17 cells at N = 400. The band is "several cells"; I took 5. A 10-cell band would still fail at N = 400. The lag shrinks in metres only at order about 0.35, and it keeps growing when counted in cells.

   The mechanism is visible in the step count. At N = 200 the scheme takes 47 steps, and the front can advance at most one cell per step. The exact front crosses 53 cells. The computed u + 2c in the smeared front cells is below 2√(g hl), so the CFL step and the numerical front speed are both too small.

   The independent HLLE reproduces this exactly. So the lag is inherent to first-order HLLE with the u ± 2c dry speed. It is not an implementation defect. As the protocol hint expects, it is reported, not hidden.
2. **Momentum.** The default dry threshold zeroes hu where h ≤ 1e-12. That is a small non-conservative momentum sink, at most 1e-10 relative, against the 1e-12 tolerance. It is negligible physically, but it is a real departure from conservation, and it goes away with hDry = 0. The method documents the zeroing as an assumption. I did not loosen the tolerance.
3. Everything else passes:
   - L1 depth is well within the first-order bands, with order about 0.75.
   - Mass is exact to 2e-14.
   - Positivity holds with zero clips, so the method's HLLE positivity claim is confirmed.
   - The scheme is stable up to C = 1.

The source caveats would by themselves argue for **incomplete**. The bands are unpublished, the SWASHES PDF is unreachable, and t = 6 s comes from recollection. But the Ritter solution is closed-form and classical, and a failing check outranks those caveats. Hence the status is flagged, not incomplete.

Fixability:
- The front lag cannot be fixed without changing the method class. It would need second-order reconstruction or a dedicated front treatment.
- The momentum sink is a concrete, fixable implementation detail. Use a default hDry = 0, or redistribute the zeroed momentum conservatively. Fixing it would not change the verdict, which the front lag drives.

## Missing / caveats

- swashes2013 is verified:false: the arXiv/HAL copies were unreachable, and the formulas were read in tilupy `Ritter_dry`. The ritter1892 original was not read.
- The set-up (hl = 0.005, x0 = 5, L = 10) comes from search snippets of swashes2013 and fullswof2014, both verified:false. The time t = 6 s comes from recollection.
- The L1 bands are BrowserLab engineering bands, about 1.4× the researcher's scratch errors, not literature numbers.
- There is no numeric front tolerance in the reference. The 5-cell band is my own reading.
- There is no tolerance for u(x). L1(u) is information only.
- The hll1983 and einfeldt1988 originals were not read. I checked the scheme against an independent re-implementation built from open formulas.
