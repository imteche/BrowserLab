/* DFG "flow around a cylinder" benchmark, 2-D cases (Schafer & Turek 1996), scene 'cylinder'.
 * Geometry (all in m, rho = 1 kg/m^3, nu = 1e-3 m^2/s):
 *   channel [0, 2.2] x [0, 0.41]; cylinder D = 0.1 centred at (0.2, 0.2) (NOT on the centreline,
 *   which is y = 0.205 -> nonzero mean lift); no-slip on y=0, y=0.41 and the cylinder;
 *   inflow x=0: U(y) = 4 Um y (H - y) / H^2, V = 0, H = 0.41; outflow x=2.2: do-nothing.
 *   2D-1: Um = 0.3 -> Ubar = 2 Um / 3 = 0.2, Re = Ubar D / nu = 20 (steady).
 *   2D-2: Um = 1.5 -> Ubar = 1.0, Re = 100 (periodic vortex shedding).
 * Coefficients: cD = 2 F_D / (rho Ubar^2 D), cL = 2 F_L / (rho Ubar^2 D), St = D f / Ubar,
 *   dp = p(0.15, 0.2) - p(0.25, 0.2). For 2D-2, dp is taken at t0 + 1/(2f), t0 = time of max cL.
 * `range` = the published "estimated interval for the exact result" (lower/upper bound rows of
 *   Schafer & Turek Tables 3 and 4 per the open copies). `value` = later, more precise result
 *   (source in valueSource). Provenance in sources-ins.js / research/ins.md. */
