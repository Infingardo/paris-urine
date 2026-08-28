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
eq('soglia come stringa "10" → 10', sogliaEffettiva({ campione: 'washing', sogliaLabBasseVie: '10' }), 10);

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

// 16 — oscuramento moderato, quadro normale → NHGUC (moderato non è inadeguatezza)
eq('#16 NHGUC con oscuramento moderato', classify(inp({ oscuramento: 'moderato' })).categoria, 'NHGUC');

// cellularità non adeguata, nessuna atipia → NON_DIAGNOSTICO
eq('cellularità non adeguata → ND', classify(inp({ cellularitaAdeguata: false })).categoria, 'NON_DIAGNOSTICO');

// 20 — oscuramento severo + frammenti papillari → NON_DIAGNOSTICO ha precedenza su LGUN
const r20 = classify(inp({ oscuramento: 'severo', reperti: { papillareFibrovascolare: true } }));
eq('#20 ND prevale su LGUN (oscuramento severo)', r20.categoria, 'NON_DIAGNOSTICO');
eq('#20 nessun qualificatore', r20.qualificatore, null);

// 21 — cellularità insufficiente + frammenti papillari → NON_DIAGNOSTICO ha precedenza
eq('#21 ND prevale su LGUN (ipocellulare)',
  classify(inp({ cellularitaAdeguata: false, reperti: { papillareFibrovascolare: true } })).categoria, 'NON_DIAGNOSTICO');

// 22 — SICUREZZA: N/C ≥ 0.7 + criteriAssenti + pariOSopraSoglia NON deve diventare HGUC
eq('#22 criteriAssenti + molte cellule → AUC (non HGUC)',
  classify(inp({ ncRatio: '>=0.7', caratteri: {}, nCellule: 'pariOSopraSoglia' })).categoria, 'AUC');

// 23 — cateterismo + frammenti papillari → promemoria, nessun qualificatore
const r23 = classify(inp({ campione: 'cateterismo', reperti: { papillareFibrovascolare: true } }));
eq('#23 NHGUC', r23.categoria, 'NHGUC');
eq('#23 nessun qualificatore', r23.qualificatore, null);
check('#23 promemoria presente', r23.promemoria.length > 0);

// 24 — alte vie + frammenti papillari → strumentato: promemoria, nessun qualificatore
const r24 = classify(inp({ campione: 'alteVie', reperti: { papillareFibrovascolare: true } }));
eq('#24 NHGUC', r24.categoria, 'NHGUC');
eq('#24 nessun qualificatore (alte vie = strumentato)', r24.qualificatore, null);
check('#24 promemoria presente', r24.promemoria.length > 0);

// 25 — enum malformato → errore esplicito, non classificazione silenziosa
check('#25 ncRatio malformato lancia RangeError', (() => {
  try { classify(inp({ ncRatio: '0.7' })); return false; }
  catch (e) { return e instanceof RangeError; }
})());
check('#25 campione malformato lancia RangeError', (() => {
  try { classify(inp({ campione: 'vescica' })); return false; }
  catch (e) { return e instanceof RangeError; }
})());

// 26 — reorder: oscuramento severo + morfologia da AUC → NON_DIAGNOSTICO (inadeguatezza prevale su AUC)
eq('#26 severo + morfologia AUC → ND',
  classify(inp({ oscuramento: 'severo', ncRatio: '0.5-0.7', caratteri: { ipercromasia: true }, nCellule: 'sottoSoglia' })).categoria,
  'NON_DIAGNOSTICO');

// purezza: classify non muta l'input
const inMut = inp({ ncRatio: '>=0.7', caratteri: { ipercromasia: true, membranaIrregolare: true }, nCellule: 'sottoSoglia' });
const snap = JSON.stringify(inMut);
classify(inMut);
eq('classify non muta l’input', JSON.stringify(inMut), snap);

section('classify — alert confondenti, litiasi, soglia alte vie');

// 8 — SHGUC + effetto terapia → SHGUC invariato + alert confondente
const r8 = classify(inp({
  ncRatio: '>=0.7', caratteri: { ipercromasia: true, membranaIrregolare: true }, nCellule: 'sottoSoglia',
  reperti: { effettoTerapia: true }
}));
eq('#8 categoria invariata', r8.categoria, 'SHGUC');
check('#8 alert confondente', hasAlert(r8, 'confondente'));
eq('#8 azioneSuggerita', r8.alert.find(a => a.tipo === 'confondente').azioneSuggerita, 'AUC');

