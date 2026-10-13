#!/usr/bin/env node
/* Validation of the exact reference solvers in references/sod.js and references/swe-dambreak.js.
 *   node research/test-exact-solvers.js              -> validation checks (exit code 1 on failure)
 *   node research/test-exact-solvers.js --calibrate  -> also run the researcher's scratch FV schemes used to set
 *                                                       the L1 tolerance bands (NOT method implementations for the lab)
 * Loads the reference files into a stub LAB (no dependency on js/core.js).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const refs = {};
globalThis.LAB = {
  registerReference: r => { refs[r.id] = r; },
  registerSource: () => {}
};
for (const f of ['references/sod.js', 'references/swe-dambreak.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
}

let fails = 0, passes = 0;
function check(name, got, want, tol, kind) {
  const err = kind === 'rel' ? Math.abs(got - want) / Math.abs(want) : Math.abs(got - want);
  const ok = err <= tol && Number.isFinite(got);
  ok ? passes++ : fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(52)} got ${got.toPrecision(12).padStart(16)}  want ${String(want).padStart(20)}  ${kind === 'rel' ? 'rel' : 'abs'}err ${err.toExponential(2)} (tol ${tol})`);
}

/* ================= 1. Euler / Sod ================= */
const sod = refs['sod-exact-profile'].fn;
const st = sod.star();
console.log(`\n# Sod (gamma=1.4): exact solver converged in ${st.iterations} Newton iterations`);
console.log('## vs Toro (2009) Table 4.3 Test 1, 5 published decimals (values as quoted in task brief / scalar refs)');
check('p*   vs 0.30313', st.p, refs['sod-pstar'].value, 1e-4);
check('u*   vs 0.92745', st.u, refs['sod-ustar'].value, 1e-4);
check('rho*L vs 0.42632', st.rhoL, refs['sod-rhostarL'].value, 1e-4);
check('rho*R vs 0.26557', st.rhoR, refs['sod-rhostarR'].value, 1e-4);
console.log('## same, at the rounding band of the published digits (5e-6)');
check('p*   rounding band', st.p, 0.30313, 5e-6);
check('u*   rounding band', st.u, 0.92745, 5e-6);
check('rho*L rounding band', st.rhoL, 0.42632, 5e-6);
check('rho*R rounding band', st.rhoR, 0.26557, 5e-6);
console.log('## vs sodshock README (ibackus/sod-shocktube, MIT; independent Python implementation, 17 digits)');
check('p*   vs sodshock', st.p, 0.30313017805064707, 1e-12);
check('u*   vs sodshock', st.u, 0.92745262004895057, 1e-12);
check('rho*L vs sodshock', st.rhoL, 0.42631942817849544, 1e-12);
check('rho*R vs sodshock', st.rhoR, 0.26557371170530725, 1e-12);
const wpos = sod.wavePositions(0.2);
check('x_shock(t=0.2) vs sodshock', wpos.shock, 0.8504311464060357, 1e-12);
check('x_contact(t=0.2) vs sodshock', wpos.contact, 0.6854905240097902, 1e-12);
check('x_raref_head(t=0.2) vs sodshock', wpos.rarefactionHead, 0.26335680867601535, 1e-12);
check('x_raref_tail(t=0.2) vs sodshock', wpos.rarefactionTail, 0.4859454374877634, 1e-12);
console.log('## sampled profile fn(x, 0.2) inside each plateau');
let s = sod(0.6, 0.2); check('fn(0.60).rho = rho*L', s.rho, st.rhoL, 1e-14); check('fn(0.60).p = p*', s.p, st.p, 1e-14);
s = sod(0.75, 0.2); check('fn(0.75).rho = rho*R', s.rho, st.rhoR, 1e-14); check('fn(0.75).u = u*', s.u, st.u, 1e-14);
s = sod(0.1, 0.2); check('fn(0.10).rho = rho_L (undisturbed)', s.rho, 1, 0);
s = sod(0.95, 0.2); check('fn(0.95).rho = rho_R (undisturbed)', s.rho, 0.125, 0);
s = sod(0.4859454374877634 - 1e-9, 0.2); check('rarefaction continuous at tail (rho)', s.rho, st.rhoL, 1e-7);
s = sod(0.26335680867601535 + 1e-9, 0.2); check('rarefaction continuous at head (rho)', s.rho, 1, 1e-7);
check('fn(0.6).e = p/((g-1)rho)', sod(0.6, 0.2).e, st.p / (0.4 * st.rhoL), 1e-14);
console.log('## Rankine-Hugoniot at the right shock (mass, momentum, energy flux continuity in the shock frame)');
{
  const S = (wpos.shock - 0.5) / 0.2, g = 1.4;
  const L = { r: st.rhoR, u: st.u, p: st.p }, R = { r: 0.125, u: 0, p: 0.1 };
  const E = q => q.p / (g - 1) + 0.5 * q.r * q.u * q.u;
  const jump = (fL, fR, qL, qR) => (fL - fR) - S * (qL - qR);
  check('RH mass', jump(L.r * L.u, R.r * R.u, L.r, R.r), 0, 1e-13);
  check('RH momentum', jump(L.r * L.u * L.u + L.p, R.r * R.u * R.u + R.p, L.r * L.u, R.r * R.u), 0, 1e-13);
  check('RH energy', jump(L.u * (E(L) + L.p), R.u * (E(R) + R.p), E(L), E(R)), 0, 1e-13);
  // isentrope across rarefaction
  check('isentropic rarefaction p/rho^g', st.p / Math.pow(st.rhoL, g), 1, 1e-13);
}
console.log('## Interface state W(x/t=0) vs SWIFT testRiemannExact.c (Toro tests 1-5, LGPL, float32 values, gamma=5/3)');
{
  const tests = [
    ['T1', [1, 0, 1], [0.125, 0, 0.1], [0.47969, 0.841194, 0.293945]],
    ['T2', [1, -2, 0.4], [1, 2, 0.4], [0.00617903, 0, 8.32249e-5]],
    ['T3', [1, 0, 1000], [1, 0, 0.01], [0.615719, 18.2812, 445.626]],
    ['T4', [1, 0, 0.01], [1, 0, 100], [0.61577, -5.78022, 44.5687]],
    ['T5', [5.99924, 19.5975, 460.894], [5.99242, -6.19633, 46.0950], [12.743, 8.56045, 1841.82]]
  ];
  for (const [n, l, r, w] of tests) {
    const P = { gamma: 5 / 3, x0: 0, rhoL: l[0], uL: l[1], pL: l[2], rhoR: r[0], uR: r[1], pR: r[2] };
    const q = sod(0, 1, P); // x/t = 0
    check(`SWIFT ${n} rho(x/t=0)`, q.rho, w[0], 2e-4, 'rel');
    if (w[1] !== 0) check(`SWIFT ${n} u(x/t=0)`, q.u, w[1], 2e-4, 'rel'); else check(`SWIFT ${n} u(x/t=0)`, q.u, 0, 1e-9);
    check(`SWIFT ${n} p(x/t=0)`, q.p, w[2], 2e-4, 'rel');
  }
}
console.log('## Toro modified Sod (uL=0.75, x0=0.3), computed star state (no open published value found)');
{
  const m = sod.star(sod.modifiedSodDefaults);
  console.log(`INFO  modified Sod: p*=${m.p.toPrecision(10)} u*=${m.u.toPrecision(10)} rho*L=${m.rhoL.toPrecision(10)} rho*R=${m.rhoR.toPrecision(10)}`);
  const P = sod.modifiedSodDefaults, aL = Math.sqrt(1.4);
  console.log(`INFO  left rarefaction head speed uL-aL=${(P.uL - aL).toFixed(6)} < 0 < tail speed u*-c*L=${(m.u - Math.sqrt(1.4 * m.p / m.rhoL)).toFixed(6)} -> sonic (transonic) rarefaction`);
}

