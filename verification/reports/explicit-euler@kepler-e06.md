# Review: explicit-euler @ kepler-e06

Reviewer: reviewer-explicit-euler-kepler-e06-r1, round 1, 2026-10-13. I did not write `methods/explicit-euler.js` and did not modify any method, reference or `js/` file.
Check script: `node verification/checks/explicit-euler@kepler-e06.check.js` (about 3 s, prints JSON).
Result: `verification/results/explicit-euler@kepler-e06.js`, **status: matched**.

## Protocol

- Scene `kepler`, e = 0.6, standard ICs q0 = (0.4, 0), p0 = (0, 2), H0 = -1/2, L0 = 0.8, T = 2π.
- Method used only through its public API: `create`, `step`, `probe('state'|'invariants')`, `diverged`.
- Ground truth: `kepler-exact-solution` (analytic, tested by `research/test-kepler-exact.js`).
- Metrics as in `references/kepler.js`: dH = max |H_n − H0|; err = |y_N − y_exact(N h)| over (q, p); p_obs = log2(m(h)/m(h/2)); k = log(m(t2)/m(t1))/log(t2/t1).
- Order runs (published protocol): t_end = T, h = 1e-4 and 5e-5; extra pair 5e-5 → 2.5e-5 for information. t_end = T rather than 10T because explicit Euler error is O(1) after 10 periods (research/ode.md pitfall 2).
- Growth runs (published protocol): h = 1e-6, t1 = T, t2 = 4T, 25,132,741 steps; samples at 1–4T for a log-log fit.
- Secular drift: H(nT) − H0 for n = 1..20 at h = 1e-4 and 5e-5 (linear fit in n, monotonicity, rate ∝ h). h = 1e-3 is information only.
- Angular momentum: per-step identity L_{n+1} − L_n = h² p_n × F(q_n) over one period at h = 1e-3; |L − L0| scaling with h.
- Hairer figure protocol (qualitative): h = 5e-4 (inferred), t = 200.
- Everything published ran at full size; no reduction was needed.

## Raw numbers

| quantity | value | reference / tol | pass |
|---|---|---|---|
| \|H(y0)−H0\|, \|L(y0)−L0\| | 0, 0 | kepler-H0/L0, 1e-14 | yes |
| energy order, h 1e-4→5e-5 (dH 2.149e-3 → 1.103e-3) | 0.9625 | kepler-order-energy-explicit-euler, 1 ± 0.3 (pilot 0.96) | yes |
| energy order, 5e-5→2.5e-5 (→ 5.585e-4) | 0.9816 | same | yes |
| global order, 1e-4→5e-5 (err 0.1396 → 0.0699) | 0.9976 | kepler-order-global-explicit-euler, 1 ± 0.3 (pilot 1.00) | yes |
| global order, 5e-5→2.5e-5 (→ 0.0350) | 0.9993 | same | yes |
| global growth k, T→4T, h = 1e-6 (err 1.399e-3 → 2.239e-2) | 1.9999 (fit 1–4T: 1.9999) | kepler-growth-global-explicit-euler, 2 ± 0.3 | yes |
| energy growth k, T→4T (dH 2.261e-5 → 9.032e-5) | 0.9989 (fit 0.9989) | kepler-growth-energy-explicit-euler, 1 ± 0.3 | yes |
| drift h = 1e-4, 20T: slope / r² / total | 2.04e-3 per T / 0.9976 / 0.0398 | reviewer: monotone, r² ≥ 0.99 | yes |
| drift h = 5e-5, 20T: slope / r² / total | 1.08e-3 per T / 0.99989 / 0.0215 | same | yes |
| drift rate / h, ratio (1e-4 vs 5e-5) | 20.4 / 21.6, ratio 0.945 | 1 ± 0.3 (O(h t)) | yes |
| drift h = 1e-3, 20T (info) | total 0.212, r² 0.953, last/first increment 0.004 | info only | — |
| max \|L−L0\| over T, h = 1e-4/5e-5/2.5e-5 | 9.5e-4 / 4.8e-4 / 2.4e-4 | not conserved (kepler-L-conservation) | yes |
| residual of L_{n+1}−L_n − h² p×F, h = 1e-3, 1 period | 2.9e-16 (step change up to 1.25e-5) | round-off | yes |
| Hairer figure, h = 5e-4, t = 200 | H−H0 = +0.189, min signed 0, final r = 2.35 | spirals outward | yes |
| large h info, 10T: h = 0.01 / 0.05 | H−H0 = 0.350 / 0.474, r = 2.11 / 21.8, no NaN | info | — |

Notes:
- The energy error is always ≥ 0 and grows monotonically, so the orbit spirals outward. This is the expected behaviour for this method, not a defect.
- dH ≈ 21.5 h per period, so the drift is O(h t).
- With a = 1 normalisation, the error at t = T is err ≈ 1400 h, which is consistent with first order.

## Classification rationale

- All 8 quantitative gaps are inside their tolerances. The worst is the energy order, 0.963, which matches the researcher's pilot value of 0.96.
- "Conservation" for this method means behaving as the theory says:
  - Energy drifts secularly: linear in t and in h, and the energy-growth exponent is 1.00.
  - L is not conserved, and it changes by exactly the discrete identity of the stated scheme. That identity is also evidence that the implementation is faithful.
- There is no NaN or divergence in any run, up to 25M steps.
- I wrote the secular-drift criterion myself. My first draft also required rate-∝-h agreement at h = 1e-3, and it failed (ratio 0.48). I traced this to that run leaving the small-drift regime:
  - By 20T the energy has drifted 42 % of |H0|.
  - The orbital period therefore changes, so sampling at multiples of 2π is no longer phase-locked to pericentre. The per-period increments collapse to 0.4 % of the first.
  - I replaced it with the pair h = 1e-4 / 5e-5, where the drift stays below 8 % of |H0|, and kept h = 1e-3 as information.
  - This is a choice of a regime where linear theory applies, not a loosened tolerance. The 0.3 tolerance is the reference's own order tolerance.
- §6 says **matched**, following the same reasoning as stormer-verlet@kepler-e06: the reference values are standard, uncontested theory, and the ground truth is an independently tested exact solution. The verified:false status is recorded in `missing`.

## Missing / caveats

1. Every cited source (hlw2006, hairer1999notes, blanes2008splitting) is `verified: false`, with search-snippet access only. The section and table locations are unverified.
2. No numeric values were taken from the Hairer figures or table, so there is no comparison against published amplitudes.
3. The order and growth protocols are the researcher's pilot choices. The figure step h = 5e-4 is inferred, not read.
4. The secular-drift criterion is set by the reviewer.
5. If full-text access changes any cited claim or protocol, this experiment should be reviewed again.
