/* Stream-function / vorticity finite differences for the lid-driven cavity.
 * Metadata from research/ins.json (method id 'psi-omega-fd'). See docs/CONTRACTS.md §4.
 *
 * Grid: (N+1) x (N+1) nodes on [0,1]^2, h = 1/N, node (i,j) at (i h, j h), index k = j*(N+1)+i
 * (j = 0 is the bottom wall, j = N the lid). psi = 0 on all walls.
 * One step:
 *   1. wall vorticity from Thom's formula (current psi),
 *   2. explicit (forward Euler) vorticity transport at interior nodes, convection central or
 *      first-order upwind, diffusion 5-point Laplacian,
 *   3. Poisson solve  lap(psi) = -omega  by geometric multigrid V(2,2) cycles (red-black
 *      Gauss-Seidel smoother, full weighting, bilinear prolongation, SOR on the coarsest grid),
 *      warm-started from the previous psi, repeated until the largest psi change < 1e-10,
 *   4. u = dpsi/dy, v = -dpsi/dx by central differences; walls u=v=0, lid u=1.
 * dt is recomputed each step from the stability limits times a safety factor 'cfl'.
 * residual probe = max over nodes of |u^{n+1}-u^n|, |v^{n+1}-v^n| divided by dt
 * (velocity change per unit scene time, as in CONTRACTS §3). */