/* ================= 2. Shallow water dam break ================= */
const stoker = refs['swe-dambreak-stoker'].fn, ritter = refs['swe-dambreak-ritter'].fn;
/* Independent exact SWE Riemann solution for u_l=u_r=0, h_l>h_r>0: 1-rarefaction (integral curve) + 2-shock (Hugoniot locus),
 * formulas as in clawpack/riemann_book exact_solvers/shallow_water.py (BSD-3); solved by bisection on h. */
function independentDamBreak(g, hl, hr) {
  const ul = h => 2 * (Math.sqrt(g * hl) - Math.sqrt(g * h));                 // integral curve from left
  const ur = h => (h - hr) * Math.sqrt(g * (h + hr) / (2 * h * hr));           // Hugoniot locus from right (2-shock)
  let a = hr, b = hl;
  for (let i = 0; i < 200; i++) { const m = 0.5 * (a + b); (ul(m) - ur(m) > 0) ? (a = m) : (b = m); }
  const hm = 0.5 * (a + b), um = ul(hm);
  return { hm, um, shock: hm * um / (hm - hr) };                                // RH mass: s [h] = [hu]
}
function integrate(fn, a, b, n) { let s = 0; const dx = (b - a) / n; for (let i = 0; i < n; i++) s += fn(a + (i + 0.5) * dx); return s * dx; }

