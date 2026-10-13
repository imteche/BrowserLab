/* Classic (global) Lax–Friedrichs scheme for the 1D Euler equations, scene `sod`.
 * Metadata from research/hyp.json (method id 'lax-friedrichs'). See docs/CONTRACTS.md §4.
 *
 * Implementation notes
 * - Conservative variables U = (rho, rho u, E) on N uniform cells over [0, 1], Float64Array.
 * - Update written in flux form with the global LF flux
 *     F_{i+1/2} = 1/2 (F_i + F_{i+1}) - dx/(2 dt) (U_{i+1} - U_i),
 *   which is algebraically identical to the classic update
 *     U_i^{n+1} = 1/2 (U_{i-1} + U_{i+1}) - dt/(2 dx) (F_{i+1} - F_{i-1}),
 *   but makes the interior telescoping (conservation to round-off) explicit.
 * - Transmissive boundaries: one zero-gradient ghost cell per side, so the boundary
 *   flux is F(U_0) on the left and F(U_{N-1}) on the right.
 * - dt = CFL * dx / max_i(|u_i| + c_i), recomputed every step. A step that would cross
 *   tEnd is shortened so the run lands exactly on t = tEnd; after that the scheme keeps
 *   going with the normal CFL step (waves leave through the transmissive boundaries).
 */
