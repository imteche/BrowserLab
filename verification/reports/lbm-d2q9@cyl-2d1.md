# lbm-d2q9 @ cyl-2d1 — review round 2

Reviewer: reviewer-lbm-d2q9-cyl-2d1-r2 (not the builder) · 2026-10-13 · **Status: matched**

Check script: `verification/checks/lbm-d2q9@cyl-2d1.check.js`. It is the round-1 script, re-read and kept unchanged except for two extra runs, **G** and **H**. It makes 8 child runs, 4 in parallel, and took 543 s wall on 4 cores. It prints JSON.
Record: `verification/results/lbm-d2q9@cyl-2d1.js`.

## What changed since round 1

The refinement agent changed the Zou–He pressure outlet in `methods/lbm-d2q9.js`. At the two outlet nodes next to the halfway walls, one diagonal population already comes from wall bounce-back. Only two populations are unknown there.

The old code kept the wall-sourced diagonal and applied the full-column formulas to the rest. That did not close the density. The new code sets the remaining unknown diagonal from ρu_y = 0 and sets f3 from ρ = ρ_out.

I checked the algebra:
- Bottom corner: `f7 = f2 − f4 + f5 + f6 − f8` gives Σc_y f = 0.
- With ru = f0 + f2 + f4 + 2(f1 + f5 + f8) − ρ_out, `f3 = f1 + f5 + f8 − ru − f6 − f7` reduces to f3 = ρ_out − Σ_{i≠3} f_i.
- The top corner is symmetric.

The interior, the defaults and the per-step cost did not change.

## Protocol

The protocol is the same as round 1, and every run was repeated from scratch.

- **Scene and setup:** DFG 2D-1, Re = 20 (Um 0.3, Ubar 0.2, ν 1e-3, D 0.1, channel 2.2 × 0.41). The run starts from the inflow profile and marches in physical time, with probes `forces` and `pressure_drop` sampled every 1 s.
- **Steady criterion (reviewer-set):** over the last 10 s, |ΔcD|/cD, |ΔcL| and |Δdp|/dp must all be below 1e-5. Runs are never stopped early.
- **Gaps:** cD and Δp are relative (tolerance 3 %), cL is absolute (tolerance 0.003). All are measured against the reference `value` (Nabh 1998). Whether a value falls inside the 1996 intervals is reported for information only. No tolerance was changed.
- **Conservation:** the channel is open, so total mass is not an invariant. Instead I check three things:
  - |M(T) − M(T−10 s)|/M0 < 1e-6.
  - |Q_out − Q_in|/Q_in < 1 %.
  - Q_in is within 1 % of Ubar·H.
- **Stability:** no NaN, τ > ½ and max Mach < 0.3. This applies to every run in the method's range: res 10–80 in steps of 10, Ulat 0.02–0.2, ibb 0/1.
  - Runs with Ulat above about 0.12 would break the method's own Mach < 0.3 criterion. They are outside its stability claim and were not run.
  - Run **G** (Ulat 0.02, the minimum of the range, τ 0.52) was added as the most demanding case allowed.

## Primary (A: res 20, Ulat 0.1, staircase, t = 60 s)

| quantity | sim | reference | 1996 interval | gap | tol | pass | in interval |
|---|---|---|---|---|---|---|---|
| cD | 5.69743 | 5.57954 | [5.57, 5.59] | +2.11 % | 3 % | yes | no |
| cL | 0.011578 | 0.010619 | [0.0104, 0.0110] | +0.00096 | 0.003 | yes | no |
| Δp | 0.119450 | 0.117520 | [0.1172, 0.1176] | +1.64 % | 3 % | yes | no |

- **Grid and run:** 440 × 82 cells, 196 cylinder links, 36 000 steps, τ = 0.7.
- **Mach:** max 0.239 during the start-up transient, 0.233 at steady state.
- **Steadiness over the last 10 s:** ΔcD/cD 1.8e-6, ΔcL 5.5e-6, Δdp/dp 1.8e-6, ΔM/M0 6.4e-7.
- **Flux:** Q_in = 0.081994 and Q_out = 0.081990, so the balance is 5.1e-5. In round 1 it was 1.6e-4; the outlet-corner fix improved it.

## All runs