for (const [label, P] of [['SWASHES config (hl=0.005, hr=0.001)', stoker.defaults], ['unit config (hl=1, hr=0.1)', stoker.unitDefaults],
                          ['strong ratio (hl=1, hr=1e-4)', { g: 9.81, x0: 0.5, hl: 1, hr: 1e-4, L: 1, tEnd: 0.05 }]]) {
  console.log(`\n# Stoker ${label}`);
  const S = stoker.state(P), I = independentDamBreak(P.g, P.hl, P.hr);
  console.log(`INFO  cm=${S.cm.toPrecision(12)} hm=${S.hm.toPrecision(12)} um=${S.um.toPrecision(12)} shock speed=${S.speedC.toPrecision(12)} (Newton iters ${stoker.cm.lastIterations})`);
  check('c_m-equation residual (scaled by (g hl)^3)', Math.abs((function (cm) { const c2 = cm * cm, A = Math.sqrt(P.g * P.hl) - cm, B = c2 - P.g * P.hr; return (-8 * P.g * P.hr * c2 * A * A + B * B * (c2 + P.g * P.hr)) / Math.pow(P.g * P.hl, 3); })(S.cm)), 0, 1e-13);
  check('h_m vs independent Hugoniot/integral-curve', S.hm, I.hm, 1e-10, 'rel');
  check('u_m vs independent', S.um, I.um, 1e-10, 'rel');
  check('shock speed x_C/t vs RH mass jump', S.speedC, I.shock, 1e-10, 'rel');
  check('RH momentum across shock', (S.hm * S.um * S.um + 0.5 * P.g * S.hm * S.hm) - (0.5 * P.g * P.hr * P.hr) - S.speedC * (S.hm * S.um), 0, 1e-12 * P.g * P.hl * P.hl);
  check('continuity h at rarefaction tail x_B', stoker(P.x0 + S.speedB * P.tEnd - 1e-12, P.tEnd, P).h, S.hm, 1e-8, 'rel');
  const mass = integrate(x => stoker(x, P.tEnd, P).h, 0, P.L, 2e6);
  check('mass integral = x0 hl + (L-x0) hr', mass, P.x0 * P.hl + (P.L - P.x0) * P.hr, 1e-6, 'rel');
  const mom = integrate(x => { const q = stoker(x, P.tEnd, P); return q.h * q.u; }, 0, P.L, 2e6);
  check('momentum integral = g/2 (hl^2-hr^2) t', mom, 0.5 * P.g * (P.hl * P.hl - P.hr * P.hr) * P.tEnd, 1e-5, 'rel');
  console.log(`INFO  waves at t=${P.tEnd}: x_A=${(P.x0 + S.speedA * P.tEnd).toFixed(6)} x_B=${(P.x0 + S.speedB * P.tEnd).toFixed(6)} x_C=${(P.x0 + S.speedC * P.tEnd).toFixed(6)} (domain [0,${P.L}])`);
}
for (const [label, P] of [['SWASHES config (hl=0.005)', stoker.defaults], ['unit config (hl=1)', stoker.unitDefaults]]) {
  console.log(`\n# Ritter ${label}`);
  const t = P.tEnd, c = Math.sqrt(P.g * P.hl);
  check('front x_B = x0 + 2 sqrt(g hl) t', ritter.front(t, P), P.x0 + 2 * c * t, 1e-14);
  check('h at x0 (critical depth 4hl/9)', ritter(P.x0, t, P).h, 4 * P.hl / 9, 1e-15);
  check('u at x0 (= 2/3 sqrt(g hl))', ritter(P.x0, t, P).u, 2 / 3 * c, 1e-15);
  const mass = integrate(x => ritter(x, t, P).h, 0, P.L, 2e6);
  check('mass integral = x0 hl', mass, P.x0 * P.hl, 1e-8, 'rel');
  const mom = integrate(x => { const q = ritter(x, t, P); return q.h * q.u; }, 0, P.L, 2e6);
  check('momentum integral = g hl^2 t / 2', mom, 0.5 * P.g * P.hl * P.hl * t, 1e-8, 'rel');
  const sm = stoker.state(Object.assign({}, P, { hr: 1e-9 * P.hl }));
  check('Stoker(hr->1e-9 hl) shock speed -> Ritter front speed 2c', sm.speedC, 2 * c, 0.02, 'rel');
}

