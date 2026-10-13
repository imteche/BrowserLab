/* Sources for the incompressible Navier-Stokes group (cavity, taylor-green, cylinder;
 * methods lbm-d2q9, psi-omega-fd, stable-fluids). Written by researcher agent (INS).
 * Network note: arxiv.org, publisher sites and most institutional sites were NOT reachable
 * from the research container. Values were taken from open GitHub copies (git clone) and
 * cross-checked against each other and against web-search snippets of the originals.
 * See research/ins.md for the full provenance log. */
(function (LAB) {
  'use strict';
  var S = function (s) { LAB.registerSource(s); };

  // ---------------------------------------------------------------- cavity: primary data
  S({
    id: 'ghia1982',
    title: 'High-Re solutions for incompressible flow using the Navier-Stokes equations and a multigrid method',
    authors: 'U. Ghia, K. N. Ghia, C. T. Shin', year: 1982,
    venue: 'J. Comput. Phys. 48(3), 387-411',
    url: 'https://gist.github.com/ivan-pi/3e9326d18a366ffe6a8e5bfda6353219',
    doi: '10.1016/0021-9991(82)90058-4',
    license: 'Elsevier (paywalled); numeric tables cited via open secondary copies',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Original paywalled; not read. Table I (u on x=0.5) and Table II (v on y=0.5) taken from four independent open copies: ' +
      'gist ivan-pi/3e9326d1... (ghiau.txt) and ivan-pi/caa6c673... (ghiav.txt); github sujaldave/2DLidDrivenCavityBenchmark literature/ghia_table_I_u.csv, ghia_table_II_v.csv; ' +
      'gist xuaoxiqi/6824605 (Re=1000 only); github cfdgasman/lid-driven-cavity cavity/ghia.py (Re=100 only, MIT); ' +
      'plus 4-decimal copies in chaos-polymtl/lethe examples/incompressible-flow/2d-lid-driven-cavity/ref-2d-ghia-u.txt (LGPL) and amikkonen/lidDrivenCavityCompressibleFlowPython ldc.py. ' +
      'All copies agree exactly for Re=100 and Re=1000 except Table II Re=1000 at x=0.9063 (ivan-pi gist -0.51500 vs sujaldave and xuaoxiqi -0.51550; majority value -0.51550 used). ' +
      'Primary-vortex psi_min Re=100 (-0.103423) from cfdgasman README quoting Ghia; Re=1000 (-0.117929 / 0.1179) from search snippets of open arXiv comparison tables and k-dense.ai report; ' +
      'vortex centres from sujaldave literature/ghia_vortex_centers.csv (Ghia Table V per that repo) and an arXiv table snippet (Re=1000: 0.5313, 0.5625).',
    verified: false
  });

  S({
    id: 'erturk2005',
    title: 'Numerical solutions of 2-D steady incompressible driven cavity flow at high Reynolds numbers',
    authors: 'E. Erturk, T. C. Corke, C. Gokcol', year: 2005,
    venue: 'Int. J. Numer. Methods Fluids 48, 747-774 (arXiv:cs/0411047)',
    url: 'https://arxiv.org/abs/cs/0411047',
    doi: '10.1002/fld.953',
    license: 'arXiv non-exclusive',
    openAccess: true,
    access: 'secondary-copy',
    accessNote: 'arXiv not reachable from container. Re=1000 u-centerline column taken from chaos-polymtl/lethe examples/incompressible-flow/2d-lid-driven-cavity/ref-2d-erturk-u.txt; ' +
      'first three entries (y=0.990: 0.8486, 0.980: 0.7065, 0.970: 0.5917) confirmed by a web-search snippet of the arXiv PDF table. ' +
      'Primary vortex Re=1000 psi=-0.118781 at (0.5300, 0.5650) confirmed by web-search snippet of arXiv cs/0411047. Paper uses psi-omega FD on a 601x601 grid with Thom wall vorticity (snippet). Table numbers not verified.',
    verified: false
  });

  S({
    id: 'botella1998',
    title: 'Benchmark spectral results on the lid-driven cavity flow',
    authors: 'O. Botella, R. Peyret', year: 1998,
    venue: 'Computers & Fluids 27(4), 421-433',
    url: 'https://doc.notus-cfd.org/d3/d8c/group__doc__validation__driven__cavity.html',
    doi: '10.1016/S0045-7930(98)00002-4',
    license: 'Elsevier (paywalled)',
    openAccess: false,
    access: 'search-snippet',
    accessNote: 'Not read. Primary vortex at Re=1000: |psi|=0.1189, omega=2.0678, centre (0.5308, 0.5652) from a web-search snippet of an arXiv comparison table (arXiv:1807.04896, Table A-2); ' +
      'Notus CFD validation page snippet gives omega=2.067753 at (0.4692, 0.5652) = mirrored x (Botella lid moves in -x). Chebyshev collocation N=160.',
    verified: false
  });

  // Open data copies (each is an independent transcription; listed so readers can audit)
  S({ id: 'copy-ivanpi-ghia', title: 'Ghia et al. (1982) Tables I and II transcription (ghiau.txt, ghiav.txt)', authors: 'I. Pribec (GitHub ivan-pi)', year: null,
      venue: 'GitHub gists', url: 'https://gist.github.com/ivan-pi/3e9326d18a366ffe6a8e5bfda6353219', doi: null,
      license: 'unspecified (public gist); factual data', openAccess: true, access: 'full-text',
      accessNote: 'Cloned both gists (u: 3e9326d18a366ffe6a8e5bfda6353219, v: caa6c6737d36a9140fbcf2ea59c78b3c). Contains a note that Re=400 v at x=0.9063 (-0.23827) is probably wrong in the original. Re=1000 v at x=0.9063 reads -0.51500 here, -0.51550 in two other copies.',
      verified: true });
  S({ id: 'copy-sujaldave-ghia', title: '2DLidDrivenCavityBenchmark literature CSVs (Ghia Tables I, II, V)', authors: 'GitHub sujaldave', year: null,
      venue: 'GitHub', url: 'https://github.com/sujaldave/2DLidDrivenCavityBenchmark/tree/main/literature', doi: null,
      license: 'unspecified in repo', openAccess: true, access: 'full-text',
      accessNote: 'Cloned. Coordinates given as exact 129-grid nodes (j/128). Re=100,400,1000,5000 only. Vortex-centre CSV has coordinates but no psi values.',
      verified: true });
  S({ id: 'copy-xuaoxiqi-ghia', title: 'Benchmark for lid driven cavity flow (Ghia Re=1000, n=129)', authors: 'GitHub xuaoxiqi', year: null,
      venue: 'GitHub gist 6824605', url: 'https://gist.github.com/xuaoxiqi/6824605', doi: null,
      license: 'unspecified (public gist)', openAccess: true, access: 'full-text', accessNote: 'Cloned; files Ghia-uy-re1000-n129.txt and Ghia-xv-re1000-n129.txt.', verified: true });
  S({ id: 'copy-cfdgasman-ghia', title: 'lid-driven-cavity: MAC projection solver validated against Ghia et al. 1982', authors: 'A. Karchani (GitHub cfdgasman)', year: 2026,
      venue: 'GitHub', url: 'https://github.com/cfdgasman/lid-driven-cavity', doi: null, license: 'MIT', openAccess: true, access: 'full-text',
      accessNote: 'cavity/ghia.py holds Re=100 Tables I/II; README quotes Ghia psi_min = -0.103423 at Re=100.', verified: true });
  S({ id: 'copy-lethe-cavity', title: 'Lethe example 2d-lid-driven-cavity reference files (Ghia u, Erturk u)', authors: 'Lethe developers (chaos-polymtl)', year: null,
      venue: 'GitHub', url: 'https://github.com/chaos-polymtl/lethe/tree/master/examples/incompressible-flow/2d-lid-driven-cavity', doi: null,
      license: 'LGPL-2.1 (repository)', openAccess: true, access: 'full-text',
      accessNote: 'Ghia u table rounded to 4 decimals (agrees with 5-decimal copies after rounding, max diff 1e-4); Erturk u table for Re=1000..21000.', verified: true });

  // ---------------------------------------------------------------- cylinder (DFG benchmark)
  S({
    id: 'schafer1996',
    title: 'Benchmark computations of laminar flow around a cylinder',
    authors: 'M. Schafer, S. Turek (with F. Durst, E. Krause, R. Rannacher)', year: 1996,
    venue: 'In: Flow Simulation with High-Performance Computers II, Notes Numer. Fluid Mech. 52, Vieweg, 547-566',
    url: 'https://www.mathematik.tu-dortmund.de/~featflow/en/benchmarks/cfdbenchmarking/flow/dfg_benchmark2_re100.html',
    doi: '10.1007/978-3-322-89849-4_39',
    license: 'Springer (paywalled); benchmark definition public on FeatFlow pages',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Original not read. Intervals ("lower/upper bound" rows of Tables 3 and 4 per the copies) taken from three independent MIT-licensed repos that agree exactly: ' +
      'useless-husband/vortexlab data/reference/schaefer_turek1996.csv; AdebanjiAdelowo/fem-cylinder-flow src/reference.py; mustafaobaidd1/karman-wind-tunnel src/sim/benchmark.ts; ' +
      'plus johanhoffman/DD2365_FEniCSx VALIDATION.md (2D-1 and 2D-2 intervals). Geometry from karman-wind-tunnel header and FeatFlow page snippet (pressure points (0.15,0.2),(0.25,0.2)).',
    verified: false
  });
  S({
    id: 'featflow-dfg',
    title: 'DFG flow around cylinder benchmarks 2D-1 (Re=20) and 2D-2 (Re=100), reference results',
    authors: 'S. Turek et al. (TU Dortmund FeatFlow group)', year: null,
    venue: 'FeatFlow benchmark web pages',
    url: 'https://wwwold.mathematik.tu-dortmund.de/~featflow/en/benchmarks/cfdbenchmarking/flow/dfg_benchmark1_re20.html',
    doi: null, license: 'public web page', openAccess: true, access: 'secondary-copy',
    accessNote: 'Site not reachable (DNS). Refined 2D-2 values (level 6, dt=1/1600: cd_max 3.227393, cl_max 0.986571, St 0.30184, dp 2.4848) as extracted by vortexlab from 20141124_dfg_bench2_official.zip; ' +
      'fem-cylinder-flow extracts cd_max 3.22739, cl_max 0.98658, dp 2.4829 from the same file with a different method (dp differs by 0.002). karman-wind-tunnel quotes St 0.30188, cl_max 0.9859.',
    verified: false
  });
  S({
    id: 'nabh1998',
    title: 'On higher order methods for the stationary incompressible Navier-Stokes equations',
    authors: 'G. Nabh', year: 1998, venue: 'PhD thesis, Universitat Heidelberg',
    url: 'https://wwwold.mathematik.tu-dortmund.de/~featflow/en/benchmarks/cfdbenchmarking/flow/dfg_benchmark1_re20.html',
    doi: null, license: 'thesis', openAccess: false, access: 'secondary-copy',
    accessNote: '2D-1 spectral values cD=5.57953523384, cL=0.010618948146, dp=0.11752016697 as quoted (FeatFlow page) in vortexlab, fem-cylinder-flow, karman-wind-tunnel and DD2365_FEniCSx.',
    verified: false
  });
  S({
    id: 'john2001',
    title: 'Higher-order finite element discretizations in a benchmark problem for incompressible flows',
    authors: 'V. John, G. Matthies', year: 2001, venue: 'Int. J. Numer. Methods Fluids 37(8), 885-903',
    url: 'https://github.com/precise-simulation/featool-multiphysics/blob/master/examples/ex_navierstokes3.m',
    doi: '10.1002/fld.195', license: 'Wiley (paywalled)', openAccess: false, access: 'secondary-copy',
    accessNote: 'Quoted in FEATool ex_navierstokes3.m: cd_ref=5.5795352338, cl_ref=0.010618937712, dp_ref=0.11752016697 (cl differs from the Nabh value in the 8th significant digit).',
    verified: false
  });
  S({ id: 'copy-vortexlab-dfg', title: 'vortexlab DFG reference CSV', authors: 'GitHub useless-husband', year: 2026, venue: 'GitHub',
      url: 'https://github.com/useless-husband/vortexlab/blob/main/data/reference/schaefer_turek1996.csv', doi: null, license: 'MIT', openAccess: true, access: 'full-text', accessNote: 'Cloned.', verified: true });
  S({ id: 'copy-adelowo-dfg', title: 'fem-cylinder-flow src/reference.py', authors: 'A. Adelowo', year: 2026, venue: 'GitHub',
      url: 'https://github.com/AdebanjiAdelowo/fem-cylinder-flow/blob/main/src/reference.py', doi: null, license: 'MIT', openAccess: true, access: 'full-text',
      accessNote: 'Cloned. States that the intervals were carried over without re-reading the paper.', verified: true });
  S({ id: 'copy-karman-dfg', title: 'karman-wind-tunnel src/sim/benchmark.ts', authors: 'M. Obaid', year: 2026, venue: 'GitHub',
      url: 'https://github.com/mustafaobaidd1/karman-wind-tunnel/blob/main/src/sim/benchmark.ts', doi: null, license: 'MIT', openAccess: true, access: 'full-text', accessNote: 'Cloned; also gives geometry and coefficient normalisation.', verified: true });

  // ---------------------------------------------------------------- Taylor-Green
  S({
    id: 'taylor1937',
    title: 'Mechanism of the production of small eddies from large ones',
    authors: 'G. I. Taylor, A. E. Green', year: 1937,
    venue: 'Proc. R. Soc. Lond. A 158, 499-521',
    url: 'https://royalsocietypublishing.org/doi/10.1098/rspa.1937.0036',
    doi: '10.1098/rspa.1937.0036', license: 'Royal Society (free-to-read archive)', openAccess: false, access: 'secondary-copy',
    accessNote: 'Original not read (site unreachable). The 2-D decaying solution used here is the standard form quoted in open LBM papers, e.g. arXiv:2112.08926 (search snippet: velocity ~ exp(-2 nu k^2 t), pressure/density perturbation ~ exp(-4 nu k^2 t)). ' +
      'The formula was verified independently by substitution into the incompressible Navier-Stokes equations (symbolic and finite-difference residual check, see research/ins.md).',
    verified: false
  });
  S({
    id: 'lehmann2022',
    title: 'On the accuracy and performance of the lattice Boltzmann method with 64-bit, 32-bit and novel 16-bit number formats',
    authors: 'M. Lehmann, M. J. Krause, G. Amati, M. Sega, J. Harting, S. Gekle', year: 2022,
    venue: 'Phys. Rev. E 106, 015308 (arXiv:2112.08926)', url: 'https://arxiv.org/abs/2112.08926', doi: '10.1103/PhysRevE.106.015308',
    license: 'arXiv non-exclusive', openAccess: true, access: 'search-snippet',
    accessNote: 'Only a search snippet seen: gives the 2-D Taylor-Green analytic solution with wavenumber k (velocity decays as exp(-2 nu k^2 t)). Equation number not verified. Bibliographic details beyond arXiv id from memory, unverified.',
    verified: false
  });

  // ---------------------------------------------------------------- methods
  S({
    id: 'qian1992',
    title: 'Lattice BGK models for Navier-Stokes equation',
    authors: 'Y. H. Qian, D. d\'Humieres, P. Lallemand', year: 1992, venue: 'Europhys. Lett. 17(6), 479-484',
    url: 'https://arxiv.org/abs/comp-gas/9401003', doi: '10.1209/0295-5075/17/6/001',
    license: 'IOP/EPL (paywalled)', openAccess: false, access: 'secondary-copy',
    accessNote: 'Not read. D2Q9 BGK equilibrium and weights cited through the open LBM cavity paper hou1995 (arXiv comp-gas/9401003, Sec. 2) and standard textbooks; section of hou1995 not read (arXiv unreachable).',
    verified: false
  });
  S({
    id: 'hou1995',
    title: 'Simulation of cavity flow by the lattice Boltzmann method',
    authors: 'S. Hou, Q. Zou, S. Chen, G. Doolen, A. C. Cogley', year: 1995, venue: 'J. Comput. Phys. 118, 329-347 (arXiv:comp-gas/9401003)',
    url: 'https://arxiv.org/abs/comp-gas/9401003', doi: '10.1006/jcph.1995.1103', license: 'arXiv non-exclusive', openAccess: true, access: 'search-snippet',
    accessNote: 'Abstract (search snippet): LBM vs other solutions for 2-D driven cavity over a wide Re range, error and convergence rates, compressibility effects at different maximum velocities, parameter ranges for stable simulation. Full text not read; page numbers of JCP version from memory.',
    verified: false
  });
  S({
    id: 'zou1997',
    title: 'On pressure and velocity boundary conditions for the lattice Boltzmann BGK model',
    authors: 'Q. Zou, X. He', year: 1997, venue: 'Phys. Fluids 9(6), 1591-1598 (arXiv:comp-gas/9611001; earlier preprint comp-gas/9508001)',
    url: 'https://arxiv.org/abs/comp-gas/9611001', doi: '10.1063/1.869307', license: 'arXiv non-exclusive', openAccess: true, access: 'search-snippet',
    accessNote: 'Abstract via search snippet: pressure/velocity BCs for 2-D/3-D LBGK using bounce-back of the non-equilibrium part; second-order accurate in numerical examples. Equation numbers not verified; the explicit top-wall formulas in research/ins.json were derived from the stated principle and checked to reproduce rho*u exactly.',
    verified: false
  });
  S({
    id: 'he1997',
    title: 'Theory of the lattice Boltzmann method: From the Boltzmann equation to the lattice Boltzmann equation',
    authors: 'X. He, L.-S. Luo', year: 1997, venue: 'Phys. Rev. E 56, 6811-6817',
    url: 'https://www.osti.gov/biblio/365474', doi: '10.1103/PhysRevE.56.6811', license: 'APS (paywalled)', openAccess: false, access: 'search-snippet',
    accessNote: 'OSTI record and abstract only (derives D2Q9 from the continuous Boltzmann-BGK equation). No arXiv copy found.', verified: false
  });
  S({
    id: 'ladd1994',
    title: 'Numerical simulations of particulate suspensions via a discretized Boltzmann equation. Part 1. Theoretical foundation',
    authors: 'A. J. C. Ladd', year: 1994, venue: 'J. Fluid Mech. 271, 285-309 (arXiv:comp-gas/9306004)',
    url: 'https://arxiv.org/abs/comp-gas/9306004', doi: '10.1017/S0022112094001771', license: 'arXiv non-exclusive', openAccess: true, access: 'search-snippet',
    accessNote: 'Cited as the usual origin of the moving-wall bounce-back correction; content of that section NOT confirmed (only abstract seen). DOI from memory.',
    verified: false
  });
  S({
    id: 'e1996',
    title: 'Vorticity boundary condition and related issues for finite difference schemes',
    authors: 'W. E, J.-G. Liu', year: 1996, venue: 'J. Comput. Phys. 124, 368-382',
    url: 'https://archive.ymsc.tsinghua.edu.cn/pacm_paperurl/20170209133543705146405', doi: '10.1006/jcph.1996.0066', license: 'author copy', openAccess: true, access: 'search-snippet',
    accessNote: 'Snippet (via arXiv:0809.3098): MAC scheme is equivalent to Thom\'s formula with centred differences; Thom is locally first order but globally second order (snippet of erturk2005). Venue/DOI from memory, unverified.',
    verified: false
  });
  S({
    id: 'stam1999',
    title: 'Stable fluids',
    authors: 'J. Stam', year: 1999, venue: 'Proc. SIGGRAPH 99, 121-128',
    url: 'https://pages.cs.wisc.edu/~chaol/data/cs777/stam-stable_fluids.pdf', doi: '10.1145/311535.311548',
    license: 'ACM; author/course copies online', openAccess: true, access: 'search-snippet',
    accessNote: 'PDF copies (Wisconsin course page, Freiburg seminar, Autodesk research) not reachable. Snippets confirm: semi-Lagrangian advection + implicit viscosity -> unconditionally stable; steps add force, advect, diffuse, project (Helmholtz-Hodge). Equation numbers not verified.',
    verified: false
  });
  S({
    id: 'stam2003',
    title: 'Real-time fluid dynamics for games',
    authors: 'J. Stam', year: 2003, venue: 'Proc. Game Developer Conference 2003',
    url: 'https://www.npmjs.com/package/stam-stable-fluids', doi: null,
    license: 'paper: author copy; JS port: ISC', openAccess: true, access: 'secondary-copy',
    accessNote: 'Paper PDF (dgp.toronto.edu GDC03.pdf, Freiburg copy) not reachable. Read the complete solver code as a direct JS port of Stam\'s solver03.c (npm stam-stable-fluids@1.0.3, ISC, github nornagon/stam-stable-fluids): ' +
      'add_source, diffuse (20 Gauss-Seidel sweeps, a=dt*nu*N^2), advect (backtrace + bilinear, clamped to [0.5,N+0.5]), project (central-difference divergence, 20 GS sweeps), set_bnd (reflective no-penetration walls).',
    verified: false
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
