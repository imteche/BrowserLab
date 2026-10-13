/* Classical 4th-order Runge–Kutta (Kutta 1901) for the Kepler scene.
 * Metadata from research/ode.json (method id 'rk4'). See docs/CONTRACTS.md §4. */
(function (LAB) {
  'use strict';

  var TRAIL_CAP = 20000;

  LAB.registerMethod({
    id: 'rk4',
    name: 'Classical Runge–Kutta (RK4)',
    family: 'integrator',
    summary: 'The classical four-stage Runge–Kutta method applied to the first-order system ' +
      'y = (q, p), f(y) = (p, -q/|q|^3). Each step evaluates the vector field four times (at the start, ' +
      'twice at the midpoint and once at the end) and combines the slopes with weights 1/6, 2/6, 2/6, 1/6. ' +
      'It is explicit and fourth order, so the local error is very small, but it is neither symplectic ' +
      'nor time-reversible. On Kepler the energy and angular momentum therefore drift: the energy error ' +
      'grows like O(h^4 t) and the global error grows quadratically in time, in contrast to the bounded ' +
      'energy error and linear error growth of symplectic methods.',
    sources: ['kutta1901', 'hairer1997varsymp', 'hlw2006'],
    equations: [
      { label: 'Kepler Hamiltonian',
        tex: 'H(p,q)=\\tfrac12|p|^2-\\frac{1}{|q|},\\quad \\dot q = p,\\ \\dot p = -\\frac{q}{|q|^3}',
        source: 'hlw2006', location: 'Sec. I.2.3 (secondary copy)' },
      { label: 'RK4 stages',
        tex: 'k_1=f(y_n),\\ k_2=f(y_n+\\tfrac h2k_1),\\ k_3=f(y_n+\\tfrac h2k_2),\\ k_4=f(y_n+hk_3),\\ y_{n+1}=y_n+\\tfrac h6(k_1+2k_2+2k_3+k_4)',
        source: 'kutta1901', location: 'classical tableau (secondary/standard; original not consulted)' }
    ],
    assumptions: [
      'y=(q,p), f(y)=(p,-q/|q|^3)',
      'constant step size'
    ],
    stability: 'Linear stability interval on imaginary axis |h lambda| <= 2.83 (standard, not sourced here). ' +
      'Energy drifts O(h^4 t); global error grows quadratically (hairer1997varsymp snippet, by contrast with ' +
      'symplectic). Pre-asymptotic at h >= 2.5e-3 for e=0.6 (pilot).',
    scenes: {
      kepler: {
        params: [
          { key: 'e', label: 'Eccentricity e', min: 0, max: 0.95, step: 0.05, value: 0.6, live: false },
          { key: 'h', label: 'Step size h', min: 0.0001, max: 0.2, step: 0.0001, value: 0.01, live: true },
          { key: 'trail', label: 'Trail length (points)', min: 100, max: TRAIL_CAP, step: 100, value: 4000, live: true }
        ],
        notes: 'q0 = (1-e, 0), p0 = (0, sqrt((1+e)/(1-e))), from hlw2006 Sec. I.2.3. RK4 is a one-step ' +
          'method, so changing h mid-run is legitimate; the run is then variable-step. Restart to compare ' +
          'at fixed h. Four force evaluations per step.'
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'kepler') throw new Error('rk4 supports only kepler');
      var e = +params.e, h = +params.h;
      var trail = Math.max(2, Math.min(TRAIL_CAP, Math.round(+params.trail || 4000)));

      // state s = [qx, qy, px, py]
      var s = new Float64Array(4);
      s[0] = 1 - e; s[1] = 0; s[2] = 0; s[3] = Math.sqrt((1 + e) / (1 - e));
      var k1 = new Float64Array(4), k2 = new Float64Array(4), k3 = new Float64Array(4), k4 = new Float64Array(4);
      var y = new Float64Array(4);

      // f(y) = (p, -q/|q|^3)
      function f(src, out) {
        var x = src[0], yy = src[1], r2 = x * x + yy * yy, inv3 = 1 / (r2 * Math.sqrt(r2));
        out[0] = src[2]; out[1] = src[3];
        out[2] = -x * inv3; out[3] = -yy * inv3;
      }

      function energy() {
        return 0.5 * (s[2] * s[2] + s[3] * s[3]) - 1 / Math.sqrt(s[0] * s[0] + s[1] * s[1]);
      }
      function angmom() { return s[0] * s[3] - s[1] * s[2]; }
      var H0 = energy(), L0 = angmom();

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
      var i;

      var sim = {
        t: 0, steps: 0, dt: h,
        fields: ['orbit'],
        step: function () {
          var hh = 0.5 * h;
          f(s, k1);
          for (i = 0; i < 4; i++) y[i] = s[i] + hh * k1[i];
          f(y, k2);
          for (i = 0; i < 4; i++) y[i] = s[i] + hh * k2[i];
          f(y, k3);
          for (i = 0; i < 4; i++) y[i] = s[i] + h * k3[i];
          f(y, k4);
          var h6 = h / 6;
          for (i = 0; i < 4; i++) s[i] += h6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
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
          for (var j = 0; j < n; j++) {
            var k = (start + j) % TRAIL_CAP;
            xs[j] = tx[k]; ys[j] = ty[k];
          }
          return {
            kind: 'orbit',
            extent: [-ext, -ext, ext, ext],
            series: [{ label: 'RK4', x: xs, y: ys, role: 'sim' }],
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