// 9 — HGUC + polyoma → HGUC invariato + alert confondente
const r9 = classify(inp({
  ncRatio: '>=0.7', caratteri: { ipercromasia: true, membranaIrregolare: true }, nCellule: 'pariOSopraSoglia',
  reperti: { polyoma: true }
}));
eq('#9 categoria invariata', r9.categoria, 'HGUC');
check('#9 alert confondente', hasAlert(r9, 'confondente'));

// 12 — alte vie + criteri completi + N/C >=0.7 + cellule tra 5 e 9 (sottoSoglia rispetto a 10) → SHGUC
const r12 = classify(inp({
  campione: 'alteVie', ncRatio: '>=0.7',
  caratteri: { ipercromasia: true, cromatinaGrossolana: true }, nCellule: 'sottoSoglia'
}));
eq('#12 SHGUC (soglia alte vie)', r12.categoria, 'SHGUC');
eq('#12 sogliaEffettiva 10', r12.sogliaEffettiva, 10);

// 13 — come #12 ma cellule ≥ 10 → HGUC
const r13 = classify(inp({
  campione: 'alteVie', ncRatio: '>=0.7',
  caratteri: { ipercromasia: true, cromatinaGrossolana: true }, nCellule: 'pariOSopraSoglia'
}));
eq('#13 HGUC', r13.categoria, 'HGUC');
eq('#13 sogliaEffettiva 10', r13.sogliaEffettiva, 10);

// 19 — AUC + litiasi → AUC + alert litiasi informativo
const r19 = classify(inp({ ncRatio: '0.5-0.7', caratteri: { ipercromasia: true }, nCellule: 'sottoSoglia', reperti: { litiasi: true } }));
eq('#19 AUC', r19.categoria, 'AUC');
check('#19 alert litiasi', hasAlert(r19, 'litiasi'));

// confondente NON deve comparire su categorie non atipiche
const rNoConf = classify(inp({ reperti: { polyoma: true } }));
check('nessun alert confondente su NHGUC', !hasAlert(rNoConf, 'confondente'));

const TPS_DATA = require('../tps-data.js');

section('tps-data');
['NON_DIAGNOSTICO', 'NHGUC', 'AUC', 'SHGUC', 'HGUC', 'ALTRE_NEOPLASIE'].forEach(k => {
  check('nome esteso per ' + k, typeof TPS_DATA.categoriaEstesa[k] === 'string' && TPS_DATA.categoriaEstesa[k].length > 0);
});
check('etichetta campione spontanea', TPS_DATA.campioneEsteso.spontanea === 'urina spontanea');
check('frase soglia alte vie presente', typeof TPS_DATA.fraseSogliaAlteVie === 'string' && /alte vie/i.test(TPS_DATA.fraseSogliaAlteVie));
check('frase LGUN presente', /basso grado/i.test(TPS_DATA.fraseQualificatoreLGUN));
check('frase cellularità insufficiente presente', /cellularità insufficiente/i.test(TPS_DATA.fraseNonDiagnosticoPerCellularita));
check('frase "valutabile con limitazioni" presente', /valutabile, con limitazioni/i.test(TPS_DATA.fraseValutabileConLimitazioni('sangue')));

section('buildReferto');

const baseInp = inp({ campione: 'spontanea' });

// A — HGUC, oscuramento severo, cellule atipiche
const iA = inp({ campione: 'spontanea', oscuramento: 'severo', oscuramentoCausa: 'flogosi',
  ncRatio: '>=0.7', caratteri: { ipercromasia: true, membranaIrregolare: true }, nCellule: 'pariOSopraSoglia' });
const tA = buildReferto(iA, classify(iA), {});
check('A — frase "ma diagnostico"', /ma diagnostico per la presenza di cellule fortemente atipiche/.test(tA));

// B — SHGUC riclassificato manualmente ad AUC per polyomavirus
const iB = inp({ campione: 'spontanea', ncRatio: '>=0.7',
  caratteri: { ipercromasia: true, membranaIrregolare: true }, nCellule: 'sottoSoglia', reperti: { polyoma: true } });
const tB = buildReferto(iB, classify(iB), { manualCategory: 'AUC', manualReason: 'polyomavirus' });
const righeB = tB.split('\n');
const idxCatB = righeB.findIndex(l => l.trim() === 'Categoria diagnostica:');
eq('B — riga sotto "Categoria diagnostica:" = AUC', righeB[idxCatB + 1].trim(), 'Cellule uroteliali atipiche (AUC)');
check('B — Nota: riclassificazione manuale morfologica SHGUC → AUC',
  /riclassificata manualmente in Cellule uroteliali atipiche \(AUC\)/.test(tB) &&
  /categoria morfologica Sospetto per carcinoma uroteliale di alto grado \(SHGUC\)/.test(tB));

