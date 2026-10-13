/* References for scene `swe-dambreak` (1D shallow water, flat frictionless bed).
 * Researcher: hyperbolic-conservation-laws researcher agent, 2026-10-13.
 *
 * Ritter (1892) dry-bed and Stoker (1957) wet-bed dam-break solutions in the form
 * compiled by SWASHES (Delestre et al. 2013, arXiv:1110.0288, Sec. 4.1). The arXiv
 * PDF was NOT reachable from the research container; the formulas were read in the
 * open CeCILL-C package `tilupy` (analytic_sol.py, classes Ritter_dry and
 * Stoker_SWASHES_wet, which state they implement the SWASHES equations), and
 * cross-checked against the exact SWE Riemann solver (integral curves +
 * Hugoniot loci) of the BSD-licensed Riemann-problems book code
 * (clawpack/riemann_book exact_solvers/shallow_water.py), re-implemented
 * independently in research/test-exact-solvers.js.
 *
 * Stoker: the middle-state celerity c_m = sqrt(g h_m) is the root in
 * (sqrt(g h_r), sqrt(g h_l)) of
 *    -8 g h_r c_m^2 (g h_l - c_m^2)^2 + (c_m^2 - g h_r)^2 (c_m^2 + g h_r) = 0,
 * solved here by safeguarded Newton (Newton with bisection fallback on the bracket,
 * where the residual changes sign: F(sqrt(g h_r)) < 0 < F(sqrt(g h_l))).
 */
