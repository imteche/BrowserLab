# lbm-d2q9 @ cyl-2d2 — review round 1

Reviewer: reviewer-lbm-d2q9-cyl-2d2-r1 (not the builder) · 2026-10-13 · **Status: flagged**

Check script: `verification/checks/lbm-d2q9@cyl-2d2.check.js` (five runs as parallel child processes, 480 s wall on a shared 4-core machine; prints JSON).
Record: `verification/results/lbm-d2q9@cyl-2d2.js`.

## Protocol

- Scene `cylinder`, DFG 2D-2: Re = 100, Um = 1.5 m/s, Ubar = 1 m/s, nu = 1e-3, D = 0.1, channel 2.2 x 0.41, cylinder at (0.2, 0.2).
- Method: D2Q9 BGK, halfway bounce-back walls, moving-wall bounce-back parabolic inlet, Zou-He rho = 1 outlet (replaces the benchmark's do-nothing outflow), momentum-exchange forces. Start from the inflow profile everywhere (method default).
- Integrate to T_end = 10 s. Analysis window = last 4 s (t in [6, 10], about 12 shedding periods; frequency resolution ~1/(12 P) is far below 3 % of f).
- St = D f / Ubar from upward zero crossings of C_L - mean(C_L), linear interpolation between steps. Raw C_L zero crossings also reported.
- max C_D, max C_L: raw per-step maxima over the window (the reference definition). Per-period maxima for periodicity; a moving average over P/100 to measure acoustic noise.
- dp (information only): pressure_drop probe half a period after a C_L maximum.
- Tolerances from the references, unchanged: St rel 3 %, max C_D rel 3 %, max C_L rel 5 %, dp rel 4 %. Gaps are taken against the refined FeatFlow values (`value`). In-range against the 1996 intervals is reported as information.
- Conservation (open domain, so total mass is not an invariant). Reviewer bounds: (i) mass stationarity, |mean M over the last 2 periods - over the first 2 periods| / M0 < 1e-4; (ii) period-averaged volume flux balance |Q_out - Q_in| / Q_in < 1 %; (iii) Q_in within 1 % of Ubar H = 0.41.
- Stability (method's criteria): no NaN, tau > 1/2 (the method says tau >~ 0.51–0.55 in practice), Mach < ~0.3. Mach is judged over the window. The start-up pressure-wave peak is reported separately.

| run | res (cells/D) | Ulat (Um) | ibb | tau | grid | steps | result |
|---|---|---|---|---|---|---|---|
| A | 20 | 0.1 | 0 | 0.54 | 440 x 82 | 24 450 | **NaN at t = 8.15 s** |
| B | 20 | 0.1 | 1 | 0.54 | 440 x 82 | 20 400 | **NaN at t = 6.8 s** |
| C | 30 | 0.1 | 0 | 0.56 | 660 x 123 | 45 000 | stable to 10 s |
| D | 30 | 0.1 | 1 | 0.56 | 660 x 123 | 45 000 | stable to 10 s, mass drifting |
| E | 20 | 0.05 | 0 | 0.52 | 440 x 82 | 34 800 | **NaN at t = 5.8 s** |

Run A uses the method defaults (apart from Re = 100). The method notes recommend res >= 20 at Re = 100.

res 40 to 10 s was not run. It needs 60 000 steps on 144 k nodes, about 11 min single-core at ~13 MLUPS, which is over the budget.

## Raw numbers

### res 30 (window t in [6, 10] s)

| quantity | C: staircase | gap | D: ibb | gap | reference | tol |
|---|---|---|---|---|---|---|
| St | 0.29756 | −1.42 % ✓ | 0.30052 | −0.44 % ✓ | 0.30184 [0.295, 0.305] | 3 % |
| max C_D | 3.37236 | +4.49 % ✗ | 3.28565 | +1.81 % ✓ | 3.227393 [3.22, 3.24] | 3 % |
| max C_L | 1.04894 | +6.32 % ✗ | 0.98564 | −0.09 % ✓ | 0.986571 [0.99, 1.01] | 5 % |
| dp (info) | 2.4939 | +0.37 % | 2.4986 | +0.56 % | 2.4848 [2.46, 2.50] | 4 % |
| mean C_D / mean C_L | 3.3167 / −0.0182 | | 3.2292 / −0.0201 | | | |
| min C_L | −1.0834 | | −1.0232 | | | |

- **Periodicity:** period spread 0.08 % (C) and 0.13 % (D). Per-period max C_L spread 0.31 % / 0.23 %. Per-period max C_D spread 0.33 % / 0.22 %. The two halves of the window agree to < 0.03 % in St and < 0.3 % in the maxima.
- **Acoustic noise:** rms(signal − P/100 moving average) is 3.7e-5 for C_D and 1.2e-4 for C_L. Smoothed maxima are within 2e-4 of the raw maxima, so the max values are not inflated by noise.
- **Mach:** 0.260 (C) and 0.259 (D) over the window. The start-up peak at t = 0.05 s is 0.3004 (impulsive start).
- **Mass stationarity:** 7.5e-5 for C (pass) and 7.5e-4 for D (fail). For D, (M − M0)/M0 rises from 1.16e-3 to 2.28e-3 inside the window.
- **Volume flux:** Q_in = 0.4061 for both (−0.95 % vs 0.41). Q_out − Q_in is +0.99 % for C and +1.06 % for D, against the 1 % bound.

### res 20 divergence diagnostic (A settings, max |u| tracked every 0.25 s)

- **t ≤ 5.0 s:** max |u| ≈ 2.2 m/s at the cylinder shoulders (x ≈ 0.19 m), Mach ≈ 0.25. (M − M0)/M0 sits at 1–2e-3 and starts creeping up: 2.1e-3 at 4.0 s, 3.6e-3 at 5.0 s.
- **t = 5.25 s:** the location of max |u| jumps to the last column, x = 2.198 m (the Zou-He outlet), and stays there.
- **5.25 → 8.0 s:** Mach at the outlet climbs 0.27 → 0.30 → 0.35 → 0.44 → 0.70. Over the same interval (M − M0)/M0 grows monotonically 4.4e-3 → 1.2e-2 → 3.4e-2 → 0.12.
- **t = 8.25 s:** NaN.

C_D and C_L at the cylinder stay plausible (C_D 3.0–3.5, |C_L| ≈ 1) until shortly before the blow-up. The instability comes in from the outlet; it does not start at the cylinder.

## Classification

**flagged** (CONTRACTS §6: a check fails, and gaps exceed tolerance).

1. **Stability fails at the published settings.** The method defaults (res 20, Ulat 0.1, tau 0.54) are inside the stated tau band and Mach limit, and the method notes recommend res >= 20 at Re = 100. These runs diverge within 10 s with both cylinder treatments. Halving the Mach number (Ulat 0.05) diverges sooner, because tau drops to 0.52.
2. **Staircase accuracy at res 30 is out of tolerance:** max C_D +4.5 % (tol 3 %) and max C_L +6.3 % (tol 5 %). This is consistent with the reference rationale (coarse staircase LBM overshoots drag by about 3 % even at 20 cells/D in the vortexlab run). It is a first-order geometry error, not a defect.
3. **The best configuration (res 30 + interpolated bounce-back) meets all three tolerances,** but its domain mass is not stationary. The drift matches the precursor of the res 20 blow-up, so the 10 s result cannot be called a converged periodic state. Whether it eventually diverges was not tested (budget).

No tolerance was loosened. The one reviewer choice that changes a verdict concerns Mach: the method's Mach criterion is applied over the analysis window, not to the 0.3004 start-up spike. Judging on the spike would only add another failure.

**Evidence for an implementation-level cause (fixable).** The blow-up starts at the outlet column, with monotonic mass injection before any NaN. That outlet is the builder's fixed-density Zou-He condition, used in place of the benchmark's do-nothing outflow (method assumptions). A fixed-density (reflecting) outlet is a known weak point when vortices cross it at low tau. A convective or extrapolation outflow, a sponge layer, or regularised outlet populations are standard remedies. The staircase drag/lift excess is inherent to the default boundary (ibb = 1 removes it).

## Missing

- `schafer1996` is `verified:false`: the original is paywalled and was not read. The 1996 intervals come from three MIT-licensed copies (`copy-vortexlab-dfg`, `copy-adelowo-dfg`, `copy-karman-dfg`, all `verified:true`) that agree exactly. Table 4 numbering is unverified.
- `featflow-dfg` is `verified:false`: the site was unreachable. The refined values used as gap targets were extracted by third parties from the official time series.
- The LBM sources were not read in full. The Zou-He outlet formulas were derived by the builder (I checked the signs against the standard right-boundary form, and they are correct). Bouzidi interpolated bounce-back is not a registered source.
- Not run, because of the budget: res 40, and horizons longer than 10 s to see whether the res 30 runs eventually diverge.
- The criteria for mass stationarity, flux balance and window Mach are reviewer-set.
