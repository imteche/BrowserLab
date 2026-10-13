/* Second-order MUSCL-Hancock finite-volume scheme (slope-limited piecewise-linear reconstruction,
 * half-step predictor, HLLC Riemann solver, conservative corrector) for the 1D Euler equations
 * (Sod shock tube). Metadata from research/hyp.json (method id 'muscl-hancock').
 * See docs/CONTRACTS.md §4. */
(function (LAB) {
  'use strict';

  var N_MAX = 8192;

  LAB.registerMethod({
    id: 'muscl-hancock',
    name: 'MUSCL-Hancock (second order, slope-limited) with HLLC flux',
    family: 'finite-volume',
    summary: 'The tube is cut into N equal cells that store average mass, momentum and total energy. ' +
      'Instead of treating each cell as a flat state, the scheme builds a straight-line profile inside ' +
      'every cell, with the slope taken from the neighbouring differences. A limiter (minmod by default, ' +
      'van Leer as an option) flattens the slope near jumps and extrema, so no new wiggles appear. The ' +
      'two end values of each line are then advanced by half a time step using the physical flux ' +
      'difference across the cell (the Hancock predictor). At every face the evolved values from the ' +
      'two sides define a Riemann problem, which the HLLC solver approximates with three waves. Its ' +
      'flux updates the cell averages conservatively over the full step. With all slopes set to zero ' +
      'the scheme reduces to first-order Godunov/HLLC. It is second order in smooth regions, and it ' +
      'resolves shocks and contacts much more sharply than the first-order scheme. By default, slopes ' +
      'are limited in the conserved variables (rho, rho u, E), as in the researcher calibration. ' +
      'Primitive-variable (rho, u, p) limiting is available as an option.',
    sources: ['toro2009', 'vanleer1979', 'ader2023', 'zingale-cha', 'toro1994hllc', 'clawpack-riemann', 'riemannbook2020'],
    equations: [
      { label: 'Euler flux and EOS', tex: 'U=(\\rho,\\rho u,E)^T,\\; F=(\\rho u,\\rho u^2+p,u(E+p))^T,\\; p=(\\gamma-1)(E-\\tfrac12\\rho u^2)', source: 'zingale-cha', location: "Euler/Euler-methods.tex, flux vector in Sec. 'Riemann solvers' (verified)" },
      { label: 'Limited slope (minmod)', tex: '\\Delta_i=\\mathrm{minmod}(U_i-U_{i-1},\\,U_{i+1}-U_i),\\quad \\mathrm{minmod}(a,b)=\\begin{cases}a & |a|<|b|,\\,ab>0\\\\ b & |b|<|a|,\\,ab>0\\\\ 0 & \\text{otherwise}\\end{cases}', source: 'zingale-cha', location: "advection/advection-higherorder.tex, exercise 'Limiting and overshoots' (verified)" },
      { label: 'Limited slope (van Leer harmonic)', tex: '\\Delta_i=\\begin{cases}\\dfrac{2\\,\\Delta_-\\Delta_+}{\\Delta_-+\\Delta_+} & \\Delta_-\\Delta_+>0\\\\ 0 & \\text{otherwise}\\end{cases},\\;\\Delta_-=U_i-U_{i-1},\\;\\Delta_+=U_{i+1}-U_i', source: 'vanleer1979', location: 'recollection (van Leer 1974/1979 harmonic limiter); NOT verified against an open text' },
      { label: 'Boundary-extrapolated values', tex: 'U_i^L=U_i-\\tfrac12\\Delta_i,\\qquad U_i^R=U_i+\\tfrac12\\Delta_i', source: 'ader2023', location: 'search snippet (verified: false); Toro 2009 Sec. 14.4 (not read)' },
      { label: 'Half-step evolution', tex: '\\bar U_i^{L,R}=U_i^{L,R}+\\frac{1}{2}\\frac{\\Delta t}{\\Delta x}\\big(F(U_i^L)-F(U_i^R)\\big)', source: 'ader2023', location: "search snippet describes 'evolved by half a time step using the flux difference across the cell' (verified: false); explicit formula from recollection of Toro 2009 Sec. 14.4" },
      { label: 'Interface Riemann problem', tex: 'F_{i+1/2}=F^{hllc}\\big(\\bar U_i^R,\\,\\bar U_{i+1}^L\\big),\\quad U_i^{n+1}=U_i^n+\\frac{\\Delta t}{\\Delta x}(F_{i-1/2}-F_{i+1/2})', source: 'toro2009', location: 'Sec. 14.4 (not read); reduces to Godunov when Delta_i = 0 (ader2023 snippet)' },
      { label: 'HLLC contact speed', tex: 'S_*=\\frac{p_R-p_L+\\rho_L u_L(S_L-u_L)-\\rho_R u_R(S_R-u_R)}{\\rho_L(S_L-u_L)-\\rho_R(S_R-u_R)}', source: 'clawpack-riemann', location: 'riemann/euler_1D_py.py euler_hllc_1D docstring (verified); Toro 2009 Ch. 10 (eq. number not verified)' },
      { label: 'HLLC star states', tex: 'U_{*K}=\\rho_K\\frac{S_K-u_K}{S_K-S_*}\\begin{pmatrix}1\\\\S_*\\\\ \\frac{E_K}{\\rho_K}+(S_*-u_K)\\big(S_*+\\frac{p_K}{\\rho_K(S_K-u_K)}\\big)\\end{pmatrix},\\;K=L,R', source: 'clawpack-riemann', location: "euler_hllc_1D docstring 'left/right middle state' (verified)" },
      { label: 'HLLC flux selection', tex: 'F^{hllc}=\\begin{cases}F_L & 0\\le S_L\\\\ F_L+S_L(U_{*L}-U_L) & S_L\\le0\\le S_*\\\\ F_R+S_R(U_{*R}-U_R) & S_*\\le0\\le S_R\\\\ F_R & 0\\ge S_R\\end{cases}', source: 'toro2009', location: "Ch. 10 HLLC flux (recollection; equivalent to clawpack's wave decomposition amdq/apdq, verified by our derivation)" },
      { label: 'Wave-speed estimate (Davis, simple)', tex: 'S_L=\\min(u_L-c_L,u_R-c_R),\\quad S_R=\\max(u_L+c_L,u_R+c_R)', source: 'toro2009', location: 'Ch. 10 wave-speed estimates (recollection, NOT verified); used in researcher calibration run' },
      { label: 'Wave-speed estimate (Einfeldt / Roe-based)', tex: 'S_L=\\min(u_L-c_L,\\hat u-\\hat c),\\quad S_R=\\max(u_R+c_R,\\hat u+\\hat c)', source: 'einfeldt1988', location: "riemannbook2020 Euler_approximate.ipynb cell 26 (verified); clawpack euler_hllc_1D 'Compute Einfeldt speeds'" }
    ],
    assumptions: [
      'Ideal gas gamma = 1.4 (gamma is a parameter)',
      'Slopes may be limited in conservative, primitive or characteristic variables (choice affects oscillations at the contact; calibration used conservative variables). Default here: conserved variables (rho, rho u, E); option: primitive (rho, u, p). Characteristic limiting is not implemented.',
      'TVD limiter keeps scheme non-oscillatory; second order only in smooth regions',
      'Transmissive boundaries with two ghost cells per side (zero-gradient copies of the boundary cell)',
      'Uniform grid on [0, 1]; a cell cut by the diaphragm x0 gets the volume-weighted average of the two states',
      'Implementation safeguard (our addition, not from a source): if a cell\'s reconstructed or half-step-evolved boundary values have non-positive density or pressure, that cell\'s slope is set to zero (first-order fallback). The metric "fallback cells" counts how often this happens.'
    ],
    stability: 'CFL C <= 1 for MUSCL-Hancock (Toro 2009, recollection, unverified); dt = C dx / max_i(|u_i|+c_i) ' +
      'recomputed every step. Researcher calibration stable at C = 0.9.',
    scenes: {
      sod: {
        params: [
          { key: 'N', label: 'Cells N', min: 20, max: N_MAX, step: 20, value: 400, live: false },
          { key: 'CFL', label: 'CFL number C', min: 0.05, max: 1.0, step: 0.05, value: 0.9, live: true },
          { key: 'limiter', label: 'Limiter (0 = minmod, 1 = van Leer, 2 = none/first order)', min: 0, max: 2, step: 1, value: 0, live: true },
          { key: 'vars', label: 'Reconstructed variables (0 = conserved, 1 = primitive)', min: 0, max: 1, step: 1, value: 0, live: true },
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
        notes: 'Domain [0,1], N cells, two transmissive ghost cells per side. dt = C dx / max(|u|+c) is ' +
          'recomputed every step. The step that would cross tEnd is shortened so the run lands exactly on ' +
          'tEnd (default 0.2, the comparison time). Defaults follow the researcher calibration: minmod, ' +
          'conserved-variable slopes, Davis wave speeds, C = 0.9. Limiter 2 sets all slopes to zero, which ' +
          "gives first-order Godunov/HLLC. Toro's modified Sod test uses uL = 0.75, x0 = 0.3."
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'sod') throw new Error('muscl-hancock supports only sod');
      var P = params || {};
      function num(v, d) { v = +v; return isFinite(v) ? v : d; }
      var N = Math.max(4, Math.min(N_MAX, Math.round(num(P.N, 400))));
      var gamma = num(P.gamma, 1.4), gm1 = gamma - 1;
      var CFL = num(P.CFL, 0.9), speeds = Math.round(num(P.speeds, 0));
      var limiter = Math.round(num(P.limiter, 0)), vars = Math.round(num(P.vars, 0));
      var tEnd = num(P.tEnd, 0.2);
      var x0 = num(P.x0, 0.5);
      var WL = [num(P.rhoL, 1), num(P.uL, 0), num(P.pL, 1)];
      var WR = [num(P.rhoR, 0.125), num(P.uR, 0), num(P.pR, 0.1)];
      var dx = 1 / N;

      // conserved state with two ghost cells each side: interior cells are 2..N+1
      var G = 2, M = N + 4;
      var R = new Float64Array(M), MU = new Float64Array(M), E = new Float64Array(M);
      // half-step evolved boundary-extrapolated values: left (minus) and right (plus) face of each cell
      var Lr = new Float64Array(M), Lm = new Float64Array(M), Le = new Float64Array(M);
      var Rr = new Float64Array(M), Rm = new Float64Array(M), Re = new Float64Array(M);
      // fluxes at the N+1 faces; face f lies between cells f+1 and f+2 (face 0 = x=0, face N = x=1)
      var F0 = new Float64Array(N + 1), F1 = new Float64Array(N + 1), F2 = new Float64Array(N + 1);

      function cons(W) { return [W[0], W[0] * W[1], W[2] / gm1 + 0.5 * W[0] * W[1] * W[1]]; }
      var UL = cons(WL), UR = cons(WR);
      for (var i = 0; i < N; i++) {
        var a = i * dx, b = (i + 1) * dx;
        var fl = x0 >= b ? 1 : x0 <= a ? 0 : (x0 - a) / dx;  // fraction of the cell left of x0
        R[i + G] = fl * UL[0] + (1 - fl) * UR[0];
        MU[i + G] = fl * UL[1] + (1 - fl) * UR[1];
        E[i + G] = fl * UL[2] + (1 - fl) * UR[2];
      }

      function ghosts() {
        R[0] = R[1] = R[G]; MU[0] = MU[1] = MU[G]; E[0] = E[1] = E[G];
        var l = N + 1;
        R[l + 1] = R[l + 2] = R[l]; MU[l + 1] = MU[l + 2] = MU[l]; E[l + 1] = E[l + 2] = E[l];
      }

      function maxSpeed() {
        var m = 0;
        for (var i = G; i < N + G; i++) {
          var r = R[i], u = MU[i] / r, p = gm1 * (E[i] - 0.5 * MU[i] * u);
          var s = Math.abs(u) + Math.sqrt(gamma * Math.max(p, 0) / r);
          if (s > m) m = s;
        }
        return m;
      }

      function slope(dm, dp) {
        if (limiter === 2) return 0;
        if (dm * dp <= 0) return 0;
        if (limiter === 1) return 2 * dm * dp / (dm + dp);
        return Math.abs(dm) < Math.abs(dp) ? dm : dp;   // minmod
      }

      var lastSmax = 0, nonPhys = 0, fallbacks = 0, lastFallbacks = 0;

      // Reconstruct + half-step evolve for cells 1..N+2 (needs neighbours 0..N+3).
      function predictor(lam) {
        var h = 0.5 * lam;
        for (var i = 1; i <= N + 2; i++) {
          var r0, m0, e0, rL, mL, eL, rR, mR, eR, d0, d1, d2;
          if (vars === 1) {
            // primitive (rho, u, p)
            var rm = R[i - 1], um = MU[i - 1] / rm, pm = gm1 * (E[i - 1] - 0.5 * MU[i - 1] * um);
            var rc = R[i], uc = MU[i] / rc, pc = gm1 * (E[i] - 0.5 * MU[i] * uc);
            var rp = R[i + 1], up = MU[i + 1] / rp, pp = gm1 * (E[i + 1] - 0.5 * MU[i + 1] * up);
            d0 = slope(rc - rm, rp - rc); d1 = slope(uc - um, up - uc); d2 = slope(pc - pm, pp - pc);
            var wr = rc - 0.5 * d0, wu = uc - 0.5 * d1, wp = pc - 0.5 * d2;
            rL = wr; mL = wr * wu; eL = wp / gm1 + 0.5 * wr * wu * wu;
            wr = rc + 0.5 * d0; wu = uc + 0.5 * d1; wp = pc + 0.5 * d2;
            rR = wr; mR = wr * wu; eR = wp / gm1 + 0.5 * wr * wu * wu;
          } else {
            r0 = R[i]; m0 = MU[i]; e0 = E[i];
            d0 = 0.5 * slope(r0 - R[i - 1], R[i + 1] - r0);
            d1 = 0.5 * slope(m0 - MU[i - 1], MU[i + 1] - m0);
            d2 = 0.5 * slope(e0 - E[i - 1], E[i + 1] - e0);
            rL = r0 - d0; mL = m0 - d1; eL = e0 - d2;
            rR = r0 + d0; mR = m0 + d1; eR = e0 + d2;
          }
          var ok = rL > 0 && rR > 0;
          var uL = 0, uR = 0, pL = 0, pR = 0;
          if (ok) {
            uL = mL / rL; pL = gm1 * (eL - 0.5 * mL * uL);
            uR = mR / rR; pR = gm1 * (eR - 0.5 * mR * uR);
            ok = pL > 0 && pR > 0;
          }
          if (ok) {
            // half-step evolution with the physical flux difference F(U^L) - F(U^R)
            var g0 = h * (mL - mR);
            var g1 = h * ((mL * uL + pL) - (mR * uR + pR));
            var g2 = h * (uL * (eL + pL) - uR * (eR + pR));
            var a0 = rL + g0, a1 = mL + g1, a2 = eL + g2;
            var b0 = rR + g0, b1 = mR + g1, b2 = eR + g2;
            if (a0 > 0 && b0 > 0 && a2 - 0.5 * a1 * a1 / a0 > 0 && b2 - 0.5 * b1 * b1 / b0 > 0) {
              Lr[i] = a0; Lm[i] = a1; Le[i] = a2;
              Rr[i] = b0; Rm[i] = b1; Re[i] = b2;
              continue;
            }
          }
          // first-order fallback for this cell
          if (i >= G && i < N + G) fallbacks++;
          Lr[i] = Rr[i] = R[i]; Lm[i] = Rm[i] = MU[i]; Le[i] = Re[i] = E[i];
        }
      }

      // HLLC flux for left state (rl,ml,El) and right state (rr,mr,Er), written to face f
      function hllc(rl, ml, El, rr, mr, Er, f) {
        var ul = ml / rl, pl = gm1 * (El - 0.5 * ml * ul);
        var ur = mr / rr, pr = gm1 * (Er - 0.5 * mr * ur);
        if (pl <= 0 || pr <= 0 || rl <= 0 || rr <= 0) nonPhys++;
        var cl = Math.sqrt(gamma * Math.max(pl, 0) / rl), cr = Math.sqrt(gamma * Math.max(pr, 0) / rr);
        var SL, SR;
        if (speeds === 1) {
          var sl = Math.sqrt(rl), sr = Math.sqrt(rr), w = 1 / (sl + sr);
          var hl = (El + pl) / rl, hr = (Er + pr) / rr;
          var uh = (sl * ul + sr * ur) * w, Hh = (sl * hl + sr * hr) * w;
          var ch = Math.sqrt(Math.max(gm1 * (Hh - 0.5 * uh * uh), 0));
          SL = Math.min(ul - cl, uh - ch); SR = Math.max(ur + cr, uh + ch);
        } else {
          SL = Math.min(ul - cl, ur - cr); SR = Math.max(ul + cl, ur + cr);
        }
        var fL0 = ml, fL1 = ml * ul + pl, fL2 = ul * (El + pl);
        if (SL >= 0) { F0[f] = fL0; F1[f] = fL1; F2[f] = fL2; return; }
        var fR0 = mr, fR1 = mr * ur + pr, fR2 = ur * (Er + pr);
        if (SR <= 0) { F0[f] = fR0; F1[f] = fR1; F2[f] = fR2; return; }
        var dl = rl * (SL - ul), dr = rr * (SR - ur);
        var Ss = (pr - pl + ul * dl - ur * dr) / (dl - dr);
        var k;
        if (Ss >= 0) {
          k = dl / (SL - Ss);
          F0[f] = fL0 + SL * (k - rl);
          F1[f] = fL1 + SL * (k * Ss - ml);
          F2[f] = fL2 + SL * (k * (El / rl + (Ss - ul) * (Ss + pl / dl)) - El);
        } else {
          k = dr / (SR - Ss);
          F0[f] = fR0 + SR * (k - rr);
          F1[f] = fR1 + SR * (k * Ss - mr);
          F2[f] = fR2 + SR * (k * (Er / rr + (Ss - ur) * (Ss + pr / dr)) - Er);
        }
      }

      function computeDt() {
        lastSmax = maxSpeed();
        var dt = lastSmax > 0 ? CFL * dx / lastSmax : CFL * dx;
        if (sim.t < tEnd - 1e-14 && sim.t + dt > tEnd) dt = tEnd - sim.t;
        return dt;
      }

      function totals() {
        var m = 0, mo = 0, en = 0;
        for (var i = G; i < N + G; i++) { m += R[i]; mo += MU[i]; en += E[i]; }
        return { mass: m * dx, momentum: mo * dx, energy: en * dx };
      }
      var tot0 = totals();
      var bflux = new Float64Array(3);

      var sim = {
        t: 0, steps: 0, dt: 0,
        fields: ['primitive', 'thermo'],
        step: function () {
          var dt = computeDt();
          var lam = dt / dx;
          ghosts();
          nonPhys = 0; fallbacks = 0;
          predictor(lam);
          // face f between cells f+1 (right-evolved value) and f+2 (left-evolved value)
          for (var f = 0; f <= N; f++) hllc(Rr[f + 1], Rm[f + 1], Re[f + 1], Lr[f + 2], Lm[f + 2], Le[f + 2], f);
          for (var i = G; i < N + G; i++) {
            var fi = i - G;  // left face of cell i is fi, right face fi+1
            R[i] += lam * (F0[fi] - F0[fi + 1]);
            MU[i] += lam * (F1[fi] - F1[fi + 1]);
            E[i] += lam * (F2[fi] - F2[fi + 1]);
          }
          bflux[0] += dt * (F0[0] - F0[N]); bflux[1] += dt * (F1[0] - F1[N]); bflux[2] += dt * (F2[0] - F2[N]);
          lastFallbacks = fallbacks;
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
          else if (key === 'speeds') speeds = Math.round(v);
          else if (key === 'limiter') limiter = Math.round(v);
          else if (key === 'vars') vars = Math.round(v);
          else if (key === 'tEnd') tEnd = v;
        },
        view: function (field) {
          var pr = sim.probe('profile');
          var lim = limiter === 1 ? 'van Leer' : limiter === 2 ? 'no slope' : 'minmod';
          var name = 'MUSCL-Hancock (' + lim + (vars === 1 ? ', prim.' : ', cons.') + ')';
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
          for (var i = G; i < N + G; i++) {
            var r = R[i], u = MU[i] / r, p = gm1 * (E[i] - 0.5 * MU[i] * u);
            var c = Math.sqrt(gamma * Math.max(p, 0) / r), m = Math.abs(u) / c;
            if (m > machMax) machMax = m;
            if (p < pmin) pmin = p;
            if (r < rmin) rmin = r;
          }
          function rel(a, b) { return Math.abs(a - b) / Math.max(Math.abs(b), 1e-300); }
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
            { key: 'pmin', label: 'min p', value: pmin, unit: '', fmt: 'g' },
            { key: 'fallback', label: 'fallback cells (last step)', value: lastFallbacks, unit: '', fmt: 'i' }
          ];
        },
        probe: function (name) {
          if (name === 'profile') {
            var x = new Array(N), rho = new Array(N), u = new Array(N), p = new Array(N), e = new Array(N);
            for (var i = 0; i < N; i++) {
              var k = i + G, r = R[k], v = MU[k] / r, pp = gm1 * (E[k] - 0.5 * MU[k] * v);
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
          for (var i = G; i < N + G; i++) {
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
