# Review: muscl-hancock @ sod-t02

Reviewer: reviewer-muscl-hancock-sod-t02-r1, round 1, 2026-10-13. I did not write `methods/muscl-hancock.js` and did not modify any method or reference file.
Check script: `node verification/checks/muscl-hancock@sod-t02.check.js` (about 6 s; prints JSON).
Result: `verification/results/muscl-hancock@sod-t02.js`, **status: flagged**.

## Protocol

- Scene `sod`: γ = 1.4, x0 = 0.5, (ρ,u,p) = (1,0,1) | (0.125,0,0.1), domain [0,1], transmissive boundaries, compared at t = 0.2. Every run lands exactly on t = 0.2.
- Method defaults: minmod limiter, slopes in conserved variables, HLLC with Davis speeds, CFL 0.9. Variants run as info: van Leer, primitive-variable slopes, Einfeldt speeds.
- Resolutions: N = 100, 200 and 400 (banded), then 800–6400 for convergence.
- Only the public API is used: `create`, `step`, `metrics`, `probe`, `diverged`.
- Ground truth: `sod-exact-profile`, an exact Riemann solver.
- L1(q) = Σ|q_cell − q_exact(x_centre)| dx for ρ, u and p. Observed order = log2(L1(N)/L1(2N)).
- Sod smooth-window L1: the same sum, restricted to cells farther than 0.04 (fixed) from the rarefaction head, rarefaction tail, contact and shock.
- Smooth-data tests: genuinely smooth problems run through the same evolution kernel.
  - The method accepts only Riemann data. The check therefore evaluates an in-memory copy of the method file with one line appended after the initial-condition loop body. That line is an optional hook that overwrites the cell averages.
  - `step`, `predictor` and `hllc` are byte-identical to the original, and the file on disk is unchanged.
  - Test 1: entropy wave ρ = 1 + 0.5·exp(−((x−0.4)/0.05)²) with u = p = 1.
  - Test 2: isentropic right-running simple wave, u0 = 0.1·exp(−((x−0.3)/0.08)²), c = 1 + 0.2u, ρ = c⁵. The exact solution follows from characteristics. The wave breaks at t ≈ 0.78, after the comparison time t = 0.2.
  - Cell averages use 5-point Gauss quadrature. N = 50–1600.
- Plateaus: I read the cell nearest the middle of each exact plateau at N = 400, with the 1 % band that the reference NOTE gives for second order.
- Wave positions at N = 200, tolerance 0.01:
  - Shock: where p crosses (p*+pR)/2.
  - Contact: where ρ crosses (ρ*L+ρ*R)/2.
  - Rarefaction head and tail: a least-squares line fitted to u in the fan, intersected with u = 0 and u = u*.
- Oscillations: total variation TV(q) compared with the exact TV (ρ 0.875, u 2u*, p 0.9), global over/undershoot beyond the exact range, and the location of the extrema.
- Conservation: compared with `sod-totals` at relative tolerance 1e-12. Energy is tested against 1.375 because the reference value of 2.75 is wrong; see below.
- Structural check: with limiter = 2 the method must equal the repository's first-order `hllc-godunov`.
- **Reviewer criteria fixed before running.** These come from the protocol hints and are not published tolerances:
  - overall L1 order in [0.6, 1.2];
  - smooth-region order ≥ 1.7 on the finest two pairs;
  - TV excess ≤ 1 % and over/undershoot ≤ 1 % of the jump, for N = 100–1600.

## Raw numbers

