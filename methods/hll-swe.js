/* First-order finite-volume scheme with the HLL (HLLE) approximate Riemann solver for the 1D
 * shallow-water equations on a flat, frictionless bed (dam break, wet or dry downstream bed).
 * Metadata from research/hyp.json (method id 'hll-swe'). See docs/CONTRACTS.md §4. */
(function (LAB) {
  'use strict';

  var N_MAX = 16384;

  LAB.registerMethod({
    id: 'hll-swe',
    name: 'HLL finite volume for 1D shallow water (Einfeldt speeds, wet/dry)',
    family: 'finite-volume',
    summary: 'The channel is cut into N equal cells, and each cell stores its average water depth h and ' +
      'discharge hu. At every cell face the two neighbouring states form a small dam-break (Riemann) ' +
      'problem. The HLL solver of Harten, Lax and van Leer replaces its exact fan by two waves with ' +
      'speeds s1 and s2 and one constant middle state, and returns the flux of that middle state at the ' +
      'face. The wave speeds follow Einfeldt: they are bounded by the cell speeds u ∓ sqrt(gh) and by the ' +
      'Roe-averaged speeds. When one side is dry, the wet-side speed u ± 2 sqrt(gh) of the dry front is ' +
      'used instead (from the Riemann invariant). Cells are updated conservatively with forward Euler, so ' +
      'mass changes only through the two transmissive end faces. The scheme is first order and smears the ' +
      'bore and rarefaction edges over several cells. With these speeds (HLLE) the depth stays non-negative ' +
      'under the CFL condition, so the dry-bed (Ritter) case runs without special fixes. Depths below a ' +
      'small threshold are treated as dry (velocity set to zero).',
    sources: ['hll1983', 'einfeldt1988', 'clawpack-riemann', 'riemannbook2020', 'swashes2013'],
    equations: [
      { label: 'Shallow-water equations', tex: 'h_t+(hu)_x=0,\\qquad (hu)_t+\\big(hu^2+\\tfrac12 g h^2\\big)_x=0', source: 'riemannbook2020', location: 'Shallow_water.ipynb (standard form; flux also in clawpack shallow_hll_1D q_hat[1]) (verified)' },
      { label: 'HLL middle state', tex: 'q_m=\\frac{f(q_r)-f(q_\\ell)-s_2q_r+s_1q_\\ell}{s_1-s_2}', source: 'riemannbook2020', location: 'Shallow_water_approximate.ipynb cell 35 eq. SWA:hll_middle_state (verified); clawpack shallow_hll_1D' },
      { label: 'HLL flux', tex: 'F^{hll}=\\frac{s_2F_\\ell-s_1F_r+s_1s_2(q_r-q_\\ell)}{s_2-s_1}\\;(s_1<0<s_2);\\;F_\\ell\\text{ if }s_1\\ge0;\\;F_r\\text{ if }s_2\\le0', source: 'hll1983', location: 'derived from the q_m above via F = f(q_l) + s_1 (q_m - q_l) (our derivation; original not read)' },
      { label: 'Einfeldt speeds with Roe averages', tex: '\\hat u=\\frac{\\sqrt{h_\\ell}u_\\ell+\\sqrt{h_r}u_r}{\\sqrt{h_\\ell}+\\sqrt{h_r}},\\;\\hat c=\\sqrt{\\tfrac{g}{2}(h_\\ell+h_r)},\\;s_1=\\min(u_\\ell-c_\\ell,\\hat u-\\hat c),\\;s_2=\\max(u_r+c_r,\\hat u+\\hat c)', source: 'clawpack-riemann', location: 'riemann/shallow_1D_py.py shallow_hll_1D lines ~127-142; riemannbook2020 Shallow_water_approximate.ipynb cell 35 (verified)' },
      { label: 'Dry-front speeds', tex: 'h_\\ell=0:\\;s_1=u_r-2c_r;\\qquad h_r=0:\\;s_2=u_\\ell+2c_\\ell', source: 'riemannbook2020', location: 'follows from the Riemann invariant u + 2c (exact_solvers/shallow_water.py dry_velocity_l = u_l + 2 sqrt(g h_l)) (verified); Toro 2001 free-surface book not read' },
      { label: 'Conservative update', tex: 'Q_i^{n+1}=Q_i^n+\\frac{\\Delta t}{\\Delta x}\\big(F_{i-1/2}-F_{i+1/2}\\big)', source: 'riemannbook2020', location: "Approximate_solvers.ipynb cell 5 'Godunov's method' (verified)" }
    ],
    assumptions: [
      'Flat, frictionless bed',
      'Hydrostatic pressure (shallow water)',
      'g = 9.81 m/s^2 (g is a parameter)',
      'h >= 0; positivity of HLLE for first order (riemannbook2020 cell 52)',
      'First-order piecewise-constant states, forward Euler in time',
      'Transmissive boundaries: ghost cells copy the boundary cell (zero gradient)',
      'Cells with h <= hDry are treated as dry: u = 0 there, and dry-front speeds are used at wet/dry faces',
      'Uniform grid on [0, L]; a cell cut by the dam x0 gets the volume-weighted average depth'
    ],
    stability: 'dt <= C dx / max(|u|+sqrt(g h)), C <= 1; calibration at C = 0.9. HLLE preserves positivity ' +
      '(riemannbook2020 Shallow_water_approximate.ipynb cell 52). Implementation: the max is also taken over the ' +
      'face speeds |s1|, |s2| (including dry-front speeds u ± 2 sqrt(g h)), which is at least as restrictive.',
    scenes: {
      'swe-dambreak': {
        params: [
          { key: 'hl', label: 'Upstream depth h_l [m]', min: 0.001, max: 10, step: 0.001, value: 0.005, live: false },
          { key: 'hr', label: 'Downstream depth h_r [m] (0 = dry)', min: 0, max: 10, step: 0.001, value: 0.001, live: false },
          { key: 'x0', label: 'Dam position x0 [m]', min: 0, max: 100, step: 0.1, value: 5, live: false },
          { key: 'L', label: 'Channel length L [m]', min: 0.1, max: 200, step: 0.1, value: 10, live: false },
          { key: 'g', label: 'Gravity g [m/s²]', min: 0.1, max: 30, step: 0.01, value: 9.81, live: false },
          { key: 'N', label: 'Cells N', min: 20, max: N_MAX, step: 20, value: 400, live: false },
          { key: 'CFL', label: 'CFL number C', min: 0.05, max: 1.0, step: 0.05, value: 0.9, live: true },
          { key: 'tEnd', label: 'Land exactly on t = [s]', min: 0.01, max: 100, step: 0.01, value: 6, live: true },
          { key: 'hDry', label: 'Dry threshold h_dry [m]', min: 0, max: 1e-4, step: 1e-12, value: 1e-12, live: true }
        ],
        notes: 'Domain [0, L], N cells, transmissive ghost cells. Defaults are the SWASHES wet-bed (Stoker) set-up ' +
          'hl = 0.005, hr = 0.001, x0 = 5, L = 10; set hr = 0 for the dry-bed (Ritter) case. dt = C dx / s_max ' +
          'is recomputed every step from the larger of max(|u|+sqrt(gh)) over cells and max(|s1|,|s2|) over faces. ' +
          'The step that would cross tEnd (default 6 s, the comparison time) is shortened so the run lands ' +
          'exactly on tEnd; later steps use the full CFL step. Velocity is reported as 0 in cells with h <= hDry.'
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'swe-dambreak') throw new Error('hll-swe supports only swe-dambreak');
      var P = params || {};
      function num(v, d) { v = +v; return isFinite(v) ? v : d; }
      var N = Math.max(4, Math.min(N_MAX, Math.round(num(P.N, 400))));
      var hl = Math.max(0, num(P.hl, 0.005)), hr = Math.max(0, num(P.hr, 0.001));
      var x0 = num(P.x0, 5), L = num(P.L, 10), g = num(P.g, 9.81);
      if (!(L > 0)) L = 10;
      if (!(g > 0)) g = 9.81;
      var CFL = num(P.CFL, 0.9), tEnd = num(P.tEnd, 6), hDry = Math.max(0, num(P.hDry, 1e-12));
      var dx = L / N;

      // conserved state with one ghost cell each side: index 0 and N+1 are ghosts
      var M = N + 2;
      var H = new Float64Array(M), HU = new Float64Array(M);
      var F0 = new Float64Array(N + 1), F1 = new Float64Array(N + 1);
      var S1 = new Float64Array(N + 1), S2 = new Float64Array(N + 1);

      for (var i = 1; i <= N; i++) {
        var a = (i - 1) * dx, b = i * dx;
        var fl = x0 >= b ? 1 : x0 <= a ? 0 : (x0 - a) / dx;  // fraction of the cell left of x0
        H[i] = fl * hl + (1 - fl) * hr;
        HU[i] = 0;
      }

      function ghosts() {
        H[0] = H[1]; HU[0] = HU[1];
        H[N + 1] = H[N]; HU[N + 1] = HU[N];
      }
      function vel(k) { return H[k] > hDry ? HU[k] / H[k] : 0; }

      // Einfeldt (HLLE) speeds at face f between cells f and f+1, with dry-bed treatment
      function speeds() {
        var m = 0;
        for (var f = 0; f <= N; f++) {
          var l = f, r = f + 1;
          var h1 = H[l], h2 = H[r];
          var wl = h1 > hDry, wr = h2 > hDry;
          var s1, s2;
          if (!wl && !wr) { s1 = 0; s2 = 0; }
          else if (!wl) {
            var ur = HU[r] / h2, cr = Math.sqrt(g * h2);
            s1 = ur - 2 * cr; s2 = ur + cr;
          } else if (!wr) {
            var ul = HU[l] / h1, cl = Math.sqrt(g * h1);
            s1 = ul - cl; s2 = ul + 2 * cl;
          } else {
            var u1 = HU[l] / h1, u2 = HU[r] / h2;
            var c1 = Math.sqrt(g * h1), c2 = Math.sqrt(g * h2);
            var q1 = Math.sqrt(h1), q2 = Math.sqrt(h2);
            var uh = (q1 * u1 + q2 * u2) / (q1 + q2), ch = Math.sqrt(0.5 * g * (h1 + h2));
            s1 = Math.min(u1 - c1, uh - ch); s2 = Math.max(u2 + c2, uh + ch);
          }
          S1[f] = s1; S2[f] = s2;
          var as = Math.max(Math.abs(s1), Math.abs(s2));
          if (as > m) m = as;
        }
        return m;
      }

      function cellMaxSpeed() {
        var m = 0;
        for (var i = 1; i <= N; i++) {
          if (H[i] <= hDry) continue;
          var s = Math.abs(HU[i] / H[i]) + Math.sqrt(g * H[i]);
          if (s > m) m = s;
        }
        return m;
      }

      // HLL flux at face f (speeds already in S1/S2)
      function hll(f) {
        var l = f, r = f + 1;
        var h1 = H[l], h2 = H[r];
        var u1 = h1 > hDry ? HU[l] / h1 : 0, u2 = h2 > hDry ? HU[r] / h2 : 0;
        var q1 = h1 > hDry ? HU[l] : 0, q2 = h2 > hDry ? HU[r] : 0;
        var fl0 = q1, fl1 = q1 * u1 + 0.5 * g * h1 * h1;
        var fr0 = q2, fr1 = q2 * u2 + 0.5 * g * h2 * h2;
        var s1 = S1[f], s2 = S2[f];
        if (s1 >= 0) { F0[f] = fl0; F1[f] = fl1; return; }
        if (s2 <= 0) { F0[f] = fr0; F1[f] = fr1; return; }
        var inv = 1 / (s2 - s1), p = s1 * s2;
        F0[f] = (s2 * fl0 - s1 * fr0 + p * (h2 - h1)) * inv;
        F1[f] = (s2 * fl1 - s1 * fr1 + p * (q2 - q1)) * inv;
      }

      var lastSmax = 0, negClips = 0;

      function computeDt() {
        ghosts();
        var sf = speeds(), sc = cellMaxSpeed();
        lastSmax = Math.max(sf, sc);
        var dt = lastSmax > 0 ? CFL * dx / lastSmax : CFL * dx;
        if (sim.t < tEnd - 1e-14 && sim.t + dt > tEnd) dt = tEnd - sim.t;
        return dt;
      }

      function totals() {
        var m = 0, mo = 0;
        for (var i = 1; i <= N; i++) { m += H[i]; mo += HU[i]; }
        return { mass: m * dx, momentum: mo * dx };
      }
      function energy() {
        var e = 0;
        for (var i = 1; i <= N; i++) {
          var h = H[i], u = h > hDry ? HU[i] / h : 0;
          e += 0.5 * h * u * u + 0.5 * g * h * h;
        }
        return e * dx;
      }
      var tot0 = totals(), E0 = energy();
      var bflux = new Float64Array(2);

      var sim = {
        t: 0, steps: 0, dt: 0,
        fields: ['depth-velocity', 'froude-discharge'],
        step: function () {
          var dt = computeDt();          // also fills ghosts and face speeds
          var lam = dt / dx;
          for (var f = 0; f <= N; f++) hll(f);
          for (var i = 1; i <= N; i++) {
            var hn = H[i] + lam * (F0[i - 1] - F0[i]);
            var qn = HU[i] + lam * (F1[i - 1] - F1[i]);
            if (hn < 0) { negClips++; hn = 0; qn = 0; } // round-off guard (counted)
            if (hn <= hDry) qn = 0;
            H[i] = hn; HU[i] = qn;
          }
          bflux[0] += dt * (F0[0] - F0[N]); bflux[1] += dt * (F1[0] - F1[N]);
          sim.steps++;
          var tn = sim.t + dt;
          if (Math.abs(tn - tEnd) < 1e-13 * Math.max(1, tEnd)) tn = tEnd;
          sim.t = tn;
          sim.dt = dt;
        },
        setParam: function (key, value) {
          var v = +value;
          if (!isFinite(v)) return;
          if (key === 'CFL') CFL = v;
          else if (key === 'tEnd') tEnd = v;
          else if (key === 'hDry') hDry = Math.max(0, v);
        },
        view: function (field) {
          var pr = sim.probe('profile');
          var name = 'HLL (Einfeldt), N=' + N;
          function ser(y) { return [{ label: name, x: pr.x, y: y, role: 'sim' }]; }
          if (field === 'froude-discharge') {
            var fr = new Array(N), q = new Array(N);
            for (var i = 0; i < N; i++) {
              var h = pr.h[i];
              fr[i] = h > hDry ? pr.u[i] / Math.sqrt(g * h) : 0;
              q[i] = HU[i + 1];
            }
            return {
              kind: 'profiles', xlabel: 'x [m]',
              panels: [
                { key: 'q', ylabel: 'discharge hu [m²/s]', series: ser(q) },
                { key: 'froude', ylabel: 'Froude number u/√(gh)', series: ser(fr) }
              ]
            };
          }
          return {
            kind: 'profiles', xlabel: 'x [m]',
            panels: [
              { key: 'h', ylabel: 'depth h [m]', series: ser(pr.h) },
              { key: 'u', ylabel: 'velocity u [m/s]', series: ser(pr.u) }
            ]
          };
        },
        metrics: function () {
          var T = totals(), E = energy();
          var umax = 0, frmax = 0, hmin = Infinity, wet = 0;
          for (var i = 1; i <= N; i++) {
            var h = H[i];
            if (h < hmin) hmin = h;
            if (h <= hDry) continue;
            wet++;
            var u = Math.abs(HU[i] / h);
            if (u > umax) umax = u;
            var fr = u / Math.sqrt(g * h);
            if (fr > frmax) frmax = fr;
          }
          function rel(a, b) { return Math.abs(a - b) / Math.max(Math.abs(b), 1e-300); }
          return [
            { key: 't', label: 'time t', value: sim.t, unit: 's', fmt: 'g' },
            { key: 'steps', label: 'steps', value: sim.steps, unit: '', fmt: 'i' },
            { key: 'dt', label: 'last dt', value: sim.dt, unit: 's', fmt: 'e' },
            { key: 'cfl', label: 'CFL (last step)', value: lastSmax > 0 ? sim.dt * lastSmax / dx : 0, unit: '', fmt: 'g' },
            { key: 'mass', label: 'mass ∫h dx', value: T.mass, unit: 'm²', fmt: 'g' },
            { key: 'momentum', label: 'momentum ∫hu dx', value: T.momentum, unit: 'm³/s', fmt: 'g' },
            { key: 'dmass', label: 'mass drift (net of boundary flux)', value: rel(T.mass, tot0.mass + bflux[0]), unit: '', fmt: 'e' },
            { key: 'energy', label: 'energy ∫(½hu²+½gh²) dx', value: E, unit: 'm⁴/s²', fmt: 'g' },
            { key: 'denergy', label: 'energy change E/E0 − 1 (dissipated at bore)', value: E / E0 - 1, unit: '', fmt: 'e' },
            { key: 'umax', label: 'max |u|', value: umax, unit: 'm/s', fmt: 'g' },
            { key: 'froude', label: 'max Froude', value: frmax, unit: '', fmt: 'g' },
            { key: 'smax', label: 'max wave speed', value: lastSmax, unit: 'm/s', fmt: 'g' },
            { key: 'hmin', label: 'min h', value: hmin, unit: 'm', fmt: 'e' },
            { key: 'wet', label: 'wet cells', value: wet, unit: '', fmt: 'i' },
            { key: 'clips', label: 'negative-depth clips', value: negClips, unit: '', fmt: 'i' }
          ];
        },
        probe: function (name) {
          if (name === 'profile') {
            var x = new Array(N), h = new Array(N), u = new Array(N);
            for (var i = 0; i < N; i++) {
              x[i] = (i + 0.5) * dx; h[i] = H[i + 1]; u[i] = vel(i + 1);
            }
            return { x: x, h: h, u: u };
          }
          if (name === 'totals') return totals();
          if (name === 'time') return sim.t;
          return null;
        },
        diverged: function () {
          if (!LAB.util.finiteAll(H) || !LAB.util.finiteAll(HU)) return true;
          for (var i = 1; i <= N; i++) if (H[i] < 0) return true;
          return false;
        }
      };
      sim.dt = computeDt();
      return sim;
    }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
