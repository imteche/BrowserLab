# Hyperbolic conservation laws: research report

Researcher: hyp researcher agent, 2026-10-13.
Scenes: `sod`, `swe-dambreak`. Methods: `lax-friedrichs`, `hllc-godunov`, `muscl-hancock`, `hll-swe`.
Files: `references/sources-hyp.js`, `references/sod.js`, `references/swe-dambreak.js`, `research/hyp.json`, `research/test-exact-solvers.js`.

## 1. Access: what could be read

arxiv.org, ar5iv, HAL, Wiley/Elsevier/Springer, readthedocs, sourcesup.renater.fr and university hosts were all DNS- or proxy-blocked. The GitHub API refused unattached repos. Two routes worked: plain `git clone` of public GitHub repos and `pip download` of PyPI sdists.

| source id | what | access | verified |
|---|---|---|---|
| `sodshock2015` | ibackus/sod-shocktube (MIT), commit 06cd0b8 | full text (README, tests) | yes |
| `clawpack-riemann` | clawpack/riemann (BSD-3), commit b0d609c: `euler_hllc_1D`, `shallow_hll_1D` | full text | yes |
| `riemannbook2020` | clawpack/riemann_book (code BSD, text CC BY-NC-ND), commit 5b171f1 | full text (notebooks, `exact_solvers/shallow_water.py`) | yes |
| `zingale-cha` | Open-Astrophysics-Bookshelf/numerical_exercises (CC BY-NC-SA), commit 2d00145 | full LaTeX source | yes |
| `swift-riemann-tests` | SWIFT `tests/testRiemannExact.c` (LGPL), commit 6b12e68 | full text | yes |
| `tilupy2025` | tilupy 2.1.1 sdist (CeCILL-C), `analytic_sol.py` | full text | yes |
| `swashes2013` | Delestre et al. 2013, **arXiv:1110.0288** | secondary copy (tilupy) + snippets | no |
| `toro2009`, `toro1994hllc`, `sod1978`, `hll1983`, `einfeldt1988`, `lax1954`, `vanleer1979`, `ritter1892`, `stoker1957` | paywalled originals | cited through the open copies above | no |
| `mackey-shocktubes`, `rusanov2024` (arXiv:2412.03522), `ader2023` (arXiv:2301.08473), `fullswof2014` (arXiv:1401.4125) | open but blocked | search snippets only | no |

## 2. Discrepancies

1. **SWASHES arXiv id.** The brief gives arXiv:1111.6248. Every search result gives **arXiv:1110.0288** (HAL hal-00628246, DOI 10.1002/fld.3741). I used 1110.0288.
2. **Stoker c_m equation (important).** tilupy 2.1.1 (`Stoker_SWASHES_wet.equation_cm`), which says it implements SWASHES, writes
   `-8 g h_r c_m^2 (g h_l - c_m^2)^2 + (c_m^2 - g h_r)^2 (c_m^2 + g h_r) = 0`.
   This equation is dimensionally inconsistent (velocity^8 on one side, velocity^6 on the other). Its root breaks the Rankine–Hugoniot conditions: for h_l=1, h_r=0.1 it gives h_m=0.752, but the true value is 0.3962. The first version of my test caught this (15 failures in RH and momentum checks). Researcher-built HLL schemes also did not converge to it (L1 stuck at 7–11%).
   The correct relation sets the 1-rarefaction invariant `u_m = 2(sqrt(g h_l) - c_m)` equal to the 2-shock Hugoniot locus `u_m = (h_m-h_r) sqrt(g(h_m+h_r)/(2 h_m h_r))` (riemann_book `shallow_water.py`). That gives
   `-8 g h_r c_m^2 (sqrt(g h_l) - c_m)^2 + (c_m^2 - g h_r)^2 (c_m^2 + g h_r) = 0`.
   `references/swe-dambreak.js` uses this corrected form. I could not check which form the SWASHES PDF prints. The x_A, x_B, x_C, h and u formulas in tilupy are correct and match the RH mass jump to machine precision.
3. **Toro Table 4.3 values.** The book could not be read. The four values in the brief (p*=0.30313, u*=0.92745, ρ*L=0.42632, ρ*R=0.26557) are confirmed as follows:
   - p* and u*: to 4 decimals by an arXiv:2412.03522 search snippet ("0.9274 | 0.3031 | R-S").
   - All four: to 17 digits by the sodshock README, which is an independent implementation.
   They are recorded as `toro2009`, `verified: false`.
