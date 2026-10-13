#!/usr/bin/env node
/* Reviewer check: lbm-d2q9 @ cyl-2d1 (DFG / Schafer-Turek benchmark 2D-1, Re = 20, steady).
 * Reviewer: reviewer-lbm-d2q9-cyl-2d1-r1, round 1, 2026-10-13. Does not modify the method.
 * Usage: node verification/checks/lbm-d2q9@cyl-2d1.check.js          (6 child runs, 4 at a time; ~6 min on 4 idle cores, ~10 min under load)
 *        node verification/checks/lbm-d2q9@cyl-2d1.check.js --quick  (res 20 only, T = 20 s; smoke test)
 * Prints a JSON summary on stdout.
 *
 * Protocol (references/cylinder.js, cylinder-2d1-*):
 *   Re = 20 (Um = 0.3 m/s, Ubar = 0.2 m/s, nu = 1e-3, D = 0.1, channel 2.2 x 0.41), started from the inflow
 *   profile (method default), marched in physical time. cD, cL from the 'forces' probe (momentum exchange,
 *   C = 2F/(rho Ubar^2 D)), dp from the 'pressure_drop' probe (p(0.15,0.2) - p(0.25,0.2), extrapolated).
 *   Sampled every 1 s of physical time.
 *   Steady criterion (reviewer-set): over the last 10 s, |dcD|/cD < 1e-5, |dcL| < 1e-5, |ddp|/dp < 1e-5,
 *   i.e. << 1% of every tolerance. Runs stop at T_end (no early exit) so late-time stability is observed.
 * Runs (each a child process, pool of 4):
 *   A: res 20 cells/D, Ulat 0.1, staircase bounce-back       (method defaults; PRIMARY / published protocol)
 *   B: res 20, Ulat 0.1, ibb 1 (interpolated bounce-back)
 *   C: res 40, Ulat 0.1, ibb 0, T = 25 s only (144k nodes x 15000 steps; a converged res-40 run, ~40 s physical,
 *      does not fit the 10-minute budget; res-20 history shows cD changes by 2e-4 relative between 25 s and 60 s)
 *   D: res 30, Ulat 0.1, ibb 0, T = 35 s (grid trend)
 *   E: res 10, Ulat 0.1, ibb 0, T = 150 s (lowest resolution the method's parameter range allows: late-time stability)
 *   F: res 10, Ulat 0.05, ibb 0, T = 150 s (same, Mach halved, tau 0.55)
 * Checks:
 *   conservation: open channel -> total mass is not an invariant. Steady state requires (i) domain mass
 *     stationary: |M(T) - M(T-10 s)|/M0 < 1e-6 (reviewer bound) and (ii) mass-flux balance
 *     |Q_out - Q_in|/Q_in < 1% with Q = sum_j rho u dx at the first and last column (rho reconstructed from the
 *     pressure view and the domain mean density), and Q_in within 1% of the analytic Ubar H = 0.082 m^2/s
 *     (reviewer bounds; halfway walls / node-height profile sampling). Momentum/energy are not invariants of
 *     this forced, dissipative, open problem.
 *   stability: no NaN / divergence; tau > 0.5; max Mach |u|/c_s < 0.3 (method's stated criterion);
 *     evaluated for the primary run and, separately, for every run inside the method's stated parameter range.
 *   quantitative: rel gap of cD and dp vs reference `value` (tol 3% rel); abs gap of cL (tol 0.003);
 *     in-interval vs the 1996 Schafer-Turek ranges reported separately (information; tolerance not loosened/tightened).
 */
'use strict';
const { fork } = require('child_process');
const H = require('../../tools/harness.js');