(function (LAB) {
  'use strict';

  var NMAX = 20000;

  LAB.registerMethod({
    id: 'lax-friedrichs',
    name: 'Lax–Friedrichs (first order, global wave speed)',
    family: 'finite-volume',
    summary: 'The classic Lax–Friedrichs scheme replaces each cell value by the average of its two ' +
      'neighbours and then adds the centred flux difference. It can also be read as a finite-volume ' +
      'method whose interface flux is the mean of the two cell fluxes plus a numerical diffusion term ' +
      'with the largest speed the grid allows, dx/dt. The scheme is explicit, conservative, monotone and ' +
      'first order. It is very diffusive: shocks and the contact are smeared over many cells, and ' +
      'constant states show a slight odd–even pattern because neighbouring cells do not talk to each other ' +
      'directly. It is the simplest stable scheme for a nonlinear system of conservation laws and ' +
      'serves as the baseline that Godunov and MUSCL methods improve on.',
    sources: ['lax1954', 'riemannbook2020', 'zingale-cha'],
    equations: [
      { label: 'Conservation law',
        tex: 'U_t + F(U)_x = 0,\\quad U=(\\rho,\\rho u,E)^T,\\; F=(\\rho u,\\rho u^2+p,u(E+p))^T,\\; p=(\\gamma-1)(E-\\tfrac12\\rho u^2)',
        source: 'zingale-cha',
        location: 'Euler/Euler-methods.tex, flux vector in Sec. \'Riemann solvers\' (verified)' },
      { label: 'LF as two-wave approximate Riemann solver',
        tex: '-s_1=s_2=a,\\qquad q_m=-\\frac{f(q_r)-f(q_\\ell)}{2a}+\\frac{q_r+q_\\ell}{2}',
        source: 'riemannbook2020',
        location: 'Approximate_solvers.ipynb, cell 13 \'Lax-Friedrichs (LF) and local-Lax-Friedrichs (LLF)\' (verified)' },
      { label: 'LF numerical flux (global LF: a = dx/dt)',
        tex: 'F_{i+1/2}=\\tfrac12\\big(F(U_i)+F(U_{i+1})\\big)-\\tfrac{a}{2}\\,(U_{i+1}-U_i),\\qquad a=\\Delta x/\\Delta t',
        source: 'lax1954',
        location: 'derived by us from the riemannbook2020 two-wave form (flux = f(q_l) + s_1 (q_m - q_l)); a = dx/dt identification is our derivation, not seen in a source' },
      { label: 'Classic LF update',
        tex: 'U_i^{n+1}=\\tfrac12\\big(U_{i-1}^n+U_{i+1}^n\\big)-\\frac{\\Delta t}{2\\Delta x}\\big(F(U_{i+1}^n)-F(U_{i-1}^n)\\big)',
        source: 'lax1954',
        location: 'standard form; original not read (verified: false); equivalent to the flux above with a = dx/dt' },
      { label: 'Local LF / Rusanov speed',
        tex: 'a_{i+1/2}=\\max\\big(|u_i|+c_i,\\;|u_{i+1}|+c_{i+1}\\big)',
        source: 'riemannbook2020',
        location: 'Approximate_solvers.ipynb cell 13 (scalar form a = max|f\'(q)| between q_l and q_r; system form with |u|+c is our specialisation). Shown for context; this file implements the global (classic) LF, not LLF.' }
    ],
    assumptions: [
      'Ideal gas gamma-law EOS (gamma = 1.4)',
      'Uniform grid, explicit time stepping',
      'Smooth or weak solutions; scheme is monotone, first order, very diffusive',
      'Transmissive (zero-gradient ghost cell) boundaries at x = 0 and x = 1; for Sod no wave reaches them by t = 0.2'
    ],
    stability: 'CFL: dt * max_i(|u_i|+c_i) / dx <= 1 (domain of dependence; riemannbook2020 Approximate_solvers.ipynb ' +
      'cell 5 states the CFL requirement for Godunov-type methods; LF stability |a dt/dx| <= 1 is standard, lax1954 original ' +
      'not read). Researcher calibration ran at CFL 0.9, which is the default here.',
    scenes: {
      sod: {
        params: [
          { key: 'N', label: 'Grid cells N', min: 20, max: NMAX, step: 10, value: 200, live: false },
          { key: 'CFL', label: 'CFL number', min: 0.05, max: 1.0, step: 0.05, value: 0.9, live: true },
          { key: 'tEnd', label: 'Landing time t_end (step clipped to hit it)', min: 0.01, max: 2, step: 0.01, value: 0.2, live: false },
          { key: 'gamma', label: 'Ratio of specific heats γ', min: 1.05, max: 3, step: 0.01, value: 1.4, live: false },
          { key: 'x0', label: 'Diaphragm position x0', min: 0.05, max: 0.95, step: 0.05, value: 0.5, live: false },
          { key: 'rhoL', label: 'ρ_L', min: 0.01, max: 10, step: 0.005, value: 1.0, live: false },
          { key: 'uL', label: 'u_L', min: -5, max: 5, step: 0.05, value: 0.0, live: false },
          { key: 'pL', label: 'p_L', min: 0.01, max: 100, step: 0.01, value: 1.0, live: false },
          { key: 'rhoR', label: 'ρ_R', min: 0.01, max: 10, step: 0.005, value: 0.125, live: false },
          { key: 'uR', label: 'u_R', min: -5, max: 5, step: 0.05, value: 0.0, live: false },
          { key: 'pR', label: 'p_R', min: 0.01, max: 100, step: 0.01, value: 0.1, live: false }
        ],
        notes: 'Sod set-up from js/scenes.js: x in [0,1], diaphragm at 0.5, (rho,u,p)_L = (1,0,1), (rho,u,p)_R = (0.125,0,0.1), ' +
          'gamma = 1.4. Cell i covers [i dx, (i+1) dx]; a cell whose centre is left of x0 gets the left state. The time step is ' +
          'CFL dx / max(|u|+c), recomputed each step; the step that would pass tEnd (default 0.2) is shortened so the run lands ' +
          'exactly on tEnd, then the run continues with normal steps (it does not stop; waves leave through the transmissive ' +
          'boundaries, the shock reaches x = 1 near t = 0.29). profile.e is the specific internal energy p/((gamma-1) rho). ' +
          'totals are sum(U_i) dx; mass and energy change only through boundary fluxes, momentum grows by (p(0)-p(1)) t ' +
          '= 0.9 t for Sod. Changing CFL mid-run is legitimate (dt is recomputed every step anyway).'
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'sod') throw new Error('lax-friedrichs supports only sod');
      var P = params || {};
      function num(v, d) { v = +v; return isFinite(v) ? v : d; }
      var N = Math.max(4, Math.min(NMAX, Math.round(num(P.N, 200))));
      var cfl = num(P.CFL, 0.9);
      var tEnd = num(P.tEnd, 0.2);
      var g = num(P.gamma, 1.4);
      var x0 = num(P.x0, 0.5);
      var rhoL = num(P.rhoL, 1), uL = num(P.uL, 0), pL = num(P.pL, 1);
      var rhoR = num(P.rhoR, 0.125), uR = num(P.uR, 0), pR = num(P.pR, 0.1);
      var gm1 = g - 1;
      var dx = 1 / N;

      // conserved state with one ghost cell on each side: index k = i + 1
      var M = N + 2;
      var r = new Float64Array(M), m = new Float64Array(M), E = new Float64Array(M);
      var fr = new Float64Array(M), fm = new Float64Array(M), fE = new Float64Array(M);
      var Fr = new Float64Array(N + 1), Fm = new Float64Array(N + 1), FE = new Float64Array(N + 1);
      var xc = new Float64Array(N);
      for (var i = 0; i < N; i++) {
        var x = (i + 0.5) * dx;
        xc[i] = x;
        var rr, uu, pp;
        if (x < x0) { rr = rhoL; uu = uL; pp = pL; } else { rr = rhoR; uu = uR; pp = pR; }
        r[i + 1] = rr; m[i + 1] = rr * uu; E[i + 1] = pp / gm1 + 0.5 * rr * uu * uu;
      }

      function ghosts() {
        r[0] = r[1]; m[0] = m[1]; E[0] = E[1];
        r[N + 1] = r[N]; m[N + 1] = m[N]; E[N + 1] = E[N];
      }

      // max signal speed over interior cells
      function maxSpeed() {
        var s = 0;
        for (var k = 1; k <= N; k++) {
          var rk = r[k], u = m[k] / rk, p = gm1 * (E[k] - 0.5 * m[k] * u);
          var c = Math.sqrt(Math.abs(g * p / rk));
          var a = Math.abs(u) + c;
          if (a > s) s = a;
        }
        return s;
      }

      function totals() {
        // compensated sums of cell averages times dx
        var sr = 0, cr = 0, sm = 0, cm = 0, se = 0, ce = 0, y, t;
        for (var k = 1; k <= N; k++) {
          y = r[k] - cr; t = sr + y; cr = (t - sr) - y; sr = t;
          y = m[k] - cm; t = sm + y; cm = (t - sm) - y; sm = t;
          y = E[k] - ce; t = se + y; ce = (t - se) - y; se = t;
        }
        return { mass: sr * dx, momentum: sm * dx, energy: se * dx };
      }

      var T0 = totals();
      // accumulated net boundary inflow (integral of F(left) - F(right) dt) for a conservation residual
      var inR = 0, inM = 0, inE = 0;
      var lastSmax = maxSpeed();
      var dt0 = cfl * dx / lastSmax;

      function step() {
        ghosts();
        var smax = maxSpeed();
        lastSmax = smax;
        var dt = cfl * dx / smax;
        if (sim.t < tEnd - 1e-14 && sim.t + dt > tEnd) dt = tEnd - sim.t;
        // physical fluxes in all cells incl. ghosts
        for (var k = 0; k < M; k++) {
          var rk = r[k], mk = m[k], Ek = E[k], u = mk / rk, p = gm1 * (Ek - 0.5 * mk * u);
          fr[k] = mk; fm[k] = mk * u + p; fE[k] = u * (Ek + p);
        }
        // LF interface fluxes, interface j between cell k=j and k=j+1 (j = 0..N)
        var a = 0.5 * dx / dt;
        for (var j = 0; j <= N; j++) {
          Fr[j] = 0.5 * (fr[j] + fr[j + 1]) - a * (r[j + 1] - r[j]);
          Fm[j] = 0.5 * (fm[j] + fm[j + 1]) - a * (m[j + 1] - m[j]);
          FE[j] = 0.5 * (fE[j] + fE[j + 1]) - a * (E[j + 1] - E[j]);
        }
        var lam = dt / dx;
        for (var q = 1; q <= N; q++) {
          r[q] -= lam * (Fr[q] - Fr[q - 1]);
          m[q] -= lam * (Fm[q] - Fm[q - 1]);
          E[q] -= lam * (FE[q] - FE[q - 1]);
        }
        inR += dt * (Fr[0] - Fr[N]); inM += dt * (Fm[0] - Fm[N]); inE += dt * (FE[0] - FE[N]);
        sim.dt = dt;
        sim.t += dt;
        sim.steps++;
      }

      function primitives() {
        var rho = new Array(N), u = new Array(N), p = new Array(N), e = new Array(N);
        for (var i = 0; i < N; i++) {
          var k = i + 1, rk = r[k], uk = m[k] / rk, pk = gm1 * (E[k] - 0.5 * m[k] * uk);
          rho[i] = rk; u[i] = uk; p[i] = pk; e[i] = pk / (gm1 * rk);
        }
        return { rho: rho, u: u, p: p, e: e };
      }

      function xs() { return Array.prototype.slice.call(xc); }

      var sim = {
        t: 0, steps: 0, dt: dt0,
        fields: ['rho,u,p', 'rho,u,p,e', 'Mach,entropy'],
        step: step,
        setParam: function (key, value) {
          if (key === 'CFL') { var v = +value; if (isFinite(v) && v > 0) cfl = v; }
        },
        view: function (field) {
          var pr = primitives(), X = xs();
          function panel(key, ylabel, y) {
            return { key: key, ylabel: ylabel, series: [{ label: 'Lax–Friedrichs', x: X, y: y, role: 'sim' }] };
          }
          if (field === 'Mach,entropy') {
            var mach = new Array(N), ent = new Array(N);
            for (var i = 0; i < N; i++) {
              var c = Math.sqrt(Math.abs(g * pr.p[i] / pr.rho[i]));
              mach[i] = pr.u[i] / c;
              ent[i] = Math.log(Math.abs(pr.p[i]) / Math.pow(pr.rho[i], g));   // s/c_v up to a constant
            }
            return { kind: 'profiles', xlabel: 'x', panels: [
              panel('rho', 'ρ', pr.rho), panel('mach', 'Mach u/c', mach), panel('entropy', 'ln(p/ρ^γ)', ent)] };
          }
          var panels = [panel('rho', 'ρ', pr.rho), panel('u', 'u', pr.u), panel('p', 'p', pr.p)];
          if (field === 'rho,u,p,e') panels.push(panel('e', 'e = p/((γ−1)ρ)', pr.e));
          return { kind: 'profiles', xlabel: 'x', panels: panels };
        },
        metrics: function () {
          var T = totals();
          var umax = 0, machMax = 0, rmin = Infinity, pmin = Infinity;
          for (var k = 1; k <= N; k++) {
            var rk = r[k], u = m[k] / rk, p = gm1 * (E[k] - 0.5 * m[k] * u);
            var c = Math.sqrt(Math.abs(g * p / rk));
            if (Math.abs(u) > umax) umax = Math.abs(u);
            if (Math.abs(u) / c > machMax) machMax = Math.abs(u) / c;
            if (rk < rmin) rmin = rk;
            if (p < pmin) pmin = p;
          }
          var resR = T.mass - T0.mass - inR, resE = T.energy - T0.energy - inE, resM = T.momentum - T0.momentum - inM;
          return [
            { key: 't', label: 'time t', value: sim.t, unit: '', fmt: 'g' },
            { key: 'steps', label: 'steps', value: sim.steps, unit: '', fmt: 'i' },
            { key: 'dt', label: 'last dt', value: sim.dt, unit: '', fmt: 'e' },
            { key: 'cfl', label: 'CFL max(|u|+c)dt/dx', value: lastSmax * sim.dt / dx, unit: '', fmt: 'g' },
            { key: 'mass', label: 'mass ∫ρ dx', value: T.mass, unit: '', fmt: 'g' },
            { key: 'momentum', label: 'momentum ∫ρu dx', value: T.momentum, unit: '', fmt: 'g' },
            { key: 'energy', label: 'energy ∫E dx', value: T.energy, unit: '', fmt: 'g' },
            { key: 'dmass', label: 'mass drift |M−M0|/M0', value: Math.abs(T.mass - T0.mass) / Math.abs(T0.mass), unit: '', fmt: 'e' },
            { key: 'denergy', label: 'energy drift |E−E0|/E0', value: Math.abs(T.energy - T0.energy) / Math.abs(T0.energy), unit: '', fmt: 'e' },
            { key: 'cons_res', label: 'max conservation residual (after boundary fluxes)', value: Math.max(Math.abs(resR), Math.abs(resM), Math.abs(resE)), unit: '', fmt: 'e' },
            { key: 'umax', label: 'max |u|', value: umax, unit: '', fmt: 'g' },
            { key: 'mach', label: 'max Mach |u|/c', value: machMax, unit: '', fmt: 'g' },
            { key: 'rhomin', label: 'min ρ', value: rmin, unit: '', fmt: 'g' },
            { key: 'pmin', label: 'min p', value: pmin, unit: '', fmt: 'g' }
          ];
        },
        probe: function (name) {
          if (name === 'profile') {
            var pr = primitives();
            return { x: xs(), rho: pr.rho, u: pr.u, p: pr.p, e: pr.e };
          }
          if (name === 'totals') return totals();
          return null;
        },
        diverged: function () {
          if (!LAB.util.finiteAll(r) || !LAB.util.finiteAll(m) || !LAB.util.finiteAll(E)) return true;
          for (var k = 1; k <= N; k++) {
            if (!(r[k] > 0)) return true;
            if (!(E[k] - 0.5 * m[k] * m[k] / r[k] > 0)) return true;
          }
          return false;
        }
      };
      return sim;
    }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
