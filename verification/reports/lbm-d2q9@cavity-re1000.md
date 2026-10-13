# lbm-d2q9 @ cavity-re1000 — review round 1

Reviewer: reviewer-lbm-d2q9-cavity-re1000-r1 (not the builder) · 2026-10-13 · **Status: matched**

Check script: `verification/checks/lbm-d2q9@cavity-re1000.check.js` (about 9.3 min wall, two worker threads, prints JSON).
Record: `verification/results/lbm-d2q9@cavity-re1000.js`.

## Protocol

- Scene `cavity`, Re = 1000, lid speed Ulat = 0.1 lattice units (method default), tau = 0.5 + 3 Ulat N / Re. Halfway bounce-back on the stationary walls, moving-wall bounce-back on the lid. All runs start from rest.
- Throughput measured in this container: about 12 MLUPS per worker with one or two workers, but only about 7 MLUPS each with three. So the runs are packed into two workers, each with a 555 s wall cap.
  - Worker A: **N = 192** (primary, tau 0.558), run to residual < 1e-7 or the wall cap.
  - Worker B, in order:
    - N = 64 (tau 0.519, cap t = 150);
    - N = 128 (tau 0.538, method default) to residual < 1e-7;
    - N = 128 with Ulat = 0.05 (tau 0.519) for Mach sensitivity, truncated by the cap.
- **N = 256 was not run.** One time unit is 2560 steps on 65 536 nodes, about 13.5 s. The N = 128 history shows the profiles need t ≳ 60 to settle within 1e-3 U, so one run would take more than 13 min. A first attempt with four contended workers reached only t = 19.25 in 530 s (u gap 0.069, still in the transient). It was discarded and the script was restructured as above.
- Snapshots of every comparison are taken every 10 time units.
- **Steadiness.** The N = 192 run stops at the wall cap. Its remaining transient is bounded with the converged N = 128 history: the change in each measure from the snapshot nearest the N = 192 stop time to the end of the N = 128 run.
- **Comparisons** (references/cavity.js, `cavity-re1000-*`):
  - Max-abs over all table rows for the Ghia u (17 rows), Ghia v (17 rows) and Erturk u (23 rows) profiles. Tolerance 0.03 U, as given by the reference.
  - psi_min: relative error vs Ghia (−0.117929) and vs Erturk (−0.118781). Tolerance 3 %.
  - Vortex centre: max(|dx|, |dy|) vs Ghia (0.5313, 0.5625). Tolerance 0.02.
  - Ghia's 4-decimal coordinates are snapped to j/128. Sim profiles (cell-centre values plus wall values from the probes) are evaluated there by 4-point Lagrange interpolation.
