/* First-order Godunov finite-volume scheme with the HLLC approximate Riemann solver for the
 * 1D Euler equations (Sod shock tube). Metadata from research/hyp.json (method id 'hllc-godunov').
 * See docs/CONTRACTS.md §4. */
(function (LAB) {
  'use strict';

  var N_MAX = 8192;

  LAB.registerMethod({
    id: 'hllc-godunov',
    name: 'Godunov finite volume with HLLC flux (first order)',
    family: 'finite-volume',
    summary: 'The tube is cut into N equal cells, and each cell stores its average mass, momentum and ' +
      'total energy. At every cell face the two neighbouring states define a small Riemann problem. ' +
      'The HLLC solver of Toro, Spruce and Speares approximates its solution with three waves: a left ' +
      'wave, a contact wave and a right wave. The flux at x/t = 0 of that three-wave fan updates both ' +
      'cells conservatively, so mass, momentum and energy change only through the two end faces. The ' +
      'states are piecewise constant and time stepping is forward Euler, so the scheme is first order. ' +
      'It is monotone and smears shocks and especially contacts over several cells. Because HLLC keeps ' +
      'the contact wave, it resolves contacts better than two-wave HLL, and it needs no entropy fix at ' +
      'sonic rarefactions. The time step follows the CFL condition from the current maximum |u|+c.',
    sources: ['toro1994hllc', 'toro2009', 'clawpack-riemann', 'einfeldt1988', 'zingale-cha', 'riemannbook2020'],
    equations: [
      { label: 'Conservative update', tex: 'U_i^{n+1}=U_i^n+\\frac{\\Delta t}{\\Delta x}\\big(F_{i-1/2}-F_{i+1/2}\\big)', source: 'zingale-cha', location: "Euler/Euler-methods.tex Sec. 'Conservative update' (verified)" },
      { label: 'Godunov flux', tex: 'F_{i-1/2}=f\\big(Q^*_{i-1/2}\\big),\\; Q^*=\\text{Riemann solution of }(Q_{i-1},Q_i)\\text{ on }x/t=0', source: 'riemannbook2020', location: "Approximate_solvers.ipynb cell 5 'Godunov's method' (verified)" },
      { label: 'Euler flux and EOS', tex: 'U=(\\rho,\\rho u,E)^T,\\; F=(\\rho u,\\rho u^2+p,u(E+p))^T,\\; p=(\\gamma-1)(E-\\tfrac12\\rho u^2)', source: 'zingale-cha', location: "Euler/Euler-methods.tex, flux vector in Sec. 'Riemann solvers' (verified)" },
      { label: 'HLLC contact speed', tex: 'S_*=\\frac{p_R-p_L+\\rho_L u_L(S_L-u_L)-\\rho_R u_R(S_R-u_R)}{\\rho_L(S_L-u_L)-\\rho_R(S_R-u_R)}', source: 'clawpack-riemann', location: 'riemann/euler_1D_py.py euler_hllc_1D docstring (verified); Toro 2009 Ch. 10 (eq. number not verified)' },
      { label: 'HLLC star states', tex: 'U_{*K}=\\rho_K\\frac{S_K-u_K}{S_K-S_*}\\begin{pmatrix}1\\\\S_*\\\\ \\frac{E_K}{\\rho_K}+(S_*-u_K)\\big(S_*+\\frac{p_K}{\\rho_K(S_K-u_K)}\\big)\\end{pmatrix},\\;K=L,R', source: 'clawpack-riemann', location: "euler_hllc_1D docstring 'left/right middle state' (verified)" },
      { label: 'HLLC flux selection', tex: 'F^{hllc}=\\begin{cases}F_L & 0\\le S_L\\\\ F_L+S_L(U_{*L}-U_L) & S_L\\le0\\le S_*\\\\ F_R+S_R(U_{*R}-U_R) & S_*\\le0\\le S_R\\\\ F_R & 0\\ge S_R\\end{cases}', source: 'toro2009', location: "Ch. 10 HLLC flux (recollection; equivalent to clawpack's wave decomposition amdq/apdq, verified by our derivation)" },
      { label: 'Wave-speed estimate (Davis, simple)', tex: 'S_L=\\min(u_L-c_L,u_R-c_R),\\quad S_R=\\max(u_L+c_L,u_R+c_R)', source: 'toro2009', location: 'Ch. 10 wave-speed estimates (recollection, NOT verified); used in researcher calibration run' },
      { label: 'Wave-speed estimate (Einfeldt / Roe-based)', tex: 'S_L=\\min(u_L-c_L,\\hat u-\\hat c),\\quad S_R=\\max(u_R+c_R,\\hat u+\\hat c)', source: 'einfeldt1988', location: "riemannbook2020 Euler_approximate.ipynb cell 26 (verified); clawpack euler_hllc_1D 'Compute Einfeldt speeds'" }
    ],
    assumptions: [
      'Ideal gas, gamma = 1.4 (gamma is a parameter)',
      'No vacuum generated: 2(c_L+c_R)/(gamma-1) > u_R - u_L',
      'First-order piecewise-constant reconstruction, forward Euler in time',
      'Transmissive boundaries: the ghost cell copies the boundary cell (zero gradient)',
      'Uniform grid on [0, 1]; a cell cut by the diaphragm x0 gets the volume-weighted average of the two states'
    ],
    stability: 'dt <= C dx / max_i(|u_i|+c_i), C <= 1 (zingale-cha "Conservative update": dt < dx/(|u|+c); ' +
      'riemannbook2020 Approximate_solvers.ipynb cell 5 CFL). Researcher calibration stable at C = 0.9.',
    scenes: {
      sod: {
        params: [
          { key: 'N', label: 'Cells N', min: 20, max: N_MAX, step: 20, value: 400, live: false },
          { key: 'CFL', label: 'CFL number C', min: 0.05, max: 1.0, step: 0.05, value: 0.9, live: true },
          { key: 'speeds', label: 'Wave speeds (0 = Davis, 1 = Einfeldt)', min: 0, max: 1, step: 1, value: 0, live: true },
          { key: 'tEnd', label: 'Land exactly on t =', min: 0.01, max: 2, step: 0.01, value: 0.2, live: true },
          { key: 'gamma', label: 'Ratio of specific heats γ', min: 1.05, max: 3, step: 0.01, value: 1.4, live: false },
          { key: 'x0', label: 'Diaphragm position x0', min: 0.05, max: 0.95, step: 0.05, value: 0.5, live: false },
          { key: 'rhoL', label: 'Left density ρ_L', min: 0.01, max: 10, step: 0.005, value: 1.0, live: false },
          { key: 'uL', label: 'Left velocity u_L', min: -2, max: 2, step: 0.05, value: 0.0, live: false },
          { key: 'pL', label: 'Left pressure p_L', min: 0.01, max: 10, step: 0.01, value: 1.0, live: false },
          { key: 'rhoR', label: 'Right density ρ_R', min: 0.01, max: 10, step: 0.005, value: 0.125, live: false },
          { key: 'uR', label: 'Right velocity u_R', min: -2, max: 2, step: 0.05, value: 0.0, live: false },
          { key: 'pR', label: 'Right pressure p_R', min: 0.01, max: 10, step: 0.01, value: 0.1, live: false }
        ],
        notes: 'Domain [0,1], N cells, transmissive ghost cells. The time step is dt = C dx / max(|u|+c), ' +
          'recomputed every step. The step that would cross tEnd is shortened so the run lands exactly on ' +
          'tEnd (default 0.2, the comparison time); later steps use the full CFL step again. Default wave ' +
          'speeds are Davis, as in the researcher calibration; 1 selects Einfeldt (Roe-averaged) speeds. ' +
          "Toro's modified Sod test uses uL = 0.75, x0 = 0.3. With N even and x0 = 0.5 the diaphragm lies on a cell face."
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'sod') throw new Error('hllc-godunov supports only sod');
      var P = params || {};
      function num(v, d) { v = +v; return isFinite(v) ? v : d; }
      var N = Math.max(4, Math.min(N_MAX, Math.round(num(P.N, 400))));
      var gamma = num(P.gamma, 1.4), gm1 = gamma - 1;
      var CFL = num(P.CFL, 0.9), speeds = Math.round(num(P.speeds, 0));
      var tEnd = num(P.tEnd, 0.2);
      var x0 = num(P.x0, 0.5);
      var WL = [num(P.rhoL, 1), num(P.uL, 0), num(P.pL, 1)];
      var WR = [num(P.rhoR, 0.125), num(P.uR, 0), num(P.pR, 0.1)];
      var dx = 1 / N;

      // conserved state with one ghost cell each side: index 0 and N+1 are ghosts
      var M = N + 2;
      var R = new Float64Array(M), MU = new Float64Array(M), E = new Float64Array(M);
      var F0 = new Float64Array(N + 1), F1 = new Float64Array(N + 1), F2 = new Float64Array(N + 1);

      function cons(W) { return [W[0], W[0] * W[1], W[2] / gm1 + 0.5 * W[0] * W[1] * W[1]]; }
      var UL = cons(WL), UR = cons(WR);
      for (var i = 1; i <= N; i++) {
        var a = (i - 1) * dx, b = i * dx;
        var fl = x0 >= b ? 1 : x0 <= a ? 0 : (x0 - a) / dx;  // fraction of the cell left of x0
        R[i] = fl * UL[0] + (1 - fl) * UR[0];
        MU[i] = fl * UL[1] + (1 - fl) * UR[1];
        E[i] = fl * UL[2] + (1 - fl) * UR[2];
      }

      function ghosts() {
        R[0] = R[1]; MU[0] = MU[1]; E[0] = E[1];
        R[N + 1] = R[N]; MU[N + 1] = MU[N]; E[N + 1] = E[N];
      }

      function maxSpeed() {
        var m = 0;
        for (var i = 1; i <= N; i++) {
          var r = R[i], u = MU[i] / r, p = gm1 * (E[i] - 0.5 * MU[i] * u);
          var s = Math.abs(u) + Math.sqrt(gamma * Math.max(p, 0) / r);
          if (s > m) m = s;
        }
        return m;
      }

      var lastSmax = 0, nonPhys = 0;

      // HLLC flux between cells l and r, written to face index f
      function hllc(l, r, f) {
        var rl = R[l], ul = MU[l] / rl, El = E[l], pl = gm1 * (El - 0.5 * rl * ul * ul);
        var rr = R[r], ur = MU[r] / rr, Er = E[r], pr = gm1 * (Er - 0.5 * rr * ur * ur);
        if (pl <= 0 || pr <= 0 || rl <= 0 || rr <= 0) nonPhys++;
        var cl = Math.sqrt(gamma * Math.max(pl, 0) / rl), cr = Math.sqrt(gamma * Math.max(pr, 0) / rr);
        var SL, SR;
        if (speeds === 1) {
          // Einfeldt: Roe averages
          var sl = Math.sqrt(rl), sr = Math.sqrt(rr), w = 1 / (sl + sr);
          var hl = (El + pl) / rl, hr = (Er + pr) / rr;
          var uh = (sl * ul + sr * ur) * w, Hh = (sl * hl + sr * hr) * w;
          var ch = Math.sqrt(Math.max(gm1 * (Hh - 0.5 * uh * uh), 0));
          SL = Math.min(ul - cl, uh - ch); SR = Math.max(ur + cr, uh + ch);
        } else {
          // Davis
          SL = Math.min(ul - cl, ur - cr); SR = Math.max(ul + cl, ur + cr);
        }
        var fL0 = rl * ul, fL1 = rl * ul * ul + pl, fL2 = ul * (El + pl);
        if (SL >= 0) { F0[f] = fL0; F1[f] = fL1; F2[f] = fL2; return; }
        var fR0 = rr * ur, fR1 = rr * ur * ur + pr, fR2 = ur * (Er + pr);
        if (SR <= 0) { F0[f] = fR0; F1[f] = fR1; F2[f] = fR2; return; }
        var dl = rl * (SL - ul), dr = rr * (SR - ur);
        var Ss = (pr - pl + ul * dl - ur * dr) / (dl - dr);
        var k;
        if (Ss >= 0) {
          k = dl / (SL - Ss);
          F0[f] = fL0 + SL * (k - rl);
          F1[f] = fL1 + SL * (k * Ss - rl * ul);
          F2[f] = fL2 + SL * (k * (El / rl + (Ss - ul) * (Ss + pl / dl)) - El);
        } else {
          k = dr / (SR - Ss);
          F0[f] = fR0 + SR * (k - rr);
          F1[f] = fR1 + SR * (k * Ss - rr * ur);
          F2[f] = fR2 + SR * (k * (Er / rr + (Ss - ur) * (Ss + pr / dr)) - Er);
        }
      }

      function computeDt() {
        lastSmax = maxSpeed();
        var dt = lastSmax > 0 ? CFL * dx / lastSmax : CFL * dx;
        if (sim.t < tEnd - 1e-14 && sim.t + dt > tEnd) dt = tEnd - sim.t;
        return dt;
      }

      // diagnostics
      function totals() {
        var m = 0, mo = 0, en = 0;
        for (var i = 1; i <= N; i++) { m += R[i]; mo += MU[i]; en += E[i]; }
        return { mass: m * dx, momentum: mo * dx, energy: en * dx };
      }
      var tot0 = totals();
      // boundary flux accounting (expected change of totals through x=0 and x=1)
      var bflux = new Float64Array(3);

      var sim = {
        t: 0, steps: 0, dt: 0,
        fields: ['primitive', 'thermo'],
        step: function () {
          var dt = computeDt();
          var lam = dt / dx;
          ghosts();
          nonPhys = 0;
          for (var f = 0; f <= N; f++) hllc(f, f + 1, f);  // face f between cells f and f+1
          for (var i = 1; i <= N; i++) {
            R[i] += lam * (F0[i - 1] - F0[i]);
            MU[i] += lam * (F1[i - 1] - F1[i]);
            E[i] += lam * (F2[i - 1] - F2[i]);
          }
          bflux[0] += dt * (F0[0] - F0[N]); bflux[1] += dt * (F1[0] - F1[N]); bflux[2] += dt * (F2[0] - F2[N]);
          sim.steps++;
          // snap to tEnd when the step was clipped onto it (avoid round-off overshoot)
          var tn = sim.t + dt;
          if (Math.abs(tn - tEnd) < 1e-13 * Math.max(1, tEnd)) tn = tEnd;
          sim.t = tn;
          sim.dt = dt;
        },
        setParam: function (key, value) {
          var v = +value;
          if (!isFinite(v)) return;
          if (key === 'CFL') CFL = v;
          else if (key === 'speeds') speeds = Math.round(v);
          else if (key === 'tEnd') tEnd = v;
        },
        view: function (field) {
          var pr = sim.probe('profile');
          var name = speeds === 1 ? 'HLLC (Einfeldt)' : 'HLLC (Davis)';
          function ser(y) { return [{ label: name + ', N=' + N, x: pr.x, y: y, role: 'sim' }]; }
          if (field === 'thermo') {
            var mach = new Array(N), ent = new Array(N);
            for (var i = 0; i < N; i++) {
              var c = Math.sqrt(gamma * Math.max(pr.p[i], 0) / pr.rho[i]);
              mach[i] = pr.u[i] / c;
              ent[i] = Math.log(Math.max(pr.p[i], 1e-300) / Math.pow(pr.rho[i], gamma));
            }
            return {
              kind: 'profiles', xlabel: 'x',
              panels: [
                { key: 'e', ylabel: 'specific internal energy e', series: ser(pr.e) },
                { key: 'mach', ylabel: 'Mach number u/c', series: ser(mach) },
                { key: 'entropy', ylabel: 'ln(p/ρ^γ)', series: ser(ent) }
              ]
            };
          }
          return {
            kind: 'profiles', xlabel: 'x',
            panels: [
              { key: 'rho', ylabel: 'density ρ', series: ser(pr.rho) },
              { key: 'u', ylabel: 'velocity u', series: ser(pr.u) },
              { key: 'p', ylabel: 'pressure p', series: ser(pr.p) }
            ]
          };
        },
        metrics: function () {
          var T = totals();
          var smax = maxSpeed(), machMax = 0, pmin = Infinity, rmin = Infinity;
          for (var i = 1; i <= N; i++) {
            var r = R[i], u = MU[i] / r, p = gm1 * (E[i] - 0.5 * MU[i] * u);
            var c = Math.sqrt(gamma * Math.max(p, 0) / r), m = Math.abs(u) / c;
            if (m > machMax) machMax = m;
            if (p < pmin) pmin = p;
            if (r < rmin) rmin = r;
          }
          function rel(a, b) { return Math.abs(a - b) / Math.max(Math.abs(b), 1e-300); }
          // drift relative to initial total plus the accumulated boundary fluxes
          return [
            { key: 't', label: 'time t', value: sim.t, unit: '', fmt: 'g' },
            { key: 'steps', label: 'steps', value: sim.steps, unit: '', fmt: 'i' },
            { key: 'dt', label: 'last dt', value: sim.dt, unit: '', fmt: 'e' },
            { key: 'cfl', label: 'CFL (last step)', value: sim.dt * lastSmax / dx, unit: '', fmt: 'g' },
            { key: 'mass', label: 'mass ∫ρ dx', value: T.mass, unit: '', fmt: 'g' },
            { key: 'momentum', label: 'momentum ∫ρu dx', value: T.momentum, unit: '', fmt: 'g' },
            { key: 'energy', label: 'energy ∫E dx', value: T.energy, unit: '', fmt: 'g' },
            { key: 'dmass', label: 'mass drift (net of boundary flux)', value: rel(T.mass, tot0.mass + bflux[0]), unit: '', fmt: 'e' },
            { key: 'denergy', label: 'energy drift (net of boundary flux)', value: rel(T.energy, tot0.energy + bflux[2]), unit: '', fmt: 'e' },
            { key: 'smax', label: 'max |u|+c', value: smax, unit: '', fmt: 'g' },
            { key: 'mach', label: 'max Mach', value: machMax, unit: '', fmt: 'g' },
            { key: 'rhomin', label: 'min ρ', value: rmin, unit: '', fmt: 'g' },
            { key: 'pmin', label: 'min p', value: pmin, unit: '', fmt: 'g' }
          ];
        },
        probe: function (name) {
          if (name === 'profile') {
            var x = new Array(N), rho = new Array(N), u = new Array(N), p = new Array(N), e = new Array(N);
            for (var i = 0; i < N; i++) {
              var r = R[i + 1], v = MU[i + 1] / r, pp = gm1 * (E[i + 1] - 0.5 * MU[i + 1] * v);
              x[i] = (i + 0.5) * dx; rho[i] = r; u[i] = v; p[i] = pp; e[i] = pp / (gm1 * r);
            }
            return { x: x, rho: rho, u: u, p: p, e: e };
          }
          if (name === 'totals') return totals();
          if (name === 'time') return sim.t;
          return null;
        },
        diverged: function () {
          if (!LAB.util.finiteAll(R) || !LAB.util.finiteAll(MU) || !LAB.util.finiteAll(E)) return true;
          for (var i = 1; i <= N; i++) {
            if (R[i] <= 0) return true;
            if (E[i] - 0.5 * MU[i] * MU[i] / R[i] <= 0) return true;
          }
          return false;
        }
      };
      ghosts();
      sim.dt = computeDt();
      return sim;
    }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
