# BrowserLab

An in-browser lab for rerunning numerical experiments from open research.
Pick a reference scene, pick a method, change parameters while it runs, and see
the governing equations, the code that is actually executing, live
measurements, and an independent reviewer's verdict side by side. Every
experiment states its claim, its conditions, its measured gap from the
published reference, and what is still missing before it counts as fully
verified. Flagged and incomplete results stay flagged.

Open `index.html` directly from disk (no server, no build step, no network), or
open the single-file bundle `dist/browserlab.html`.

| | |
|---|---|
| Methods | 14 (`methods/`) |
| Reference scenes | 7, with 11 experiments (`js/scenes.js`) |
| Sources | 72 open sources (`SOURCES.md`) |
| Verification records | see `VERIFICATION.md` (generated) |

## What is in the lab

| Scene | Reference | Methods |
|---|---|---|
| Lid-driven cavity, Re = 100 / 1000 | Ghia, Ghia & Shin (1982) centreline tables; Erturk et al. (2005) | Lattice Boltzmann D2Q9, stream-function/vorticity FD, Stam's Stable Fluids |
| Taylor–Green vortex | Analytic decay exp(−4νk²t) | Lattice Boltzmann D2Q9, Stable Fluids, weakly compressible SPH |
| Cylinder in channel (Schäfer–Turek 2D-1, 2D-2) | Published C_D, C_L, St, Δp ranges | Lattice Boltzmann D2Q9 |
| Sod shock tube | Exact Riemann solution (Toro algorithm) | Lax–Friedrichs, Godunov/HLLC, MUSCL–Hancock |
| 1D shallow-water dam break | Stoker (wet) and Ritter (dry) exact solutions, SWASHES configuration | HLL finite volume |
| Kepler problem, e = 0.6 | Exact Kepler solution; Hairer–Lubich–Wanner orders and growth laws | explicit Euler, symplectic Euler, Störmer–Verlet, RK4 |
| 2D dam break | Martin & Moyce (1952) surge-front data; Ritter bound | WCSPH, Position Based Fluids, MLS-MPM |

Pages: **Live** (every scene running at once, preview resolution), **Lab** (one
method on one experiment with all panels, reviewed resolution), **Verification
matrix**, **Build graph**, **Sources**.

## How it was built

The lab was built by a graph of independent agents, orchestrated in waves.

```
Research (4, parallel) ──► Build (1 agent per method) ──► Review (fresh agent per experiment)
                                                             │ flagged/incomplete and fixable
                                                             ▼
                                                  Refine (method file only) ──► fresh Review  (≤ 2 rounds)
                                                             │
                                                             ▼
                                                   Interface refresh after each wave
```

1. **Research.** Four researcher agents (incompressible flow, hyperbolic
   systems, particle methods, Hamiltonian integrators) sourced equations,
   reference tables and exact solutions from open material only, and wrote
   `references/*.js`, `research/*.json` and `research/*.md`. Every source records
   *how* it was read (`full-text`, `secondary-copy`, `search-snippet`) and
   whether the cited location was verified.
2. **Pilot.** Before scaling, one experiment was reproduced end to end:
   Störmer–Verlet on Kepler (observed order 2.000, linear error growth, bounded
   energy over 1000 periods). The orchestrator reran the reviewer's check
   independently.
3. **Build.** One builder agent per method, coding against `docs/CONTRACTS.md`
   (shared scene probes, render descriptors and metrics). Builders were not
   allowed to compare against references.
4. **Review.** A fresh reviewer per (method, experiment) wrote a reproducible
   Node check in `verification/checks/`, ran it, and wrote the record in
   `verification/results/` and the report in `verification/reports/`.
   Reviewers never edit method code and never loosen a tolerance.
5. **Refine.** Results marked fixable (concrete evidence of an implementation
   defect) went to a refinement agent that may only fix the method file, never
   tune constants toward the reference. Any code change triggers fresh reviewers
   for every experiment of that method. A refinement agent that finds no defect
   changes nothing and the flag stands (this happened for WCSPH on the dam
   break, where the only "fix" would have been raising the sound-speed factor).

Orchestrator audits during the build: the pilot check was rerun; the Stoker
plateau depth was re-derived from first principles (agrees to 1e-15); a
factor-2 error in the Sod total-energy reference (2.75 → 1.375), caught
independently by two reviewers, was confirmed by hand and corrected with an
erratum note in `references/sod.js`.

## Source access, stated plainly

The build container could reach GitHub, PyPI and npm, but not arXiv, publisher
sites or most institutional hosts. Primary papers were therefore read through
open secondary copies (permissively licensed repositories and packages that
reproduce the tables or formulas) or, at worst, search snippets. Those sources
carry `verified: false`, and every verification record lists this in
`missing`. Tables were cross-checked across independent copies where possible
(the Ghia tables across 4–6 copies). Re-reading the primary PDFs is the main
open item for full verification.

## Running checks

```sh
node tools/harness.js list                                   # registered methods and scenes
node tools/harness.js run lbm-d2q9 cavity --steps 2000 --probe u_vcl
node verification/checks/stormer-verlet@kepler-e06.check.js  # any reviewer check
node tools/build.js       # regenerate index.html and dist/ bundles
node tools/catalogue.js   # regenerate SOURCES.md and VERIFICATION.md
```

Checks are plain Node (≥ 18), no dependencies. The same method files run in
the browser and in Node.

## Extending it

* **New method:** add `methods/<id>.js` implementing the contract in
  `docs/CONTRACTS.md` §4 (probes per scene, `view()`, `metrics()`, metadata with
  sourced equations). Run `node tools/build.js`.
* **New scene:** register it in `js/scenes.js` with its probe contract and
  experiments; add references in `references/<scene>.js`; add overlay hints in
  `js/overlays.js` and plot specs in `js/ui.js` (`PLOTS`, `TILE`).
* **New verification:** a reviewer who did not write the method adds a check,
  a result record and a report under `verification/`. Then `node tools/catalogue.js`.
* Role prompts used for each agent type are in `orchestration/prompts.md`.

## Layout

```
index.html               generated; loads everything below
js/core.js               registries + numerical utilities (interp, spatial hash, error norms)
js/scenes.js             scenes, probe contracts, experiments
js/overlays.js           which reference curves the UI overlays on which plot
js/ui.js                 lab UI, live wall, matrix, graph, sources pages
methods/                 one file per method
references/              sources-*.js (catalogue) and per-scene reference data
research/                researcher extractions and solver tests
verification/            checks/, results/, reports/
orchestration/           role prompts and the executed agent graph
tools/                   harness, build, catalogue generator
vendor/                  KaTeX and IBM Plex (local, for offline use)
```

Licences: KaTeX (MIT) and IBM Plex (OFL) are vendored with their licence files.
Reference data come from the open sources listed in `SOURCES.md` under their
own licences.
