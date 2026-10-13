/* References for scene `kepler` (planar two-body problem, mu = 1).
 *
 *   H(p,q) = |p|^2/2 - 1/|q|,   L = q1 p2 - q2 p1
 *   q(0) = (1-e, 0),  p(0) = (0, sqrt((1+e)/(1-e)))         [hlw2006 Sec. I.2.3; reproduced in open papers]
 *
 * With these ICs: H0 = -1/2 for every e in [0,1), semi-major axis a = -1/(2 H0) = 1,
 * period T = 2 pi a^{3/2} = 2 pi, L0 = sqrt(1-e^2), Runge–Lenz vector A0 = (e, 0).
 * The exact solution below is derived analytically (Kepler's equation); it is not
 * copied from a source, so it is checked by research/test-kepler-exact.js instead.
 *
 * Pure JS, deterministic, no DOM access.
 */
(function (LAB) {
  'use strict';

  var TWO_PI = 2 * Math.PI;

  function eccOf(params) {
    var e = params && typeof params.e === 'number' ? params.e : 0.6;
    if (!(e >= 0 && e < 1)) throw new Error('kepler reference: eccentricity must be in [0,1), got ' + e);
    return e;
  }

  /* Solve Kepler's equation M = E - e sin E for E by Newton's method.
   * M is reduced to [-pi, pi) first; the result is shifted back so E is continuous in M. */
  function solveKepler(M, e) {
    var k = Math.floor((M + Math.PI) / TWO_PI);
    var Mr = M - k * TWO_PI;                       // in [-pi, pi)
    var E = e < 0.8 ? Mr : (Mr >= 0 ? Math.PI : -Math.PI);
    for (var it = 0; it < 60; it++) {
      var f = E - e * Math.sin(E) - Mr;
      var d = f / (1 - e * Math.cos(E));
      E -= d;
      if (Math.abs(d) < 1e-16) break;
    }
    return E + k * TWO_PI;
  }

  /* Exact state at time t (mu = 1, a = 1, n = 1, pericentre passage at t = 0). */
  function exactState(t, params) {
    var e = eccOf(params);
    var E = solveKepler(t, e);                     // mean anomaly M = n t = t
    var c = Math.cos(E), s = Math.sin(E);
    var b = Math.sqrt(1 - e * e);
    var Edot = 1 / (1 - e * c);                    // dE/dt = n / (1 - e cos E)
    return { q: [c - e, b * s], p: [-s * Edot, b * c * Edot] };
  }

  function invariants(q, p) {
    var r = Math.sqrt(q[0] * q[0] + q[1] * q[1]);
    var H = 0.5 * (p[0] * p[0] + p[1] * p[1]) - 1 / r;
    var L = q[0] * p[1] - q[1] * p[0];
    // Runge–Lenz (Laplace) vector A = p x (L e_z) - q/|q|
    var A = [p[1] * L - q[0] / r, -p[0] * L - q[1] / r];
    return { H: H, L: L, A: A };
  }

  // Exposed for checks (not part of the contract, harmless if unused).
  LAB.keplerAnalytic = { solveKepler: solveKepler, exactState: exactState, invariants: invariants };

  /* ---------------------------------------------------------------- exact solution */

  LAB.registerReference({
    id: 'kepler-exact-solution',
    scene: 'kepler',
    quantity: 'exact state {q:[x,y], p:[px,py]} at time t for eccentricity params.e (default 0.6); signature fn(t, params)',
    source: 'hlw2006', location: 'Sec. I.2.3 initial values (secondary copy); solution derived analytically via Kepler\'s equation M = E - e sin E',
    kind: 'function',
    fn: exactState,
    tolerance: {
      metric: 'global-error-order',
      value: 0.3,
      rationale: 'Use as ground truth for global error |y_N - y(t_N)| (Euclidean norm over (q,p)). Exact to ~1e-13 (see research/test-kepler-exact.js), ' +
        'so any integrator error above 1e-10 is measurable. The observed order log2(err(h)/err(h/2)) at fixed t_end should match the method order within +-0.3.'
    }
  });

  /* ---------------------------------------------------------------- invariants */

  LAB.registerReference({
    id: 'kepler-H0', scene: 'kepler',
    quantity: 'initial energy H0 = |p0|^2/2 - 1/|q0| (independent of e for the standard ICs)',
    source: 'hlw2006', location: 'Sec. I.2.3 (secondary copy); value derived: (1+e)/(2(1-e)) - 1/(1-e) = -1/2',
    kind: 'scalar', value: -0.5, range: [-0.5, -0.5],
    tolerance: { metric: 'abs', value: 1e-14, rationale: 'Exact algebraic identity; floating-point evaluation of the ICs only.' }
  });

  LAB.registerReference({
    id: 'kepler-L0', scene: 'kepler',
    quantity: 'initial angular momentum L0 = q1 p2 - q2 p1 = sqrt(1-e^2); fn(e) -> L0. For e = 0.6, L0 = 0.8',
    source: 'hlw2006', location: 'Sec. I.2.3 (secondary copy); value derived from the ICs',
    kind: 'function',
    fn: function (e) { return Math.sqrt(1 - e * e); },
    value: 0.8,
    tolerance: { metric: 'abs', value: 1e-14, rationale: 'Exact algebraic identity.' }
  });

  LAB.registerReference({
    id: 'kepler-runge-lenz', scene: 'kepler',
    quantity: 'Runge–Lenz vector A = (p2 L - q1/|q|, -p1 L - q2/|q|); exact value (e, 0); fn(e) -> [e, 0]',
    source: 'blanes2008splitting', location: 'Kepler example (search snippet: LRL vector not preserved by symplectic Euler); value derived analytically',
    kind: 'function',
    fn: function (e) { return [e, 0]; },
    tolerance: { metric: 'abs', value: 1e-14,
      rationale: 'Conserved by the exact flow. NOT conserved by any of the four methods; its slow rotation is the orbit precession, so use it as a diagnostic, not a pass/fail test.' }
  });

  LAB.registerReference({
    id: 'kepler-period', scene: 'kepler',
    quantity: 'orbital period T = 2 pi a^{3/2} with a = -1/(2 H0) = 1',
    source: 'hlw2006', location: 'Sec. I.2.3 (secondary copy; snippets of arXiv 1807.10952 and 2202.01541 also state period 2 pi)',
    kind: 'scalar', value: TWO_PI, range: [TWO_PI, TWO_PI],
    tolerance: { metric: 'abs', value: 1e-12, rationale: 'Kepler\'s third law, exact.' }
  });

  /* ---------------------------------------------------------------- source protocols (figures) */

  LAB.registerReference({
    id: 'kepler-hairer-figure-protocol', scene: 'kepler',
    quantity: 'step sizes / step counts used in the Kepler orbit figure of Hairer\'s lecture notes (qualitative figure, no numeric results)',
    source: 'hairer1999notes',
    location: 'Kepler figure in the symplectic-methods chapter (search snippet only; figure number not seen). Eccentricity of this figure unconfirmed (one snippet says 0, the standard example uses 0.6)',
    kind: 'table',
    columns: ['method', 'h', 'steps', 't_end'],
    rows: [
      ['symplectic-euler', 0.05, 4000, 200],
      ['implicit-midpoint', 0.05, 4000, 200],
      ['explicit-euler', 0.0005, null, null]
    ],
    notes: 'explicit Euler h: snippet says the symplectic runs used "a step size 100 times larger" than explicit Euler, so h_EE = 0.0005 is inferred, not read. ' +
      'Expected qualitative outcome (snippet): symplectic Euler orbit = ellipse precessing slowly clockwise about the focus; implicit midpoint precesses anticlockwise; ' +
      'explicit Euler spirals outward (energy increases). t_end = 4000*0.05 = 200 ~ 31.8 periods is computed, not quoted.',
    tolerance: { metric: 'qualitative', value: null, rationale: 'Protocol only; reproduce the picture, then apply the quantitative order tests below.' }
  });

  /* ---------------------------------------------------------------- theoretical error behaviour */
  /* The THEORETICAL values (orders, growth exponents) are cited from sources. The PROTOCOLS (h, t_end)
   * were chosen by this researcher from a pilot run (research/ode.md, "Pilot calibration") so that each
   * method is in its asymptotic regime at e = 0.6. Pilot numbers are lab-computed, NOT source data.
   *
   * Metrics:
   *   energy error   dH = max_{0<=n<=N} |H(y_n) - H0|
   *   global error   err = |y_N - y_exact(t_N)|, Euclidean norm over (q1,q2,p1,p2), t_N = N h, N = round(t_end/h)
   *   observed order p_obs = log2(metric(h) / metric(h/2)) at fixed t_end
   *   growth exponent k = log(metric(t2)/metric(t1)) / log(t2/t1) at fixed h
   *
   * PITFALL (found in pilot): symplectic Euler sampled at whole periods t = nT shows global-error order 2,
   * because it is conjugate to Störmer–Verlet (the O(h) conjugacy offset cancels when the orbit returns to
   * the same point). Sample symplectic Euler order tests at t = (n + 1/2) T. */

  var T = TWO_PI;
  var ORD_RAT = 'Observed order from an (h, h/2) pair must lie within +-0.3 of the theoretical order. 0.3 tolerates residual pre-asymptotic ' +
    'contamination at the chosen h (pilot values within 0.25) while still rejecting the neighbouring integer order.';
  var GR_RAT = 'Growth exponent k = log(m(t2)/m(t1))/log(t2/t1). +-0.3 separates bounded (0), linear (1) and quadratic (2) growth.';

  function ref(id, method, quantity, value, source, location, protocol, metric, rationale, pilot) {
    LAB.registerReference({
      id: id, scene: 'kepler', method: method, quantity: quantity,
      source: source, location: location,
      kind: 'scalar', value: value, range: [value - 0.3, value + 0.3],
      protocol: protocol,
      pilot: pilot,   // lab-computed by the researcher with a reference implementation; not a source number
      tolerance: { metric: metric, value: 0.3, rationale: rationale }
    });
  }

  // --- order in h: energy error
  ref('kepler-order-energy-explicit-euler', 'explicit-euler',
    'observed order in h of max energy error (theory 1; energy drifts as O(h t))', 1,
    'hairer1999notes', 'Kepler long-time table, snippet: "the error in the energy grows linearly for the explicit Euler method"; order 1 = method order',
    { e: 0.6, t_end: T, h: 1e-4 }, 'observed-order', ORD_RAT, { p_obs: 0.96 });
  ref('kepler-order-energy-symplectic-euler', 'symplectic-euler',
    'observed order in h of max energy error (theory 1, bounded, no drift)', 1,
    'hairer1999notes', 'Kepler long-time table, snippet: energy error "remains bounded and small for the symplectic Euler method"; ' +
      'general theorem H(y_n)-H0 = O(h^p) for nh <= exp(h0/(2h)): hlw2006 Thm IX.8.1 (recollection, unverified)',
    { e: 0.6, t_end: 10.5 * T, h: 5e-4 }, 'observed-order', ORD_RAT, { p_obs: 1.00 });
  ref('kepler-order-energy-stormer-verlet', 'stormer-verlet',
    'observed order in h of max energy error (theory 2, bounded over exponentially long times)', 2,
    'hlw2003', 'Sec. 4 Backward error analysis (p.419) and Sec. 5 Long-time behaviour (p.425); snippet: energy error O(h^2) over long times, ' +
      'no drift for Kepler. Theorem number not seen',
    { e: 0.6, t_end: 10.5 * T, h: 1e-2 }, 'observed-order', ORD_RAT, { p_obs: 2.00 });
  ref('kepler-order-energy-rk4', 'rk4',
    'observed order in h of max energy error (theory 4; non-symplectic so the error drifts as O(h^4 t))', 4,
    'kutta1901', 'classical order 4 of RK4 (standard result; original not consulted)',
    { e: 0.6, t_end: 10.5 * T, h: 1.25e-3 }, 'observed-order', ORD_RAT + ' RK4 is pre-asymptotic at h >= 2.5e-3 for e = 0.6 (pilot p_obs = 4.39 at h = 2.5e-3).',
    { p_obs: 4.22 });

  // --- order in h: global error
  ref('kepler-order-global-explicit-euler', 'explicit-euler', 'observed order in h of global error (theory 1)', 1,
    'hlw2006', 'classical convergence order of explicit Euler',
    { e: 0.6, t_end: T, h: 1e-4 }, 'observed-order', ORD_RAT + ' Explicit Euler error is O(1) after 10 periods even at h = 1e-5, so t_end = T.',
    { p_obs: 1.00 });
  ref('kepler-order-global-symplectic-euler', 'symplectic-euler', 'observed order in h of global error at a half period (theory 1)', 1,
    'hlw2006', 'classical order of symplectic Euler; conjugacy to Störmer–Verlet explains order 2 at whole periods (see PITFALL)',
    { e: 0.6, t_end: 10.5 * T, h: 5e-4 }, 'observed-order', ORD_RAT, { p_obs: 0.94, p_obs_at_10T_h1e3: 2.00 });
  ref('kepler-order-global-stormer-verlet', 'stormer-verlet', 'observed order in h of global error (theory 2)', 2,
    'hlw2003', 'Sec. 1 (second order of the Störmer–Verlet scheme); snippet-level access only',
    { e: 0.6, t_end: 10.5 * T, h: 1e-2 }, 'observed-order', ORD_RAT, { p_obs: 2.00 });
  ref('kepler-order-global-rk4', 'rk4', 'observed order in h of global error (theory 4)', 4,
    'kutta1901', 'classical order 4',
    { e: 0.6, t_end: 10.5 * T, h: 1.25e-3 }, 'observed-order', ORD_RAT, { p_obs: 4.09 });

  // --- growth in time at fixed h: global error
  ref('kepler-growth-global-explicit-euler', 'explicit-euler', 'time-growth exponent of global error (theory: quadratic)', 2,
    'hairer1999notes', 'Kepler long-time table, snippet: global error shows "a quadratic growth for explicit Euler"',
    { e: 0.6, h: 1e-6, t1: T, t2: 4 * T }, 'growth-exponent', GR_RAT + ' Needs h = 1e-6 so the orbit stays close to the exact one up to 4T.', { k: 2.00 });
  ref('kepler-growth-global-symplectic-euler', 'symplectic-euler', 'time-growth exponent of global error (theory: linear)', 1,
    'hairer1999notes', 'Kepler long-time table, snippet: "linear growth for symplectic Euler and the implicit midpoint rule"; general result hlw2006 Sec. X.3 (recollection)',
    { e: 0.6, h: 1e-3, t1: 10 * T, t2: 40 * T }, 'growth-exponent', GR_RAT +
      ' Sample at whole periods here: at half periods the bounded O(h) conjugacy offset dominates until t ~ 1/h and hides the linear growth (pilot k = -0.48 at 10.5T->40.5T).',
    { k: 1.00 });
  ref('kepler-growth-global-stormer-verlet', 'stormer-verlet', 'time-growth exponent of global error (theory: linear)', 1,
    'hlw2003', 'abstract and Sec. 5, snippet: "linear error growth"',
    { e: 0.6, h: 1e-2, t1: 10.5 * T, t2: 40.5 * T }, 'growth-exponent', GR_RAT +
      ' Sample at apocentre (half periods); at pericentre (speed 2) the phase error saturates by 40T at h = 1e-2.', { k: 1.00 });
  ref('kepler-growth-global-rk4', 'rk4', 'time-growth exponent of global error (theory: quadratic, non-symplectic)', 2,
    'hairer1997varsymp', 'snippet: symplectic constant-step methods give linear "rather than quadratic" error growth, i.e. non-symplectic methods grow quadratically',
    { e: 0.6, h: 1e-2, t1: 40 * T, t2: 160 * T }, 'growth-exponent', GR_RAT + ' Quadratic regime only emerges after the energy drift dominates (pilot k = 1.5 for 10.5T->40.5T).',
    { k: 1.92 });

  // --- growth in time at fixed h: energy error (bounded vs drift)
  ref('kepler-growth-energy-explicit-euler', 'explicit-euler', 'time-growth exponent of max energy error (theory: linear drift)', 1,
    'hairer1999notes', 'Kepler long-time table (snippet)',
    { e: 0.6, h: 1e-6, t1: T, t2: 4 * T }, 'growth-exponent', GR_RAT, { k: 1.00 });
  ref('kepler-growth-energy-symplectic-euler', 'symplectic-euler', 'time-growth exponent of max energy error (theory: 0, bounded)', 0,
    'hairer1999notes', 'Kepler long-time table (snippet): bounded energy error',
    { e: 0.6, h: 1e-3, t1: 10 * T, t2: 40 * T }, 'growth-exponent', GR_RAT, { k: 0.00 });
  ref('kepler-growth-energy-stormer-verlet', 'stormer-verlet', 'time-growth exponent of max energy error (theory: 0, bounded)', 0,
    'hlw2003', 'Sec. 5 long-time energy conservation (snippet)',
    { e: 0.6, h: 1e-2, t1: 10.5 * T, t2: 40.5 * T }, 'growth-exponent', GR_RAT, { k: 0.00 });
  ref('kepler-growth-energy-rk4', 'rk4', 'time-growth exponent of max energy error (theory: linear drift)', 1,
    'hairer1997varsymp', 'snippet: non-symplectic integration has a secular (drifting) energy error',
    { e: 0.6, h: 1e-2, t1: 40 * T, t2: 160 * T }, 'growth-exponent', GR_RAT, { k: 0.97 });

  /* ---------------------------------------------------------------- angular momentum */
  LAB.registerReference({
    id: 'kepler-L-conservation', scene: 'kepler',
    quantity: 'angular momentum conservation per method: exact up to round-off for symplectic-euler and stormer-verlet; not conserved by explicit-euler (L_{n+1} - L_n = h^2 p_n x F(q_n)) or rk4',
    source: 'hairer1999notes',
    location: 'Kepler long-time table: "angular momentum exactly conserved for the symplectic Euler and the implicit midpoint rule" (snippet); Störmer–Verlet conserves quadratic invariants of the form q^T C p: hlw2003 Sec. 3 (unverified)',
    kind: 'table',
    columns: ['method', 'conservesL'],
    rows: [['explicit-euler', false], ['symplectic-euler', true], ['stormer-verlet', true], ['rk4', false]],
    tolerance: { metric: 'max-abs |L_n - L0| over run', value: 1e-12,
      rationale: 'Round-off accumulation over ~1e5 steps of O(1) quantities stays below ~1e-12; any O(h^p) drift would exceed it by orders of magnitude.' }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
