#!/usr/bin/env node
/* Builds orchestration/graph.json (the executed agent DAG) from verification
 * records (authoritative review history) and orchestration/events.json. */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('./harness.js');
const LAB = H.load();
const ev = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'orchestration/events.json'), 'utf8'));
const nodes = [], edges = [];
const add = n => { nodes.push(n); return n.id; };
ev.research.forEach(r => add({ id: 'R-' + r.id, type: 'research', label: r.label, status: 'done' }));
add({ id: 'P-pilot', type: 'review', label: 'pilot: verlet@kepler', status: 'matched', detail: 'Pilot reproduced before scaling' });
const recs = Object.values(LAB.verification);
for (const m of Object.keys(LAB.methods)) {
  const r = ev.research.find(x => x.methods.includes(m));
  const b = add({ id: 'B-' + m, type: 'build', label: 'build: ' + m, status: 'done' });
  if (r) edges.push(['R-' + r.id, b]);
  const mine = recs.filter(x => x.method === m);
  const refs = ev.refinements.filter(x => x.method === m);
  for (const rec of mine) {
    const hist = rec.history && rec.history.length ? rec.history : [{ round: rec.round || 1, status: rec.status }];
    let prev = b;
    hist.forEach((h, i) => {
      const last = i === hist.length - 1;
      const id = 'V-' + rec.id + '-r' + h.round;
      add({ id, type: h.round > 1 ? 're-review' : 'review', label: (h.round > 1 ? 're: ' : '') + rec.experiment + ' · ' + m, status: last ? rec.status : h.status, detail: (h.reason || '').slice(0, 300) });
      if (i === 0) edges.push([prev, id]);
      else { const ref = 'F-' + m + '-r' + (h.round - 1); edges.push([ref, id]); }
      const rf = refs.find(x => x.round === h.round && x.trigger.includes(rec.experiment));
      if (rf) edges.push([id, 'F-' + m + '-r' + rf.round]);
      prev = id;
    });
  }
  refs.forEach(rf => add({ id: 'F-' + m + '-r' + rf.round, type: 'refine', label: 'refine#' + rf.round + ': ' + m + (rf.changed ? '' : ' (no change)'), status: rf.changed ? 'done' : 'flagged', detail: rf.detail }));
}
edges.push(['B-stormer-verlet', 'P-pilot']);
for (const n of nodes.filter(n => n.type === 'review' || n.type === 're-review')) edges.push([n.id, 'UI']);
add({ id: 'UI', type: 'interface', label: 'lab UI + live wall', status: 'done' });
const ids = new Set(nodes.map(n => n.id));
const g = { summary: 'Agent dependency graph as executed, generated from verification records and orchestration/events.json. Research → Build → independent Review → (Refine → fresh Review)* → Interface. Dashed edges are loop-backs into refinement.', waves: ev.waves, nodes, edges: edges.filter(e => ids.has(e[0]) && ids.has(e[1])) };
fs.writeFileSync(path.join(H.ROOT, 'orchestration/graph.json'), JSON.stringify(g, null, 1));
console.log('graph:', nodes.length, 'nodes,', g.edges.length, 'edges');
