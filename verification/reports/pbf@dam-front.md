# pbf @ dam-front — review round 1

Reviewer: reviewer-pbf-dam-front-r1 (not the builder) · Date: 2026-10-13 · Status: **matched**

Check script: `verification/checks/pbf@dam-front.check.js`. It takes about 6–7 minutes single-threaded and prints JSON.

## Protocol

- **Scene:** `dam-break`. The column is a × 2a with a = 0.05715 m (2.25 in, the Martin & Moyce case) and g = 9.81. All method defaults were used: h = 2dx, CFL 0.3, 4 iterations, ε/S0 = 0.01, k = 0.001, |Δq| = 0.3h, n = 4, XSPH c = 0.01, unilateral constraint, no vorticity confinement.
- **Units:** Z = front/a, T = t·√(2g/a).
- **Primary reference:** `dam-break-mm-front-lethe`, using its 13 points with 0 < T ≤ 3.
  - The suggested check is max |Z_sim − Z_ref| ≤ 0.25 after one time shift dT in [0, 0.25].
  - The shift delays the simulation, so Z_sim(T − dT) is compared with Z_ref(T). It was searched in steps of 0.005.
  - The unshifted error is also reported.
- **Secondary reference:** `dam-break-mm-front-a225`. It was run in an extended 12a tank at nx = 40.
  - It is scored over 0 < T ≤ 3, the reference's stated window.
  - Points up to T = 6.82 are reported for information only.
- **Ritter bound:** `dam-break-ritter-front-bound`, Z ≤ 1 + 2T, checked at every step.
- **Resolution:** nx = 20, 40 and 80, i.e. 800, 3200 and 12 800 particles. The primary run is nx = 80, the largest that fits the time budget.
- **Iteration sensitivity:** iters = 1, 2, 4, 8 and 16, all at nx = 40.
- **Conservation:**
  - Mass must be exact.
  - Energy must not increase, since the physical problem only dissipates. The criterion is max (E − E0)/E0 ≤ 1e-3; this is my choice as reviewer.
  - Momentum is n/a because of the walls and gravity.
- **Stability:** no NaN, and max |v|dt ≤ h/2 = dx, which is the method's stated criterion.

## Raw numbers

### Front vs Lethe copy, 0 < T ≤ 3, default 4 iterations

| nx | steps | dt [s] | Z(1) | Z(2) | Z(3) | unshifted max\|dZ\| | best dT | shifted max\|dZ\| |
|---|---|---|---|---|---|---|---|---|
| 20 | 407 | 4.05e-4 | 1.453 | 2.530 | 3.938 | 0.226 | 0.13 | 0.060 |
| 40 | 814 | 2.02e-4 | 1.510 | 2.575 | 4.001 | 0.285 | 0.19 | 0.072 |
| 80 | 1627 | 1.01e-4 | 1.512 | 2.632 | 4.050 | 0.343 | 0.20 | **0.073** |

Pointwise residuals at nx = 80 with dT = 0.20 range from −0.073 (at T = 0.41) to +0.072. Without the shift, the simulation leads the data by 0.15–0.34 for T ≥ 0.84. The reference anticipates this: "expect ~0.3 extra error near T = 1–2" from gate-opening delay.

### Other quantities

- **PySPH a = 2.25 in series, T ≤ 3** (nx = 40, 12a tank): max |dZ| = 0.018 at dT = 0.24. Unshifted it is 0.325.
- **Late time, information only:** up to T = 6.82, max |dZ| = 0.313 at dT = 0.25, which is the edge of the allowed shift. Unshifted it is 0.78.
  - The two exceedances are at T = 4.03 (0.313) and T = 6.31 (0.311).
  - The datum at T = 4.03 implies a local slope of 2.44 to the next point, which exceeds the Ritter speed. It is probably digitisation scatter.
  - The fitted late slope dZ/dT over T = 5.1–6.85 is 1.84 for the simulation and 1.79 for the data.
