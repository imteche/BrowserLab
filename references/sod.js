/* References for scene `sod` (1D Euler, ideal gas).
 * Researcher: hyperbolic-conservation-laws researcher agent, 2026-10-13.
 *
 * The exact solution is computed by our own pure-JS implementation of the
 * classical exact Riemann solver for the ideal-gas Euler equations
 * (Toro 2009 ch. 4 algorithm: pressure function f_L + f_R + du = 0 solved by
 * Newton for p*, then sampling of rarefaction / shock / contact). Toro's book
 * is paywalled; the formulas were taken from the open notes `zingale-cha`
 * (Euler-theory.tex, "Finding the Star State") and cross-checked against the
 * MIT-licensed `sodshock` package (ibackus/sod-shocktube), whose README prints
 * the star states to 17 digits. See research/hyp.md and
 * research/test-exact-solvers.js (validation to < 1e-12 vs sodshock and
 * to the 5 published digits of the Toro Test-1 star values).
 */
(function (LAB) {
  'use strict';

  var SOD = { gamma: 1.4, x0: 0.5, rhoL: 1.0, uL: 0.0, pL: 1.0, rhoR: 0.125, uR: 0.0, pR: 0.1 };
  // Toro's modified Sod (Toro 2009 Sec. 6.4 / Ch. 10 "Test 1": u_L = 0.75, x0 = 0.3).
  // Parameters as quoted in open search snippets (edanya.uma.es Toro lab session "Modified Sod");
  // star values below are COMPUTED by this solver, not published values.
  var SOD_MOD = { gamma: 1.4, x0: 0.3, rhoL: 1.0, uL: 0.75, pL: 1.0, rhoR: 0.125, uR: 0.0, pR: 0.1 };

  function merge(base, over) {
    var o = {}, k;
    for (k in base) o[k] = base[k];
    if (over) for (k in over) if (over[k] !== undefined && over[k] !== null) o[k] = over[k];
    return o;
  }

  /* Pressure function f_K(p) and its derivative (shock branch p > p_K, rarefaction branch p <= p_K). */
  function fK(p, rhoK, pK, aK, g) {
    if (p > pK) {
      var A = 2 / ((g + 1) * rhoK), B = (g - 1) / (g + 1) * pK;
      var q = Math.sqrt(A / (p + B));
      return [(p - pK) * q, q * (1 - (p - pK) / (2 * (B + p)))];
    }
    var pr = p / pK;
    return [2 * aK / (g - 1) * (Math.pow(pr, (g - 1) / (2 * g)) - 1),
            1 / (rhoK * aK) * Math.pow(pr, -(g + 1) / (2 * g))];
  }

  /* Star state {p, u, rhoL, rhoR, iterations}. Throws if the data generate vacuum. */
  function star(P) {
    var g = P.gamma;
    var aL = Math.sqrt(g * P.pL / P.rhoL), aR = Math.sqrt(g * P.pR / P.rhoR);
    var du = P.uR - P.uL;
    if (2 / (g - 1) * (aL + aR) <= du) throw new Error('sod reference: initial data generate vacuum');
    // PVRS initial guess (primitive-variable Riemann solver), clipped positive
    var p = 0.5 * (P.pL + P.pR) - 0.125 * du * (P.rhoL + P.rhoR) * (aL + aR);
    var TOL = 1e-15;
    if (p < 1e-8) p = 1e-8;
    var it = 0, change = 1;
    while (change > TOL && it < 100) {
      var L = fK(p, P.rhoL, P.pL, aL, g), R = fK(p, P.rhoR, P.pR, aR, g);
      var pn = p - (L[0] + R[0] + du) / (L[1] + R[1]);
      if (pn < 1e-12) pn = 1e-12;
      change = 2 * Math.abs(pn - p) / (pn + p);
      p = pn; it++;
    }
    var fl = fK(p, P.rhoL, P.pL, aL, g)[0], fr = fK(p, P.rhoR, P.pR, aR, g)[0];
    var u = 0.5 * (P.uL + P.uR) + 0.5 * (fr - fl);
    var gm = (g - 1) / (g + 1);
    function rhoStar(rhoK, pK) {
      var r = p / pK;
      if (p > pK) return rhoK * (r + gm) / (gm * r + 1);         // shock (Rankine-Hugoniot)
      return rhoK * Math.pow(r, 1 / g);                           // rarefaction (isentropic)
    }
    return { p: p, u: u, rhoL: rhoStar(P.rhoL, P.pL), rhoR: rhoStar(P.rhoR, P.pR), iterations: it, aL: aL, aR: aR };
  }

  /* Sample the self-similar solution at speed S = (x - x0)/t. Returns {rho,u,p}. */
  function sample(P, st, S) {
    var g = P.gamma, ps = st.p, us = st.u, aL = st.aL, aR = st.aR;
    var g1 = (g - 1) / (2 * g), g2 = (g + 1) / (2 * g), g7 = (g - 1) / 2;
    var c;
    if (S <= us) {                                   // left of contact
      if (ps <= P.pL) {                              // left rarefaction
        var shl = P.uL - aL;
        if (S <= shl) return { rho: P.rhoL, u: P.uL, p: P.pL };
        var cml = aL * Math.pow(ps / P.pL, g1), stl = us - cml;
        if (S > stl) return { rho: st.rhoL, u: us, p: ps };
        var u = 2 / (g + 1) * (aL + g7 * P.uL + S);
        c = 2 / (g + 1) * (aL + g7 * (P.uL - S));
        return { rho: P.rhoL * Math.pow(c / aL, 2 / (g - 1)), u: u, p: P.pL * Math.pow(c / aL, 2 * g / (g - 1)) };
      }
      var sl = P.uL - aL * Math.sqrt(g2 * ps / P.pL + g1);   // left shock speed
      if (S <= sl) return { rho: P.rhoL, u: P.uL, p: P.pL };
      return { rho: st.rhoL, u: us, p: ps };
    }
    if (ps > P.pR) {                                 // right shock
      var sr = P.uR + aR * Math.sqrt(g2 * ps / P.pR + g1);
      if (S >= sr) return { rho: P.rhoR, u: P.uR, p: P.pR };
      return { rho: st.rhoR, u: us, p: ps };
    }
    var shr = P.uR + aR;                              // right rarefaction
    if (S >= shr) return { rho: P.rhoR, u: P.uR, p: P.pR };
    var cmr = aR * Math.pow(ps / P.pR, g1), str = us + cmr;
    if (S <= str) return { rho: st.rhoR, u: us, p: ps };
    var ur = 2 / (g + 1) * (-aR + g7 * P.uR + S);
    c = 2 / (g + 1) * (aR - g7 * (P.uR - S));
    return { rho: P.rhoR * Math.pow(c / aR, 2 / (g - 1)), u: ur, p: P.pR * Math.pow(c / aR, 2 * g / (g - 1)) };
  }

  /* Wave positions at time t: rarefaction head/tail, contact, shock (for the standard Sod topology
   * rarefaction-left / shock-right; generic fields given when topology differs). */
  function wavePositions(P, t) {
    var st = star(P), g = P.gamma, g1 = (g - 1) / (2 * g), g2 = (g + 1) / (2 * g);
    var out = { contact: P.x0 + st.u * t };
    if (st.p <= P.pL) { out.rarefactionHead = P.x0 + (P.uL - st.aL) * t; out.rarefactionTail = P.x0 + (st.u - st.aL * Math.pow(st.p / P.pL, g1)) * t; }
    else out.leftShock = P.x0 + (P.uL - st.aL * Math.sqrt(g2 * st.p / P.pL + g1)) * t;
    if (st.p > P.pR) out.shock = P.x0 + (P.uR + st.aR * Math.sqrt(g2 * st.p / P.pR + g1)) * t;
    else { out.rightRarefactionHead = P.x0 + (P.uR + st.aR) * t; out.rightRarefactionTail = P.x0 + (st.u + st.aR * Math.pow(st.p / P.pR, g1)) * t; }
    return out;
  }

  var cache = { key: null, st: null };
  function exactSod(x, t, params) {
    var P = merge(SOD, params);
    var key = [P.gamma, P.rhoL, P.uL, P.pL, P.rhoR, P.uR, P.pR].join(',');
    if (cache.key !== key) { cache.st = star(P); cache.key = key; }
    var w;
    if (!(t > 0)) w = x < P.x0 ? { rho: P.rhoL, u: P.uL, p: P.pL } : { rho: P.rhoR, u: P.uR, p: P.pR };
    else w = sample(P, cache.st, (x - P.x0) / t);
    // e = specific internal energy p / ((gamma-1) rho)  (same convention as sodshock `energy`)
    return { rho: w.rho, u: w.u, p: w.p, e: w.p / ((P.gamma - 1) * w.rho) };
  }
  exactSod.star = function (params) { return star(merge(SOD, params)); };
  exactSod.wavePositions = function (t, params) { return wavePositions(merge(SOD, params), t); };
  exactSod.defaults = SOD;
  exactSod.modifiedSodDefaults = SOD_MOD;

  /* ---------------- function references ---------------- */

  LAB.registerReference({
    id: 'sod-exact-profile',
    scene: 'sod',
    quantity: 'Exact Riemann solution {rho,u,p,e}(x,t) for the Sod shock tube (gamma=1.4, x0=0.5, (1,0,1)|(0.125,0,0.1)); params may override gamma,x0,rhoL,uL,pL,rhoR,uR,pR',
    source: 'toro2009', location: 'Ch. 4 exact Riemann solver (Secs. 4.2-4.5, pressure function + sampling); formulas read in open copy zingale-cha Euler-theory.tex Sec. "Finding the Star State"; numbers cross-checked vs sodshock',
    kind: 'function',
    fn: exactSod,
    params: { t: 0.2, x: [0, 1] },
    tolerance: {
      metric: 'L1-density',
      value: { 'first-order N=100': 0.021, 'first-order N=200': 0.013, 'first-order N=400': 0.0085,
               'second-order N=100': 0.0095, 'second-order N=200': 0.0052, 'second-order N=400': 0.0029 },
      rationale: 'L1 norm of rho_num - rho_exact over [0,1] at t=0.2 (cell-average of the method vs exact value at cell centre, sum |.|*dx). ' +
        'NO open source with tabulated Sod L1 errors could be retrieved (see research/hyp.md). Values are BrowserLab engineering bands ' +
        'set at ~1.4x the errors measured with the researcher\'s scratch implementations (Godunov-HLLC first order: 1.475e-2/9.366e-3/5.970e-3 at N=100/200/400; ' +
        'MUSCL-Hancock + minmod on conservative variables + HLLC: 6.581e-3/3.581e-3/1.997e-3; CFL 0.9; `node research/test-exact-solvers.js --calibrate`). ' +
        'Observed L1 orders ~0.65 (first order) and ~0.85 (second order): below 1 because of the discontinuities. Lax-Friedrichs is far more diffusive; use the separate lax-friedrichs band.'
    }
  });

  LAB.registerReference({
    id: 'sod-exact-profile-laxfriedrichs-band',
    scene: 'sod',
    quantity: 'L1 density error band for the (global) Lax-Friedrichs scheme on Sod at t=0.2',
    source: 'toro2009', location: 'exact solution as in sod-exact-profile; band is an engineering choice',
    kind: 'function',
    fn: exactSod,
    tolerance: {
      metric: 'L1-density',
      value: { 'N=100': 0.040, 'N=200': 0.028, 'N=400': 0.019 },
      rationale: 'Classic Lax-Friedrichs (U_i^{n+1} = (U_{i-1}+U_{i+1})/2 - dt/(2dx)(F_{i+1}-F_{i-1}), CFL 0.9) is very diffusive and shows odd-even ' +
        'decoupling in constant states; no published L1 table found. Bands ~1.4x researcher scratch measurement 2.848e-2/2.017e-2/1.363e-2 at N=100/200/400 (observed order 0.50-0.57), research/hyp.md.'
    }
  });

  LAB.registerReference({
    id: 'sod-modified-exact-profile',
    scene: 'sod',
    quantity: 'Exact solution for Toro\'s modified Sod test (u_L=0.75, x0=0.3, t=0.2), which contains a sonic point in the left rarefaction',
    source: 'toro2009', location: 'Test 1 of Ch. 6/10/14 test suite (as quoted in open snippets); exact solution computed with the same solver',
    kind: 'function',
    fn: function (x, t, params) { return exactSod(x, t, merge(SOD_MOD, params)); },
    params: { t: 0.2, x: [0, 1] },
    tolerance: { metric: 'L1-density', value: { 'first-order N=100': 0.019, 'first-order N=400': 0.0081, 'second-order N=100': 0.0095, 'second-order N=400': 0.0034 },
      rationale: 'Engineering band ~1.4x researcher scratch measurement (Godunov-HLLC 1.354e-2 @N=100, 5.778e-3 @N=400; MUSCL-Hancock-minmod-HLLC 6.800e-3 @100, 2.398e-3 @400). ' +
        'Qualitative check (Toro): first-order Roe without entropy fix shows an entropy-violating jump at the sonic point near x~0.3; HLLC / exact-solver Godunov do not.' }
  });

  /* ---------------- scalar references: published star values ---------------- */
  function sc(id, qty, value, digits, src, loc, note) {
    var h = 0.5 * Math.pow(10, -digits);
    LAB.registerReference({
      id: id, scene: 'sod', quantity: qty, source: src, location: loc, kind: 'scalar',
      value: value, range: [value - h, value + h],
      tolerance: { metric: 'abs', value: 1e-4, rationale: note }
    });
  }
  var NOTE = 'Published to 5 decimals (rounding band +-5e-6). The 1e-4 band is for exact-solver checks; for a numerical scheme read the star plateau ' +
    'at the middle of the plateau and use a band of ~2% (first order) / 1% (second order) at N=400, since plateaus are reached only away from waves.';
  sc('sod-pstar', 'Star-region pressure p* (Sod, gamma=1.4)', 0.30313, 5, 'toro2009',
    'Table 4.2/4.3, Test 1 (as quoted in the task brief; p*, u* confirmed to 4 decimals by search snippet of arXiv:2412.03522 table; 17-digit value 0.30313017805064707 in sodshock README "Region 3")', NOTE);
  sc('sod-ustar', 'Star-region velocity u* (Sod, gamma=1.4)', 0.92745, 5, 'toro2009',
    'Table 4.3, Test 1 (secondary: sodshock README 0.92745262004895057; arXiv:2412.03522 snippet 0.9274)', NOTE);
  sc('sod-rhostarL', 'Left star density rho*_L (behind rarefaction)', 0.42632, 5, 'toro2009',
    'Table 4.3, Test 1 (secondary: sodshock README "Region 3" rho = 0.42631942817849544)', NOTE);
  sc('sod-rhostarR', 'Right star density rho*_R (behind shock)', 0.26557, 5, 'toro2009',
    'Table 4.3, Test 1 (secondary: sodshock README "Region 4" rho = 0.26557371170530725)', NOTE);

  /* wave positions at t = 0.2 printed by the sodshock README (secondary, computed values) */
  function wp(id, qty, v, key) {
    LAB.registerReference({
      id: id, scene: 'sod', quantity: qty, source: 'sodshock2015', location: 'README.md, example output "Positions:" (t=0.2, x0=0.5, gamma=1.4)',
      kind: 'scalar', value: v, range: [v - 1e-12, v + 1e-12],
      tolerance: { metric: 'abs', value: 0.01, rationale: 'For numerical schemes: wave located (e.g. steepest gradient / midpoint of jump) within ~2 cells at N=200. ' +
        'Exact solver reproduces it to 1e-12 (research/test-exact-solvers.js). key=' + key }
    });
  }
  wp('sod-x-shock', 'Shock position at t=0.2', 0.8504311464060357, 'shock');
  wp('sod-x-contact', 'Contact discontinuity position at t=0.2', 0.6854905240097902, 'contact');
  wp('sod-x-rarefaction-head', 'Rarefaction head position at t=0.2', 0.26335680867601535, 'rarefactionHead');
  wp('sod-x-rarefaction-tail', 'Rarefaction tail (foot) position at t=0.2', 0.4859454374877634, 'rarefactionTail');

  /* Conservation: with transmissive (zero-gradient) boundaries and waves not reaching x=0 or x=1 by t=0.2, domain totals change only by
   * boundary fluxes, which are exactly F(left state)-F(right state) = (0, pL-pR, 0) per unit time. */
  LAB.registerReference({
    id: 'sod-totals', scene: 'sod',
    quantity: 'Domain integrals on [0,1]: mass(t)=0.5625, energy(t)=2.75 constant; momentum(t)=0.9*t (net boundary pressure force pL-pR)',
    source: 'sod1978', location: 'follows from the conservation form and the initial data (mass 0.5*1+0.5*0.125; E=p/(gamma-1): 0.5*2.5+0.5*0.25)',
    kind: 'function',
    fn: function (x, t) { return { mass: 0.5625, momentum: 0.9 * t, energy: 2.75 }; },
    tolerance: { metric: 'rel', value: 1e-12, rationale: 'Conservative finite-volume schemes with transmissive BCs conserve to round-off; momentum grows by (pL-pR)*t = 0.9t ' +
      'while the waves remain inside [0,1] (head at 0.263, shock at 0.850 at t=0.2). Note: with N even, the diaphragm must lie on a cell face for mass to be exactly 0.5625.' }
  });

})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
