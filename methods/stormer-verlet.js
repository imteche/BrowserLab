/* Störmer–Verlet (velocity Verlet / leapfrog) integrator for the Kepler scene.
 * Metadata from research/ode.json (method id 'stormer-verlet'). See docs/CONTRACTS.md §4. */
(function (LAB) {
  'use strict';

  var TRAIL_CAP = 20000;

  LAB.registerMethod({
    id: 'stormer-verlet',
    name: 'Störmer–Verlet (velocity Verlet / leapfrog)',
    family: 'integrator',
    summary: 'A half kick of the momentum with the force at the old position, a full drift of the ' +
      'position with that half-step momentum, then a second half kick with the force at the new ' +
      'position. It is explicit, second order, symplectic and time-reversible, and it costs one force ' +
      'evaluation per step. It is the composition of the two symplectic Euler variants with step h/2. ' +
      'Energy is not conserved exactly: the error stays O(h²) and does not drift over very long times. ' +
      'Angular momentum is conserved up to round-off, and the global error grows linearly in time.',
    sources: ['hlw2003', 'hairer2010week2', 'hlw2006'],
    equations: [
      { label: 'Kepler Hamiltonian',
        tex: 'H(p,q)=\\tfrac12|p|^2-\\frac{1}{|q|},\\quad \\dot q = p,\\ \\dot p = -\\frac{q}{|q|^3}',
        source: 'hlw2006', location: 'Sec. I.2.3 (secondary copy)' },
      { label: 'velocity Verlet (one-step form)',
        tex: 'p_{n+1/2}=p_n-\\tfrac h2\\nabla U(q_n),\\ q_{n+1}=q_n+h\\,p_{n+1/2},\\ p_{n+1}=p_{n+1/2}-\\tfrac h2\\nabla U(q_{n+1})',
        source: 'hlw2003', location: 'Sec. 1 (Newton–Störmer–Verlet–leapfrog method, p.400); exact equation number not verified' },
      { label: 'two-step (Störmer) form',
        tex: 'q_{n+1}-2q_n+q_{n-1}=-h^2\\nabla U(q_n)',
        source: 'hlw2003', location: 'Sec. 1 (Newton–Störmer–Verlet–leapfrog method, p.400); exact equation number not verified' },
      { label: 'composition',
        tex: '\\Phi^{SV}_h=\\Phi^{SE*}_{h/2}\\circ\\Phi^{SE}_{h/2}',
        source: 'hairer2010week2', location: 'Lecture 2 (snippet: composition of the two symplectic Euler methods with step h/2)' }
    ],
    assumptions: [
      'constant step size h (the long-time energy behaviour is lost if h changes during a run)',
      'separable H = T(p) + U(q), mu = 1, U(q) = -1/|q|'
    ],
    stability: 'Energy error O(h^2) bounded over exponentially long times (hlw2003 Sec. 4-5, snippet); ' +
      'linear global error growth (hlw2003 abstract). For Kepler h must resolve pericentre passage; ' +
      'the researcher pilot shows clean asymptotics at h=1e-2, e=0.6.',
    scenes: {
      kepler: {
        params: [
          { key: 'e', label: 'Eccentricity e', min: 0, max: 0.95, step: 0.05, value: 0.6, live: false },
          { key: 'h', label: 'Step size h', min: 0.0001, max: 0.2, step: 0.0001, value: 0.01, live: true },
          { key: 'trail', label: 'Trail length (points)', min: 100, max: TRAIL_CAP, step: 100, value: 4000, live: true }
        ],
        notes: 'q0 = (1-e, 0), p0 = (0, sqrt((1+e)/(1-e))), from hlw2006 Sec. I.2.3. Changing h while the ' +
          'run is going is allowed. Each step is still a symplectic Verlet step, but the run is then a ' +
          'variable-step method and loses the bounded-energy guarantee. Restart to compare at fixed h.'
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'kepler') throw new Error('stormer-verlet supports only kepler');
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
          var hh = 0.5 * h;
          s[2] += hh * f[0]; s[3] += hh * f[1];   // half kick
          s[0] += h * s[2];  s[1] += h * s[3];    // drift
          force();
          s[2] += hh * f[0]; s[3] += hh * f[1];   // half kick
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
            series: [{ label: 'Störmer–Verlet', x: xs, y: ys, role: 'sim' }],
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
