/* BrowserLab core: registries and shared numerical utilities.
 * Loaded first, in the browser and in the Node harness. See docs/CONTRACTS.md. */
(function (root) {
  'use strict';

  var LAB = root.LAB || {};
  root.LAB = LAB;

  LAB.version = '1.0.0';
  LAB.sources = LAB.sources || {};
  LAB.references = LAB.references || {};
  LAB.scenes = LAB.scenes || {};
  LAB.methods = LAB.methods || {};
  LAB.verification = LAB.verification || {};
  LAB.problems = LAB.problems || [];

  function problem(kind, id, msg) {
    LAB.problems.push({ kind: kind, id: id, msg: msg });
    if (typeof console !== 'undefined') console.warn('[LAB] ' + kind + ' ' + id + ': ' + msg);
  }

  function need(obj, keys, kind) {
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] === undefined) problem(kind, obj.id || '?', 'missing field ' + keys[i]);
    }
  }

  LAB.registerSource = function (src) {
    need(src, ['id', 'title', 'url', 'access'], 'source');
    if (LAB.sources[src.id]) problem('source', src.id, 'duplicate id (later definition wins)');
    LAB.sources[src.id] = src;
  };

  LAB.registerReference = function (ref) {
    need(ref, ['id', 'scene', 'quantity', 'source', 'kind'], 'reference');
    LAB.references[ref.id] = ref;
  };

  LAB.registerScene = function (scene) {
    need(scene, ['id', 'title', 'probes'], 'scene');
    LAB.scenes[scene.id] = scene;
  };

  LAB.registerMethod = function (m) {
    need(m, ['id', 'name', 'family', 'scenes', 'create'], 'method');
    LAB.methods[m.id] = m;
  };

  LAB.registerVerification = function (rec) {
    need(rec, ['id', 'method', 'scene', 'status', 'claim'], 'verification');
    if (['matched', 'flagged', 'incomplete'].indexOf(rec.status) < 0) {
      problem('verification', rec.id, 'invalid status ' + rec.status + ' (forced to flagged)');
      rec.status = 'flagged';
    }
    LAB.verification[rec.id] = rec;
  };

  LAB.referencesFor = function (sceneId) {
    var out = [];
    for (var k in LAB.references) if (LAB.references[k].scene === sceneId) out.push(LAB.references[k]);
    return out;
  };

  LAB.verificationFor = function (methodId, sceneId) {
    var out = [];
    for (var k in LAB.verification) {
      var v = LAB.verification[k];
      if (v.method === methodId && (!sceneId || v.scene === sceneId)) out.push(v);
    }
    return out;
  };

  /* Default params for (method, scene), with overrides. */
  LAB.defaultParams = function (methodId, sceneId, overrides) {
    var m = LAB.methods[methodId];
    if (!m) throw new Error('unknown method ' + methodId);
    var sc = m.scenes[sceneId];
    if (!sc) throw new Error(methodId + ' does not support scene ' + sceneId);
    var p = {};
    (sc.params || []).forEach(function (d) { p[d.key] = d.value; });
    if (overrides) for (var k in overrides) p[k] = overrides[k];
    return p;
  };

  /* ---------- shared numerical utilities (for methods and checks) ---------- */
  var U = LAB.util = {};

  U.clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };

  U.sum = function (a) { var s = 0, c = 0; for (var i = 0; i < a.length; i++) { var y = a[i] - c, t = s + y; c = (t - s) - y; s = t; } return s; };

  U.finiteAll = function (a) { for (var i = 0; i < a.length; i++) if (!isFinite(a[i])) return false; return true; };

  /* Linear interpolation of tabulated (xs, ys) at x; xs ascending or descending. */
  U.interp1 = function (xs, ys, x) {
    var n = xs.length;
    if (n === 0) return NaN;
    var asc = xs[n - 1] >= xs[0];
    if (asc ? x <= xs[0] : x >= xs[0]) return ys[0];
    if (asc ? x >= xs[n - 1] : x <= xs[n - 1]) return ys[n - 1];
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (asc ? xs[mid] <= x : xs[mid] >= x) lo = mid; else hi = mid;
    }
    var w = (x - xs[lo]) / (xs[hi] - xs[lo]);
    return ys[lo] * (1 - w) + ys[hi] * w;
  };

  /* Bilinear sample of a cell-centred or node field f[nx*ny] at fractional index (fx, fy). */
  U.bilinear = function (f, nx, ny, fx, fy) {
    fx = U.clamp(fx, 0, nx - 1); fy = U.clamp(fy, 0, ny - 1);
    var i0 = Math.floor(fx), j0 = Math.floor(fy);
    var i1 = Math.min(i0 + 1, nx - 1), j1 = Math.min(j0 + 1, ny - 1);
    var sx = fx - i0, sy = fy - j0;
    return (1 - sy) * ((1 - sx) * f[j0 * nx + i0] + sx * f[j0 * nx + i1]) +
           sy * ((1 - sx) * f[j1 * nx + i0] + sx * f[j1 * nx + i1]);
  };

  /* Error norms between sampled sim values and reference values. */
  U.errors = function (sim, ref) {
    var n = Math.min(sim.length, ref.length), maxAbs = 0, l1 = 0, l2 = 0, r2 = 0;
    for (var i = 0; i < n; i++) {
      var d = sim[i] - ref[i];
      maxAbs = Math.max(maxAbs, Math.abs(d)); l1 += Math.abs(d); l2 += d * d; r2 += ref[i] * ref[i];
    }
    return { maxAbs: maxAbs, l1: l1 / n, rms: Math.sqrt(l2 / n), relL2: r2 > 0 ? Math.sqrt(l2 / r2) : NaN, n: n };
  };

  /* Observed order of accuracy from errors at h and h/r. */
  U.order = function (eCoarse, eFine, r) { return Math.log(eCoarse / eFine) / Math.log(r || 2); };

  /* Zero-crossing period estimate from a uniformly or non-uniformly sampled signal. */
  U.period = function (ts, ys) {
    var mean = U.sum(ys) / ys.length, cross = [];
    for (var i = 1; i < ys.length; i++) {
      var a = ys[i - 1] - mean, b = ys[i] - mean;
      if (a < 0 && b >= 0) cross.push(ts[i - 1] + (ts[i] - ts[i - 1]) * (-a) / (b - a));
    }
    if (cross.length < 2) return NaN;
    return (cross[cross.length - 1] - cross[0]) / (cross.length - 1);
  };

  U.linspace = function (a, b, n) { var o = new Float64Array(n); for (var i = 0; i < n; i++) o[i] = a + (b - a) * i / (n - 1); return o; };

  /* Deterministic PRNG (mulberry32) so particle seeds are reproducible. */
  U.rng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* Uniform grid spatial hash for particle neighbour search. */
  U.SpatialHash = function (cell, x0, y0, x1, y1) {
    this.h = cell; this.x0 = x0; this.y0 = y0;
    this.nx = Math.max(1, Math.ceil((x1 - x0) / cell)); this.ny = Math.max(1, Math.ceil((y1 - y0) / cell));
    this.start = new Int32Array(this.nx * this.ny + 1);
    this.items = new Int32Array(0);
    this.cellOf = new Int32Array(0);
  };
  U.SpatialHash.prototype.cellIndex = function (x, y) {
    var i = Math.floor((x - this.x0) / this.h), j = Math.floor((y - this.y0) / this.h);
    i = i < 0 ? 0 : i >= this.nx ? this.nx - 1 : i; j = j < 0 ? 0 : j >= this.ny ? this.ny - 1 : j;
    return j * this.nx + i;
  };
  U.SpatialHash.prototype.build = function (x, y, n) {
    if (this.items.length < n) { this.items = new Int32Array(n); this.cellOf = new Int32Array(n); }
    var st = this.start; st.fill(0);
    for (var p = 0; p < n; p++) { var c = this.cellIndex(x[p], y[p]); this.cellOf[p] = c; st[c + 1]++; }
    for (var c2 = 0; c2 < this.nx * this.ny; c2++) st[c2 + 1] += st[c2];
    var fill = st.slice(0, this.nx * this.ny);
    for (var q = 0; q < n; q++) this.items[fill[this.cellOf[q]]++] = q;
  };
  /* Calls fn(j) for every particle in the 3x3 cell block around (x, y). */
  U.SpatialHash.prototype.query = function (x, y, fn) {
    var ci = Math.floor((x - this.x0) / this.h), cj = Math.floor((y - this.y0) / this.h);
    for (var dj = -1; dj <= 1; dj++) {
      var j = cj + dj; if (j < 0 || j >= this.ny) continue;
      for (var di = -1; di <= 1; di++) {
        var i = ci + di; if (i < 0 || i >= this.nx) continue;
        var c = j * this.nx + i;
        for (var k = this.start[c]; k < this.start[c + 1]; k++) fn(this.items[k]);
      }
    }
  };

  /* Metric helper: m('mass', 'Total mass', value, 'kg', 'e') */
  U.metric = function (key, label, value, unit, fmt) { return { key: key, label: label, value: value, unit: unit || '', fmt: fmt || 'g' }; };
})(typeof window !== 'undefined' ? window : globalThis);
