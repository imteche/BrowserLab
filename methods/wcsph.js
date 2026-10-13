/* Weakly compressible SPH (WCSPH): Tait EOS, continuity density, Monaghan artificial viscosity
 * (dam break) or Morris-type laminar viscosity (Taylor-Green), cubic-spline kernel, two-stage
 * kick-drift predictor-corrector time integration with acoustic / force / viscous step limits.
 * Metadata from research/ptc.json (method id 'wcsph'). See docs/CONTRACTS.md §4. */
(function (LAB) {
  'use strict';

  var GAMMA = 7;            // Tait exponent (pysph-dbexp, pysph-wcsph)
  var TWO_PI = 2 * Math.PI;

  LAB.registerMethod({
    id: 'wcsph',
    name: 'Weakly compressible SPH (Tait EOS, Monaghan artificial viscosity)',
    family: 'particle',
    summary: 'The fluid is a set of particles of equal mass that move with the flow. Each particle ' +
      'carries a density that changes by the SPH continuity equation, and its pressure comes from ' +
      'a stiff Tait equation of state. The sound speed is set at least 10 times the largest flow ' +
      'speed, so density varies by about 1% and the fluid behaves as nearly incompressible. Forces ' +
      'come from symmetric pairwise pressure gradients, smoothed with a cubic-spline kernel over ' +
      'neighbours within two smoothing lengths. In the dam break, Monaghan artificial viscosity ' +
      'damps the flow and layers of fixed "dynamic" boundary particles form the tank walls. ' +
      'In the periodic Taylor-Green box, a Morris-type laminar operator supplies the physical ' +
      'viscosity nu = 1/Re. The time step is explicit and adapts each step to acoustic, force and ' +
      'viscous limits.',
    sources: ['monaghan1994', 'becker2007', 'monaghan2005', 'pysph-wcsph', 'gomezgesteira2010', 'pysph-dbexp', 'splishsplash'],
    equations: [
      { label: 'Density summation', tex: '\\rho_a = \\sum_b m_b W(\\mathbf{r}_a-\\mathbf{r}_b, h)',
        source: 'monaghan2005', location: 'standard SPH summation (form not verified against text)', verified: false },
      { label: 'Continuity (alternative to summation; used by PySPH WCSPH)',
        tex: '\\frac{d\\rho_a}{dt} = \\sum_b m_b\\, \\mathbf{v}_{ab}\\cdot\\nabla_a W_{ab}',
        source: 'pysph-wcsph', location: 'pysph/sph/basic_equations.py ContinuityEquation docstring', verified: true },
      { label: 'Tait equation of state',
        tex: 'p_a = \\frac{c_0^2\\rho_0}{\\gamma}\\left[\\left(\\frac{\\rho_a}{\\rho_0}\\right)^{\\gamma}-1\\right],\\ \\gamma=7',
        source: 'pysph-wcsph', location: 'pysph/sph/wc/basic.py TaitEOS docstring (cites Cole 1948, Batchelor, Monaghan 2005); same form in splishsplash TimeStepWCSPH.cpp l.106 with stiffness k=B', verified: true },
      { label: 'Momentum with artificial viscosity',
        tex: '\\frac{d\\mathbf{v}_a}{dt} = -\\sum_b m_b\\left(\\frac{p_b}{\\rho_b^2}+\\frac{p_a}{\\rho_a^2}+\\Pi_{ab}\\right)\\nabla_a W_{ab} + \\mathbf{g}',
        source: 'pysph-wcsph', location: 'pysph/sph/wc/basic.py MomentumEquation docstring (cites Monaghan 1992)', verified: true },
      { label: 'Monaghan artificial viscosity',
        tex: '\\Pi_{ab}=\\begin{cases}\\frac{-\\alpha\\bar c_{ab}\\mu_{ab}+\\beta\\mu_{ab}^2}{\\bar\\rho_{ab}} & \\mathbf{v}_{ab}\\cdot\\mathbf{r}_{ab}<0\\\\0&\\text{otherwise}\\end{cases},\\quad \\mu_{ab}=\\frac{h\\,\\mathbf{v}_{ab}\\cdot\\mathbf{r}_{ab}}{r_{ab}^2+\\eta^2}',
        source: 'pysph-wcsph', location: 'pysph/sph/wc/basic.py MomentumEquation docstring; eta^2 ~ 0.01h^2 conventional (not verified)', verified: true },
      { label: 'XSPH position update (optional)',
        tex: '\\frac{d\\mathbf{r}_a}{dt}=\\mathbf{v}_a-\\epsilon\\sum_b m_b\\frac{\\mathbf{v}_{ab}}{\\bar\\rho_{ab}}W_{ab},\\ \\epsilon=0.5\\text{ (PySPH default)}',
        source: 'pysph-wcsph', location: 'pysph/sph/basic_equations.py XSPHCorrection docstring and default eps=0.5', verified: true },
      { label: 'Cubic spline kernel (2D)',
        tex: 'W(q)=\\frac{10}{7\\pi h^2}\\begin{cases}1-\\tfrac32q^2+\\tfrac34q^3&0\\le q<1\\\\ \\tfrac14(2-q)^3&1\\le q<2\\\\0&q\\ge2\\end{cases},\\ q=r/h',
        source: 'monaghan2005', location: 'standard M4 cubic spline; not verified against text in this session', verified: false },
      { label: 'Sound-speed / compressibility condition',
        tex: '\\frac{|\\Delta\\rho|}{\\rho_0}\\sim\\frac{|\\mathbf{v}|^2}{c_s^2}\\le\\eta=0.01\\ \\Rightarrow\\ c_s\\ge10\\,v_{max}',
        source: 'becker2007', location: 'Sec. on Tait EOS (search snippet; equation number unverified)', verified: false }
    ],
    assumptions: [
      'Fluid treated as slightly compressible; density error ~ Ma^2 must stay <~1% (Ma = v_max/c0 <= 0.1)',
      'Inviscid in the dam-break benchmark; artificial viscosity supplies dissipation and stability',
      'Free surface needs no explicit BC (pressure clamped >= 0 or negative pressures allowed per scheme); summation density underestimates near surface',
      'Equal particle masses m = rho0 * dx^2 (2D)',
      'Implementation choice: density is evolved with the continuity equation (not summation), as in PySPH WCSPH; fluid pressures may be negative, wall-particle pressures are clamped at >= 0 and wall densities at >= rho0 (builder choice, common for dynamic boundary particles)',
      'Implementation choice: cubic-spline kernel with h = 1.3 dx (PySPH dam_break_2d uses hdx = 1.3 with a Wendland quintic kernel; the kernel swap is the builder\'s)',
      'Taylor-Green only: physical viscosity nu = 1/Re through the Morris et al. (1997) laminar operator a_a += sum_b m_b nu (rho_a+rho_b)/(rho_a rho_b) (r_ab . grad_a W_ab)/(r_ab^2 + 0.01h^2) v_ab. This operator is not in the research extraction and has no registered source; its form is from the builder\'s knowledge (unverified)',
      'Time integration (builder choice): two-stage kick-drift predictor-corrector (midpoint): forces at t^n give the half state, forces at the half state advance the full step; two force evaluations per step'
    ],
    stability: 'c0 >= 10 Umax (Umax ~ sqrt(2 g H) for dam break; pysph-dbexp c0 = 10 sqrt(2 g H)), becker2007 (snippet). ' +
      'Adaptive dt = min(C_cfl h/(c0 + |v|max), 0.25 sqrt(h/|a|max), 0.125 h^2/nu): acoustic CFL as in pysph-dbexp (dt = 0.125 h/c0, ' +
      'default C_cfl = 0.125 for dam break) and pysph-tg (0.25 h/(c0+U), 0.125 h^2/nu, default C_cfl = 0.25 for Taylor-Green); ' +
      'force condition 0.25 sqrt(h/|f|max) attributed to Becker & Teschner via secondary source (unverified).',
    scenes: {
      'dam-break': {
        params: [
          { key: 'a', label: 'Column width a (m)', min: 0.02, max: 5, step: 0.01, value: 1, live: false },
          { key: 'g', label: 'Gravity g (m/s²)', min: 0.5, max: 30, step: 0.01, value: 9.81, live: false },
          { key: 'N', label: 'Particles across column width', min: 10, max: 100, step: 2, value: 30, live: false },
          { key: 'Lx', label: 'Tank length / a', min: 2, max: 12, step: 0.5, value: 5, live: false },
          { key: 'hdx', label: 'Smoothing length h / dx', min: 1, max: 2, step: 0.05, value: 1.3, live: false },
          { key: 'cfac', label: 'Sound speed c0 / √(2g·2a)', min: 5, max: 40, step: 1, value: 10, live: false },
          { key: 'alpha', label: 'Artificial viscosity α', min: 0, max: 1, step: 0.01, value: 0.1, live: true },
          { key: 'xsph', label: 'XSPH ε', min: 0, max: 1, step: 0.05, value: 0.5, live: true },
          { key: 'cfl', label: 'Acoustic Courant number', min: 0.02, max: 0.4, step: 0.005, value: 0.125, live: true }
        ],
        notes: 'Column a wide, 2a high, against the left wall (x = 0) of a tank Lx·a long with walls 4a high; floor at y = 0. ' +
          'Fluid particles on a square lattice of spacing dx = a/N, initial density hydrostatic through the inverse Tait EOS. ' +
          'Walls: ceil(2h/dx) >= 3 layers (3 at the default h = 1.3dx) of fixed dynamic boundary particles (Gomez-Gesteira 2010 style, as in PySPH dam_break_2d which uses two ' +
          'layers with its shorter-support kernel) whose density follows the continuity equation. rho0 = 1000 kg/m³, gamma = 7, beta = 0, ' +
          'eta² = 0.01h². Probes: front = max x of fluid-particle centres that have >= 4 neighbours within the kernel support (from the ' +
          'latest force evaluation), so isolated spray droplets are ignored; column_height = max y of fluid-particle centres with x < 2dx ' +
          '(same neighbour filter); totals per unit depth: mass (kg/m), ke and pe = sum m g y (J/m). sim.t is physical seconds; ' +
          'Z = front/a, T = t sqrt(2g/a). Particle centres, not surfaces, are measured (offset up to dx/2). Particles that splash over ' +
          'the 4a walls are not removed.'
      },
      'taylor-green': {
        params: [
          { key: 'Re', label: 'Reynolds number', min: 10, max: 1000, step: 10, value: 100, live: false },
          { key: 'N', label: 'Particles per side', min: 16, max: 140, step: 2, value: 40, live: false },
          { key: 'perturb', label: 'Initial lattice perturbation / dx', min: 0, max: 0.3, step: 0.01, value: 0.2, live: false },
          { key: 'hdx', label: 'Smoothing length h / dx', min: 1, max: 2, step: 0.05, value: 1.3, live: false },
          { key: 'cfac', label: 'Sound speed c0 / U0', min: 5, max: 40, step: 1, value: 10, live: false },
          { key: 'cfl', label: 'Acoustic Courant number', min: 0.02, max: 0.4, step: 0.005, value: 0.25, live: true }
        ],
        notes: 'Periodic box [0, 2π]², U0 = 1, k = 1, rho0 = 1, nu = 1/Re. Particles start on a square lattice at cell centres, ' +
          'each displaced by a deterministic uniform random offset of at most perturb·dx in x and y (default dx/5, the perturbation ' +
          'used for TG in ramachandran2019edac; perturb = 0 gives the unperturbed lattice of pysph-tg). In this builder\'s smoke runs ' +
          'the unperturbed lattice disorders abruptly near t ≈ 0.6 (velocity noise, fast KE loss), independent of dt and resolution. ' +
          'Velocity is the analytic field at the particle position and density follows the analytic pressure through the inverse ' +
          'Tait EOS. No artificial ' +
          'viscosity; physical viscosity via the Morris-type laminar operator (see assumptions). kinetic_energy = mean over particles of ' +
          '½|v|² (equal masses, so the mass-weighted domain mean; 0.25 at t = 0); l2_error = sqrt(Σ|v − v_exact(x_p, t)|² / Σ|v_exact(x_p, t)|²) ' +
          'over particles at their current positions. Research notes (ptc.json) that standard WCSPH on an unperturbed lattice is the least ' +
          'accurate SPH scheme on this problem and does not converge with resolution.'
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'dam-break' && sceneId !== 'taylor-green') throw new Error('wcsph supports dam-break and taylor-green');
      var isDam = sceneId === 'dam-break';
      var hdx = +params.hdx || 1.3;

      /* ---------------- setup ---------------- */
      var rho0, c0, B, g, a, dx, h, nf, nw, n, Lper = 0, nu = 0, alpha = 0, eps = 0, cfl = +params.cfl;
      var Lx = 0, Hw = 0, Hcol = 0, nLay = 0;
      var px = [], py = [], pvx = [], pvy = [], prho = [];

      if (isDam) {
        a = +params.a; g = +params.g;
        var N = Math.max(4, Math.round(+params.N));
        Lx = Math.max(1.5, +params.Lx) * a; Hcol = 2 * a; Hw = 4 * a;
        dx = a / N; h = hdx * dx; rho0 = 1000;
        c0 = +params.cfac * Math.sqrt(2 * g * Hcol);
        B = c0 * c0 * rho0 / GAMMA;
        alpha = +params.alpha; eps = +params.xsph;
        var rhoHydro = function (y) {
          var p = rho0 * g * Math.max(0, Hcol - y);
          return rho0 * Math.pow(1 + p / B, 1 / GAMMA);
        };
        var i, j, k;
        for (j = 0; j < 2 * N; j++) {
          for (i = 0; i < N; i++) {
            var xx = (i + 0.5) * dx, yy = (j + 0.5) * dx;
            px.push(xx); py.push(yy); pvx.push(0); pvy.push(0); prho.push(rhoHydro(yy));
          }
        }
        nf = px.length;
        nLay = Math.max(3, Math.ceil(2 * hdx));   // wall thickness >= kernel support
        var nxw = Math.round(Lx / dx), nyw = Math.round(Hw / dx);
        var addWall = function (xx, yy) {
          px.push(xx); py.push(yy); pvx.push(0); pvy.push(0);
          prho.push(xx <= a + 3 * dx ? rhoHydro(yy) : rho0);
        };
        for (k = 0; k < nLay; k++) {
          // floor (extends under the side walls to close the corners)
          for (i = -nLay; i < nxw + nLay; i++) addWall((i + 0.5) * dx, -(k + 0.5) * dx);
          // left and right walls
          for (j = 0; j < nyw; j++) {
            addWall(-(k + 0.5) * dx, (j + 0.5) * dx);
            addWall(Lx + (k + 0.5) * dx, (j + 0.5) * dx);
          }
        }
        n = px.length; nw = n - nf;
      } else {
        var Re = +params.Re;
        nu = 1 / Re; g = 0; alpha = 0; eps = 0;
        var Np = Math.max(8, Math.round(+params.N));
        Lper = TWO_PI; dx = Lper / Np; h = hdx * dx; rho0 = 1;
        c0 = +params.cfac * 1.0;
        B = c0 * c0 * rho0 / GAMMA;
        var pert = Math.max(0, +params.perturb || 0) * dx, rnd = LAB.util.rng(12345);
        for (var jj = 0; jj < Np; jj++) {
          for (var ii = 0; ii < Np; ii++) {
            var x0 = (ii + 0.5) * dx, y0 = (jj + 0.5) * dx;
            if (pert > 0) { x0 += pert * (2 * rnd() - 1); y0 += pert * (2 * rnd() - 1); }
            px.push(x0); py.push(y0);
            pvx.push(-Math.cos(x0) * Math.sin(y0)); pvy.push(Math.sin(x0) * Math.cos(y0));
            var pex = -0.25 * rho0 * (Math.cos(2 * x0) + Math.cos(2 * y0));
            prho.push(rho0 * Math.pow(1 + pex / B, 1 / GAMMA));
          }
        }
        nf = px.length; nw = 0; n = nf;
      }

      var m = rho0 * dx * dx;
      var supp = 2 * h, supp2 = supp * supp, eta2 = 0.01 * h * h;
      var sigma = 10 / (7 * Math.PI * h * h);

      var x = Float64Array.from(px), y = Float64Array.from(py);
      var vx = Float64Array.from(pvx), vy = Float64Array.from(pvy), rho = Float64Array.from(prho);
      var bx = new Float64Array(n), by = new Float64Array(n), bvx = new Float64Array(n), bvy = new Float64Array(n), brho = new Float64Array(n);
      var ax = new Float64Array(n), ay = new Float64Array(n), D = new Float64Array(n);
      var xsx = new Float64Array(n), xsy = new Float64Array(n), p = new Float64Array(n), om = new Float64Array(n);
      var nnb = new Int32Array(n);

      /* ---------------- cell list ---------------- */
      var cx0, cy0, ncx, ncy, csx, csy;
      if (isDam) {
        cx0 = -(nLay + 1) * dx; cy0 = -(nLay + 1) * dx;
        csx = csy = supp;
        ncx = Math.max(1, Math.ceil((Lx + 2 * (nLay + 1) * dx) / supp));
        ncy = Math.max(1, Math.ceil((Hw + 2 * (nLay + 1) * dx) / supp));
      } else {
        cx0 = 0; cy0 = 0;
        ncx = ncy = Math.max(3, Math.floor(Lper / supp));
        csx = csy = Lper / ncx;
      }
      var ncell = ncx * ncy;
      var cstart = new Int32Array(ncell + 1), cfill = new Int32Array(ncell), citems = new Int32Array(n), cof = new Int32Array(n);

      function buildCells() {
        cstart.fill(0);
        for (var q = 0; q < n; q++) {
          var ci = Math.floor((x[q] - cx0) / csx), cj = Math.floor((y[q] - cy0) / csy);
          if (isDam) {
            ci = ci < 0 ? 0 : ci >= ncx ? ncx - 1 : ci; cj = cj < 0 ? 0 : cj >= ncy ? ncy - 1 : cj;
          } else {
            ci = ((ci % ncx) + ncx) % ncx; cj = ((cj % ncy) + ncy) % ncy;
          }
          var c = cj * ncx + ci; cof[q] = c; cstart[c + 1]++;
        }
        for (var c2 = 0; c2 < ncell; c2++) cstart[c2 + 1] += cstart[c2];
        for (var c3 = 0; c3 < ncell; c3++) cfill[c3] = cstart[c3];
        for (var q2 = 0; q2 < n; q2++) citems[cfill[cof[q2]]++] = q2;
      }

      function wrap() {
        if (isDam) return;
        for (var q = 0; q < n; q++) {
          if (x[q] < 0) x[q] += Lper; else if (x[q] >= Lper) x[q] -= Lper;
          if (y[q] < 0) y[q] += Lper; else if (y[q] >= Lper) y[q] -= Lper;
          if (x[q] >= Lper || x[q] < 0) x[q] -= Lper * Math.floor(x[q] / Lper);
          if (y[q] >= Lper || y[q] < 0) y[q] -= Lper * Math.floor(y[q] / Lper);
        }
      }

      /* ---------------- right-hand side ---------------- */
      var vmaxLast = 0, amaxLast = 0;
      function evaluate() {
        var q;
        for (q = 0; q < n; q++) {
          var pr = B * (Math.pow(rho[q] / rho0, GAMMA) - 1);
          if (q >= nf && pr < 0) pr = 0;
          p[q] = pr;
          ax[q] = 0; ay[q] = 0; D[q] = 0; xsx[q] = 0; xsy[q] = 0; om[q] = 0; nnb[q] = 0;
        }
        buildCells();
        var invh = 1 / h, Lh = 0.5 * Lper;
        for (var i = 0; i < n; i++) {
          var iFluid = i < nf;
          var xi = x[i], yi = y[i], vxi = vx[i], vyi = vy[i], ri = rho[i], pi_ = p[i] / (ri * ri);
          var ci = cof[i] % ncx, cj = (cof[i] - ci) / ncx;
          for (var dj = -1; dj <= 1; dj++) {
            var cjj = cj + dj;
            if (isDam) { if (cjj < 0 || cjj >= ncy) continue; } else cjj = (cjj + ncy) % ncy;
            for (var di = -1; di <= 1; di++) {
              var cii = ci + di;
              if (isDam) { if (cii < 0 || cii >= ncx) continue; } else cii = (cii + ncx) % ncx;
              var c = cjj * ncx + cii, kEnd = cstart[c + 1];
              for (var kk = cstart[c]; kk < kEnd; kk++) {
                var jn = citems[kk];
                if (jn <= i) continue;
                var jFluid = jn < nf;
                if (!iFluid && !jFluid) continue;
                var rx = xi - x[jn], ry = yi - y[jn];
                if (!isDam) {
                  if (rx > Lh) rx -= Lper; else if (rx < -Lh) rx += Lper;
                  if (ry > Lh) ry -= Lper; else if (ry < -Lh) ry += Lper;
                }
                var r2 = rx * rx + ry * ry;
                if (r2 >= supp2 || r2 < 1e-24 * supp2) continue;
                var r = Math.sqrt(r2), qq = r * invh, W, dW;
                if (qq < 1) { W = sigma * (1 - 1.5 * qq * qq + 0.75 * qq * qq * qq); dW = sigma * invh * (-3 * qq + 2.25 * qq * qq); }
                else { var t2 = 2 - qq; W = sigma * 0.25 * t2 * t2 * t2; dW = -sigma * invh * 0.75 * t2 * t2; }
                var gx = dW * rx / r, gy = dW * ry / r;           // grad_i W_ij
                var vxij = vxi - vx[jn], vyij = vyi - vy[jn];
                var rj = rho[jn];
                var vg = vxij * gx + vyij * gy;
                D[i] += m * vg; D[jn] += m * vg;
                nnb[i]++; nnb[jn]++;
                var pij = pi_ + p[jn] / (rj * rj);
                if (alpha > 0) {
                  var vr = vxij * rx + vyij * ry;
                  if (vr < 0) { var mu = h * vr / (r2 + eta2); pij += -alpha * c0 * mu / (0.5 * (ri + rj)); }
                }
                var fx = -m * pij * gx, fy = -m * pij * gy;
                if (nu > 0) {
                  var coef = m * nu * (ri + rj) / (ri * rj) * (rx * gx + ry * gy) / (r2 + eta2);
                  fx += coef * vxij; fy += coef * vyij;
                }
                if (iFluid) { ax[i] += fx; ay[i] += fy; }
                if (jFluid) { ax[jn] -= fx; ay[jn] -= fy; }
                if (eps > 0 && iFluid && jFluid) {
                  var wv = eps * m * W / (0.5 * (ri + rj));
                  xsx[i] -= wv * vxij; xsy[i] -= wv * vyij; xsx[jn] += wv * vxij; xsy[jn] += wv * vyij;
                }
                var wz = -vyij * gx + vxij * gy;
                om[i] += (m / rj) * wz; om[jn] += (m / ri) * wz;
              }
            }
          }
        }
        var vmax = 0, amax = 0;
        for (q = 0; q < nf; q++) {
          ay[q] -= g;
          var v2 = vx[q] * vx[q] + vy[q] * vy[q]; if (v2 > vmax) vmax = v2;
          var a2 = ax[q] * ax[q] + ay[q] * ay[q]; if (a2 > amax) amax = a2;
        }
        vmaxLast = Math.sqrt(vmax); amaxLast = Math.sqrt(amax);
      }

      function chooseDt() {
        var dt = cfl * h / (c0 + vmaxLast);
        if (amaxLast > 0) dt = Math.min(dt, 0.25 * Math.sqrt(h / amaxLast));
        if (nu > 0) dt = Math.min(dt, 0.125 * h * h / nu);
        return dt;
      }

      /* ---------------- diagnostics ---------------- */
      function kinetic() { var s = 0; for (var q = 0; q < nf; q++) s += 0.5 * m * (vx[q] * vx[q] + vy[q] * vy[q]); return s; }
      function potential() { var s = 0; for (var q = 0; q < nf; q++) s += m * g * y[q]; return s; }
      function vmaxNow() { var s = 0; for (var q = 0; q < nf; q++) { var v2 = vx[q] * vx[q] + vy[q] * vy[q]; if (v2 > s) s = v2; } return Math.sqrt(s); }
      function densErr() { var s = 0; for (var q = 0; q < nf; q++) { var e = Math.abs(rho[q] / rho0 - 1); if (e > s) s = e; } return s; }
      var NNB_MIN = 4;
      function front() {
        var f = -Infinity;
        for (var q = 0; q < nf; q++) if (nnb[q] >= NNB_MIN && x[q] > f) f = x[q];
        return isFinite(f) ? f : null;
      }
      function columnHeight() {
        var hgt = 0;
        for (var q = 0; q < nf; q++) if (x[q] < 2 * dx && nnb[q] >= NNB_MIN && y[q] > hgt) hgt = y[q];
        return hgt;
      }
      function tgKE() { var s = 0; for (var q = 0; q < nf; q++) s += 0.5 * (vx[q] * vx[q] + vy[q] * vy[q]); return s / nf; }
      function tgL2(t) {
        var F = Math.exp(-2 * nu * t), e2 = 0, r2 = 0;
        for (var q = 0; q < nf; q++) {
          var ue = -Math.cos(x[q]) * Math.sin(y[q]) * F, ve = Math.sin(x[q]) * Math.cos(y[q]) * F;
          var du = vx[q] - ue, dv = vy[q] - ve;
          e2 += du * du + dv * dv; r2 += ue * ue + ve * ve;
        }
        return r2 > 0 ? Math.sqrt(e2 / r2) : NaN;
      }
      function momentum() { var sx = 0, sy = 0; for (var q = 0; q < nf; q++) { sx += m * vx[q]; sy += m * vy[q]; } return [sx, sy]; }
      function meanDiv() { var s = 0; for (var q = 0; q < nf; q++) s += Math.abs(D[q] / rho[q]); return s / nf; }

      evaluate();
      var mass0 = m * nf;
      var E0 = isDam ? kinetic() + potential() : tgKE();
      var lastDt = chooseDt();

      /* ---------------- step ---------------- */
      function step() {
        evaluate();                         // derivatives at t^n
        var dt = chooseDt(), hdt = 0.5 * dt, q;
        bx.set(x); by.set(y); bvx.set(vx); bvy.set(vy); brho.set(rho);
        for (q = 0; q < nf; q++) {
          x[q] = bx[q] + hdt * (bvx[q] + xsx[q]); y[q] = by[q] + hdt * (bvy[q] + xsy[q]);
          vx[q] = bvx[q] + hdt * ax[q]; vy[q] = bvy[q] + hdt * ay[q];
        }
        for (q = 0; q < n; q++) { rho[q] = brho[q] + hdt * D[q]; if (q >= nf && rho[q] < rho0) rho[q] = rho0; }
        wrap();
        evaluate();                         // derivatives at the half state
        for (q = 0; q < nf; q++) {
          var nvx = bvx[q] + dt * ax[q], nvy = bvy[q] + dt * ay[q];
          x[q] = bx[q] + dt * (0.5 * (bvx[q] + nvx) + xsx[q]);
          y[q] = by[q] + dt * (0.5 * (bvy[q] + nvy) + xsy[q]);
          vx[q] = nvx; vy[q] = nvy;
        }
        for (q = 0; q < n; q++) { rho[q] = brho[q] + dt * D[q]; if (q >= nf && rho[q] < rho0) rho[q] = rho0; }
        wrap();
        lastDt = dt;
        sim.dt = dt;
        sim.t += dt;
        sim.steps++;
      }

      /* ---------------- view ---------------- */
      var fx32 = new Float32Array(nf), fy32 = new Float32Array(nf), fv32 = new Float32Array(nf);
      var Uref = isDam ? Math.sqrt(2 * g * Hcol) : 1;
      function view(field) {
        field = field || sim.fields[0];
        var q, lo = 0, hi = 1, amx = 0;
        for (q = 0; q < nf; q++) { fx32[q] = x[q]; fy32[q] = y[q]; }
        if (field === 'pressure') {
          for (q = 0; q < nf; q++) fv32[q] = p[q];
          if (isDam) { lo = 0; hi = rho0 * g * Hcol; } else { lo = -0.5; hi = 0.5; }
        } else if (field === 'density') {
          for (q = 0; q < nf; q++) fv32[q] = rho[q] / rho0;
          lo = 0.99; hi = 1.01;
        } else if (field === 'vorticity') {
          for (q = 0; q < nf; q++) { fv32[q] = om[q]; var aa = Math.abs(om[q]); if (aa > amx) amx = aa; }
          if (isDam) { hi = amx > 0 ? amx : 1; lo = -hi; } else { lo = -2; hi = 2; }
        } else {
          for (q = 0; q < nf; q++) fv32[q] = Math.sqrt(vx[q] * vx[q] + vy[q] * vy[q]);
          lo = 0; hi = Uref;
        }
        var d = { kind: 'particles', n: nf, x: fx32, y: fy32, value: fv32, range: [lo, hi] };
        if (isDam) {
          d.extent = [-0.1 * a, -0.1 * a, Lx + 0.1 * a, Hw + 0.1 * a];
          d.walls = [[0, 0, 0, Hw], [0, 0, Lx, 0], [Lx, 0, Lx, Hw]];
        } else {
          d.extent = [0, 0, Lper, Lper];
        }
        return d;
      }

      /* ---------------- sim object ---------------- */
      var M = LAB.util.metric;
      var sim = {
        t: 0, steps: 0, dt: lastDt,
        fields: isDam ? ['speed', 'pressure', 'density', 'vorticity'] : ['speed', 'vorticity', 'pressure', 'density'],
        step: step,
        setParam: function (key, value) {
          value = +value;
          if (key === 'cfl') cfl = value;
          else if (key === 'alpha' && isDam) alpha = value;
          else if (key === 'xsph' && isDam) eps = value;
        },
        view: view,
        metrics: function () {
          var vm = vmaxNow(), out = [
            M('t', 'time t', sim.t, isDam ? 's' : '', 'g'),
            M('steps', 'steps', sim.steps, '', 'i'),
            M('dt', 'time step dt', sim.dt, isDam ? 's' : '', 'e'),
            M('nf', 'fluid particles', nf, '', 'i'),
            M('nw', 'wall particles', nw, '', 'i')
          ];
          if (isDam) {
            var ke = kinetic(), pe = potential(), fr = front();
            out.push(M('T', 'T = t√(2g/a)', sim.t * Math.sqrt(2 * g / a), '', 'g'));
            out.push(M('Z', 'front Z = x/a', fr == null ? NaN : fr / a, '', 'g'));
            out.push(M('Hcol', 'column height / 2a', columnHeight() / Hcol, '', 'g'));
            out.push(M('mass', 'fluid mass (per m depth)', m * nf, 'kg/m', 'g'));
            out.push(M('dmass', 'mass drift', Math.abs(m * nf - mass0) / mass0, '', 'e'));
            out.push(M('ke', 'kinetic energy', ke, 'J/m', 'g'));
            out.push(M('pe', 'potential energy', pe, 'J/m', 'g'));
            out.push(M('Erel', '(KE+PE)/E0', (ke + pe) / E0, '', 'g'));
          } else {
            var ke2 = tgKE(), P = momentum();
            out.push(M('ke', 'kinetic energy ⟨½|u|²⟩', ke2, '', 'e'));
            out.push(M('keRel', 'KE / KE0', ke2 / E0, '', 'g'));
            out.push(M('l2', 'rel. L2 velocity error', tgL2(sim.t), '', 'e'));
            out.push(M('mom', '|total momentum|', Math.sqrt(P[0] * P[0] + P[1] * P[1]), '', 'e'));
            out.push(M('div', 'mean |∇·u| (SPH)', meanDiv(), '', 'e'));
          }
          out.push(M('vmax', 'max |v|', vm, isDam ? 'm/s' : '', 'g'));
          out.push(M('mach', 'Mach max|v|/c0', vm / c0, '', 'g'));
          out.push(M('drho', 'max |ρ/ρ0 − 1|', densErr(), '', 'e'));
          out.push(M('cfl', 'acoustic CFL dt(c0+|v|)/h', sim.dt * (c0 + vm) / h, '', 'g'));
          return out;
        },
        probe: function (name) {
          if (isDam) {
            if (name === 'front') return front();
            if (name === 'totals') return { mass: m * nf, ke: kinetic(), pe: potential() };
            if (name === 'column_height') return columnHeight();
            if (name === 'time') return sim.t;
            return null;
          }
          if (name === 'kinetic_energy') return tgKE();
          if (name === 'l2_error') return tgL2(sim.t);
          if (name === 'time') return sim.t;
          return null;
        },
        diverged: function () {
          if (!LAB.util.finiteAll(vx) || !LAB.util.finiteAll(vy) || !LAB.util.finiteAll(rho) ||
              !LAB.util.finiteAll(x) || !LAB.util.finiteAll(y)) return true;
          if (vmaxNow() > c0) return true;
          return densErr() > 0.5;
        }
      };
      return sim;
    }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
