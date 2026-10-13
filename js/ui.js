/* BrowserLab UI. Reads registries populated by core/scenes/references/methods/verification. */
(function (LAB) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var CSS = getComputedStyle(document.documentElement);
  var C = {
    bg: '#07090b', line: '#222830', grid: '#1a1f25', text: '#d5d9de', dim: '#8b939c', faint: '#5b636c',
    sim: '#f2b33d', ref: '#f2f2f2', ok: '#4cc38a', flag: '#e5673a', bad: '#e5484d', inc: '#8d96a0',
    series: ['#f2b33d', '#5fb4e6', '#4cc38a', '#e5673a', '#c3c9cf']
  };

  /* ---------------- state ---------------- */
  var S = { scene: null, exp: null, method: null, params: {}, sim: null, running: false, spf: 5,
    field: null, hist: {}, histT: [], err: null, ke0: null, inv0: null, tot0: null, frame: 0, lastFps: 0, fpsT: 0, fpsN: 0 };

  /* ---------------- colormaps ---------------- */
  function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function lut(stops) {
    var out = new Uint8Array(256 * 3), cs = stops.map(hex);
    for (var i = 0; i < 256; i++) {
      var f = i / 255 * (cs.length - 1), k = Math.min(Math.floor(f), cs.length - 2), w = f - k;
      for (var c = 0; c < 3; c++) out[i * 3 + c] = Math.round(cs[k][c] * (1 - w) + cs[k + 1][c] * w);
    }
    return out;
  }
  var CMAPS = {
    sequential: lut(['#07090b', '#13293d', '#1f5a6e', '#3f8f7f', '#c9a53a', '#f2b33d', '#fff4dc']),
    diverging: lut(['#9fd3ff', '#2f7fc1', '#132a40', '#07090b', '#4a2112', '#c8532b', '#ffc9a8']),
    mono: lut(['#07090b', '#d5d9de'])
  };
  function cssLut(name) { var l = CMAPS[name] || CMAPS.sequential, s = []; for (var i = 0; i <= 8; i++) { var k = Math.round(i / 8 * 255) * 3; s.push('rgb(' + l[k] + ',' + l[k + 1] + ',' + l[k + 2] + ') ' + (i * 12.5) + '%'); } return 'linear-gradient(90deg,' + s.join(',') + ')'; }

  /* ---------------- number formatting ---------------- */
  function fmt(v, f) {
    if (v == null || (typeof v === 'number' && isNaN(v))) return '—';
    if (typeof v !== 'number') return esc(v);
    if (!isFinite(v)) return v > 0 ? '+∞' : '−∞';
    if (f === 'e' || (v !== 0 && (Math.abs(v) < 1e-3 || Math.abs(v) >= 1e5))) return v.toExponential(3).replace('e', 'e');
    if (f === 'i') return Math.round(v).toString();
    return Number(v.toPrecision(5)).toString();
  }

  /* ---------------- plotting ---------------- */
  function niceTicks(lo, hi, n) {
    if (!(hi > lo)) { hi = lo + 1; }
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = n / span * step;
    if (err <= 0.15) step *= 10; else if (err <= 0.35) step *= 5; else if (err <= 0.75) step *= 2;
    var t = [], s = Math.ceil(lo / step) * step;
    for (var x = s; x <= hi + step * 1e-9; x += step) t.push(Math.abs(x) < step * 1e-9 ? 0 : x);
    return t;
  }
  function setupCanvas(cv, cssH) {
    var dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 300, h = cssH || cv.clientHeight || 190;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }
  /* spec: {xlabel, ylabel, series:[{x,y,color,dash,points,width}], ylog, equal, xrange, yrange, bands:[{y0,y1,color}]} */
  function drawPlot(ctx, R, spec) {
    var L = 46, B = 26, T = 8, Rr = 10, x0 = R.x + L, y0 = R.y + T, pw = R.w - L - Rr, ph = R.h - T - B;
    ctx.fillStyle = C.bg; ctx.fillRect(R.x, R.y, R.w, R.h);
    var xs = [], ys = [], ylog = spec.ylog;
    spec.series.forEach(function (s) { for (var i = 0; i < s.x.length; i++) { var yv = s.y[i]; if (isFinite(s.x[i]) && isFinite(yv) && (!ylog || yv > 0)) { xs.push(s.x[i]); ys.push(ylog ? Math.log10(yv) : yv); } } });
    (spec.bands || []).forEach(function (b) { ys.push(ylog ? Math.log10(b.y0) : b.y0, ylog ? Math.log10(b.y1) : b.y1); });
    var xr = spec.xrange || [Math.min.apply(null, xs.length ? xs : [0]), Math.max.apply(null, xs.length ? xs : [1])];
    var yr = spec.yrange || [Math.min.apply(null, ys.length ? ys : [0]), Math.max.apply(null, ys.length ? ys : [1])];
    if (xr[1] - xr[0] < 1e-12) { xr = [xr[0] - 0.5, xr[1] + 0.5]; }
    if (yr[1] - yr[0] < 1e-14) { var m = Math.abs(yr[0]) * 0.05 || 0.5; yr = [yr[0] - m, yr[1] + m]; }
    if (!spec.yrange) { var pad = (yr[1] - yr[0]) * 0.06; yr = [yr[0] - pad, yr[1] + pad]; }
    if (spec.equal) {
      var sx = (xr[1] - xr[0]) / pw, sy = (yr[1] - yr[0]) / ph, s2 = Math.max(sx, sy);
      var cx = (xr[0] + xr[1]) / 2, cy = (yr[0] + yr[1]) / 2;
      xr = [cx - s2 * pw / 2, cx + s2 * pw / 2]; yr = [cy - s2 * ph / 2, cy + s2 * ph / 2];
    }
    var X = function (v) { return x0 + (v - xr[0]) / (xr[1] - xr[0]) * pw; };
    var Y = function (v) { return y0 + ph - ((ylog ? Math.log10(v) : v) - yr[0]) / (yr[1] - yr[0]) * ph; };
    ctx.font = '10px ' + (CSS.getPropertyValue('--mono') || 'monospace'); ctx.lineWidth = 1;
    ctx.strokeStyle = C.grid; ctx.fillStyle = C.faint; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    niceTicks(xr[0], xr[1], Math.max(2, Math.floor(pw / 70))).forEach(function (t) {
      var px = Math.round(X(t)) + 0.5; ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y0 + ph); ctx.stroke();
      ctx.fillText(fmt(t), px, y0 + ph + 4);
    });
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    niceTicks(yr[0], yr[1], Math.max(2, Math.floor(ph / 34))).forEach(function (t) {
      if (ylog && Math.abs(t - Math.round(t)) > 1e-9) return;
      var py = Math.round(y0 + ph - (t - yr[0]) / (yr[1] - yr[0]) * ph) + 0.5;
      ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(x0 + pw, py); ctx.stroke();
      ctx.fillText(ylog ? '1e' + Math.round(t) : fmt(t), x0 - 4, py);
    });
    ctx.strokeStyle = C.line; ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw, ph);
    ctx.fillStyle = C.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    if (spec.xlabel) ctx.fillText(spec.xlabel, x0 + pw, R.y + R.h - 1);
    ctx.save(); ctx.translate(R.x + 9, y0); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    if (spec.ylabel) ctx.fillText(spec.ylabel, 0, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, pw, ph); ctx.clip();
    (spec.bands || []).forEach(function (b) {
      ctx.fillStyle = b.color || 'rgba(242,242,242,0.08)'; var a = Y(b.y1), c = Y(b.y0); ctx.fillRect(x0, a, pw, c - a);
      ctx.strokeStyle = 'rgba(242,242,242,0.5)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x0, a); ctx.lineTo(x0 + pw, a); ctx.moveTo(x0, c); ctx.lineTo(x0 + pw, c); ctx.stroke(); ctx.setLineDash([]);
    });
    spec.series.forEach(function (s) {
      ctx.strokeStyle = ctx.fillStyle = s.color || C.sim; ctx.lineWidth = s.width || 1.4; ctx.setLineDash(s.dash || []);
      if (s.points) {
        for (var i = 0; i < s.x.length; i++) {
          if (!isFinite(s.y[i]) || (ylog && s.y[i] <= 0)) continue;
          var px = X(s.x[i]), py = Y(s.y[i]);
          ctx.beginPath(); ctx.arc(px, py, 2.6, 0, 6.283); ctx.lineWidth = 1.2; ctx.stroke();
        }
      } else {
        ctx.beginPath(); var pen = false;
        for (var j = 0; j < s.x.length; j++) {
          var yv = s.y[j];
          if (!isFinite(yv) || !isFinite(s.x[j]) || (ylog && yv <= 0)) { pen = false; continue; }
          var qx = X(s.x[j]), qy = Y(yv);
          if (pen) ctx.lineTo(qx, qy); else { ctx.moveTo(qx, qy); pen = true; }
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    });
    (spec.marks || []).forEach(function (m) { ctx.fillStyle = m.color || C.text; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), m.r || 3, 0, 6.283); ctx.fill(); });
    ctx.restore();
  }

  /* ---------------- reference overlays ---------------- */
  function whenOk(ref) {
    var w = ref.overlay && ref.overlay.when; if (!w) return true;
    for (var k in w) {
      var have = S.params[k];
      if (have === undefined && S.exp && S.exp.params) have = S.exp.params[k];
      if (have === undefined) return false;
      if (Math.abs(have - w[k]) > 1e-9 * Math.max(1, Math.abs(w[k]))) return false;
    }
    return true;
  }
  function refsFor(plotKey) {
    return LAB.referencesFor(S.scene).filter(function (r) { return r.overlay && r.overlay.plot === plotKey && whenOk(r); });
  }
  function refSeries(plotKey, xsSim, t) {
    var out = [], bands = [];
    refsFor(plotKey).forEach(function (r, idx) {
      var o = r.overlay;
      try {
        if (r.kind === 'table') {
          var ix = r.columns.indexOf(o.x), iy = r.columns.indexOf(o.y);
          out.push({ label: r.label || ('ref: ' + (LAB.sources[r.source] ? shortCite(LAB.sources[r.source]) : r.source)), x: r.rows.map(function (row) { return row[ix]; }), y: r.rows.map(function (row) { return row[iy]; }), color: C.ref, points: true });
        } else if (r.kind === 'function' && (typeof r.fn === 'function' || o.eval)) {
          var xs = [], ys = [], n = 400, lo, hi;
          if (o.sample === 't') { lo = 0; hi = Math.max(t, 1e-6) * (o.ahead || 1.0); }
          else { lo = o.range ? o.range[0] : Math.min.apply(null, xsSim); hi = o.range ? o.range[1] : Math.max.apply(null, xsSim); }
          for (var i = 0; i <= n; i++) {
            var xv = lo + (hi - lo) * i / n, v = o.eval ? o.eval(xv, t, S.params) : o.sample === 't' ? r.fn(xv, S.params) : r.fn(xv, t, S.params);
            if (o.field && v) v = v[o.field];
            xs.push(xv); ys.push(o.transform ? o.transform(v, S) : v);
          }
          out.push({ label: r.label || 'exact', x: xs, y: ys, color: C.ref, dash: [5, 3], width: 1.2 });
        } else if (r.kind === 'scalar' && r.range) {
          bands.push({ y0: r.range[0], y1: r.range[1] });
        }
      } catch (e) { console.warn('overlay failed', r.id, e); }
    });
    return { series: out, bands: bands };
  }
  function shortCite(src) { var a = (src.authors || '').split(/,| and /)[0].trim().split(' ').pop(); return a + (src.year ? ' ' + src.year : ''); }

  /* ---------------- per-scene plot specs ---------------- */
  function arr(a) { return a ? Array.prototype.slice.call(a) : []; }
  var PLOTS = {
    cavity: [
      { key: 'u_vcl', title: 'u on vertical centreline x = 0.5', type: 'probe', probe: 'u_vcl', x: 'u', y: 'y', xlabel: 'u / U', ylabel: 'y' },
      { key: 'v_hcl', title: 'v on horizontal centreline y = 0.5', type: 'probe', probe: 'v_hcl', x: 'x', y: 'v', xlabel: 'x', ylabel: 'v / U' },
      { key: 'residual', title: 'Steady-state residual', type: 'history', f: function (s) { return s.probe('residual'); }, ylog: true, ylabel: 'max |Δu|/Δt' }
    ],
    'taylor-green': [
      { key: 'ke', title: 'Kinetic energy decay', type: 'history', f: function (s) { var k = s.probe('kinetic_energy'); if (S.ke0 == null) S.ke0 = k; return k / S.ke0; }, ylabel: 'KE / KE₀' },
      { key: 'l2', title: 'Relative L2 velocity error vs analytic', type: 'history', f: function (s) { return s.probe('l2_error'); }, ylog: true, ylabel: 'rel. L2' }
    ],
    cylinder: [
      { key: 'cd', title: 'Drag coefficient', type: 'history', f: function (s) { return s.probe('forces').cd; }, ylabel: 'C_D' },
      { key: 'cl', title: 'Lift coefficient', type: 'history', f: function (s) { return s.probe('forces').cl; }, ylabel: 'C_L' }
    ],
    sod: [
      { key: 'drift', title: 'Conservation drift (relative)', type: 'history', multi: ['mass', 'momentum', 'energy'], f: function (s) { var t = s.probe('totals'); if (!S.tot0) S.tot0 = t; return [rel(t.mass, S.tot0.mass), t.momentum - S.tot0.momentum, rel(t.energy, S.tot0.energy)]; }, ylabel: 'Δ / total' }
    ],
    'swe-dambreak': [
      { key: 'drift', title: 'Mass drift (relative)', type: 'history', f: function (s) { var t = s.probe('totals'); if (!S.tot0) S.tot0 = t; return rel(t.mass, S.tot0.mass); }, ylabel: 'Δm / m₀' }
    ],
    kepler: [
      { key: 'dH', title: 'Energy error |H − H₀| / |H₀|', type: 'history', f: function (s) { var v = s.probe('invariants'); if (!S.inv0) S.inv0 = v; return Math.abs((v.H - S.inv0.H) / S.inv0.H); }, ylog: true, ylabel: 'rel. error' },
      { key: 'dL', title: 'Angular momentum error |L − L₀| / |L₀|', type: 'history', f: function (s) { var v = s.probe('invariants'); if (!S.inv0) S.inv0 = v; return Math.abs((v.L - S.inv0.L) / S.inv0.L); }, ylog: true, ylabel: 'rel. error' }
    ],
    'dam-break': [
      { key: 'front', title: 'Surge front Z = x/a vs T = t√(2g/a)', type: 'history', xf: function (s) { return s.t * Math.sqrt(2 * (S.params.g || 9.81) / (S.params.a || 1)); }, f: function (s) { return s.probe('front') / (S.params.a || 1); }, xlabel: 'T', ylabel: 'Z' },
      { key: 'column', title: 'Column height H / 2a', type: 'history', xf: function (s) { return s.t * Math.sqrt(2 * (S.params.g || 9.81) / (S.params.a || 1)); }, f: function (s) { var h = s.probe('column_height'); return h == null ? NaN : h / (2 * (S.params.a || 1)); }, xlabel: 'T', ylabel: 'H/2a' }
    ]
  };
  function rel(v, v0) { return v0 !== 0 ? (v - v0) / Math.abs(v0) : v - v0; }

  function buildPlots() {
    var host = $('plots'); host.innerHTML = '';
    (PLOTS[S.scene] || []).forEach(function (p) {
      var d = document.createElement('div'); d.className = 'plot';
      d.innerHTML = '<h3><span>' + esc(p.title) + '</span><span class="v" data-v="' + p.key + '"></span></h3><canvas data-plot="' + p.key + '"></canvas><div class="key" data-key="' + p.key + '"></div>';
      host.appendChild(d);
    });
  }

  function recordHistory() {
    var s = S.sim; if (!s) return;
    var plots = PLOTS[S.scene] || [];
    plots.forEach(function (p) {
      if (p.type !== 'history') return;
      var h = S.hist[p.key] || (S.hist[p.key] = { x: [], y: [] });
      var y; try { y = p.f(s); } catch (e) { y = NaN; }
      h.x.push(p.xf ? p.xf(s) : s.t); h.y.push(y);
      if (h.x.length > 6000) { h.x = h.x.filter(function (_, i) { return i % 2 === 0; }); h.y = h.y.filter(function (_, i) { return i % 2 === 0; }); }
    });
  }

  function drawPlots() {
    var s = S.sim; if (!s) return;
    (PLOTS[S.scene] || []).forEach(function (p) {
      var cv = document.querySelector('canvas[data-plot="' + p.key + '"]'); if (!cv) return;
      var g = setupCanvas(cv, 190), series = [], ref, label = [];
      if (p.type === 'probe') {
        var d; try { d = s.probe(p.probe); } catch (e) { d = null; }
        if (d) series.push({ label: S.method, x: arr(d[p.x]), y: arr(d[p.y]), color: C.sim });
        ref = refSeries(p.key, series.length ? series[0].x : [0, 1], s.t);
      } else {
        var h = S.hist[p.key] || { x: [], y: [] };
        if (p.multi) {
          p.multi.forEach(function (name, k) { series.push({ label: name, x: h.x, y: h.y.map(function (v) { return v ? v[k] : NaN; }), color: C.series[k] }); });
        } else series.push({ label: S.method, x: h.x, y: h.y, color: C.sim });
        ref = refSeries(p.key, h.x, h.x.length ? h.x[h.x.length - 1] : 0);
        var last = h.y[h.y.length - 1];
        var vEl = document.querySelector('[data-v="' + p.key + '"]');
        if (vEl) vEl.textContent = Array.isArray(last) ? '' : fmt(last);
      }
      var all = ref.series.concat(series);
      drawPlot(g.ctx, { x: 0, y: 0, w: g.w, h: g.h }, { xlabel: p.xlabel || (p.type === 'history' ? 't' : ''), ylabel: p.ylabel, series: all, ylog: p.ylog, bands: ref.bands });
      var key = document.querySelector('[data-key="' + p.key + '"]');
      if (key) key.innerHTML = all.map(function (x) { return '<span><i style="background:' + x.color + (x.points ? ';height:6px;width:6px;border-radius:50%' : '') + '"></i>' + esc(x.label) + '</span>'; }).join('') + (ref.bands.length ? '<span><i style="background:rgba(242,242,242,.35)"></i>published range</span>' : '') + (ref.series.length || ref.bands.length ? '' : '<span>no reference overlay for these conditions</span>');
    });
  }

  /* ---------------- main view ---------------- */
  var off = document.createElement('canvas');
  function drawView() {
    var s = S.sim, cv = $('cv'); if (!s) return;
    var d; try { d = s.view(S.field); } catch (e) { showErr('view() failed: ' + e.message); return; }
    if (!d) return;
    var wrapW = cv.parentNode.clientWidth - 24, aspect = 0.62;
    if (d.extent) aspect = (d.extent[3] - d.extent[1]) / (d.extent[2] - d.extent[0]);
    if (d.kind === 'profiles') aspect = 0.32 * d.panels.length;
    if (d.kind === 'orbit') aspect = 0.62;
    var cssH = Math.max(160, Math.min(window.innerHeight * 0.62, wrapW * aspect));
    cv.style.height = cssH + 'px';
    var g = setupCanvas(cv, cssH), ctx = g.ctx;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, g.w, g.h);
    var leg = $('legend');
    if (d.kind === 'field') {
      if (off.width !== d.nx || off.height !== d.ny) { off.width = d.nx; off.height = d.ny; }
      var octx = off.getContext('2d'), img = octx.createImageData(d.nx, d.ny), L = CMAPS[d.cmap] || CMAPS.sequential;
      var lo = d.range[0], hi = d.range[1], inv = hi > lo ? 255 / (hi - lo) : 0;
      for (var j = 0; j < d.ny; j++) for (var i = 0; i < d.nx; i++) {
        var src = j * d.nx + i, dst = ((d.ny - 1 - j) * d.nx + i) * 4, k;
        if (d.mask && d.mask[src]) { img.data[dst] = 58; img.data[dst + 1] = 64; img.data[dst + 2] = 72; img.data[dst + 3] = 255; continue; }
        k = (d.data[src] - lo) * inv; k = k < 0 ? 0 : k > 255 ? 255 : (k | 0); k *= 3;
        img.data[dst] = L[k]; img.data[dst + 1] = L[k + 1]; img.data[dst + 2] = L[k + 2]; img.data[dst + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      var sc = Math.min(g.w / d.nx, g.h / d.ny), dw = d.nx * sc, dh = d.ny * sc;
      ctx.imageSmoothingEnabled = true; ctx.drawImage(off, (g.w - dw) / 2, (g.h - dh) / 2, dw, dh);
      leg.innerHTML = '<span>' + fmt(lo) + '</span><canvas style="background:' + cssLut(d.cmap) + '"></canvas><span>' + fmt(hi) + '</span><span>' + esc(d.label || S.field || '') + '</span>';
    } else if (d.kind === 'particles') {
      var e = d.extent, scl = Math.min(g.w / (e[2] - e[0]), g.h / (e[3] - e[1])), ox = (g.w - (e[2] - e[0]) * scl) / 2, oy = (g.h + (e[3] - e[1]) * scl) / 2;
      var PX = function (x) { return ox + (x - e[0]) * scl; }, PY = function (y) { return oy - (y - e[1]) * scl; };
      ctx.strokeStyle = C.line; ctx.strokeRect(PX(e[0]), PY(e[3]), (e[2] - e[0]) * scl, (e[3] - e[1]) * scl);
      ctx.strokeStyle = C.dim; ctx.lineWidth = 2;
      (d.walls || []).forEach(function (w) { ctx.beginPath(); ctx.moveTo(PX(w[0]), PY(w[1])); ctx.lineTo(PX(w[2]), PY(w[3])); ctx.stroke(); });
      var Lp = CMAPS[d.cmap || 'sequential'], r = Math.max(1.2, (d.radius || 0) * scl), plo = d.range ? d.range[0] : 0, phi = d.range ? d.range[1] : 1;
      for (var p = 0; p < d.n; p++) {
        var kk = 200 * 3;
        if (d.value) { kk = (d.value[p] - plo) / (phi - plo || 1) * 255; kk = (kk < 0 ? 0 : kk > 255 ? 255 : kk | 0) * 3; }
        ctx.fillStyle = 'rgb(' + Lp[kk] + ',' + Lp[kk + 1] + ',' + Lp[kk + 2] + ')';
        ctx.fillRect(PX(d.x[p]) - r / 2, PY(d.y[p]) - r / 2, r, r);
      }
      leg.innerHTML = d.value ? '<span>' + fmt(plo) + '</span><canvas style="background:' + cssLut(d.cmap || 'sequential') + '"></canvas><span>' + fmt(phi) + '</span><span>' + esc(d.label || '') + ' · ' + d.n + ' particles</span>' : '<span>' + d.n + ' particles</span>';
    } else if (d.kind === 'profiles') {
      var ph = g.h / d.panels.length;
      d.panels.forEach(function (pn, idx) {
        var sim = pn.series.map(function (sr, k) { return { label: sr.label, x: arr(sr.x), y: arr(sr.y), color: C.series[k] }; });
        var rs = refSeries(pn.key, sim.length ? sim[0].x : [0, 1], s.t);
        drawPlot(ctx, { x: 0, y: idx * ph, w: g.w, h: ph }, { xlabel: idx === d.panels.length - 1 ? d.xlabel : '', ylabel: pn.ylabel, series: rs.series.concat(sim), bands: rs.bands });
      });
      leg.innerHTML = '<span><i style="display:inline-block;width:14px;height:2px;background:' + C.sim + ';vertical-align:middle"></i> simulation</span><span><i style="display:inline-block;width:14px;border-top:1px dashed ' + C.ref + ';vertical-align:middle"></i> exact / reference</span>';
    } else if (d.kind === 'orbit') {
      var os = d.series.map(function (sr, k) { return { label: sr.label, x: arr(sr.x), y: arr(sr.y), color: C.series[k], width: 1 }; });
      var rs2 = refSeries('orbit', [0], s.t);
      drawPlot(ctx, { x: 0, y: 0, w: g.w, h: g.h }, { xlabel: 'q₁', ylabel: 'q₂', series: rs2.series.concat(os), equal: true, xrange: [d.extent[0], d.extent[2]], yrange: [d.extent[1], d.extent[3]], marks: (d.points || []).map(function (m) { return { x: m.x, y: m.y, color: m.color || C.text }; }) });
      leg.innerHTML = '<span>trajectory (last ' + (os[0] ? os[0].x.length : 0) + ' samples)</span>';
    }
  }

  /* ---------------- metrics ---------------- */
  function drawMetrics() {
    var s = S.sim; if (!s) return;
    var ms; try { ms = s.metrics(); } catch (e) { ms = [{ label: 'metrics() error', value: e.message }]; }
    $('metrics').innerHTML = ms.map(function (m) { return '<tr><td>' + esc(m.label) + '</td><td class="num">' + fmt(m.value, m.fmt) + '</td><td class="dim">' + esc(m.unit || '') + '</td></tr>'; }).join('');
    $('clock').textContent = fmt(s.t); $('nsteps').textContent = s.steps; $('m-time').textContent = 'Δt ' + fmt(s.dt);
  }

  /* ---------------- experiment / verification panels ---------------- */
  function currentRecord() {
    var recs = LAB.verificationFor(S.method, S.scene);
    var hit = recs.filter(function (r) { return S.exp && r.experiment === S.exp.id; });
    return hit[0] || null;
  }
  function chip(status) { var s = status || 'none'; return '<span class="chip ' + s + '">' + (s === 'none' ? 'not reviewed' : s) + '</span>'; }
  function srcLink(id, loc) {
    var s = LAB.sources[id];
    if (!s) return '<span class="dim">' + esc(id) + '</span>';
    return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(shortCite(s)) + '</a>' + (loc ? ' <span class="dim">' + esc(loc) + '</span>' : '');
  }
  function renderExperiment() {
    var rec = currentRecord(), exp = S.exp || {};
    var h = '<h2>Experiment ' + chip(rec && rec.status) + '</h2>';
    h += '<p class="claim">' + esc(rec ? rec.claim : (exp.quantity ? 'Not yet reviewed for this method. Target: ' + exp.quantity + '.' : 'No experiment defined.')) + '</p>';
    if (rec && rec.conditions) {
      h += '<dl class="kv">';
      for (var k in rec.conditions) h += '<dt>' + esc(k) + '</dt><dd>' + esc(typeof rec.conditions[k] === 'object' ? JSON.stringify(rec.conditions[k]) : rec.conditions[k]) + '</dd>';
      h += '</dl>';
    }
    if (rec && rec.reference) h += '<p class="small dim" style="margin:8px 0 0">Reference: ' + rec.reference.map(function (rid) { var r = LAB.references[rid]; return r ? srcLink(r.source, r.location) : esc(rid); }).join('; ') + '</p>';
    $('sec-exp').innerHTML = h;

    var g = '<h2>Gap from reference</h2>';
    if (rec && rec.gaps && rec.gaps.length) {
      g += '<table class="t"><tr><th>Quantity</th><th class="num">Gap</th><th class="num">Tol.</th></tr>' + rec.gaps.map(function (x) {
        return '<tr><td>' + esc(x.quantity) + '</td><td class="num ' + (x.pass ? 'pass' : 'fail') + '">' + fmt(x.value) + '</td><td class="num">' + (x.tolerance == null ? '—' : fmt(x.tolerance)) + ' <span class="dim">' + esc(x.unit || '') + '</span></td></tr>';
      }).join('') + '</table>';
    } else g += '<p class="dim small">No measured gap recorded. ' + (rec ? 'See missing items.' : 'A reviewer has not run this experiment yet.') + '</p>';
    $('sec-gaps').innerHTML = g;

    var m = '<h2>Missing for full verification</h2>';
    var miss = rec ? (rec.missing || []) : ['Independent review not yet run for ' + S.method + ' on this experiment.'];
    m += miss.length ? '<ul class="list small">' + miss.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="dim small">Nothing recorded.</p>';
    $('sec-missing').innerHTML = m;

    var v = '';
    if (rec) {
      v += '<h2>Reviewer checks <span class="n">' + esc(rec.reviewer || '') + ' · round ' + esc(rec.round || 1) + ' · ' + esc(rec.date || '') + '</span></h2>';
      v += '<table class="t">' + (rec.checks || []).map(function (c) { return '<tr><td>' + esc(c.name) + '</td><td class="' + (c.status === 'pass' ? 'pass' : c.status === 'fail' ? 'fail' : 'na') + '">' + esc(c.status) + '</td></tr><tr><td colspan="2" class="dim small" style="border-bottom:1px solid var(--line-2)">' + esc(c.detail || '') + '</td></tr>'; }).join('') + '</table>';
      if (rec.history && rec.history.length) v += '<h2 style="margin-top:14px">Loop history</h2><ul class="list small">' + rec.history.map(function (x) { return '<li><span class="chip ' + esc(x.status) + '">' + esc(x.status) + '</span> round ' + esc(x.round) + ': ' + esc(x.reason || '') + '</li>'; }).join('') + '</ul>';
      v += '<p class="small dim">Report: <code>verification/reports/' + esc(rec.id) + '.md</code><br>Check script: <code>verification/checks/' + esc(rec.id) + '.check.js</code></p>';
    } else v = '<p class="dim">No reviewer record for this method on this experiment.</p>';
    var others = LAB.verificationFor(S.method).filter(function (r) { return r !== rec; });
    if (others.length) v += '<h2 style="margin-top:14px">Other experiments for this method</h2><table class="t">' + others.map(function (r) { return '<tr><td>' + esc(r.experiment) + '</td><td>' + chip(r.status) + '</td></tr>'; }).join('') + '</table>';
    $('r-ver').innerHTML = v;
  }

  function renderMethodPanes() {
    var m = LAB.methods[S.method];
    if (!m) { ['r-eq', 'r-asm', 'r-code', 'r-src'].forEach(function (id) { $(id).innerHTML = '<p class="dim">No method available for this scene yet.</p>'; }); return; }
    var e = '<p class="small" style="margin-top:0">' + esc(m.summary || '') + '</p>';
    (m.equations || []).forEach(function (q) {
      var html; try { html = window.katex ? katex.renderToString(q.tex, { displayMode: true, throwOnError: false }) : null; } catch (er) { html = null; }
      e += '<div class="eq"><div class="eq-h"><span>' + esc(q.label) + '</span><span>' + srcLink(q.source, q.location) + '</span></div><div class="tex' + (html ? '' : ' raw') + '">' + (html || esc(q.tex)) + '</div></div>';
    });
    $('r-eq').innerHTML = e;
    var sc = m.scenes[S.scene] || {};
    var a = '<h2>Assumptions</h2><ul class="list">' + (m.assumptions || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (m.stability) a += '<h2 style="margin-top:12px">Stability criterion</h2><p class="small">' + esc(m.stability) + '</p>';
    if (sc.notes) a += '<h2 style="margin-top:12px">Scene-specific setup</h2><p class="small">' + esc(sc.notes) + '</p>';
    var scn = LAB.scenes[S.scene];
    if (scn) a += '<h2 style="margin-top:12px">Scene</h2><p class="small">' + esc(scn.domain) + '<br><span class="dim">' + esc(scn.nondim || '') + '</span></p>';
    $('r-asm').innerHTML = a;
    $('r-code').innerHTML = '<div class="sec" style="border:none;padding-bottom:4px"><h2>methods/' + esc(m.id) + '.js <span class="n">create() — the code that runs</span></h2></div><pre class="code">' + highlight(m.create.toString()) + '</pre>';
    var ids = (m.sources || []).slice();
    LAB.referencesFor(S.scene).forEach(function (r) { if (ids.indexOf(r.source) < 0) ids.push(r.source); });
    $('r-src').innerHTML = ids.map(srcBlock).join('') || '<p class="dim">No sources registered.</p>';
  }
  function srcBlock(id) {
    var s = LAB.sources[id]; if (!s) return '<div class="src"><span class="dim">' + esc(id) + ' (unregistered)</span></div>';
    return '<div class="src"><div class="ttl">' + esc(s.title) + '</div><div class="meta">' + esc(s.authors || '') + ' · ' + esc(s.year || '') + (s.venue ? ' · ' + esc(s.venue) : '') + '</div><div class="meta"><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.url) + '</a></div><div class="meta"><span class="access ' + (s.verified ? 'v' : 'u') + '">' + esc(s.access) + (s.verified ? ' · verified' : ' · unverified') + '</span> ' + esc(s.license || '') + '</div>' + (s.accessNote ? '<div class="meta">' + esc(s.accessNote) + '</div>' : '') + '</div>';
  }
  function highlight(src) {
    var re = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|\b(var|let|const|function|return|for|while|if|else|new|this|break|continue|typeof|null|true|false)\b|\b(\d+\.?\d*(?:e[-+]?\d+)?)\b/g;
    var out = '', last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      var cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : 'n';
      out += '<span class="' + cls + '">' + esc(m[0]) + '</span>';
      last = re.lastIndex;
    }
    out += esc(src.slice(last));
    return out.split('\n').map(function (l) { return '<span class="ln">' + (l || ' ') + '</span>'; }).join('');
  }

  /* ---------------- params ---------------- */
  var resetTimer = null;
  function renderParams() {
    var m = LAB.methods[S.method], host = $('params');
    if (!m) { host.innerHTML = ''; return; }
    var defs = (m.scenes[S.scene] || {}).params || [];
    host.innerHTML = defs.map(function (d) {
      return '<div class="param"><label for="p-' + d.key + '">' + esc(d.label) + (d.unit ? ' <span class="unit">' + esc(d.unit) + '</span>' : '') + (d.live ? '<span class="live">LIVE</span>' : '') + '</label><output id="o-' + d.key + '">' + fmt(S.params[d.key]) + '</output>' +
        '<input type="range" id="p-' + d.key + '" min="' + d.min + '" max="' + d.max + '" step="' + d.step + '" value="' + S.params[d.key] + '"></div>';
    }).join('') || '<p class="dim small">No adjustable parameters.</p>';
    defs.forEach(function (d) {
      var inp = $('p-' + d.key);
      inp.addEventListener('input', function () {
        var v = +inp.value; S.params[d.key] = v; $('o-' + d.key).textContent = fmt(v);
        if (d.live && S.sim && S.sim.setParam) { S.sim.setParam(d.key, v); }
        else { $('param-pending').textContent = 'restart pending'; clearTimeout(resetTimer); resetTimer = setTimeout(function () { reset(true); }, 450); }
        syncExpFromParams();
      });
    });
  }
  function syncExpFromParams() {
    /* keep the experiment selector honest: if params no longer match the experiment, show "custom" */
    var sc = LAB.scenes[S.scene]; if (!sc) return;
    var match = (sc.experiments || []).filter(function (e) { for (var k in e.params) if (S.params[k] !== undefined && S.params[k] !== e.params[k]) return false; return true; });
    var sel = $('sel-exp');
    if (S.exp && match.indexOf(S.exp) < 0) { S.exp = match[0] || null; sel.value = S.exp ? S.exp.id : '__custom'; renderExperiment(); }
  }

  /* ---------------- lifecycle ---------------- */
  function showErr(msg) { var b = $('banner'); b.textContent = msg; b.classList.add('show'); }
  function clearErr() { $('banner').classList.remove('show'); }

  function reset(keepParams) {
    $('param-pending').textContent = '';
    clearErr(); S.hist = {}; S.ke0 = null; S.inv0 = null; S.tot0 = null;
    var m = LAB.methods[S.method];
    if (!m) { S.sim = null; showErr('No method registered for this scene yet.'); return; }
    if (!keepParams) {
      S.params = LAB.defaultParams(S.method, S.scene, null);
      if (S.exp && S.exp.params) for (var k in S.exp.params) if (S.params[k] !== undefined) S.params[k] = S.exp.params[k];
    }
    try { S.sim = m.create(S.scene, Object.assign({}, S.params)); }
    catch (e) { S.sim = null; showErr('create() threw: ' + e.message); return; }
    var fs = S.sim.fields || [];
    $('sel-field').innerHTML = fs.map(function (f) { return '<option>' + esc(f) + '</option>'; }).join('');
    S.field = fs.indexOf(S.field) >= 0 ? S.field : fs[0] || null;
    if (S.field) $('sel-field').value = S.field;
    $('sel-field').disabled = fs.length < 2;
    if (!keepParams) renderParams();
    recordHistory(); drawAll();
  }

  function drawAll() { drawView(); drawMetrics(); drawPlots(); }

  function tick(now) {
    if (S.running && S.sim) {
      var t0 = performance.now(), n = 0;
      try {
        while (n < S.spf && performance.now() - t0 < 28) { S.sim.step(); n++; }
      } catch (e) { S.running = false; syncRun(); showErr('step() threw at t=' + fmt(S.sim.t) + ': ' + e.message); }
      if (S.sim.diverged && S.sim.diverged()) { S.running = false; syncRun(); showErr('Diverged at t = ' + fmt(S.sim.t) + ' (NaN/Inf or blow-up). Reduce the step size or Reynolds number; this is reported, not hidden.'); }
      recordHistory();
      S.frame++;
      drawView();
      if (S.frame % 4 === 0) { drawMetrics(); drawPlots(); }
      S.fpsN++; if (now - S.fpsT > 1000) { $('fps').textContent = S.fpsN + ' fps · ' + n + ' steps/frame'; S.fpsN = 0; S.fpsT = now; }
    }
    requestAnimationFrame(tick);
  }
  function syncRun() { $('btn-run').setAttribute('aria-pressed', S.running ? 'true' : 'false'); $('btn-run').textContent = S.running ? 'Pause' : 'Run'; }

  /* ---------------- selectors ---------------- */
  function methodsFor(sceneId) { return Object.keys(LAB.methods).filter(function (k) { return LAB.methods[k].scenes[sceneId]; }); }
  function statusFor(methodId, expId) { var r = LAB.verification[methodId + '@' + expId]; return r ? r.status : null; }
  var MARK = { matched: '● ', flagged: '▲ ', incomplete: '○ ', none: '· ' };
  function fillSceneSel() {
    $('sel-scene').innerHTML = Object.keys(LAB.scenes).map(function (k) { var n = methodsFor(k).length; return '<option value="' + k + '"' + (n ? '' : ' disabled') + '>' + esc(LAB.scenes[k].title) + ' (' + n + ')</option>'; }).join('');
  }
  function fillExpSel() {
    var sc = LAB.scenes[S.scene];
    $('sel-exp').innerHTML = (sc.experiments || []).map(function (e) { return '<option value="' + e.id + '">' + esc(e.title) + '</option>'; }).join('') + '<option value="__custom">custom parameters</option>';
    if (S.exp) $('sel-exp').value = S.exp.id;
  }
  function fillMethodSel() {
    var ms = methodsFor(S.scene);
    $('sel-method').innerHTML = ms.map(function (k) { var st = S.exp ? statusFor(k, S.exp.id) : null; return '<option value="' + k + '">' + (MARK[st || 'none']) + esc(LAB.methods[k].name) + '</option>'; }).join('');
    if (ms.indexOf(S.method) < 0) S.method = ms[0] || null;
    if (S.method) $('sel-method').value = S.method;
  }
  function select(sceneId, expId, methodId) {
    S.scene = sceneId; var sc = LAB.scenes[sceneId];
    S.exp = (sc.experiments || []).filter(function (e) { return e.id === expId; })[0] || (sc.experiments || [])[0] || null;
    if (methodId) S.method = methodId;
    $('sel-scene').value = sceneId; fillExpSel(); fillMethodSel();
    reset(false); renderExperiment(); renderMethodPanes(); buildPlots(); drawAll();
    try { location.hash = [S.scene, S.exp ? S.exp.id : '', S.method].join('/'); } catch (e) { /* ignore */ }
  }

  /* ---------------- pages ---------------- */
  function allExperiments() { var out = []; Object.keys(LAB.scenes).forEach(function (k) { (LAB.scenes[k].experiments || []).forEach(function (e) { out.push({ scene: k, exp: e }); }); }); return out; }
  function renderMatrix() {
    var exps = allExperiments(), methods = Object.keys(LAB.methods);
    var counts = { matched: 0, flagged: 0, incomplete: 0 }, recs = [];
    for (var k in LAB.verification) { counts[LAB.verification[k].status]++; recs.push(LAB.verification[k]); }
    var h = '<h1>Verification matrix</h1><p class="lede">Every cell is one method on one reference experiment, reviewed by an agent independent of the builder. Unreviewed cells stay marked as such. Hatched cells: the method does not apply to that scene.</p>';
    h += '<div class="totals"><div><b class="pass">' + counts.matched + '</b>matched</div><div><b style="color:var(--flag)">' + counts.flagged + '</b>flagged</div><div><b style="color:var(--inc)">' + counts.incomplete + '</b>incomplete</div><div><b>' + methods.length + '</b>methods</div><div><b>' + exps.length + '</b>experiments</div></div>';
    h += '<div style="overflow-x:auto"><table class="matrix"><tr><th>Method</th>' + exps.map(function (x) { return '<th title="' + esc(x.exp.quantity) + '">' + esc(x.exp.id) + '</th>'; }).join('') + '</tr>';
    methods.forEach(function (mid) {
      h += '<tr><th>' + esc(LAB.methods[mid].name) + '</th>' + exps.map(function (x) {
        if (!LAB.methods[mid].scenes[x.scene]) return '<td class="unsup"></td>';
        var r = LAB.verification[mid + '@' + x.exp.id];
        return '<td class="cell" data-go="' + x.scene + '/' + x.exp.id + '/' + mid + '">' + chip(r ? r.status : null) + (r && r.gaps && r.gaps[0] ? '<div class="small dim" style="margin-top:3px">' + esc(r.gaps[0].quantity).slice(0, 38) + ': ' + fmt(r.gaps[0].value) + '</div>' : '') + '</td>';
      }).join('') + '</tr>';
    });
    h += '</table></div>';
    var order = { flagged: 0, incomplete: 1, matched: 2 };
    recs.sort(function (a, b) { return order[a.status] - order[b.status]; });
    h += '<div class="reasons"><h1 style="font-size:15px">Outcomes with reasons</h1>' + recs.map(function (r) {
      var why = (r.checks || []).filter(function (c) { return c.status === 'fail'; }).map(function (c) { return c.name + ': ' + c.detail; });
      if (!why.length) why = (r.missing || []).slice(0, 2);
      return '<div class="r ' + r.status + '">' + chip(r.status) + ' <b>' + esc(r.id) + '</b><div class="small">' + esc(r.claim) + '</div><div class="small dim">' + why.map(esc).join(' · ') + '</div></div>';
    }).join('') + '</div>';
    var pg = $('page-matrix'); pg.innerHTML = h;
    pg.querySelectorAll('[data-go]').forEach(function (td) { td.addEventListener('click', function () { var p = td.getAttribute('data-go').split('/'); showPage('lab'); select(p[0], p[1], p[2]); }); });
  }

  function renderGraph() {
    var G = LAB.graph, pg = $('page-graph');
    if (!G) { pg.innerHTML = '<h1>Build graph</h1><p class="lede">No orchestration record found (orchestration/graph.json).</p>'; return; }
    var cols = ['research', 'build', 'review', 'refine', 're-review', 'interface'];
    var byCol = {}; cols.forEach(function (c) { byCol[c] = []; });
    G.nodes.forEach(function (n) { (byCol[n.type] || (byCol[n.type] = [])).push(n); });
    var colW = 210, rowH = 34, W = cols.length * colW + 20, maxRows = Math.max.apply(null, cols.map(function (c) { return byCol[c].length; })), H = maxRows * rowH + 60;
    var pos = {};
    cols.forEach(function (c, ci) { byCol[c].forEach(function (n, ri) { pos[n.id] = { x: 10 + ci * colW, y: 40 + ri * rowH }; }); });
    var col = { matched: C.ok, flagged: C.flag, incomplete: C.inc, done: C.dim, failed: C.bad };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Mono, monospace" font-size="10.5">';
    cols.forEach(function (c, ci) { svg += '<text x="' + (14 + ci * colW) + '" y="22" fill="' + C.dim + '" letter-spacing="1">' + c.toUpperCase() + '</text>'; });
    (G.edges || []).forEach(function (e) {
      var a = pos[e[0]], b = pos[e[1]]; if (!a || !b) return;
      var x1 = a.x + 180, y1 = a.y + 11, x2 = b.x, y2 = b.y + 11, mx = (x1 + x2) / 2;
      svg += '<path d="M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ',' + mx + ' ' + y2 + ',' + x2 + ' ' + y2 + '" fill="none" stroke="' + (x2 < x1 ? C.flag : '#2d343d') + '" stroke-width="1"' + (x2 < x1 ? ' stroke-dasharray="3 3"' : '') + '/>';
    });
    G.nodes.forEach(function (n) {
      var p = pos[n.id]; if (!p) return; var cc = col[n.status] || C.dim;
      svg += '<g><title>' + esc(n.detail || n.label) + '</title><rect x="' + p.x + '" y="' + p.y + '" width="180" height="22" fill="#101316" stroke="' + cc + '"/><rect x="' + p.x + '" y="' + p.y + '" width="3" height="22" fill="' + cc + '"/><text x="' + (p.x + 9) + '" y="' + (p.y + 15) + '" fill="' + C.text + '">' + esc(n.label).slice(0, 26) + '</text></g>';
    });
    svg += '</svg>';
    pg.innerHTML = '<h1>Build graph</h1><p class="lede">' + esc(G.summary || 'Agent dependency graph as executed: research → build → independent review → refinement → fresh review. Dashed edges are loop-backs.') + '</p><div class="graph">' + svg + '</div>' +
      (G.waves ? '<div class="reasons">' + G.waves.map(function (w) { return '<div class="r"><b>' + esc(w.name) + '</b><div class="small dim">' + esc(w.detail) + '</div></div>'; }).join('') + '</div>' : '');
  }

  function renderSources() {
    var ids = Object.keys(LAB.sources).sort();
    var h = '<h1>Source catalogue</h1><p class="lede">Every equation and reference value in the lab points to one of these open sources. "Unverified" means the agent could not read the cited section of the original itself (for example, the original is paywalled and values come from an open secondary copy) — those experiments cannot be marked fully verified on source grounds alone.</p>';
    h += '<table class="t"><tr><th>id</th><th>Source</th><th>Access</th><th>Used by</th></tr>' + ids.map(function (id) {
      var s = LAB.sources[id], used = [];
      for (var m in LAB.methods) if ((LAB.methods[m].sources || []).indexOf(id) >= 0) used.push(m);
      for (var r in LAB.references) if (LAB.references[r].source === id) used.push(r);
      return '<tr><td>' + esc(id) + '</td><td>' + esc(s.authors || '') + ' (' + esc(s.year || '') + '). ' + esc(s.title) + '. <span class="dim">' + esc(s.venue || '') + '</span><br><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.url) + '</a>' + (s.accessNote ? '<div class="dim small">' + esc(s.accessNote) + '</div>' : '') + '</td><td><span class="access ' + (s.verified ? 'v' : 'u') + '">' + esc(s.access) + '</span><div class="dim small">' + esc(s.license || '') + '</div></td><td class="small">' + used.map(esc).join('<br>') + '</td></tr>';
    }).join('') + '</table>';
    if (LAB.problems.length) h += '<h1 style="font-size:15px;margin-top:22px">Registry problems</h1><ul class="list small">' + LAB.problems.map(function (p) { return '<li>' + esc(p.kind + ' ' + p.id + ': ' + p.msg) + '</li>'; }).join('') + '</ul>';
    $('page-sources').innerHTML = h;
  }

  function showPage(id) {
    document.querySelectorAll('.tabs-top button').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-page') === id ? 'true' : 'false'); });
    document.querySelectorAll('.page').forEach(function (p) { p.classList.toggle('on', p.id === 'page-' + id); });
    document.querySelectorAll('.lab-only').forEach(function (el) { el.style.visibility = id === 'lab' ? 'visible' : 'hidden'; });
    if (id === 'matrix') renderMatrix(); if (id === 'graph') renderGraph(); if (id === 'sources') renderSources();
    if (id !== 'lab') { S.running = false; syncRun(); }
  }

  /* ---------------- wire up ---------------- */
  function init() {
    fillSceneSel();
    document.querySelectorAll('.tabs-top button').forEach(function (b) { b.addEventListener('click', function () { showPage(b.getAttribute('data-page')); }); });
    document.querySelectorAll('.rtabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.rtabs button').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        document.querySelectorAll('.rpane').forEach(function (p) { p.classList.toggle('on', p.id === 'r-' + b.getAttribute('data-r')); });
      });
    });
    $('sel-scene').addEventListener('change', function () { S.running = false; syncRun(); select(this.value, null, S.method); });
    $('sel-exp').addEventListener('change', function () { if (this.value === '__custom') return; S.running = false; syncRun(); select(S.scene, this.value, S.method); });
    $('sel-method').addEventListener('change', function () { S.running = false; syncRun(); S.method = this.value; reset(false); renderExperiment(); renderMethodPanes(); drawAll(); try { location.hash = [S.scene, S.exp ? S.exp.id : '', S.method].join('/'); } catch (e) { /* ignore */ } });
    $('sel-field').addEventListener('change', function () { S.field = this.value; drawView(); });
    $('sel-spf').addEventListener('change', function () { S.spf = +this.value; });
    $('btn-run').addEventListener('click', function () { S.running = !S.running; syncRun(); });
    $('btn-step').addEventListener('click', function () { if (!S.sim) return; try { S.sim.step(); } catch (e) { showErr(e.message); } recordHistory(); drawAll(); });
    $('btn-reset').addEventListener('click', function () { S.running = false; syncRun(); reset(true); });
    window.addEventListener('resize', function () { drawAll(); });
    var hs = (location.hash || '').replace('#', '').split('/');
    var first = Object.keys(LAB.scenes).filter(function (k) { return methodsFor(k).length; })[0];
    if (hs[0] && LAB.scenes[hs[0]] && methodsFor(hs[0]).length) select(hs[0], hs[1], hs[2]);
    else if (first) select(first, null, null);
    else showErr('No methods registered yet.');
    requestAnimationFrame(tick);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.LAB);