(function (LAB) {
  'use strict';
  var R = function (r) { LAB.registerReference(r); };
  var setup21 = { case: '2D-1', Re: 20, Um: 0.3, Ubar: 0.2, nu: 1e-3, D: 0.1, H: 0.41, L: 2.2, center: [0.2, 0.2] };
  var setup22 = { case: '2D-2', Re: 100, Um: 1.5, Ubar: 1.0, nu: 1e-3, D: 0.1, H: 0.41, L: 2.2, center: [0.2, 0.2] };
  var loc = 'interval rows of Table 3 (2D-1) / Table 4 (2D-2) as transcribed identically in copy-vortexlab-dfg, copy-adelowo-dfg, copy-karman-dfg (original not read)';

  // ---------------------------------------------------------------- 2D-1, Re = 20, steady
  R({ id: 'cylinder-2d1-cd', scene: 'cylinder', quantity: 'drag coefficient cD, steady, 2D-1 (Re=20)', params: setup21, probe: 'forces.cd',
      source: 'schafer1996', location: 'Table 3; ' + loc, kind: 'scalar',
      value: 5.57953523384, valueSource: 'nabh1998', range: [5.57, 5.59],
      tolerance: { metric: 'rel', value: 0.03, rationale: 'Interval half-width is 0.18%; staircase (bounce-back) cylinders at 10-20 cells/D typically miss by 1-3% because the effective diameter is ill-defined. Report in-range separately; 3% is the suggested pass band for a browser-scale grid.' } });
  R({ id: 'cylinder-2d1-cl', scene: 'cylinder', quantity: 'lift coefficient cL, steady, 2D-1 (Re=20)', params: setup21, probe: 'forces.cl',
      source: 'schafer1996', location: 'Table 3; ' + loc, kind: 'scalar',
      value: 0.010618948146, valueSource: 'nabh1998 (john2001 quoted in FEATool as 0.010618937712)', range: [0.0104, 0.0110],
      tolerance: { metric: 'max-abs', value: 0.003, rationale: 'cL is tiny (only from the 0.005 off-centre placement) and very sensitive to surface representation; an absolute band of 0.003 checks sign and magnitude only.' } });
  R({ id: 'cylinder-2d1-dp', scene: 'cylinder', quantity: 'pressure difference p(0.15,0.2) - p(0.25,0.2), 2D-1', params: setup21, probe: 'pressure_drop',
      source: 'schafer1996', location: 'Table 3; ' + loc, kind: 'scalar',
      value: 0.11752016697, valueSource: 'nabh1998', range: [0.1172, 0.1176],
      tolerance: { metric: 'rel', value: 0.03, rationale: 'Point values at the cylinder surface; on a Cartesian grid they require interpolation to the exact points, 3% band.' } });
  R({ id: 'cylinder-2d1-la', scene: 'cylinder', quantity: 'recirculation length La (behind cylinder), 2D-1 (no standard probe)', params: setup21, probe: null,
      source: 'schafer1996', location: 'Table 3; interval as in copy-vortexlab-dfg and copy-karman-dfg', kind: 'scalar',
      value: null, range: [0.0842, 0.0852],
      tolerance: { metric: 'rel', value: 0.05, rationale: 'Informational; not in the scene probe contract.' } });

  // ---------------------------------------------------------------- 2D-2, Re = 100, periodic
  R({ id: 'cylinder-2d2-cdmax', scene: 'cylinder', quantity: 'maximum drag coefficient over a shedding period, 2D-2 (Re=100)', params: setup22, probe: 'forces.cd (max over a period, after transient)',
      source: 'schafer1996', location: 'Table 4; ' + loc, kind: 'scalar',
      value: 3.227393, valueSource: 'featflow-dfg (level 6, dt=1/1600, extracted by copy-vortexlab-dfg; copy-adelowo-dfg gives 3.22739)', range: [3.22, 3.24],
      tolerance: { metric: 'rel', value: 0.03, rationale: 'Coarse LBM runs (vortexlab, 20 cells/D) give 3.32 (+3%); 80 cells/D falls in range. 3% matches ~20-40 cells/D.' } });
  R({ id: 'cylinder-2d2-clmax', scene: 'cylinder', quantity: 'maximum lift coefficient, 2D-2 (Re=100)', params: setup22, probe: 'forces.cl (max over a period)',
      source: 'schafer1996', location: 'Table 4; ' + loc, kind: 'scalar',
      value: 0.986571, valueSource: 'featflow-dfg (vortexlab extraction; fem-cylinder-flow 0.98658; karman-wind-tunnel 0.9859)', range: [0.99, 1.01],
      tolerance: { metric: 'rel', value: 0.05, rationale: 'Lift amplitude is the most resolution-sensitive output; note the refined FeatFlow value (0.9866) lies BELOW the 1996 interval, so do not require in-range.' } });
  R({ id: 'cylinder-2d2-st', scene: 'cylinder', quantity: 'Strouhal number St = D f / Ubar, 2D-2 (Re=100)', params: setup22, probe: 'forces.cl (frequency of lift oscillation)',
      source: 'schafer1996', location: 'Table 4; ' + loc, kind: 'scalar',
      value: 0.30184, valueSource: 'featflow-dfg (vortexlab extraction; karman-wind-tunnel quotes 0.30188)', range: [0.295, 0.305],
      tolerance: { metric: 'rel', value: 0.03, rationale: 'Shedding frequency is robust (vortexlab 20 cells/D: 0.2988, in range). Needs >= 5 periods after the transient; frequency resolution 1/T_window must be << 0.03 f.' } });
  R({ id: 'cylinder-2d2-dp', scene: 'cylinder', quantity: 'pressure difference at t0 + 1/(2f), t0 = time of max cL, 2D-2', params: setup22, probe: 'pressure_drop',
      source: 'schafer1996', location: 'Table 4; ' + loc, kind: 'scalar',
      value: 2.4848, valueSource: 'featflow-dfg (vortexlab extraction; fem-cylinder-flow extraction 2.4829 - method-dependent)', range: [2.46, 2.50],
      tolerance: { metric: 'rel', value: 0.04, rationale: 'Depends on phase-picking within the period plus surface interpolation; copies of the refined value already differ by 0.08%.' } });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
