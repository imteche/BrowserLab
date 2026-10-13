# Incompressible Navier–Stokes: what the references are and where they came from

Researcher agent, 2026-10-13. Covers the `cavity`, `taylor-green` and `cylinder` scenes and the `lbm-d2q9`, `psi-omega-fd` and `stable-fluids` methods.
Files: `references/sources-ins.js`, `references/cavity.js`, `references/taylor-green.js`, `references/cylinder.js`, `research/ins.json`.

## Network conditions

From this container, arxiv.org, Wikipedia, publisher sites, NASA, FeatFlow (tu-dortmund) and university PDF hosts did not resolve or were refused, for both curl and WebFetch. The GitHub REST search API was also refused. Two routes worked:

* `git clone` of public GitHub repos and gists, the main data route;
* `registry.npmjs.org`.

The web-search tool returned snippets only. As a result, I did not read any primary paper myself, and every source is registered with `verified: false`. Each number below comes from open copies that agree with each other, sometimes with a search snippet as a third check.

## Cavity (Ghia, Ghia & Shin 1982; Erturk et al. 2005; Botella & Peyret 1998)

| data | copies compared | result |
|---|---|---|
| Table I u(x=0.5), Re=100 | gist ivan-pi `ghiau.txt`; sujaldave/2DLidDrivenCavityBenchmark `literature/ghia_table_I_u.csv`; cfdgasman/lid-driven-cavity `cavity/ghia.py` (MIT); lethe `ref-2d-ghia-u.txt` (4 dp); amikkonen `ldc.py` (4 dp) | identical (the 4-dp copies match after rounding) |
| Table I u, Re=1000 | ivan-pi, sujaldave, gist xuaoxiqi/6824605, lethe (4 dp) | identical |
| Table II v(y=0.5), Re=100 | ivan-pi `ghiav.txt`, sujaldave, cfdgasman, amikkonen (4 dp) | identical |
| Table II v, Re=1000 | ivan-pi, sujaldave, xuaoxiqi | **one disagreement at x=0.9063: −0.51550 (sujaldave, xuaoxiqi) vs −0.51500 (ivan-pi)**; I used the majority value −0.51550 |
| ψ_min Re=100 = −0.103423 | cfdgasman README quotes Ghia; a k-dense.ai report snippet gives −0.10342 | consistent |
| ψ_min Re=1000 = −0.117929 | search snippets: arXiv:1807.04896 Table A-2 gives 0.1179; k-dense gives −0.11793 | consistent to 4 digits. The 6-digit value is the commonly quoted one but did not appear verbatim in any copy I could open |
| Vortex centres | sujaldave `ghia_vortex_centers.csv` (Re=100: (0.6172, 0.7344); Re=1000: (0.5313, 0.5625)); the arXiv:1807.04896 snippet confirms Re=1000 | consistent |
| Erturk Re=1000 u (23 points) | lethe `ref-2d-erturk-u.txt`; a search snippet of arXiv:cs/0411047 confirms the first three entries | partial check |
| Erturk ψ_min Re=1000 = −0.118781 at (0.5300, 0.5650) | search snippet of arXiv:cs/0411047 | single snippet |
| Botella ψ magnitude 0.1189 at (0.5308, 0.5652) | arXiv:1807.04896 snippet; the Notus CFD page gives (0.4692, 0.5652) with x mirrored because the lid moves in −x | 4 digits only |

Other observations:

* The ivan-pi copy also has two errors at other Reynolds numbers, outside the scenes I was asked to cover: Re=3200 at y=0.4531 reads −0.86636, almost certainly a mistyped −0.08664 (lethe carries the same error), and Re=10000 at y=0.5 reads +0.03111 where lethe has −0.0311. They are listed so that nobody reuses those columns without checking them.
* Ghia's tabulated coordinates are nodes of a 129-point grid printed to 4 decimals (0.2813 is 36/128 = 0.28125, which some copies print as 0.2812).

## Taylor–Green

I found no open copy of Taylor & Green (1937) or Taylor (1923). The 2-D decaying form appears in open LBM papers, for example arXiv:2112.08926 (seen as a search snippet only). Instead of trusting a source, I checked the formula directly:

* **Navier–Stokes residual:** substituting u, v and p = −(ρU0²/4)(cos2kx + cos2ky)e^{−4νk²t} gives a finite-difference residual of about 3e-8 (round-off level for h = 1e-4).
* **Divergence:** zero.
* **Kinetic energy:** the domain mean by quadrature equals (U0²/4)e^{−4νk²t} to 1e-14.