| quantity | value | reference / tol | pass |
|---|---|---|---|
| L1 ρ, N=100 / 200 / 400 | 6.5806e-3 / 3.5807e-3 / 1.9973e-3 | engineering bands 0.0095 / 0.0052 / 0.0029 | yes |
| L1 ρ, N=800…6400 | 1.155e-3, 6.552e-4, 3.855e-4, 2.213e-4 | — | info |
| L1 u, N=100…6400 | 1.049e-2, 5.513e-3, 2.758e-3, 1.545e-3, 6.130e-4, 3.900e-4, 1.507e-4 | no band | info |
| L1 p, N=100…6400 | 4.901e-3, 2.502e-3, 1.236e-3, 6.456e-4, 3.139e-4, 1.616e-4, 7.724e-5 | no band | info |
| overall orders ρ | 0.88, 0.84, 0.79, 0.82, 0.77, 0.80 | [0.6, 1.2] | yes |
| overall orders u / p | 0.65–1.37 (non-monotone) / 0.94–1.07 | ≥ 0.6 | yes |
| Sod smooth-window orders ρ | 1.29, 1.06, 0.99, 1.00, 1.01, 0.99 | ≥ 1.7 | **no** |
| fan-interior order ρ (window 0.04 or 0.08), N=400→6400 | 0.95–1.01 (Godunov: 0.70–0.81) | — | info |
| entropy wave orders, minmod | 1.51, 1.57, 1.59, 1.83, 1.89 | ≥ 1.7 (finest two) | yes |
| entropy wave orders, van Leer | 1.73, 2.04, 2.04, 2.10, 2.11 | ≥ 1.7 | yes |
| entropy wave max u, p deviation | ≤ 1e-14 | — | info |
| simple wave orders, minmod | 1.43, 1.78, 1.85, 1.93, 1.91 | ≥ 1.7 | yes |
| simple wave orders, van Leer | 1.86, 1.93, 2.05, 2.04, 2.00 | ≥ 1.7 | yes |
| mass drift (max, 7 runs) | 5.9e-16 rel | 0.5625, 1e-12 | yes |
| momentum vs 0.9t | 2.0e-15 rel | 1e-12 | yes |
| energy drift | 4.7e-15 rel vs 1.375 | 1e-12 | yes |
| min ρ / min p, all steps | 0.125 / 0.1 | > 0 | yes |
| realized CFL / fallback cells | 0.9000 / 0 | ≤ 1 | yes |
| C = 1.0, N=400 | stable, L1 ρ 2.04e-3 | info | — |
| ρ*L / ρ*R at N=400 | 0.426247 (1.7e-4) / 0.265564 (2.4e-5) | ± 1 % | yes |
| p* / u* at N=400 (worse read) | 1.2e-5 / 4.1e-5 rel | ± 1 % | yes |
| shock / contact / head / tail, N=200 | errors 1.8e-4 / 1.4e-3 / 2.5e-3 / 5.8e-3 | 0.01 | yes |
| tail locator robustness, N=200 | LSQ 5.6–6.0e-3; max-curvature 0.0116 (noisy) | — | info |
| TV excess ρ/u/p, N=100 | 1.38 / 1.55 / 1.31 % | ≤ 1 % | **no** |
| N=200 | 1.10 / 1.38 / 1.10 % | ≤ 1 % | **no** |
| N=400 | 0.89 / 1.14 / 0.96 % | ≤ 1 % | **no** (u) |
| N=800 | 0.70 / 1.02 / 0.76 % | ≤ 1 % | **no** (u) |
| N=1600 | 0.63 / 0.84 / 0.70 % | ≤ 1 % | yes |
| u overshoot above u*, N=100 / 200 / 400 / 800 / 1600 | 1.31 / 1.04 / 0.78 / 0.60 / 0.46 % | ≤ 1 % | **no** at N ≤ 200 |
| ρ, p outside exact global range | 0 | — | yes |
| limiter=2 vs hllc-godunov | max diff 1.4e-15 (N=100), 7.3e-15 (N=400) | round-off | yes |
| contact width (cells), N=200/400/1600 | MUSCL 6 / 8 / 13 vs Godunov 14 / 18 / 36 | sharper | yes |
| L1 ρ MUSCL / Godunov | 0.38 / 0.33 / 0.28 | — | info |
| variants L1 ρ N=100/200/400: van Leer (cons.) | 5.39e-3 / 2.78e-3 / 1.52e-3; TV ρ excess 2.5 / 1.9 / 1.4 % | — | info |
| minmod (prim.) | 6.31e-3 / 3.40e-3 / 1.91e-3; TV ρ excess 1.8 / 1.5 / 1.2 % | — | info |
| minmod + Einfeldt | 6.49e-3 / 3.53e-3 / 1.98e-3; TV ρ excess 1.13 / 0.92 / 0.72 %; u overshoot 0.95 % | — | info |
| modified Sod L1 ρ, N=100 / 400 | 6.800e-3 / 2.398e-3 | 0.0095 / 0.0034 | info (pass) |

