#!/usr/bin/env node
/* Checks the analytic Kepler reference in references/kepler.js:
 *  1. initial state matches q0 = (1-e,0), p0 = (0, sqrt((1+e)/(1-e)))
 *  2. H, L and the Runge–Lenz vector are conserved to 1e-12 along the exact solution
 *  3. the solution returns to the start after one period T = 2 pi (and after 100 periods)
 *  4. q'(t) = p(t) and p'(t) = -q/|q|^3 (finite-difference check of the ODE itself)
 * Usage: node research/test-kepler-exact.js     (exit code 1 on failure)
 */
'use strict';
const path = require('path');
const vm = require('vm');
const fs = require('fs');

const LAB = { sources: {}, references: {} };
LAB.registerSource = (s) => { LAB.sources[s.id] = s; };
LAB.registerReference = (r) => { LAB.references[r.id] = r; };
const ctx = vm.createContext({ LAB, Math, Error });
for (const f of ['sources-ode.js', 'kepler.js']) {
  const file = path.join(__dirname, '..', 'references', f);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}

const exact = LAB.references['kepler-exact-solution'].fn;
const inv = LAB.keplerAnalytic.invariants;
let fails = 0;
function check(name, value, tol) {
  const ok = Math.abs(value) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(58)} ${value.toExponential(2)}  (tol ${tol.toExponential(0)})`);
}

// every cited source id must exist
for (const r of Object.values(LAB.references)) if (!LAB.sources[r.source]) { fails++; console.log('FAIL  unknown source ' + r.source + ' in ' + r.id); }

const T = LAB.references['kepler-period'].value;
for (const e of [0, 0.3, 0.6, 0.9]) {
  console.log(`-- e = ${e}`);
  const s0 = exact(0, { e });
  const q0 = [1 - e, 0], p0 = [0, Math.sqrt((1 + e) / (1 - e))];
  check('|y(0) - y0|', Math.hypot(s0.q[0] - q0[0], s0.q[1] - q0[1], s0.p[0] - p0[0], s0.p[1] - p0[1]), 1e-14);
  const I0 = inv(q0, p0);
  check('H0 + 1/2', I0.H + 0.5, 1e-14);
  check('L0 - sqrt(1-e^2)', I0.L - Math.sqrt(1 - e * e), 1e-14);
  let dH = 0, dL = 0, dA = 0;
  const N = 20000, tEnd = 10 * T;
  for (let i = 0; i <= N; i++) {
    const s = exact(tEnd * i / N, { e });
    const I = inv(s.q, s.p);
    dH = Math.max(dH, Math.abs(I.H - I0.H));
    dL = Math.max(dL, Math.abs(I.L - I0.L));
    dA = Math.max(dA, Math.hypot(I.A[0] - e, I.A[1]));
  }
  check('max |H(t) - H0| on [0,10T]', dH, 1e-12);
  check('max |L(t) - L0| on [0,10T]', dL, 1e-12);
  check('max |A(t) - (e,0)| on [0,10T]', dA, 1e-12);
  for (const k of [1, 100]) {
    const s = exact(k * T, { e });
    check(`|y(${k}T) - y0|`, Math.hypot(s.q[0] - q0[0], s.q[1] - q0[1], s.p[0] - p0[0], s.p[1] - p0[1]), 1e-12 * k);
  }
  // ODE residual by central differences at a few times (truncation ~ d^2 |y'''|, so tolerance 1e-6)
  let res = 0;
  const d = 1e-5;
  for (const t of [0.3, 1.7, 3.1, 4.4, 5.9, 50.2]) {
    const a = exact(t - d, { e }), b = exact(t + d, { e }), c = exact(t, { e });
    const r = Math.hypot(c.q[0], c.q[1]), r3 = r * r * r;
    res = Math.max(res,
      Math.abs((b.q[0] - a.q[0]) / (2 * d) - c.p[0]), Math.abs((b.q[1] - a.q[1]) / (2 * d) - c.p[1]),
      Math.abs((b.p[0] - a.p[0]) / (2 * d) + c.q[0] / r3), Math.abs((b.p[1] - a.p[1]) / (2 * d) + c.q[1] / r3));
  }
  check('ODE residual (central diff, d=1e-5)', res, e === 0.9 ? 1e-5 : 1e-6);
}
console.log(`\nreferences registered: ${Object.keys(LAB.references).length}, sources: ${Object.keys(LAB.sources).length}`);
console.log(fails ? `${fails} FAILURE(S)` : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
