# BrowserLab contracts

Every agent (researcher, builder, reviewer, interface) codes against these
interfaces. Do not change them without updating this file.

## 0. Ground rules

* Plain browser JavaScript, no build step, no ES modules (the lab must open from
  `file://`). Every file is an IIFE that registers into the global `LAB`
  namespace:

  ```js
  (function (LAB) {
    'use strict';
    LAB.registerMethod({ ... });
  })(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
  ```

* The same files run headless in Node through `tools/harness.js` (a `vm`
  context). Do not touch `document`, `window` or `requestAnimationFrame` inside
  methods or references.
* Use `Float64Array` for state that is checked for conservation, and
  `Float32Array` only for display buffers.
* Cite every equation and number by source id (see §1). If a page or equation
  number was not verified against the original text, set `verified: false` and
  explain how it was obtained in `access`.

## 1. Sources: `LAB.registerSource(src)`

Files: `references/sources-<group>.js` (one file per researcher group; ids must be globally unique).

```js
{
  id: 'ghia1982',                      // short, unique
  title: '...', authors: '...', year: 1982,
  venue: 'J. Comput. Phys. 48, 387-411',
  url: 'https://...',                  // open-access URL (arXiv, OA journal, institutional, GitHub)
  doi: '10.xxxx/...' | null,
  license: 'arXiv non-exclusive' | 'CC-BY 4.0' | 'MIT' | ...,
  openAccess: true,                    // false => may only be cited through an open secondary copy
  access: 'search-snippet' | 'full-text' | 'secondary-copy',
  accessNote: 'Table I values taken from open copy at <url>, cross-checked against <url2>',
  verified: true | false               // true only if the agent read the cited section itself
}
```

## 2. References: `LAB.registerReference(ref)`

File: `references/<scene>.js`. Written by researcher agents, never by the
builder of a method that is checked against it.

```js
{
  id: 'cavity-re100-ghia-u',
  scene: 'cavity',
  quantity: 'u along vertical centerline x=0.5, Re=100',
  source: 'ghia1982', location: 'Table I, column Re=100',
  kind: 'table' | 'function' | 'scalar',
  // table:    columns + rows (numbers)
  columns: ['y', 'u'], rows: [[1.0, 1.0], ...],
  // function: fn(args) -> value; pure JS, deterministic
  fn: function (x, t, params) { ... },
  // scalar:   value + uncertainty band published by the source
  value: 0.3, range: [0.295, 0.305],
  tolerance: { metric: 'max-abs', value: 0.02, rationale: '...' },  // suggested pass band
  // optional UI overlay hint (the UI draws reference curves itself):
  overlay: { plot: 'u_vcl', x: 'u', y: 'y', when: { Re: 100 } }
  //  table:    plot key + column names for x/y; `when` must match current params
  //  function: { plot: 'rho', field: 'rho' }            -> UI calls fn(x, t, params)[field] along x
  //            { plot: 'ke', sample: 't' }              -> UI calls fn(t, params) along time
  //  scalar:   { plot: 'cd' }                           -> UI draws `range` as a band
}
```

Plot keys used by the UI: cavity `u_vcl`, `v_hcl`; taylor-green `ke` (KE/KE0 vs t), `l2`;
cylinder `cd`, `cl`; sod panels `rho`, `u`, `p`; swe-dambreak panels `h`, `u`;
kepler `orbit`, `dH`; dam-break `front` (Z vs T), `column` (H/2a vs T).

## 3. Scenes: `LAB.registerScene(scene)`

File: `js/scenes.js` (owned by the orchestrator). A scene is a physical setup
that several methods can share. It defines the **probe contract**: named
measurements every method that supports the scene must return from
`sim.probe(name)`.

Scene ids and probes:

| scene id      | probes (return shape)                                                                                   |
|---------------|---------------------------------------------------------------------------------------------------------|
| `cavity`      | `u_vcl` → `{y:[], u:[]}` u/U_lid on x=0.5, y∈[0,1]; `v_hcl` → `{x:[], v:[]}` on y=0.5; `psi_min` → number (primary vortex stream-function min, if available, else null); `vortex_center` → `{x,y}` or null; `residual` → number (max |Δu| per unit time) |
| `taylor-green`| `kinetic_energy` → number (domain-mean ½|u|², nondimensional); `l2_error` → number (relative L2 velocity error vs analytic); `time` → number |
| `cylinder`    | `forces` → `{cd, cl}` (instantaneous, Schäfer–Turek normalization); `pressure_drop` → number; `time` → number |
| `sod`         | `profile` → `{x:[], rho:[], u:[], p:[], e:[]}` at current time; `totals` → `{mass, momentum, energy}` (domain integrals) |
| `swe-dambreak`| `profile` → `{x:[], h:[], u:[]}`; `totals` → `{mass, momentum}` |
| `kepler`      | `state` → `{q:[x,y], p:[px,py]}`; `invariants` → `{H, L}` (energy, angular momentum) |
| `dam-break` (params must include `a` column width [m] and `g` [m/s²]) | `front` → number (surge-front x, physical units); `totals` → `{mass, ke, pe}`; `column_height` → number (height of water at left wall) |

`time` is always available as `sim.t` (physical/nondimensional time as the
scene defines it).