function child(res, ibb, Ulat, Tend) {
  const LAB = H.load({ methods: ['lbm-d2q9'], verification: false });
  const sim = LAB.methods['lbm-d2q9'].create('cylinder', H.params('lbm-d2q9', 'cylinder', { Re: 20, res, ibb, Ulat }));
  const met = () => { const o = {}; sim.metrics().forEach(m => { o[m.key] = m.value; }); return o; };
  const m0 = met();
  const nx = m0.nx, ny = m0.ny, dxp = 0.1 / res;
  const vscale = 0.2 / (Ulat * 2 / 3), pscale = vscale * vscale;
  let nFluid = 0;
  { const v = sim.view('speed'); for (let k = 0; k < v.mask.length; k++) if (!v.mask[k]) nFluid++; }
  function fluxes() {
    const ux = sim.view('ux').data, p = sim.view('pressure').data, rhoMean = met().mass / nFluid;
    const Q = i => { let s = 0, sv = 0; for (let j = 0; j < ny; j++) { const k = j * nx + i; const rho = rhoMean + 3 * p[k] / pscale; s += rho * ux[k]; sv += ux[k]; } return [s * dxp, sv * dxp]; };
    const a = Q(0), b = Q(nx - 1);
    return { Qin_mass: a[0], Qout_mass: b[0], Qin_vol: a[1], Qout_vol: b[1] };
  }
  // location of the max speed node and outlet-column ux at the wall-adjacent rows and mid-channel (m/s)
  function diag() {
    const v = sim.view('speed').data, ux = sim.view('ux').data;
    let mi = 0; for (let k = 0; k < v.length; k++) if (v[k] > v[mi]) mi = k;
    const i = mi % nx, j = Math.floor(mi / nx), o = k => +ux[k].toFixed(4);
    return { t: +sim.t.toFixed(3), maxSpeed: +v[mi].toFixed(4), at_i: i, at_j: j, at_x: +((i + 0.5) * dxp).toFixed(4), at_y: +((j + 0.5) * dxp).toFixed(4),
      outlet_ux_bottomRow: o(nx - 1), outlet_ux_mid: o(Math.floor(ny / 2) * nx + nx - 1), outlet_ux_topRow: o((ny - 1) * nx + nx - 1),
      inlet_ux_mid: o(Math.floor(ny / 2) * nx) };
  }
  let onset = null;   // first sample with Mach > 0.26 (steady-state max Mach is ~0.233 at Ulat 0.1)
  const perSec = Math.round(1 / sim.dt);
  const hist = [];
  let nan = false, maxMach = m0.mach, tDiverge = null;
  const wall0 = Date.now();
  while (sim.t < Tend - 1e-9) {
    for (let k = 0; k < perSec; k++) sim.step();
    const f = sim.probe('forces'), dp = sim.probe('pressure_drop');
    if (sim.diverged() || !isFinite(f.cd) || !isFinite(dp)) { nan = true; tDiverge = sim.t; break; }
    const m = met();
    if (m.mach > maxMach) maxMach = m.mach;
    if (!onset && sim.t > 10 && m.mach > 0.26) onset = diag();
    hist.push({ t: +sim.t.toFixed(4), cd: f.cd, cl: f.cl, dp, mass: m.mass, dmass: m.dmass, mach: m.mach, umax: m.umax, div: m.div });
  }
  const wall = (Date.now() - wall0) / 1000;
  const out = { res, ibb, Ulat, Tend, nx, ny, tau: m0.tau, nu_lat: m0.nu, dt: sim.dt, steps: sim.steps, t_end: sim.t, links: m0.links,
    wall_s: wall, MLUPS: sim.steps * nx * ny / wall / 1e6, nan, tDiverge, maxMach, mass0: m0.mass, onset, diag_end: nan ? null : diag() };
  // compact history (every 5 s) for the report
  out.hist5 = hist.filter(h => Math.abs(h.t / 5 - Math.round(h.t / 5)) < 1e-6).map(h => ({ t: Math.round(h.t), cd: +h.cd.toFixed(6), cl: +h.cl.toFixed(6), dp: +h.dp.toFixed(6), dmass: +h.dmass.toExponential(3), mach: +h.mach.toFixed(4) }));
  if (nan || hist.length < 11) { out.final = hist.length ? hist[hist.length - 1] : null; return out; }
  const last = hist[hist.length - 1], back = hist[hist.length - 11];
  out.final = last;
  out.window10 = { dcd_rel: Math.abs(last.cd - back.cd) / last.cd, dcl_abs: Math.abs(last.cl - back.cl), ddp_rel: Math.abs(last.dp - back.dp) / Math.abs(last.dp),
    dmass_rel: Math.abs(last.mass - back.mass) / m0.mass };
  out.steady = out.window10.dcd_rel < 1e-5 && out.window10.dcl_abs < 1e-5 && out.window10.ddp_rel < 1e-5;
  out.flux = fluxes();
  // early plateau (t = 25 s) for runs that later drift
  const h25 = hist.find(h => Math.abs(h.t - 25) < 1e-6);
  if (h25) out.at25 = { cd: h25.cd, cl: h25.cl, dp: h25.dp, dmass: h25.dmass, mach: h25.mach };
  return out;
}

if (process.argv[2] === '--child') {
  const [res, ibb, Ulat, Tend] = process.argv.slice(3).map(Number);
  const r = child(res, ibb, Ulat, Tend);
  process.send(r, () => process.exit(0));
  return;
}

const quick = process.argv.includes('--quick');
const RUNS = quick ? [{ name: 'A', res: 20, ibb: 0, Ulat: 0.1, T: 20 }] : [
  { name: 'C', res: 40, ibb: 0, Ulat: 0.1, T: 25 },
  { name: 'D', res: 30, ibb: 0, Ulat: 0.1, T: 35 },
  { name: 'A', res: 20, ibb: 0, Ulat: 0.1, T: 60 },
  { name: 'B', res: 20, ibb: 1, Ulat: 0.1, T: 60 },
  { name: 'E', res: 10, ibb: 0, Ulat: 0.1, T: 150 },
  { name: 'F', res: 10, ibb: 0, Ulat: 0.05, T: 150 }
];

