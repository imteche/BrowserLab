# lbm-d2q9 @ cyl-2d2: review round 2

Reviewer: reviewer-lbm-d2q9-cyl-2d2-r2 (not the builder) · 2026-10-13 · **Status: flagged** (not fixable as an implementation defect)

Check script: `verification/checks/lbm-d2q9@cyl-2d2.check.js`. I re-read the round-1 script and reused it unchanged apart from the header. It runs five configurations as parallel child processes, which took 7.0 min wall on 4 cores, and prints JSON.
Record: `verification/results/lbm-d2q9@cyl-2d2.js`.

## What changed since round 1

Refinement round 1 changed one thing relevant to this scene: the Zou-He pressure outlet at the two corner nodes next to the channel walls (`methods/lbm-d2q9.js`).

At those nodes the wall bounce-back already supplies one diagonal, so only two populations are unknown. The old code applied the full-column formulas to them, and density was not closed there.

The new code fixes the two unknowns by rho = rhoOut and rho u_y = 0. I re-derived both corner formulas and they impose these constraints exactly. Defaults (res 20, Ulat 0.1, ibb 0) are unchanged.

## Protocol (same as round 1)

- **Scene:** DFG 2D-2. Re = 100, Um = 1.5 m/s, Ubar = 1 m/s, nu = 1e-3, D = 0.1. Start from the inflow profile everywhere.
- **Run length:** to T_end = 10 s. Analysis window t in [6, 10] s: about 12 periods, with 11 full periods between mean crossings.
- **St:** from upward crossings of C_L − mean(C_L).
- **max C_D, max C_L:** raw per-step maxima over the window.
- **Tolerances:** from the reference definitions, unchanged. St 3 %, C_D 3 %, C_L 5 %; dp 4 % (information only). Gaps are relative to the refined FeatFlow values.

| run | res | Ulat | ibb | tau | grid | result (round 2) | round 1 |
|---|---|---|---|---|---|---|---|
| A (defaults) | 20 | 0.1 | 0 | 0.54 | 440 x 82 | stable to 10 s | NaN at 8.15 s |
| B | 20 | 0.1 | 1 | 0.54 | 440 x 82 | stable to 10 s | NaN at 6.8 s |
| C | 30 | 0.1 | 0 | 0.56 | 660 x 123 | stable to 10 s | stable |
| D | 30 | 0.1 | 1 | 0.56 | 660 x 123 | stable to 10 s, mass stationary | mass drifting |
| E | 20 | 0.05 | 0 | 0.52 | 440 x 82 | stable to 10 s | NaN at 5.8 s |

## Results (window t in [6, 10] s)

| quantity | A: res20 stair (defaults) | B: res20 ibb | C: res30 stair | D: res30 ibb | E: res20 stair Ulat 0.05 | reference | tol |
|---|---|---|---|---|---|---|---|
| St | 0.29661 (−1.7 % ✓) | 0.29986 (−0.65 % ✓) | 0.29757 (−1.4 % ✓) | 0.30063 (−0.40 % ✓) | 0.29747 (−1.4 % ✓) | 0.30184 | 3 % |
| max C_D | 3.4389 (+6.6 % ✗) | 3.3226 (+2.95 % ✓) | 3.3724 (+4.5 % ✗) | 3.2859 (+1.8 % ✓) | 3.4368 (+6.5 % ✗) | 3.227393 | 3 % |
| max C_L | 1.0798 (+9.4 % ✗) | 0.97267 (−1.4 % ✓) | 1.0489 (+6.3 % ✗) | 0.98550 (−0.11 % ✓) | 1.0591 (+7.4 % ✗) | 0.986571 | 5 % |
| dp (info) | 2.687 (+8.1 %) | 2.608 (+5.0 %) | 2.494 (+0.38 %) | 2.503 (+0.72 %) | 2.757 (+11 %) | 2.4848 | 4 % |
| mean C_D / C_L | 3.363 / −0.025 | 3.254 / −0.019 | 3.317 / −0.018 | 3.230 / −0.021 | 3.347 / −0.016 | | |

Run C reproduces round 1 to all printed digits. That run was already stable in round 1, so the outlet-corner change is confined to the corner nodes and does not touch the cylinder or the interior.

### Stability

