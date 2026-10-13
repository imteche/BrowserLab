# mls-mpm @ dam-front — review round 1

Reviewer: reviewer-mls-mpm-dam-front-r1 (not the builder) · Date: 2026-10-13 · Status: **matched**

Check script: `verification/checks/mls-mpm@dam-front.check.js`. It takes about 6 minutes single-threaded (341 s measured) and prints JSON.

## Protocol

- **Scene:** `dam-break`. The column is a × 2a with a = 0.05715 m (2.25 in, the Martin & Moyce case) and g = 9.81. Method defaults otherwise: cfac = 10 (c0 = 10·√(2g·2a) = 14.98 m/s, E = ρ0 c0²), acoustic cfl = 0.4 with adaptive dt, bc = 0 (mpm88 separating slip walls), tank 5a × 3a, 4 particles per cell on a regular 2×2 sub-lattice.
- **Units:** Z = front/a, T = t·√(2g/a).
- **Primary reference:** `dam-break-mm-front-lethe`, its 13 points with 0 < T ≤ 3.
  - Suggested check: max |Z_sim − Z_ref| ≤ 0.25 after one time shift dT in [0, 0.25] (Z_sim(T − dT) vs Z_ref(T)), searched in steps of 0.005. The unshifted error is also reported. Tolerance not altered.
- **Secondary:** `dam-break-mm-front-a225`, extended 12a tank at N = 32, scored over 0 < T ≤ 3; T up to 6.82 reported for information.
- **Ritter bound:** `dam-break-ritter-front-bound`, Z ≤ 1 + 2T, checked every step.
- **Resolution:** N = 16, 32, 64, 96 cells across a (2 048 / 8 192 / 32 768 / 73 728 particles). Primary N = 96, the finest that fits the budget (204 s alone).
- **Sensitivity (N = 32):** cfac = 20, bc = 1 (sticky side walls), cfl = 0.2.
- **Conservation:**
  - Mass: exact (fixed particle masses).
  - Transfer momentum: the method's own P2G and G2P mismatch diagnostics (grid vs particle momentum, normalised by M·vmax), sampled every 5 steps, step 1 skipped (vmax = 0). For quadratic B-splines the APIC affine and stress terms sum to zero over the stencil, so both should be round-off. Reviewer criterion ≤ 1e-10. Total momentum is n/a (gravity, walls).
  - Energy: E = KE + PE + elastic, elastic = Σ V_p E (J_p − 1)²/2 (work of p = −E(J − 1); reviewer-derived). Criterion max (E − E0)/E0 ≤ 1e-3 (reviewer choice, same as the PBF review).
