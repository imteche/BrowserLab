# Review: symplectic-euler @ kepler-e06

Reviewer: reviewer-symplectic-euler-kepler-e06-r1, round 1, 2026-10-13. I did not write `methods/symplectic-euler.js` and did not modify any method, reference or core file.
Check script: `node verification/checks/symplectic-euler@kepler-e06.check.js` (about 0.6 s, prints JSON).
Result: `verification/results/symplectic-euler@kepler-e06.js`, **status: matched**.

## Protocol

- Scene `kepler`, e = 0.6, q0 = (0.4, 0), p0 = (0, 2), H0 = -1/2, L0 = 0.8, T = 2π.
- Method used only through its public API (`create`, `step`, `probe('state'|'invariants')`, `diverged`). Variant: p first (kick with F(q_n)), then q (drift with p_{n+1}).
- Ground truth: `kepler-exact-solution` (analytic Kepler-equation solution).
- Metrics as in `references/kepler.js`: dH = max |H_n − H0|; err = |y_N − y_exact(N h)| over (q, p); p_obs = log2(m(h)/m(h/2)); k = log(m(t2)/m(t1))/log(t2/t1).
- Order runs (`kepler-order-*-symplectic-euler`): t_end = 10.5T (half period, apocentre, as required to avoid the superconvergence artefact), h = 5e-4, 2.5e-4, 1.25e-4.
- Growth runs (`kepler-growth-*-symplectic-euler`): h = 1e-3, whole periods t1 = 10T, t2 = 40T; plus LSQ fit over 10, 20, 40, 80, 160T, and half-period samples for information.
- Long runs: 1000 periods at h = 1e-3 (6.28e6 steps) and h = 1e-2; per-period max |dH|/|H0|, LSQ slope.
- Diagnostics: Runge–Lenz angle (precession direction) at the Hairer figure protocol (h = 0.05, 4000 steps) and at h = 1e-3 for 40T; large h = 0.05/0.1/0.2 for 100T; first step vs the stated update formula.

The full published protocol runs well inside the time budget, so no reduced version was needed.

## Raw numbers

| quantity | value | reference / tol | pass |
|---|---|---|---|
| \|H(y0)−H0\|, \|L(y0)−L0\| | 0, 0 | kepler-H0/L0, 1e-14 | yes |
| energy order, h 5e-4→2.5e-4 (dH 6.802e-4 → 3.394e-4) | 1.0027 | kepler-order-energy-symplectic-euler, 1 ± 0.3 | yes |
| energy order, 2.5e-4→1.25e-4 (→ 1.696e-4) | 1.0013 | same | yes |
| global order at 10.5T, 5e-4→2.5e-4 (err 2.952e-3 → 1.543e-3) | 0.9361 | kepler-order-global-symplectic-euler, 1 ± 0.3 | yes |
| global order, 2.5e-4→1.25e-4 (→ 7.884e-4) | 0.9689 | same | yes |
| global growth k, 10T→40T, h = 1e-3 (err 1.0568e-2 → 4.2261e-2) | 0.9998 | kepler-growth-global-symplectic-euler, 1 ± 0.3 | yes |
| global growth, LSQ 10..160T (err up to 0.1686) | 0.9991 | info | — |
| energy growth k, 10T→40T (dH 1.36540e-3 both) | 8.1e-9 | kepler-growth-energy-symplectic-euler, 0 ± 0.3 | yes |
| max \|L−L0\| (all runs) | 1.69e-13 | kepler-L-conservation, 1e-12 | yes |
| 1000T, h = 1e-3: envelope range / slope | 2.730789e-3 … 2.730799e-3 / −2.3e-15 per period | reviewer < 5 % | yes |
| 1000T, h = 1e-2: envelope max / slope | 2.918e-2 / −4.2e-11 per period (−1.4e-6 of mean) | reviewer < 5 % | yes |
| whole-period (10T) global order, h 1e-3..2.5e-4 | 2.000, 2.000 | info (documented artefact) | — |
| half-period err at 10.5T / 40.5T / 160.5T, h = 1e-3 | 5.4e-3 / 2.8e-3 / 1.2e-2 | info (offset hides growth) | — |
| LRL angle, h = 0.05, 4000 steps | −0.260 rad (clockwise) | hairer1999notes snippet: clockwise | diag. |
| LRL angle, h = 1e-3, 40T | −2.6e-4 rad (clockwise) | — | diag. |
| large h 100T: rel. max dH at 0.05 / 0.1 / 0.2 | 0.19 / 0.53 / 2.27 | info, no NaN, L < 6e-15 | — |
| first step vs p-first formula | 6.9e-18 | — | yes |

Notes:
- dH ≈ 1.37 h (relative 2.73 h), i.e. O(h), bounded, consistent with the method summary.
- At h = 0.2 the pericentre (r = 0.4, speed 2) is unresolved: the energy error exceeds |H0|, but there is no NaN. The method's own stability note says h must resolve pericentre passage, so this is not a failure of a stated criterion.
- The whole-period order of 2 and the non-monotone half-period error reproduce the pitfall documented in research/ode.md, which supports the researcher's choice of sampling.

## Classification rationale

All 8 quantitative gaps are inside their reference tolerances (the largest deviation, global order 0.936, is 0.064 from theory against ±0.3, and moves toward 1 at the finer pair, 0.969, as expected for pre-asymptotic contamination). Energy is bounded with no drift at two step sizes over 1000 periods, L is conserved to round-off, and no run diverged. The ground truth is an exact analytic solution. The reference values (order 1, bounded O(h) energy error, linear error growth, exact L) are standard, uncontested theory; the verified:false status affects source locations, not the values. This is §6 **matched**. No tolerance was loosened; the only reviewer-set criterion is the long-run drift test (same as the stormer-verlet review), passed by many orders of magnitude.

## Missing / caveats

1. All sources are `verified: false`: hairer1999notes, hairer2010week2, blanes2008splitting are search-snippet only; hlw2006 is a paywalled secondary copy. Theorem/section locations are unverified.
2. No published numeric amplitudes were extracted, so there is no comparison against figure/table numbers.
3. The variant used in the Hairer precession figure is unconfirmed; the clockwise agreement is diagnostic only.
4. Order and growth protocols are the researcher's pilot choices, not source protocols.
5. The 5 % long-run drift threshold is reviewer-set.