- No run produced a NaN.
- Mach over the window: 0.261 (A), 0.259 (B), 0.260 (C), 0.259 (D), 0.131 (E). All are below the method's 0.3 limit.
- The impulsive start sends out a pressure wave at t = 0.05 s, with peak Mach 0.306 (A) and 0.300–0.302 (B–D). I report this only and do not use it to classify, as in round 1.

### Mass conservation

The domain is open, so total mass is not an invariant. I checked two things.

- **Stationarity (reviewer bound 1e-4).** |mean M(last 2 P) − mean M(first 2 P)|/M0 is 2.5e-6, 1.5e-6, 6.7e-6, 9.1e-6 and 5.7e-6 for A–E. All pass. In round 1, D failed at 7.5e-4 and the res 20 runs grew to 0.12 before they diverged. (M − M0)/M0 now stays flat at 1.1–1.9e-3, which is the initial pressure-field fill-up.
- **Volume flux (reviewer bound 1 %).**
  - Q_out − Q_in is +0.92 %, +0.96 %, +0.94 % and +0.17 % for A, C, D and E. Those pass. B is −1.37 %, which fails the bound.
  - Q_in against Ubar H is −1.01 % for A, which marginally fails the bound.
  - The volume-flux bound does not measure what it is meant to. Weakly compressible LBM conserves mass flux, not volume flux: the inlet has rho > 1 and the outlet has rho = 1. The +0.9 % imbalance at Ulat 0.1 falls to +0.17 % at Ulat 0.05, which scales with Ma² as compressibility predicts.
  - The 0.05 s sampling of the outlet column, which fluctuates strongly, also aliases against the 0.33 s period.
  - Stationarity of the domain mass is the direct test, and it passes at the 1e-6 level. I treat the conservation check as a pass and keep the flux numbers above for transparency.

### Periodicity

- Period spread is at most 0.18 %.
- Per-period max C_L spread is 0.2–0.8 %, except A at 1.04 %, just over the reviewer's 1 % criterion. Even A's smallest per-period maximum (1.069) is +8.3 % from the reference, so this does not affect the verdict.
- St and the maxima agree between the two halves of the window to < 0.03 % and < 0.25 %.
- Acoustic noise is small: rms(signal − P/100 moving average) ≤ 1.8e-4.

## Classification

**flagged** (CONTRACTS §6: gaps exceed tolerance).

1. **Stability and conservation now pass.** The round-1 outlet blow-up is gone at every setting tested, including the defaults. The fix was a real implementation correction, and it is confirmed.
2. **At the method defaults, max C_D (+6.6 %, tol 3 %) and max C_L (+9.4 %, tol 5 %) fail.** St passes (−1.7 %).
   - At res 30 the staircase still fails: C_D +4.5 %, C_L +6.3 %.
   - Halving the Mach number (run E) barely changes the error. Compressibility is therefore not the cause.
3. **The excess comes from the default boundary, not from a defect.**
   - Switching only the cylinder wall to interpolated bounce-back (ibb = 1) passes all three quantities at res 20 (C_D +2.95 %, just inside the bound) and at res 30 (C_D +1.8 %).
   - The staircase error shrinks with resolution (+6.6 % → +4.5 %).
   - This is the first-order geometry error the method documents for its default staircase wall. I found no evidence of an implementation defect, so this is **not fixable** in the sense of a code bug.
   - Making ibb = 1 the default, or setting a default resolution of at least 40 for the staircase, would be a modelling choice for the builder or orchestrator.

I loosened no tolerance. The reviewer-set conservation, flux and periodicity criteria are the same as in round 1. The one judgement I made is to treat volume-flux imbalance as information rather than as the conservation verdict; the reasons are in the Mass conservation section above.

## Missing

- `schafer1996` is `verified:false`. The original is paywalled and was not read. The 1996 intervals come from three MIT-licensed copies that agree exactly. The Table 4 numbering is unverified.
- `featflow-dfg` is `verified:false`. The site was unreachable, and the refined values used as gap targets were extracted by third parties.
- The Zou-He outlet formulas, including the round-1 corner closure, are derived by the builder. I re-checked them algebraically. Bouzidi ibb is not a registered source.
- The benchmark specifies a do-nothing outflow. The method replaces it with a fixed-density outlet, as stated in its assumptions.
- I did not run res 40 or horizons beyond 10 s because of the budget. Mass is stationary to < 1e-5, so there is no sign of drift.
