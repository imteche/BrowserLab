/* Stam's Stable Fluids: semi-Lagrangian advection + implicit diffusion + pressure projection.
 * Metadata from research/ins.json (method id 'stable-fluids'). See docs/CONTRACTS.md §4.
 *
 * Grid (as in Stam 2003, solver03.c): collocated, (N+2) x (N+2) cells including one ghost layer,
 * index IX(i,j) = i + (N+2) j, j = 0 is the bottom ghost row. Interior cells i,j = 1..N have centres
 * ((i-1/2) h, (j-1/2) h) with h = L/N (L = 1 for the cavity, 2 pi for Taylor-Green).
 * One step follows Stam's vel_step (no external force):
 *   diffuse u, v  (implicit, 'iters' Gauss-Seidel sweeps, a = nu dt / h^2)
 *   project       ('pIters' Gauss-Seidel sweeps for lap(p) = div u, p starts from 0 as in Stam)
 *   advect u, v   (Euler backtrace x - dt u(x), bilinear interpolation; self-advection by the
 *                  projected field)
 *   project       (divergence metrics are measured after this projection)
 * Boundary conditions (set_bnd replacement):
 *   cavity: NO-SLIP walls (ghost = -interior for both components) and a moving lid u = 1 imposed
 *           through the ghost row u_ghost = 2*1 - u_interior, v_ghost = -v_interior. This replaces
 *           Stam's free-slip set_bnd (tangential copy) and is a modification documented in
 *           research/ins.json; it is not in the paper. Pressure: zero normal gradient (copy).
 *           Backtrace clamped to [0.5, N+0.5] in index units (the wall), where bilinear
 *           interpolation of interior + ghost returns the wall velocity.
 *   taylor-green: fully periodic (ghost layers are periodic copies, backtrace wrapped).
 * Pressure shown in the view is p/dt (Stam's p carries a factor dt). */
