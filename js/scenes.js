/* Reference scenes shared by all methods. Probe contracts: docs/CONTRACTS.md §3. */
(function (LAB) {
  'use strict';

  LAB.registerScene({
    id: 'cavity',
    title: 'Lid-driven cavity',
    domain: 'Unit square, top lid moves at U=1, no-slip elsewhere. Re = U L / ν.',
    nondim: 'Lengths by L, velocity by U_lid, time by L/U_lid.',
    probes: ['u_vcl', 'v_hcl', 'psi_min', 'vortex_center', 'residual'],
    experiments: [
      { id: 'cavity-re100', title: 'Steady state, Re = 100', params: { Re: 100 },
        quantity: 'u on x=0.5 and v on y=0.5 vs Ghia et al. (1982) Tables I–II' },
      { id: 'cavity-re1000', title: 'Steady state, Re = 1000', params: { Re: 1000 },
        quantity: 'u on x=0.5 and v on y=0.5 vs Ghia et al. (1982) / Erturk et al. (2005)' }
    ],
    overlays: {
      u_vcl: { probe: 'u_vcl', x: 'u', y: 'y', label: 'u(0.5, y)' },
      v_hcl: { probe: 'v_hcl', x: 'x', y: 'v', label: 'v(x, 0.5)' }
    }
  });

  LAB.registerScene({
    id: 'taylor-green',
    title: 'Taylor–Green vortex (2D, periodic)',
    domain: 'Periodic box [0, 2π]², u = −cos x sin y, v = sin x cos y at t = 0 (k = 1, U0 = 1).',
    nondim: 'Re = U0 / (k ν). Exact decay KE(t) = KE0 · exp(−4 ν k² t).',
    probes: ['kinetic_energy', 'l2_error', 'time'],
    experiments: [
      { id: 'tg-re100', title: 'Viscous decay, Re = 100, t ∈ [0, 5]', params: { Re: 100 },
        quantity: 'KE(t)/KE0 vs exp(−4νt); relative L2 velocity error' }
    ]
  });

  LAB.registerScene({
    id: 'cylinder',
    title: 'Flow past a cylinder (Schäfer–Turek 2D)',
    domain: 'Channel 2.2 × 0.41, cylinder D = 0.1 at (0.2, 0.2), parabolic inflow, ν = 10⁻³.',
    nondim: 'Re = Ū D / ν; 2D-1: Re = 20 (steady), 2D-2: Re = 100 (periodic).',
    probes: ['forces', 'pressure_drop', 'time'],
    experiments: [
      { id: 'cyl-2d1', title: 'Benchmark 2D-1, Re = 20 (steady)', params: { Re: 20 },
        quantity: 'C_D, C_L, Δp vs published ranges' },
      { id: 'cyl-2d2', title: 'Benchmark 2D-2, Re = 100 (periodic)', params: { Re: 100 },
        quantity: 'St, max C_D, max C_L vs published ranges' }
    ]
  });

  LAB.registerScene({
    id: 'sod',
    title: 'Sod shock tube',
    domain: 'x ∈ [0, 1], diaphragm at 0.5, (ρ,u,p)_L = (1,0,1), (ρ,u,p)_R = (0.125,0,0.1), γ = 1.4.',
    nondim: 'Dimensionless gas dynamics; compare at t = 0.2.',
    probes: ['profile', 'totals'],
    experiments: [
      { id: 'sod-t02', title: 'Profiles at t = 0.2', params: {},
        quantity: 'L1 error in ρ, u, p vs exact Riemann solution; convergence under refinement' }
    ],
    overlays: {
      rho: { probe: 'profile', x: 'x', y: 'rho', label: 'ρ' },
      u: { probe: 'profile', x: 'x', y: 'u', label: 'u' },
      p: { probe: 'profile', x: 'x', y: 'p', label: 'p' }
    }
  });

  LAB.registerScene({
    id: 'swe-dambreak',
    title: '1D shallow-water dam break',
    domain: 'Channel with a dam at x0; still water h_L upstream, h_R ≥ 0 downstream, g = 9.81.',
    nondim: 'Dimensional (SI). Ritter (h_R = 0) and Stoker (h_R > 0) analytic solutions.',
    probes: ['profile', 'totals'],
    experiments: [
      { id: 'swe-wet', title: 'Wet bed (Stoker)', params: { hR: 0.5 }, quantity: 'h(x), u(x) vs Stoker solution' },
      { id: 'swe-dry', title: 'Dry bed (Ritter)', params: { hR: 0 }, quantity: 'h(x), u(x) vs Ritter solution' }
    ],
    overlays: {
      h: { probe: 'profile', x: 'x', y: 'h', label: 'h' },
      u: { probe: 'profile', x: 'x', y: 'u', label: 'u' }
    }
  });

  LAB.registerScene({
    id: 'kepler',
    title: 'Kepler problem',
    domain: 'H = ½|p|² − 1/|q|, eccentricity e, q0 = (1−e, 0), p0 = (0, √((1+e)/(1−e))). Period 2π.',
    nondim: 'Gravitational parameter μ = 1, semi-major axis a = 1.',
    probes: ['state', 'invariants'],
    experiments: [
      { id: 'kepler-e06', title: 'e = 0.6, long-time energy behaviour', params: { e: 0.6 },
        quantity: 'Energy error growth and observed order vs theory (Hairer–Lubich–Wanner)' }
    ]
  });

  LAB.registerScene({
    id: 'dam-break',
    title: '2D dam break (water column collapse)',
    domain: 'Column width a, height 2a at the left wall of a tank; gravity g; free surface.',
    nondim: 'Front Z = x/a vs T = t √(2g/a) (Martin & Moyce convention).',
    probes: ['front', 'totals', 'column_height'],
    experiments: [
      { id: 'dam-front', title: 'Surge-front history', params: {},
        quantity: 'Z(T) vs Martin & Moyce (1952) experiment, Ritter front-speed bound' }
    ]
  });
})(typeof window !== 'undefined' ? window.LAB : globalThis.LAB);
