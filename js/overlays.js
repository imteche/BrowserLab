/* Orchestrator-owned adapters: tell the UI which reference curves to overlay on which plot.
 * Reference data and functions stay untouched in references/*.js (researcher-owned). */
(function (LAB) {
  'use strict';
  function ov(id, spec, label) {
    var r = LAB.references[id];
    if (!r) { LAB.problems.push({ kind: 'overlay', id: id, msg: 'reference not registered' }); return; }
    r.overlay = spec;
    if (label) r.label = label;
  }

  /* cavity: Ghia (1982) tables, Erturk (2005) at Re = 1000 */
  ov('cavity-re100-ghia-u', { plot: 'u_vcl', x: 'u', y: 'y', when: { Re: 100 } }, 'Ghia et al. 1982');
  ov('cavity-re100-ghia-v', { plot: 'v_hcl', x: 'x', y: 'v', when: { Re: 100 } }, 'Ghia et al. 1982');
  ov('cavity-re1000-ghia-u', { plot: 'u_vcl', x: 'u', y: 'y', when: { Re: 1000 } }, 'Ghia et al. 1982');
  ov('cavity-re1000-ghia-v', { plot: 'v_hcl', x: 'x', y: 'v', when: { Re: 1000 } }, 'Ghia et al. 1982');

  /* Taylor–Green: KE(t)/KE0 from the analytic decay */
  var tgk = LAB.references['tgv-kinetic-energy'];
  ov('tgv-kinetic-energy', { plot: 'ke', sample: 't', eval: function (t, _t, p) { return tgk.fn(0, t, p) / tgk.fn(0, 0, p); } }, 'exact exp(−4νk²t)');

  /* cylinder: published Schäfer–Turek ranges as bands */
  ov('cylinder-2d2-cdmax', { plot: 'cd', when: { Re: 100 } });
  ov('cylinder-2d2-clmax', { plot: 'cl', when: { Re: 100 } });
  ov('cylinder-2d1-cd', { plot: 'cd', when: { Re: 20 } });
  ov('cylinder-2d1-cl', { plot: 'cl', when: { Re: 20 } });

  /* Sod: exact Riemann solution on each profile panel */
  var sod = LAB.references['sod-exact-profile'];
  if (sod) {
    ['rho', 'u', 'p'].forEach(function (f) {
      var clone = Object.create(sod);
      clone.id = 'sod-exact-' + f + '-overlay';
      clone.overlay = { plot: f, field: f, range: [0, 1] };
      clone.label = 'exact Riemann';
      LAB.references[clone.id] = clone;
    });
  }

  /* shallow-water dam break: Stoker (falls back to Ritter when hr = 0) */
  var sto = LAB.references['swe-dambreak-stoker'];
  if (sto) {
    ['h', 'u'].forEach(function (f) {
      var c = Object.create(sto);
      c.id = 'swe-exact-' + f + '-overlay';
      c.overlay = { plot: f, field: f };
      c.label = 'Stoker / Ritter exact';
      LAB.references[c.id] = c;
    });
  }

  /* 2D dam break: Martin & Moyce data (two column widths), Koshizuka & Oka, Ritter bound */
  ov('dam-break-mm-front-a225', { plot: 'front', x: 'T', y: 'Z' });
  ov('dam-break-mm-front-a1125', { plot: 'front', x: 'T', y: 'Z' });
  ov('dam-break-ko-front', { plot: 'front', x: 'T', y: 'Z' });
  var rit = LAB.references['dam-break-ritter-front-bound'];
  if (rit) ov('dam-break-ritter-front-bound', { plot: 'front', sample: 't', eval: function (T) { return rit.fn(T, null, {}); } }, 'Ritter bound 1 + 2T');
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