(function (LAB) {
  'use strict';

  var SCHEMES = ['central', 'upwind (1st order)'];

  LAB.registerMethod({
    id: 'psi-omega-fd',
    name: 'Stream-function / vorticity finite differences',
    family: 'finite-difference',
    summary: 'The 2-D incompressible Navier–Stokes equations are rewritten for two scalars: the ' +
      'vorticity ω, which is carried by the flow and diffuses, and the stream function ψ, whose ' +
      'Laplacian is −ω. Velocities come from derivatives of ψ, so the discrete flow is exactly ' +
      'divergence-free and no pressure is needed. Each step marches ω explicitly on a uniform ' +
      'grid (central or first-order upwind convection, centred diffusion), solves the Poisson ' +
      'equation for ψ by multigrid starting from the previous ψ, and sets the ' +
      'wall vorticity from Thom’s formula, which encodes no-slip and the moving lid. Run long ' +
      'enough, the time march settles to the steady cavity flow; ψ_min and the primary vortex ' +
      'centre come straight out of the ψ field.',
    sources: ['ghia1982', 'erturk2005', 'e1996'],
    equations: [
      { label: 'Vorticity transport',
        tex: '\\frac{\\partial\\omega}{\\partial t}+u\\frac{\\partial\\omega}{\\partial x}+v\\frac{\\partial\\omega}{\\partial y}=\\frac{1}{Re}\\left(\\frac{\\partial^2\\omega}{\\partial x^2}+\\frac{\\partial^2\\omega}{\\partial y^2}\\right)',
        source: 'erturk2005',
        location: 'governing equations section (search snippet confirms psi-omega formulation; eq. number unverified)' },
      { label: 'Stream-function Poisson',
        tex: '\\nabla^2\\psi=-\\omega,\\qquad u=\\frac{\\partial\\psi}{\\partial y},\\; v=-\\frac{\\partial\\psi}{\\partial x},\\qquad \\omega=\\frac{\\partial v}{\\partial x}-\\frac{\\partial u}{\\partial y}',
        source: 'erturk2005',
        location: 'unverified (sign convention: Ghia/Erturk use the same; clockwise primary vortex has psi<0)' },
      { label: 'Thom wall vorticity (wall w, first interior node w+1, wall-normal spacing h, tangential wall speed U_w)',
        tex: '\\omega_w=-\\frac{2\\,(\\psi_{w+1}-\\psi_w)}{h^2}-\\frac{2U_w}{h}\\;\\text{(lid, }U_w=1\\text{, normal pointing into fluid)}',
        source: 'erturk2005',
        location: 'boundary-condition section (snippet: Thom\'s formula, locally 1st order but global solution 2nd order); exact sign depends on wall orientation' },
      { label: 'Equivalence with MAC',
        tex: '\\text{MAC} \\equiv \\text{Thom BC} + \\text{centred differences}',
        source: 'e1996',
        location: 'search snippet via arXiv:0809.3098' }
    ],
    assumptions: [
      '2-D incompressible, constant viscosity',
      'Simply connected domain (psi = const = 0 on all cavity walls); multiply-connected domains (cylinder) need an extra condition for psi on the body',
      'Steady solutions obtained by pseudo-time marching or Newton/multigrid (Ghia: coupled strongly implicit multigrid; Erturk: implicit, 601^2)',
      'This implementation: explicit forward-Euler pseudo/physical time march, so the steady state is reached only after the residual has decayed; the time history is first-order accurate in time',
      'Lid corners are singular (omega unbounded there); corner nodes are not used by the 5-point stencils and are set to 0'
    ],
    stability: 'Explicit FTCS: diffusion number nu dt/h^2 <= 1/4 (2-D) and convective CFL (|u|+|v|) dt/h <= 1; ' +
      'cell Peclet |u| h Re <= 2 for central convection without upwinding. Standard von Neumann results; ' +
      'not traced to a cited equation here (research/ins.json). Implemented: dt = cfl * min(h^2 Re/4, h/max(|u|+|v|), ' +
      '2/(Re max(u^2+v^2))) for central convection (the last bound keeps forward Euler stable when the cell ' +
      'Peclet number exceeds 2, but wiggles may then appear), and dt = cfl / (4/(Re h^2) + max(|u|+|v|)/h) for upwind.',
    scenes: {
      cavity: {
        params: [
          { key: 'Re', label: 'Reynolds number', min: 10, max: 5000, step: 10, value: 100, live: false },
          { key: 'N', label: 'Grid cells per side (N, nodes N+1)', min: 16, max: 512, step: 16, value: 128, live: false },
          { key: 'scheme', label: 'Convection: 0 central, 1 upwind', min: 0, max: 1, step: 1, value: 0, live: false },
          { key: 'cfl', label: 'Time-step safety factor (fraction of stability limit)', min: 0.05, max: 1, step: 0.05, value: 0.8, live: true },
          { key: 'mgCycles', label: 'Max multigrid V-cycles per step', min: 1, max: 50, step: 1, value: 10, live: true }
        ],
        notes: 'Uniform grid, psi = 0 on walls, Thom wall vorticity with lid speed 1. psi_min and vortex_center ' +
          'are the minimum of the nodal psi refined by a 1-D parabola through the three nodes in x and in y. ' +
          'residual = max |Δu|, |Δv| per unit time. With N=128 the nodes coincide with Ghia’s 129-point grid. ' +
          'The multigrid loop stops early when the largest psi correction of a V-cycle falls below 1e-10.'
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'cavity') throw new Error('psi-omega-fd supports only cavity');
      var Re = +params.Re;
      var N = Math.max(4, Math.round(+params.N));
      var scheme = Math.round(+params.scheme) === 1 ? 1 : 0;
      var cfl = +params.cfl;
      var mgCycles = Math.max(1, Math.round(+params.mgCycles));
      var M = N + 1, NN = M * M;
      var h = 1 / N, h2 = h * h, inv2h = 0.5 / h, invh2 = 1 / h2, nu = 1 / Re;
      var MG_TOL = 1e-10;
      var ULID = 1;

      var psi = new Float64Array(NN), w = new Float64Array(NN), wn = new Float64Array(NN);
      var u = new Float64Array(NN), v = new Float64Array(NN);
      var residual = NaN, lastSweeps = 0, lastCorr = 0, poissonRes = 0;
      var stab = { dt: 0, diff: 0, cfl: 0, pe: 0 };

      function setVelocity() {
        // returns max |Δu|,|Δv|
        var dmax = 0, i, j, k, a, b, d;
        for (j = 1; j < N; j++) {
          for (i = 1; i < N; i++) {
            k = j * M + i;
            a = (psi[k + M] - psi[k - M]) * inv2h;
            b = -(psi[k + 1] - psi[k - 1]) * inv2h;
            d = Math.abs(a - u[k]); if (d > dmax) dmax = d;
            d = Math.abs(b - v[k]); if (d > dmax) dmax = d;
            u[k] = a; v[k] = b;
          }
        }
        return dmax;
      }
      // boundary velocities (fixed)
      for (var ii = 0; ii < M; ii++) u[N * M + ii] = ULID;
      u[N * M] = 0; u[N * M + N] = 0; // corners: treat as stationary walls (only used for display)

      function wallVorticity() {
        var i, j;
        for (i = 1; i < N; i++) {
          w[i] = -2 * psi[M + i] * invh2;                                        // bottom
          w[N * M + i] = -2 * psi[(N - 1) * M + i] * invh2 - 2 * ULID / h;       // lid
        }
        for (j = 1; j < N; j++) {
          w[j * M] = -2 * psi[j * M + 1] * invh2;                                // left
          w[j * M + N] = -2 * psi[j * M + N - 1] * invh2;                        // right
        }
        w[0] = 0; w[N] = 0; w[N * M] = 0; w[N * M + N] = 0;
      }

      function computeDt() {
        var vmax = 0, v2max = 0, i, k, s, q;
        for (k = 0; k < NN; k++) {
          s = Math.abs(u[k]) + Math.abs(v[k]); if (s > vmax) vmax = s;
          q = u[k] * u[k] + v[k] * v[k]; if (q > v2max) v2max = q;
        }
        if (vmax < ULID) vmax = ULID;
        if (v2max < ULID * ULID) v2max = ULID * ULID;
        var dt;
        if (scheme === 0) {
          dt = Math.min(h2 / (4 * nu), h / vmax, 2 * nu / v2max);
        } else {
          dt = 1 / (4 * nu / h2 + vmax / h);
        }
        dt *= cfl;
        stab.dt = dt; stab.diff = nu * dt / h2; stab.cfl = vmax * dt / h;
        stab.pe = Math.sqrt(v2max) * h / nu;
        return dt;
      }

      function transport(dt) {
        var i, j, k, uu, vv, conv, lap, dwx, dwy;
        for (j = 1; j < N; j++) {
          for (i = 1; i < N; i++) {
            k = j * M + i;
            uu = u[k]; vv = v[k];
            if (scheme === 0) {
              dwx = (w[k + 1] - w[k - 1]) * inv2h;
              dwy = (w[k + M] - w[k - M]) * inv2h;
            } else {
              dwx = uu > 0 ? (w[k] - w[k - 1]) / h : (w[k + 1] - w[k]) / h;
              dwy = vv > 0 ? (w[k] - w[k - M]) / h : (w[k + M] - w[k]) / h;
            }
            conv = uu * dwx + vv * dwy;
            lap = (w[k + 1] + w[k - 1] + w[k + M] + w[k - M] - 4 * w[k]) * invh2;
            wn[k] = w[k] + dt * (nu * lap - conv);
          }
        }
        for (j = 1; j < N; j++) for (i = 1; i < N; i++) { k = j * M + i; w[k] = wn[k]; }
      }

      // ---- geometric multigrid for lap(psi) = -omega (vertex-centred, Dirichlet psi = 0) ----
      // level 0 is the fine grid; coarsen while the cell count is even and >= 4.
      var levels = [];
      (function buildLevels() {
        var n = N;
        while (true) {
          var m = n + 1;
          levels.push({ n: n, m: m, x: levels.length ? new Float64Array(m * m) : null,
            f: new Float64Array(m * m), r: new Float64Array(m * m), h2: 1 / (n * n) });
          if (n % 2 !== 0 || n < 4) break;
          n = n / 2;
        }
      })();
      levels[0].x = psi;

      // red-black Gauss-Seidel on lap(x) = -f  (i.e. x = (sum nbrs + h^2 f)/4)
      function smooth(L, sweeps, relax) {
        var n = L.n, m = L.m, x = L.x, f = L.f, hh = L.h2, s, c, i, j, k, start, r;
        for (s = 0; s < sweeps; s++) {
          for (c = 0; c < 2; c++) {
            for (j = 1; j < n; j++) {
              start = 1 + ((j + c) & 1);
              k = j * m + start;
              for (i = start; i < n; i += 2, k += 2) {
                r = 0.25 * (x[k + 1] + x[k - 1] + x[k + m] + x[k - m] + hh * f[k]) - x[k];
                x[k] += relax * r;
              }
            }
          }
        }
      }
      function resid(L) {   // r = f + lap(x)   (residual of lap(x) = -f, sign so that lap(e) = -r)
        var n = L.n, m = L.m, x = L.x, f = L.f, r = L.r, ih = 1 / L.h2, i, j, k;
        for (j = 1; j < n; j++) {
          k = j * m + 1;
          for (i = 1; i < n; i++, k++) r[k] = f[k] + (x[k + 1] + x[k - 1] + x[k + m] + x[k - m] - 4 * x[k]) * ih;
        }
      }
      function restrict(F, C) { // full weighting of F.r into C.f
        var nc = C.n, mc = C.m, mf = F.m, r = F.r, f = C.f, I, J, k;
        for (J = 1; J < nc; J++) for (I = 1; I < nc; I++) {
          k = (2 * J) * mf + 2 * I;
          f[J * mc + I] = 0.25 * r[k] + 0.125 * (r[k + 1] + r[k - 1] + r[k + mf] + r[k - mf]) +
            0.0625 * (r[k + mf + 1] + r[k + mf - 1] + r[k - mf + 1] + r[k - mf - 1]);
        }
      }
      function prolongAdd(C, F) { // bilinear interpolation of C.x added to F.x (interior only)
        var nf = F.n, mf = F.m, mc = C.m, xc = C.x, xf = F.x, i, j, k, I, J, ei, ej, val;
        for (j = 1; j < nf; j++) {
          J = j >> 1; ej = j & 1;
          for (i = 1; i < nf; i++) {
            I = i >> 1; ei = i & 1; k = J * mc + I;
            if (!ei && !ej) val = xc[k];
            else if (ei && !ej) val = 0.5 * (xc[k] + xc[k + 1]);
            else if (!ei && ej) val = 0.5 * (xc[k] + xc[k + mc]);
            else val = 0.25 * (xc[k] + xc[k + 1] + xc[k + mc] + xc[k + mc + 1]);
            xf[j * mf + i] += val;
          }
        }
      }
      function vcycle(l) {
        var L = levels[l];
        if (l === levels.length - 1) {
          var nsw = Math.max(4, 2 * L.n * L.n);   // coarsest grid: many relaxed sweeps (tiny grid)
          smooth(L, Math.min(nsw, 400), 2 / (1 + Math.sin(Math.PI / L.n)));
          return;
        }
        smooth(L, 2, 1);
        resid(L);
        var C = levels[l + 1];
        restrict(L, C);
        C.x.fill(0);
        vcycle(l + 1);
        prolongAdd(C, L);
        smooth(L, 2, 1);
      }

      var psiPrev = new Float64Array(NN);
      function poisson() {
        var L0 = levels[0], it, k, d, cmax = 0;
        L0.f = w;   // right-hand side is omega itself (lap psi = -omega); boundary entries unused
        for (it = 0; it < mgCycles; it++) {
          psiPrev.set(psi);
          vcycle(0);
          cmax = 0;
          for (k = 0; k < NN; k++) { d = psi[k] - psiPrev[k]; if (d < 0) d = -d; if (d > cmax) cmax = d; }
          if (cmax < MG_TOL) { it++; break; }
        }
        lastSweeps = it; lastCorr = cmax;
      }

      function poissonResidual() {
        var m = 0, i, j, k, r;
        for (j = 1; j < N; j++) for (i = 1; i < N; i++) {
          k = j * M + i;
          r = Math.abs((psi[k + 1] + psi[k - 1] + psi[k + M] + psi[k - M] - 4 * psi[k]) * invh2 + w[k]);
          if (r > m) m = r;
        }
        return m;
      }

      wallVorticity();
      computeDt();

      var sim = {
        t: 0, steps: 0, dt: stab.dt,
        fields: ['vorticity', 'psi', 'speed', 'u', 'v'],
        step: function () {
          var dt = computeDt();
          wallVorticity();
          transport(dt);
          poisson();
          var du = setVelocity();
          wallVorticity();           // keep boundary omega consistent with the new psi for output
          residual = du / dt;
          sim.dt = dt;
          sim.steps++;
          sim.t += dt;
        },
        setParam: function (key, value) {
          if (key === 'cfl') { cfl = +value; computeDt(); sim.dt = stab.dt; }
          else if (key === 'mgCycles') mgCycles = Math.max(1, Math.round(+value));
        },
        view: function (field) {
          field = field || 'vorticity';
          var data = new Float32Array(NN), k, lo, hi, cmap = 'diverging', a;
          if (field === 'psi') {
            var mx = 1e-12;
            for (k = 0; k < NN; k++) { data[k] = psi[k]; a = Math.abs(psi[k]); if (a > mx) mx = a; }
            lo = -mx; hi = mx;
          } else if (field === 'speed') {
            for (k = 0; k < NN; k++) data[k] = Math.sqrt(u[k] * u[k] + v[k] * v[k]);
            lo = 0; hi = 1; cmap = 'sequential';
          } else if (field === 'u') {
            for (k = 0; k < NN; k++) data[k] = u[k];
            lo = -1; hi = 1;
          } else if (field === 'v') {
            for (k = 0; k < NN; k++) data[k] = v[k];
            lo = -0.6; hi = 0.6;
          } else {
            for (k = 0; k < NN; k++) data[k] = w[k];
            lo = -6; hi = 6;
          }
          return { kind: 'field', nx: M, ny: M, data: data, range: [lo, hi], cmap: cmap, extent: [0, 0, 1, 1] };
        },
        metrics: function () {
          var ke = 0, ens = 0, circ = 0, umax = 0, i, j, k, wx, wy, s, divmax = 0, dv;
          for (j = 0; j < M; j++) {
            wy = (j === 0 || j === N) ? 0.5 : 1;
            for (i = 0; i < M; i++) {
              wx = (i === 0 || i === N) ? 0.5 : 1;
              k = j * M + i;
              s = u[k] * u[k] + v[k] * v[k];
              ke += wx * wy * 0.5 * s;
              ens += wx * wy * 0.5 * w[k] * w[k];
              circ += wx * wy * w[k];
              if (s > umax) umax = s;
            }
          }
          ke *= h2; ens *= h2; circ *= h2;
          for (j = 2; j < N - 1; j++) for (i = 2; i < N - 1; i++) {
            k = j * M + i;
            dv = Math.abs((u[k + 1] - u[k - 1]) * inv2h + (v[k + M] - v[k - M]) * inv2h);
            if (dv > divmax) divmax = dv;
          }
          var pm = psiMin();
          var M_ = LAB.util.metric;
          return [
            M_('t', 'time t (L/U)', sim.t, '', 'g'),
            M_('steps', 'steps', sim.steps, '', 'i'),
            M_('dt', 'time step dt', stab.dt, '', 'e'),
            M_('residual', 'max|Δu|/Δt', residual, '', 'e'),
            M_('ke', 'kinetic energy ∫½|u|² dA', ke, '', 'e'),
            M_('enstrophy', 'enstrophy ∫½ω² dA', ens, '', 'e'),
            M_('circ', 'circulation ∫ω dA (Stokes: −1)', circ, '', 'g'),
            M_('umax', 'max |u|', Math.sqrt(umax), '', 'g'),
            M_('cfl', 'CFL (|u|+|v|)Δt/h', stab.cfl, '', 'g'),
            M_('diff', 'diffusion number νΔt/h²', stab.diff, '', 'g'),
            M_('pe', 'cell Péclet |u|h·Re', stab.pe, '', 'g'),
            M_('div', 'max |∇·u| (interior, central)', divmax, '', 'e'),
            M_('mg', 'V-cycles last step', lastSweeps, '', 'i'),
            M_('poisson', 'max |∇²ψ+ω| (interior)', poissonResidual(), '', 'e'),
            M_('psimin', 'ψ_min', pm ? pm.value : NaN, '', 'g')
          ];
        },
        probe: function (name) {
          var i, j, a;
          if (name === 'u_vcl') {
            var ys = new Array(M), us = new Array(M);
            var ic = N / 2, i0 = Math.floor(ic), fr = ic - i0;
            for (j = 0; j < M; j++) {
              ys[j] = j * h;
              a = u[j * M + i0];
              if (fr > 0) a = (1 - fr) * a + fr * u[j * M + i0 + 1];
              us[j] = a / ULID;
            }
            return { y: ys, u: us };
          }
          if (name === 'v_hcl') {
            var xs = new Array(M), vs = new Array(M);
            var jc = N / 2, j0 = Math.floor(jc), fj = jc - j0;
            for (i = 0; i < M; i++) {
              xs[i] = i * h;
              a = v[j0 * M + i];
              if (fj > 0) a = (1 - fj) * a + fj * v[(j0 + 1) * M + i];
              vs[i] = a / ULID;
            }
            return { x: xs, v: vs };
          }
          if (name === 'psi_min') { var p = psiMin(); return p ? p.value : null; }
          if (name === 'vortex_center') { var c = psiMin(); return c ? { x: c.x, y: c.y } : null; }
          if (name === 'residual') return residual;
          return null;
        },
        diverged: function () {
          if (!LAB.util.finiteAll(psi) || !LAB.util.finiteAll(w)) return true;
          for (var k = 0; k < NN; k++) if (Math.abs(u[k]) > 1e3) return true;
          return false;
        }
      };

      // minimum of nodal psi refined by separable parabolic fits
      function psiMin() {
        var best = Infinity, bk = -1, i, j, k;
        for (j = 1; j < N; j++) for (i = 1; i < N; i++) {
          k = j * M + i;
          if (psi[k] < best) { best = psi[k]; bk = k; }
        }
        if (bk < 0 || !(best < 0)) return null;
        i = bk % M; j = (bk - i) / M;
        var fx = parab(psi[bk - 1], psi[bk], psi[bk + 1]);
        var fy = parab(psi[bk - M], psi[bk], psi[bk + M]);
        return { value: best + fx.dv + fy.dv, x: (i + fx.off) * h, y: (j + fy.off) * h };
      }
      function parab(a, b, c) {
        var den = a - 2 * b + c;
        if (!(den > 0)) return { off: 0, dv: 0 };
        var off = 0.5 * (a - c) / den;
        if (off > 0.5) off = 0.5; else if (off < -0.5) off = -0.5;
        return { off: off, dv: -0.25 * (a - c) * off };
      }

      return sim;
    }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
