// Runner dei test — nessun framework. Exit code 0 = tutto verde, 1 = almeno un fallimento.
// Esecuzione:  node tests/run.mjs   (oppure: npm test)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { classify } = require('../classifier.js');
const { buildReferto } = require('../referto.js');

let pass = 0, fail = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); }
}
function eq(name, actual, expected) {
  check(name, actual === expected, `atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`);
}
function section(t) { console.log(`\n• ${t}`); }

// ─────────────────────────────────────────────────────────────
// I casi vengono aggiunti nei task successivi.
// ─────────────────────────────────────────────────────────────

console.log(`\n${fail === 0 ? 'OK' : 'FALLITO'} — ${pass} pass, ${fail} fail`);
if (failures.length) { console.log('\nFallimenti:'); failures.forEach(f => console.log('  ✗ ' + f)); }
process.exit(fail === 0 ? 0 : 1);