(function (LAB) {
  'use strict';

  // Default configuration: SWASHES dam-break set-up as quoted in open search snippets
  // (L = 10 m, x0 = 5 m, h_l = 0.005 m; Stoker h_r = 0.001 m; final time T = 6 s).
  // h_r = 0.001 and T = 6 s were NOT confirmed by any retrieved text (recollection), see research/hyp.md.
  var DEF = { g: 9.81, x0: 5, hl: 0.005, hr: 0.001, L: 10, tEnd: 6 };
  // Alternative unit-domain configuration (BrowserLab choice, not from a source):
  var UNIT = { g: 9.81, x0: 0.5, hl: 1.0, hr: 0.1, L: 1, tEnd: 0.05 };

  function merge(base, over) {
    var o = {}, k;
    for (k in base) o[k] = base[k];
    if (over) for (k in over) if (over[k] !== undefined && over[k] !== null) o[k] = over[k];
    return o;
  }

  function stokerResidual(cm, g, hl, hr) {
    var c2 = cm * cm, a = g * hl - c2, b = c2 - g * hr;
    return -8 * g * hr * c2 * a * a + b * b * (c2 + g * hr);
  }
  function stokerResidualDeriv(cm, g, hl, hr) {
    var c2 = cm * cm, a = g * hl - c2, b = c2 - g * hr;
    // d/dcm of the residual
    var d1 = -8 * g * hr * (2 * cm * a * a + c2 * 2 * a * (-2 * cm));
    var d2 = 2 * b * (2 * cm) * (c2 + g * hr) + b * b * (2 * cm);
    return d1 + d2;
  }

  /* c_m for Stoker's wet-bed dam break (requires 0 < hr < hl). */
  function stokerCm(g, hl, hr) {
    if (!(hr > 0 && hl > hr)) throw new Error('stokerCm: need 0 < hr < hl');
    var lo = Math.sqrt(g * hr), hi = Math.sqrt(g * hl);
    var flo = stokerResidual(lo, g, hl, hr);
    var cm = 0.5 * (lo + hi), it = 0;
    for (; it < 200; it++) {
      var f = stokerResidual(cm, g, hl, hr);
      if (f === 0) break;
      if ((f < 0) === (flo < 0)) lo = cm; else hi = cm;      // keep bracket
      var d = stokerResidualDeriv(cm, g, hl, hr);
      var cn = cm - f / d;
      if (!(cn > lo && cn < hi) || !isFinite(cn)) cn = 0.5 * (lo + hi);  // bisection fallback
      if (Math.abs(cn - cm) <= 1e-15 * Math.max(1, cm)) { cm = cn; break; }
      cm = cn;
    }
    stokerCm.lastIterations = it;
    return cm;
  }

  function stokerState(P) {
    var cm = stokerCm(P.g, P.hl, P.hr), sl = Math.sqrt(P.g * P.hl);
    return {
      cm: cm, hm: cm * cm / P.g, um: 2 * (sl - cm),
      speedA: -sl,                                        // rarefaction head
      speedB: 2 * sl - 3 * cm,                            // rarefaction tail
      speedC: 2 * cm * cm * (sl - cm) / (cm * cm - P.g * P.hr) // shock
    };
  }

  /* Ritter dry-bed solution. */
  function ritter(x, t, params) {
    var P = merge(DEF, params); P.hr = 0;
    var sl = Math.sqrt(P.g * P.hl);
    if (!(t > 0)) return x <= P.x0 ? { h: P.hl, u: 0 } : { h: 0, u: 0 };
    var xA = P.x0 - t * sl, xB = P.x0 + 2 * t * sl;
    if (x <= xA) return { h: P.hl, u: 0 };
    if (x <= xB) {
      var s = sl - (x - P.x0) / (2 * t);
      return { h: 4 / (9 * P.g) * s * s, u: 2 / 3 * ((x - P.x0) / t + sl) };
    }
    return { h: 0, u: 0 };
  }
  ritter.front = function (t, params) { var P = merge(DEF, params); return P.x0 + 2 * t * Math.sqrt(P.g * P.hl); };
  ritter.head = function (t, params) { var P = merge(DEF, params); return P.x0 - t * Math.sqrt(P.g * P.hl); };

  var cache = { key: null, st: null };
  /* Stoker wet-bed solution (falls back to Ritter when hr <= 0). */
  function stoker(x, t, params) {
    var P = merge(DEF, params);
    if (!(P.hr > 0)) return ritter(x, t, P);
    var key = P.g + ',' + P.hl + ',' + P.hr;
    if (cache.key !== key) { cache.st = stokerState(P); cache.key = key; }
    var st = cache.st, sl = Math.sqrt(P.g * P.hl);
    if (!(t > 0)) return x <= P.x0 ? { h: P.hl, u: 0 } : { h: P.hr, u: 0 };
    var xA = P.x0 + st.speedA * t, xB = P.x0 + st.speedB * t, xC = P.x0 + st.speedC * t;
    if (x <= xA) return { h: P.hl, u: 0 };
    if (x <= xB) {
      var s = sl - (x - P.x0) / (2 * t);
      return { h: 4 / (9 * P.g) * s * s, u: 2 / 3 * ((x - P.x0) / t + sl) };
    }
    if (x <= xC) return { h: st.hm, u: st.um };
    return { h: P.hr, u: 0 };
  }
  stoker.state = function (params) { return stokerState(merge(DEF, params)); };
  stoker.cm = stokerCm;
  stoker.defaults = DEF;
  stoker.unitDefaults = UNIT;

  LAB.registerReference({
    id: 'swe-dambreak-ritter',
    scene: 'swe-dambreak',
    quantity: 'Ritter dry-bed dam-break {h,u}(x,t); params {g, x0, hl} (default SWASHES: g=9.81, x0=5 m, hl=0.005 m on [0,10] m)',
    source: 'swashes2013', location: 'Sec. 4.1.2 "Dam break on a dry domain without friction (Ritter\'s solution)" (equation numbers not verified); formulas read in tilupy analytic_sol.Ritter_dry',
    kind: 'function',
    fn: ritter,
    params: { t: 6, x: [0, 10], alt: UNIT },
    tolerance: {
      metric: 'L1-depth-relative',
      value: { 'N=200': 0.06, 'N=400': 0.04 },
      rationale: 'sum|h_num-h_exact|dx / sum h_exact dx at t_end. No published L1 table retrieved; band set at ~1.5x the researcher\'s scratch ' +
        'HLL (Einfeldt speeds, first order, CFL 0.9) measurement (research/hyp.md). The wet/dry front is smeared and lags for first-order schemes; ' +
        'front position checks should use a threshold (e.g. h > 1e-6 hl) with a band of several cells, not the exact front 2 sqrt(g hl) t.'
    }
  });

  LAB.registerReference({
    id: 'swe-dambreak-stoker',
    scene: 'swe-dambreak',
    quantity: 'Stoker wet-bed dam-break {h,u}(x,t); params {g, x0, hl, hr} (default SWASHES: g=9.81, x0=5, hl=0.005, hr=0.001)',
    source: 'swashes2013', location: 'Sec. 4.1.1 "Dam break on a wet domain without friction (Stoker\'s solution)"; c_m equation and x_A, x_B, x_C as in tilupy analytic_sol.Stoker_SWASHES_wet',
    kind: 'function',
    fn: stoker,
    params: { t: 6, x: [0, 10], alt: UNIT },
    tolerance: {
      metric: 'L1-depth-relative',
      value: { 'first-order N=200': 0.03, 'first-order N=400': 0.02, 'second-order N=200': 0.015, 'second-order N=400': 0.008 },
      rationale: 'Relative L1 depth error at t_end. No published L1 table retrieved; bands ~1.5x researcher scratch measurements (HLL first order; ' +
        'MUSCL-Hancock+minmod+HLL second order), research/hyp.md.'
    }
  });

  /* Scalars computed by our solver for the default configs (NOT published numbers): exposed with a tight tolerance only as
   * exact-solver regression values; validated in research/test-exact-solvers.js by two independent formulations. */
  var sw = stokerState(DEF), su = stokerState(UNIT);
  LAB.registerReference({
    id: 'swe-stoker-hm-swashes', scene: 'swe-dambreak',
    quantity: 'Stoker middle depth h_m (hl=0.005, hr=0.001, g=9.81) — computed, not published',
    source: 'swashes2013', location: 'computed from the c_m equation of Sec. 4.1.1 by safeguarded Newton; cross-checked vs Hugoniot/integral-curve solver',
    kind: 'scalar', value: sw.hm, range: [sw.hm * (1 - 1e-10), sw.hm * (1 + 1e-10)],
    tolerance: { metric: 'rel', value: 0.01, rationale: 'For numerical schemes: plateau depth at mid-plateau within 1% at N>=200.' }
  });
  LAB.registerReference({
    id: 'swe-stoker-hm-unit', scene: 'swe-dambreak',
    quantity: 'Stoker middle depth h_m (unit config hl=1, hr=0.1, g=9.81) — computed, not published',
    source: 'swashes2013', location: 'computed as above',
    kind: 'scalar', value: su.hm, range: [su.hm * (1 - 1e-10), su.hm * (1 + 1e-10)],
    tolerance: { metric: 'rel', value: 0.01, rationale: 'For numerical schemes: plateau depth at mid-plateau within 1% at N>=200.' }
  });

  LAB.registerReference({
    id: 'swe-dambreak-totals', scene: 'swe-dambreak',
    quantity: 'Domain totals with transmissive BCs while waves are inside the domain: mass = x0*hl + (L-x0)*hr (constant); momentum(t) = g/2 (hl^2 - hr^2) t',
    source: 'swashes2013', location: 'follows from the conservation form of the SWE (flux of hu is hu^2 + g h^2/2) and the initial data',
    kind: 'function',
    fn: function (x, t, params) {
      var P = merge(DEF, params);
      return { mass: P.x0 * P.hl + (P.L - P.x0) * P.hr, momentum: 0.5 * P.g * (P.hl * P.hl - P.hr * P.hr) * t };
    },
    tolerance: { metric: 'rel', value: 1e-12, rationale: 'Conservative FV schemes conserve mass to round-off (positivity fixes that clip h<0 break this; flag them).' }
  });

})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
