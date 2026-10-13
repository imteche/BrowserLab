/* 2-D decaying Taylor-Green vortex references (scene 'taylor-green').
 * Periodic box [0, 2*pi/k]^2 (one full period in each direction; any integer number of periods
 * gives the same domain means). Incompressible NS with kinematic viscosity nu, density rho:
 *   u = -U0 cos(kx) sin(ky) F(t),  v = U0 sin(kx) cos(ky) F(t),  F(t) = exp(-2 nu k^2 t)
 *   p = p0 - (rho U0^2 / 4) [cos(2kx) + cos(2ky)] F(t)^2
 *   domain-mean KE = <(u^2+v^2)/2> = (U0^2 / 4) exp(-4 nu k^2 t)
 * The solution is exact for the full nonlinear equations (u.grad u is a pure gradient,
 * balanced by p). Verified by substitution here (research/ins.md, finite-difference NS residual ~3e-8, at round-off level for h=1e-4).
 * Default nondimensionalisation: U0 = 1, k = 1, Re = U0/(k nu). */
(function (LAB) {
  'use strict';
  var R = function (r) { LAB.registerReference(r); };

  function prm(p) {
    p = p || {};
    var U0 = p.U0 != null ? p.U0 : 1;
    var k = p.k != null ? p.k : 1;
    var nu = p.nu != null ? p.nu : (p.Re != null ? U0 / (k * p.Re) : 0.01);
    return { U0: U0, k: k, nu: nu, rho: p.rho != null ? p.rho : 1 };
  }

  R({
    id: 'tgv-velocity', scene: 'taylor-green',
    quantity: 'analytic velocity field (u, v) at point x=[x,y], time t',
    source: 'taylor1937', location: '2-D decaying form as quoted in lehmann2022 (arXiv:2112.08926, TGV benchmark section; equation number unverified); verified by direct substitution',
    kind: 'function',
    args: 'fn([x, y], t, {U0=1, k=1, nu | Re}) -> [u, v]',
    fn: function (x, t, params) {
      var q = prm(params);
      var F = Math.exp(-2 * q.nu * q.k * q.k * t);
      var kx = q.k * x[0], ky = q.k * x[1];
      return [-q.U0 * Math.cos(kx) * Math.sin(ky) * F, q.U0 * Math.sin(kx) * Math.cos(ky) * F];
    },
    tolerance: { metric: 'rel-l2', value: 0.02, rationale: 'Probe l2_error is the relative L2 velocity error; 2% is comfortably met by 2nd-order schemes at 64^2 for Re<=100 over one decay time 1/(2 nu k^2). Semi-Lagrangian (stable-fluids) adds O(dt) numerical diffusion and may need a smaller dt to pass.' }
  });

  R({
    id: 'tgv-pressure', scene: 'taylor-green',
    quantity: 'analytic pressure (minus its mean) at point x=[x,y], time t',
    source: 'taylor1937', location: 'derived by substitution (u.grad u = -grad p / rho); standard form, not checked against an original equation number',
    kind: 'function',
    args: 'fn([x, y], t, {U0, k, nu | Re, rho=1}) -> p',
    fn: function (x, t, params) {
      var q = prm(params);
      var F2 = Math.exp(-4 * q.nu * q.k * q.k * t);
      return -0.25 * q.rho * q.U0 * q.U0 * (Math.cos(2 * q.k * x[0]) + Math.cos(2 * q.k * x[1])) * F2;
    },
    tolerance: { metric: 'rel-l2', value: 0.05, rationale: 'Pressure is a derived (projection) quantity; looser than velocity. Compare after removing the mean.' }
  });

  R({
    id: 'tgv-kinetic-energy', scene: 'taylor-green',
    quantity: 'domain-mean kinetic energy <(u^2+v^2)/2> vs time', probe: 'kinetic_energy',
    source: 'taylor1937', location: 'follows from the velocity field: E(t) = (U0^2/4) exp(-4 nu k^2 t)',
    kind: 'function',
    args: 'fn(null, t, {U0, k, nu | Re}) -> E',
    fn: function (x, t, params) {
      var q = prm(params);
      return 0.25 * q.U0 * q.U0 * Math.exp(-4 * q.nu * q.k * q.k * t);
    },
    tolerance: { metric: 'rel', value: 0.01, rationale: 'Checked at t = 1/(2 nu k^2) (velocity e-folding time). Energy is an integral quantity and converges faster than pointwise fields; 1% catches spurious numerical viscosity (e.g. an LBM viscosity off by the 1/2 in nu = c_s^2 (tau - 1/2) dt gives a large miss).' }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
