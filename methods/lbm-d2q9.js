/* Lattice Boltzmann D2Q9 BGK for the incompressible-flow scenes (cavity, taylor-green, cylinder).
 * Metadata from research/ins.json (method id 'lbm-d2q9'). See docs/CONTRACTS.md §4.
 *
 * Lattice: directions 0 rest, 1 E, 2 N, 3 W, 4 S, 5 NE, 6 NW, 7 SW, 8 SE (same numbering as the
 * research Zou-He formula). Storage is structure-of-arrays, f[i*n + node], node = j*nx + i, j=0 bottom.
 * One step is a fused "pull" stream + BGK collide: each fluid node gathers the post-collision
 * populations of its upstream neighbours (or a boundary rule), takes moments, relaxes to equilibrium
 * and writes the new post-collision populations into the second buffer.
 *
 * Unit mapping (dx = dt = 1 in lattice units):
 *   reference length L_ref = N_ref cells, reference velocity U_ref = U_lat (lattice),
 *   nu_lat = U_lat N_ref / Re, tau = 3 nu_lat + 1/2,
 *   scene time per step = U_lat / N_ref  (in L_ref / U_ref units; seconds for the cylinder).
 */
(function (LAB) {
  'use strict';

  var CX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
  var CY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
  var W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
  var OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];

  var WALL = -1;    // stationary halfway bounce-back
  var OUTLET = -2;  // unknown population at the Zou-He pressure outlet (filled after gather)
  // codes <= -3: link record k = -3 - code (moving wall / inlet / cylinder link)

  /* ------------------------------------------------------------------ lattice core */
  function Lattice(nx, ny, tau) {
    var n = nx * ny;
    this.nx = nx; this.ny = ny; this.n = n;
    this.tau = tau; this.omega = 1 / tau;
    this.fo = new Float64Array(9 * n);   // post-collision populations, current
    this.fn = new Float64Array(9 * n);   // post-collision populations, next
    this.rho = new Float64Array(n);
    this.ux = new Float64Array(n);
    this.uy = new Float64Array(n);
    this.solid = new Uint8Array(n);
    this.outlet = new Uint8Array(n);
    this.src = new Int32Array(9 * n);
    // link records
    this.nl = 0;
    this.ltype = []; this.ladd = []; this.lq = []; this.lnb = []; this.lcyl = [];
    this.Fx = 0; this.Fy = 0;       // momentum-exchange force on cylinder links, last step
    this.maxdu = 0;                 // max |u_new - u_old| (lattice) over fluid nodes, last step
    this.rhoOut = 1;
  }

  Lattice.prototype.addLink = function (type, add, q, nb, cyl) {
    this.ltype.push(type); this.ladd.push(add); this.lq.push(q); this.lnb.push(nb); this.lcyl.push(cyl);
    return -3 - (this.nl++);
  };

  Lattice.prototype.finalizeLinks = function () {
    this.ltype = Uint8Array.from(this.ltype);
    this.ladd = Float64Array.from(this.ladd);
    this.lq = Float64Array.from(this.lq);
    this.lnb = Int32Array.from(this.lnb);
    this.lcyl = Uint8Array.from(this.lcyl);
  };

  /* Set populations of node to equilibrium(rho, ux, uy) plus optional non-equilibrium part
   * from the velocity gradient (Chapman-Enskog: f_neq = -tau w rho / cs^2 Q_ab d_a u_b). */
  Lattice.prototype.setEq = function (node, rho, ux, uy, dudx, dudy, dvdx, dvdy) {
    var n = this.n, usq = ux * ux + uy * uy, tau = this.tau;
    for (var i = 0; i < 9; i++) {
      var cu = CX[i] * ux + CY[i] * uy;
      var feq = W[i] * rho * (1 + 3 * cu + 4.5 * cu * cu - 1.5 * usq);
      if (dudx !== undefined) {
        var cx = CX[i], cy = CY[i];
        var Q = (cx * cx - 1 / 3) * dudx + cx * cy * (dudy + dvdx) + (cy * cy - 1 / 3) * dvdy;
        feq -= tau * W[i] * rho * 3 * Q;
      }
      this.fo[i * n + node] = feq;
    }
    this.rho[node] = rho; this.ux[node] = ux; this.uy[node] = uy;
  };

  Lattice.prototype.step = function () {
    var n = this.n, fo = this.fo, fn = this.fn, src = this.src, solid = this.solid, outlet = this.outlet;
    var R = this.rho, UX = this.ux, UY = this.uy, om = this.omega, om1 = 1 - om;
    var ltype = this.ltype, ladd = this.ladd, lq = this.lq, lnb = this.lnb, lcyl = this.lcyl;
    var rhoOut = this.rhoOut;
    var Fx = 0, Fy = 0, maxdu = 0;

    // boundary rule for incoming population i at node with code s (< 0)
    function bc(i, node, s) {
      if (s === OUTLET) return 0;
      var o = OPP[i], fout = fo[o * n + node], fi;
      if (s === WALL) return fout;
      var k = -3 - s, t = ltype[k];
      if (t === 0) fi = fout + ladd[k];
      else {
        var q = lq[k];
        if (q < 0.5) {
          var nb = lnb[k];
          fi = nb >= 0 ? 2 * q * fout + (1 - 2 * q) * fo[o * n + nb] : fout;
        } else {
          fi = fout / (2 * q) + (2 * q - 1) / (2 * q) * fo[i * n + node];
        }
      }
      if (lcyl[k]) { Fx += CX[o] * (fout + fi); Fy += CY[o] * (fout + fi); }
      return fi;
    }

    var n1 = n, n2 = 2 * n, n3 = 3 * n, n4 = 4 * n, n5 = 5 * n, n6 = 6 * n, n7 = 7 * n, n8 = 8 * n;
    for (var x = 0; x < n; x++) {
      if (solid[x]) continue;
      var s, f0, f1, f2, f3, f4, f5, f6, f7, f8;
      f0 = fo[x];
      s = src[n1 + x]; f1 = s >= 0 ? fo[n1 + s] : bc(1, x, s);
      s = src[n2 + x]; f2 = s >= 0 ? fo[n2 + s] : bc(2, x, s);
      s = src[n3 + x]; f3 = s >= 0 ? fo[n3 + s] : bc(3, x, s);
      s = src[n4 + x]; f4 = s >= 0 ? fo[n4 + s] : bc(4, x, s);
      s = src[n5 + x]; f5 = s >= 0 ? fo[n5 + s] : bc(5, x, s);
      s = src[n6 + x]; f6 = s >= 0 ? fo[n6 + s] : bc(6, x, s);
      s = src[n7 + x]; f7 = s >= 0 ? fo[n7 + s] : bc(7, x, s);
      s = src[n8 + x]; f8 = s >= 0 ? fo[n8 + s] : bc(8, x, s);

      if (outlet[x]) {
        // Zou-He pressure (density) outlet on the right boundary, rho = rhoOut, u_y = 0;
        // unknowns W(3), NW(6), SW(7) by non-equilibrium bounce-back. Wall-sourced corner
        // populations keep their bounce-back value.
        var uo = (f0 + f2 + f4 + 2 * (f1 + f5 + f8)) / rhoOut - 1, ru = rhoOut * uo;
        if (src[n3 + x] === OUTLET) f3 = f1 - (2 / 3) * ru;
        if (src[n6 + x] === OUTLET) f6 = f8 - 0.5 * (f2 - f4) - ru / 6;
        if (src[n7 + x] === OUTLET) f7 = f5 + 0.5 * (f2 - f4) - ru / 6;
      }

      var rho = f0 + f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8;
      var ir = 1 / rho;
      var ux = (f1 - f3 + f5 - f6 - f7 + f8) * ir;
      var uy = (f2 - f4 + f5 + f6 - f7 - f8) * ir;
      var d = Math.abs(ux - UX[x]), d2 = Math.abs(uy - UY[x]);
      if (d2 > d) d = d2;
      if (d > maxdu) maxdu = d;
      R[x] = rho; UX[x] = ux; UY[x] = uy;

      var usq = 1.5 * (ux * ux + uy * uy);
      var w0r = om * rho * (4 / 9), w1r = om * rho / 9, w2r = om * rho / 36;
      var c;
      fn[x] = om1 * f0 + w0r * (1 - usq);
      c = ux;        fn[n1 + x] = om1 * f1 + w1r * (1 + 3 * c + 4.5 * c * c - usq);
      c = uy;        fn[n2 + x] = om1 * f2 + w1r * (1 + 3 * c + 4.5 * c * c - usq);
      c = -ux;       fn[n3 + x] = om1 * f3 + w1r * (1 + 3 * c + 4.5 * c * c - usq);
      c = -uy;       fn[n4 + x] = om1 * f4 + w1r * (1 + 3 * c + 4.5 * c * c - usq);
      c = ux + uy;   fn[n5 + x] = om1 * f5 + w2r * (1 + 3 * c + 4.5 * c * c - usq);
      c = -ux + uy;  fn[n6 + x] = om1 * f6 + w2r * (1 + 3 * c + 4.5 * c * c - usq);
      c = -ux - uy;  fn[n7 + x] = om1 * f7 + w2r * (1 + 3 * c + 4.5 * c * c - usq);
      c = ux - uy;   fn[n8 + x] = om1 * f8 + w2r * (1 + 3 * c + 4.5 * c * c - usq);
    }
    this.fo = fn; this.fn = fo;
    this.Fx = Fx; this.Fy = Fy; this.maxdu = maxdu;
  };

  Lattice.prototype.mass = function () {
    var s = 0, c = 0, R = this.rho, solid = this.solid;
    for (var x = 0; x < this.n; x++) if (!solid[x]) { var y = R[x] - c, t = s + y; c = (t - s) - y; s = t; }
    return s;
  };

  /* ------------------------------------------------------------------ shared helpers */
  function vorticity(L, dxs, uscale, periodic) {
    // omega = dv/dx - du/dy in scene units; one-sided at non-periodic edges / next to solids
    var nx = L.nx, ny = L.ny, ux = L.ux, uy = L.uy, solid = L.solid;
    var out = new Float32Array(L.n);
    for (var j = 0; j < ny; j++) {
      for (var i = 0; i < nx; i++) {
        var x = j * nx + i;
        if (solid[x]) { out[x] = 0; continue; }
        var ip = i + 1, im = i - 1, jp = j + 1, jm = j - 1;
        if (periodic) { ip %= nx; im = (im + nx) % nx; jp %= ny; jm = (jm + ny) % ny; }
        var a = (ip < nx && !solid[j * nx + ip]) ? ip : i, b = (im >= 0 && !solid[j * nx + im]) ? im : i;
        var cc = (jp < ny && !solid[jp * nx + i]) ? jp : j, e = (jm >= 0 && !solid[jm * nx + i]) ? jm : j;
        var hx = periodic ? 2 : (a - b), hy = periodic ? 2 : (cc - e);
        var dvdx = hx ? (uy[j * nx + a] - uy[j * nx + b]) / hx : 0;
        var dudy = hy ? (ux[cc * nx + i] - ux[e * nx + i]) / hy : 0;
        out[x] = (dvdx - dudy) * uscale / dxs;
      }
    }
    return out;
  }

  function maxDivergence(L, dxs, uscale, periodic) {
    var nx = L.nx, ny = L.ny, ux = L.ux, uy = L.uy, solid = L.solid, m = 0;
    for (var j = 0; j < ny; j++) {
      var jp = j + 1, jm = j - 1;
      if (periodic) { jp %= ny; jm = (jm + ny) % ny; } else if (jm < 0 || jp >= ny) continue;
      for (var i = 0; i < nx; i++) {
        var ip = i + 1, im = i - 1;
        if (periodic) { ip %= nx; im = (im + nx) % nx; } else if (im < 0 || ip >= nx) continue;
        var x = j * nx + i;
        if (solid[x] || solid[j * nx + ip] || solid[j * nx + im] || solid[jp * nx + i] || solid[jm * nx + i]) continue;
        var dv = 0.5 * (ux[j * nx + ip] - ux[j * nx + im] + uy[jp * nx + i] - uy[jm * nx + i]);
        if (Math.abs(dv) > m) m = Math.abs(dv);
      }
    }
    return m * uscale / dxs;
  }

  function fieldView(L, field, opts) {
    var n = L.n, data = new Float32Array(n), solid = L.solid, lo = 0, hi = 0, cmap = 'sequential';
    var i;
    if (field === 'vorticity') {
      data = vorticity(L, opts.dx, opts.uscale, opts.periodic);
      var m = 0;
      for (i = 0; i < n; i++) if (!solid[i] && Math.abs(data[i]) > m) m = Math.abs(data[i]);
      // clip to a robust level: corners of the cavity are singular
      if (opts.vortClip) m = Math.min(m, opts.vortClip);
      lo = -m; hi = m; cmap = 'diverging';
    } else if (field === 'pressure') {
      var mean = 0, cnt = 0;
      for (i = 0; i < n; i++) if (!solid[i]) { mean += L.rho[i]; cnt++; }
      mean /= cnt;
      var ma = 0;
      for (i = 0; i < n; i++) {
        if (solid[i]) { data[i] = 0; continue; }
        data[i] = (L.rho[i] - mean) / 3 * opts.pscale;
        if (Math.abs(data[i]) > ma) ma = Math.abs(data[i]);
      }
      lo = -ma; hi = ma; cmap = 'diverging';
    } else if (field === 'ux' || field === 'uy') {
      var arr = field === 'ux' ? L.ux : L.uy, mx = 0;
      for (i = 0; i < n; i++) {
        data[i] = solid[i] ? 0 : arr[i] * opts.uscale;
        if (Math.abs(data[i]) > mx) mx = Math.abs(data[i]);
      }
      lo = -mx; hi = mx; cmap = 'diverging';
    } else { // speed
      for (i = 0; i < n; i++) {
        data[i] = solid[i] ? 0 : Math.sqrt(L.ux[i] * L.ux[i] + L.uy[i] * L.uy[i]) * opts.uscale;
        if (data[i] > hi) hi = data[i];
      }
    }
    if (!(hi > lo)) { hi = lo + 1e-12; }
    var d = { kind: 'field', nx: L.nx, ny: L.ny, data: data, range: [lo, hi], cmap: cmap, extent: opts.extent };
    if (opts.mask) d.mask = solid;
    return d;
  }

  function maxSpeed(L) {
    var m = 0, ux = L.ux, uy = L.uy, solid = L.solid;
    for (var i = 0; i < L.n; i++) if (!solid[i]) { var s = ux[i] * ux[i] + uy[i] * uy[i]; if (s > m) m = s; }
    return Math.sqrt(m);
  }

  function meanKE(L) {
    var s = 0, cnt = 0, ux = L.ux, uy = L.uy, solid = L.solid;
    for (var i = 0; i < L.n; i++) if (!solid[i]) { s += 0.5 * (ux[i] * ux[i] + uy[i] * uy[i]); cnt++; }
    return cnt ? s / cnt : 0;
  }

  function finiteState(L) {
    var R = L.rho;
    for (var i = 0; i < L.n; i++) { var r = R[i]; if (!(r > 0 && r < 10) && !L.solid[i]) return false; }
    return true;
  }

  function M(key, label, value, unit, fmt) { return { key: key, label: label, value: value, unit: unit || '', fmt: fmt || 'g' }; }

  /* ------------------------------------------------------------------ cavity */
  function createCavity(p) {
    var N = Math.max(8, Math.round(+p.N)), Re = +p.Re, U = +p.Ulat;
    var nu = U * N / Re, tau = 3 * nu + 0.5;
    var L = new Lattice(N, N, tau);
    var n = L.n;
    // connectivity: halfway bounce-back on all walls; lid (above top row) moves with (U, 0)
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var x = j * N + i;
      for (var d = 1; d < 9; d++) {
        var si = i - CX[d], sj = j - CY[d], code;
        if (sj >= N) {
          // incoming from the lid: f_d = f~_opp + 6 w_d rho0 (c_d . u_w)
          code = L.addLink(0, 6 * W[d] * 1.0 * (CX[d] * U), 0.5, -1, 0);
        } else if (si < 0 || si >= N || sj < 0) code = WALL;
        else code = sj * N + si;
        L.src[d * n + x] = code;
      }
      L.setEq(x, 1, 0, 0);
    }
    L.finalizeLinks();
    var dts = U / N;     // scene time (L/U) per step
    var m0 = L.mass();

    // stream function psi(x_i, y) = int_0^y u dy at cell-centre columns, face rows (psi = 0 on bottom)
    function psiField() {
      var psi = new Float64Array(N * (N + 1));
      for (var i = 0; i < N; i++) {
        var acc = 0; psi[i] = 0;
        for (var j = 0; j < N; j++) { acc += L.ux[j * N + i] / U / N; psi[(j + 1) * N + i] = acc; }
      }
      return psi;
    }
    function vortex() {
      var psi = psiField(), best = Infinity, bi = 0, bj = 0;
      for (var j = 1; j < N; j++) for (var i = 1; i < N - 1; i++) {
        var v = psi[j * N + i];
        if (v < best) { best = v; bi = i; bj = j; }
      }
      // parabolic sub-cell refinement in each direction
      var xo = 0, yo = 0;
      if (bi > 0 && bi < N - 1) {
        var a = psi[bj * N + bi - 1], b = psi[bj * N + bi], c = psi[bj * N + bi + 1], den = a - 2 * b + c;
        if (den > 0) { xo = 0.5 * (a - c) / den; best = Math.min(best, b - 0.25 * (a - c) * xo); }
      }
      if (bj > 0 && bj < N) {
        var a2 = psi[(bj - 1) * N + bi], b2 = psi[bj * N + bi], c2 = psi[(bj + 1) * N + bi], den2 = a2 - 2 * b2 + c2;
        if (den2 > 0) yo = 0.5 * (a2 - c2) / den2;
      }
      return { psi: best, x: (bi + 0.5 + xo) / N, y: (bj + yo) / N };
    }

    var sim = {
      t: 0, steps: 0, dt: dts,
      fields: ['speed', 'vorticity', 'pressure', 'ux', 'uy'],
      step: function () { L.step(); sim.steps++; sim.t = sim.steps * dts; },
      setParam: function () {},
      view: function (field) {
        return fieldView(L, field || 'speed', { dx: 1 / N, uscale: 1 / U, pscale: 1 / (U * U),
          periodic: false, extent: [0, 0, 1, 1], vortClip: 20 });
      },
      metrics: function () {
        var ms = L.mass(), umax = maxSpeed(L);
        return [
          M('t', 'time t (L/U)', sim.t), M('steps', 'steps', sim.steps, '', 'i'),
          M('tau', 'relaxation time τ', tau), M('nu', 'ν (lattice)', nu, '', 'e'),
          M('mass', 'total mass Σρ (lattice)', ms, '', 'e'),
          M('dmass', '|M − M0|/M0', Math.abs(ms - m0) / m0, '', 'e'),
          M('ke', 'mean KE ½|u|² (U²)', meanKE(L) / (U * U), '', 'e'),
          M('umax', 'max |u| / U_lid', umax / U),
          M('mach', 'max Mach |u|/c_s', umax * Math.sqrt(3)),
          M('residual', 'residual max|Δu|/Δt', L.maxdu / U / dts, '', 'e'),
          M('div', 'max |∇·u| (U/L)', maxDivergence(L, 1 / N, 1 / U, false), '', 'e')
        ];
      },
      probe: function (name) {
        var i, j, k;
        if (name === 'u_vcl') {
          var ys = [0], us = [0];
          for (j = 0; j < N; j++) { ys.push((j + 0.5) / N); us.push(LAB.util.bilinear(L.ux, N, N, 0.5 * N - 0.5, j) / U); }
          ys.push(1); us.push(1);
          return { y: ys, u: us };
        }
        if (name === 'v_hcl') {
          var xs = [0], vs = [0];
          for (i = 0; i < N; i++) { xs.push((i + 0.5) / N); vs.push(LAB.util.bilinear(L.uy, N, N, i, 0.5 * N - 0.5) / U); }
          xs.push(1); vs.push(0);
          return { x: xs, v: vs };
        }
        if (name === 'psi_min') return vortex().psi;
        if (name === 'vortex_center') { k = vortex(); return { x: k.x, y: k.y }; }
        if (name === 'residual') return L.maxdu / U / dts;
        if (name === 'time') return sim.t;
        return null;
      },
      diverged: function () { return !finiteState(L); }
    };
    return sim;
  }

  /* ------------------------------------------------------------------ Taylor-Green */
  function createTG(p) {
    var N = Math.max(8, Math.round(+p.N)), Re = +p.Re, U = +p.Ulat;
    var dx = 2 * Math.PI / N;           // scene length per cell (k = 1, box [0, 2 pi])
    var Lref = 1 / dx;                  // cells per unit length 1/k
    var nu = U * Lref / Re, tau = 3 * nu + 0.5;
    var L = new Lattice(N, N, tau);
    var n = L.n;
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var x = j * N + i;
      for (var d = 1; d < 9; d++) {
        var si = (i - CX[d] + N) % N, sj = (j - CY[d] + N) % N;
        L.src[d * n + x] = sj * N + si;
      }
      // analytic initial state in lattice units (U0 -> U, length 1/k -> Lref cells)
      var X = (i + 0.5) * dx, Y = (j + 0.5) * dx;
      var u = -U * Math.cos(X) * Math.sin(Y), v = U * Math.sin(X) * Math.cos(Y);
      var pr = -0.25 * U * U * (Math.cos(2 * X) + Math.cos(2 * Y));       // lattice pressure, rho0 = 1
      var rho = 1 + 3 * pr;                                                // p = c_s^2 (rho - rho0)
      // gradients per lattice cell
      var dudx = U * Math.sin(X) * Math.sin(Y) / Lref, dudy = -U * Math.cos(X) * Math.cos(Y) / Lref;
      var dvdx = U * Math.cos(X) * Math.cos(Y) / Lref, dvdy = -U * Math.sin(X) * Math.sin(Y) / Lref;
      L.setEq(x, rho, u, v, dudx, dudy, dvdx, dvdy);
    }
    L.finalizeLinks();
    var dts = U / Lref;
    var m0 = L.mass();
    function ke() { return meanKE(L) / (U * U); }
    var ke0 = ke();
    function l2() {
      var F = Math.exp(-2 * sim.t / Re), num = 0, den = 0;
      for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
        var X = (i + 0.5) * dx, Y = (j + 0.5) * dx, x = j * N + i;
        var ua = -Math.cos(X) * Math.sin(Y) * F, va = Math.sin(X) * Math.cos(Y) * F;
        var du = L.ux[x] / U - ua, dv = L.uy[x] / U - va;
        num += du * du + dv * dv; den += ua * ua + va * va;
      }
      return Math.sqrt(num / den);
    }
    function momentum() {
      var px = 0, py = 0;
      for (var x = 0; x < n; x++) { px += L.rho[x] * L.ux[x]; py += L.rho[x] * L.uy[x]; }
      return Math.sqrt(px * px + py * py);
    }
    var sim = {
      t: 0, steps: 0, dt: dts,
      fields: ['vorticity', 'speed', 'pressure', 'ux', 'uy'],
      step: function () { L.step(); sim.steps++; sim.t = sim.steps * dts; },
      setParam: function () {},
      view: function (field) {
        return fieldView(L, field || 'vorticity', { dx: dx, uscale: 1 / U, pscale: 1 / (U * U),
          periodic: true, extent: [0, 0, 2 * Math.PI, 2 * Math.PI] });
      },
      metrics: function () {
        var ms = L.mass(), umax = maxSpeed(L), k = ke();
        return [
          M('t', 'time t (1/(kU0))', sim.t), M('steps', 'steps', sim.steps, '', 'i'),
          M('tau', 'relaxation time τ', tau), M('nu', 'ν (lattice)', nu, '', 'e'),
          M('mass', 'total mass Σρ (lattice)', ms, '', 'e'),
          M('dmass', '|M − M0|/M0', Math.abs(ms - m0) / m0, '', 'e'),
          M('mom', '|Σρu| (lattice)', momentum(), '', 'e'),
          M('ke', 'mean KE ½|u|²', k, '', 'e'),
          M('keratio', 'KE / KE0', k / ke0),
          M('l2', 'rel. L2 velocity error', l2(), '', 'e'),
          M('umax', 'max |u| / U0', umax / U),
          M('mach', 'max Mach |u|/c_s', umax * Math.sqrt(3)),
          M('div', 'max |∇·u| (kU0)', maxDivergence(L, dx, 1 / U, true), '', 'e')
        ];
      },
      probe: function (name) {
        if (name === 'kinetic_energy') return ke();
        if (name === 'l2_error') return l2();
        if (name === 'time') return sim.t;
        return null;
      },
      diverged: function () { return !finiteState(L); }
    };
    return sim;
  }

  /* ------------------------------------------------------------------ cylinder (Schafer-Turek 2D) */
  function createCylinder(p) {
    var res = Math.max(4, Math.round(+p.res));       // cells per diameter
    var Re = +p.Re, UmLat = +p.Ulat, ibb = +p.ibb ? 1 : 0;
    var D = 0.1, H = 0.41, Lx = 2.2, cxp = 0.2, cyp = 0.2, nuP = 1e-3;
    var UbarP = Re * nuP / D, UmP = 1.5 * UbarP;     // physical mean and peak inflow
    var dx = D / res;
    var nx = Math.round(Lx / dx), ny = Math.round(H / dx);
    var Hl = ny;                                      // channel height in lattice units (walls halfway)
    var UbarLat = UmLat * 2 / 3;
    var nu = UbarLat * res / Re, tau = 3 * nu + 0.5;
    var dtP = UbarLat / UbarP * dx;                  // physical seconds per step
    var vscale = UbarP / UbarLat;                    // lattice velocity -> m/s
    var L = new Lattice(nx, ny, tau);
    var n = L.n;
    var r = 0.5 * D / dx, ccx = cxp / dx, ccy = cyp / dx; // cylinder in lattice coords (node centres at i+0.5)
    function inside(i, j) { var a = i + 0.5 - ccx, b = j + 0.5 - ccy; return a * a + b * b < r * r; }
    function uin(j) { var y = j + 0.5; return 4 * UmLat * y * (Hl - y) / (Hl * Hl); }

    var i, j, x, d;
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) if (inside(i, j)) L.solid[j * nx + i] = 1;

    var nCylLinks = 0;
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
      x = j * nx + i;
      if (L.solid[x]) continue;
      if (i === nx - 1) L.outlet[x] = 1;
      for (d = 1; d < 9; d++) {
        var si = i - CX[d], sj = j - CY[d], code;
        if (sj < 0 || sj >= ny) code = WALL;                       // channel walls (halfway)
        else if (si < 0) code = L.addLink(0, 6 * W[d] * CX[d] * uin(j), 0.5, -1, 0); // inlet: moving-wall BB
        else if (si >= nx) code = OUTLET;
        else if (L.solid[sj * nx + si]) {
          // link from fluid node x towards the solid along direction o = OPP[d]
          var o = OPP[d], q = 0.5, nb = -1;
          if (ibb) {
            // distance along c_o from node centre to the circle, as a fraction of |c_o|
            var px0 = i + 0.5 - ccx, py0 = j + 0.5 - ccy, ex = CX[o], ey = CY[o];
            var A = ex * ex + ey * ey, B = 2 * (px0 * ex + py0 * ey), C = px0 * px0 + py0 * py0 - r * r;
            var disc = B * B - 4 * A * C;
            q = disc >= 0 ? (-B - Math.sqrt(disc)) / (2 * A) : 0.5;
            if (!(q > 0) || q > 1) q = 0.5;
            var bi = i + CX[d], bj = j + CY[d];                      // fluid node behind x (x - c_o)
            if (bi >= 0 && bi < nx && bj >= 0 && bj < ny && !L.solid[bj * nx + bi]) nb = bj * nx + bi;
          }
          code = L.addLink(ibb ? 1 : 0, 0, q, nb, 1);
          nCylLinks++;
        } else code = sj * nx + si;
        L.src[d * n + x] = code;
      }
      L.setEq(x, 1, uin(j), 0);
    }
    L.finalizeLinks();

    var m0 = L.mass();
    var Fx = 0, Fy = 0;

    // pressure (physical, rho = 1) at a point on y, extrapolated linearly from the two nearest
    // fluid nodes on the given side (-1: upstream / left, +1: downstream / right)
    function pRow(jr, xl, side) {
      var ii = side < 0 ? Math.floor(xl - 0.5) : Math.ceil(xl - 0.5);
      while (ii >= 0 && ii < nx && L.solid[jr * nx + ii]) ii += side;
      var i2 = ii + side;
      var p1 = (L.rho[jr * nx + ii] - 1) / 3, p2 = (L.rho[jr * nx + i2] - 1) / 3;
      var x1 = ii + 0.5, x2 = i2 + 0.5;
      return p1 + (p1 - p2) * (xl - x1) / (x1 - x2);
    }
    function pAt(xp, yp, side) {
      var xl = xp / dx, fy = yp / dx - 0.5, j0 = Math.floor(fy), w = fy - j0;
      var a = pRow(j0, xl, side), b = w > 0 ? pRow(j0 + 1, xl, side) : a;
      return ((1 - w) * a + w * b) * vscale * vscale;
    }
    function forces() {
      var norm = 0.5 * 1 * UbarLat * UbarLat * res;  // ½ rho0 Ubar² D in lattice units
      return { cd: L.Fx / norm, cl: L.Fy / norm };
    }

    var mask = L.solid;
    var sim = {
      t: 0, steps: 0, dt: dtP,
      fields: ['speed', 'vorticity', 'pressure', 'ux', 'uy'],
      step: function () { L.step(); sim.steps++; sim.t = sim.steps * dtP; },
      setParam: function () {},
      view: function (field) {
        return fieldView(L, field || 'speed', { dx: dx, uscale: vscale, pscale: vscale * vscale,
          periodic: false, extent: [0, 0, nx * dx, ny * dx], mask: true });
      },
      metrics: function () {
        var ms = L.mass(), umax = maxSpeed(L), f = forces();
        return [
          M('t', 'time t', sim.t, 's'), M('steps', 'steps', sim.steps, '', 'i'),
          M('nx', 'grid nx', nx, '', 'i'), M('ny', 'grid ny', ny, '', 'i'),
          M('tau', 'relaxation time τ', tau), M('nu', 'ν (lattice)', nu, '', 'e'),
          M('cd', 'drag coefficient C_D', f.cd), M('cl', 'lift coefficient C_L', f.cl),
          M('dp', 'Δp = p(0.15,0.2) − p(0.25,0.2)', sim.probe('pressure_drop'), 'Pa·m³/kg'),
          M('mass', 'total mass Σρ (lattice)', ms, '', 'e'),
          M('dmass', '(M − M0)/M0 (open domain)', (ms - m0) / m0, '', 'e'),
          M('umax', 'max |u|', umax * vscale, 'm/s'),
          M('mach', 'max Mach |u|/c_s', umax * Math.sqrt(3)),
          M('cfl', 'CFL |u|max Δt/Δx', umax),
          M('div', 'max |∇·u|', maxDivergence(L, dx, vscale, false), '1/s', 'e'),
          M('links', 'cylinder boundary links', nCylLinks, '', 'i')
        ];
      },
      probe: function (name) {
        if (name === 'forces') return forces();
        if (name === 'pressure_drop') return pAt(cxp - 0.5 * D, cyp, -1) - pAt(cxp + 0.5 * D, cyp, 1);
        if (name === 'time') return sim.t;
        return null;
      },
      diverged: function () { return !finiteState(L); }
    };
    return sim;
  }

  /* ------------------------------------------------------------------ registration */
  LAB.registerMethod({
    id: 'lbm-d2q9',
    name: 'Lattice Boltzmann D2Q9 BGK',
    family: 'mesoscopic',
    summary: 'The fluid is a set of particle populations moving on a square lattice with nine ' +
      'velocities (rest, four axis and four diagonal directions). Each step, every population hops to ' +
      'the neighbouring node it points to and then relaxes towards a local equilibrium with a single ' +
      'relaxation time tau (BGK collision). Density and velocity are moments of the populations, the ' +
      'pressure is c_s^2 rho, and the kinematic viscosity is (tau - 1/2)/3 in lattice units. The ' +
      'scheme is explicit and local. It recovers incompressible Navier-Stokes when the Mach number is ' +
      'small, with errors of order Ma^2. Walls use halfway bounce-back, the moving lid and the inflow ' +
      'use bounce-back with a wall-momentum correction, and the cylinder outlet fixes the density with a ' +
      'Zou-He pressure condition. Forces on the cylinder come from the momentum exchanged across ' +
      'boundary links.',
    sources: ['qian1992', 'he1997', 'hou1995', 'zou1997', 'ladd1994'],
    equations: [
      { label: 'LBGK update (collide + stream)',
        tex: 'f_i(\\mathbf{x}+\\mathbf{c}_i\\Delta t,\\,t+\\Delta t)=f_i(\\mathbf{x},t)-\\frac{1}{\\tau}\\left[f_i(\\mathbf{x},t)-f_i^{eq}(\\mathbf{x},t)\\right]',
        source: 'qian1992', location: 'LBGK equation (eq. number unverified; cited via hou1995 Sec. 2, search-snippet only)' },
      { label: 'D2Q9 equilibrium',
        tex: 'f_i^{eq}=w_i\\rho\\left[1+\\frac{\\mathbf{c}_i\\cdot\\mathbf{u}}{c_s^2}+\\frac{(\\mathbf{c}_i\\cdot\\mathbf{u})^2}{2c_s^4}-\\frac{\\mathbf{u}\\cdot\\mathbf{u}}{2c_s^2}\\right],\\quad c_s^2=\\tfrac{1}{3},\\; w_0=\\tfrac49,\\; w_{1..4}=\\tfrac19,\\; w_{5..8}=\\tfrac1{36}',
        source: 'qian1992', location: 'D2Q9 model (also derived in he1997); unverified' },
      { label: 'Moments',
        tex: '\\rho=\\sum_i f_i,\\qquad \\rho\\mathbf{u}=\\sum_i f_i\\mathbf{c}_i,\\qquad p=c_s^2\\rho',
        source: 'qian1992', location: 'unverified' },
      { label: 'Viscosity-relaxation relation (lattice units)',
        tex: '\\nu=c_s^2\\left(\\tau-\\tfrac12\\right)\\Delta t=\\tfrac{1}{3}\\left(\\tau-\\tfrac12\\right)',
        source: 'he1997', location: 'Chapman-Enskog result; unverified' },
      { label: 'Halfway bounce-back with moving wall',
        tex: 'f_{\\bar i}(\\mathbf{x}_f,t+\\Delta t)=\\tilde f_i(\\mathbf{x}_f,t)-2w_i\\rho\\frac{\\mathbf{c}_i\\cdot\\mathbf{u}_w}{c_s^2}',
        source: 'ladd1994', location: 'moving-boundary rule; section NOT confirmed (abstract only)' },
      { label: 'Zou-He velocity BC, top wall (lid) u_w=(U,0); unknowns f4 (S), f7 (SW), f8 (SE); numbering 1E 2N 3W 4S 5NE 6NW 7SW 8SE',
        tex: '\\rho=f_0+f_1+f_3+2(f_2+f_5+f_6),\\; f_4=f_2,\\; f_7=f_5+\\tfrac12(f_1-f_3)-\\tfrac12\\rho U,\\; f_8=f_6-\\tfrac12(f_1-f_3)+\\tfrac12\\rho U',
        source: 'zou1997', location: 'non-equilibrium bounce-back principle (paper writes the bottom/inlet versions); rotated to the lid here and checked numerically to reproduce rho and rho*u to round-off; eq. numbers unverified' }
    ],
    assumptions: [
      'Low Mach number: Ma = U/c_s << 1 (compressibility error O(Ma^2)); typical lid U <= 0.1 lattice units',
      'Isothermal, weakly compressible; recovers incompressible NS only in the limit Ma->0',
      'Uniform lattice, dx=dt=1 in lattice units',
      'Steady results require convergence (residual) rather than fixed step counts',
      'Unit mapping: nu_lat = U_lat N_ref / Re, tau = 3 nu_lat + 1/2; one step = U_lat/N_ref scene time units (cylinder: seconds, with N_ref = cells per D and U_ref = mean inflow Ubar)',
      'Cavity lid uses the moving-wall bounce-back rule (ladd1994), not the Zou-He lid formula listed for reference; it handles the lid corners without a special convention and conserves mass exactly',
      'Cylinder: staircase (halfway) bounce-back by default (geometry first order); ibb=1 switches to linear interpolated bounce-back (Bouzidi, Firdaouss & Lallemand 2001), which is not among the registered research sources',
      'Cylinder outlet: Zou-He pressure condition rho = 1 (u_y = 0) on the last column, formulas derived by the builder from the same non-equilibrium bounce-back principle as the research lid formula; this replaces the benchmark do-nothing outflow',
      'Taylor-Green initial state: equilibrium with rho = 1 + p/c_s^2 from the analytic pressure, plus the first-order non-equilibrium part from the analytic velocity gradient'
    ],
    stability: 'tau > 1/2 (positive viscosity); in practice tau >~ 0.51-0.55 with BGK, otherwise high-Re runs blow up. ' +
      'Keep Ma = U_lb/c_s < ~0.3 (U_lb < ~0.17), preferably U_lb <= 0.1 for accuracy. Since Re = U_lb N/nu_lb, ' +
      'tau = 1/2 + 3 U_lb N/Re (research/ins.json, after he1997 / hou1995; hou1995 stable ranges not read).',
    scenes: {
      cavity: {
        params: [
          { key: 'Re', label: 'Reynolds number', min: 10, max: 5000, step: 10, value: 100, live: false },
          { key: 'N', label: 'Grid cells per side', min: 32, max: 512, step: 16, value: 128, live: false },
          { key: 'Ulat', label: 'Lid speed (lattice units, sets Mach and Δt)', min: 0.01, max: 0.2, step: 0.01, value: 0.1, live: false }
        ],
        notes: 'Halfway bounce-back on the three stationary walls, moving-wall bounce-back on the lid ' +
          '(net mass flux zero per node, so total mass is conserved to round-off). tau = 0.5 + 3 Ulat N / Re; ' +
          'at Re=1000 use N >= 128 (tau 0.538 at N=128). One time unit L/U = N/Ulat steps. psi = int_0^y u dy ' +
          'at cell-centre columns; vortex centre refined by a parabolic fit.'
      },
      'taylor-green': {
        params: [
          { key: 'Re', label: 'Reynolds number U0/(k ν)', min: 10, max: 2000, step: 10, value: 100, live: false },
          { key: 'N', label: 'Grid cells per side (box 2π)', min: 16, max: 512, step: 16, value: 128, live: false },
          { key: 'Ulat', label: 'U0 in lattice units (sets Mach and Δt)', min: 0.005, max: 0.2, step: 0.005, value: 0.05, live: false }
        ],
        notes: 'Fully periodic. Length unit 1/k = N/(2π) cells, so one time unit 1/(kU0) = N/(2π Ulat) steps. ' +
          'Nodes at cell centres x = (i+½)·2π/N.'
      },
      cylinder: {
        params: [
          { key: 'Re', label: 'Reynolds number Ū D/ν (20: 2D-1, 100: 2D-2)', min: 10, max: 200, step: 10, value: 20, live: false },
          { key: 'res', label: 'Cells per diameter D', min: 10, max: 80, step: 10, value: 20, live: false },
          { key: 'Ulat', label: 'Peak inflow Um in lattice units (sets Mach and Δt)', min: 0.02, max: 0.2, step: 0.01, value: 0.1, live: false },
          { key: 'ibb', label: 'Interpolated (Bouzidi) bounce-back on cylinder (0/1)', min: 0, max: 1, step: 1, value: 0, live: false }
        ],
        notes: 'Channel 2.2 x 0.41 m, D = 0.1 m at (0.2, 0.2), nu = 1e-3 m^2/s, Um = 1.5 Re nu / D (0.3 at Re=20, 1.5 at Re=100). ' +
          'Grid 22·res x 4.1·res cells; walls halfway; inflow by moving-wall bounce-back with the parabolic profile ' +
          'evaluated at node height; outlet by Zou-He pressure rho = 1. Forces by momentum exchange on cylinder links, ' +
          'C = 2F/(rho Ū^2 D), Ū = 2Um/3. Δp from p = c_s^2 (rho − 1) converted with (Ū/Ū_lat)^2, linearly ' +
          'extrapolated from the fluid side to (0.15, 0.2) and (0.25, 0.2). Time in seconds. Field starts from the ' +
          'inflow profile. Re=100 at res=10 gives tau ≈ 0.52 (near the BGK limit); prefer res >= 20 there.'
      }
    },

    create: function (sceneId, params) {
      if (sceneId === 'cavity') return createCavity(params);
      if (sceneId === 'taylor-green') return createTG(params);
      if (sceneId === 'cylinder') return createCylinder(params);
      throw new Error('lbm-d2q9 does not support scene ' + sceneId);
    }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