- **Stability:** no NaN / `diverged()`; acoustic CFL ≤ 0.51 (mpm88 value derived in research/ptc.md); |v|dt/dx < 1 (method's stencil criterion); no position clamps.
- **Compressibility:** Mach, max |J − 1| and particle-mean |J − 1| (time-averaged) over 0 < T ≤ 3. Reviewer criterion: mean |J − 1| ≤ 1 % (the δρ/ρ ~ Ma² rule behind c0 = 10U).

## Raw numbers

### Front vs Lethe copy, 0 < T ≤ 3

| N | particles | steps | Z(1) | Z(2) | Z(3) | unshifted max\|dZ\| | best dT | shifted max\|dZ\| |
|---|---|---|---|---|---|---|---|---|
| 16 | 2 048 | 1 853 | 1.487 | 2.647 | 4.077 | 0.365 | 0.20 | 0.097 |
| 32 | 8 192 | 3 707 | 1.542 | 2.665 | 4.089 | 0.372 | 0.22 | 0.090 |
| 64 | 32 768 | 7 420 | 1.565 | 2.670 | 4.112 | 0.393 | 0.235 | 0.087 |
| 96 | 73 728 | 11 133 | 1.565 | 2.675 | 4.116 | 0.398 | 0.24 | **0.085** |

N = 96 pointwise residuals at dT = 0.24 range from −0.085 (T = 0.41) to +0.081 (T = 1.19). Unshifted, the simulation leads the data by 0.20–0.40 for T ≥ 0.84, as the reference anticipates ("expect ~0.3 extra error near T = 1–2"). The smallest shift that meets 0.25 is 0.09–0.10 at every resolution; the best-fit shift creeps toward the 0.25 edge with refinement. Z(3) changes by 0.005 between N = 64 and 96 (near converged).

### Other quantities

- **PySPH a = 2.25 in, T ≤ 3** (N = 32, 12a tank): max |dZ| = 0.063 at dT = 0.25 (unshifted 0.41).
- **Late time, information only:** to T = 6.82, max |dZ| = 0.565 at T = 6.31 even with dT = 0.25 (unshifted 1.05). Fitted slope dZ/dT over T = 5.1–6.85: 1.91 (sim) vs 1.79 (data), Ritter 2. The front reaches 0.9 L at T = 6.71. Outside the reference's suggested window, so not scored, but the method's front runs ahead of the experiment at late time more than PBF did (0.31).
- **Ritter bound:** max (Z − 1 − 2T) = −0.019 / −0.0095 / −0.0048 / −0.0032 at N = 16/32/64/96 (first step, the dx/4 seeding offset). Never exceeded, including the extended run.
- **Mass:** drift exactly 0.
- **Transfer momentum:** max P2G mismatch 1.9e-15 / 4.3e-15 / 8.4e-15 / 1.2e-14; max G2P 2.1e-15 / 3.1e-15 / 6.7e-15 / 1.2e-14. Round-off in every run (sensitivity and extended runs included).
- **Energy:** initial elastic energy 1.7e-3 E0 (hydrostatic J). Max (E − E0)/E0 = −4.2e-5 / −2.1e-5 / −1.0e-5 / −6.8e-6 (at the first sample). E(T = 3)/E0 − 1 = −1.5 % / −2.2 % / −3.1 % / −4.0 %; dissipation grows with resolution here (opposite to PBF). Extended run: −11.2 % at T = 9.4.
- **Stability:** no NaN or divergence. Acoustic CFL ≤ 0.4001; max |v|dt/dx = 0.040 (0.053 extended); 0 clamps.
- **Compressibility:** max Mach 0.109–0.111. Max |J − 1| = 1.19 % / 1.58 % / 1.83 % / 2.59 % (local peaks, growing with resolution); time-averaged mean |J − 1| = 0.125 % / 0.122 % / 0.121 % / 0.120 %. With cfac = 20: Mach 0.055, max 0.89 %, mean 0.035 %.

### Sensitivity (N = 32)

| run | Z(3) | unshifted | best dT | shifted | max ΔE/E0 | max \|J−1\| |
|---|---|---|---|---|---|---|
| default | 4.089 | 0.372 | 0.22 | 0.090 | −2.1e-5 | 1.58 % |
| cfac = 20 | 4.088 | 0.373 | 0.215 | 0.095 | −5.2e-6 | 0.89 % |
| bc = 1 | 4.043 | 0.340 | 0.21 | 0.089 | −2.1e-5 | 2.21 % |
| cfl = 0.2 | 4.091 | 0.376 | 0.22 | 0.091 | −2.0e-5 | 1.20 % |

The front history is insensitive to sound speed, time step and side-wall condition.

## Classification

**matched** (CONTRACTS §6): every scored gap is within the reference tolerance (0.085 vs 0.25 at the finest resolution, all resolutions pass, secondary copy 0.063), the Ritter bound holds, mass is exact, transfer momentum is at round-off, energy never increases, the run is stable within the stated CFL/stencil criteria, and compressibility stays small (mean |J − 1| 0.12 %). The reference values come from open copies (Lethe, PySPH; verified:true), although the original Martin & Moyce paper is not verified.

Caveats kept in the record: the pass relies on the allowed gate-delay shift (unshifted 0.40 > 0.25), and the best shift sits near the edge of the allowed range at fine resolution (a shift of 0.10 already suffices). Late-time agreement (T > 3) is not established (lead up to 0.57).

## Missing

- `martin1952` is verified:false (paywalled; not read). Values come from two open copies that agree to |dZ| ≤ 0.08.
- `ritter1892-pysph` is verified:false for bibliographic details; the 2√(gH0) bound was confirmed in PySPH code.
- `hu2018mlsmpm` is verified:false (snippets only); equations come from the open mpm88 / mls-mpm88-explained codes. The EOS p = −E(J − 1) is a research interpretation.
- No published quantitative MLS-MPM dam-break validation exists in research/ptc.md; the comparison is with experiment only.
- The time shift is a reference allowance not quantified by any source.
- No reference for residual column height. The `column_height` probe is resolution dependent (0.47 at N ≤ 64, 0.36 at N = 96 at T = 3.05).
- Energy, transfer-momentum and compressibility thresholds are reviewer choices.
- N > 96 and mpm88-style random seeding were not run within the budget.
