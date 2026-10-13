/* Position Based Fluids (Macklin & Mueller 2013) for the dam-break scene.
 * Metadata from research/ptc.json (method id 'pbf'). See docs/CONTRACTS.md §4.
 *
 * Units: SI (m, s, kg; 2D quantities are per metre of depth). sim.t is physical time [s].
 * Per step: predict x* = x + dt v + dt^2 g; neighbour search once (LAB.util.SpatialHash);
 * N Jacobi iterations of the density constraint (lambda with CFM relaxation epsilon, s_corr
 * tensile term, analytic wall density/gradient, box clamp); v = (x* - x)/dt; optional vorticity
 * confinement; XSPH viscosity; x = x*. */
(function (LAB) {
  'use strict';

  var PI = Math.PI;

  LAB.registerMethod({
    id: 'pbf',
    name: 'Position Based Fluids (Macklin & Müller 2013)',
    family: 'particle',
    summary: 'Position Based Fluids treats incompressibility as a set of position constraints, one per ' +
      'particle: C_i = rho_i/rho0 - 1 = 0. Each step first predicts positions from velocity and gravity. ' +
      'It then runs a few Jacobi iterations, each computing a Lagrange multiplier lambda_i per particle ' +
      '(softened by a relaxation epsilon) and moving particles along the constraint gradients. A short-range ' +
      'artificial-pressure term s_corr keeps particles from clumping. Velocities are then recovered from the ' +
      'position change, smoothed with XSPH viscosity, and optionally re-energised with vorticity confinement ' +
      '(off by default). The method is stable at large time steps. It is a computer-graphics method designed ' +
      'for visual plausibility, not physical accuracy: there is no sound speed or physical viscosity, ' +
      'the constraints are not solved to convergence, so some density error remains, and XSPH and the ' +
      'first-order velocity update add numerical damping. No published quantitative dam-break validation of ' +
      'PBF was found by the research step.',
    sources: ['macklin2013', 'splishsplash', 'taichi-pbf2d'],
    equations: [
      { label: 'Density constraint',
        tex: 'C_i(\\mathbf{p}_1..\\mathbf{p}_n)=\\frac{\\rho_i}{\\rho_0}-1,\\quad \\rho_i=\\sum_j m_j W_{\\text{poly6}}(\\mathbf{p}_i-\\mathbf{p}_j,h)',
        source: 'macklin2013', location: "Sec. 3 'Enforcing incompressibility' (search snippet; eq. no. unverified)" },
      { label: 'Constraint gradient',
        tex: '\\nabla_{\\mathbf{p}_k}C_i=\\frac{1}{\\rho_0}\\begin{cases}\\sum_j\\nabla_{\\mathbf{p}_k}W(\\mathbf{p}_i-\\mathbf{p}_j,h)&k=i\\\\-\\nabla_{\\mathbf{p}_k}W(\\mathbf{p}_i-\\mathbf{p}_k,h)&k=j\\end{cases}',
        source: 'taichi-pbf2d', location: 'pbf2d.py substep: grad_i / grad_j accumulation with spiky gradient; matches Macklin 2013 Sec. 3' },
      { label: 'Lagrange multiplier with relaxation',
        tex: '\\lambda_i=-\\frac{C_i}{\\sum_k|\\nabla_{\\mathbf{p}_k}C_i|^2+\\varepsilon}',
        source: 'splishsplash', location: 'TimeStepPBF.cpp l.340 (eps=1e-6); taichi-pbf2d lambda_epsilon=100 (its units)' },
      { label: 'Position correction with artificial pressure',
        tex: '\\Delta\\mathbf{p}_i=\\frac{1}{\\rho_0}\\sum_j\\left(\\lambda_i+\\lambda_j+s_{corr}\\right)\\nabla W_{\\text{spiky}}(\\mathbf{p}_i-\\mathbf{p}_j,h)',
        source: 'taichi-pbf2d', location: 'pbf2d.py position_deltas loop; cross-check Macklin 2013 Sec. 4' },
      { label: 'Tensile-instability correction',
        tex: 's_{corr}=-k\\left(\\frac{W(\\mathbf{p}_i-\\mathbf{p}_j,h)}{W(\\Delta\\mathbf{q},h)}\\right)^n,\\ |\\Delta\\mathbf{q}|=0.1h..0.3h,\\ k=0.1,\\ n=4',
        source: 'macklin2013', location: "Sec. 4 'Tensile instability' (search snippet quoting the paper)" },
      { label: 'XSPH viscosity',
        tex: '\\mathbf{v}_i^{new}=\\mathbf{v}_i+c\\sum_j\\mathbf{v}_{ij}W(\\mathbf{p}_i-\\mathbf{p}_j,h),\\ c=0.01',
        source: 'macklin2013', location: "Sec. 5 'Vorticity confinement and viscosity' (snippet: c typically 0.01)" },
      { label: 'Vorticity confinement',
        tex: '\\boldsymbol\\omega_i=\\sum_j\\mathbf{v}_{ij}\\times\\nabla_{\\mathbf{p}_j}W_{ij},\\ \\mathbf{f}_i^{vort}=\\epsilon\\,(\\mathbf{N}\\times\\boldsymbol\\omega_i),\\ \\mathbf{N}=\\frac{\\eta}{|\\eta|},\\ \\eta=\\nabla|\\boldsymbol\\omega|_i',
        source: 'macklin2013', location: 'Sec. 5 (form recalled; snippet confirms vorticity confinement as velocity post-process; not verified)' },
      { label: 'Kernels',
        tex: 'W_{\\text{poly6}}=\\frac{315}{64\\pi h^9}(h^2-r^2)^3,\\quad \\nabla W_{\\text{spiky}}=-\\frac{45}{\\pi h^6}(h-r)^2\\hat{\\mathbf{r}}',
        source: 'taichi-pbf2d', location: 'pbf2d.py poly6_factor, spiky_grad_factor (3D normalisations used in its 2D demo)' }
    ],
    assumptions: [
      'Incompressibility enforced as position constraints solved by a few Jacobi iterations per step (not converged: residual density error remains)',
      'Velocity derived from position change v = (x* - x)/dt (first-order); damping from XSPH; energy loss partly restored by vorticity confinement (off by default here)',
      'Equal masses; density computed with poly6, gradients with spiky kernel',
      'Graphics method: no physical sound speed; viscosity is numerical, not a Reynolds-number model. Designed for visual plausibility, not physical accuracy',
      'Implementation choice: the 2D kernel normalisations 4/(pi h^8) (poly6) and -30/(pi h^5) (spiky gradient) are used. The particle mass is calibrated so that the poly6 density of the initial square lattice equals rho0 = 1000 kg/m^3 exactly, so the poly6 constant cancels',
      'Implementation choice: with physical masses the constraint carries m_j: grad C = (m/rho0) grad W. The XSPH sum is volume-weighted, c * sum_j (m/rho_j) v_ij W_ij, to keep it dimensionless. epsilon and s_corr are scaled by S0 = sum_k |grad_k C|^2 of a particle inside the rest lattice, so k and epsilon are resolution- and unit-independent: k is the density-error-equivalent of the artificial pressure at |r| = |dq|. ' +
        'Default k = 0.001 with |dq| = 0.3h follows taichi-pbf2d. The paper value k = 0.1 (in the paper\'s own units) can be set from the slider; in this scaling, at the small physical dt of the dam break, it acts as a strong artificial pressure that visibly expands the column',
      'Implementation choice: the constraint is unilateral, C_i = max(rho_i/rho0 - 1, 0), by default (parameter "unilateral"). This is common practice in PBF codes and stops free-surface particles with few neighbours from being pulled inward with very large lambda. It is not part of the research extraction. Set unilateral = 0 for the bilateral form of Macklin Sec. 3, in which under-dense free-surface particles are pulled inward with large lambda (more energy error in the smoke tests)',
      'Implementation choice: walls act through precomputed virtual-particle density and gradient contributions (a mirrored rest lattice behind each wall), and positions are also clamped into the tank. This boundary treatment is not taken from the cited sources'
    ],
    stability: 'Unconditionally stable in the PBD sense (positions projected), but accuracy degrades with large dt: ' +
      'compression grows if iterations are too few (research/ptc.json, PBF stability; Macklin 2013 not read in full). ' +
      'Keep max displacement per step < ~h/2 (common practice, not from the paper). epsilon (CFM relaxation) prevents ' +
      'division by zero for isolated particles. Here dt = CFL * dx / (2 sqrt(2 g a)), the Ritter front speed for H0 = 2a.',
    scenes: {
      'dam-break': {
        params: [
          { key: 'a', label: 'Column width a [m]', min: 0.01, max: 2, step: 0.005, value: 0.05715, live: false },
          { key: 'g', label: 'Gravity g [m/s²]', min: 0.5, max: 20, step: 0.01, value: 9.81, live: false },
          { key: 'nx', label: 'Particles across column width', min: 8, max: 80, step: 1, value: 20, live: false },
          { key: 'tankL', label: 'Tank length / a', min: 2, max: 12, step: 0.5, value: 5, live: false },
          { key: 'tankH', label: 'Tank height / a', min: 2.5, max: 8, step: 0.5, value: 4, live: false },
          { key: 'hdx', label: 'Kernel radius h / dx', min: 1.5, max: 3, step: 0.1, value: 2, live: false },
          { key: 'cfl', label: 'CFL (dt · 2√(2ga) / dx)', min: 0.05, max: 1.5, step: 0.05, value: 0.3, live: false },
          { key: 'iters', label: 'Solver iterations', min: 1, max: 20, step: 1, value: 4, live: true },
          { key: 'eps', label: 'Relaxation ε / S0', min: 0, max: 1, step: 0.005, value: 0.01, live: true },
          { key: 'k', label: 's_corr k', min: 0, max: 0.3, step: 0.001, value: 0.001, live: true },
          { key: 'dq', label: 's_corr |Δq| / h', min: 0.1, max: 0.3, step: 0.01, value: 0.3, live: true },
          { key: 'n', label: 's_corr exponent n', min: 1, max: 6, step: 1, value: 4, live: true },
          { key: 'c', label: 'XSPH c', min: 0, max: 0.1, step: 0.001, value: 0.01, live: true },
          { key: 'unilateral', label: 'Clamp C ≥ 0 (1 = on)', min: 0, max: 1, step: 1, value: 1, live: true },
          { key: 'vort', label: 'Vorticity confinement ε / √(ga)', min: 0, max: 1, step: 0.01, value: 0, live: true }
        ],
        notes: 'Column a × 2a at the left wall of a tank tankL·a × tankH·a, particles on a square lattice with spacing ' +
          'dx = a/nx, released from rest at t = 0. rho0 = 1000 kg/m³. Probes, in physical units: front = max particle x + dx/2, ' +
          'so the column edge is at a at t = 0. column_height = max y + dx/2 over particles with x < dx, the first ' +
          'lattice column at the left wall. totals = {mass, ke, pe} per metre of depth (kg/m, J/m), with pe = m g Σ y. ' +
          'For Martin & Moyce use Z = front/a and T = t √(2g/a). Live changes to iterations, ε, s_corr, XSPH and ' +
          'vorticity confinement change only the solver post-processing and are allowed. Resolution, tank size and dt ' +
          'are fixed per run.'
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'dam-break') throw new Error('pbf supports only dam-break');
      var a = +params.a, g = +params.g;
      var nx = Math.max(2, Math.round(+params.nx));
      var L = +params.tankL * a, Hb = +params.tankH * a;
      var dx = a / nx, h = +params.hdx * dx, h2 = h * h;
      var Uref = 2 * Math.sqrt(2 * g * a);            // Ritter front speed, H0 = 2a
      var dt = +params.cfl * dx / Uref;
      var iters = Math.max(1, Math.round(+params.iters));
      var epsRel = +params.eps, kCorr = +params.k, dqRel = +params.dq, nCorr = Math.round(+params.n);
      var cX = +params.c, vortRel = +params.vort;
      var unilateral = +params.unilateral !== 0;
      var rho0 = 1000;

      // kernels (2D normalisation)
      var poly6C = 4 / (PI * Math.pow(h, 8)), spikyC = -30 / (PI * Math.pow(h, 5));
      function Wp(r2) { if (r2 >= h2) return 0; var d = h2 - r2; return poly6C * d * d * d; }
      function dWs(r) { if (r >= h || r <= 0) return 0; var d = h - r; return spikyC * d * d; } // dW/dr (<0)

      // particles
      var ny = 2 * nx, n = nx * ny;
      var x = new Float64Array(n), y = new Float64Array(n), vx = new Float64Array(n), vy = new Float64Array(n);
      var px = new Float64Array(n), py = new Float64Array(n);       // predicted positions
      var dpx = new Float64Array(n), dpy = new Float64Array(n);
      var lam = new Float64Array(n), rho = new Float64Array(n), omg = new Float64Array(n);
      var nvx = new Float64Array(n), nvy = new Float64Array(n);
      for (var j = 0, p = 0; j < ny; j++) for (var i = 0; i < nx; i++, p++) {
        x[p] = (i + 0.5) * dx; y[p] = (j + 0.5) * dx;
      }

      // mass calibration on the infinite rest lattice; S0 = sum_k |grad_k C|^2 for an interior particle
      var R = Math.ceil(h / dx) + 1, latW = 0, latG2 = 0;
      for (var lj = -R; lj <= R; lj++) for (var li = -R; li <= R; li++) {
        var rx = li * dx, ry = lj * dx, rr2 = rx * rx + ry * ry;
        latW += Wp(rr2);
        if (rr2 > 0) { var gg = dWs(Math.sqrt(rr2)); latG2 += gg * gg; }
      }
      var m = rho0 / latW;
      var mr = m / rho0;
      var S0 = mr * mr * latG2;
      var W0self = m * Wp(0);

      // wall tables: mirrored rest lattice beyond each wall, averaged over tangential offsets
      var NT = 256, wRho = new Float64Array(NT + 1), wGrad = new Float64Array(NT + 1);
      (function () {
        var NO = 8, K = Math.ceil(h / dx) + 1;
        for (var t = 0; t <= NT; t++) {
          var d = h * t / NT, sr = 0, sg = 0;
          for (var o = 0; o < NO; o++) {
            var ox = (o + 0.5) / NO * dx;
            for (var kk = 0; kk <= K; kk++) {
              var by = -(kk + 0.5) * dx, ddy = d - by;
              for (var ii = -K - 1; ii <= K + 1; ii++) {
                var ddx = ii * dx + ox - 0.5 * dx, r2 = ddx * ddx + ddy * ddy;
                if (r2 >= h2) continue;
                sr += m * Wp(r2);
                var r = Math.sqrt(r2);
                sg += m * dWs(r) * ddy / r;    // component along the inward normal (negative: towards wall)
              }
            }
          }
          wRho[t] = sr / NO; wGrad[t] = sg / NO;
        }
      })();
      var tScale = NT / h;
      function wallLookup(d, tab) {
        if (d >= h) return 0;
        if (d < 0) d = 0;
        var f = d * tScale, i0 = f | 0; if (i0 >= NT) return tab[NT];
        var s = f - i0; return tab[i0] * (1 - s) + tab[i0 + 1] * s;
      }

      // corner correction: the two half-plane mirrors both contain the quadrant behind a corner,
      // so its contribution (density and gradient) is subtracted once.
      var NC = 32, cRho = new Float64Array((NC + 1) * (NC + 1));
      var cGx = new Float64Array((NC + 1) * (NC + 1)), cGy = new Float64Array((NC + 1) * (NC + 1));
      (function () {
        var K = Math.ceil(h / dx) + 1;
        for (var tj = 0; tj <= NC; tj++) for (var ti = 0; ti <= NC; ti++) {
          var X = h * ti / NC, Y = h * tj / NC, sr = 0, sx = 0, sy = 0;
          for (var kj = 0; kj <= K; kj++) for (var ki = 0; ki <= K; ki++) {
            var ex = X + (ki + 0.5) * dx, ey = Y + (kj + 0.5) * dx, r2 = ex * ex + ey * ey;
            if (r2 >= h2) continue;
            var r = Math.sqrt(r2), gw = m * dWs(r) / r;
            sr += m * Wp(r2); sx += gw * ex; sy += gw * ey;
          }
          var c = tj * (NC + 1) + ti; cRho[c] = sr; cGx[c] = sx; cGy[c] = sy;
        }
      })();
      var cScale = NC / h, bil = LAB.util.bilinear;

      // wall density and gradient (divided by rho0) at (xi, yi) -> WR, WGX, WGY
      var WR = 0, WGX = 0, WGY = 0;
      function wallTerms(xi, yi) {
        var dl = xi, dr = L - xi, db = yi, dt2 = Hb - yi;
        WR = wallLookup(dl, wRho) + wallLookup(dr, wRho) + wallLookup(db, wRho) + wallLookup(dt2, wRho);
        WGX = wallLookup(dl, wGrad) - wallLookup(dr, wGrad);
        WGY = wallLookup(db, wGrad) - wallLookup(dt2, wGrad);
        if (dl < h || dr < h) {
          var ux = dl < dr ? dl : dr, sxn = dl < dr ? 1 : -1;
          if (db < h || dt2 < h) {
            var uy = db < dt2 ? db : dt2, syn = db < dt2 ? 1 : -1;
            if (ux < 0) ux = 0; if (uy < 0) uy = 0;
            var fx = ux * cScale, fy = uy * cScale;
            WR -= bil(cRho, NC + 1, NC + 1, fx, fy);
            WGX -= sxn * bil(cGx, NC + 1, NC + 1, fx, fy);
            WGY -= syn * bil(cGy, NC + 1, NC + 1, fx, fy);
          }
        }
        WGX /= rho0; WGY /= rho0;
      }
      var wgx = new Float64Array(n), wgy = new Float64Array(n);

      // neighbour lists (built once per step on predicted positions)
      var hash = new LAB.util.SpatialHash(h, 0, 0, L, Hb);
      var nbStart = new Int32Array(n + 1), nbList = new Int32Array(n * 24);
      function buildNeighbours() {
        hash.build(px, py, n);
        var cnt = 0, hnx = hash.nx, hny = hash.ny, st = hash.start, items = hash.items;
        for (var a1 = 0; a1 < n; a1++) {
          nbStart[a1] = cnt;
          var xi = px[a1], yi = py[a1];
          var ci = Math.floor(xi / h), cj = Math.floor(yi / h);
          for (var dj = -1; dj <= 1; dj++) {
            var jj = cj + dj; if (jj < 0 || jj >= hny) continue;
            for (var di = -1; di <= 1; di++) {
              var ii = ci + di; if (ii < 0 || ii >= hnx) continue;
              var c = jj * hnx + ii;
              for (var q = st[c]; q < st[c + 1]; q++) {
                var b = items[q]; if (b === a1) continue;
                var ex = xi - px[b], ey = yi - py[b];
                if (ex * ex + ey * ey >= h2 * 1.21) continue;   // small skin: positions move during iterations
                if (cnt >= nbList.length) { var nl = new Int32Array(nbList.length * 2); nl.set(nbList); nbList = nl; }
                nbList[cnt++] = b;
              }
            }
          }
        }
        nbStart[n] = cnt;
      }

      var rmin = 1e-6 * dx, xmin = rmin, xmax = L - rmin, ymin = rmin, ymax = Hb - rmin;
      function clampP(i) {
        if (px[i] < xmin) px[i] = xmin; else if (px[i] > xmax) px[i] = xmax;
        if (py[i] < ymin) py[i] = ymin; else if (py[i] > ymax) py[i] = ymax;
      }

      // density + wall gradient at predicted positions; returns nothing, fills rho
      function densities(withLambda) {
        var eps = epsRel * S0;
        var Wdq = Wp(dqRel * h * dqRel * h);
        for (var i = 0; i < n; i++) {
          var xi = px[i], yi = py[i];
          var r = W0self, gx = 0, gy = 0, sg2 = 0;
          for (var q = nbStart[i], e = nbStart[i + 1]; q < e; q++) {
            var b = nbList[q], ex = xi - px[b], ey = yi - py[b], r2 = ex * ex + ey * ey;
            if (r2 >= h2) continue;
            r += m * Wp(r2);
            if (withLambda && r2 > 0) {
              var rr = Math.sqrt(r2), gw = mr * dWs(rr) / rr;
              var gxx = gw * ex, gyy = gw * ey;
              gx += gxx; gy += gyy; sg2 += gxx * gxx + gyy * gyy;
            }
          }
          // walls: left (normal +x), right (-x), bottom (+y), top (-y)
          wallTerms(xi, yi);
          r += WR;
          rho[i] = r;
          if (withLambda) {
            wgx[i] = WGX; wgy[i] = WGY;
            gx += WGX; gy += WGY;
            var C = r / rho0 - 1;
            if (unilateral && C < 0) C = 0;
            lam[i] = -C / (gx * gx + gy * gy + sg2 + eps);
          }
        }
        return Wdq;
      }

      function solveIteration() {
        var Wdq = densities(true);
        var kS = kCorr / S0;   // s_corr in lambda units (see assumptions)
        for (var i = 0; i < n; i++) {
          var xi = px[i], yi = py[i], li = lam[i], sx = 0, sy = 0;
          for (var q = nbStart[i], e = nbStart[i + 1]; q < e; q++) {
            var b = nbList[q], ex = xi - px[b], ey = yi - py[b], r2 = ex * ex + ey * ey;
            if (r2 >= h2 || r2 <= 0) continue;
            var rr = Math.sqrt(r2), gw = dWs(rr) / rr;
            var sc = 0;
            if (kS > 0) { var ratio = Wp(r2) / Wdq; sc = -kS * Math.pow(ratio, nCorr); }
            var s = (li + lam[b] + sc) * gw;
            sx += s * ex; sy += s * ey;
          }
          sx *= mr; sy *= mr;
          sx += li * wgx[i];
          sy += li * wgy[i];
          dpx[i] = sx; dpy[i] = sy;
        }
        for (var i2 = 0; i2 < n; i2++) { px[i2] += dpx[i2]; py[i2] += dpy[i2]; clampP(i2); }
      }

      // vorticity (scalar, 2D) at predicted positions with current velocities
      function computeVorticity() {
        for (var i = 0; i < n; i++) {
          var xi = px[i], yi = py[i], w = 0;
          for (var q = nbStart[i], e = nbStart[i + 1]; q < e; q++) {
            var b = nbList[q], ex = xi - px[b], ey = yi - py[b], r2 = ex * ex + ey * ey;
            if (r2 >= h2 || r2 <= 0) continue;
            var rr = Math.sqrt(r2), gw = dWs(rr) / rr * m / rho[b];
            var gx = gw * ex, gy = gw * ey;               // grad_i W_ij * V_j
            w += gx * (vy[b] - vy[i]) - gy * (vx[b] - vx[i]);
          }
          omg[i] = w;
        }
      }

      function applyVorticityConfinement(epsV) {
        computeVorticity();
        for (var i = 0; i < n; i++) {
          var xi = px[i], yi = py[i], ex2 = 0, ey2 = 0, ai = Math.abs(omg[i]);
          for (var q = nbStart[i], e = nbStart[i + 1]; q < e; q++) {
            var b = nbList[q], ex = xi - px[b], ey = yi - py[b], r2 = ex * ex + ey * ey;
            if (r2 >= h2 || r2 <= 0) continue;
            var rr = Math.sqrt(r2), gw = dWs(rr) / rr * m / rho[b] * (Math.abs(omg[b]) - ai);
            ex2 += gw * ex; ey2 += gw * ey;
          }
          var en = Math.sqrt(ex2 * ex2 + ey2 * ey2);
          if (en > 0) {
            var Nx = ex2 / en, Ny = ey2 / en;
            nvx[i] = dt * epsV * Ny * omg[i]; nvy[i] = -dt * epsV * Nx * omg[i];
          } else { nvx[i] = 0; nvy[i] = 0; }
        }
        for (var i2 = 0; i2 < n; i2++) { vx[i2] += nvx[i2]; vy[i2] += nvy[i2]; }
      }

      function applyXSPH() {
        for (var i = 0; i < n; i++) {
          var xi = px[i], yi = py[i], sx = 0, sy = 0;
          for (var q = nbStart[i], e = nbStart[i + 1]; q < e; q++) {
            var b = nbList[q], ex = xi - px[b], ey = yi - py[b], r2 = ex * ex + ey * ey;
            if (r2 >= h2) continue;
            var w = m / rho[b] * Wp(r2);
            sx += w * (vx[b] - vx[i]); sy += w * (vy[b] - vy[i]);
          }
          nvx[i] = vx[i] + cX * sx; nvy[i] = vy[i] + cX * sy;
        }
        for (var i2 = 0; i2 < n; i2++) { vx[i2] = nvx[i2]; vy[i2] = nvy[i2]; }
      }

      function totals() {
        var ke = 0, pe = 0;
        for (var i = 0; i < n; i++) { ke += vx[i] * vx[i] + vy[i] * vy[i]; pe += y[i]; }
        return { mass: n * m, ke: 0.5 * m * ke, pe: m * g * pe };
      }
      function front() {
        var mx = -Infinity; for (var i = 0; i < n; i++) if (x[i] > mx) mx = x[i];
        return mx + 0.5 * dx;
      }
      function columnHeight() {
        var my = -Infinity; for (var i = 0; i < n; i++) if (x[i] < dx && y[i] > my) my = y[i];
        return my === -Infinity ? 0 : my + 0.5 * dx;
      }

      // initial density (for view/metrics before the first step)
      for (var i0 = 0; i0 < n; i0++) { px[i0] = x[i0]; py[i0] = y[i0]; }
      buildNeighbours(); densities(false);
      var tot0 = totals(), E0 = tot0.ke + tot0.pe;
      var vortFresh = false;

      var sim = {
        t: 0, steps: 0, dt: dt,
        fields: ['speed', 'density', 'vorticity', 'lambda'],
        step: function () {
          // 1. predict
          for (var i = 0; i < n; i++) {
            vy[i] -= dt * g;
            px[i] = x[i] + dt * vx[i]; py[i] = y[i] + dt * vy[i];
            clampP(i);
          }
          // 2. neighbours
          buildNeighbours();
          // 3. constraint iterations
          for (var it = 0; it < iters; it++) solveIteration();
          densities(false);
          // 4. velocity from positions
          var idt = 1 / dt;
          for (var i2 = 0; i2 < n; i2++) { vx[i2] = (px[i2] - x[i2]) * idt; vy[i2] = (py[i2] - y[i2]) * idt; }
          // 5. vorticity confinement (optional) and XSPH viscosity
          vortFresh = false;
          if (vortRel > 0) applyVorticityConfinement(vortRel * Math.sqrt(g * a));
          if (cX > 0) applyXSPH();
          // 6. commit
          for (var i3 = 0; i3 < n; i3++) { x[i3] = px[i3]; y[i3] = py[i3]; }
          sim.steps++;
          sim.t = sim.steps * dt;
        },
        setParam: function (key, value) {
          value = +value;
          if (key === 'iters') iters = Math.max(1, Math.round(value));
          else if (key === 'eps') epsRel = value;
          else if (key === 'k') kCorr = value;
          else if (key === 'dq') dqRel = value;
          else if (key === 'n') nCorr = Math.round(value);
          else if (key === 'c') cX = value;
          else if (key === 'vort') vortRel = value;
          else if (key === 'unilateral') unilateral = value !== 0;
        },
        view: function (field) {
          field = field || 'speed';
          var X = new Float32Array(n), Y = new Float32Array(n), V = new Float32Array(n), lo, hi;
          if (field === 'vorticity' && !vortFresh) { computeVorticity(); vortFresh = true; }
          var vmax = 0;
          for (var i = 0; i < n; i++) {
            X[i] = x[i]; Y[i] = y[i];
            if (field === 'density') V[i] = rho[i] / rho0;
            else if (field === 'vorticity') V[i] = omg[i] / Math.sqrt(g / a);
            else if (field === 'lambda') V[i] = lam[i] * S0;
            else V[i] = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
            if (Math.abs(V[i]) > vmax) vmax = Math.abs(V[i]);
          }
          if (field === 'density') { lo = 0.9; hi = 1.1; }
          else if (field === 'vorticity') { lo = -6; hi = 6; }
          else if (field === 'lambda') { lo = -0.02; hi = 0.02; }
          else { lo = 0; hi = Uref; }
          return {
            kind: 'particles', n: n, x: X, y: Y, value: V, range: [lo, hi],
            cmap: (field === 'vorticity' || field === 'lambda') ? 'diverging' : 'sequential',
            label: field === 'density' ? 'ρ/ρ0' : field === 'vorticity' ? 'ω/√(g/a)' : field === 'lambda' ? 'λ·S0 (≈ −C)' : '|v| [m/s]',
            radius: 0.5 * dx,
            extent: [0, 0, L, Hb],
            walls: [[0, 0, L, 0], [0, 0, 0, Hb], [L, 0, L, Hb]]
          };
        },
        metrics: function () {
          var T = totals(), vmax = 0, cmax = -Infinity, csum = 0;
          for (var i = 0; i < n; i++) {
            var s = vx[i] * vx[i] + vy[i] * vy[i]; if (s > vmax) vmax = s;
            var C = rho[i] / rho0 - 1; if (C > cmax) cmax = C; if (C > 0) csum += C;
          }
          vmax = Math.sqrt(vmax);
          var E = T.ke + T.pe, M = LAB.util.metric;
          return [
            M('t', 'time t', sim.t, 's', 'g'),
            M('T', 'T = t√(2g/a)', sim.t * Math.sqrt(2 * g / a), '', 'g'),
            M('steps', 'steps', sim.steps, '', 'i'),
            M('Z', 'front Z = x/a', front() / a, '', 'g'),
            M('H2a', 'column height H/2a', columnHeight() / (2 * a), '', 'g'),
            M('mass', 'mass (per m depth)', T.mass, 'kg/m', 'g'),
            M('ke', 'kinetic energy', T.ke, 'J/m', 'e'),
            M('pe', 'potential energy', T.pe, 'J/m', 'e'),
            M('dE', '(E − E0)/E0', (E - E0) / E0, '', 'e'),
            M('vmax', 'max speed', vmax, 'm/s', 'g'),
            M('cfl', 'max |v| dt/dx', vmax * dt / dx, '', 'g'),
            M('cmax', 'max density error ρ/ρ0−1', cmax, '', 'e'),
            M('cmean', 'mean compression ⟨max(C,0)⟩', csum / n, '', 'e'),
            M('n', 'particles', n, '', 'i')
          ];
        },
        probe: function (name) {
          if (name === 'front') return front();
          if (name === 'totals') return totals();
          if (name === 'column_height') return columnHeight();
          if (name === 'time') return sim.t;
          return null;
        },
        diverged: function () {
          var U = LAB.util;
          return !(U.finiteAll(x) && U.finiteAll(y) && U.finiteAll(vx) && U.finiteAll(vy));
        }
      };
      return sim;
    }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