(function (LAB) {
  'use strict';

  var EQUATIONS = [
    { label: 'Incompressible NS (Stam\'s form)',
      tex: '\\frac{\\partial\\mathbf{u}}{\\partial t}=-(\\mathbf{u}\\cdot\\nabla)\\mathbf{u}+\\nu\\nabla^2\\mathbf{u}+\\mathbf{f}-\\nabla p,\\qquad \\nabla\\cdot\\mathbf{u}=0',
      source: 'stam1999',
      location: 'governing equations (eq. numbers unverified; PDF not reachable)' },
    { label: 'Semi-Lagrangian advection',
      tex: '\\mathbf{u}^{*}(\\mathbf{x})=\\mathbf{u}^n\\big(\\mathbf{x}-\\Delta t\\,\\mathbf{u}^n(\\mathbf{x})\\big)\\;\\text{(bilinear interpolation, Euler backtrace)}',
      source: 'stam2003',
      location: 'advect() in solver03.c (read via JS port copy, npm stam-stable-fluids@1.0.3)' },
    { label: 'Implicit diffusion',
      tex: '(I-\\nu\\Delta t\\nabla_h^2)\\,\\mathbf{u}^{**}=\\mathbf{u}^{*}\\;\\Leftrightarrow\\;(1+4a)u_{ij}-a\\,(u_{i\\pm1,j}+u_{i,j\\pm1})=u^{*}_{ij},\\; a=\\nu\\Delta t N^2',
      source: 'stam2003',
      location: 'diffuse()/lin_solve(): 20 Gauss-Seidel sweeps' },
    { label: 'Projection (Helmholtz-Hodge)',
      tex: '\\nabla_h^2 p=\\nabla_h\\cdot\\mathbf{u}^{**},\\qquad \\mathbf{u}^{n+1}=\\mathbf{u}^{**}-\\nabla_h p',
      source: 'stam2003',
      location: 'project(): central-difference divergence and gradient on a collocated grid, 20 Gauss-Seidel sweeps; Helmholtz-Hodge decomposition per stam1999 (snippet)' }
  ];

  function commonParams(Nval, NmaxVal) {
    return [
      { key: 'N', label: 'Grid cells per side', min: 16, max: NmaxVal, step: 16, value: Nval, live: false },
      { key: 'cfl', label: 'Time step as CFL number (dt = cfl·h/U)', min: 0.05, max: 8, step: 0.05, value: 1, live: true },
      { key: 'iters', label: 'Gauss–Seidel sweeps, diffusion (Stam: 20)', min: 1, max: 500, step: 1, value: 20, live: true },
      { key: 'pIters', label: 'Gauss–Seidel sweeps, pressure projection (Stam: 20)', min: 1, max: 5000, step: 1, value: 20, live: true }
    ];
  }

  LAB.registerMethod({
    id: 'stable-fluids',
    name: 'Stable Fluids (semi-Lagrangian advection + pressure projection)',
    family: 'semi-lagrangian',
    summary: 'Stam’s Stable Fluids splits each time step of the incompressible Navier–Stokes ' +
      'equations into simple pieces that never blow up. Viscosity is applied implicitly with a few ' +
      'Gauss–Seidel sweeps. The velocity is then made divergence-free by solving a pressure Poisson ' +
      'equation and subtracting the pressure gradient. Advection traces each grid point backwards ' +
      'along the flow for one time step and interpolates the old velocity there (semi-Lagrangian). ' +
      'A second projection follows. Every piece is bounded or implicit, so any time step is stable, ' +
      'but the first-order backtrace and bilinear interpolation add numerical dissipation, and the ' +
      'fixed small number of solver sweeps (20 in Stam’s code) leaves some divergence. Stam’s code ' +
      'uses free-slip walls. Here the cavity uses no-slip walls with a moving lid instead, and ' +
      'Taylor–Green runs on a periodic grid.',
    sources: ['stam1999', 'stam2003'],
    equations: EQUATIONS,
    assumptions: [
      'Incompressible, constant density',
      'Visual plausibility prioritised over accuracy (stam2003 abstract: stability and speed over physical accuracy)',
      'Collocated grid with (N+2)^2 cells incl. ghost layer; unit domain h=1/N',
      'This implementation: Taylor–Green uses the same scheme on [0, 2π]² with h = 2π/N and periodic ghost layers; a = ν Δt / h² in general',
      'Cavity: Stam’s free-slip set_bnd is replaced by no-slip ghost reflection (u_ghost = −u, v_ghost = −v) and a lid ghost row u_ghost = 2·1 − u_interior, so the wall value (ghost/interior average) is exactly 0 or 1; this is a modification, not in the paper',
      'Iterative solves are not run to convergence: fixed sweep counts (default 20, as in stam2003); remaining divergence is reported as a metric',
      'First-order in time (operator splitting, Euler backtrace); the time step is chosen as dt = cfl·h/U with U = 1'
    ],
    stability: 'Unconditionally stable for any dt (stam1999 abstract snippet): semi-Lagrangian interpolation ' +
      'is bounded (max principle) and implicit diffusion is unconditionally stable. Accuracy still requires ' +
      'CFL = |u| dt/h of order 1 or less; large dt adds strong numerical dissipation (research/ins.json).',
    scenes: {
      cavity: {
        params: [{ key: 'Re', label: 'Reynolds number', min: 10, max: 5000, step: 10, value: 100, live: false }]
          .concat(commonParams(64, 512)),
        notes: 'No-slip walls and lid u = 1 set explicitly via ghost cells (Stam’s set_bnd is free-slip). ' +
          'u_vcl / v_hcl: cell-centre values averaged across the centreline (x = 0.5 or y = 0.5 is a cell face ' +
          'for even N), plus the wall values at both ends. psi: integrated from u along y on cell corners ' +
          '(ψ = 0 on the bottom wall); psi_min and vortex_center use a parabolic refinement of the corner minimum. ' +
          'residual = max |Δu|, |Δv| over interior cells divided by dt.'
      },
      'taylor-green': {
        params: [{ key: 'Re', label: 'Reynolds number U0/(kν)', min: 10, max: 10000, step: 10, value: 100, live: false }]
          .concat(commonParams(64, 512)),
        notes: 'Periodic box [0, 2π]², k = U0 = 1, ν = 1/Re. Cell-centred initial field u = −cos x sin y, ' +
          'v = sin x cos y (discretely divergence-free for the central operator). kinetic_energy = domain mean of ½|u|²; ' +
          'l2_error = sqrt(Σ|u − u_exact|² / Σ|u_exact|²) over cell centres with u_exact = u(0)·exp(−2νt).'
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'cavity' && sceneId !== 'taylor-green') throw new Error('stable-fluids: unsupported scene ' + sceneId);
      var periodic = sceneId === 'taylor-green';
      var Re = +params.Re;
      var N = Math.max(4, Math.round(+params.N));
      var cfl = +params.cfl;
      var iters = Math.max(1, Math.round(+params.iters));
      var pIters = Math.max(1, Math.round(+params.pIters));
      var L = periodic ? 2 * Math.PI : 1;
      var h = L / N, nu = 1 / Re, ULID = 1, Uref = 1;
      var S = N + 2, NN = S * S;
      function IX(i, j) { return i + S * j; }

      var u = new Float64Array(NN), v = new Float64Array(NN);
      var u0 = new Float64Array(NN), v0 = new Float64Array(NN);
      var p = new Float64Array(NN), div = new Float64Array(NN);
      var uPrev = new Float64Array(NN), vPrev = new Float64Array(NN);
      var dt = cfl * h / Uref;
      var residual = NaN, divBefore = 0, divAfter = 0, divRms = 0, ke0 = 0;

      // b: 0 scalar (Neumann copy / periodic), 1 = u component, 2 = v component
      function setBnd(b, x) {
        var i, j;
        if (periodic) {
          for (i = 1; i <= N; i++) { x[IX(i, 0)] = x[IX(i, N)]; x[IX(i, N + 1)] = x[IX(i, 1)]; }
          for (j = 0; j <= N + 1; j++) { x[IX(0, j)] = x[IX(N, j)]; x[IX(N + 1, j)] = x[IX(1, j)]; }
          return;
        }
        if (b === 0) {
          for (i = 1; i <= N; i++) {
            x[IX(0, i)] = x[IX(1, i)]; x[IX(N + 1, i)] = x[IX(N, i)];
            x[IX(i, 0)] = x[IX(i, 1)]; x[IX(i, N + 1)] = x[IX(i, N)];
          }
        } else {
          // no-slip: both components vanish on the walls; lid (top) has u = ULID
          for (i = 1; i <= N; i++) {
            x[IX(0, i)] = -x[IX(1, i)];
            x[IX(N + 1, i)] = -x[IX(N, i)];
            x[IX(i, 0)] = -x[IX(i, 1)];
            x[IX(i, N + 1)] = (b === 1 ? 2 * ULID : 0) - x[IX(i, N)];
          }
        }
        x[IX(0, 0)] = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)]);
        x[IX(0, N + 1)] = 0.5 * (x[IX(1, N + 1)] + x[IX(0, N)]);
        x[IX(N + 1, 0)] = 0.5 * (x[IX(N, 0)] + x[IX(N + 1, 1)]);
        x[IX(N + 1, N + 1)] = 0.5 * (x[IX(N, N + 1)] + x[IX(N + 1, N)]);
      }

      // Stam's lin_solve: lexicographic Gauss-Seidel, boundary refreshed after every sweep
      function linSolve(b, x, x0, a, c, n) {
        var ic = 1 / c, k, i, j, q;
        for (k = 0; k < n; k++) {
          for (j = 1; j <= N; j++) {
            q = IX(1, j);
            for (i = 1; i <= N; i++, q++) {
              x[q] = (x0[q] + a * (x[q - 1] + x[q + 1] + x[q - S] + x[q + S])) * ic;
            }
          }
          setBnd(b, x);
        }
      }

      function diffuse(b, x, x0) {
        var a = dt * nu / (h * h);
        linSolve(b, x, x0, a, 1 + 4 * a, iters);
      }

      function divergence(uu, vv) {   // central-difference divergence, interior cells; returns max |div|
        var m = 0, s2 = 0, i, j, q, d, inv2h = 0.5 / h;
        for (j = 1; j <= N; j++) {
          q = IX(1, j);
          for (i = 1; i <= N; i++, q++) {
            d = (uu[q + 1] - uu[q - 1] + vv[q + S] - vv[q - S]) * inv2h;
            if (d < 0) d = -d;
            if (d > m) m = d;
            s2 += d * d;
          }
        }
        divRms = Math.sqrt(s2 / (N * N));
        return m;
      }

      function project(uu, vv) {
        var i, j, q;
        for (j = 1; j <= N; j++) {
          q = IX(1, j);
          for (i = 1; i <= N; i++, q++) {
            div[q] = -0.5 * h * (uu[q + 1] - uu[q - 1] + vv[q + S] - vv[q - S]);
            p[q] = 0;
          }
        }
        setBnd(0, div); setBnd(0, p);
        linSolve(0, p, div, 1, 4, pIters);
        var i2h = 0.5 / h;
        for (j = 1; j <= N; j++) {
          q = IX(1, j);
          for (i = 1; i <= N; i++, q++) {
            uu[q] -= (p[q + 1] - p[q - 1]) * i2h;
            vv[q] -= (p[q + S] - p[q - S]) * i2h;
          }
        }
        setBnd(1, uu); setBnd(2, vv);
      }

      function advect(b, d, d0, uu, vv) {
        var dt0 = dt / h, i, j, q, x, y, i0, j0, s1, s0, t1, t0, lo = 0.5, hi = N + 0.5;
        for (j = 1; j <= N; j++) {
          q = IX(1, j);
          for (i = 1; i <= N; i++, q++) {
            x = i - dt0 * uu[q]; y = j - dt0 * vv[q];
            if (periodic) {
              x = x - lo; x -= N * Math.floor(x / N); x += lo; if (x >= hi) x -= N;
              y = y - lo; y -= N * Math.floor(y / N); y += lo; if (y >= hi) y -= N;
            } else {
              if (x < lo) x = lo; if (x > hi) x = hi;
              if (y < lo) y = lo; if (y > hi) y = hi;
            }
            i0 = Math.floor(x); j0 = Math.floor(y);
            if (i0 > N) i0 = N; if (j0 > N) j0 = N;
            s1 = x - i0; s0 = 1 - s1; t1 = y - j0; t0 = 1 - t1;
            d[q] = s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j0 + 1)]) +
                   s1 * (t0 * d0[IX(i0 + 1, j0)] + t1 * d0[IX(i0 + 1, j0 + 1)]);
          }
        }
        setBnd(b, d);
      }

      // ---- initial condition ----
      var uEx = null, vEx = null;
      if (periodic) {
        uEx = new Float64Array(NN); vEx = new Float64Array(NN);
        for (var jj = 1; jj <= N; jj++) for (var ii = 1; ii <= N; ii++) {
          var xc = (ii - 0.5) * h, yc = (jj - 0.5) * h, qq = IX(ii, jj);
          uEx[qq] = -Math.cos(xc) * Math.sin(yc);
          vEx[qq] = Math.sin(xc) * Math.cos(yc);
          u[qq] = uEx[qq]; v[qq] = vEx[qq];
        }
      }
      setBnd(1, u); setBnd(2, v);

      function kineticEnergy() {   // sum of ½|u|² over interior cells
        var s = 0, i, j, q;
        for (j = 1; j <= N; j++) { q = IX(1, j); for (i = 1; i <= N; i++, q++) s += 0.5 * (u[q] * u[q] + v[q] * v[q]); }
        return s;
      }
      ke0 = kineticEnergy() / (N * N);
      divAfter = divergence(u, v);

      function l2Error() {
        var f = Math.exp(-2 * nu * sim.t), e = 0, r = 0, i, j, q, du, dv, ue, ve;
        for (j = 1; j <= N; j++) {
          q = IX(1, j);
          for (i = 1; i <= N; i++, q++) {
            ue = uEx[q] * f; ve = vEx[q] * f;
            du = u[q] - ue; dv = v[q] - ve;
            e += du * du + dv * dv; r += ue * ue + ve * ve;
          }
        }
        return r > 0 ? Math.sqrt(e / r) : NaN;
      }

      function maxSpeed() {
        var m = 0, i, j, q, s;
        for (j = 1; j <= N; j++) { q = IX(1, j); for (i = 1; i <= N; i++, q++) { s = u[q] * u[q] + v[q] * v[q]; if (s > m) m = s; } }
        return Math.sqrt(m);
      }

      // stream function on cell corners (i, j) = (x = i h, y = j h), i, j = 0..N; psi = 0 on bottom wall
      var psi = periodic ? null : new Float64Array((N + 1) * (N + 1));
      function computePsi() {
        var M = N + 1, i, j;
        for (i = 0; i <= N; i++) {
          psi[i] = 0;
          for (j = 1; j <= N; j++) {
            // u on the vertical segment x = i h, y in [(j-1)h, j h]: average of cells i and i+1 in row j
            psi[j * M + i] = psi[(j - 1) * M + i] + h * 0.5 * (u[IX(i, j)] + u[IX(i + 1, j)]);
          }
        }
      }
      function psiMin() {
        computePsi();
        var M = N + 1, best = Infinity, bi = -1, bj = -1, i, j, k;
        for (j = 1; j < N; j++) for (i = 1; i < N; i++) {
          k = j * M + i;
          if (psi[k] < best) { best = psi[k]; bi = i; bj = j; }
        }
        if (bi < 0 || !(best < 0)) return null;
        function para(fm, f0, fp) {
          var den = fm - 2 * f0 + fp;
          if (!(den > 0)) return { off: 0, val: f0 };
          var off = 0.5 * (fm - fp) / den;
          if (off > 0.5) off = 0.5; if (off < -0.5) off = -0.5;
          return { off: off, val: f0 - 0.25 * (fm - fp) * off };
        }
        k = bj * M + bi;
        var px = para(psi[k - 1], psi[k], psi[k + 1]);
        var py = para(psi[k - M], psi[k], psi[k + M]);
        var val = best + (px.val - best) + (py.val - best);
        return { value: val, x: (bi + px.off) * h, y: (bj + py.off) * h };
      }

      function vorticityField(out) {   // central differences on interior cells
        var i, j, q, inv2h = 0.5 / h, k = 0;
        for (j = 1; j <= N; j++) {
          q = IX(1, j);
          for (i = 1; i <= N; i++, q++, k++) out[k] = (v[q + 1] - v[q - 1] - u[q + S] + u[q - S]) * inv2h;
        }
      }

      var sim = {
        t: 0, steps: 0, dt: dt,
        fields: ['speed', 'vorticity', 'pressure', 'u', 'v', 'divergence'],
        step: function () {
          dt = cfl * h / Uref;
          uPrev.set(u); vPrev.set(v);
          // vel_step: diffuse -> project -> advect -> project
          u0.set(u); v0.set(v);
          diffuse(1, u, u0); diffuse(2, v, v0);
          project(u, v);
          u0.set(u); v0.set(v);
          advect(1, u, u0, u0, v0); advect(2, v, v0, u0, v0);
          divBefore = divergence(u, v);
          project(u, v);
          divAfter = divergence(u, v);
          var m = 0, i, j, q, d;
          for (j = 1; j <= N; j++) {
            q = IX(1, j);
            for (i = 1; i <= N; i++, q++) {
              d = Math.abs(u[q] - uPrev[q]); if (d > m) m = d;
              d = Math.abs(v[q] - vPrev[q]); if (d > m) m = d;
            }
          }
          residual = m / dt;
          sim.dt = dt;
          sim.steps++;
          sim.t += dt;
        },
        setParam: function (key, value) {
          if (key === 'cfl') { cfl = +value; dt = cfl * h / Uref; sim.dt = dt; }
          else if (key === 'iters') iters = Math.max(1, Math.round(+value));
          else if (key === 'pIters') pIters = Math.max(1, Math.round(+value));
        },
        view: function (field) {
          field = field || 'speed';
          var n = N * N, data = new Float32Array(n), i, j, q, k = 0, lo, hi, cmap = 'diverging', a, mx;
          var amp = periodic ? Math.exp(-2 * nu * sim.t) : 1;
          if (field === 'vorticity') {
            var w = new Float64Array(n); vorticityField(w);
            for (k = 0; k < n; k++) data[k] = w[k];
            lo = periodic ? -2 * amp : -6; hi = -lo;
          } else if (field === 'pressure' || field === 'divergence') {
            mx = 1e-300;
            var inv2h = 0.5 / h;
            for (j = 1; j <= N; j++) {
              q = IX(1, j);
              for (i = 1; i <= N; i++, q++, k++) {
                a = field === 'pressure' ? p[q] / dt
                  : (u[q + 1] - u[q - 1] + v[q + S] - v[q - S]) * inv2h;
                data[k] = a; a = Math.abs(a); if (a > mx) mx = a;
              }
            }
            if (field === 'pressure') {   // remove mean for display
              var mean = 0; for (k = 0; k < n; k++) mean += data[k]; mean /= n;
              mx = 1e-300;
              for (k = 0; k < n; k++) { data[k] -= mean; a = Math.abs(data[k]); if (a > mx) mx = a; }
            }
            lo = -mx; hi = mx;
          } else {
            for (j = 1; j <= N; j++) {
              q = IX(1, j);
              for (i = 1; i <= N; i++, q++, k++) {
                if (field === 'u') data[k] = u[q];
                else if (field === 'v') data[k] = v[q];
                else data[k] = Math.sqrt(u[q] * u[q] + v[q] * v[q]);
              }
            }
            if (field === 'u' || field === 'v') { lo = -amp; hi = amp; if (!periodic && field === 'v') { lo = -0.6; hi = 0.6; } }
            else { lo = 0; hi = amp; cmap = 'sequential'; }
          }
          return { kind: 'field', nx: N, ny: N, data: data, range: [lo, hi], cmap: cmap, extent: [0, 0, L, L] };
        },
        metrics: function () {
          var M_ = LAB.util.metric, ke = kineticEnergy(), umax = maxSpeed();
          var mu = 0, mv = 0, i, j, q;
          for (j = 1; j <= N; j++) { q = IX(1, j); for (i = 1; i <= N; i++, q++) { mu += u[q]; mv += v[q]; } }
          var out = [
            M_('t', periodic ? 'time t (1/(k U0))' : 'time t (L/U)', sim.t, '', 'g'),
            M_('steps', 'steps', sim.steps, '', 'i'),
            M_('dt', 'time step dt', dt, '', 'e'),
            M_('umax', 'max |u|', umax, '', 'g'),
            M_('cfl', 'CFL max|u|·Δt/h', umax * dt / h, '', 'g'),
            M_('diffnum', 'diffusion number νΔt/h²', nu * dt / (h * h), '', 'g'),
            M_('div', 'max |∇·u| after projection', divAfter, '', 'e'),
            M_('divrms', 'rms ∇·u after projection', divRms, '', 'e'),
            M_('divpre', 'max |∇·u| before final projection', divBefore, '', 'e')
          ];
          if (periodic) {
            var kem = ke / (N * N);
            out.push(M_('ke', 'kinetic energy ⟨½|u|²⟩', kem, '', 'e'));
            out.push(M_('ke_ratio', 'KE / KE0', kem / ke0, '', 'g'));
            out.push(M_('l2', 'relative L2 velocity error', l2Error(), '', 'e'));
            out.push(M_('mom', 'mean momentum |⟨u⟩|+|⟨v⟩|', (Math.abs(mu) + Math.abs(mv)) / (N * N), '', 'e'));
          } else {
            var pm = psiMin();
            out.push(M_('ke', 'kinetic energy ∫½|u|² dA', ke * h * h, '', 'e'));
            out.push(M_('residual', 'max|Δu|/Δt', residual, '', 'e'));
            out.push(M_('psimin', 'ψ_min', pm ? pm.value : NaN, '', 'g'));
          }
          return out;
        },
        probe: function (name) {
          var i, j, a;
          if (periodic) {
            if (name === 'kinetic_energy') return kineticEnergy() / (N * N);
            if (name === 'l2_error') return l2Error();
            if (name === 'time') return sim.t;
            return null;
          }
          if (name === 'u_vcl') {
            // x = 0.5 lies at cell face between columns N/2 and N/2+1 (even N), or at centre of column (N+1)/2 (odd N)
            var ys = [0], us = [0];
            for (j = 1; j <= N; j++) {
              if (N % 2 === 0) a = 0.5 * (u[IX(N / 2, j)] + u[IX(N / 2 + 1, j)]);
              else a = u[IX((N + 1) / 2, j)];
              ys.push((j - 0.5) * h); us.push(a / ULID);
            }
            ys.push(1); us.push(1);
            return { y: ys, u: us };
          }
          if (name === 'v_hcl') {
            var xs = [0], vs = [0];
            for (i = 1; i <= N; i++) {
              if (N % 2 === 0) a = 0.5 * (v[IX(i, N / 2)] + v[IX(i, N / 2 + 1)]);
              else a = v[IX(i, (N + 1) / 2)];
              xs.push((i - 0.5) * h); vs.push(a / ULID);
            }
            xs.push(1); vs.push(0);
            return { x: xs, v: vs };
          }
          if (name === 'psi_min') { var pm = psiMin(); return pm ? pm.value : null; }
          if (name === 'vortex_center') { var c = psiMin(); return c ? { x: c.x, y: c.y } : null; }
          if (name === 'residual') return residual;
          if (name === 'time') return sim.t;
          return null;
        },
        diverged: function () {
          if (!LAB.util.finiteAll(u) || !LAB.util.finiteAll(v)) return true;
          return maxSpeed() > 1e3;
        }
      };
      return sim;
    }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
