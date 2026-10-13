# Review: wcsph @ dam-front

Reviewer: reviewer-wcsph-dam-front-r1, round 1, 2026-10-13. I did not write `methods/wcsph.js` and did not modify any method or reference file.

- **Check script:** `node verification/checks/wcsph@dam-front.check.js`
  - Default run takes about 5 min: N = 24, 33, 48, plus the c0 sensitivity run and the scale run.
  - `--full` adds N = 64 and takes about 10.5 min. The numbers below come from the `--full` run.
  - `--quick` runs N = 33 only and takes about 50 s.
- **Result:** `verification/results/wcsph@dam-front.js`, **status: flagged**.

## Protocol

- **Scene and parameters:** scene `dam-break` with the method defaults:
  - a = 1 m, g = 9.81, tank 5a, walls 4a high.
  - c0 = 10·√(2g·2a) = 62.6 m/s, γ = 7, α = 0.1, β = 0.
  - XSPH 0.5, h = 1.3 dx, cubic spline, acoustic CFL 0.125.
  - These match PySPH `dam_break_2d` (pysph-dbexp) except the kernel, which is cubic spline here and Wendland quintic in PySPH.
- **Resolution:**
  - Primary: N = 33 particles across a (dx = 0.0303 m, close to PySPH's dx = 0.03 m).
  - Resolution study: N = 24, 33, 48, 64.
  - Each run goes to T = t√(2g/a) = 3.0.
- **Measured through the public API only:**
  - `probe('front')` every step, giving Z = front/a.
  - `probe('totals')`, `metrics()` (Mach, drho, CFL, mass, nf) and `view('density')` every 20 steps.
- **Gap (reference tolerance unchanged):**
  - Metric: max |Z_sim(T − dT) − Z_ref(T)| over the reference rows with 0 < T ≤ 3.
  - One time shift dT in [0, 0.25] (grid step 0.005) is fitted on the primary copy `dam-break-mm-front-lethe`. The same dT is then used for the cross-copy `dam-break-mm-front-a225` (rows with T ≤ 3).
  - Tolerance 0.25 for both. dT = 0 and Lethe's dT = 0.175 are reported for information.
- **Ritter:** Z_sim(T) ≤ 1 + 2T at every step, with no tolerance.
- **Mass:** particle count and total mass are constant, and no fluid particle may leave the tank.
- **Energy:**
  - KE + PE + E_el, where E_el = Σ_fluid m·e(ρ) with the Tait internal energy e(ρ) = B[(ρ^{γ−1} − ρ0^{γ−1})/((γ−1)ρ0^γ) + 1/ρ − 1/ρ0].
  - Criterion (mine): it may never rise more than 1e-3 E0 above its running minimum.
  - A rise in KE+PE alone is compared with the initial EOS storage, as the protocol allows ("apart from EOS storage").
- **Stability:**
  - no NaN and `diverged()` false
  - acoustic CFL ≤ 0.125
  - the method's stated Ma = max|v|/c0 ≤ 0.1
  - particle-mean |ρ/ρ0 − 1| ≤ 1% (Becker & Teschner η, a bulk ~Ma² estimate). The per-particle max is reported as information.
- **Sensitivity runs:**
  - N = 33 with c0 = 15·√(2g·2a).
  - a = 0.05715 m (2.25 in), the Martin & Moyce column, at N = 24.

## Raw numbers

| N | steps | Z(1) | Z(2) | Z(3) | best dT | gap Lethe (best dT) | gap dT=0 | gap dT=0.175 | gap a225 (same dT) | max Ma | mean drho | max drho (info) | mech. loss | max rise KE+PE+E_el |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 24 | 6703 | 1.436 | 2.488 | 3.859 | 0.09 | 0.0748 | 0.187 | 0.121 | 0.097 | 0.1037 | 0.22% | 1.70% | 7.9% | 1.6e-4 E0 |
| **33** | 9227 | 1.450 | 2.541 | 3.920 | 0.13 | **0.0769** | 0.240 | 0.088 | 0.096 | **0.1051** | 0.23% | 1.69% | 6.5% | 1.1e-4 E0 |
| 48 | 13422 | 1.485 | 2.581 | 3.967 | 0.16 | 0.0775 | 0.279 | 0.082 | 0.094 | 0.1059 | 0.24% | 1.37% | 5.4% | 6.3e-5 E0 |
| 64 | 17907 | 1.504 | 2.597 | 3.999 | 0.175 | 0.0776 | 0.299 | 0.078 | 0.096 | 0.1069 | 0.24% | 2.08% | 4.9% | 4.1e-5 E0 |
| 33, cfac 15 | 13523 | 1.439 | 2.508 | 3.885 | 0.105 | 0.0730 | 0.205 | 0.100 | 0.094 | 0.0700 | 0.10% | 1.23% | 8.0% | 4.9e-5 E0 |

**N = 33 pointwise residuals** (Z_sim − Z_ref) at dT = 0.13 against Lethe:

| T | 0.41 | 0.84 | 1.19 | 1.43 | 1.63 | 1.82 | 1.97 | 2.20 | 2.32 | 2.50 | 2.64 | 2.82 | 2.96 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Z_sim − Z_ref | −0.077 | +0.008 | +0.062 | +0.061 | +0.052 | +0.051 | +0.011 | +0.071 | +0.007 | +0.027 | −0.002 | +0.031 | +0.001 |

**N = 33 residuals against a225** (same dT): +0.016, +0.054, +0.082, +0.096 at T = 0.83, 1.22, 2.00, 2.55. With its own best shift dT = 0.19 the max is 0.021.

**Other results:**
- **Mach exceedance:** Ma first exceeds 0.1 at T = 2.70 / 2.63 / 2.57 / 2.53 for N = 24 / 33 / 48 / 64. It happens in the front tongue: up to about 40 particles at N = 33, roughly 2% of the fluid.
- **Ritter bound:** 0 violations in every run. The minimum margin is at T = 0 (particle centres sit dx/2 behind the column face). The late-time slope dZ/dT is about 1.4.
- **Mass:** drift 0, particle count change 0, 0 particles outside the tank.
- **Energy at N = 33:**
  - KE+PE rises by 1.69e-3 E0 at T ≈ 0.08. The initial stored EOS energy is 32.1 J, or 1.63e-3 E0, so this rise is the hydrostatic compression being released.
  - The total including E_el rises by at most 1.07e-4 E0.
  - (KE+PE)/E0 = 0.9998, 0.9938, 0.9837, 0.9667, 0.9500, 0.9349 at T = 0.5, 1, 1.5, 2, 2.5, 3.
- **Scale run:** a = 2.25 in gives Z(T) identical to a = 1 m (difference 0), so the nondimensionalisation is exact.
- **Effect of c0:** going from cfac 10 to 15 changes Z by at most 0.036, at T ≈ 2.5–3.

## Classification rationale

**What passes:**
- Every quantitative gap against the Martin & Moyce copies passes with a wide margin: 0.077 against the primary copy and 0.096 against the cross-copy, with tolerance 0.25.
- The shift used (0.13) is inside the allowed [0, 0.25] and close to Lethe's empirical 0.175.
- The gap is stable across a 2.7× refinement (0.075–0.078).
- The Ritter bound, mass conservation and the energy budget all pass.

**Why it is flagged:** the method states its weak-compressibility validity condition as c0 ≥ 10 Umax, written as Ma ≤ 0.1. With the default (PySPH-published) c0 = 10√(2gH), the measured Ma reaches 0.104–0.107 at every resolution once T > 2.5.
- The cause is that the a priori Umax ≈ √(2gH) underestimates the actual front speed, which is about 1.05√(2gH). The Ritter limit is 1.41√(2gH).
- This is a stated-criterion failure, so under §6 the record is **flagged**. I did not widen the 0.1 threshold.
- The effect on the claim is small. With c0 = 15√(2gH), every check passes (Ma 0.070, gap 0.073, mean drho 0.10%), and Z moves by at most 0.036.
- I consider the failure fixable by a parameter or default change: raise `cfac` to about 12–15, or base c0 on the Ritter speed 2√(gH). It is not a defect in the discretisation.

**Density criterion:** I applied the 1% η criterion to the particle-mean density error, not the per-particle max.
- The ~Ma² estimate the method cites is a bulk scaling.
- The per-particle max (1.4–2.1%) comes from 1–8 particles at the floor impact zone.
- It does not scale with 1/c0²: it is 1.23% at cfac 15, where Ma² scaling predicts 0.75%. This marks it as particle-scale noise, not compressibility.
- This is a reviewer choice, recorded in `missing`. If the per-particle max were used instead, even the cfac 15 run would fail.

**Further caveats:**
- The unshifted gap (0.19–0.30) grows with N, and the best-fit shift drifts from 0.09 to 0.175 as the front speeds up with refinement. Convergence of Z(T) is not demonstrated up to N = 64.
- At the resolutions tested, the match depends on the allowed time shift, as the reference notes anticipate ("Without the shift expect ~0.3 extra error near T = 1-2").

## Missing / caveats

1. `martin1952` is verified:false. The original is paywalled. The data come from the open Lethe and PySPH copies, which agree to about 0.08.
2. `ritter1892-pysph` is verified:false. The formula comes from the PySPH shallow-water example.
3. No column-height (H/2a) reference exists, so the `column_height` probe was not verified.
4. The time-shift allowance is empirical (gate-opening lag), not a Martin & Moyce statement.
5. Resolution goes up to N = 64 only, and Z(T) and the best shift are not yet converged.
6. Reviewer-set choices:
   - the energy-rise threshold of 1e-3 E0
   - the particle-mean density criterion
   - excluding wall-particle elastic energy, which is not observable through the API
7. `becker2007` (c0 ≥ 10 Umax, η = 0.01) is snippet-only.
