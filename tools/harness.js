#!/usr/bin/env node
/* Headless harness: loads the same browser files into Node so methods can be
 * run and checked without a browser. Usage: see docs/CONTRACTS.md §7. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function runFile(file) {
  const code = fs.readFileSync(file, 'utf8');
  vm.runInThisContext(code, { filename: file });
}

function listJs(dir) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.endsWith('.js')).sort().map(f => path.join(d, f));
}

/* opts.methods: array of method ids, or 'all' (default). opts.verification: load results (default true). */
function load(opts) {
  opts = opts || {};
  globalThis.LAB = undefined;
  runFile(path.join(ROOT, 'js/core.js'));
  runFile(path.join(ROOT, 'js/scenes.js'));
  const refs = listJs('references');
  refs.filter(f => path.basename(f).startsWith('sources-')).forEach(runFile);
  refs.filter(f => !path.basename(f).startsWith('sources-')).forEach(runFile);
  runFile(path.join(ROOT, 'js/overlays.js'));
  const methods = opts.methods || 'all';
  listJs('methods').forEach(f => {
    const id = path.basename(f, '.js');
    if (methods === 'all' || methods.indexOf(id) >= 0) runFile(f);
  });
  if (opts.verification !== false) listJs('verification/results').forEach(runFile);
  return globalThis.LAB;
}

function params(methodId, sceneId, overrides) {
  return globalThis.LAB.defaultParams(methodId, sceneId, overrides);
}

/* Advance until sim.t >= until or steps exhausted. Returns wall seconds. */
function advance(sim, opts) {
  const t0 = Date.now();
  const maxSteps = opts.steps || Infinity;
  const until = opts.until === undefined ? Infinity : opts.until;
  let n = 0;
  while (n < maxSteps && sim.t < until - 1e-12) {
    sim.step(); n++;
    if (opts.every && n % opts.every === 0 && opts.onEvery) opts.onEvery(sim, n);
    if (n % 200 === 0 && sim.diverged && sim.diverged()) break;
  }
  return (Date.now() - t0) / 1000;
}

module.exports = { ROOT, load, params, advance };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === 'list') {
    const LAB = load();
    for (const id in LAB.methods) console.log(id.padEnd(20), Object.keys(LAB.methods[id].scenes).join(', '));
    if (LAB.problems.length) console.log('\nproblems:', JSON.stringify(LAB.problems, null, 1));
    process.exit(0);
  }
  if (args[0] !== 'run' || args.length < 3) {
    console.log('usage: node tools/harness.js list | run <method> <scene> [--param k=v]... [--steps N] [--until T] [--probe name]...');
    process.exit(1);
  }
  const [, methodId, sceneId] = args;
  const overrides = {}; const probes = []; const adv = {};
  for (let i = 3; i < args.length; i++) {
    if (args[i] === '--param') { const [k, v] = args[++i].split('='); overrides[k] = isNaN(+v) ? v : +v; }
    else if (args[i] === '--steps') adv.steps = +args[++i];
    else if (args[i] === '--until') adv.until = +args[++i];
    else if (args[i] === '--probe') probes.push(args[++i]);
  }
  const LAB = load({ methods: [methodId] });
  const p = params(methodId, sceneId, overrides);
  const sim = LAB.methods[methodId].create(sceneId, p);
  if (!adv.steps && adv.until === undefined) adv.steps = 100;
  const wall = advance(sim, adv);
  const out = { method: methodId, scene: sceneId, params: p, t: sim.t, steps: sim.steps, wall_s: wall,
    diverged: sim.diverged ? sim.diverged() : null, metrics: sim.metrics() };
  probes.forEach(n => { const v = sim.probe(n); out['probe:' + n] = v && v.constructor === Object ? Object.fromEntries(Object.entries(v).map(([k, a]) => [k, ArrayBuffer.isView(a) ? Array.from(a) : a])) : v; });
  console.log(JSON.stringify(out, null, 1));
}
