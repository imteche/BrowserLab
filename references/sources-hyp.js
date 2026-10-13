/* Sources for the hyperbolic conservation-law group (scenes `sod`, `swe-dambreak`;
 * methods lax-friedrichs, hllc-godunov, muscl-hancock, hll-swe).
 * Researcher: hyperbolic researcher agent, 2026-10-13.
 * NETWORK NOTE: arxiv.org, ar5iv, HAL, publisher sites, readthedocs, sourcesup.renater.fr and
 * university pages were DNS/proxy-blocked from the research container. What worked: `git clone`
 * of public GitHub repositories and `pip download` of PyPI sdists. Content read in full from such
 * copies is `access: 'full-text'`, verified: true (for the copy, not for the paywalled original).
 * Everything else is search-snippet level and `verified: false`. Commit hashes are recorded so a
 * reviewer can re-read exactly the same text.
 */
(function (LAB) {
  'use strict';

  /* ---------- primary (paywalled or unreachable) originals ---------- */

  LAB.registerSource({
    id: 'sod1978',
    title: 'A survey of several finite difference methods for systems of nonlinear hyperbolic conservation laws',
    authors: 'G. A. Sod', year: 1978,
    venue: 'J. Comput. Phys. 27(1), 1-31',
    url: 'https://doi.org/10.1016/0021-9991(78)90023-2',
    doi: '10.1016/0021-9991(78)90023-2',
    license: 'proprietary (Elsevier)',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Original not read. Initial data (rho,u,p) = (1,0,1) | (0.125,0,0.1), gamma = 1.4 taken from open copy zingale-cha ' +
      '(Euler/Euler-methods.tex, Sec. "Sod problem", cites sod:1978; the notes themselves carry a "double check" margin note on gamma = 1.4) and ' +
      'sodshock2015 README ("Standard test case ... ratio of specific heats is 1.4"). x in [0,1], x0 = 0.5, t = 0.2 from sodshock2015 example.',
    verified: false
  });

  LAB.registerSource({
    id: 'toro2009',
    title: 'Riemann Solvers and Numerical Methods for Fluid Dynamics: A Practical Introduction (3rd ed.)',
    authors: 'E. F. Toro', year: 2009,
    venue: 'Springer, Berlin',
    url: 'https://doi.org/10.1007/b79761',
    doi: '10.1007/b79761',
    license: 'proprietary (Springer)',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Book not accessible. Ch. 4 exact-solver algorithm (pressure functions f_L,f_R, Newton iteration for p*, sampling) implemented from the ' +
      'open formulas in zingale-cha (Euler-theory.tex Secs. "Rarefactions", "Shocks", "Finding the Star State", "Complete Solution") and checked numerically ' +
      'against sodshock2015 (17 digits) and swift-riemann-tests (Toro tests 1-5 at gamma=5/3). Test-1 star values p*=0.30313, u*=0.92745, rho*L=0.42632, ' +
      'rho*R=0.26557 (Table 4.3, as quoted in the task brief) could not be read in the book; p* and u* are confirmed to 4 decimals by a search snippet ' +
      'of arXiv:2412.03522 (rusanov2024) and all four to 17 digits by sodshock2015. Section/equation numbers for HLLC (Ch. 10), MUSCL-Hancock (Sec. 14.4) ' +
      'and Davis wave-speed estimates are from recollection / search snippets, NOT verified.',
    verified: false
  });

  LAB.registerSource({
    id: 'toro1994hllc',
    title: 'Restoration of the contact surface in the HLL-Riemann solver',
    authors: 'E. F. Toro, M. Spruce, W. Speares', year: 1994,
    venue: 'Shock Waves 4(1), 25-34',
    url: 'https://doi.org/10.1007/BF01414629',
    doi: '10.1007/BF01414629',
    license: 'proprietary (Springer)',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Original not read. HLLC middle speed S* and star states U*_K taken from the open BSD-3 code clawpack-riemann (riemann/euler_1D_py.py, ' +
      'euler_hllc_1D docstring, lines 172-200, commit b0d609c), which states the same formulas used in Toro 2009 Ch. 10.',
    verified: false
  });

  LAB.registerSource({
    id: 'hll1983',
    title: 'On upstream differencing and Godunov-type schemes for hyperbolic conservation laws',
    authors: 'A. Harten, P. D. Lax, B. van Leer', year: 1983,
    venue: 'SIAM Review 25(1), 35-61',
    url: 'https://doi.org/10.1137/1025002',
    doi: '10.1137/1025002',
    license: 'proprietary (SIAM)',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Original not read. HLL middle state q_m = (f(q_r) - f(q_l) - s2 q_r + s1 q_l)/(s1 - s2) and the bound-the-wave-speeds requirement ' +
      'read in riemannbook2020 (Approximate_solvers.ipynb "Harten-Lax-van Leer (HLL)", Shallow_water_approximate.ipynb "HLL solver").',
    verified: false
  });

  LAB.registerSource({
    id: 'einfeldt1988',
    title: 'On Godunov-type methods for gas dynamics',
    authors: 'B. Einfeldt', year: 1988,
    venue: 'SIAM J. Numer. Anal. 25(2), 294-318',
    url: 'https://doi.org/10.1137/0725021',
    doi: '10.1137/0725021',
    license: 'proprietary (SIAM)',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Original not read. Einfeldt (HLLE) speed choice s1 = min(lambda_1(q_l), u_hat - c_hat), s2 = max(lambda_2(q_r), u_hat + c_hat) read in ' +
      'riemannbook2020 Shallow_water_approximate.ipynb (HLL solver) and Euler_approximate.ipynb (HLLE solver), and in clawpack-riemann shallow_hll_1D / euler_hllc_1D.',
    verified: false
  });

  LAB.registerSource({
    id: 'lax1954',
    title: 'Weak solutions of nonlinear hyperbolic equations and their numerical computation',
    authors: 'P. D. Lax', year: 1954,
    venue: 'Comm. Pure Appl. Math. 7(1), 159-193',
    url: 'https://doi.org/10.1002/cpa.3160070112',
    doi: '10.1002/cpa.3160070112',
    license: 'proprietary (Wiley)',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Original not read. Lax-Friedrichs as an approximate Riemann solver with -s1 = s2 = a, q_m = -(f(q_r)-f(q_l))/(2a) + (q_r+q_l)/2, "in the original ' +
      'Lax-Friedrichs method the wave speed a is taken to be the same in every Riemann problem over the entire grid" read in riemannbook2020 ' +
      'Approximate_solvers.ipynb cells 12-13. Identification a = dx/dt giving the classic update is our derivation.',
    verified: false
  });

  LAB.registerSource({
    id: 'vanleer1979',
    title: 'Towards the ultimate conservative difference scheme. V. A second-order sequel to Godunov\'s method',
    authors: 'B. van Leer', year: 1979,
    venue: 'J. Comput. Phys. 32(1), 101-136',
    url: 'https://doi.org/10.1016/0021-9991(79)90145-1',
    doi: '10.1016/0021-9991(79)90145-1',
    license: 'proprietary (Elsevier)',
    openAccess: false,
    access: 'search-snippet',
    accessNote: 'Original not read. MUSCL origin; cited (with Toro 2009) for MUSCL-Hancock by HERACLES++ (arXiv:2503.04428) per search snippet. ' +
      'van Leer harmonic-mean slope limiter formula given in research/hyp.json from recollection (verified: false).',
    verified: false
  });

  LAB.registerSource({
    id: 'ritter1892',
    title: 'Die Fortpflanzung der Wasserwellen',
    authors: 'A. Ritter', year: 1892,
    venue: 'Zeitschrift des Vereines Deutscher Ingenieure 36(33), 947-954',
    url: 'https://www.idpoisson.fr/swashes/',
    doi: null,
    license: 'public domain (age); no digital copy located',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Original not read. Bibliographic data from tilupy analytic_sol.Ritter_dry docstring; solution formulas via swashes2013 as transcribed in tilupy.',
    verified: false
  });

  LAB.registerSource({
    id: 'stoker1957',
    title: 'Water Waves: The Mathematical Theory with Applications',
    authors: 'J. J. Stoker', year: 1957,
    venue: 'Pure and Applied Mathematics vol. 4, Interscience, New York',
    url: 'https://doi.org/10.1002/9781118033159',
    doi: '10.1002/9781118033159',
    license: 'proprietary (Wiley)',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Original not read. Wet-bed dam-break solution via swashes2013 (as transcribed in tilupy) with the c_m equation corrected (see swashes2013 note).',
    verified: false
  });

  /* ---------- open sources ---------- */

  LAB.registerSource({
    id: 'swashes2013',
    title: 'SWASHES: a compilation of Shallow Water Analytic Solutions for Hydraulic and Environmental Studies',
    authors: 'O. Delestre, C. Lucas, P.-A. Ksinant, F. Darboux, C. Laguerre, T.-N.-T. Vo, F. James, S. Cordier', year: 2013,
    venue: 'Int. J. Numer. Meth. Fluids 72(3), 269-300',
    url: 'https://arxiv.org/abs/1110.0288',
    doi: '10.1002/fld.3741',
    license: 'arXiv non-exclusive; HAL hal-00628246; SWASHES code CeCILL-V2',
    openAccess: true,
    access: 'secondary-copy',
    accessNote: 'arXiv/ar5iv/HAL all unreachable from the container. NOTE: the open id is arXiv:1110.0288 (the task brief said 1111.6248; search results ' +
      'consistently give 1110.0288). Dam-break formulas (x_A, x_B, x_C, h, u for Ritter Sec. 4.1.2 and Stoker Sec. 4.1.1) read in the CeCILL-C package ' +
      'tilupy 2.1.1 (PyPI sdist, src/tilupy/analytic_sol.py classes Ritter_dry, Stoker_SWASHES_wet), which says it implements the SWASHES equations. ' +
      'DISCREPANCY: tilupy writes the Stoker c_m equation as -8 g h_r c_m^2 (g h_l - c_m^2)^2 + (c_m^2 - g h_r)^2 (c_m^2 + g h_r) = 0, which is ' +
      'dimensionally inconsistent and violates Rankine-Hugoniot; we use (sqrt(g h_l) - c_m)^2, derived from riemannbook2020 integral curve + Hugoniot locus ' +
      'and verified numerically. Whether the SWASHES PDF prints the correct form could not be checked. Test set-up hl = 0.005 m, x0 = 5 m on [0,10] m from ' +
      'search snippets (SWASHES and FullSWOF arXiv:1401.4125); Stoker hr = 0.001 m and T = 6 s from recollection (not seen in any snippet).',
    verified: false
  });

  LAB.registerSource({
    id: 'sodshock2015',
    title: 'sod-shocktube: Sod shock tube calculator (Python package sodshock)',
    authors: 'J. Skific; maintained by I. Backus', year: 2015,
    venue: 'GitHub ibackus/sod-shocktube, commit 06cd0b8822c52c86d0e9c91e2d214d7e7527c492 (2021-11-18); PyPI sodshock',
    url: 'https://github.com/ibackus/sod-shocktube',
    doi: null,
    license: 'MIT',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Cloned and read. README "Which should give us the following output" block: Region 3 (p,rho,u) = (0.30313017805064707, 0.42631942817849544, ' +
      '0.92745262004895057), Region 4 rho = 0.26557371170530725; positions at t=0.2: shock 0.8504311464060357, contact 0.6854905240097902, rarefaction head ' +
      '0.26335680867601535, foot 0.4859454374877634. Same numbers in tests/test_sod.py and tests/test-data/regions.json. Independent implementation ' +
      '("code logic copied from Timmes exact_riemann"), so it is a numerical cross-check, not the Toro table.',
    verified: true
  });

  LAB.registerSource({
    id: 'clawpack-riemann',
    title: 'Clawpack Riemann solvers (riemann repository)',
    authors: 'Clawpack Developers', year: 2018,
    venue: 'GitHub clawpack/riemann, commit b0d609c3c0fe16a1967ad53cbbc46d43f92c3a25: riemann/euler_1D_py.py, riemann/shallow_1D_py.py',
    url: 'https://github.com/clawpack/riemann',
    doi: null,
    license: 'BSD-3-Clause',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Cloned and read. euler_hllc_1D (lines ~172-280): HLLC with Einfeldt speeds, s_m = (p_r - p_l + rho_l u_l (s_l - u_l) - rho_r u_r (s_r - u_r)) / ' +
      '(rho_l (s_l - u_l) - rho_r (s_r - u_r)), star states q_hat_K = rho_K (s_K - u_K)/(s_K - s_m) [1, s_m, E_K/rho_K + (s_m - u_K)(s_m + p_K/(rho_K (s_K - u_K)))]. ' +
      'shallow_hll_1D (lines ~99-166): Roe averages u_bar = (hu_l/sqrt(h_l) + hu_r/sqrt(h_r))/(sqrt(h_l)+sqrt(h_r)), c_bar = sqrt(g (h_l+h_r)/2), Einfeldt speeds, ' +
      'Q_hat = (f(q_r) - f(q_l) - s2 q_r + s1 q_l)/(s1 - s2). euler_exact_1D is NOT implemented there.',
    verified: true
  });

  LAB.registerSource({
    id: 'riemannbook2020',
    title: 'Riemann Problems and Jupyter Solutions',
    authors: 'D. I. Ketcheson, R. J. LeVeque, M. J. del Razo', year: 2020,
    venue: 'SIAM Fundamentals of Algorithms 16; open notebooks GitHub clawpack/riemann_book, commit 5b171f11fd7a3e810ee7a74a4d9f2dff01d65a6e',
    url: 'https://github.com/clawpack/riemann_book',
    doi: '10.1137/1.9781611976212',
    license: 'code BSD-3-Clause (LICENSE-CODE); text CC BY-NC-ND 4.0 (LICENSE-TEXT.md)',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Cloned and read: Approximate_solvers.ipynb (Godunov method & CFL, cells 5; Lax-Friedrichs/LLF cells 12-13; HLL cells 14-15), ' +
      'Shallow_water_approximate.ipynb (HLL/HLLE solver cells 33-52, positivity), Euler_approximate.ipynb (HLLE cell 26), exact_solvers/shallow_water.py ' +
      '(integral curves and Hugoniot loci used for the independent Stoker check).',
    verified: true
  });

  LAB.registerSource({
    id: 'zingale-cha',
    title: 'Introduction to Computational Astrophysical Hydrodynamics (Open Astrophysics Bookshelf, numerical_exercises)',
    authors: 'M. Zingale', year: 2025,
    venue: 'GitHub Open-Astrophysics-Bookshelf/numerical_exercises, commit 2d001455106e3f74393bbacdd984157c19a16810 (2025-01-26)',
    url: 'https://github.com/Open-Astrophysics-Bookshelf/numerical_exercises',
    doi: null,
    license: 'CC BY-NC-SA 4.0',
    openAccess: true,
    access: 'full-text',
    accessNote: 'LaTeX source read: Euler/Euler-theory.tex (gamma-law rarefaction u*(p), shock density jump eq:euler:shockrhojump, star velocity eq:euler:shockujump, ' +
      'shock speed eq:euler:shockspeedjump, Sec. "Finding the Star State"); Euler/Euler-methods.tex (Sec. "Riemann solvers", "Conservative update" with ' +
      'dt < dx/(|u|+c), Sec. "Sod problem"); advection/advection-higherorder.tex (minmod limiter exercise). Equation labels are LaTeX labels, not printed numbers.',
    verified: true
  });

  LAB.registerSource({
    id: 'swift-riemann-tests',
    title: 'SWIFT unit test tests/testRiemannExact.c (exact Riemann solver on the Toro test problems)',
    authors: 'B. Vandenbroucke (SWIFT collaboration)', year: 2016,
    venue: 'GitHub SWIFTSIM/SWIFT, commit 6b12e6898ccfd868dfa0349eacc4a5e6f7bac6db',
    url: 'https://github.com/SWIFTSIM/SWIFT/blob/master/tests/testRiemannExact.c',
    doi: null,
    license: 'LGPL-3.0-or-later',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Sparse-cloned and read check_riemann_exact(): interface states W(x/t=0) for Toro tests 1-5 at gamma = 5/3, 4/3, 2 in float32 precision ' +
      '(no gamma = 1.4 values). Used only as an independent cross-check of our sampler at gamma = 5/3.',
    verified: true
  });

  LAB.registerSource({
    id: 'tilupy2025',
    title: 'tilupy: analytic solutions module (analytic_sol.py)',
    authors: 'tilupy developers', year: 2025,
    venue: 'PyPI tilupy 2.1.1 (sdist)',
    url: 'https://pypi.org/project/tilupy/',
    doi: null,
    license: 'CeCILL-C',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Downloaded sdist and read src/tilupy/analytic_sol.py: Ritter_dry (lines 252-415), Stoker_SWASHES_wet (417-719, contains the dimensionally ' +
      'inconsistent c_m equation), Stoker_SARKHOSH_wet (721-, alternative formulation after Sarkhosh 2021, Zenodo 10.5281/zenodo.5598374).',
    verified: true
  });

  LAB.registerSource({
    id: 'mackey-shocktubes',
    title: 'Hydrodynamics Shock Tubes (test list incl. Toro test 1)',
    authors: 'J. Mackey', year: null,
    venue: 'web page, Argelander-Institut fur Astronomie, Univ. Bonn',
    url: 'https://astro.uni-bonn.de/~jmackey/jmac/node6.html',
    doi: null,
    license: 'unspecified (freely readable web page)',
    openAccess: true,
    access: 'search-snippet',
    accessNote: 'DNS-blocked. Search snippet: "Toro 1 [1,1,0.75] [0.125,0.1,0.0] 0.2 0.3" ([rho,p,u] left/right, t_end, x0), gamma = 1.4, citing Toro 1999 p.225.',
    verified: false
  });

  LAB.registerSource({
    id: 'rusanov2024',
    title: 'Rusanov-type Schemes for Hyperbolic Equations: Wave-Speed Estimates, Monotonicity and Stability',
    authors: 'not visible in snippet', year: 2024,
    venue: 'arXiv:2412.03522',
    url: 'https://arxiv.org/abs/2412.03522',
    doi: null,
    license: 'arXiv non-exclusive',
    openAccess: true,
    access: 'search-snippet',
    accessNote: 'DNS-blocked. Snippet shows a table row "2 | 1.0 | 0.0 | 1.0 | 0.125 | 0.0 | 0.1 | 0.9274 | 0.3031 | R-S" (rho,u,p left/right, u*, p*, wave pattern) for ' +
      'Toro et al. ideal-gas tests with gamma = 1.4. Used only to corroborate p* and u* to 4 decimals.',
    verified: false
  });

  LAB.registerSource({
    id: 'ader2023',
    title: 'Design and analysis of ADER-type schemes for model advection-diffusion-reaction equations',
    authors: 'not visible in snippet', year: 2023,
    venue: 'arXiv:2301.08473',
    url: 'https://arxiv.org/abs/2301.08473',
    doi: null,
    license: 'arXiv non-exclusive',
    openAccess: true,
    access: 'search-snippet',
    accessNote: 'DNS-blocked. Snippets describe the MUSCL-Hancock steps: boundary-extrapolated values from a linear slope, evolved by half a time step with the ' +
      'flux difference across the cell; without reconstruction the method reduces to Godunov\'s first-order method. Exact equation numbers not seen.',
    verified: false
  });

  LAB.registerSource({
    id: 'fullswof2014',
    title: 'FullSWOF: A free software package for the simulation of shallow water flows',
    authors: 'O. Delestre, F. Darboux, F. James, C. Lucas, C. Laguerre, S. Cordier', year: 2014,
    venue: 'arXiv:1401.4125',
    url: 'https://arxiv.org/abs/1401.4125',
    doi: null,
    license: 'arXiv non-exclusive',
    openAccess: true,
    access: 'search-snippet',
    accessNote: 'DNS-blocked. Snippet: dry-bed (Ritter) test on a 10 m domain with h_l = 0.005 m for 0 <= x <= 5 m and h_r = 0 for 5 < x <= 10 m (as in SWASHES).',
    verified: false
  });

})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