4. **Modified Sod (Toro Test 1).** Parameters come from a search snippet of Mackey's Bonn page: [ρ,p,u]_L = [1,1,0.75], [0.125,0.1,0], t=0.2, x0=0.3, γ=1.4, citing Toro 1999 p.225. No published star values were found. The values in `hyp.json` are computed by our solver and labelled as computed.
5. **SWASHES test set-up.** hl = 0.005 m, x0 = 5 m and L = 10 m are confirmed by snippets from SWASHES and FullSWOF. **Stoker h_r = 0.001 m and T = 6 s come from my recollection.** They are marked unverified in the reference files.
6. **Sod γ.** Zingale's notes carry a "double check" margin note next to γ = 1.4. The sodshock README states 1.4. This is not a real conflict.

## 3. Exact solvers

* `references/sod.js`: an exact Riemann solver for the ideal-gas Euler equations, following the Toro ch. 4 algorithm.
  - Pressure functions with shock and rarefaction branches.
  - PVRS initial guess, then Newton on f_L+f_R+Δu=0 to a relative change of 1e-15 (4 iterations for Sod).
  - u* = ½(u_L+u_R)+½(f_R−f_L).
  - Full sampling of fans, shocks and contacts on both sides.
  - Throws on vacuum generation.
  - `fn(x,t,params) -> {rho,u,p,e}` with e = p/((γ−1)ρ), the same convention as sodshock `energy`.
  - Helpers attached to the function (outside the contract): `fn.star(params)` and `fn.wavePositions(t, params)`.
* `references/swe-dambreak.js`:
  - Ritter's closed form.
  - Stoker's solution, with c_m from safeguarded Newton (Newton plus bisection on the sign-changing bracket (√(g h_r), √(g h_l))).
  - `fn(x,t,params) -> {h,u}`. Stoker falls back to Ritter when h_r ≤ 0.

### Validation (`node research/test-exact-solvers.js`): 80/80 pass

| check | result |
|---|---|
| p*, u*, ρ*L, ρ*R vs Toro 5-digit values | errors 1.8e-7, 2.6e-6, 5.7e-7, 3.7e-6 (pass at 1e-4 and at the 5e-6 rounding band) |
| same vs sodshock 17-digit values | ≤ 6.7e-16 |
| shock / contact / rarefaction head / tail at t=0.2 vs sodshock | ≤ 2.2e-16 |
| RH mass, momentum, energy at shock; isentrope in fan | ≤ 4.4e-16 |
| W(x/t=0) vs SWIFT Toro tests 1–5 at γ=5/3 (float32 data) | rel ≤ 6.3e-5 (largest on near-vacuum test 2) |
| Stoker h_m, u_m, shock speed vs independent Hugoniot + integral-curve bisection solver (3 configs) | rel ≤ 3e-16 |
| Stoker / Ritter mass and momentum integrals vs conservation laws | rel ≤ 7e-7 (quadrature-limited) |
| Ritter: front 2√(ghl)t, critical depth 4hl/9 at x0, u=⅔√(ghl) at x0 | exact |

## 4. Tolerances: no published L1 tables found

I found no open source that tabulates L1 errors on Sod or the dam breaks at N=100/200/400. Leads that turned up but could not be reached or used:
- ANU Fyris Sod convergence page (no numbers in the snippet).
- NTNU 2016 HLL supplement (snippet truncated).
- arXiv gr-qc/0512104 (a relativistic shock tube, so not applicable).

The L1 bands in the reference files are therefore **BrowserLab engineering bands**, set at about 1.4× the errors of researcher scratch schemes (`--calibrate`). The rationale strings say this. Textbook convergence-order statements (≈N^-1/2 at contacts for first order, ≈N^-2/3 for second order) are recollection and are not cited. The observed orders are in the calibration output below. Plateau and wave-position bands (2%/1%, ±0.01) are also engineering choices.

Calibration setup: transmissive BCs, CFL 0.9.
- Euler fluxes: HLLC with Davis speeds. MUSCL-Hancock uses minmod on conservative variables.
- Shallow water: HLL with Einfeldt/Roe speeds and dry-front speeds u±2c. MUSCL-Hancock uses a positivity fallback.
- Error measure: L1 of cell averages against the exact value at cell centres. For SWE the depth error is relative.

## 5. Gaps / missing

