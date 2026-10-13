# Review: stormer-verlet @ kepler-e06

Reviewer: reviewer-pilot, round 1, 2026-10-13. I did not write `methods/stormer-verlet.js` and did not modify any method or reference file.
Check script: `node verification/checks/stormer-verlet@kepler-e06.check.js` (runs in about 0.2 s and prints JSON).
Result: `verification/results/stormer-verlet@kepler-e06.js`, **status: matched**.

## Protocol

- Scene `kepler`, e = 0.6, standard ICs q0 = (0.4, 0), p0 = (0, 2), H0 = -1/2, L0 = 0.8, T = 2π.
- The method was used only through its public API: `create`, `step`, `probe('state'|'invariants')`, `setParam('h')`, `diverged`.
- Ground truth: `kepler-exact-solution`, the analytic Kepler-equation solution tested in `research/test-kepler-exact.js`.
- The metrics follow `references/kepler.js`:
  - dH = max over the run of |H_n − H0|.
  - err = |y_N − y_exact(N h)|, the Euclidean norm over (q, p).
  - p_obs = log2(m(h)/m(h/2)).
  - k = log(m(t2)/m(t1)) / log(t2/t1).
- Order runs: t_end = 10.5T (apocentre), N = round(t_end/h), h = 1e-2, 5e-3, 2.5e-3. Sensitivity runs at 10T (pericentre) are information only.
- Growth runs: h = 1e-2, t1 = 10.5T and t2 = 40.5T, plus a log-log fit over 10.5, 20.5, 40.5, 80.5 and 160.5 periods.
- Long run: h = 1e-2 for 1000 periods (628,319 steps).
  - I took the per-period maximum of |dH|/|H0| and fitted a least-squares slope to it.
  - Comparison baseline: a non-symplectic Heun (RK2) integrator, coded in the check, at the same h for 100 T.
- Large h, for information only: h = 0.05, 0.1 and 0.2 for 100 periods.
- Reversibility: N steps at +h, then `setParam('h', -h)` and N more steps, then compare with y0. Störmer–Verlet is symmetric, so Φ₋ₕ = Φₕ⁻¹, and this test is equivalent to flipping the momenta.

## Raw numbers

| quantity | value | reference / tol | pass |
|---|---|---|---|
| \|H(y0)−H0\|, \|L(y0)−L0\| | 0, 0 | kepler-H0/L0, 1e-14 | yes |
| energy order, h 1e-2→5e-3 (dH 3.707e-4 → 9.263e-5) | 2.0006 | kepler-order-energy-stormer-verlet, 2 ± 0.3 | yes |
| energy order, 5e-3→2.5e-3 (→ 2.316e-5) | 2.0001 | same | yes |
| global order, 1e-2→5e-3 (err 5.553e-2 → 1.389e-2) | 1.9995 | kepler-order-global-stormer-verlet, 2 ± 0.3 | yes |
| global order, 5e-3→2.5e-3 (→ 3.472e-3) | 2.0000 | same | yes |
| global growth k, 10.5T→40.5T (err 0.0555 → 0.2144) | 1.0007 | kepler-growth-global-stormer-verlet, 1 ± 0.3 | yes |
| global growth, LSQ fit 10.5T..160.5T (err 0.0555 … 0.868) | 1.007 | info | — |
| energy growth k, 10.5T→40.5T (dH 3.70681e-4 both) | 1.8e-8 | kepler-growth-energy-stormer-verlet, 0 ± 0.3 | yes |
| max \|L−L0\| (all runs, up to 1000T) | 6.8e-14 | kepler-L-conservation, 1e-12 | yes |
| 1000T: per-period max \|dH\|/\|H0\| range | 7.41356e-4 … 7.41361e-4 | bounded | yes |
| 1000T: envelope slope | −2.2e-13 per period (−3e-7 of mean over run) | reviewer criterion < 5 % | yes |
| 1000T: first-100 vs last-100 max | 7.413613e-4 vs 7.413613e-4 | last ≤ 1.05 × first | yes |
| Heun baseline, same h, 100T | slope 2.0e-4 per period, 1.8e-3 → 2.2e-2 | contrast | — |
| whole-period (10T) orders: energy, global (two pairs) | 2.0006, 1.977, 1.998 | info | — |
| reversibility \|y−y0\|, N = 6597 / 62832 | 1.3e-11 / 2.4e-10 | round-off (< 1e-9, reviewer) | yes |
| large h, 100T: rel. max dH at h = 0.05 / 0.1 / 0.2 | 1.9e-2 / 7.8e-2 / 0.51 | info, no NaN, L conserved < 1.4e-14 | — |

Notes:
- With the a = 1 normalisation, dH ≈ 3.7 h², which is consistent with O(h²).
- At h = 0.2 the step is coarse relative to the pericentre passage (r = 0.4, speed 2). The energy error reaches half of |H0|, but it stays bounded and the method does not diverge. The orbit phase is lost: the global error is O(1).
- The reversibility test and the large-h runs have no source criterion. They are recorded as structural checks and information.

## Classification rationale

- All 8 quantitative gaps are inside their tolerances, most by more than two orders of magnitude.
- The conservation checks pass: energy is bounded with no drift, and L is conserved to round-off.
- The method is stable at every h tried.
- The ground truth is an exact analytic solution, tested independently.
- The theoretical values are 2, 2, 1 and 0, plus exact conservation of L. These are standard results for the Störmer–Verlet scheme, and the cited open (free-to-read) sources state them.
- The source-access limitation affects only the *locations* (section and theorem numbers). It does not affect the reference values, so the values are not under-determined.

That fits §6 **matched**, not *incomplete*. The verified:false status is recorded in `missing`. I did not loosen any tolerance. The only criteria I set myself are the long-run drift test and the reversibility threshold. Both are documented, and both pass by many orders of magnitude.

## Missing / caveats

1. Every source is `verified: false` with search-snippet access only. This covers hlw2003 Sec. 4–5 and hlw2006 Thm IX.8.1 / Sec. X.3, which are recollection-level citations.
2. No numeric values were extracted from HLW figures, so there is no comparison against published amplitudes.
3. The order and growth protocols are the researcher's pilot choices, not source protocols.
4. The long-run drift threshold (5 %) is set by the reviewer.
5. If full-text access changes any cited claim or protocol, this experiment should be reviewed again.