The three references are pure-JS functions.

## Cylinder (DFG 2D-1 and 2D-2)

**Intervals.** Three MIT-licensed repos agree exactly on the Schäfer & Turek intervals: useless-husband/vortexlab `data/reference/schaefer_turek1996.csv`, AdebanjiAdelowo/fem-cylinder-flow `src/reference.py` and mustafaobaidd1/karman-wind-tunnel `src/sim/benchmark.ts`. A fourth, johanhoffman/DD2365_FEniCSx `VALIDATION.md`, also agrees.

| case | quantity | interval |
|---|---|---|
| 2D-1 | cD | [5.57, 5.59] |
| 2D-1 | cL | [0.0104, 0.0110] |
| 2D-1 | Δp | [0.1172, 0.1176] |
| 2D-1 | La | [0.0842, 0.0852] |
| 2D-2 | cD,max | [3.22, 3.24] |
| 2D-2 | cL,max | [0.99, 1.01] |
| 2D-2 | St | [0.295, 0.305] |
| 2D-2 | Δp | [2.46, 2.50] |

**Refined values.**

* **2D-1:** Nabh (1998) values from the FeatFlow page are cD = 5.57953523384, cL = 0.010618948146 and Δp = 0.11752016697, as quoted in four repos. FEATool `ex_navierstokes3.m` cites John & Matthies (2001) with cL = 0.010618937712; it differs only in the 8th significant digit.
* **2D-2:** the refined values come from FeatFlow's official time series, extracted by third parties:
  * vortexlab: cD,max 3.227393, cL,max 0.986571, St 0.30184, Δp 2.4848;
  * fem-cylinder-flow: 3.22739, 0.98658, Δp 2.4829;
  * karman-wind-tunnel: St 0.30188, cL,max 0.9859.

  **The refined cL,max is just below the 1996 interval**, so the suggested tolerance does not require it to lie inside that interval.

**Geometry.** Taken from the same repos and a FeatFlow page snippet (pressure points (0.15, 0.2) and (0.25, 0.2)):

* channel 2.2 × 0.41, cylinder D = 0.1 centred at (0.2, 0.2);
* parabolic inflow 4Um·y(H−y)/H², with Um = 0.3 (2D-1) or 1.5 (2D-2);
* ν = 1e-3, Ū = 2Um/3.

## Method sources

* **LBM.** I could only see abstracts or snippets for Zou & He (arXiv comp-gas/9611001), Hou et al. (comp-gas/9401003, an LBM cavity study) and Ladd (comp-gas/9306004). Qian et al. (1992) and He & Luo (1997) are paywalled. The D2Q9 equilibrium, the weights and ν = (τ−½)/3 are recorded as standard forms with unverified equation numbers. I derived the Zou–He lid formulas from the non-equilibrium bounce-back rule and checked numerically that they reproduce ρ and ρu.
* **ψ–ω.** Erturk (snippet) confirms the ψ–ω formulation with Thom's wall vorticity, which is locally first order but globally second order. E & Liu (1996) show that MAC is equivalent to the Thom boundary condition with centred differences.
* **Stable fluids.** I could not reach either Stam PDF. I read the full solver code as an ISC-licensed JS port of Stam's `solver03.c` (npm `stam-stable-fluids@1.0.3`). One detail matters for the cavity scene: its `set_bnd` applies **free-slip** reflective walls, so a cavity run needs its own no-slip and lid boundary condition. Neither Stam source reports a quantitative benchmark.

## Gaps and items still unverified

1. No primary PDF was read (Ghia, Schäfer–Turek, Erturk, Botella, Stam, Qian, Zou–He). All table and equation numbers are unverified.
2. The Ghia vortex table numbers (III and V) come from secondary citations. The 6-digit Re=1000 ψ_min was not seen verbatim, and Botella's value is confirmed to 4 digits only.
3. I did not obtain Erturk's Re=1000 v table, Botella's centreline tables, or Hou et al.'s LBM cavity numbers.
4. Several of the cylinder and cavity GitHub copies are 2026 repos. They agree with each other and with older sources (lethe, the FEATool comments, the ivan-pi gists), but they are not authoritative.
5. Stam's equation numbers are missing, as is any quantitative reference experiment for stable-fluids.
