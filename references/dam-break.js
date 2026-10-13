// References for scene `dam-break`: 2D collapse of a water column of width a and
// height 2a (n^2 = H/a = 2) on a dry horizontal floor, released at t = 0.
//
// TIME / LENGTH CONVENTIONS (all tables below use the Martin & Moyce one):
//   Z = x_front / a                (x_front measured from the wall behind the column)
//   T = t * sqrt(2 g / a)          (Martin & Moyce 1952; also PySPH, Lethe)
// Conversions:
//   Koshizuka & Oka style  T_K = t * sqrt(g / a)          = T / sqrt(2)
//   column-height style    T_H = t * sqrt(g / H), H = 2a  = T / 2
//   physical               t   = T / sqrt(2 g / a);  x_front = Z * a
// The `front` probe of the scene is in physical units, so a checker must apply
// Z = front / a and T = sim.t * sqrt(2 g / a) with the run's a and g.
//
// No open copy of the Martin & Moyce residual column height (H/2a vs T) was
// found; no column_height reference is registered (see research/ptc.md).
(function (LAB) {
  'use strict';

  var SHARED_TOL_NOTE =
    'Experimental scatter: the two open copies of the a=2.25 in data differ by up to 0.08 in Z; ' +
    'the a=1.125 in and a=2.25 in series differ by up to ~0.1 at equal T. Gate removal is not instantaneous, so ' +
    'experiments lag ideal simulations at early time; Lethe adds +0.175 to simulated T before comparing. ' +
    'Suggested check: max |Z_sim - Z_ref| over 0 < T <= 3 after allowing a single best-fit time shift dT in [0, 0.25] ' +
    '(report dT). Without the shift expect ~0.3 extra error near T = 1-2.';

  // Primary: Lethe copy (14 points; Z in steps of 1/9 = 0.25 in / 2.25 in, which
  // matches the a = 2.25 in case tabulated by Martin & Moyce).
  LAB.registerReference({
    id: 'dam-break-mm-front-lethe',
    scene: 'dam-break',
    quantity: 'surge front Z = x_front/a vs T = t*sqrt(2g/a), n^2 = 2 (column height 2a), Martin & Moyce (1952), a = 2.25 in',
    source: 'martin1952',
    location: 'Experimental points as listed in Lethe examples/multiphysics/dam-break/dam-break-2d.py (x_exp, y_exp); open copy (lethe-dambreak) of Martin & Moyce data, original table not verified',
    kind: 'table',
    columns: ['T', 'Z'],
    rows: [
      [0.00, 1.00], [0.41, 1.11], [0.84, 1.23], [1.19, 1.44], [1.43, 1.67],
      [1.63, 1.89], [1.82, 2.11], [1.97, 2.33], [2.20, 2.56], [2.32, 2.78],
      [2.50, 3.00], [2.64, 3.22], [2.82, 3.44], [2.96, 3.67]
    ],
    copies: ['lethe-dambreak', 'pysph-dbexp'],
    tolerance: { metric: 'max-abs', value: 0.25, rationale: SHARED_TOL_NOTE }
  });

  // Second copy, same configuration, longer time range (digitised from Fig. 3).
  LAB.registerReference({
    id: 'dam-break-mm-front-a225',
    scene: 'dam-break',
    quantity: 'surge front Z = x_front/a vs T = t*sqrt(2g/a), n^2 = 2, a = 2.25 in (Martin & Moyce Fig. 3, digitised)',
    source: 'martin1952',
    location: 'PySPH 1.0b2 pysph/examples/db_exp_data.py, mm_data_2 ("n^2=2 and a=2.25 from Figure 3"); open copy (pysph-dbexp)',
    kind: 'table',
    columns: ['T', 'Z'],
    rows: [
      [0.832, 1.217], [1.219, 1.474], [1.997, 2.292], [2.547, 2.995], [3.345, 4.134],
      [4.034, 4.944], [4.418, 5.881], [5.091, 6.980], [5.685, 7.945], [6.306, 8.966],
      [6.822, 9.986], [7.439, 10.963], [8.031, 11.977], [8.633, 13.005], [9.237, 13.970]
    ],
    copies: ['pysph-dbexp', 'lethe-dambreak'],
    tolerance: { metric: 'max-abs', value: 0.25, rationale: SHARED_TOL_NOTE + ' Use only up to the tank length of the run (Z <= L_tank/a).' }
  });

  LAB.registerReference({
    id: 'dam-break-mm-front-a1125',
    scene: 'dam-break',
    quantity: 'surge front Z = x_front/a vs T = t*sqrt(2g/a), n^2 = 2, a = 1.125 in (Martin & Moyce Fig. 3, digitised)',
    source: 'martin1952',
    location: 'PySPH 1.0b2 pysph/examples/db_exp_data.py, mm_data_1 ("n^2=2 and a=1.125 from Figure 3"); open copy (pysph-dbexp)',
    kind: 'table',
    columns: ['T', 'Z'],
    rows: [
      [0.849, 1.245], [1.212, 1.443], [1.602, 1.884], [2.283, 2.689], [2.950, 3.728],
      [3.598, 4.528], [3.905, 4.999], [4.592, 5.841], [4.961, 6.271], [5.316, 6.717]
    ],
    copies: ['pysph-dbexp'],
    tolerance: { metric: 'max-abs', value: 0.3, rationale: 'Smaller column: surface tension/viscous effects larger; single digitised copy. ' + SHARED_TOL_NOTE }
  });

  // Koshizuka & Oka curve as digitised by PySPH; provenance ambiguous (see sources).
  LAB.registerReference({
    id: 'dam-break-ko-front',
    scene: 'dam-break',
    quantity: 'surge front Z = x_front/L vs T = t*sqrt(2g/L), L = column width, height 2L (Koshizuka & Oka 1996 curve, as digitised by PySPH)',
    source: 'koshizuka1996',
    location: 'PySPH 1.0b2 pysph/examples/db_exp_data.py, ko_data (axes per docstring "z/L vs t*np.sqrt(2*g/L)"); open copy (pysph-dbexp)',
    kind: 'table',
    columns: ['T', 'Z'],
    rows: [
      [0.0, 1.000], [0.381, 1.111], [0.769, 1.252], [1.153, 1.505], [1.537, 1.892],
      [1.935, 2.241], [2.323, 2.615], [2.719, 3.003], [3.096, 3.624]
    ],
    copies: ['pysph-dbexp'],
    tolerance: { metric: 'max-abs', value: 0.35, rationale: 'Secondary/diagnostic only. Differs from the Martin & Moyce copies by up to 0.31 in Z at T = 2.7 (leads at T~1.5, lags at T>2.3). ' +
      'Unclear whether it is K&O experiment or their MPS result; do not use as the pass/fail reference.' }
  });

  // Analytic bound: Ritter (1892) dry-bed shallow-water front speed 2*sqrt(g*H0).
  // With H0 = 2a: dx/dt = 2*sqrt(2 g a)  =>  Z(T) = 1 + 2 T  in Martin & Moyce units.
  LAB.registerReference({
    id: 'dam-break-ritter-front-bound',
    scene: 'dam-break',
    quantity: 'upper bound on surge front: Z_max(T) = 1 + 2T (front speed 2*sqrt(g*H0), H0 = 2a), Martin & Moyce units',
    source: 'ritter1892',
    location: 'Dry-bed Ritter solution, front speed 2*sqrt(g*h0); formula as implemented in PySPH examples/shallow_water/rectangular_dambreak.py pos_actual() with h=0',
    kind: 'function',
    // fn(T) -> Z bound.  params optional: { H0_over_a: 2 } for other aspect ratios.
    fn: function (T, t, params) {
      var r = (params && params.H0_over_a) ? params.H0_over_a : 2;
      // Z = 1 + 2*sqrt(g*H0)*t/a = 1 + 2*sqrt(r/2)*T  (T = t*sqrt(2g/a))
      return 1 + 2 * Math.sqrt(r / 2) * T;
    },
    // physical-units helper: x_front_max(t) for column width a, height H0, gravity g
    fnPhysical: function (t, a, H0, g) { return a + 2 * Math.sqrt(g * H0) * t; },
    tolerance: { metric: 'bound', value: 0, rationale: 'Shallow-water theory (hydrostatic, inviscid, no bed friction) - an upper bound/limit, not a target. ' +
      'Measured late-time slope dZ/dT in mm_data_2 (T 5.1-9.2) is ~1.69 (derived here), below 2. A simulated front that persistently exceeds 1 + 2T indicates a bug (e.g. excessive particle penetration or wrong g).' }
  });

})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
