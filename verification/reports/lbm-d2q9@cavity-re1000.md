# lbm-d2q9 @ cavity-re1000 — review round 2

Reviewer: reviewer-lbm-d2q9-cavity-re1000-r2 (not the builder) · 2026-10-13 · **Status: matched**

- Check script: `verification/checks/lbm-d2q9@cavity-re1000.check.js`. It was written in round 1. I re-read it critically and re-ran it unchanged; only the header comment changed. Wall time was 555 s, using two worker threads, and it prints JSON.
- Record: `verification/results/lbm-d2q9@cavity-re1000.js`.
- Previous round: r1 matched.

## What changed since round 1

The refinement round changed two things in `methods/lbm-d2q9.js`:

1. `setEq` with velocity gradients now applies a `(tau - 1)` non-equilibrium factor. Only the Taylor–Green initialisation uses it.
2. The Zou–He outlet corner closure. Only the cylinder scene uses it, through `L.outlet`.

The cavity scene calls `setEq(x, 1, 0, 0)` with no gradients and has no outlet nodes, so neither change is on the cavity code path. The re-run confirms this. The N = 128 and N = 64 runs are bit-identical to round 1: same step counts, residuals, gaps and psi_min. The N = 192 run got further within the wall cap this time, reaching t = 107 against 94 in round 1.

## Protocol

This is the same protocol as round 1, re-checked against the code:

- **Setup.**
  - Scene `cavity`, Re = 1000, lid speed Ulat = 0.1 (the method default), tau = 0.5 + 3 Ulat N / Re.
  - Halfway bounce-back on the walls and moving-wall bounce-back on the lid.
  - Every run starts from rest.
- **Primary run.** N = 192, the largest grid that gets near steady within the budget. It runs until residual < 1e-7 or a 555 s wall cap.
- **Extra runs**, in a second worker:
  - N = 128, run to residual < 1e-7;
  - N = 64, capped at t = 150;
  - N = 128 at Ulat = 0.05, for Mach sensitivity.
- **N = 256 was not run.** At about 12 MLUPS one time unit takes about 13.5 s, and t ≥ 60 is needed, so a single run would take more than 13 minutes.
- **Gaps.** All are as specified in `references/cavity.js`:
  - u and v profiles: max-abs over the table rows, tolerance 0.03 U. Ghia's coordinates are snapped to j/128, and the simulation profile is evaluated there by 4-point Lagrange interpolation over cell centres plus wall values.
  - psi_min: relative error, tolerance 3 %.
  - Vortex centre: max(|dx|, |dy|), tolerance 0.02.
  - No tolerance was loosened.
- **Conservation.** Relative drift of Σρ below 10 ε per step (a reviewer-set bound).
- **Stability.** tau > ½, Ma < 0.3 and no NaN.

## Primary results, N = 192, Ulat 0.1, tau 0.5576 (t = 107.25, 205 920 steps, residual 2.0e-6)

| quantity | worst at | sim | reference | gap | tol | pass |
|---|---|---|---|---|---|---|
| max \|u − u_Ghia\|, x = 0.5 | y = 0.0703 | −0.21481 | −0.22220 | 0.00739 | 0.03 | yes |
| max \|v − v_Ghia\|, y = 0.5 | x = 0.8594 | −0.41997 | −0.42665 | 0.00668 | 0.03 | yes |
| max \|u − u_Erturk\|, x = 0.5 | y = 0.12 | −0.32794 | −0.3381 | 0.01016 | 0.03 | yes |
| psi_min vs Ghia | | −0.116299 | −0.117929 | 1.38 % | 3 % | yes |
| psi_min vs Erturk | | −0.116299 | −0.118781 | 2.09 % | 3 % | yes |
| vortex centre | | (0.5317, 0.5655) | (0.5313, 0.5625) | 0.0030 | 0.02 | yes |

## All runs (grid dependence)