Where the non-monotone features are:
- The largest u overshoot sits just right of the rarefaction tail. Its distance from the exact tail is 0.039 at N=100, 0.013 at N=400 and 0.004 at N=1600. It is a single bump, not a train.
- The only other extrema are ripples of order 1e-4 relative in the star region and near the shock.
- ρ undershoots ρ*L by about 1.3 % at the tail at N=100, but stays within the global exact range.

## Classification rationale

Every reference tolerance passes:
- L1 ρ is within the second-order bands, and matches the researcher calibration to 4 digits.
- Plateaus are within 1 %.
- Wave positions are within 0.01.
- Conservation is within 1e-12.
- Positivity holds and the method stays within its CFL criterion.

The implementation also passes two checks of faithfulness:
- With limiter = 2 it reduces exactly to the repository's first-order HLLC.
- On genuinely smooth data the same kernel is second order: 1.9 with minmod, 2.0–2.1 with van Leer, for both a linearly degenerate wave and a genuinely nonlinear one.

Two reviewer criteria fail. I fixed both before seeing the results and did not relax them afterwards:
1. **Oscillation / TV.** There is a single overshoot of u at the rarefaction tail: 1.31 % of u* at N = 100, falling slowly to 0.46 % at N = 1600. TV(u) excess stays above 1 % up to N = 800. This is a small overshoot, not an oscillation train. The hint allows a "small overshoot", but my operational limit of 1 % is exceeded. It is plausibly inherent to limiting with minmod on conserved variables (characteristic limiting is not implemented). Einfeldt speeds reduce it but do not remove it; van Leer and primitive limiting make it larger.
2. **Smooth-region order on Sod.** Away from all waves, the L1 order is ≈ 1.0, and the error is dominated by the fan interior, which is smooth there. The same kernel gives order 2 on smooth data. So this is not a truncation-order defect. I attribute it, without proof, to the O(dx) start-up error of the centred fan, which spreads through the self-similar fan.

Per §6, a failed check means **flagged**. `fixable` is false: I found no evidence of an implementation defect or an unfaithful discretization.

## Missing / caveats

- The L1 bands are unpublished BrowserLab engineering bands (~1.4× researcher scratch errors), so the L1 pass reproduces the researcher's calibration, not a literature table. There is no band for L1 in u or p.
- These are reviewer criteria, not published tolerances: the 1 % TV/overshoot limit, the ≥ 1.7 smooth-order limit and the [0.6, 1.2] overall-order window.
- The following sources are verified:false (snippets or recollection; originals not read): toro2009 (Sec. 14.4 MUSCL-Hancock, CFL bound, Davis speeds), toro1994hllc, vanleer1979 (van Leer limiter formula), einfeldt1988, ader2023 (half-step formula) and sod1978. The exact solver and the star and wave values rest on the open sources zingale-cha and sodshock2015 (verified:true).
- The smooth-data tests are not part of the published sod-t02 protocol. They use an in-memory copy of the method with one IC hook line.
- The start-up explanation for the order-1 error in the fan interior is reasoning, not a cited result.
- **Reference defect, still open:** `sod-totals` gives energy 2.75; the correct value is 1.375.
