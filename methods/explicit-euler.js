/* Explicit (forward) Euler integrator for the Kepler scene.
 * Metadata from research/ode.json (method id 'explicit-euler'). See docs/CONTRACTS.md §4. */
(function (LAB) {
  'use strict';

  var TRAIL_CAP = 20000;

  LAB.registerMethod({
    id: 'explicit-euler',
    name: 'Explicit Euler',
    family: 'integrator',
    summary: 'Both position and momentum are advanced with the derivative evaluated at the start of ' +
      'the step: q gains h times the old momentum and p gains h times the force at the old position. ' +
      'It is explicit, first order, and costs one force evaluation per step, but it is neither ' +
      'symplectic nor time-reversible. On the Kepler problem the energy grows linearly in time for ' +
      'every step size, so the orbit spirals outward; angular momentum is not conserved either ' +
      '(each step changes it by h² p×F), and the global error grows quadratically in time. It is ' +
      'shown here as the baseline against which the symplectic methods are compared.',
    sources: ['hlw2006', 'hairer1999notes', 'blanes2008splitting'],
    equations: [
      { label: 'Kepler Hamiltonian',
        tex: 'H(p,q)=\\tfrac12|p|^2-\\frac{1}{|q|},\\quad \\dot q = p,\\ \\dot p = -\\frac{q}{|q|^3}',
        source: 'hlw2006', location: 'Sec. I.2.3 (secondary copy)' },
      { label: 'explicit Euler step',
        tex: 'q_{n+1}=q_n+h\\,p_n,\\quad p_{n+1}=p_n-h\\,\\frac{q_n}{|q_n|^3}',
        source: 'hlw2006', location: 'Sec. I.1 (classical; secondary copy)' },
      { label: 'angular momentum change (derived)',
        tex: 'L_{n+1}-L_n=h^2\\,p_n\\times F(q_n)',
        source: 'hairer1999notes',
        location: 'derived by researcher; snippet confirms L not conserved by explicit Euler only implicitly' }
    ],
    assumptions: [
      'constant step size h',
      'separable H = T(p)+U(q), mu = 1'
    ],
    stability: 'No step size gives bounded energy: energy grows linearly (orbit spirals outward) for ' +
      'any h>0 on Kepler (hairer1999notes snippet; blanes2008splitting snippet). Practical accuracy ' +
      'at e=0.6 needs h <= 1e-4 even for one period (pilot).',
    scenes: {
      kepler: {
        params: [
          { key: 'e', label: 'Eccentricity e', min: 0, max: 0.95, step: 0.05, value: 0.6, live: false },
          { key: 'h', label: 'Step size h', min: 0.0001, max: 0.2, step: 0.0001, value: 0.01, live: true },
          { key: 'trail', label: 'Trail length (points)', min: 100, max: TRAIL_CAP, step: 100, value: 4000, live: true }
        ],
        notes: 'q0 = (1-e, 0), p0 = (0, sqrt((1+e)/(1-e))), from hlw2006 Sec. I.2.3. The energy drift and ' +
          'outward spiral are expected for this method at any h. Changing h mid-run is allowed (each ' +
          'step is still an Euler step); restart to compare at fixed h. The view box grows to follow ' +
          'the spiral.'
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'kepler') throw new Error('explicit-euler supports only kepler');
      var e = +params.e, h = +params.h;
      var trail = Math.max(2, Math.min(TRAIL_CAP, Math.round(+params.trail || 4000)));

      // state s = [qx, qy, px, py]
      var s = new Float64Array(4);
      s[0] = 1 - e; s[1] = 0; s[2] = 0; s[3] = Math.sqrt((1 + e) / (1 - e));

      function energy() {
        return 0.5 * (s[2] * s[2] + s[3] * s[3]) - 1 / Math.sqrt(s[0] * s[0] + s[1] * s[1]);
      }
      function angmom() { return s[0] * s[3] - s[1] * s[2]; }
      var H0 = energy(), L0 = angmom();
      var maxdH = 0;

      var tx = new Float64Array(TRAIL_CAP), ty = new Float64Array(TRAIL_CAP);
      var head = 0, count = 0;
      function record() {
        tx[head] = s[0]; ty[head] = s[1];
        head = (head + 1) % TRAIL_CAP;
        if (count < TRAIL_CAP) count++;
      }
      record();

      var ext = 1 + e + 0.15;
      var tBase = 0, nBase = 0;

      var sim = {
        t: 0, steps: 0, dt: h,
        fields: ['orbit'],
        step: function () {
          var x = s[0], y = s[1], px = s[2], py = s[3];
          var r2 = x * x + y * y, inv3 = 1 / (r2 * Math.sqrt(r2));
          s[0] = x + h * px;  s[1] = y + h * py;          // q_{n+1} = q_n + h p_n
          s[2] = px - h * x * inv3; s[3] = py - h * y * inv3; // p_{n+1} = p_n + h F(q_n)
          sim.steps++;
          sim.t = tBase + (sim.steps - nBase) * h;
          record();
          var dH = Math.abs(energy() - H0);
          if (dH > maxdH) maxdH = dH;
          var r = Math.max(Math.abs(s[0]), Math.abs(s[1])) + 0.15;
          if (r > ext && isFinite(r)) ext = Math.min(r * 1.1, 1e6);
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
            extent: [-ext, -ext, ext, ext],
            series: [{ label: 'Explicit Euler', x: xs, y: ys, role: 'sim' }],
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
            { key: 'maxdH', label: 'max |H − H0|', value: maxdH, unit: '', fmt: 'e' },
            { key: 'L', label: 'angular momentum L', value: L, unit: '', fmt: 'e' },
            { key: 'dL', label: '|L − L0|/|L0|', value: L0 !== 0 ? Math.abs(L - L0) / Math.abs(L0) : Math.abs(L - L0), unit: '', fmt: 'e' },
            { key: 'r', label: 'radius |q|', value: Math.sqrt(s[0] * s[0] + s[1] * s[1]), unit: '', fmt: 'g' }
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
