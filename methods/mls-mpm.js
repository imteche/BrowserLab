/* MLS-MPM (Hu et al. 2018) for a weakly compressible fluid, following the open mpm88 structure:
 * P2G with quadratic B-spline weights and the fused APIC affine momentum + J-based pressure term,
 * grid update with gravity and wall conditions, G2P with APIC affine matrix update, J update.
 * Metadata from research/ptc.json (method id 'mls-mpm'). See docs/CONTRACTS.md §4. */
(function (LAB) {
  'use strict';

  var BOUND = 3;           // wall layer thickness in grid cells (taichi-mpm88: bound = 3)

  LAB.registerMethod({
    id: 'mls-mpm',
    name: 'MLS-MPM with APIC transfer, weakly compressible fluid (Hu et al. 2018; mpm88)',
    family: 'hybrid',
    summary: 'The fluid is carried by particles, but forces are computed on a fixed background grid ' +
      'that is rebuilt from scratch every step. Each particle stores its mass, velocity, a 2x2 affine ' +
      'velocity matrix C (APIC) and the ratio J of its current to initial volume. Every step the ' +
      'particles spread mass and momentum to the 3x3 nearest grid nodes with quadratic B-spline ' +
      'weights (P2G). In MLS-MPM the pressure force is folded into the same transfer as an extra ' +
      'affine term, so no kernel gradients are needed. The grid then adds gravity and applies the ' +
      'wall conditions, and the particles read back their new velocity and affine matrix (G2P). ' +
      'Particles then move and J is updated from the velocity divergence (trace of C). Pressure ' +
      'follows the weakly compressible law p = -E(J - 1), so the bulk modulus E sets the sound speed ' +
      'c = sqrt(E/rho). Mass is carried by the particles and is conserved exactly.',
    sources: ['hu2018mlsmpm', 'taichi-mpm88', 'mlsmpm88-cpp'],
    equations: [
      { label: 'Quadratic B-spline weights',
        tex: 'f=\\mathbf{x}_p/\\Delta x-\\lfloor\\mathbf{x}_p/\\Delta x-0.5\\rfloor,\\ w_0=\\tfrac12(1.5-f)^2,\\ w_1=0.75-(f-1)^2,\\ w_2=\\tfrac12(f-0.5)^2,\\ w_{ij}=w_i^x w_j^y',
        source: 'taichi-mpm88', location: 'mpm88.py substep() P2G', verified: true },
      { label: 'P2G (MLS-MPM fused APIC momentum + stress)',
        tex: 'm_i\\mathrel{+}=w_{ip}m_p,\\quad (m\\mathbf{v})_i\\mathrel{+}=w_{ip}\\left[m_p\\mathbf{v}_p+\\left(m_p\\mathbf{C}_p-\\Delta t\\,V_p\\,\\tfrac{4}{\\Delta x^2}\\,E(J_p-1)\\mathbf{I}\\right)(\\mathbf{x}_i-\\mathbf{x}_p)\\right]',
        source: 'taichi-mpm88',
        location: 'mpm88.py: stress = -dt*4*E*p_vol*(J-1)/dx**2; affine = diag(stress) + p_mass*C; general form (P F^T) in mlsmpm88-cpp \'Eqn 29\' of mls-mpm-cpic',
        verified: true },
      { label: 'MLS-MPM inertia tensor for quadratic B-spline',
        tex: '\\mathbf{D}_p^{-1}=\\frac{4}{\\Delta x^2}\\mathbf{I}',
        source: 'mlsmpm88-cpp', location: 'mls-mpm88-explained.cpp \'Dinv = 4*inv_dx*inv_dx\' (comment: mpm.graphics, paragraph after Eqn. 176)', verified: true },
      { label: 'Grid update',
        tex: '\\mathbf{v}_i=\\frac{(m\\mathbf{v})_i}{m_i}+\\Delta t\\,\\mathbf{g};\\ \\text{wall cells: } v_n\\leftarrow\\min(v_n,0)\\ \\text{(outward component zeroed)}',
        source: 'taichi-mpm88', location: 'mpm88.py grid loop, bound = 3 cells', verified: true },
      { label: 'G2P (APIC)',
        tex: '\\mathbf{v}_p=\\sum_i w_{ip}\\mathbf{v}_i,\\quad \\mathbf{C}_p=\\frac{4}{\\Delta x^2}\\sum_i w_{ip}\\mathbf{v}_i(\\mathbf{x}_i-\\mathbf{x}_p)^T',
        source: 'taichi-mpm88', location: 'mpm88.py G2P: new_C += 4*weight*g_v.outer_product(dpos)/dx**2', verified: true },
      { label: 'Advection and volume ratio',
        tex: '\\mathbf{x}_p\\mathrel{+}=\\Delta t\\,\\mathbf{v}_p,\\quad J_p\\leftarrow J_p\\,(1+\\Delta t\\,\\mathrm{tr}\\,\\mathbf{C}_p)',
        source: 'taichi-mpm88', location: 'mpm88.py end of substep()', verified: true },
      { label: 'Fluid EOS implied by mpm88',
        tex: 'p=-E\\,(J-1)\\ (\\text{bulk modulus }E),\\quad c=\\sqrt{E/\\rho}',
        source: 'taichi-mpm88', location: 'derived from the stress term above (interpretation, not a quoted equation)', verified: false }
    ],
    assumptions: [
      'Weakly compressible, inviscid fluid; only the scalar volume ratio J is tracked (no deviatoric stress)',
      'Particles carry mass, velocity, affine matrix C (APIC) and J; grid is a scratch-pad rebuilt each step',
      'MLS shape-function gradient replaced by the APIC/MLS affine form so no kernel gradients are needed (Hu et al. 2018 main claim)',
      'Pressure p = -E(J-1) is used in both compression and tension, as in mpm88 (no tension clamp)',
      'Implementation choice (builder): mpm88 is set in a unit box with E = 400; here the tank is in physical units and E = rho0 c0^2 with c0 = cfac * sqrt(2 g 2a), the same sound-speed rule as the WCSPH scene setup (research: c0 = 10 sqrt(2gH) from pysph-dbexp)',
      'Implementation choice (builder): particles start on a regular 2x2 sub-lattice per cell (mpm88 seeds randomly) so runs are deterministic; initial J is hydrostatic, J = 1 - rho0 g (2a - y)/E, to avoid an initial pressure shock',
      'Implementation choice (builder): adaptive dt = cfl * dx / (c0 + |v|max), not the fixed mpm88 dt = 2e-4'
    ],
    stability: 'Explicit; dt limited by CFL on grid with sound speed: dt <= C dx/(|v|max + c), c = sqrt(E/rho). mpm88: c = sqrt(400/1) = 20, ' +
      'dt*c/dx = 2e-4*20*128 = 0.51 (derived by research, not stated in source; taichi-mpm88). Particles must not leave the 3x3 stencil: |v| dt < dx. ' +
      'This implementation uses dt = cfl * dx / (c0 + |v|max) with default cfl = 0.4.',
    scenes: {
      'dam-break': {
        params: [
          { key: 'a', label: 'Column width a (m)', min: 0.02, max: 5, step: 0.01, value: 1, live: false },
          { key: 'g', label: 'Gravity g (m/s²)', min: 0.5, max: 30, step: 0.01, value: 9.81, live: false },
          { key: 'N', label: 'Grid cells across column width', min: 8, max: 96, step: 2, value: 32, live: false },
          { key: 'Lx', label: 'Tank length / a', min: 2, max: 12, step: 0.5, value: 5, live: false },
          { key: 'Ly', label: 'Tank height / a', min: 2.5, max: 8, step: 0.5, value: 3, live: false },
          { key: 'cfac', label: 'Sound speed c0 / √(2g·2a)', min: 3, max: 40, step: 1, value: 10, live: false },
          { key: 'bc', label: 'Walls: 0 = separating slip (mpm88), 1 = sticky sides + separating floor (mls-mpm88-cpp)', min: 0, max: 1, step: 1, value: 0, live: false },
          { key: 'cfl', label: 'Acoustic Courant number dt(c0+|v|)/dx', min: 0.05, max: 0.6, step: 0.01, value: 0.4, live: true }
        ],
        notes: 'Column a wide, 2a high, against the left wall (x = 0) of a tank Lx·a long and Ly·a high; floor y = 0. Grid spacing dx = a/N, ' +
          '4 particles per cell (2x2 regular sub-lattice), V_p = dx²/4, m_p = rho0 V_p with rho0 = 1000 kg/m³. Grid nodes extend 3 cells ' +
          'beyond each wall; nodes at or beyond a wall (x <= 0, x >= Lx, y <= 0, y >= Ly) are wall nodes (mpm88 separating condition: ' +
          'outward velocity component zeroed; bc = 1 zeroes both components on the side and top walls as in mls-mpm88-cpp). ' +
          'Probes: front = max x of particles whose nearest grid node carries at least 1/4 of a full cell mass (rho0 dx²), so isolated ' +
          'spray particles are ignored; column_height = max y of particles with x < dx under the same filter; totals per unit depth: ' +
          'mass (kg/m), ke and pe = sum m g y (J/m). sim.t is physical seconds; Z = front/a, T = t sqrt(2g/a). Particle positions, ' +
          'not reconstructed surfaces, are measured (offset up to dx/4).'
      }
    },

    create: function (sceneId, params) {
      if (sceneId !== 'dam-break') throw new Error('mls-mpm supports dam-break only');
      var a = +params.a, g = +params.g;
      var N = Math.max(4, Math.round(+params.N));
      var dx = a / N, invDx = 1 / dx;
      var nxC = Math.max(2 * N, Math.round(Math.max(1.5, +params.Lx) * N));
      var nyC = Math.max(2 * N + 4, Math.round(Math.max(2.2, +params.Ly) * N));
      var Lx = nxC * dx, Ly = nyC * dx, Hcol = 2 * a;
      var rho0 = 1000;
      var c0 = +params.cfac * Math.sqrt(2 * g * Hcol);
      var E = rho0 * c0 * c0;
      var sticky = Math.round(+params.bc) === 1;
      var cfl = +params.cfl;

      /* grid: node (i,j) at x = (i - BOUND) dx, y = (j - BOUND) dx */
      var NX = nxC + 2 * BOUND + 1, NY = nyC + 2 * BOUND + 1, NG = NX * NY;
      var gm = new Float64Array(NG), gvx = new Float64Array(NG), gvy = new Float64Array(NG);
      var ox = -BOUND * dx, oy = -BOUND * dx;
      var iL = BOUND, iR = BOUND + nxC, jB = BOUND, jT = BOUND + nyC;

      /* particles */
      var nPx = 2 * N, nPy = 4 * N, np = nPx * nPy;
      var Vp = dx * dx / 4, mp = rho0 * Vp;
      var x = new Float64Array(np), y = new Float64Array(np), vx = new Float64Array(np), vy = new Float64Array(np);
      var C00 = new Float64Array(np), C01 = new Float64Array(np), C10 = new Float64Array(np), C11 = new Float64Array(np);
      var J = new Float64Array(np);
      var k = 0;
      for (var jj = 0; jj < nPy; jj++) {
        for (var ii = 0; ii < nPx; ii++) {
          x[k] = (ii + 0.5) * 0.5 * dx; y[k] = (jj + 0.5) * 0.5 * dx;
          J[k] = 1 - rho0 * g * (Hcol - y[k]) / E;
          k++;
        }
      }
      var xMin = -(BOUND - 1) * dx, xMax = Lx + (BOUND - 1) * dx, yMin = -(BOUND - 1) * dx, yMax = Ly + (BOUND - 1) * dx;

      var vmaxLast = 0, p2gErr = 0, g2pErr = 0, clampCount = 0;
      var D4 = 4 * invDx * invDx;

      function chooseDt() { return cfl * dx / (c0 + vmaxLast); }

      function step() {
        var dt = chooseDt();
        var p, i, j, idx;
        gm.fill(0); gvx.fill(0); gvy.fill(0);
        var stressK = -dt * D4 * E * Vp;
        var ppx = 0, ppy = 0;
        /* ---- P2G ---- */
        for (p = 0; p < np; p++) {
          var xp = (x[p] - ox) * invDx, yp = (y[p] - oy) * invDx;
          var bi = Math.floor(xp - 0.5), bj = Math.floor(yp - 0.5);
          var fx = xp - bi, fy = yp - bj;
          var wx0 = 0.5 * (1.5 - fx) * (1.5 - fx), wx1 = 0.75 - (fx - 1) * (fx - 1), wx2 = 0.5 * (fx - 0.5) * (fx - 0.5);
          var wy0 = 0.5 * (1.5 - fy) * (1.5 - fy), wy1 = 0.75 - (fy - 1) * (fy - 1), wy2 = 0.5 * (fy - 0.5) * (fy - 0.5);
          var st = stressK * (J[p] - 1);
          var A00 = st + mp * C00[p], A01 = mp * C01[p], A10 = mp * C10[p], A11 = st + mp * C11[p];
          var mvx = mp * vx[p], mvy = mp * vy[p];
          ppx += mvx; ppy += mvy;
          for (j = 0; j < 3; j++) {
            var wy = j === 0 ? wy0 : j === 1 ? wy1 : wy2;
            var dpy = (j - fy) * dx;
            var row = (bj + j) * NX + bi;
            for (i = 0; i < 3; i++) {
              var w = (i === 0 ? wx0 : i === 1 ? wx1 : wx2) * wy;
              var dpx = (i - fx) * dx;
              idx = row + i;
              gm[idx] += w * mp;
              gvx[idx] += w * (mvx + A00 * dpx + A01 * dpy);
              gvy[idx] += w * (mvy + A10 * dpx + A11 * dpy);
            }
          }
        }
        /* ---- grid update ---- */
        var gpx = 0, gpy = 0, gqx = 0, gqy = 0;
        for (j = 0; j < NY; j++) {
          for (i = 0; i < NX; i++) {
            idx = j * NX + i;
            var mi = gm[idx];
            if (mi <= 0) { gvx[idx] = 0; gvy[idx] = 0; continue; }
            gpx += gvx[idx]; gpy += gvy[idx];
            var ux = gvx[idx] / mi, uy = gvy[idx] / mi - dt * g;
            if (sticky) {
              if (i <= iL || i >= iR || j >= jT) { ux = 0; uy = 0; }
              if (j <= jB && uy < 0) uy = 0;
            } else {
              if (i <= iL && ux < 0) ux = 0;
              if (i >= iR && ux > 0) ux = 0;
              if (j <= jB && uy < 0) uy = 0;
              if (j >= jT && uy > 0) uy = 0;
            }
            gvx[idx] = ux; gvy[idx] = uy;
            gqx += mi * ux; gqy += mi * uy;
          }
        }
        var pref = mp * np * (vmaxLast + 1e-300);
        p2gErr = Math.sqrt((gpx - ppx) * (gpx - ppx) + (gpy - ppy) * (gpy - ppy)) / (pref > 0 ? pref : 1);
        /* ---- G2P ---- */
        var qpx = 0, qpy = 0, vmax2 = 0;
        for (p = 0; p < np; p++) {
          var xq = (x[p] - ox) * invDx, yq = (y[p] - oy) * invDx;
          var ci = Math.floor(xq - 0.5), cj = Math.floor(yq - 0.5);
          var ex = xq - ci, ey = yq - cj;
          var ux0 = 0.5 * (1.5 - ex) * (1.5 - ex), ux1 = 0.75 - (ex - 1) * (ex - 1), ux2 = 0.5 * (ex - 0.5) * (ex - 0.5);
          var uy0 = 0.5 * (1.5 - ey) * (1.5 - ey), uy1 = 0.75 - (ey - 1) * (ey - 1), uy2 = 0.5 * (ey - 0.5) * (ey - 0.5);
          var nvx = 0, nvy = 0, c00 = 0, c01 = 0, c10 = 0, c11 = 0;
          for (j = 0; j < 3; j++) {
            var wyy = j === 0 ? uy0 : j === 1 ? uy1 : uy2;
            var dy = (j - ey) * dx;
            var r = (cj + j) * NX + ci;
            for (i = 0; i < 3; i++) {
              var ww = (i === 0 ? ux0 : i === 1 ? ux1 : ux2) * wyy;
              var ddx = (i - ex) * dx;
              var gx = gvx[r + i], gy = gvy[r + i];
              nvx += ww * gx; nvy += ww * gy;
              c00 += ww * gx * ddx; c01 += ww * gx * dy;
              c10 += ww * gy * ddx; c11 += ww * gy * dy;
            }
          }
          vx[p] = nvx; vy[p] = nvy;
          C00[p] = D4 * c00; C01[p] = D4 * c01; C10[p] = D4 * c10; C11[p] = D4 * c11;
          qpx += mp * nvx; qpy += mp * nvy;
          var v2 = nvx * nvx + nvy * nvy; if (v2 > vmax2) vmax2 = v2;
          J[p] *= 1 + dt * (C00[p] + C11[p]);
          var nx_ = x[p] + dt * nvx, ny_ = y[p] + dt * nvy;
          if (nx_ < xMin) { nx_ = xMin; clampCount++; } else if (nx_ > xMax) { nx_ = xMax; clampCount++; }
          if (ny_ < yMin) { ny_ = yMin; clampCount++; } else if (ny_ > yMax) { ny_ = yMax; clampCount++; }
          x[p] = nx_; y[p] = ny_;
        }
        var qref = mp * np * (Math.sqrt(vmax2) + 1e-300);
        g2pErr = Math.sqrt((gqx - qpx) * (gqx - qpx) + (gqy - qpy) * (gqy - qpy)) / (qref > 0 ? qref : 1);
        vmaxLast = Math.sqrt(vmax2);
        sim.dt = dt;
        sim.t += dt;
        sim.steps++;
      }

      /* ---------------- diagnostics ---------------- */
      function kinetic() { var s = 0; for (var q = 0; q < np; q++) s += 0.5 * mp * (vx[q] * vx[q] + vy[q] * vy[q]); return s; }
      function potential() { var s = 0; for (var q = 0; q < np; q++) s += mp * g * y[q]; return s; }
      function vmaxNow() { var s = 0; for (var q = 0; q < np; q++) { var v2 = vx[q] * vx[q] + vy[q] * vy[q]; if (v2 > s) s = v2; } return Math.sqrt(s); }
      function jErr() { var s = 0; for (var q = 0; q < np; q++) { var e = Math.abs(J[q] - 1); if (e > s) s = e; } return s; }
      function meanDiv() { var s = 0; for (var q = 0; q < np; q++) s += Math.abs(C00[q] + C11[q]); return s / np; }
      /* Particle mass deposited on its nearest node, recomputed from current positions (P2G mass part only). */
      var nodeMass = new Float64Array(NG);
      function depositMass() {
        nodeMass.fill(0);
        for (var q = 0; q < np; q++) {
          var xp = (x[q] - ox) * invDx, yp = (y[q] - oy) * invDx;
          var bi = Math.floor(xp - 0.5), bj = Math.floor(yp - 0.5);
          var fx = xp - bi, fy = yp - bj;
          var wx = [0.5 * (1.5 - fx) * (1.5 - fx), 0.75 - (fx - 1) * (fx - 1), 0.5 * (fx - 0.5) * (fx - 0.5)];
          var wy = [0.5 * (1.5 - fy) * (1.5 - fy), 0.75 - (fy - 1) * (fy - 1), 0.5 * (fy - 0.5) * (fy - 0.5)];
          for (var j = 0; j < 3; j++) for (var i = 0; i < 3; i++) nodeMass[(bj + j) * NX + bi + i] += wx[i] * wy[j] * mp;
        }
      }
      var MTHR = 0.25 * rho0 * dx * dx;
      function supported(q) {
        var i = Math.round((x[q] - ox) * invDx), j = Math.round((y[q] - oy) * invDx);
        if (i < 0) i = 0; else if (i >= NX) i = NX - 1;
        if (j < 0) j = 0; else if (j >= NY) j = NY - 1;
        return nodeMass[j * NX + i] >= MTHR;
      }
      var cacheStep = -1;
      function ensureMass() { if (cacheStep !== sim.steps) { depositMass(); cacheStep = sim.steps; } }
      function front() {
        ensureMass();
        var f = -Infinity;
        for (var q = 0; q < np; q++) if (x[q] > f && supported(q)) f = x[q];
        return isFinite(f) ? f : null;
      }
      function columnHeight() {
        ensureMass();
        var h = 0;
        for (var q = 0; q < np; q++) if (x[q] < dx && y[q] > h && supported(q)) h = y[q];
        return h;
      }

      var mass0 = mp * np;
      var E0 = kinetic() + potential();

      /* ---------------- view ---------------- */
      var fx32 = new Float32Array(np), fy32 = new Float32Array(np), fv32 = new Float32Array(np);
      var Uref = Math.sqrt(2 * g * Hcol);
      function view(field) {
        field = field || sim.fields[0];
        var q, lo = 0, hi = 1, amx = 0;
        for (q = 0; q < np; q++) { fx32[q] = x[q]; fy32[q] = y[q]; }
        if (field === 'pressure') {
          for (q = 0; q < np; q++) fv32[q] = -E * (J[q] - 1);
          lo = 0; hi = rho0 * g * Hcol;
        } else if (field === 'J') {
          for (q = 0; q < np; q++) fv32[q] = J[q];
          var d = 3 * rho0 * g * Hcol / E; lo = 1 - d; hi = 1 + d;
        } else if (field === 'vorticity') {
          for (q = 0; q < np; q++) { var om = C10[q] - C01[q]; fv32[q] = om; var aa = Math.abs(om); if (aa > amx) amx = aa; }
          hi = amx > 0 ? amx : 1; lo = -hi;
        } else {
          for (q = 0; q < np; q++) fv32[q] = Math.sqrt(vx[q] * vx[q] + vy[q] * vy[q]);
          lo = 0; hi = Uref;
        }
        return {
          kind: 'particles', n: np, x: fx32, y: fy32, value: fv32, range: [lo, hi],
          extent: [-0.1 * a, -0.1 * a, Lx + 0.1 * a, Ly + 0.1 * a],
          walls: [[0, 0, 0, Ly], [0, 0, Lx, 0], [Lx, 0, Lx, Ly], [0, Ly, Lx, Ly]]
        };
      }

      /* ---------------- sim object ---------------- */
      var M = LAB.util.metric;
      var sim = {
        t: 0, steps: 0, dt: chooseDt(),
        fields: ['speed', 'pressure', 'vorticity', 'J'],
        step: step,
        setParam: function (key, value) { if (key === 'cfl') cfl = +value; },
        view: view,
        metrics: function () {
          var vm = vmaxNow(), ke = kinetic(), pe = potential(), fr = front(), mass = mp * np;
          return [
            M('t', 'time t', sim.t, 's', 'g'),
            M('T', 'T = t√(2g/a)', sim.t * Math.sqrt(2 * g / a), '', 'g'),
            M('steps', 'steps', sim.steps, '', 'i'),
            M('dt', 'time step dt', sim.dt, 's', 'e'),
            M('np', 'particles', np, '', 'i'),
            M('grid', 'grid nodes', NX * NY, '', 'i'),
            M('Z', 'front Z = x/a', fr == null ? NaN : fr / a, '', 'g'),
            M('Hcol', 'column height / 2a', columnHeight() / Hcol, '', 'g'),
            M('mass', 'fluid mass (per m depth)', mass, 'kg/m', 'g'),
            M('dmass', 'mass drift', Math.abs(mass - mass0) / mass0, '', 'e'),
            M('ke', 'kinetic energy', ke, 'J/m', 'g'),
            M('pe', 'potential energy', pe, 'J/m', 'g'),
            M('Erel', '(KE+PE)/E0', (ke + pe) / E0, '', 'g'),
            M('p2g', 'P2G momentum mismatch |Σm_iv_i−Σm_pv_p|/(M v_max)', p2gErr, '', 'e'),
            M('g2p', 'G2P momentum mismatch', g2pErr, '', 'e'),
            M('vmax', 'max |v|', vm, 'm/s', 'g'),
            M('mach', 'Mach max|v|/c0', vm / c0, '', 'g'),
            M('cfl', 'acoustic CFL dt(c0+|v|)/dx', sim.dt * (c0 + vm) / dx, '', 'g'),
            M('stencil', 'max|v|dt/dx', vm * sim.dt / dx, '', 'g'),
            M('dJ', 'max |J − 1|', jErr(), '', 'e'),
            M('div', 'mean |tr C| (∇·v)', meanDiv(), '1/s', 'e'),
            M('clamp', 'position clamps (cumulative)', clampCount, '', 'i')
          ];
        },
        probe: function (name) {
          if (name === 'front') return front();
          if (name === 'totals') return { mass: mp * np, ke: kinetic(), pe: potential() };
          if (name === 'column_height') return columnHeight();
          if (name === 'time') return sim.t;
          return null;
        },
        diverged: function () {
          if (!LAB.util.finiteAll(vx) || !LAB.util.finiteAll(vy) || !LAB.util.finiteAll(J) ||
              !LAB.util.finiteAll(x) || !LAB.util.finiteAll(y)) return true;
          if (vmaxNow() > c0) return true;
          return jErr() > 0.5;
        }
      };
      return sim;
    }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