console.log(`\nSUMMARY: ${passes} passed, ${fails} failed`);

/* ================= 3. Optional calibration of L1 tolerance bands ================= */
if (process.argv.includes('--calibrate')) calibrate();
process.exitCode = fails ? 1 : 0;

function calibrate() {
  console.log('\n# Calibration runs (researcher scratch schemes; transmissive BCs; L1 vs exact at cell centres)');
  const G = 1.4;
  const prim = (U) => { const r = U[0], u = U[1] / r; return [r, u, (G - 1) * (U[2] - 0.5 * r * u * u)]; };
  const cons = (r, u, p) => [r, r * u, p / (G - 1) + 0.5 * r * u * u];
  const flux = (U) => { const [r, u, p] = prim(U); return [r * u, r * u * u + p, u * (U[2] + p)]; };
  function hllc(UL, UR) {  // Toro 2009 Sec. 10.4-10.6: Davis-type speed bounds, Eq. (10.37)/(10.39)-type star states
    const [rL, uL, pL] = prim(UL), [rR, uR, pR] = prim(UR);
    const aL = Math.sqrt(G * pL / rL), aR = Math.sqrt(G * pR / rR);
    const SL = Math.min(uL - aL, uR - aR), SR = Math.max(uL + aL, uR + aR);
    const Ss = (pR - pL + rL * uL * (SL - uL) - rR * uR * (SR - uR)) / (rL * (SL - uL) - rR * (SR - uR));
    if (SL >= 0) return flux(UL);
    if (SR <= 0) return flux(UR);
    const star = (U, r, u, p, S) => { const f = r * (S - u) / (S - Ss); return [f, f * Ss, f * (U[2] / r + (Ss - u) * (Ss + p / (r * (S - u))))]; };
    if (Ss >= 0) { const F = flux(UL), Us = star(UL, rL, uL, pL, SL); return F.map((v, k) => v + SL * (Us[k] - UL[k])); }
    const F = flux(UR), Us = star(UR, rR, uR, pR, SR); return F.map((v, k) => v + SR * (Us[k] - UR[k]));
  }
  const minmod = (a, b) => (a * b <= 0 ? 0 : (Math.abs(a) < Math.abs(b) ? a : b));
  function runEuler(N, scheme, P, tEnd, cfl) {
    const dx = 1 / N; let U = [];
    for (let i = 0; i < N; i++) { const x = (i + 0.5) * dx; U.push(x < P.x0 ? cons(P.rhoL, P.uL, P.pL) : cons(P.rhoR, P.uR, P.pR)); }
    let t = 0;
    while (t < tEnd - 1e-14) {
      let smax = 0; for (const q of U) { const [r, u, p] = prim(q); smax = Math.max(smax, Math.abs(u) + Math.sqrt(G * p / r)); }
      let dt = cfl * dx / smax; if (t + dt > tEnd) dt = tEnd - t;
      const ext = [U[0], ...U, U[N - 1]];  // one ghost cell each side (transmissive)
      const ext2 = [U[0], U[0], ...U, U[N - 1], U[N - 1]];
      let Un = [];
      if (scheme === 'lf') {
        for (let i = 0; i < N; i++) { const a = ext[i], b = ext[i + 2], Fa = flux(a), Fb = flux(b); Un.push([0, 1, 2].map(k => 0.5 * (a[k] + b[k]) - dt / (2 * dx) * (Fb[k] - Fa[k]))); }
      } else if (scheme === 'godunov') {
        const F = []; for (let i = 0; i <= N; i++) F.push(hllc(ext[i], ext[i + 1]));
        for (let i = 0; i < N; i++) Un.push([0, 1, 2].map(k => U[i][k] - dt / dx * (F[i + 1][k] - F[i][k])));
      } else { // MUSCL-Hancock, conservative-variable minmod slopes (Toro 2009 Sec. 14.4)
        const L = [], R = [];
        for (let j = 0; j < N + 2; j++) {
          const c = ext2[j + 1], m = ext2[j], p = ext2[j + 2];
          const d = [0, 1, 2].map(k => minmod(c[k] - m[k], p[k] - c[k]));
          const uL = c.map((v, k) => v - 0.5 * d[k]), uR = c.map((v, k) => v + 0.5 * d[k]);
          const fL = flux(uL), fR = flux(uR);
          L.push(uL.map((v, k) => v + 0.5 * dt / dx * (fL[k] - fR[k]))); R.push(uR.map((v, k) => v + 0.5 * dt / dx * (fL[k] - fR[k])));
        }
        const F = []; for (let i = 0; i <= N; i++) F.push(hllc(R[i], L[i + 1]));
        for (let i = 0; i < N; i++) Un.push([0, 1, 2].map(k => U[i][k] - dt / dx * (F[i + 1][k] - F[i][k])));
      }
      U = Un; t += dt;
    }
    let e = 0; for (let i = 0; i < N; i++) e += Math.abs(U[i][0] - sod((i + 0.5) / N, tEnd, P).rho) / N;
    return e;
  }
  for (const [lab, P] of [['Sod', sod.defaults], ['modified Sod', sod.modifiedSodDefaults]]) {
    for (const scheme of ['lf', 'godunov', 'muscl']) {
      const errs = [100, 200, 400].map(N => runEuler(N, scheme, P, 0.2, 0.9));
      console.log(`CAL  ${lab.padEnd(13)} ${scheme.padEnd(8)} L1(rho) N=100: ${errs[0].toExponential(3)}  N=200: ${errs[1].toExponential(3)}  N=400: ${errs[2].toExponential(3)}  ` +
        `order(100->200)=${Math.log2(errs[0] / errs[1]).toFixed(2)} order(200->400)=${Math.log2(errs[1] / errs[2]).toFixed(2)}`);
    }
  }
  // Shallow water HLL (Einfeldt speeds, as clawpack shallow_hll_1D) first order and MUSCL-Hancock second order
  function runSWE(N, second, P, cfl) {
    const g = P.g, dx = P.L / N; let U = [];
    for (let i = 0; i < N; i++) { const x = (i + 0.5) * dx; U.push([x < P.x0 ? P.hl : P.hr, 0]); }
    const vel = q => (q[0] > 1e-12 ? q[1] / q[0] : 0);
    const F = q => { const u = vel(q); return [q[1], q[1] * u + 0.5 * g * q[0] * q[0]]; };
    function hll(a, b) {
      const ha = a[0], hb = b[0];
      if (ha <= 1e-12 && hb <= 1e-12) return [0, 0];
      const ua = vel(a), ub = vel(b), ca = Math.sqrt(g * Math.max(ha, 0)), cb = Math.sqrt(g * Math.max(hb, 0));
      const sa = Math.sqrt(Math.max(ha, 0)), sb = Math.sqrt(Math.max(hb, 0));
      const uh = (sa * ua + sb * ub) / (sa + sb), ch = Math.sqrt(0.5 * g * (ha + hb));
      let s1 = Math.min(ua - ca, uh - ch), s2 = Math.max(ub + cb, uh + ch);
      if (ha <= 1e-12) s1 = ub - 2 * cb; if (hb <= 1e-12) s2 = ua + 2 * ca;  // dry-front speeds (Toro free-surface book; Riemann invariant)
      const Fa = F(a), Fb = F(b);
      if (s1 >= 0) return Fa; if (s2 <= 0) return Fb;
      return [0, 1].map(k => (s2 * Fa[k] - s1 * Fb[k] + s1 * s2 * (b[k] - a[k])) / (s2 - s1));
    }
    let t = 0; const tEnd = P.tEnd;
    while (t < tEnd - 1e-14) {
      let smax = 1e-14; for (const q of U) smax = Math.max(smax, Math.abs(vel(q)) + Math.sqrt(g * Math.max(q[0], 0)));
      let dt = cfl * dx / smax; if (t + dt > tEnd) dt = tEnd - t;
      const ext2 = [U[0], U[0], ...U, U[N - 1], U[N - 1]];
      const L = [], R = [];
      for (let j = 0; j < N + 2; j++) {
        const c = ext2[j + 1], m = ext2[j], p = ext2[j + 2];
        if (!second) { L.push(c); R.push(c); continue; }
        const d = [0, 1].map(k => minmod(c[k] - m[k], p[k] - c[k]));
        const uL = c.map((v, k) => v - 0.5 * d[k]), uR = c.map((v, k) => v + 0.5 * d[k]);
        const fL = F(uL), fR = F(uR);
        const eL = uL.map((v, k) => v + 0.5 * dt / dx * (fL[k] - fR[k])), eR = uR.map((v, k) => v + 0.5 * dt / dx * (fL[k] - fR[k]));
        if (eL[0] < 0 || eR[0] < 0) { L.push(c); R.push(c); } else { L.push(eL); R.push(eR); }  // positivity fallback
      }
      const Fl = []; for (let i = 0; i <= N; i++) Fl.push(hll(R[i], L[i + 1]));
      U = U.map((q, i) => [0, 1].map(k => q[k] - dt / dx * (Fl[i + 1][k] - Fl[i][k])));
      t += dt;
    }
    let e = 0, n = 0;
    for (let i = 0; i < N; i++) { const ex = stoker((i + 0.5) * dx, tEnd, P).h; e += Math.abs(U[i][0] - ex) * dx; n += ex * dx; }
    return e / n;
  }
  for (const [lab, P] of [['Stoker SWASHES', stoker.defaults], ['Stoker unit', stoker.unitDefaults],
                          ['Ritter SWASHES', Object.assign({}, stoker.defaults, { hr: 0 })], ['Ritter unit', Object.assign({}, stoker.unitDefaults, { hr: 0 })]]) {
    for (const second of [false, true]) {
      const errs = [100, 200, 400].map(N => runSWE(N, second, P, 0.9));
      console.log(`CAL  ${lab.padEnd(15)} ${(second ? 'muscl-hll' : 'hll').padEnd(9)} relL1(h) N=100: ${errs[0].toExponential(3)}  N=200: ${errs[1].toExponential(3)}  N=400: ${errs[2].toExponential(3)}  ` +
        `order(100->200)=${Math.log2(errs[0] / errs[1]).toFixed(2)} order(200->400)=${Math.log2(errs[1] / errs[2]).toFixed(2)}`);
    }
  }
}
