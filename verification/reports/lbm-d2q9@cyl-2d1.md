# lbm-d2q9 @ cyl-2d1 — review round 1

Reviewer: reviewer-lbm-d2q9-cyl-2d1-r1 (not the builder) · 2026-10-13 · **Status: flagged**

Check script: `verification/checks/lbm-d2q9@cyl-2d1.check.js` (6 child runs, 4 in parallel; 357 s wall on 4 cores, ~580 s under load; prints JSON).
Record: `verification/results/lbm-d2q9@cyl-2d1.js`.

## Protocol

- Scene `cylinder`, DFG 2D-1: Re = 20, Um = 0.3 m/s, Ubar = 0.2 m/s, ν = 1e-3, D = 0.1 at (0.2, 0.2), channel 2.2 × 0.41.
- Method defaults: 20 cells/D, Um_lat = 0.1 (Ma_inflow 0.17), tau = 0.5 + 3·(2/3·0.1)·20/20 = 0.7, staircase (halfway) bounce-back on the cylinder, moving-wall bounce-back parabolic inflow, Zou–He pressure outlet ρ = 1 (method's substitute for do-nothing). Started from the inflow profile.
- Physical-time march, probes sampled every 1 s: `forces` (cD, cL by momentum exchange), `pressure_drop` (Δp between (0.15, 0.2) and (0.25, 0.2), extrapolated from the fluid side).
- Steady criterion (reviewer): over the last 10 s, |ΔcD|/cD, |ΔcL|, |Δdp|/dp all < 1e-5 (≪ 1 % of every tolerance). Runs are not stopped early, so late-time behaviour is seen.
- Runs: **A** res 20 (primary, defaults, T = 60 s); **B** res 20 ibb = 1 (T = 60 s); **D** res 30 (T = 35 s); **C** res 40 (T = 25 s only); **E** res 10 Ulat 0.1 and **F** res 10 Ulat 0.05 (T = 150 s; lowest res the method allows).
- Not run: a converged res 40 (about 40 s physical → > 9 min alone) or res 80. This limits the grid study, not the primary protocol.
- Gaps: rel for cD and Δp (tol 3 %), abs for cL (tol 0.003), against the reference `value` (Nabh 1998, via FeatFlow copies). In-interval vs the 1996 Schäfer–Turek bands is reported separately and is not a pass criterion (as the reference specifies). No tolerance was changed.
- Conservation: open channel, so total mass is not invariant. Reviewer checks at steady state: |M(T) − M(T−10 s)|/M0 < 1e-6; mass-flux balance |Q_out − Q_in|/Q_in < 1 % with Q = Σ ρu Δy on the first and last column (ρ from the pressure view plus the domain mean density); Q_in within 1 % of Ubar·H = 0.082 m²/s. Momentum and energy are not invariants of this forced, dissipative, open flow.
- Stability: no NaN; tau > ½; max Mach |u|/c_s < 0.3 (method's stated criterion). Checked for the primary run and for every run inside the method's parameter range.

## Raw numbers — primary (A: res 20, Ulat 0.1, staircase, t = 60 s)

| quantity | sim | reference value | 1996 interval | gap | tol | pass | in interval |
|---|---|---|---|---|---|---|---|
| cD | 5.69743 | 5.57954 | [5.57, 5.59] | +2.11 % | 3 % | yes | no |
| cL | 0.011578 | 0.010619 | [0.0104, 0.0110] | +0.00096 | 0.003 | yes | no |
| Δp | 0.119450 | 0.117520 | [0.1172, 0.1176] | +1.64 % | 3 % | yes | no |

- 440 × 82 cells, 196 cylinder links, 36 000 steps, tau 0.7, max Mach 0.239 (start-up transient; 0.233 steady).
- Steadiness over the last 10 s: ΔcD/cD 1.8e-6, ΔcL 5.5e-6, Δdp/dp 1.8e-6, ΔM/M0 6.4e-7. cD history: 6.441 (5 s), 5.710 (10 s), 5.699 (25 s), 5.6974 (40–60 s).
- Mass flux: Q_in 0.081994, Q_out 0.081981 m²/s (balance 1.6e-4); Q_in vs Ubar·H: −7e-5. Domain mass settles 0.67 % above its initial value (weak compressibility: the pressure drop along the channel is carried by density).

## All runs

| run | res | ibb | Ulat | tau | T [s] | steady | cD (gap) | cL (gap) | Δp (gap) | max Ma | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 10 | 0 | 0.1 | 0.60 | 150 | no | 5.9058 @25 s (+5.85 %) → 5.1437 @150 s | 0.01565 @25 s | 0.11500 @25 s (−2.14 %) | **1.34** | drifts from ~40 s, blows up |
| F | 10 | 0 | 0.05 | 0.55 | 139 | no | 5.9326 @25 s | — | — | **1.04** | **NaN at t = 139 s** |
| A | 20 | 0 | 0.1 | 0.70 | 60 | yes | 5.69743 (+2.11 %) | 0.011578 (+0.00096) | 0.119450 (+1.64 %) | 0.239 | primary |
| B | 20 | 1 | 0.1 | 0.70 | 60 | yes | 5.62278 (+0.78 %) | 0.010365 (−0.00025) | 0.119024 (+1.28 %) | 0.239 | Q_out 1.10 % < Q_in |
| D | 30 | 0 | 0.1 | 0.80 | 35 | ~ (2e-4/10 s) | 5.67360 (+1.69 %) | 0.011472 (+0.00085) | 0.117523 (0.00 %) | 0.239 | |
| C | 40 | 0 | 0.1 | 0.90 | 25 | no (1.8e-3/10 s) | 5.62584 (+0.83 %) | 0.011470 (+0.00085) | 0.117273 (−0.21 %) | 0.239 | still falling |

### Instability at res 10 (runs E, F)

- Both runs reach a plausible plateau by t ≈ 25 s. At this point cD is +5.9 %, out of tolerance, but that is what a coarse staircase grid is expected to give.
- From t ≈ 40 s, total mass and the outlet velocity start to grow:
  - **E, t = 53 s.** Mach first exceeds 0.26. The speed maximum (0.465 m/s) is on the **outlet column** (x = 2.195, y = 0.205). The rows next to the no-slip walls at the outlet carry u = 0.187 m/s; at res 20 the same quantity is 0.007 m/s.
  - **E, t = 150 s.** Outlet u is 0.86–1.37 m/s, Ma = 1.34, mass is +42 %, and Q_out/Q_in = 6.3. The inlet is still near its prescribed 0.29 m/s.
  - **F (Ulat 0.05, tau 0.55).** The onset is the same, at the outlet column, and the run hits NaN at t = 139 s.
- Both runs satisfy the method's stated criterion ("tau > 1/2 … Ma < ~0.3") and use res = 10, which is the minimum of the method's advertised cylinder range. The method notes warn only about res 10 at Re = 100.
- An exploratory run done outside the check, with the same scratch harness, kept res 15 steady to 120 s. Res 20 also stayed steady at Ulat 0.05 (tau 0.6) to 100 s. So the instability is not simply a matter of low tau. It appears when the outlet column is resolved by 41 cells and wall rows.

## Classification

**flagged** (CONTRACTS §6: "any check fails"):

- **The published protocol passes at the method defaults.** At res 20, all three gaps are within the reference's suggested tolerances (cD +2.11 %, cL +0.00096, Δp +1.64 %). Steady state, mass-flux balance and stability all pass.
- **The answer does not land in the narrow 1996 intervals at res 20.** This is the expected staircase effect noted in the protocol hint. As the grid is refined, cD and Δp move toward the reference: Δp is inside its interval at res 30 and 40, and cD is +0.83 % at res 40 and still falling. cL stays about 0.00085 high on staircase grids. Interpolated bounce-back brings cL to −0.00025 and cD to +0.78 % at res 20.
- **The stability check fails across the method's own allowed parameter range.** At res 10 the solution diverges, even though the method's stated stability criterion predicts a stable run. A user selecting res = 10 for 2D-1 gets a drifting and finally divergent answer. This fails the stability check, so the status is flagged.

The evidence points to an implementation or boundary-condition defect rather than an inherent limitation of LBM.
- The growth starts in the Zou–He pressure-outlet column, which is a builder-derived condition, and in its wall-adjacent corner nodes.
- The bounce-back walls themselves stay at u ≈ 0. Meanwhile the outlet wall rows acquire a large slip velocity.
- Possible fixes: a different corner treatment at the outlet, a convective or extrapolation outflow, or restricting the res range or stated criterion. These are for the builder to decide.

## Missing / caveats

- `schafer1996` is `verified:false` and paywalled. Its intervals come from three identical MIT-licensed GitHub copies (`copy-vortexlab-dfg`, `copy-adelowo-dfg`, `copy-karman-dfg`, all verified:true copies from 2026 repos) and DD2365_FEniCSx. The original Table 3 was not checked.
- `nabh1998` refined values (via the FeatFlow page, which was not reachable) are `verified:false`. `john2001` is `verified:false`.
- The LBM sources (qian1992, he1997, zou1997, ladd1994, hou1995) are `verified:false`. The Zou–He outlet and the Bouzidi bounce-back are builder additions not taken from a read source. The outlet replaces the benchmark's do-nothing condition.
- No converged run above res 30. Res 40 was stopped at 25 s and res 80 was not run because of the runtime budget, so the convergence order is not established.
- Mach sensitivity was explored only outside the check. Res 20 at Ulat 0.05 gave cD = 5.7253 (+2.61 %), so the tau-dependent staircase wall error dominates.
- The recirculation length La is not in the probe contract and was not measured.
- The steadiness, mass-stationarity and flux-balance bounds are reviewer-set.
- Interpolated bounce-back (ibb = 1, non-default) is not mass conserving: Q_out is 1.1 % below Q_in at steady state. This is reported for information only.