## 4. Methods: `LAB.registerMethod(method)`

File: `methods/<method-id>.js`. One method per file, one builder per file.

```js
{
  id: 'lbm-d2q9',
  name: 'Lattice Boltzmann D2Q9 BGK',
  family: 'mesoscopic' | 'finite-difference' | 'finite-volume' | 'semi-lagrangian' | 'particle' | 'hybrid' | 'integrator',
  summary: 'one paragraph, plain language',
  sources: ['qian1992', 'zou1997'],                // ids from sources.js
  equations: [
    { label: 'BGK collision', tex: 'f_i(x+c_i\\Delta t, t+\\Delta t) = ...', source: 'qian1992', location: 'Eq. (2)' }
  ],
  assumptions: ['Low Mach number, Ma = U/c_s < 0.1', ...],
  stability: 'tau > 0.5; Ma < 0.3',              // stated criterion with source
  scenes: {
    cavity: {
      params: [ { key: 'Re', label: 'Reynolds number', min: 10, max: 1000, step: 10, value: 100, live: false },
                { key: 'N',  label: 'Grid cells', min: 32, max: 256, step: 16, value: 128, live: false } ],
      notes: 'Velocity BCs via Zou–He on the lid'
    },
    'taylor-green': { params: [...] }
  },
  create: function (sceneId, params) { return sim; }
}
```

`sim` object:

```js
{
  t: 0,                    // scene time
  steps: 0,
  dt: number,              // scene-time step
  step: function () {},    // advance exactly one time step
  setParam: function (key, value) {}, // only for params with live: true
  view: function (field) {},          // render descriptor, see §5; field = optional field key
  fields: ['speed', 'vorticity'],     // selectable view fields (first is default)
  metrics: function () { return [ { key, label, value, unit, fmt } ]; },  // live measurements
  probe: function (name) {},          // see §3
  diverged: function () { return bool; } // NaN/Inf or blow-up detected
}
```

Builders must not compare to references or self-report verification status.

## 5. Render descriptors (consumed by the UI; built by `sim.view()`)

```js
{ kind: 'field', nx, ny, data /*Float32Array nx*ny, row-major, j=0 is bottom*/,
  range: [lo, hi], cmap: 'diverging' | 'sequential' | 'mono', mask /*Uint8Array 1=solid, optional*/,
  extent: [x0, y0, x1, y1] }
{ kind: 'particles', n, x /*Float32Array*/, y, value /*optional*/, range, extent: [x0,y0,x1,y1],
  walls: [[x0,y0,x1,y1], ...] /*optional line segments*/ }
{ kind: 'profiles', xlabel, panels: [ { key: 'rho', ylabel, series: [ { label, x:[], y:[], role: 'sim' } ] } ] }
{ kind: 'orbit', extent, series: [ { label, x:[], y:[], role: 'sim' } ], points: [ {x,y,label} ] }
```

The UI overlays reference curves (role `ref`) itself from the reference
registry. Methods never draw reference data.

## 6. Verification records: `LAB.registerVerification(rec)`

Files: `verification/results/<method>@<experiment>.js`, written only by
reviewer agents (never the builder of that method). Each reviewer also writes
`verification/checks/<method>@<experiment>.check.js` (the reproducible Node
check that produced the numbers) and `verification/reports/<method>@<experiment>.md`.

```js
{
  id: 'lbm-d2q9@cavity-re100',
  method: 'lbm-d2q9', scene: 'cavity', experiment: 'cavity-re100',
  status: 'matched' | 'flagged' | 'incomplete',
  claim: 'D2Q9 BGK reproduces Ghia et al. (1982) u-centerline at Re=100 to within 2% of U_lid',
  conditions: { Re: 100, N: 128, tau: 0.56, steps: 40000, convergence: 'residual < 1e-7' },
  reference: ['cavity-re100-ghia-u', 'cavity-re100-ghia-v'],
  gaps: [ { quantity: 'max |u - u_ref| on vcl', value: 0.011, tolerance: 0.02, unit: 'U_lid', pass: true } ],
  checks: [ { name: 'mass conservation', status: 'pass'|'fail'|'n/a', detail: 'drift 3e-13 over 40k steps' },
            { name: 'stability', ... }, { name: 'quantitative', ... } ],
  missing: ['Ghia table read from secondary copy; original PDF page not verified'],
  reviewer: 'reviewer-r1', round: 1, date: '2026-10-13',
  history: [ { round: 1, status: 'flagged', reason: '...' } ]
}
```

Status rules:
* **matched**: every quantitative gap within its tolerance, conservation and
  stability checks pass, reference source is open.
* **flagged**: any check fails or any gap exceeds tolerance. Keep the numbers.
* **incomplete**: no usable quantitative reference, protocol could not be run
  to completion, or source access insufficient to fix the reference values.

## 7. Headless harness

```
node tools/harness.js run <method> <scene> [--param k=v ...] [--steps N] [--until T] [--probe name]
```

and from a check script:

```js
const H = require('../../tools/harness.js');
const LAB = H.load({ methods: ['lbm-d2q9'] });     // loads core, scenes, sources, references, method
const sim = LAB.methods['lbm-d2q9'].create('cavity', H.params('lbm-d2q9', 'cavity', { Re: 100 }));
```