// C — NHGUC + qualificatore LGUN
const iC = inp({ campione: 'spontanea', reperti: { papillareFibrovascolare: true } });
const tC = buildReferto(iC, classify(iC), { applicaLGUN: true });
check('C — riga qualificatore LGUN', /basso grado/i.test(tC) && /Qualificatore/.test(tC));

// D — campione alte vie → frase soglia restrittiva
const iD = inp({ campione: 'alteVie', ncRatio: '>=0.7',
  caratteri: { ipercromasia: true, cromatinaGrossolana: true }, nCellule: 'sottoSoglia' });
const tD = buildReferto(iD, classify(iD), {});
check('D — frase soglia alte vie', /soglia quantitativa TPS più restrittiva/.test(tD));

// E — categoria semplice senza note → blocco "Nota:" assente
const iE = inp({ campione: 'spontanea' });
const tE = buildReferto(iE, classify(iE), {});
check('E — nessun blocco Nota', !/\nNota:/.test(tE));

// F — SHGUC da alte vie: testo contiene sia "SHGUC" sia la frase soglia
check('F — SHGUC presente', /SHGUC/.test(tD));
check('F — frase soglia presente', /soglia quantitativa TPS più restrittiva/.test(tD));

// G — la riga "Categoria diagnostica" mostra la scelta senza "riclassificata"; la frase sta nella Nota
check('G — riga categoria senza "riclassificata"', !/riclassificat/i.test(righeB[idxCatB + 1]));
check('G — frase citopatologo nella Nota', /Su valutazione del citopatologo/.test(tB));

// H — oscuramento moderato + categoria NHGUC → "Valutabile, con limitazioni", mai "Adeguato"
const iH = inp({ campione: 'spontanea', oscuramento: 'moderato', oscuramentoCausa: 'flogosi' });
const tH = buildReferto(iH, classify(iH), {});
check('H — frase "Valutabile, con limitazioni"', /Adeguatezza: Valutabile, con limitazioni \(flogosi\)\./.test(tH));
check('H — non dice "Adeguato per la valutazione"', !/Adeguato per la valutazione/.test(tH));

// I — ipocellulare senza oscuranti → "non diagnostico per cellularità insufficiente"
const iI = inp({ campione: 'spontanea', cellularitaAdeguata: false });
const tI = buildReferto(iI, classify(iI), {});
check('I — frase cellularità insufficiente', /Adeguatezza: Campione non diagnostico per cellularità insufficiente\./.test(tI));
check('I — non attribuisce a elementi oscuranti', !/non valutabile per elementi oscuranti/.test(tI));

// K — quadro citomorfologico: criteri e conteggio in frasi separate, N/C simbolico
const iK = inp({ campione: 'spontanea', ncRatio: '>=0.7',
  caratteri: { ipercromasia: true, membranaIrregolare: true }, nCellule: 'sottoSoglia' });
const tK = buildReferto(iK, classify(iK), {});
check('K — frase criteri', /Popolazione uroteliale atipica con rapporto N\/C ≥ 0,7; si osservano ipercromasia e membrana nucleare irregolare\./.test(tK));
check('K — frase conteggio separata', /Il numero di cellule atipiche è inferiore alla soglia quantitativa applicata \(5 cellule\)\./.test(tK));

// J — oscuramento severo + AUC-morfologia → ND, adeguatezza dice "non valutabile per <causa>"
const iJ = inp({ campione: 'spontanea', oscuramento: 'severo', oscuramentoCausa: 'sangue',
  ncRatio: '0.5-0.7', caratteri: { ipercromasia: true }, nCellule: 'sottoSoglia' });
const tJ = buildReferto(iJ, classify(iJ), {});
check('J — categoria ND nel testo', /Non diagnostico \/ insoddisfacente/.test(tJ));
check('J — adeguatezza "non valutabile per sangue"', /Adeguatezza: Campione non valutabile per sangue\./.test(tJ));

console.log(`\n${fail === 0 ? 'OK' : 'FALLITO'} — ${pass} pass, ${fail} fail`);
if (failures.length) { console.log('\nFallimenti:'); failures.forEach(f => console.log('  ✗ ' + f)); }
process.exit(fail === 0 ? 0 : 1);