function runOne(r) {
  return new Promise((resolve, reject) => {
    const c = fork(__filename, ['--child', r.res, r.ibb, r.Ulat, r.T], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    c.on('message', m => resolve(Object.assign({ name: r.name }, m)));
    c.on('error', reject);
  });
}
async function pool(list, k) {
  const out = new Array(list.length); let next = 0;
  async function worker() { while (next < list.length) { const i = next++; out[i] = await runOne(list[i]); } }
  await Promise.all(Array.from({ length: Math.min(k, list.length) }, worker));
  return out;
}

const wall0 = Date.now();
pool(RUNS, 4).then(results => {
  const LAB = H.load({ methods: [], verification: false });
  const R = LAB.references;
  const rcd = R['cylinder-2d1-cd'], rcl = R['cylinder-2d1-cl'], rdp = R['cylinder-2d1-dp'];
  const by = n => results.find(r => r.name === n);
  const QREF = 0.2 * 0.41;
  function gaps(f) {
    if (!f) return null;
    const cdRel = (f.cd - rcd.value) / rcd.value, clAbs = f.cl - rcl.value, dpRel = (f.dp - rdp.value) / rdp.value;
    const inR = (v, r) => v >= r[0] && v <= r[1];
    return {
      cd: { sim: f.cd, ref: rcd.value, rel: cdRel, tol: rcd.tolerance.value, pass: Math.abs(cdRel) <= rcd.tolerance.value, inInterval: inR(f.cd, rcd.range) },
      cl: { sim: f.cl, ref: rcl.value, abs: clAbs, tol: rcl.tolerance.value, pass: Math.abs(clAbs) <= rcl.tolerance.value, inInterval: inR(f.cl, rcl.range) },
      dp: { sim: f.dp, ref: rdp.value, rel: dpRel, tol: rdp.tolerance.value, pass: Math.abs(dpRel) <= rdp.tolerance.value, inInterval: inR(f.dp, rdp.range) }
    };
  }
  const summ = results.map(r => {
    const o = { name: r.name, res: r.res, ibb: r.ibb, Ulat: r.Ulat, Tend: r.Tend, nx: r.nx, ny: r.ny, tau: r.tau, steps: r.steps, t_end: +r.t_end.toFixed(3),
      wall_s: r.wall_s, MLUPS: +r.MLUPS.toFixed(1), links: r.links, nan: r.nan, tDiverge: r.tDiverge, maxMach: r.maxMach, onset: r.onset, diag_end: r.diag_end,
      steady: r.steady, window10: r.window10, gaps_final: r.nan ? null : gaps(r.final), gaps_t25: r.at25 ? gaps(r.at25) : null };
    if (r.flux) {
      o.flux = Object.assign({}, r.flux, { Qref: QREF,
        balance_rel: Math.abs(r.flux.Qout_mass - r.flux.Qin_mass) / r.flux.Qin_mass,
        inflow_vs_analytic_rel: (r.flux.Qin_mass - QREF) / QREF });
    }
    o.final = r.final ? { t: r.final.t, cd: r.final.cd, cl: r.final.cl, dp: r.final.dp, dmass: r.final.dmass, mach: r.final.mach, umax: r.final.umax, div: r.final.div } : null;
    o.hist5 = r.hist5;
    return o;
  });
  const P = summ.find(s => s.name === 'A');
  const passes = {};
  if (P && P.gaps_final) {
    passes.cd = P.gaps_final.cd.pass; passes.cl = P.gaps_final.cl.pass; passes.dp = P.gaps_final.dp.pass;
    passes.steady = !!P.steady;
    passes.conservation_primary = !!P.flux && P.window10.dmass_rel < 1e-6 && P.flux.balance_rel < 0.01 && Math.abs(P.flux.inflow_vs_analytic_rel) < 0.01;
    passes.stability_primary = !P.nan && P.tau > 0.5 && P.maxMach < 0.3;
  }
  // every run inside the method's stated parameter range and stated criterion (tau > 0.5, Mach < 0.3 at start)
  passes.stability_all_allowed_runs = summ.every(s => !s.nan && s.maxMach < 0.3);
  const summary = { method: 'lbm-d2q9', experiment: 'cyl-2d1', Re: 20, quick,
    reference: { cd: [rcd.value, rcd.range], cl: [rcl.value, rcl.range], dp: [rdp.value, rdp.range] },
    runs: summ, passes, wall_s: (Date.now() - wall0) / 1000 };
  console.log(JSON.stringify(summary, null, 1));
}).catch(e => { console.error(e); process.exit(1); });
