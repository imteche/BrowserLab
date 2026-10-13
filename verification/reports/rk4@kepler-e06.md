# rk4 @ kepler-e06 — reviewer report (round 1)

Reviewer: reviewer-rk4-kepler-e06-r1 (did not build `methods/rk4.js`). Date: 2026-10-13.
Check: `node verification/checks/rk4@kepler-e06.check.js` (JSON on stdout, under 1 s wall time).
Result record: `verification/results/rk4@kepler-e06.js`. **Status: matched.**

## Protocol

Scene `kepler`, e = 0.6, q0 = (0.4, 0), p0 = (0, 2), H0 = -1/2, L0 = 0.8, T = 2π. Metrics follow `references/kepler.js`:
dH = max_n |H(y_n) − H0|; err = |y_N − y_exact(t_N)| (Euclidean over q, p; exact solution from `kepler-exact-solution`);
p_obs = log2(m(h)/m(h/2)); k = log(m(t2)/m(t1))/log(t2/t1).

| test | reference | published protocol |
|---|---|---|
| energy order | `kepler-order-energy-rk4` (4 ± 0.3) | t_end = 10.5T, h = 1.25e-3 → 6.25e-4 |
| global order | `kepler-order-global-rk4` (4 ± 0.3) | same |
| global growth | `kepler-growth-global-rk4` (2 ± 0.3) | h = 1e-2, 40T → 160T |
| energy growth | `kepler-growth-energy-rk4` (1 ± 0.3) | h = 1e-2, 40T → 160T |
| angular momentum | `kepler-L-conservation` (rk4 = not conserved; tol 1e-12) | all runs |

The full published protocol runs in well under the time budget. Extra runs for information only: h = 5e-3, 2.5e-3, 3.125e-4, 1.5625e-4 at 10.5T; a 640T run at h = 1e-2 sampled at pericentre and apocentre; 100T at h = 0.02, 0.05, 0.1.
There is also a faithfulness check: the module is compared with an independent inline classical-tableau RK4.

## Raw numbers

Order runs (t_end = 10.5T):

| h | N | dH | err | max abs(L − L0) |
|---|---|---|---|---|
| 5e-3 | 13195 | 5.58e-9 | 6.47e-7 | 6.3e-10 |
| 2.5e-3 | 26389 | 2.37e-10 | 3.34e-8 | 2.0e-11 |
| **1.25e-3** | 52779 | 1.13e-11 | 1.87e-9 | 6.0e-13 |
| **6.25e-4** | 105558 | 6.24e-13 | 1.12e-10 | 2.7e-14 |
| 3.125e-4 | 211115 | 6.06e-14 | 6.58e-12 | 1.4e-14 |
| 1.5625e-4 | 422230 | 5.06e-14 | 3.15e-12 | – |

Observed orders:

| pair | energy | global |
|---|---|---|
| 5e-3 → 2.5e-3 (pre-asymptotic, info) | 4.557 | 4.274 |
| 2.5e-3 → 1.25e-3 (info; pilot 4.39) | 4.389 | 4.159 |
| **1.25e-3 → 6.25e-4 (published; pilot 4.22 / 4.09)** | **4.181** | **4.068** |
| 6.25e-4 → 3.125e-4 (info) | 3.363 (round-off floor) | 4.084 |

Growth at h = 1e-2:

| t | err (pericentre) | dHmax | t | err (apocentre) |
|---|---|---|---|---|
| 10T | 1.08e-4 | 1.36e-7 | 10.5T | 1.39e-5 |
| 40T | 1.24e-3 | 4.62e-7 | 40.5T | 1.33e-4 |
| 160T | 1.79e-2 | 1.77e-6 | 160.5T | 1.78e-3 |
| 640T | 0.276 | 6.99e-6 | 640.5T | 2.71e-2 |

* Published global growth (40T → 160T): **k = 1.925** (pilot 1.92). Energy growth: **k = 0.968** (pilot 0.97).
* Info: LSQ over 40T..640T gives k = 1.952 (global) and 0.981 (energy). Apocentre 10.5T → 40.5T gives k = 1.67, and 40.5T → 160.5T gives 1.89. This confirms the research/ode.md note that quadratic growth appears only after about 40T.
* Angular momentum at h = 1e-2: 7.7e-8 (40T), 3.1e-7 (160T), 1.24e-6 (640T). It grows linearly (k = 1.000). As the reference says, it is not conserved.

Faithfulness: module vs inline RK4 after 2000 steps at h = 1e-2: abs diff = 2.1e-13; sim.t = N·h.

Large h (100T, info): relative max energy error 7.0e-5 (h = 0.02), 6.8e-3 (0.05), 0.23 (0.1). No NaN. The energy decays (H_end = −0.615 at h = 0.1).

## Classification rationale

All six gaps are within the reference tolerances, and none was loosened: the two orders, the two growth exponents, L non-conservation as the reference states it, and the initial invariants. The measured values sit within 0.04 of the researcher's pilot values.
Under CONTRACTS §6 this is **matched**. Energy conservation does not apply as a pass criterion for RK4. The reference expects an O(h⁴t) drift, and the check measures it.

The only off-tolerance number is the energy order on (6.25e-4, 3.125e-4): 3.36. That pair is outside the published protocol.
The value comes from the double-precision floor. dH has already reached about 6e-14, and the h/8 run gives 5.1e-14 instead of the factor-16 drop that truncation would produce. The global error at the same step sizes is above the floor and still shows order 4.08. This is not a method defect, so it is recorded as an information check (n/a) and not as a gap.

I followed the stormer-verlet@kepler-e06 precedent: matched is allowed even though every source is `verified:false`. The claims rest on standard, uncontested theory, checked against an independently tested exact solution.
The source-access caveats are listed below. They would justify downgrading if a full-text reading contradicted a cited claim.

## Missing / caveats

* Every cited source is `verified:false`:
  * kutta1901: secondary or textbook copy only.
  * hairer1997varsymp: search snippet only; DOI from recollection.
  * hlw2006: paywalled; initial conditions taken from secondary copies.
* There are no published numeric values (for example HLW figure amplitudes for RK4 on Kepler) to compare against.
* The protocols (h, t_end, 40T/160T sampling) are the researcher's pilot choices, not source protocols.
* The linear-stability bound |hλ| ≤ 2.83 in the method file is unsourced and was not tested.