| run | res | ibb | Ulat | τ | T [s] | steady | cD (gap) | cL (gap) | Δp (gap) | max Ma | outlet wall-row u [m/s] |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 20 | 0 | 0.1 | 0.70 | 60 | yes | 5.69743 (+2.11 %) | 0.011578 (+0.00096) | 0.119450 (+1.64 %) | 0.239 | 0.0073 |
| B | 20 | 1 | 0.1 | 0.70 | 60 | yes | 5.62279 (+0.78 %) | 0.010365 (−0.00025) | 0.119024 (+1.28 %) | 0.239 | 0.0071 |
| H | 20 | 0 | 0.05 | 0.60 | 100 | yes | 5.72528 (+2.61 %) | 0.011713 (+0.00109) | 0.121888 (**+3.72 %**) | 0.120 | 0.0073 |
| D | 30 | 0 | 0.1 | 0.80 | 35 | ~ (2e-4 / 10 s) | 5.67360 (+1.69 %) | 0.011472 (+0.00085) | 0.117523 (0.00 %) | 0.239 | 0.0049 |
| C | 40 | 0 | 0.1 | 0.90 | 25 | no (1.8e-3 / 10 s) | 5.62584 (+0.83 %) | 0.011470 (+0.00085) | 0.117273 (−0.21 %) | 0.239 | 0.0037 |
| E | 10 | 0 | 0.1 | 0.60 | 150 | yes (9e-13) | 5.90449 (+5.82 %) | 0.015636 (+0.0050) | 0.114979 (−2.16 %) | 0.241 | 0.0145 |
| F | 10 | 0 | 0.05 | 0.55 | 150 | yes (5e-14) | 5.93331 (+6.34 %) | 0.016056 (+0.0054) | 0.108646 (−7.55 %) | 0.121 | 0.0144 |
| G | 10 | 0 | 0.02 | 0.52 | 150 | yes (1e-12) | 5.95348 (+6.70 %) | 0.014383 (+0.0038) | 0.100794 (−14.2 %) | 0.051 | 0.0144 |

### Stability at res 10: the round-1 defect is resolved

- In round 1, runs **E** and **F** grew from the outlet column after about 40 s. E reached Ma 1.34 and F hit NaN at 139 s.
- Now **E**, **F** and **G** all settle by about 40 s. They then stay fixed to machine precision until 150 s. cD history for E: 5.9058 at 25 s, then 5.9045 from 35 s to 150 s.
- Domain mass is stationary, and the flux balance is 3.8e-4.
- The outlet wall-adjacent rows now carry u = 0.0145 m/s at res 10. This is the halfway-wall first-order slip: it halves with each grid doubling (0.0073 at res 20, 0.0049 at res 30, 0.0037 at res 40). In round 1 the same rows carried 0.187 m/s at the onset of the instability.
- The speed maximum is now at the cylinder shoulder (x ≈ 0.195, y ≈ 0.29), not on the outlet column.

## Classification

**matched** (CONTRACTS §6):

- **The published protocol passes at the method defaults.**
  - All three gaps are within the reference's suggested tolerances: cD +2.11 %, cL +0.00096, Δp +1.64 %.
  - The run reaches steady state, and the mass-stationarity and flux-balance checks pass.
  - Stability holds for the primary run and for every run inside the method's range and stated criterion.
- **The values do not land in the 1996 intervals.** None of them is inside its interval at res 20, which is the expected staircase effect. Refining the grid moves cD and Δp toward the reference: Δp is inside its interval at res 30 and 40. cL stays about 0.00085 high on staircase grids.
- **Some non-default settings miss the 3 % band.** This is information only and does not change the status:
  - At res 10, cD is +5.8 to +6.7 % and cL is +0.004 to +0.005 off. Δp at res 10 also gets worse as τ falls: −7.6 % at Ulat 0.05 and −14 % at 0.02.
  - Res 20 at Ulat 0.05 (τ 0.6) gives Δp +3.72 %.
  - These are discretisation errors from the staircase geometry and the τ-dependent halfway wall location at coarse or low-τ settings. They are not the published protocol, and round 1 reported the same kind of results the same way. Users should treat res 10 and low Ulat as qualitative settings for this benchmark.

## Missing / caveats

- `schafer1996` is `verified:false` and paywalled. The intervals come from three identical MIT-licensed GitHub copies plus DD2365_FEniCSx. The original Table 3 was not checked.
- The Nabh 1998 refined values come via the FeatFlow page and are `verified:false`. `john2001` is also `verified:false`.
- The LBM sources are `verified:false`. The Zou–He outlet, including the new corner closure, and the Bouzidi bounce-back are builder additions. The corner closure was checked algebraically by the reviewer. The outlet replaces the benchmark's do-nothing condition.
- No converged run above res 20 at Ulat 0.1. Res 30 is still drifting 2e-4 per 10 s at 35 s, res 40 drifts 1.8e-3 per 10 s at 25 s, and res 80 was not run. The convergence order is not established.
- Ulat values above about 0.12 were not run because they would break the stated Mach criterion.
- The recirculation length La was not measured; it is not in the probe contract.
- The steadiness, mass and flux bounds are reviewer-set.
- With ibb = 1 (non-default), Q_out is 0.62 % below Q_in. This is the linear Bouzidi rule, which is not mass conserving, and is reported for information only.