- Toro 2009 equation numbers (Ch. 4, Ch. 10 HLLC, Sec. 14.4 MUSCL-Hancock, Davis speed estimates) are unverified.
- The MUSCL-Hancock half-step formula comes only from snippets plus recollection. The van Leer limiter formula is recollection.
- The SWASHES PDF was not read: no equation numbers, and Stoker h_r=0.001 and T=6 s are unverified.
- No published L1 error tables were found.
- No open published star values for modified Sod.
- Lax 1954, HLL 1983, Einfeldt 1988, Toro–Spruce–Speares 1994, Ritter 1892 and Stoker 1957 originals were not read.

## 6. Test output (`node research/test-exact-solvers.js --calibrate`)

```

# Sod (gamma=1.4): exact solver converged in 6 Newton iterations
## vs Toro (2009) Table 4.3 Test 1, 5 published decimals (values as quoted in task brief / scalar refs)
PASS  p*   vs 0.30313                                      got   0.303130178051  want              0.30313  abserr 1.78e-7 (tol 0.0001)
PASS  u*   vs 0.92745                                      got   0.927452620049  want              0.92745  abserr 2.62e-6 (tol 0.0001)
PASS  rho*L vs 0.42632                                     got   0.426319428178  want              0.42632  abserr 5.72e-7 (tol 0.0001)
PASS  rho*R vs 0.26557                                     got   0.265573711705  want              0.26557  abserr 3.71e-6 (tol 0.0001)
## same, at the rounding band of the published digits (5e-6)
PASS  p*   rounding band                                   got   0.303130178051  want              0.30313  abserr 1.78e-7 (tol 0.000005)
PASS  u*   rounding band                                   got   0.927452620049  want              0.92745  abserr 2.62e-6 (tol 0.000005)
PASS  rho*L rounding band                                  got   0.426319428178  want              0.42632  abserr 5.72e-7 (tol 0.000005)
PASS  rho*R rounding band                                  got   0.265573711705  want              0.26557  abserr 3.71e-6 (tol 0.000005)
## vs sodshock README (ibackus/sod-shocktube, MIT; independent Python implementation, 17 digits)
PASS  p*   vs sodshock                                     got   0.303130178051  want  0.30313017805064707  abserr 2.22e-16 (tol 1e-12)
PASS  u*   vs sodshock                                     got   0.927452620049  want   0.9274526200489506  abserr 6.66e-16 (tol 1e-12)
PASS  rho*L vs sodshock                                    got   0.426319428178  want  0.42631942817849544  abserr 2.22e-16 (tol 1e-12)
PASS  rho*R vs sodshock                                    got   0.265573711705  want  0.26557371170530725  abserr 1.67e-16 (tol 1e-12)
PASS  x_shock(t=0.2) vs sodshock                           got   0.850431146406  want   0.8504311464060357  abserr 0.00e+0 (tol 1e-12)
PASS  x_contact(t=0.2) vs sodshock                         got   0.685490524010  want   0.6854905240097902  abserr 2.22e-16 (tol 1e-12)
PASS  x_raref_head(t=0.2) vs sodshock                      got   0.263356808676  want  0.26335680867601535  abserr 0.00e+0 (tol 1e-12)
PASS  x_raref_tail(t=0.2) vs sodshock                      got   0.485945437488  want   0.4859454374877634  abserr 1.11e-16 (tol 1e-12)
## sampled profile fn(x, 0.2) inside each plateau
PASS  fn(0.60).rho = rho*L                                 got   0.426319428178  want   0.4263194281784952  abserr 0.00e+0 (tol 1e-14)
PASS  fn(0.60).p = p*                                      got   0.303130178051  want  0.30313017805064685  abserr 0.00e+0 (tol 1e-14)
PASS  fn(0.75).rho = rho*R                                 got   0.265573711705  want   0.2655737117053071  abserr 0.00e+0 (tol 1e-14)
PASS  fn(0.75).u = u*                                      got   0.927452620049  want   0.9274526200489499  abserr 0.00e+0 (tol 1e-14)
PASS  fn(0.10).rho = rho_L (undisturbed)                   got    1.00000000000  want                    1  abserr 0.00e+0 (tol 0)
PASS  fn(0.95).rho = rho_R (undisturbed)                   got   0.125000000000  want                0.125  abserr 0.00e+0 (tol 0)
PASS  rarefaction continuous at tail (rho)                 got   0.426319429959  want   0.4263194281784952  abserr 1.78e-9 (tol 1e-7)
PASS  rarefaction continuous at head (rho)                 got   0.999999996479  want                    1  abserr 3.52e-9 (tol 1e-7)
PASS  fn(0.6).e = p/((g-1)rho)                             got    1.77760006942  want   1.7776000694233527  abserr 4.44e-16 (tol 1e-14)
## Rankine-Hugoniot at the right shock (mass, momentum, energy flux continuity in the shock frame)
PASS  RH mass                                              got -5.55111512313e-17  want                    0  abserr 5.55e-17 (tol 1e-13)
PASS  RH momentum                                          got 5.55111512313e-17  want                    0  abserr 5.55e-17 (tol 1e-13)
PASS  RH energy                                            got -4.44089209850e-16  want                    0  abserr 4.44e-16 (tol 1e-13)
PASS  isentropic rarefaction p/rho^g                       got    1.00000000000  want                    1  abserr 0.00e+0 (tol 1e-13)
## Interface state W(x/t=0) vs SWIFT testRiemannExact.c (Toro tests 1-5, LGPL, float32 values, gamma=5/3)
PASS  SWIFT T1 rho(x/t=0)                                  got   0.479689058721  want              0.47969  relerr 1.96e-6 (tol 0.0002)
PASS  SWIFT T1 u(x/t=0)                                    got   0.841194852169  want             0.841194  relerr 1.01e-6 (tol 0.0002)
PASS  SWIFT T1 p(x/t=0)                                    got   0.293945187666  want             0.293945  relerr 6.38e-7 (tol 0.0002)
PASS  SWIFT T2 rho(x/t=0)                                  got 0.00617920326500  want           0.00617903  relerr 2.80e-5 (tol 0.0002)
PASS  SWIFT T2 u(x/t=0)                                    got    0.00000000000  want                    0  abserr 0.00e+0 (tol 1e-9)
PASS  SWIFT T2 p(x/t=0)                                    got 0.0000832301723494  want         0.0000832249  relerr 6.34e-5 (tol 0.0002)
PASS  SWIFT T3 rho(x/t=0)                                  got   0.615718554739  want             0.615719  relerr 7.23e-7 (tol 0.0002)
PASS  SWIFT T3 u(x/t=0)                                    got    18.2812071050  want              18.2812  relerr 3.89e-7 (tol 0.0002)
PASS  SWIFT T3 p(x/t=0)                                    got    445.625877270  want              445.626  relerr 2.75e-7 (tol 0.0002)
PASS  SWIFT T4 rho(x/t=0)                                  got   0.615769736052  want              0.61577  relerr 4.29e-7 (tol 0.0002)
PASS  SWIFT T4 u(x/t=0)                                    got   -5.78011235684  want             -5.78022  relerr 1.86e-5 (tol 0.0002)
PASS  SWIFT T4 p(x/t=0)                                    got    44.5687616380  want              44.5687  relerr 1.38e-6 (tol 0.0002)
PASS  SWIFT T5 rho(x/t=0)                                  got    12.7430308432  want               12.743  relerr 2.42e-6 (tol 0.0002)
PASS  SWIFT T5 u(x/t=0)                                    got    8.56044903564  want              8.56045  relerr 1.13e-7 (tol 0.0002)
PASS  SWIFT T5 p(x/t=0)                                    got    1841.82180466  want              1841.82  relerr 9.80e-7 (tol 0.0002)
## Toro modified Sod (uL=0.75, x0=0.3), computed star state (no open published value found)
INFO  modified Sod: p*=0.4662935668 u*=1.360905519 rho*L=0.5798666875 rho*R=0.3397002349
INFO  left rarefaction head speed uL-aL=-0.433216 < 0 < tail speed u*-c*L=0.299871 -> sonic (transonic) rarefaction

# Stoker SWASHES config (hl=0.005, hr=0.001)
INFO  cm=0.157832486707 hm=0.00253935717228 um=0.127279718393 shock speed=0.209963400052 (Newton iters 4)
PASS  c_m-equation residual (scaled by (g hl)^3)           got    0.00000000000  want                    0  abserr 0.00e+0 (tol 1e-13)
PASS  h_m vs independent Hugoniot/integral-curve           got 0.00253935717228  want 0.002539357172283335  relerr 0.00e+0 (tol 1e-10)
PASS  u_m vs independent                                   got   0.127279718393  want   0.1272797183931022  relerr 0.00e+0 (tol 1e-10)
PASS  shock speed x_C/t vs RH mass jump                    got   0.209963400052  want  0.20996340005244554  relerr 0.00e+0 (tol 1e-10)
PASS  RH momentum across shock                             got    0.00000000000  want                    0  abserr 0.00e+0 (tol 2.4525e-16)
PASS  continuity h at rarefaction tail x_B                 got 0.00253935717229  want 0.002539357172283335  relerr 7.04e-13 (tol 1e-8)
PASS  mass integral = x0 hl + (L-x0) hr                    got  0.0299999993848  want 0.030000000000000002  relerr 2.05e-8 (tol 0.000001)
PASS  momentum integral = g/2 (hl^2-hr^2) t                got 0.000706319870616  want 0.0007063200000000001  relerr 1.83e-7 (tol 0.00001)
INFO  waves at t=6: x_A=3.671166 x_B=4.816683 x_C=6.259780 (domain [0,10])

# Stoker unit config (hl=1, hr=0.1)
INFO  cm=1.97141445485 hm=0.396174816799 um=2.32135499564 shock speed=3.10513365067 (Newton iters 4)
PASS  c_m-equation residual (scaled by (g hl)^3)           got 2.25789861083e-17  want                    0  abserr 2.26e-17 (tol 1e-13)
PASS  h_m vs independent Hugoniot/integral-curve           got   0.396174816799  want   0.3961748167994429  relerr 2.80e-16 (tol 1e-10)
PASS  u_m vs independent                                   got    2.32135499564  want   2.3213549956407444  relerr 1.91e-16 (tol 1e-10)
PASS  shock speed x_C/t vs RH mass jump                    got    3.10513365067  want   3.1051336506682135  relerr 0.00e+0 (tol 1e-10)
PASS  RH momentum across shock                             got 8.88178419700e-16  want                    0  abserr 8.88e-16 (tol 9.81e-12)
PASS  continuity h at rarefaction tail x_B                 got   0.396174816802  want    0.396174816799443  relerr 6.76e-12 (tol 1e-8)
PASS  mass integral = x0 hl + (L-x0) hr                    got   0.549999945955  want                 0.55  relerr 9.83e-8 (tol 0.000001)
PASS  momentum integral = g/2 (hl^2-hr^2) t                got   0.242797332133  want            0.2427975  relerr 6.91e-7 (tol 0.00001)
INFO  waves at t=0.05: x_A=0.343395 x_B=0.517497 x_C=0.655257 (domain [0,1])

# Stoker strong ratio (hl=1, hr=1e-4)
INFO  cm=0.484783745306 hm=0.0239567053734 um=5.29461641473 shock speed=5.31680982465 (Newton iters 12)
PASS  c_m-equation residual (scaled by (g hl)^3)           got 1.83748259345e-21  want                    0  abserr 1.84e-21 (tol 1e-13)
PASS  h_m vs independent Hugoniot/integral-curve           got  0.0239567053734  want 0.023956705373368768  relerr 1.45e-16 (tol 1e-10)
PASS  u_m vs independent                                   got    5.29461641473  want    5.294616414734671  relerr 0.00e+0 (tol 1e-10)
PASS  shock speed x_C/t vs RH mass jump                    got    5.31680982465  want    5.316809824645517  relerr 1.67e-16 (tol 1e-10)
PASS  RH momentum across shock                             got    0.00000000000  want                    0  abserr 0.00e+0 (tol 9.81e-12)
PASS  continuity h at rarefaction tail x_B                 got  0.0239567053740  want  0.02395670537336877  relerr 2.75e-11 (tol 1e-8)
PASS  mass integral = x0 hl + (L-x0) hr                    got   0.500050000196  want              0.50005  relerr 3.92e-10 (tol 0.000001)
PASS  momentum integral = g/2 (hl^2-hr^2) t                got   0.245249998660  want      0.2452499975475  relerr 4.54e-9 (tol 0.00001)
INFO  waves at t=0.05: x_A=0.343395 x_B=0.740492 x_C=0.765840 (domain [0,1])

# Ritter SWASHES config (hl=0.005)
PASS  front x_B = x0 + 2 sqrt(g hl) t                      got    7.65766815084  want    7.657668150842012  abserr 0.00e+0 (tol 1e-14)
PASS  h at x0 (critical depth 4hl/9)                       got 0.00222222222222  want 0.0022222222222222222  abserr 0.00e+0 (tol 1e-15)
PASS  u at x0 (= 2/3 sqrt(g hl))                           got   0.147648230602  want    0.147648230602334  abserr 0.00e+0 (tol 1e-15)
PASS  mass integral = x0 hl                                got  0.0250000000003  want                0.025  relerr 1.14e-11 (tol 1e-8)
PASS  momentum integral = g hl^2 t / 2                     got 0.000735750000000  want 0.0007357500000000001  relerr 4.78e-13 (tol 1e-8)
PASS  Stoker(hr->1e-9 hl) shock speed -> Ritter front speed 2c got   0.438780282396  want    0.442944691807002  relerr 9.40e-3 (tol 0.02)

# Ritter unit config (hl=1)
PASS  front x_B = x0 + 2 sqrt(g hl) t                      got   0.813209195267  want   0.8132091952673166  abserr 0.00e+0 (tol 1e-14)
PASS  h at x0 (critical depth 4hl/9)                       got   0.444444444444  want   0.4444444444444444  abserr 5.55e-17 (tol 1e-15)
PASS  u at x0 (= 2/3 sqrt(g hl))                           got    2.08806130178  want     2.08806130178211  abserr 0.00e+0 (tol 1e-15)
PASS  mass integral = x0 hl                                got   0.500000000000  want                  0.5  relerr 2.52e-14 (tol 1e-8)
PASS  momentum integral = g hl^2 t / 2                     got   0.245250000000  want  0.24525000000000002  relerr 3.27e-13 (tol 1e-8)
PASS  Stoker(hr->1e-9 hl) shock speed -> Ritter front speed 2c got    6.20529026267  want     6.26418390534633  relerr 9.40e-3 (tol 0.02)

SUMMARY: 80 passed, 0 failed

# Calibration runs (researcher scratch schemes; transmissive BCs; L1 vs exact at cell centres)
CAL  Sod           lf       L1(rho) N=100: 2.848e-2  N=200: 2.017e-2  N=400: 1.363e-2  order(100->200)=0.50 order(200->400)=0.57
CAL  Sod           godunov  L1(rho) N=100: 1.475e-2  N=200: 9.366e-3  N=400: 5.970e-3  order(100->200)=0.66 order(200->400)=0.65
CAL  Sod           muscl    L1(rho) N=100: 6.581e-3  N=200: 3.581e-3  N=400: 1.997e-3  order(100->200)=0.88 order(200->400)=0.84
CAL  modified Sod  lf       L1(rho) N=100: 3.402e-2  N=200: 2.453e-2  N=400: 1.677e-2  order(100->200)=0.47 order(200->400)=0.55
CAL  modified Sod  godunov  L1(rho) N=100: 1.354e-2  N=200: 8.797e-3  N=400: 5.778e-3  order(100->200)=0.62 order(200->400)=0.61
CAL  modified Sod  muscl    L1(rho) N=100: 6.800e-3  N=200: 4.003e-3  N=400: 2.398e-3  order(100->200)=0.76 order(200->400)=0.74
CAL  Stoker SWASHES  hll       relL1(h) N=100: 1.359e-2  N=200: 7.548e-3  N=400: 4.326e-3  order(100->200)=0.85 order(200->400)=0.80
CAL  Stoker SWASHES  muscl-hll relL1(h) N=100: 7.315e-3  N=200: 3.212e-3  N=400: 1.673e-3  order(100->200)=1.19 order(200->400)=0.94
CAL  Stoker unit     hll       relL1(h) N=100: 1.678e-2  N=200: 8.998e-3  N=400: 5.225e-3  order(100->200)=0.90 order(200->400)=0.78
CAL  Stoker unit     muscl-hll relL1(h) N=100: 9.096e-3  N=200: 3.713e-3  N=400: 1.803e-3  order(100->200)=1.29 order(200->400)=1.04
CAL  Ritter SWASHES  hll       relL1(h) N=100: 1.846e-2  N=200: 1.146e-2  N=400: 6.771e-3  order(100->200)=0.69 order(200->400)=0.76
CAL  Ritter SWASHES  muscl-hll relL1(h) N=100: 1.225e-2  N=200: 6.221e-3  N=400: 3.118e-3  order(100->200)=0.98 order(200->400)=1.00
CAL  Ritter unit     hll       relL1(h) N=100: 1.959e-2  N=200: 1.196e-2  N=400: 7.027e-3  order(100->200)=0.71 order(200->400)=0.77
CAL  Ritter unit     muscl-hll relL1(h) N=100: 1.231e-2  N=200: 6.222e-3  N=400: 3.124e-3  order(100->200)=0.98 order(200->400)=0.99
```
