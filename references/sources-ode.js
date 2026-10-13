/* Sources for the Hamiltonian ODE integrator group (scene `kepler`).
 * Researcher: ode researcher agent, 2026-10-13.
 * NETWORK NOTE: every PDF host (unige.ch, mcgill.ca, kit.edu, ucsd.edu, uvm.edu,
 * tuebingen.de, arxiv.org) was DNS/proxy-blocked from the research container.
 * All content below was obtained from web-search snippets only, so every
 * source is `verified: false`. Locations marked "recollection" were not seen
 * in any snippet and must be checked against the original before being relied on.
 */
(function (LAB) {
  'use strict';

  LAB.registerSource({
    id: 'hlw2003',
    title: 'Geometric numerical integration illustrated by the Störmer–Verlet method',
    authors: 'E. Hairer, C. Lubich, G. Wanner', year: 2003,
    venue: 'Acta Numerica 12, 399-450',
    url: 'https://www.unige.ch/~hairer/preprints/gniverlet.html',
    doi: '10.1017/S0962492902000144',
    license: 'author preprint (free to read); journal version (c) Cambridge University Press',
    openAccess: true,
    access: 'search-snippet',
    accessNote: 'Author copy at unige.ch/~hairer/preprints/gniverlet.html; mirrors at math.mcgill.ca/~gantumur/docs/down/gniverlet.pdf, ' +
      'math.kit.edu/ianm3/lehre/geonumint2009s/media/gni_by_stoermer-verlet.pdf, courses.physics.ucsd.edu/2019/Winter/physics141/Assignments/stoermer-verlet.pdf, ' +
      'and archive-ouverte.unige.ch/unige:12277. All unreachable from the container (DNS blocked). Section list (Sec. 1 Newton–Störmer–Verlet–leapfrog p.400; ' +
      'Sec. 2 Geometric properties p.408; Sec. 3 Conservation of first integrals p.416; Sec. 4 Backward error analysis p.419; Sec. 5 Long-time behaviour p.425) ' +
      'and the abstract claims (long-time energy conservation, linear error growth, O(h^2) energy error bound with no drift for Kepler) come from search snippets.',
    verified: false
  });

  LAB.registerSource({
    id: 'hlw2006',
    title: 'Geometric Numerical Integration: Structure-Preserving Algorithms for Ordinary Differential Equations (2nd ed.)',
    authors: 'E. Hairer, C. Lubich, G. Wanner', year: 2006,
    venue: 'Springer Series in Computational Mathematics 31',
    url: 'https://link.springer.com/book/10.1007/3-540-30666-8',
    doi: '10.1007/3-540-30666-8',
    license: 'proprietary (Springer)',
    openAccess: false,
    access: 'secondary-copy',
    accessNote: 'Paywalled. Kepler set-up (H = |p|^2/2 - 1/|q|, q0=(1-e,0), p0=(0,sqrt((1+e)/(1-e))), e=0.6, period 2pi) is the standard Ch. I Sec. I.2.3 example; ' +
      'it is reproduced in open papers found via search (arXiv 1807.10952, arXiv 2202.01541, arXiv 0812.0377) and in hairer1999notes. Theorem numbers ' +
      '(IX.8.1 long-time energy conservation; Sec. X.3 linear error growth) are from recollection, not seen in any snippet.',
    verified: false
  });

  LAB.registerSource({
    id: 'hairer1999notes',
    title: 'Numerical Geometric Integration (lecture notes)',
    authors: 'E. Hairer', year: 1999,
    venue: 'Université de Genève, lecture notes 1998/99',
    url: 'https://www.math.mcgill.ca/gantumur/docs/down/Hairer9899.pdf',
    doi: null,
    license: 'author lecture notes, freely posted',
    openAccess: true,
    access: 'search-snippet',
    accessNote: 'Open mirror on McGill page (DNS-blocked here). Search snippets give: Kepler figure with symplectic Euler and implicit midpoint at h = 0.05 ' +
      '(4000 steps), explicit Euler with a step size 100 times smaller; text "the numerical solution lies close to an ellipse which turns slowly around its focus, ' +
      'clockwise for the symplectic Euler method and anticlockwise for the implicit midpoint rule"; a table of long-time behaviour: energy error grows linearly for ' +
      'explicit Euler and stays bounded and small for symplectic Euler; global error grows quadratically for explicit Euler and linearly for symplectic Euler and ' +
      'implicit midpoint; angular momentum exactly conserved by symplectic Euler and implicit midpoint. One snippet reported e = 0 rather than 0.6 for this figure ' +
      '(likely garbled extraction); the eccentricity of that figure is therefore UNCONFIRMED.',
    verified: false
  });

  LAB.registerSource({
    id: 'hairer2010week2',
    title: 'Geometric Numerical Integration, Lecture 2: Symplectic integrators',
    authors: 'E. Hairer', year: 2010,
    venue: 'TU München lecture notes, winter 2009/10 (poly_geoint/week2.pdf)',
    url: 'https://www.unige.ch/~hairer/poly_geoint/week2.pdf',
    doi: null,
    license: 'author lecture notes, freely posted',
    openAccess: true,
    access: 'search-snippet',
    accessNote: 'DNS-blocked here. Snippets: symplectic Euler applied to Kepler with e = 0.6 on [0, 7.5]; Störmer–Verlet is the composition of the two ' +
      'symplectic Euler variants with step h/2; pendulum figure uses h = pi/4 (first-order methods) and h = pi/3 (second-order methods).',
    verified: false
  });

  LAB.registerSource({
    id: 'blanes2008splitting',
    title: 'Splitting and composition methods in the numerical integration of differential equations',
    authors: 'S. Blanes, F. Casas, A. Murua', year: 2008,
    venue: 'Bol. Soc. Esp. Mat. Apl. 45, 89-145 (arXiv:0812.0377)',
    url: 'https://arxiv.org/abs/0812.0377',
    doi: null,
    license: 'arXiv non-exclusive',
    openAccess: true,
    access: 'search-snippet',
    accessNote: 'arXiv DNS-blocked here. Snippets: Kepler with e = 0.6; explicit Euler orbit spirals outward; symplectic Euler keeps the ellipse but precesses; ' +
      'symplectic Euler conserves angular momentum exactly but not the Laplace–Runge–Lenz vector; position error grows only linearly for symplectic splitting methods.',
    verified: false
  });

  LAB.registerSource({
    id: 'hairer1997varsymp',
    title: 'Variable time step integration with symplectic methods',
    authors: 'E. Hairer', year: 1997,
    venue: 'Appl. Numer. Math. 25, 219-227',
    url: 'https://www.unige.ch/~hairer/preprints/varsymp.html',
    doi: '10.1016/S0168-9274(97)00061-5',
    license: 'author preprint (free to read)',
    openAccess: true,
    access: 'search-snippet',
    accessNote: 'Snippet: constant-step symplectic methods have no secular energy error and show linear rather than quadratic error growth in the angle variables. ' +
      'DOI from recollection, not verified.',
    verified: false
  });

  LAB.registerSource({
    id: 'kutta1901',
    title: 'Beitrag zur näherungsweisen Integration totaler Differentialgleichungen',
    authors: 'W. Kutta', year: 1901,
    venue: 'Z. Math. Phys. 46, 435-453',
    url: 'https://archive.org/search?query=Zeitschrift+f%C3%BCr+Mathematik+und+Physik+1901',
    doi: null,
    license: 'public domain (1901)',
    openAccess: true,
    access: 'secondary-copy',
    accessNote: 'Classical RK4 tableau (0; 1/2,1/2; 1/2,0,1/2; 1,0,0,1; weights 1/6,1/3,1/3,1/6) is textbook-standard; original not consulted. ' +
      'Order 4 and non-symplecticity are standard (RK4 does not satisfy b_i a_ij + b_j a_ji = b_i b_j).',
    verified: false
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
