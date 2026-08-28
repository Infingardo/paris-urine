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

// scorciatoia per costruire input completi con default sensati
function inp(over = {}) {
  return Object.assign({
    campione: 'spontanea',
    cellularitaAdeguata: true,
    oscuramento: 'assente-lieve',
    oscuramentoCausa: '',
    ncRatio: '<0.5',
    caratteri: {},
    sogliaLabBasseVie: 5,
    nCellule: '0',
    reperti: {},
    nonUrotelialeTipo: ''
  }, over);
}
function hasAlert(res, tipo) { return res.alert.some(a => a.tipo === tipo); }

section('classify — asse alto grado');

// 1 — SHGUC
eq('#1 SHGUC', classify(inp({
  ncRatio: '>=0.7', caratteri: { ipercromasia: true, membranaIrregolare: true }, nCellule: 'sottoSoglia'
})).categoria, 'SHGUC');

// 2 — HGUC
eq('#2 HGUC', classify(inp({
  ncRatio: '>=0.7', caratteri: { ipercromasia: true, membranaIrregolare: true }, nCellule: 'pariOSopraSoglia'
})).categoria, 'HGUC');

// 3 — AUC + alert criteriParziali (solo ipercromasia)
const r3 = classify(inp({ ncRatio: '>=0.7', caratteri: { ipercromasia: true }, nCellule: 'pariOSopraSoglia' }));
eq('#3 categoria', r3.categoria, 'AUC');
check('#3 alert criteriParziali', hasAlert(r3, 'criteriParziali'));

// 4 — AUC + alert (membrana + cromatina, no ipercromasia)
const r4 = classify(inp({ ncRatio: '>=0.7', caratteri: { membranaIrregolare: true, cromatinaGrossolana: true }, nCellule: 'sottoSoglia' }));
eq('#4 categoria', r4.categoria, 'AUC');
check('#4 alert criteriParziali', hasAlert(r4, 'criteriParziali'));

// 5 — AUC (N/C 0.5-0.7 + 1 criterio)
eq('#5 AUC', classify(inp({ ncRatio: '0.5-0.7', caratteri: { ipercromasia: true }, nCellule: 'sottoSoglia' })).categoria, 'AUC');

// 6 — AUC default (N/C >=0.7, nessun criterio, popolazione presente)
eq('#6 AUC default', classify(inp({ ncRatio: '>=0.7', caratteri: {}, nCellule: 'sottoSoglia' })).categoria, 'AUC');

// 7 — nCellule 0 → nessuna popolazione atipica → NHGUC
eq('#7 NHGUC (nCellule 0)', classify(inp({ ncRatio: '>=0.7', caratteri: {}, nCellule: '0' })).categoria, 'NHGUC');

// 17 — ALTRE_NEOPLASIE
eq('#17 ALTRE_NEOPLASIE', classify(inp({ reperti: { nonUroteliale: true }, nonUrotelialeTipo: 'adenocarcinoma' })).categoria, 'ALTRE_NEOPLASIE');

// 18 — N/C <0.5, nessun criterio → NHGUC
eq('#18 NHGUC', classify(inp({ ncRatio: '<0.5', caratteri: {}, nCellule: 'sottoSoglia' })).categoria, 'NHGUC');

// forma dell'output
const rShape = classify(inp({ ncRatio: '>=0.7', caratteri: { ipercromasia: true, membranaIrregolare: true }, nCellule: 'sottoSoglia' }));
check('output ha array motivazione', Array.isArray(rShape.motivazione));
check('output ha array alert', Array.isArray(rShape.alert));
check('output ha array promemoria', Array.isArray(rShape.promemoria));
eq('output sogliaEffettiva', rShape.sogliaEffettiva, 5);
eq('output qualificatore default null', rShape.qualificatore, null);

section('classify — LGUN / non diagnostico / NHGUC');

// 10 — LGUN qualificatore, campione non strumentato
const r10 = classify(inp({ campione: 'spontanea', reperti: { papillareFibrovascolare: true } }));
eq('#10 categoria NHGUC', r10.categoria, 'NHGUC');
eq('#10 qualificatore LGUN', r10.qualificatore, 'LGUN');

// 11 — frammenti papillari in campione strumentato: niente qualificatore, promemoria
const r11 = classify(inp({ campione: 'washing', reperti: { papillareFibrovascolare: true } }));
eq('#11 categoria NHGUC', r11.categoria, 'NHGUC');
eq('#11 nessun qualificatore', r11.qualificatore, null);
check('#11 promemoria presente', r11.promemoria.length > 0);

// 14 — oscuramento severo, nessuna atipia → NON_DIAGNOSTICO
eq('#14 NON_DIAGNOSTICO', classify(inp({ oscuramento: 'severo' })).categoria, 'NON_DIAGNOSTICO');

// 15 — oscuramento severo ma quadro HGUC → HGUC (adeguato per definizione)
eq('#15 HGUC nonostante oscuramento', classify(inp({
  oscuramento: 'severo', ncRatio: '>=0.7',
  caratteri: { ipercromasia: true, membranaIrregolare: true }, nCellule: 'pariOSopraSoglia'
})).categoria, 'HGUC');

// 16 — oscuramento moderato, quadro normale → NHGUC (categoria comunque assegnata)
eq('#16 NHGUC con oscuramento moderato', classify(inp({ oscuramento: 'moderato' })).categoria, 'NHGUC');

// cellularità non adeguata, nessuna atipia → NON_DIAGNOSTICO
eq('cellularità non adeguata → ND', classify(inp({ cellularitaAdeguata: false })).categoria, 'NON_DIAGNOSTICO');

console.log(`\n${fail === 0 ? 'OK' : 'FALLITO'} — ${pass} pass, ${fail} fail`);
if (failures.length) { console.log('\nFallimenti:'); failures.forEach(f => console.log('  ✗ ' + f)); }
process.exit(fail === 0 ? 0 : 1);