- **Ritter bound:** max (Z − 1 − 2T) is −0.015, −0.0075 and −0.0037 at nx = 20, 40 and 80. These maxima occur at the first step. The bound is never exceeded.
- **Mass:** the drift is exactly 0.
- **Energy:**
  - Max (E − E0)/E0 is −1.3e-5, −3.2e-6 and +1.3e-6 at nx = 20, 40 and 80.
  - E at T = 3 is 4.5%, 3.0% and 2.0% below E0, so dissipation falls with resolution.
  - The extended run loses 11% by T = 9.4.
- **Stability:** there was no NaN in any run. max |v|dt/dx is 0.23 in the default tank and 0.32 in the extended run, well under the stated limit of 1.0.

### Density constraint and iteration sensitivity (nx = 40)

All values are time-averaged over 0 < T ≤ 3.

| iters | mean ρ/ρ0−1 | mean max(C,0) | max C | max ΔE/E0 gain | Z(3) | shifted err (dT) | unshifted err |
|---|---|---|---|---|---|---|---|
| 1 | −2.05% | 1.6e-3 | 5.1% | +8.5e-4 | 4.006 | 0.073 (0.19) | 0.318 |
| 2 | −1.31% | 1.1e-3 | 1.8% | −3.4e-6 | 4.009 | 0.078 (0.20) | 0.302 |
| 4 | −2.02% | 5.5e-4 | 1.1% | −3.2e-6 | 4.001 | 0.072 (0.19) | 0.285 |
| 8 | −3.29% | 2.6e-4 | 0.42% | +3.6e-4 | 4.002 | 0.071 (0.20) | 0.286 |
| 16 | −5.45% | 1.1e-4 | 0.19% | **+3.0e-3** | 3.986 | 0.071 (0.20) | 0.276 |

Across resolutions at 4 iterations, mean ρ/ρ0−1 is −2.6%, −2.0% and −1.8% at nx = 20, 40 and 80. Mean compression is about 5.5e-4.

**Observations**
- More iterations reduce compression monotonically.
- With more iterations, though, the fluid becomes more under-dense on average. With the unilateral constraint the solver only pushes particles apart, so the column expands.
- At 16 iterations this produces a transient energy gain of 0.3% of E0 around T ≈ 0.36, which is above my 1e-3 criterion. The default setting of 4 iterations does not show it.
- The front history is insensitive to the iteration count, within ±0.02 in Z(3).

## Classification rationale (CONTRACTS §6)

- Every scored gap is within its reference tolerance:
  - Lethe: 0.073 against a tolerance of 0.25.
  - a225 for T ≤ 3: 0.018.
  - Ritter bound: respected.
- Mass is exact, energy does not increase at the default settings, and the run is stable.
- The reference values are fixed by two independent open copies, both verified:true, which agree to 0.08. That meets the "reference source is open" condition. The original paper is paywalled, which is recorded under Missing items. The status is therefore **matched**.

**Not hidden:**
1. The match depends on the permitted time shift (dT ≈ 0.20). The unshifted error, 0.34, exceeds 0.25.
2. The front is not resolution-converged and speeds up with resolution, by about +0.05 in Z(3) per doubling. The shifted error is stable at 0.06–0.07.
3. Beyond the suggested window (T > 3, in a non-default tank), the error reaches 0.31 even at the maximum shift.
4. At 16 iterations, energy rises by 3e-3 E0 early in the run.

None of these points to an implementation defect. The late-time slope (1.84 against 1.79 for the data) and the leading front without a shift are typical of an inviscid simulation with no bed friction.

## Missing items

- `martin1952` is verified:false. The original was not read; the values come from the Lethe and PySPH copies.
- `ritter1892-pysph` is verified:false for its bibliographic details. The front-speed formula was confirmed in the PySPH code.
- `macklin2013` is verified:false, with snippets only.
- **Research gap:** there is no published quantitative PBF dam-break validation, so no PBF-specific protocol or published PBF Z(T) is available.
- No source quantifies the time shift.
- nx = 160 was not run because of the time budget, so convergence is not established.
- There is no column-height reference.
- The energy criterion and the treatment of T > 3 are my choices as reviewer.
