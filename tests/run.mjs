// Runner dei test — nessun framework. Exit code 0 = tutto verde, 1 = almeno un fallimento.
// Esecuzione:  node tests/run.mjs   (oppure: npm test)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { classify } = require('../classifier.js');
let buildReferto = null;
try { ({ buildReferto } = require('../referto.js')); } catch { /* creato nel Task 7 */ }

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

const { criteriLevel, sogliaEffettiva } = require('../classifier.js');

section('criteriLevel');
eq('nessun criterio → assenti', criteriLevel({}), 'assenti');
eq('solo ipercromasia → parziali', criteriLevel({ ipercromasia: true }), 'parziali');
eq('ipercromasia + membrana → completi', criteriLevel({ ipercromasia: true, membranaIrregolare: true }), 'completi');
eq('ipercromasia + cromatina → completi', criteriLevel({ ipercromasia: true, cromatinaGrossolana: true }), 'completi');
eq('membrana + cromatina senza ipercromasia → parziali', criteriLevel({ membranaIrregolare: true, cromatinaGrossolana: true }), 'parziali');

section('sogliaEffettiva');
eq('alte vie → 10 forzata', sogliaEffettiva({ campione: 'alteVie', sogliaLabBasseVie: 5 }), 10);
eq('basse vie default → 5', sogliaEffettiva({ campione: 'spontanea' }), 5);
eq('basse vie impostata a 10 → 10', sogliaEffettiva({ campione: 'washing', sogliaLabBasseVie: 10 }), 10);

console.log(`\n${fail === 0 ? 'OK' : 'FALLITO'} — ${pass} pass, ${fail} fail`);
if (failures.length) { console.log('\nFallimenti:'); failures.forEach(f => console.log('  ✗ ' + f)); }
process.exit(fail === 0 ? 0 : 1);