| N | Ulat | tau | Ma max | steps | t_end | stop | residual | u_Ghia | v_Ghia | u_Erturk | psi_min | rel Ghia | rel Erturk | centre | mass drift |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 192 | 0.1 | 0.558 | 0.167 | 205920 | 107.25 | wall cap | 2.0e-6 | 0.0074 | 0.0067 | 0.0102 | −0.116299 | 1.38 % | 2.09 % | 0.0030 | 1.0e-11 |
| 128 | 0.1 | 0.538 | 0.164 | 188032 | 146.9 | residual | 9.8e-8 | 0.0124 | 0.0096 | 0.0156 | −0.115044 | 2.45 % | **3.15 %** | 0.0032 | 9.3e-12 |
| 64 | 0.1 | 0.519 | 0.158 | 96000 | 150 | t cap | 1.6e-7 | 0.0288 | 0.0250 | **0.0330** | −0.111346 | **5.58 %** | **6.26 %** | 0.0047 | 4.7e-12 |
| 128 | 0.05 | 0.519 | 0.082 | 250880 | 98 | wall cap | 2.5e-6 | 0.0124 | 0.0103 | 0.0157 | −0.114924 | 2.55 % | 3.25 % | 0.0032 | 1.2e-11 |

Bold values exceed tolerance. No run produced NaN, and every mass drift is under its 10 ε·steps bound.

- **Grid trend.**
  - psi_min differences for N 64→128 and 128→192 have a ratio of 2.95. First order predicts 3.0.
  - A first-order Richardson extrapolation from N = 128/192 gives −0.11881, which is 0.02 % from Erturk (601²).
  - The Ghia u gap falls 0.029 → 0.012 → 0.0074.
  - At fixed Ulat, tau changes with N, so the convergence is first order. This is consistent with BGK halfway bounce-back, whose effective wall position depends on tau. It is a known property of the scheme, not a defect.
- **Steadiness.**
  - N = 192 from t = 90 to 107: the gaps change by ≤ 2e-5 U and psi_min by 1.2e-5.
  - Converged N = 128 from t = 110 to 146.9: the gaps change by ≤ 1e-5 U and psi_min by 4e-6.
  - The remaining transient is therefore negligible against the smallest margin, which is 0.009 relative on psi_min vs Erturk.
- **Mach.** At N = 128 and t = 90, going from Ulat 0.1 to 0.05 changes psi_min by 0.096 %, the v gap by 6e-4 and the u gaps by ≤ 5e-5. Compressibility error is not the dominant error.
- **max |div u|** is 14.4, 10.2 and 5.5 U/L at N = 192, 128 and 64 (lid-corner singularity). This is information only.

## Classification

**matched** (CONTRACTS §6):

- At N = 192 all six quantitative gaps are inside the reference tolerances, none loosened.
- Mass conservation, stability and steadiness pass.
- The references come from open transcriptions and snippets. ghia1982 and erturk2005 are `verified:false`; this is recorded under missing, as in round 1.
- There is no evidence of an implementation defect, and the refinement did not affect this experiment.

Caveats:

- At the method default **N = 128**, psi_min misses Erturk by 3.15 % (tolerance 3 %). It passes vs Ghia, and all profiles pass.
- N = 64 fails several gaps.
- The matched status holds for N ≥ 192 at Ulat = 0.1, which is what the claim states.

## Missing / caveats

- **ghia1982 is `verified:false`.**
  - The u and v tables come from three open copies. They disagree at v(x = 0.9063), and the simulation gap there is below 0.001 under either value.
  - psi_min and the vortex centre come from snippets and a single copy.
- **erturk2005 is `verified:false`.** The u table is from the lethe copy, with only three entries snippet-confirmed. psi_min comes from a single snippet.
- **botella1998** was not read and is not used as a gap.
- **Runs not done.**
  - N = 256 was not run (budget).
  - The primary run stopped at residual 2.0e-6, not 1e-7; the remaining transient is bounded above.
  - No fixed-tau grid sequence was run.
- **LBM sources** were not read in full, and no LBM-specific Re = 1000 cavity numbers (hou1995) are available.
- **Reviewer choices:** the steadiness and mass criteria, and the Lagrange interpolation.
