// Sources for particle / hybrid fluid methods (WCSPH, PBF, MLS-MPM), the
// `dam-break` scene and SPH on `taylor-green`.
// Researcher: ptc group. Access date for all entries: 2026-10-13.
// "verified: true" only where the cited section/code was read in full in this session.
(function (LAB) {
  'use strict';

  // ---------------------------------------------------------------- dam-break data

  LAB.registerSource({
    id: 'martin1952',
    title: 'Part IV. An experimental study of the collapse of liquid columns on a rigid horizontal plane',
    authors: 'J. C. Martin, W. J. Moyce',
    year: 1952,
    venue: 'Phil. Trans. R. Soc. Lond. A 244 (882), 312-324',
    url: 'https://royalsocietypublishing.org/doi/10.1098/rsta.1952.0006',
    doi: '10.1098/rsta.1952.0006',
    license: 'publisher copyright (paywalled)',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Original not reachable (publisher and a JSTOR-derived copy at math.ntu.edu.tw are blocked from this container). ' +
      'Surge-front data taken from two independent open copies: (1) Lethe examples/multiphysics/dam-break/dam-break-2d.py ' +
      '(lethe-dambreak; 14 points, a = 2.25 in case, Z at steps of 1/9 = 0.25 in/a), (2) PySPH pysph/examples/db_exp_data.py ' +
      '(pysph-dbexp; digitised from Fig. 3, n^2 = 2, a = 1.125 in and a = 2.25 in). The two copies agree to |dZ| <= 0.08 where they overlap. ' +
      'DOI: Lethe and the Royal Society URL give rsta.1952.0006; PySPH docstring gives rsta.1952.0007 (that is believed to be Part V, pp. 325-334) - the PySPH DOI is treated as a typo. ' +
      'Abstract-level statements (front velocity scales with sqrt of column height in 2D) from web-search snippets only.',
    verified: false
  });

  LAB.registerSource({
    id: 'koshizuka1996',
    title: 'Moving-particle semi-implicit method for fragmentation of incompressible fluid',
    authors: 'S. Koshizuka, Y. Oka',
    year: 1996,
    venue: 'Nucl. Sci. Eng. 123, 421-434',
    url: 'https://doi.org/10.13182/NSE96-A24205',
    doi: '10.13182/NSE96-A24205',
    license: 'publisher copyright (paywalled)',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Not read. Data points "ko_data" (labelled experiment) and "ko_mps_data" (MPS computation) are available only as digitised in PySPH db_exp_data.py ' +
      '(axes z/L vs t*sqrt(2g/L) per the PySPH docstring). The EDAC-SPH manuscript (ramachandran2019edac, Sec. "Dam-break in two-dimensions") describes its comparison curve as the ' +
      'MPS result of Koshizuka & Oka, whereas PySPH dam_break_2d.py plots ko_data labelled "Koshizuka & Oka (1996)" - the provenance (experiment vs MPS, which experiment) is ambiguous.',
    verified: false
  });

  LAB.registerSource({
    id: 'pysph-dbexp',
    title: 'PySPH 1.0b2: pysph/examples/db_exp_data.py and dam_break_2d.py (dam-break experimental data and example)',
    authors: 'P. Ramachandran et al. (PySPH developers)',
    year: 2025,
    venue: 'PyPI package pysph 1.0b2 (uploaded 2025-05-23) (sdist pysph-1.0b2.tar.gz)',
    url: 'https://pypi.org/project/pysph/',
    doi: null,
    license: 'BSD-3-Clause',
    openAccess: true,
    access: 'full-text',
    accessNote: 'sdist downloaded from files.pythonhosted.org into a scratch dir and read (not installed, not executed). db_exp_data.py: Martin & Moyce n^2=2 a=1.125 in (10 pts) and a=2.25 in (15 pts) ' +
      'as (t*sqrt(2g/a), z/a), stated as "extracted from plots" (Fig. 3). dam_break_2d.py: 1 m x 2 m column in 4 m tank, g=9.81, rho0=1000, c0=10*sqrt(2*9.81*2), gamma=7, alpha=0.1, beta=0, ' +
      'h=1.3*dx, dx=0.03, Wendland quintic kernel, dt=0.125*h/c0, tf=2.5 s, front=max(x) of fluid particles.',
    verified: true
  });

  LAB.registerSource({
    id: 'lethe-dambreak',
    title: 'Lethe example "Dam-Break" (Martin and Moyce): dam-break-2d.py and dam-break.rst',
    authors: 'The Lethe Authors (Polytechnique Montreal, CHAOS lab)',
    year: 2026,
    venue: 'GitHub chaos-polymtl/lethe, commit 40ffaed6 (2026-10-12)',
    url: 'https://github.com/chaos-polymtl/lethe/blob/master/examples/multiphysics/dam-break/dam-break-2d.py',
    doi: null,
    license: 'Apache-2.0 WITH LLVM-exception OR LGPL-2.1-or-later',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Sparse git clone, read in full. Lists 14 Martin & Moyce (1952) points x_exp=tau=t*sqrt(2g/L), y_exp=delta=x_max/L, citing doi 10.1098/rsta.1952.0006. ' +
      'Post-processing adds time_correction=0.175 to simulated tau before plotting (an empirical shift for gate-opening/onset lag). Simulation uses L=3.5, g=1.',
    verified: true
  });

  LAB.registerSource({
    id: 'ritter1892',
    title: 'Die Fortpflanzung der Wasserwellen',
    authors: 'A. Ritter',
    year: 1892,
    venue: 'Zeitschrift des Vereines Deutscher Ingenieure 36 (33), 947-954',
    url: 'https://github.com/pypr/pysph/blob/master/pysph/examples/shallow_water/rectangular_dambreak.py',
    doi: null,
    license: 'public domain (age); open copy of the formula is BSD (PySPH)',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Original not read. Dry-bed shallow-water dam-break solution taken from PySPH 1.0b2 examples/shallow_water/rectangular_dambreak.py, ' +
      'function pos_actual: x = (2*sqrt(g*h0) - 3*sqrt(g*h))*t from the gate; the wet/dry front (h=0) moves at 2*sqrt(g*h0). Bibliographic details from general knowledge (unverified).',
    verified: false
  });

  // ---------------------------------------------------------------- WCSPH

  LAB.registerSource({
    id: 'monaghan1994',
    title: 'Simulating free surface flows with SPH',
    authors: 'J. J. Monaghan',
    year: 1994,
    venue: 'J. Comput. Phys. 110 (2), 399-406',
    url: 'https://doi.org/10.1006/jcph.1994.1034',
    doi: '10.1006/jcph.1994.1034',
    license: 'publisher copyright (paywalled)',
    openAccess: false,
    access: 'search-snippet',
    accessNote: 'Not read. Search snippets (secondary papers) attribute to it the Tait/Batchelor EOS p=B((rho/rho0)^gamma-1), gamma=7, and the rule c0 >= 10*Umax keeping density fluctuation ~1%. ' +
      'An often-quoted "B = 200 rho0 g H / gamma" could NOT be confirmed. Equation forms implemented from PySPH docstrings (pysph-wcsph).',
    verified: false
  });

  LAB.registerSource({
    id: 'monaghan2005',
    title: 'Smoothed particle hydrodynamics',
    authors: 'J. J. Monaghan',
    year: 2005,
    venue: 'Rep. Prog. Phys. 68, 1703-1759',
    url: 'https://doi.org/10.1088/0034-4885/68/8/R01',
    doi: '10.1088/0034-4885/68/8/R01',
    license: 'publisher copyright',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Not read (a seminar copy on cg.informatik.uni-freiburg.de is blocked). Cited by PySPH TaitEOS and MonaghanArtificialViscosity docstrings, whose formulas are used. ' +
      'Cubic-spline kernel normalisation 10/(7*pi*h^2) in 2D is the standard form, not verified against this text.',
    verified: false
  });

  LAB.registerSource({
    id: 'becker2007',
    title: 'Weakly compressible SPH for free surface flows',
    authors: 'M. Becker, M. Teschner',
    year: 2007,
    venue: 'Proc. ACM SIGGRAPH/Eurographics Symp. Computer Animation (SCA 2007), 209-217',
    url: 'https://cg.informatik.uni-freiburg.de/publications/2007_SCA_SPH.pdf',
    doi: '10.2312/SCA/SCA07/209-218',
    license: 'author copy (free to read)',
    openAccess: true,
    access: 'search-snippet',
    accessNote: 'Author PDF exists but host is blocked from this container. Snippets confirm: Tait EOS with high sound speed; relative density variation ~ |v_f|^2/c_s^2 and requirement ' +
      '|v_f|/c_s < sqrt(eta) with eta typically 0.01 (=> c_s >= 10 v_max). Artificial-viscosity form and time-step coefficients (lambda_v, lambda_f) NOT confirmed; ' +
      'a Pacific Graphics 2012 short paper citing it uses lambda_v=0.1, lambda_f=0.25.',
    verified: false
  });

  LAB.registerSource({
    id: 'gomezgesteira2010',
    title: 'State-of-the-art of classical SPH for free-surface flows',
    authors: 'M. Gomez-Gesteira, B. D. Rogers, R. A. Dalrymple, A. J. C. Crespo',
    year: 2010,
    venue: 'J. Hydraulic Res. 48 (Extra Issue), 6-27',
    url: 'https://ephyslab.uvigo.es/publica/documents/file_6Gomez-Gesteira_et_al_2010_JHR_SI.pdf',
    doi: '10.1080/00221686.2010.9641242',
    license: 'author copy (free to read)',
    openAccess: true,
    access: 'secondary-copy',
    accessNote: 'Paper not read (host blocked). Its 2D dam-break setup is reproduced in PySPH dam_break_2d.py (pysph-dbexp), whose parameter values are recorded here.',
    verified: false
  });

  LAB.registerSource({
    id: 'pysph-wcsph',
    title: 'PySPH 1.0b2: pysph/sph/wc/basic.py (TaitEOS, MomentumEquation) and pysph/sph/basic_equations.py (ContinuityEquation, XSPHCorrection)',
    authors: 'PySPH developers',
    year: 2025,
    venue: 'PyPI package pysph 1.0b2 (uploaded 2025-05-23)',
    url: 'https://pypi.org/project/pysph/',
    doi: null,
    license: 'BSD-3-Clause',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Docstrings and code read from the sdist. Gives the WCSPH equation set with LaTeX and its citations (Monaghan 1992, 2005; Cole 1948).',
    verified: true
  });

  LAB.registerSource({
    id: 'splishsplash',
    title: 'SPlisHSPlasH: WCSPH/TimeStepWCSPH.cpp and PBF/TimeStepPBF.{h,cpp}',
    authors: 'J. Bender et al.',
    year: 2026,
    venue: 'GitHub InteractiveComputerGraphics/SPlisHSPlasH (master)',
    url: 'https://github.com/InteractiveComputerGraphics/SPlisHSPlasH',
    doi: null,
    license: 'MIT',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Fetched via raw.githubusercontent.com. WCSPH defaults: stiffness 50, exponent 7, p = k*((rho/rho0)^7 - 1). PBF: lambda = -C/(sum|gradC|^2 + eps), eps=1e-6, cites Macklin & Mueller 2013.',
    verified: true
  });

  // ---------------------------------------------------------------- PBF

  LAB.registerSource({
    id: 'macklin2013',
    title: 'Position based fluids',
    authors: 'M. Macklin, M. Mueller',
    year: 2013,
    venue: 'ACM Trans. Graph. 32 (4), 104:1-104:12 (SIGGRAPH 2013)',
    url: 'https://mmacklin.com/pbf_sig_preprint.pdf',
    doi: '10.1145/2461912.2461984',
    license: 'author preprint (free to read)',
    openAccess: true,
    access: 'search-snippet',
    accessNote: 'Author preprint host blocked. Snippets confirm: C_i = rho_i/rho0 - 1; artificial pressure s_corr with |dq| = 0.1h...0.3h, k = 0.1, n = 4 "work well"; XSPH c "typically 0.01"; ' +
      'vorticity confinement as velocity post-process. lambda/Delta-p formulas cross-checked against open implementations (splishsplash, taichi-pbf2d). Equation numbers not verified.',
    verified: false
  });

  LAB.registerSource({
    id: 'taichi-pbf2d',
    title: 'Taichi example python/taichi/examples/simulation/pbf2d.py',
    authors: 'Taichi developers',
    year: 2026,
    venue: 'GitHub taichi-dev/taichi (master)',
    url: 'https://github.com/taichi-dev/taichi/blob/master/python/taichi/examples/simulation/pbf2d.py',
    doi: null,
    license: 'Apache-2.0',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Read via raw.githubusercontent.com. 2D PBF reference: poly6 density, spiky gradient, h=1.1, rho0=1, lambda_epsilon=100, 5 iterations, dt=1/20, corr_deltaQ_coeff=0.3, corrK=0.001, n=4. ' +
      'Note corrK=0.001 differs from the paper k=0.1 (tuned for its units).',
    verified: true
  });

  // ---------------------------------------------------------------- MLS-MPM

  LAB.registerSource({
    id: 'hu2018mlsmpm',
    title: 'A moving least squares material point method with displacement discontinuity and two-way rigid body coupling',
    authors: 'Y. Hu, Y. Fang, Z. Ge, Z. Qu, Y. Zhu, A. Pradhana, C. Jiang',
    year: 2018,
    venue: 'ACM Trans. Graph. 37 (4), 150 (SIGGRAPH 2018)',
    url: 'https://www.math.ucla.edu/~cffjiang/research/mlsmpm/hu2018mlsmpm.pdf',
    doi: '10.1145/3197517.3201293',
    license: 'author copy (free to read)',
    openAccess: true,
    access: 'search-snippet',
    accessNote: 'Paper PDF host blocked. Snippets confirm MLS-MPM recovers APIC/PolyPIC consistent with a Galerkin weak form. Concrete update equations taken from the authors\' open 88-line codes (mlsmpm88-cpp, taichi-mpm88).',
    verified: false
  });

  LAB.registerSource({
    id: 'mlsmpm88-cpp',
    title: 'taichi_mpm: mls-mpm88-explained.cpp (88-line MLS-MPM, explained version)',
    authors: 'Y. Hu (code), D. Medina (explanations)',
    year: 2018,
    venue: 'GitHub yuanming-hu/taichi_mpm (master)',
    url: 'https://github.com/yuanming-hu/taichi_mpm/blob/master/mls-mpm88-explained.cpp',
    doi: null,
    license: 'MIT',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Read via raw.githubusercontent.com. Quadratic B-spline weights, D^-1 = 4/dx^2, fused APIC+stress affine term (comment cites mls-mpm-cpic.pdf Eqn 29), C update 4/dx * sum w v_i (x_i-x_p)^T, F <- (I + dt C)F. Material is snow (fixed-corotated), not fluid.',
    verified: true
  });

  LAB.registerSource({
    id: 'taichi-mpm88',
    title: 'Taichi example python/taichi/examples/simulation/mpm88.py (MLS-MPM fluid in 88 lines)',
    authors: 'Y. Hu and Taichi developers',
    year: 2026,
    venue: 'GitHub taichi-dev/taichi (master)',
    url: 'https://github.com/taichi-dev/taichi/blob/master/python/taichi/examples/simulation/mpm88.py',
    doi: null,
    license: 'Apache-2.0',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Read in full via raw.githubusercontent.com. Weakly compressible fluid tracked by scalar J: stress = -dt*4*E*p_vol*(J-1)/dx^2, J *= 1 + dt*tr(C). ' +
      'n_grid=128, n_particles=8192, dt=2e-4, p_rho=1, p_vol=(dx/2)^2, E=400, g=9.8, bound=3 cells (slip-separating walls).',
    verified: true
  });

  // ---------------------------------------------------------------- SPH on Taylor-Green

  LAB.registerSource({
    id: 'adami2013',
    title: 'A transport-velocity formulation for smoothed particle hydrodynamics',
    authors: 'S. Adami, X. Y. Hu, N. A. Adams',
    year: 2013,
    venue: 'J. Comput. Phys. 241, 292-307',
    url: 'https://doi.org/10.1016/j.jcp.2013.01.043',
    doi: '10.1016/j.jcp.2013.01.043',
    license: 'publisher copyright (paywalled)',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Not read. Its TG results are described in the EDAC manuscript (ramachandran2019edac): uniform initial particles give about an order of magnitude more error than the "relaxed" initial condition. ' +
      'No numeric error values obtained.',
    verified: false
  });

  LAB.registerSource({
    id: 'ramachandran2019edac',
    title: 'Entropically damped artificial compressibility for SPH',
    authors: 'P. Ramachandran, K. Puri',
    year: 2019,
    venue: 'Computers & Fluids 179, 579-594 (arXiv:1612.05901)',
    url: 'https://gitlab.com/prabhu/edac_sph',
    doi: '10.1016/j.compfluid.2018.11.023',
    license: 'arXiv non-exclusive (manuscript source in public GitLab repo)',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Manuscript LaTeX (manuscript/results.tex) read from the public GitLab repo; figures are not in the repo, so curve values are not available. TG setup: Re=100, nx=ny=50, ' +
      'random perturbation max dx/5, quintic spline with h=dx, no artificial viscosity, PEC integrator, dt=min(h/(4(c_s+|U|max)), h^2/(8 nu)). Text: EDAC(TVF) L1 velocity error lower than TVF "by almost a factor of 4".',
    verified: true
  });

  LAB.registerSource({
    id: 'negi2022convergence',
    title: 'Techniques for second order convergent weakly-compressible smoothed particle hydrodynamics schemes without boundaries',
    authors: 'P. Negi, P. Ramachandran',
    year: 2022,
    venue: 'Phys. Fluids (arXiv:2107.11859)',
    url: 'https://gitlab.com/pypr/convergence_sph',
    doi: null,
    license: 'arXiv non-exclusive (manuscript source in public GitLab repo)',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Manuscript LaTeX read from public GitLab repo. TG exact solution with b=-8 pi^2/Re, Re=100, U=1, resolutions 50^2..500^2, c0=10U, dt=0.3h/(Umax+c0); ' +
      'text states EDAC/EWCSPH/L-IPST-C pressure errors ~4 orders below TVF and delta+SPH after 1 step. Numeric error values are in figures only (not in repo). Journal volume/DOI not verified.',
    verified: true
  });

  LAB.registerSource({
    id: 'pysph-tg',
    title: 'PySPH 1.0b2: pysph/examples/taylor_green.py',
    authors: 'PySPH developers',
    year: 2025,
    venue: 'PyPI package pysph 1.0b2 (uploaded 2025-05-23)',
    url: 'https://pypi.org/project/pysph/',
    doi: null,
    license: 'BSD-3-Clause',
    openAccess: true,
    access: 'full-text',
    accessNote: 'Read from sdist. Exact solution u=-U e^{bt} cos(2 pi x) sin(2 pi y), v=U e^{bt} sin(2 pi x) cos(2 pi y), p=-U^2 e^{2bt}(cos 4 pi x + cos 4 pi y)/4, b=-8 pi^2/Re, L=1, U=1, rho0=1, c0=10U, ' +
      'default nx=50, Re=100, tf=2, dt=min(0.25 h/(c0+U), 0.125 h^2/nu). Error metrics: Linf of max|v| decay, L1 of |v| normalised by mean exact |v|.',
    verified: true
  });

})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
