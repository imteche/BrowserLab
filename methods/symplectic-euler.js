/* Symplectic Euler (p-first: kick with force at q_n, then drift with p_{n+1}) for the Kepler scene.
 * Variant per research/ode.json ('p implicit / q explicit'; explicit for separable H).
 * Metadata from research/ode.json (method id 'symplectic-euler'). See docs/CONTRACTS.md §4. */
(function (LAB) {
  'use strict';

  var TRAIL_CAP = 20000;

  LAB.registerMethod({
    id: 'symplectic-euler',
    name: 'Symplectic Euler (p implicit / q explicit variant)',
    family: 'integrator',
    summary: 'The momentum is updated first with the force at the old position, then the position is ' +
      'advanced with the new momentum: p_{n+1} = p_n - h grad U(q_n), q_{n+1} = q_n + h p_{n+1}. This is the ' +
      'variant that is implicit in p and explicit in q; for the separable Kepler Hamiltonian it is fully explicit ' +
      'and costs one force evaluation per step. It is first order and symplectic but not time-reversible. ' +
      'The energy error is O(h) and stays bounded with no drift, angular momentum is conserved up to round-off, ' +
      'and the global error grows linearly in time. The orbit precesses (hairer1999notes reports clockwise ' +
      'precession; which variant that figure uses was not confirmed).',
    sources: ['hlw2006', 'hairer1999notes', 'hairer2010week2', 'blanes2008splitting'],
    equations: [
      { label: 'Kepler Hamiltonian',
        tex: 'H(p,q)=\\tfrac12|p|^2-\\frac{1}{|q|},\\quad \\dot q = p,\\ \\dot p = -\\frac{q}{|q|^3}',
        source: 'hlw2006', location: 'Sec. I.2.3 (secondary copy)' },
      { label: 'symplectic Euler step',
        tex: 'p_{n+1}=p_n-h\\,\\nabla U(q_n),\\quad q_{n+1}=q_n+h\\,p_{n+1}',
        source: 'hairer2010week2', location: 'Lecture 2, symplectic Euler (snippet; explicit for separable H)' },
      { label: 'general form',
        tex: 'p_{n+1}=p_n-hH_q(p_{n+1},q_n),\\ q_{n+1}=q_n+hH_p(p_{n+1},q_n)',
        source: 'hlw2006', location: 'Sec. I.1.2 / VI.3 (recollection, unverified)' }
    ],
    assumptions: [
      'constant step size h (symplectic long-time properties are lost with naive variable steps: hairer1997varsymp)',
      'separable H = T(p) + U(q), mu = 1, U(q) = -1/|q|'
    ],
    stability: 'Energy error O(h), bounded, no drift for nh up to exp(c/h) (backward error analysis; ' +
      'hlw2006 Thm IX.8.1 recollection). Orbit precesses clockwise (hairer1999notes snippet). ' +
      'For Kepler h must resolve pericentre passage.',
    scenes: {
      kepler: {
        params: [
          { key: 'e', label: 'Eccentricity e', min: 0, max: 0.95, step: 0.05, value: 0.6, live: false },
          { key: 'h', label: 'Step size h', min: 0.0001, max: 0.2, step: 0.0001, value: 0.01, live: true },
          { key: 'trail', label: 'Trail length (points)', min: 100, max: TRAIL_CAP, step: 100, value: 4000, live: true }
        ],
        notes: 'q0 = (1-e, 0), p0 = (0, sqrt((1+e)/(1-e))), from hlw2006 Sec. I.2.3. Variant: p first ' +
          '(kick with force at q_n), then q (drift with p_{n+1}). Changing h while the run is going is allowed. ' +
          'Each step is still symplectic, but the run is then a variable-step method and loses the ' +
          'bounded-energy guarantee. Restart to compare at fixed h.'
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'kepler') throw new Error('symplectic-euler supports only kepler');
      var e = +params.e, h = +params.h;
      var trail = Math.max(2, Math.min(TRAIL_CAP, Math.round(+params.trail || 4000)));

      // state s = [qx, qy, px, py]; f = cached force at current q
      var s = new Float64Array(4), f = new Float64Array(2);
      s[0] = 1 - e; s[1] = 0; s[2] = 0; s[3] = Math.sqrt((1 + e) / (1 - e));

      function force() {
        var x = s[0], y = s[1], r2 = x * x + y * y, inv3 = 1 / (r2 * Math.sqrt(r2));
        f[0] = -x * inv3; f[1] = -y * inv3;
      }
      force();

      function energy() {
        return 0.5 * (s[2] * s[2] + s[3] * s[3]) - 1 / Math.sqrt(s[0] * s[0] + s[1] * s[1]);
      }
      function angmom() { return s[0] * s[3] - s[1] * s[2]; }
      var H0 = energy(), L0 = angmom();

      // display ring buffer of positions
      var tx = new Float64Array(TRAIL_CAP), ty = new Float64Array(TRAIL_CAP);
      var head = 0, count = 0;
      function record() {
        tx[head] = s[0]; ty[head] = s[1];
        head = (head + 1) % TRAIL_CAP;
        if (count < TRAIL_CAP) count++;
      }
      record();

      var ext = 1 + e + 0.15;
      // t = tBase + (steps - nBase) * h, so t_N = N h exactly at constant h
      var tBase = 0, nBase = 0;

      var sim = {
        t: 0, steps: 0, dt: h,
        fields: ['orbit'],
        step: function () {
          s[2] += h * f[0]; s[3] += h * f[1];     // kick: p_{n+1} = p_n + h F(q_n)
          s[0] += h * s[2]; s[1] += h * s[3];     // drift: q_{n+1} = q_n + h p_{n+1}
          force();                                // cache F(q_{n+1}) for next step
          sim.steps++;
          sim.t = tBase + (sim.steps - nBase) * h;
          record();
        },
        setParam: function (key, value) {
          if (key === 'h') { tBase = sim.t; nBase = sim.steps; h = +value; sim.dt = h; }
          else if (key === 'trail') trail = Math.max(2, Math.min(TRAIL_CAP, Math.round(+value)));
        },
        view: function () {
          var n = Math.min(trail, count), xs = new Array(n), ys = new Array(n);
          var start = (head - n + TRAIL_CAP) % TRAIL_CAP;
          for (var i = 0; i < n; i++) {
            var k = (start + i) % TRAIL_CAP;
            xs[i] = tx[k]; ys[i] = ty[k];
          }
          return {
            kind: 'orbit',
            // orbit spans x in [-(1+e), 1-e], |y| <= sqrt(1-e^2); square box around the focus
            extent: [-ext, -ext, ext, ext],
            series: [{ label: 'symplectic Euler', x: xs, y: ys, role: 'sim' }],
            points: [{ x: 0, y: 0, label: 'focus' }, { x: s[0], y: s[1], label: 'q' }]
          };
        },
        metrics: function () {
          var H = energy(), L = angmom();
          return [
            { key: 't', label: 'time t', value: sim.t, unit: '', fmt: 'g' },
            { key: 'steps', label: 'steps', value: sim.steps, unit: '', fmt: 'i' },
            { key: 'periods', label: 'periods t/2π', value: sim.t / (2 * Math.PI), unit: '', fmt: 'g' },
            { key: 'H', label: 'energy H', value: H, unit: '', fmt: 'e' },
            { key: 'dH', label: '|H − H0|/|H0|', value: Math.abs(H - H0) / Math.abs(H0), unit: '', fmt: 'e' },
            { key: 'L', label: 'angular momentum L', value: L, unit: '', fmt: 'e' },
            { key: 'dL', label: '|L − L0|/|L0|', value: L0 !== 0 ? Math.abs(L - L0) / Math.abs(L0) : Math.abs(L - L0), unit: '', fmt: 'e' }
          ];
        },
        probe: function (name) {
          if (name === 'state') return { q: [s[0], s[1]], p: [s[2], s[3]] };
          if (name === 'invariants') return { H: energy(), L: angmom() };
          return null;
        },
        diverged: function () {
          if (!LAB.util.finiteAll(s)) return true;
          return Math.sqrt(s[0] * s[0] + s[1] * s[1]) < 1e-8;
        }
      };
      return sim;
    }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
