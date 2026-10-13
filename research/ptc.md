# Research report: particle and hybrid fluid methods (ptc group)

Scope: WCSPH, Position Based Fluids (PBF) and MLS-MPM; the `dam-break` scene; SPH on `taylor-green`.
Date: 2026-10-13. Machine-readable version: `research/ptc.json`. Sources: `references/sources-ptc.js`. References: `references/dam-break.js`.

## How the material was obtained

This container blocks DNS for arXiv, publisher sites and most author homepages. That rules out reading the PDFs of Monaghan 1994, Becker & Teschner 2007, Macklin & Müller 2013, Hu et al. 2018 and Martin & Moyce 1952. The material came from these channels:

| Channel | What was read | Verified? |
|---|---|---|
| PyPI sdist `pysph-1.0b2.tar.gz` (BSD). It was downloaded with curl from files.pythonhosted.org into the scratchpad and unpacked. It was not installed or executed. | `examples/db_exp_data.py`, `examples/dam_break_2d.py`, `examples/taylor_green.py`, `examples/shallow_water/rectangular_dambreak.py`, `sph/wc/basic.py`, `sph/basic_equations.py` | full text |
| Sparse git clone of `chaos-polymtl/lethe` (commit 40ffaed6) | `examples/multiphysics/dam-break/dam-break-2d.py`, `doc/.../dam-break.rst` | full text |
| raw.githubusercontent.com | taichi `mpm88.py` and `pbf2d.py` (Apache-2.0); `taichi_mpm/mls-mpm88-explained.cpp` (MIT); SPlisHSPlasH `TimeStepWCSPH.cpp` and `TimeStepPBF.{h,cpp}` (MIT) | full text |
| GitLab clones `prabhu/edac_sph` and `pypr/convergence_sph` (manuscript LaTeX) | EDAC-SPH results section (Taylor–Green, dam break); Negi & Ramachandran TG convergence section | full text of the LaTeX. The figures are not included, so curve values cannot be read. |
| WebSearch snippets | Parameter statements from Macklin 2013, Becker & Teschner 2007 and Monaghan 1994. Also confirmed the Martin & Moyce DOI. | snippet only (`verified:false`) |

## Dam break (`dam-break`)

### Conventions
- Z = x_front / a, with the front measured from the back wall. T = t·√(2g/a). Martin & Moyce, PySPH and Lethe all use this convention.
- The Koshizuka-style time is t·√(g/a), which equals T/√2. The height-based time is t·√(g/H) with H = 2a, which equals T/2.
- The scene probe `front` is in physical units. A checker therefore needs Z = front/a and T = t·√(2g/a).

### Martin & Moyce surge front (n² = 2)
Two independent open copies were found:
1. **Lethe** `dam-break-2d.py`: 14 points for T ≤ 2.96. The Z values step by 1/9, which is 0.25 in divided by a = 2.25 in. The file cites DOI 10.1098/rsta.1952.0006. This is registered as `dam-break-mm-front-lethe` and is the primary reference.
2. **PySPH** `db_exp_data.py`: points "extracted from plots" (Fig. 3). There are two series, a = 2.25 in (15 points, T up to 9.24) and a = 1.125 in (10 points). These are registered as `dam-break-mm-front-a225` and `-a1125`.

Cross-check, computed here by linear interpolation of the Lethe table:
- PySPH a = 2.25 in vs Lethe: ΔZ = −0.011, +0.006, −0.065, −0.079 at T = 0.83, 1.22, 2.00 and 2.55.
- PySPH a = 1.125 in vs Lethe: |ΔZ| ≤ 0.074.
- Conclusion: the copies agree to about 0.08 in Z. That is consistent with digitisation error plus experimental scatter.

### Koshizuka & Oka curve
PySPH `ko_data` is labelled as Koshizuka & Oka (1996) and plotted in `dam_break_2d.py` as Z/L against t·√(2g/L).
- It differs from the Martin & Moyce copies by up to 0.31 in Z at T = 2.72. It runs ahead of them around T ≈ 1.5 and behind them for T > 2.3.
- Its provenance is unclear. PySPH keeps a separate `ko_mps_data` labelled as MPS results, but the EDAC manuscript calls the curve it compares against the "MPS scheme" of K&O.
- It is registered (`dam-break-ko-front`) for diagnostics only and should not be used for pass/fail.

### Ritter bound
The dry-bed shallow-water front speed is 2√(g H0). This was confirmed in the PySPH SWE example `pos_actual` with h = 0.
- With H0 = 2a this gives **Z ≤ 1 + 2T**. It is registered as the function reference `dam-break-ritter-front-bound`. A physical-units helper `fnPhysical(t, a, H0, g)` is included.
- The late-time slope dZ/dT in the PySPH a = 2.25 in series is about 1.69 for T between 5.1 and 9.2. I derived this from the data; it is not stated by any source. It is below the Ritter value of 2, as expected.

