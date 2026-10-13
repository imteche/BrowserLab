# ODE group research report: Hamiltonian integrators on the Kepler problem

Researcher: ode researcher agent, 2026-10-13. Scene: `kepler`. Methods: `explicit-euler`, `symplectic-euler`, `stormer-verlet`, `rk4`.

Files:
- `references/sources-ode.js`: 7 sources (`LAB.registerSource`)
- `references/kepler.js`: 23 references (`LAB.registerReference`), plus `LAB.keplerAnalytic` helpers
- `research/ode.json`: machine-readable method records
- `research/test-kepler-exact.js`: check of the analytic reference (output below)

## 1. Source access (read this first)

**I could not read the full text of any source.** unige.ch (Hairer's preprints and lecture notes), the McGill, KIT, UCSD and UVM mirrors, tuebingen.de and arxiv.org all failed with DNS or proxy 403 errors, from both curl and WebFetch. The GitHub search API is also blocked in this session. Everything attributed to a source below comes from **web-search snippets** and is registered with `verified: false`. Locations marked "(recollection)" did not appear in any snippet. Check them before relying on them.

| id | what it supports | access |
|---|---|---|
| `hlw2003` | HLW, Acta Numerica 12 (2003) 399–450: Störmer–Verlet; O(h²) energy error with no drift; linear error growth; backward error analysis is Sec. 4 (p.419) and long-time behaviour is Sec. 5 (p.425), both from the TOC snippet | snippet |
| `hlw2006` | GNI book (paywalled): the Kepler set-up in Sec. I.2.3; Thm IX.8.1 and Sec. X.3 (recollection) | secondary |
| `hairer1999notes` | Hairer's Geneva notes (McGill mirror): Kepler figure (h = 0.05, 4000 steps, explicit Euler step 100× smaller); long-time table (energy: explicit Euler linear, symplectic Euler bounded; global error: explicit Euler quadratic, symplectic linear; L exactly conserved by symplectic Euler and midpoint); precession direction | snippet |
| `hairer2010week2` | TUM notes, lecture 2: symplectic Euler on Kepler with e = 0.6 over [0, 7.5]; Störmer–Verlet is the composition of the two symplectic Euler variants at h/2 | snippet |
| `blanes2008splitting` | arXiv 0812.0377: e = 0.6; explicit Euler spirals out; symplectic Euler precesses, conserves L but not the LRL vector | snippet |
| `hairer1997varsymp` | constant-step symplectic methods: no secular energy error, linear rather than quadratic error growth | snippet |
| `kutta1901` | RK4 tableau and order 4 (standard; original not consulted) | secondary |

**Inconsistency to note:** one snippet of `hairer1999notes` gives e = 0 for the h = 0.05 figure. All other sources use e = 0.6. The eccentricity of that figure is therefore **unconfirmed**. None of the snippets gave a numeric value read off a figure, such as an energy error amplitude, so no source figure values were registered.

## 2. Problem and analytic references

H = ½|p|² − 1/|q|, with q(0) = (1−e, 0) and p(0) = (0, √((1+e)/(1−e))). These are the standard HLW Sec. I.2.3 initial conditions. Several open papers reproduce them (arXiv 1807.10952, arXiv 2202.01541, 0812.0377), all seen through snippets.

The following values are derived, not quoted:
- H0 = −1/2 for every e, so a = 1 and T = 2π.
- L0 = √(1−e²), which is 0.8 at e = 0.6.
- The Runge–Lenz vector is A = (p₂L − q₁/r, −p₁L − q₂/r) = (e, 0).

**Exact solution** (`kepler-exact-solution`, `fn(t, {e})`). The code solves M = t = E − e sin E by Newton's method, after reducing M to [−π, π). It then sets

q = (cos E − e, √(1−e²) sin E), p = Ė·(−sin E, √(1−e²) cos E), where Ė = 1/(1 − e cos E).

Test output (`node research/test-kepler-exact.js`):

```
-- e = 0
PASS  |y(0) - y0|                                                0.00e+0  (tol 1e-14)
PASS  H0 + 1/2                                                   0.00e+0  (tol 1e-14)
PASS  L0 - sqrt(1-e^2)                                           0.00e+0  (tol 1e-14)
PASS  max |H(t) - H0| on [0,10T]                                 3.33e-16  (tol 1e-12)
PASS  max |L(t) - L0| on [0,10T]                                 2.22e-16  (tol 1e-12)
PASS  max |A(t) - (e,0)| on [0,10T]                              4.00e-16  (tol 1e-12)
PASS  |y(1T) - y0|                                               3.46e-16  (tol 1e-12)
PASS  |y(100T) - y0|                                             5.56e-15  (tol 1e-10)
PASS  ODE residual (central diff, d=1e-5)                        3.00e-10  (tol 1e-6)
-- e = 0.3
PASS  |y(0) - y0|                                                2.22e-16  (tol 1e-14)
PASS  H0 + 1/2                                                   2.22e-16  (tol 1e-14)
PASS  L0 - sqrt(1-e^2)                                           0.00e+0  (tol 1e-14)
PASS  max |H(t) - H0| on [0,10T]                                 9.99e-16  (tol 1e-12)
PASS  max |L(t) - L0| on [0,10T]                                 4.44e-16  (tol 1e-12)
PASS  max |A(t) - (e,0)| on [0,10T]                              1.09e-15  (tol 1e-12)
PASS  |y(1T) - y0|                                               4.76e-16  (tol 1e-12)
PASS  |y(100T) - y0|                                             6.75e-15  (tol 1e-10)
PASS  ODE residual (central diff, d=1e-5)                        3.91e-10  (tol 1e-6)
-- e = 0.6
PASS  |y(0) - y0|                                                0.00e+0  (tol 1e-14)
PASS  H0 + 1/2                                                   0.00e+0  (tol 1e-14)
PASS  L0 - sqrt(1-e^2)                                           0.00e+0  (tol 1e-14)
PASS  max |H(t) - H0| on [0,10T]                                 2.22e-15  (tol 1e-12)
PASS  max |L(t) - L0| on [0,10T]                                 4.44e-16  (tol 1e-12)
PASS  max |A(t) - (e,0)| on [0,10T]                              1.62e-15  (tol 1e-12)
PASS  |y(1T) - y0|                                               6.43e-16  (tol 1e-12)
PASS  |y(100T) - y0|                                             1.03e-14  (tol 1e-10)
PASS  ODE residual (central diff, d=1e-5)                        2.23e-9  (tol 1e-6)
-- e = 0.9
PASS  |y(0) - y0|                                                8.88e-16  (tol 1e-14)
PASS  H0 + 1/2                                                   0.00e+0  (tol 1e-14)
PASS  L0 - sqrt(1-e^2)                                           0.00e+0  (tol 1e-14)
PASS  max |H(t) - H0| on [0,10T]                                 2.13e-14  (tol 1e-12)
PASS  max |L(t) - L0| on [0,10T]                                 6.11e-16  (tol 1e-12)
PASS  max |A(t) - (e,0)| on [0,10T]                              4.33e-15  (tol 1e-12)
PASS  |y(1T) - y0|                                               2.61e-15  (tol 1e-12)
PASS  |y(100T) - y0|                                             3.93e-14  (tol 1e-10)
PASS  ODE residual (central diff, d=1e-5)                        2.37e-7  (tol 1e-5)

references registered: 23, sources: 7
ALL CHECKS PASSED
```

## 3. Methods

| method | symplectic | reversible | order | L conserved | energy error | global-error growth |
|---|---|---|---|---|---|---|
| explicit-euler | no | no | 1 | no (ΔL = h² p×F) | drift O(h t) | quadratic |
| symplectic-euler | yes | no | 1 | yes | O(h), bounded | linear |
| stormer-verlet | yes | yes | 2 | yes | O(h²), bounded (exponentially long times) | linear |
| rk4 | no | no | 4 | no | drift O(h⁴ t) | quadratic |

`research/ode.json` lists the equations for each method, with source and location.

## 4. Quantitative expectations and protocols

The theoretical values come from the sources. **The protocols (h, t_end) are mine.** I chose them in a pilot run with my own throwaway reference integrators (scratch only, not shipped) so that each method is in its asymptotic regime at e = 0.6. The pilot numbers are lab-computed, not source data. The tolerance is ±0.3 on observed order and growth exponent.

| reference id | theory | protocol | pilot |
|---|---|---|---|
| order-energy-explicit-euler | 1 | t_end = T, h = 1e-4 vs 5e-5 | 0.96 |
| order-global-explicit-euler | 1 | same | 1.00 |
| order-energy-symplectic-euler | 1 | t_end = 10.5T, h = 5e-4 | 1.00 |
| order-global-symplectic-euler | 1 | t_end = 10.5T, h = 5e-4 | 0.94 |
| order-energy-stormer-verlet | 2 | t_end = 10.5T, h = 1e-2 | 2.00 |
| order-global-stormer-verlet | 2 | same | 2.00 |
| order-energy-rk4 | 4 | t_end = 10.5T, h = 1.25e-3 | 4.22 |
| order-global-rk4 | 4 | same | 4.09 |
| growth-global-explicit-euler | 2 | h = 1e-6, T → 4T | 2.00 |
| growth-global-symplectic-euler | 1 | h = 1e-3, 10T → 40T | 1.00 |
| growth-global-stormer-verlet | 1 | h = 1e-2, 10.5T → 40.5T | 1.00 |
| growth-global-rk4 | 2 | h = 1e-2, 40T → 160T | 1.92 |
| growth-energy-explicit-euler | 1 | h = 1e-6, T → 4T | 1.00 |
| growth-energy-symplectic-euler | 0 | h = 1e-3, 10T → 40T | 0.00 |
| growth-energy-stormer-verlet | 0 | h = 1e-2, 10.5T → 40.5T | 0.00 |
| growth-energy-rk4 | 1 | h = 1e-2, 40T → 160T | 0.97 |

The energy metric is the maximum of |H_n − H0| over the run. The global-error metric is the Euclidean norm over (q, p) at t_N = N·h, measured against `kepler-exact-solution`.

**Pitfalls found in the pilot:**
1. **Symplectic Euler sampled at whole periods shows global-error order 2.** At h = 1e-3 and t = 10T the observed order was 2.00. The reason is that symplectic Euler is conjugate to Störmer–Verlet, and the O(h) conjugacy offset cancels when the orbit returns to pericentre. Run order tests at half periods. At half periods, however, that bounded O(h) offset hides the linear growth until t ~ 1/h. At 10.5T → 40.5T the growth exponent was −0.48, so run growth tests at whole periods.
2. **Explicit Euler error is O(1) after 10 periods**, even at h = 1e-5 (err = 1.2). Global-error tests must use short times or tiny h.
3. **RK4 is pre-asymptotic at h ≥ 2.5e-3.** The energy order there was 4.39, outside ±0.3. RK4 global error only reaches quadratic growth after about 40T. Over 10.5T → 40.5T the exponent was about 1.5.
4. **Störmer–Verlet at h = 1e-2 sampled at pericentre (whole periods) saturates** by 40T (err = 1.5). Sample at apocentre.
5. The maximum energy error is phase-independent and robust. The energy error at the endpoint oscillates with the orbit, so do not use it for order tests of symplectic methods.

`kepler-L-conservation` gives a tolerance of 1e-12 on |L_n − L0| for symplectic Euler and Störmer–Verlet, and flags explicit Euler and RK4 as not conserving L.

## 5. Source figure protocol (qualitative)

`kepler-hairer-figure-protocol` (hairer1999notes, snippet):
- Symplectic Euler and implicit midpoint: h = 0.05, 4000 steps (t = 200, about 31.8 periods).
- Explicit Euler: h = 0.0005. This value is inferred from the phrase "step size 100 times larger".

Expected behaviour:
- Symplectic Euler: an ellipse that precesses slowly **clockwise**.
- Implicit midpoint: precesses **anticlockwise**. It is not in our method set.
- Explicit Euler: spirals outward.

## 6. Missing / to verify when full text is reachable

- All `verified: false` items: hlw2003 equation and theorem numbers, any figure step sizes, and the eccentricity of the Hairer notes figure.
- hlw2006 Thm IX.8.1 (long-time energy conservation) and Sec. X.3 (linear error growth). Both are recollection only.
- No published numeric values, such as an energy-error amplitude at a given h, could be extracted. Quantitative checks therefore rest on the analytic solution and on order and growth exponents.
- Which variant of symplectic Euler the source figure uses. This sets the precession direction.
- The implicit midpoint rule appears in the sources but is outside the requested method set.