- **Conservation.** Total mass Σρ, with relative drift < 10 ε per step (reviewer-set). The scheme conserves mass exactly in exact arithmetic. Momentum and energy are not invariants of this forced, viscous flow.
- **Stability** (the method's stated criteria): tau > ½ (practical BGK floor about 0.51–0.55), Mach |u|/c_s < 0.3, no NaN.

## Raw numbers, primary N = 192, Ulat 0.1 (t = 94.15, 180 768 steps, residual 7.4e-6)

| quantity | sim | reference | gap | tol | pass |
|---|---|---|---|---|---|
| max \|u − u_Ghia\|, x = 0.5 | worst at y = 0.0703: −0.21481 | −0.22220 | 0.00739 | 0.03 | yes |
| max \|v − v_Ghia\|, y = 0.5 | worst at x = 0.8594: −0.41995 | −0.42665 | 0.00670 | 0.03 | yes |
| max \|u − u_Erturk\|, x = 0.5 | worst at y = 0.12: −0.32793 | −0.3381 | 0.01017 | 0.03 | yes |
| psi_min vs Ghia | −0.116291 | −0.117929 | 1.39 % | 3 % | yes |
| psi_min vs Erturk | −0.116291 | −0.118781 | 2.10 % | 3 % | yes |
| vortex centre | (0.5317, 0.5655) | (0.5313, 0.5625) | 0.0030 | 0.02 | yes |

Row pattern:
- **Ghia u.** The near-lid rows agree within 0.0012. The largest gaps (0.0066–0.0074) are in the bottom-wall jet, y = 0.05–0.10, where the sim is weaker.
- **Ghia v.** The downflow jet x = 0.80–0.97 is off by 0.005–0.007. The upflow side is weaker by about 0.003.
- **Erturk u.** The sim is weaker in magnitude in both boundary-layer jets: 0.008 at y ≈ 0.92 and 0.010 at y = 0.12–0.14.

## All runs

| N | Ulat | tau | Ma max | steps | t_end | stop | u_Ghia | v_Ghia | u_Erturk | psi_min | Ghia rel | Erturk rel | centre | mass drift |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 192 | 0.1 | 0.558 | 0.167 | 180768 | 94.15 | wall cap (res 7.4e-6) | 0.0074 | 0.0067 | 0.0102 | −0.116291 | 1.39 % | 2.10 % | 0.0030 | 8.9e-12 |
| 128 | 0.1 | 0.538 | 0.164 | 188032 | 146.9 | residual 9.8e-8 | 0.0124 | 0.0096 | 0.0156 | −0.115044 | 2.45 % | **3.15 %** | 0.0032 | 9.3e-12 |
| 64 | 0.1 | 0.519 | 0.158 | 96000 | 150 | t cap (res 1.6e-7) | 0.0288 | 0.0250 | **0.0330** | −0.111346 | **5.58 %** | **6.26 %** | 0.0047 | 4.7e-12 |
| 128 | 0.05 | 0.519 | 0.082 | 199040 | 77.75 | wall cap (res 1.0e-5) | 0.0124 | 0.0103 | 0.0157 | −0.114894 | 2.57 % | 3.27 % | 0.0032 | 9.8e-12 |

Bold marks gaps over tolerance. No run produced NaN. Every mass drift is below its 10 ε·steps bound (2e-10 to 4.6e-10).

- **Steadiness of the primary run.**
  - N = 192, from t = 80 to 94.15: gaps change by ≤ 3e-5 U and psi_min by 2.2e-5.
  - N = 128, from t = 90 to the converged end at t = 146.9: Ghia u changes by 1e-5, Ghia v by 3e-5, Erturk u by 2e-5, psi_min by 1.7e-5, the centre by 0.
  - So the N = 192 result is within about 1e-4 of its steady state, which is negligible against the margins (smallest margin: 0.009 relative on psi_min vs Erturk).
- **Grid trend.**
  - psi_min differences N 64→128 and 128→192 have ratio 2.97. First order predicts 3.0 for these h ratios.
  - First-order Richardson from N = 128/192 gives psi_min ≈ −0.11879, within 0.003 % of Erturk's 601² value.
  - Ulat is fixed, so tau changes with N (acoustic scaling). The first-order behaviour matches BGK halfway bounce-back, whose effective wall position depends on tau. This is a known property of the scheme and not evidence of an implementation defect.
- **Mach.** At N = 128 and equal t = 70, Ulat 0.05 and Ulat 0.1 differ by 0.095 % in psi_min, 6e-4 in the v gap and ≤ 5e-5 in the u gaps. The O(Ma²) error is not dominant.
- **Weak compressibility** (information only). max |div u| is 14.4 / 10.2 / 5.5 U/L at N = 192 / 128 / 64. It grows with N, as expected from the lid-corner singularity. No criterion is stated, so it is not used for classification.

## Classification

**matched** (CONTRACTS §6):
- At the largest feasible grid, N = 192, all six quantitative gaps are within the reference-suggested tolerances. None was loosened.
- Mass conservation, stability (tau > ½, Ma 0.167 < 0.3, no NaN) and steady state (residual bound from the converged N = 128 history) all pass.
- The reference values come from open, verified transcriptions and snippets. Ghia and Erturk are themselves registered `verified:false`. This is the same treatment as psi-omega-fd@cavity-re1000 and lbm-d2q9@cavity-re100.

Caveats a reader should know:
- At the **method default N = 128**, psi_min misses the Erturk reference by 3.15 % (tolerance 3 %). It passes vs Ghia at 2.45 %, and the profiles pass.
- N = 64 fails several gaps. The method's own note says to use N ≥ 128 at Re = 1000.
- The matched status therefore holds for N ≥ 192 at Ulat = 0.1, which is what the claim states.

## Missing / caveats

- ghia1982 is `verified:false`: the original was not read. The u and v tables come from three open copies. They disagree at one point (v at x = 0.9063). The sim gap there is 0.0006 against the majority value and 0.0001 against the other.
- The Ghia psi_min and vortex centre at Re = 1000 come from snippets and a single copy, and the table numbers are unverified.
- erturk2005 is `verified:false`: arXiv was not reachable. The u table comes from the lethe copy, of which only three entries were snippet-confirmed. psi_min comes from a single snippet.
- botella1998 was not read and is not used as a gap.
- N = 256 was not run (budget). The primary run stopped at residual 7.4e-6, not 1e-7; its remaining transient is bounded from N = 128. No fixed-tau (diffusive) grid sequence was run.
- The LBM sources were not read in full. No LBM-specific Re = 1000 cavity numbers (hou1995) are registered.
- Reviewer-set choices: the steadiness and mass criteria, and Lagrange interpolation onto the table coordinates.