### Tolerance suggestion
max |Z_sim − Z_ref| ≤ 0.25 over 0 < T ≤ 3. The comparison may use one time shift ΔT in [0, 0.25], and the shift must be reported.
- Lethe adds +0.175 to the simulated T. This shift is empirical and not explained in its docs. The usual reason in the literature is gate-opening delay plus early-time drag.
- Without a shift, an ideal simulation will lead the experiment by about 0.1–0.3 in Z around T = 1–2.

### Column height
**Missing.** No open copy of Martin & Moyce's residual column height (H/2a vs T) was found. Search snippets only confirm that the paper reports it, so no reference was registered.

### Discrepancies
- **DOI:** PySPH's docstring gives 10.1098/rsta.1952.0007. Lethe and the royalsocietypublishing.org URL found by search give .0006. Part V of the series (pp. 325–334) is the likely .0007, so .0006 is used.
- **Koshizuka & Oka:** the data's provenance is ambiguous, as described above.

## Methods

### WCSPH (`wcsph`)
- **Equations:** the Tait EOS, the Monaghan momentum equation with artificial viscosity, continuity and XSPH come from PySPH docstrings (full text). The Tait form also appears in SPlisHSPlasH (stiffness 50, exponent 7).
- **Becker & Teschner:** from snippets, the density variation is about v²/c_s² and must stay below η = 0.01, which gives c_s ≥ 10 v_max.
- **Practical dam-break parameters** (PySPH, after Gomez-Gesteira 2010): γ = 7, c0 = 10·√(2gH) = 62.6 m/s for H = 2 m, α = 0.1, β = 0, h = 1.3 dx, dx = 0.03 m, Wendland quintic kernel, dt = 0.125 h/c0, 1 m × 2 m column in a 4 m tank.
- **Not verified:** Monaghan 1994's specific B (the often-quoted 200 ρgH/γ could not be confirmed); Becker & Teschner's artificial-viscosity form and time-step coefficients (a 2012 paper citing them uses λ_v = 0.1, λ_f = 0.25); the cubic-spline normalisation constant.

### PBF (`pbf`)
- **From paper snippets:**
  - Constraint C_i = ρ_i/ρ0 − 1.
  - s_corr with |Δq| = 0.1–0.3h, k = 0.1, n = 4.
  - XSPH c = 0.01.
  - Vorticity confinement is applied as a velocity post-process.
- **Cross-checked against open code:**
  - SPlisHSPlasH computes λ = −C/(Σ|∇C|² + ε) with ε = 1e-6.
  - taichi `pbf2d.py` implements the Δp update with s_corr, using poly6 and spiky kernels and 5 iterations.
  - Taichi uses k = 0.001 with Δq = 0.3h. That is a scale-dependent deviation from the paper's k = 0.1.
- **Not found:** equation numbers, and any quantitative dam-break validation of PBF. Expect extra damping from XSPH and iterations that are not run to convergence.

### MLS-MPM (`mls-mpm`)
- **Source of the equations:** all update equations come from the authors' open codes, read in full:
  - quadratic B-spline weights
  - D⁻¹ = 4/Δx²
  - fused P2G affine term m_p C_p − Δt V_p D⁻¹ E(J−1) I
  - grid update with separating walls 3 cells thick
  - APIC G2P with C_p = (4/Δx²) Σ w v_i (x_i − x_p)ᵀ
  - J ← J(1 + Δt tr C)
- **EOS:** the implied fluid EOS is p = −E(J−1) with c = √(E/ρ). That is my interpretation of the code.
- **mpm88 parameters:** 128² grid, 8192 particles, dt = 2e-4, E = 400, ρ = 1, g = 9.8. These give an acoustic CFL of about 0.51 (derived here).
- **Not available:** the paper itself (snippets only), and any quantitative dam-break validation.

## SPH on Taylor–Green
- **Setup** (PySPH `taylor_green.py` and the EDAC manuscript): unit periodic box, b = −8π²/Re, Re = 100, U = 1, c0 = 10U, nx = 50, quintic spline. EDAC adds a random initial perturbation of at most dx/5. Kinetic energy decays as exp(2bt).
- **Recorded (qualitative only):**
  - Adami 2013's uniform initial lattice gives about 10× more error than its relaxed initial condition (as reported in the EDAC manuscript).
  - The EDAC (TVF) L1 velocity error is about 4× lower than TVF's.
  - Standard WCSPH is the least accurate of the schemes compared.
  - Classical WCSPH and TVF do not converge with resolution (Negi & Ramachandran).
- **Missing:** numeric error values. The figures are not in the manuscript repos and Adami 2013 is paywalled. Any SPH TG tolerance therefore has to come from the analytic solution, not from published SPH errors.

## Missing items (summary)
1. Martin & Moyce column height H/2a(T). No open copy was found.
2. The original Martin & Moyce, Koshizuka & Oka, Monaghan 1994 and Adami 2013 papers (paywalled), and the author PDFs of Becker & Teschner, Macklin & Müller and Hu et al. (hosts blocked). Equation numbers for these papers are unverified.
3. Published quantitative PBF and MLS-MPM dam-break validations.
4. Numeric SPH Taylor–Green error values.
