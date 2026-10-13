/* Lid-driven cavity references (scene 'cavity').
 * Unit square, lid y=1 moving in +x with U=1, Re = U L / nu. Velocities in units of U_lid.
 * Ghia et al. (1982) used a 129x129 uniform grid (h = 1/128); the tabulated coordinates are
 * grid nodes j/128 printed to 4 decimals (e.g. 0.9766 = 125/128, 0.2813 = 36/128).
 * Provenance: see sources-ins.js (ghia1982 and copy-* entries) and research/ins.md. */
(function (LAB) {
  'use strict';
  var R = function (r) { LAB.registerReference(r); };

  var tolU100 = { metric: 'max-abs', value: 0.02, unit: 'U_lid',
    rationale: 'Ghia values are 2nd-order FD on a 129^2 grid; independent high-accuracy solutions agree with them to well under 0.01 U at Re=100 (e.g. cfdgasman MAC solver psi_min within 0.1%). 0.02 leaves room for interpolation of the sim profile onto the 17 table points and for O(h^2) error of a ~128^2 run.' };
  var tolU1000 = { metric: 'max-abs', value: 0.03, unit: 'U_lid',
    rationale: 'At Re=1000 Ghia (129^2) itself differs from finer references (Erturk 601^2, Botella spectral) by ~0.001-0.01 U (e.g. u(0.5): Ghia -0.06080 vs Erturk -0.0620; psi_min 0.8% apart). Thin lid/wall boundary layers make a 128^2 run under-resolve the near-wall extrema; 0.03 U is a realistic pass band for 128-256 cells.' };

  // ---------------------------------------------------------------- Re = 100
  R({
    id: 'cavity-re100-ghia-u', scene: 'cavity',
    quantity: 'u/U along vertical centerline x=0.5, Re=100', params: { Re: 100 }, probe: 'u_vcl',
    source: 'ghia1982', location: 'Table I, column Re=100 (via open copies copy-ivanpi-ghia, copy-sujaldave-ghia, copy-cfdgasman-ghia; all identical)',
    kind: 'table', columns: ['y', 'u'],
    rows: [[1.0000, 1.00000], [0.9766, 0.84123], [0.9688, 0.78871], [0.9609, 0.73722], [0.9531, 0.68717], [0.8516, 0.23151], [0.7344, 0.00332], [0.6172, -0.13641], [0.5000, -0.20581], [0.4531, -0.21090], [0.2813, -0.15662], [0.1719, -0.10150], [0.1016, -0.06434], [0.0703, -0.04775], [0.0625, -0.04192], [0.0547, -0.03717], [0.0000, 0.00000]],
    tolerance: tolU100
  });
  R({
    id: 'cavity-re100-ghia-v', scene: 'cavity',
    quantity: 'v/U along horizontal centerline y=0.5, Re=100', params: { Re: 100 }, probe: 'v_hcl',
    source: 'ghia1982', location: 'Table II, column Re=100 (via copy-ivanpi-ghia, copy-sujaldave-ghia, copy-cfdgasman-ghia; all identical)',
    kind: 'table', columns: ['x', 'v'],
    rows: [[1.0000, 0.00000], [0.9688, -0.05906], [0.9609, -0.07391], [0.9531, -0.08864], [0.9453, -0.10313], [0.9063, -0.16914], [0.8594, -0.22445], [0.8047, -0.24533], [0.5000, 0.05454], [0.2344, 0.17527], [0.2266, 0.17507], [0.1563, 0.16077], [0.0938, 0.12317], [0.0781, 0.10890], [0.0703, 0.10091], [0.0625, 0.09233], [0.0000, 0.00000]],
    tolerance: tolU100
  });
  R({
    id: 'cavity-re100-ghia-psimin', scene: 'cavity',
    quantity: 'primary-vortex stream function minimum psi_min (psi=0 on walls, u=dpsi/dy), Re=100', params: { Re: 100 }, probe: 'psi_min',
    source: 'ghia1982', location: 'Primary-vortex table (Table III per common citation; number unverified), as quoted in copy-cfdgasman-ghia README; 4-digit value -0.10342 also in k-dense.ai report (search snippet)',
    kind: 'scalar', value: -0.103423, range: null,
    tolerance: { metric: 'rel', value: 0.03, rationale: 'Ghia vs a Richardson-extrapolated MAC solution differ by 0.09% (cfdgasman README); 3% allows for a 64-128 cell run and for psi reconstructed by integrating u (sign convention: clockwise primary vortex has psi<0 with u=+dpsi/dy).' }
  });
  R({
    id: 'cavity-re100-ghia-center', scene: 'cavity',
    quantity: 'primary-vortex centre (x, y), Re=100', params: { Re: 100 }, probe: 'vortex_center',
    source: 'ghia1982', location: 'Vortex-centre table (Table V per copy-sujaldave-ghia ghia_vortex_centers.csv): (0.6171875, 0.734375) = grid node (79,94)/128',
    kind: 'scalar', value: { x: 0.6172, y: 0.7344 }, range: null,
    tolerance: { metric: 'max-abs', value: 0.02, rationale: 'Ghia locate the centre only to their grid node (h=1/128=0.0078); single-copy source; allow ~2.5 h.' }
  });

  // ---------------------------------------------------------------- Re = 1000
  R({
    id: 'cavity-re1000-ghia-u', scene: 'cavity',
    quantity: 'u/U along vertical centerline x=0.5, Re=1000', params: { Re: 1000 }, probe: 'u_vcl',
    source: 'ghia1982', location: 'Table I, column Re=1000 (via copy-ivanpi-ghia, copy-sujaldave-ghia, copy-xuaoxiqi-ghia; all identical)',
    kind: 'table', columns: ['y', 'u'],
    rows: [[1.0000, 1.00000], [0.9766, 0.65928], [0.9688, 0.57492], [0.9609, 0.51117], [0.9531, 0.46604], [0.8516, 0.33304], [0.7344, 0.18719], [0.6172, 0.05702], [0.5000, -0.06080], [0.4531, -0.10648], [0.2813, -0.27805], [0.1719, -0.38289], [0.1016, -0.29730], [0.0703, -0.22220], [0.0625, -0.20196], [0.0547, -0.18109], [0.0000, 0.00000]],
    tolerance: tolU1000
  });
  R({
    id: 'cavity-re1000-ghia-v', scene: 'cavity',
    quantity: 'v/U along horizontal centerline y=0.5, Re=1000', params: { Re: 1000 }, probe: 'v_hcl',
    source: 'ghia1982', location: 'Table II, column Re=1000. Copies identical except x=0.9063: -0.51550 (copy-sujaldave-ghia, copy-xuaoxiqi-ghia) vs -0.51500 (copy-ivanpi-ghia); majority value used',
    kind: 'table', columns: ['x', 'v'],
    rows: [[1.0000, 0.00000], [0.9688, -0.21388], [0.9609, -0.27669], [0.9531, -0.33714], [0.9453, -0.39188], [0.9063, -0.51550], [0.8594, -0.42665], [0.8047, -0.31966], [0.5000, 0.02526], [0.2344, 0.32235], [0.2266, 0.33075], [0.1563, 0.37095], [0.0938, 0.32627], [0.0781, 0.30353], [0.0703, 0.29012], [0.0625, 0.27485], [0.0000, 0.00000]],
    tolerance: tolU1000
  });
  R({
    id: 'cavity-re1000-erturk-u', scene: 'cavity',
    quantity: 'u/U along vertical centerline x=0.5, Re=1000 (601x601 psi-omega FD, finer than Ghia)', params: { Re: 1000 }, probe: 'u_vcl',
    source: 'erturk2005', location: 'u-velocity along vertical centerline table, column Re=1000 (table number unverified), via copy-lethe-cavity ref-2d-erturk-u.txt; first 3 values confirmed in search snippet of arXiv:cs/0411047',
    kind: 'table', columns: ['y', 'u'],
    rows: [[1.000, 1.0000], [0.990, 0.8486], [0.980, 0.7065], [0.970, 0.5917], [0.960, 0.5102], [0.950, 0.4582], [0.940, 0.4276], [0.930, 0.4101], [0.920, 0.3993], [0.910, 0.3913], [0.900, 0.3838], [0.500, -0.0620], [0.200, -0.3756], [0.180, -0.3869], [0.160, -0.3854], [0.140, -0.3690], [0.120, -0.3381], [0.100, -0.2960], [0.080, -0.2472], [0.060, -0.1951], [0.040, -0.1392], [0.020, -0.0757], [0.000, 0.0000]],
    tolerance: { metric: 'max-abs', value: 0.03, unit: 'U_lid', rationale: 'Same band as the Ghia Re=1000 table; points within 0.01 of the lid sample the steepest part of the boundary layer, so a 128^2 run will show its largest gap there.' }
  });
  R({
    id: 'cavity-re1000-ghia-psimin', scene: 'cavity',
    quantity: 'primary-vortex stream function minimum psi_min, Re=1000', params: { Re: 1000 }, probe: 'psi_min',
    source: 'ghia1982', location: 'Primary-vortex table (Table III per common citation; unverified). -0.117929 per widely quoted value; 4-digit 0.1179 confirmed in search snippet of arXiv:1807.04896 Table A-2 and -0.11793 in k-dense.ai report snippet',
    kind: 'scalar', value: -0.117929, range: [-0.1189366, -0.117929],
    rangeNote: 'range spans Ghia (129^2 FD) to Botella & Peyret spectral; Botella value confirmed only to 4 digits (0.1189) from snippet, 7-digit -0.1189366 unverified. Erturk (601^2) gives -0.118781 (snippet).',
    tolerance: { metric: 'rel', value: 0.03, rationale: 'Published high-accuracy values span 0.1179-0.1189 (0.85%); coarse runs typically under-predict |psi_min| by 1-3% (k-dense snippet reports -0.11547, 2% low).' }
  });
  R({
    id: 'cavity-re1000-erturk-psimin', scene: 'cavity',
    quantity: 'primary-vortex stream function minimum psi_min, Re=1000 (Erturk 601^2)', params: { Re: 1000 }, probe: 'psi_min',
    source: 'erturk2005', location: 'primary-vortex properties table, Re=1000 (search snippet of arXiv:cs/0411047: psi -0.118781, omega -2.065530, (0.5300, 0.5650))',
    kind: 'scalar', value: -0.118781, range: null,
    tolerance: { metric: 'rel', value: 0.03, rationale: 'As for Ghia psi_min; search-snippet value, single copy.' }
  });
  R({
    id: 'cavity-re1000-ghia-center', scene: 'cavity',
    quantity: 'primary-vortex centre (x, y), Re=1000', params: { Re: 1000 }, probe: 'vortex_center',
    source: 'ghia1982', location: 'Vortex-centre table (Table V per copy-sujaldave-ghia: (0.53125, 0.5625)); also (0.5313, 0.5625) in arXiv:1807.04896 Table A-2 snippet. Finer references: Erturk (0.5300, 0.5650), Botella (0.5308, 0.5652)',
    kind: 'scalar', value: { x: 0.5313, y: 0.5625 }, range: { x: [0.5300, 0.5313], y: [0.5625, 0.5652] },
    tolerance: { metric: 'max-abs', value: 0.02, rationale: 'Grid-node resolution of Ghia (h=0.0078); finer solutions move the centre by <0.003.' }
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
