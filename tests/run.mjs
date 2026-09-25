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

const { criteriLevel } = require('../classifier.js');

section('criteriLevel');
eq('nessun criterio → assenti', criteriLevel({}), 'assenti');
eq('solo ipercromasia → parziali', criteriLevel({ ipercromasia: true }), 'parziali');
eq('ipercromasia + membrana → completi', criteriLevel({ ipercromasia: true, membranaIrregolare: true }), 'completi');
eq('ipercromasia + cromatina → completi', criteriLevel({ ipercromasia: true, cromatinaGrossolana: true }), 'completi');
eq('membrana + cromatina senza ipercromasia → completi', criteriLevel({ membranaIrregolare: true, cromatinaGrossolana: true }), 'completi');

// scorciatoia per costruire input completi con default sensati
function inp(over = {}) {
  return Object.assign({
    campione: 'spontanea',
    cellularitaAdeguata: true,
    oscuramento: 'assente-lieve',
    oscuramentoCausa: '',
    ncRatio: '<0.5',
    caratteri: {},
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

// 4 — due criteri su tre bastano anche senza ipercromasia
const r4 = classify(inp({ ncRatio: '>=0.7', caratteri: { membranaIrregolare: true, cromatinaGrossolana: true }, nCellule: 'sottoSoglia' }));
eq('#4 categoria', r4.categoria, 'SHGUC');
check('#4 nessun alert criteriParziali', !hasAlert(r4, 'criteriParziali'));

// 5 — AUC (N/C 0.5-0.7 + 1 criterio)
eq('#5 AUC', classify(inp({ ncRatio: '0.5-0.7', caratteri: { ipercromasia: true }, nCellule: 'sottoSoglia' })).categoria, 'AUC');

// 6 — N/C elevato isolato non basta per AUC
eq('#6 NHGUC', classify(inp({ ncRatio: '>=0.7', caratteri: {}, nCellule: 'sottoSoglia' })).categoria, 'NHGUC');

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
eq('output qualificatore default null', rShape.qualificatore, null);

section('classify — LGUN / non diagnostico / NHGUC');

// 10 — LGUN qualificatore, campione non strumentato
const r10 = classify(inp({ campione: 'spontanea', reperti: { papillareFibrovascolare: true } }));
eq('#10 categoria NHGUC', r10.categoria, 'NHGUC');
eq('#10 qualificatore LGUN', r10.qualificatore, 'LGUN');

// 11 — frammenti papillari in campione strumentato: niente qualificatore, promemoria
const r11 = classify(inp({ campione: 'washing', reperti: { papillareFibrovascolare: true } }));
eq('#11 categoria NHGUC', r11.categoria, 'NHGUC');
eq('#11 qualificatore LGUN', r11.qualificatore, 'LGUN');
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
eq('#22 criteriAssenti + molte cellule → NHGUC (non AUC/HGUC)',
  classify(inp({ ncRatio: '>=0.7', caratteri: {}, nCellule: 'pariOSopraSoglia' })).categoria, 'NHGUC');

// 23 — cateterismo + frammenti papillari → promemoria, nessun qualificatore
const r23 = classify(inp({ campione: 'cateterismo', reperti: { papillareFibrovascolare: true } }));
eq('#23 NHGUC', r23.categoria, 'NHGUC');
eq('#23 qualificatore LGUN', r23.qualificatore, 'LGUN');
check('#23 promemoria presente', r23.promemoria.length > 0);

// 24 — alte vie + frammenti papillari → strumentato: promemoria, nessun qualificatore
const r24 = classify(inp({ campione: 'alteVie', reperti: { papillareFibrovascolare: true } }));
eq('#24 NHGUC', r24.categoria, 'NHGUC');
eq('#24 qualificatore LGUN', r24.qualificatore, 'LGUN');
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

// 13 — come #12 ma cellule ≥ 10 → HGUC
const r13 = classify(inp({
  campione: 'alteVie', ncRatio: '>=0.7',
  caratteri: { ipercromasia: true, cromatinaGrossolana: true }, nCellule: 'pariOSopraSoglia'
}));
eq('#13 HGUC', r13.categoria, 'HGUC');

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
const idxCatB = righeB.findIndex(l => /secondo The Paris System \(TPS\) 2022\.$/.test(l));
eq('B — riga categoria = AUC', righeB[idxCatB], 'CELLULE UROTELIALI ATIPICHE (AUC) secondo The Paris System (TPS) 2022.');
check('B — Nota: riclassificazione manuale morfologica SHGUC → AUC',
  /riclassificata manualmente in Cellule uroteliali atipiche \(AUC\)/.test(tB) &&
  /categoria morfologica Sospetto per carcinoma uroteliale di alto grado \(SHGUC\)/.test(tB));

// C — NHGUC + qualificatore LGUN
const iC = inp({ campione: 'spontanea', reperti: { papillareFibrovascolare: true } });
const tC = buildReferto(iC, classify(iC), { applicaLGUN: true });
check('C — nota morfologica LGUN', /basso grado/i.test(tC) && /asse fibrovascolare/.test(tC));

// D — campione alte vie → frase soglia restrittiva
const iD = inp({ campione: 'alteVie', ncRatio: '>=0.7',
  caratteri: { ipercromasia: true, cromatinaGrossolana: true }, nCellule: 'sottoSoglia' });
const tD = buildReferto(iD, classify(iD), {});
check('D — nota interpretativa alte vie', /cutoff numerico assoluto/.test(tD));

// E — categoria semplice senza note → blocco "Nota:" assente
const iE = inp({ campione: 'spontanea' });
const tE = buildReferto(iE, classify(iE), {});
check('E — nessun blocco Nota', !/\nNota:/.test(tE));

// F — SHGUC da alte vie: testo contiene sia "SHGUC" sia la frase soglia
check('F — SHGUC presente', /SHGUC/.test(tD));
check('F — nota alte vie presente', /cutoff numerico assoluto/.test(tD));

// G — la riga categoria mostra la scelta senza "riclassificata"; la frase sta nella Nota
check('G — riga categoria senza "riclassificata"', !/riclassificat/i.test(righeB[idxCatB]));
check('G — frase citopatologo nella Nota', /Su valutazione del citopatologo/.test(tB));

// H — oscuramento moderato + categoria NHGUC → "Valutabile, con limitazioni", mai "Adeguato"
const iH = inp({ campione: 'spontanea', oscuramento: 'moderato', oscuramentoCausa: 'flogosi' });
const tH = buildReferto(iH, classify(iH), {});
check('H — frase "Valutabile, con limitazioni"', /Valutabile, con limitazioni \(flogosi\)\./.test(tH));
check('H — non dice "Adeguato per la valutazione"', !/Adeguato per la valutazione/.test(tH));

// I — ipocellulare senza oscuranti → "non diagnostico per cellularità insufficiente"
const iI = inp({ campione: 'spontanea', cellularitaAdeguata: false });
const tI = buildReferto(iI, classify(iI), {});
check('I — frase cellularità insufficiente', /Campione non diagnostico per cellularità insufficiente\./.test(tI));
check('I — non attribuisce a elementi oscuranti', !/non valutabile per elementi oscuranti/.test(tI));

// I2 — ipocellulare + causa testuale ma oscuramento non severo → resta frase cellularità
const iI2 = inp({ campione: 'spontanea', cellularitaAdeguata: false, oscuramento: 'moderato', oscuramentoCausa: 'flogosi' });
const tI2 = buildReferto(iI2, classify(iI2), {});
check('I2 — la causa testuale non dirotta un ND da ipocellularità',
  /Campione non diagnostico per cellularità insufficiente\./.test(tI2));

// K — quadro citomorfologico: criteri e conteggio in frasi separate, N/C simbolico
const iK = inp({ campione: 'spontanea', ncRatio: '>=0.7',
  caratteri: { ipercromasia: true, membranaIrregolare: true }, nCellule: 'sottoSoglia' });
const tK = buildReferto(iK, classify(iK), {});
check('K — frase criteri', /Popolazione uroteliale atipica con rapporto N\/C ≥ 0,7; si osservano ipercromasia moderata-severa e membrana nucleare irregolare\./.test(tK));
check('K — frase quantità separata', /Le cellule diagnostiche sono poche \(“few” secondo TPS 2\.0\)\./.test(tK));

// M — NHGUC con popolazione a N/C basso: niente "atipica", niente quantificatore
// few/many (terminologia TPS specifica dell'asse SHGUC/HGUC, fuorviante su un
// esito negativo — vedi revisione "avvocato del diavolo" del 2026-09-10).
const iM = inp({ campione: 'spontanea', ncRatio: '<0.5', caratteri: {}, nCellule: 'sottoSoglia' });
const rM = classify(iM);
eq('M — categoria NHGUC', rM.categoria, 'NHGUC');
const tM = buildReferto(iM, rM, {});
check('M — nessuna dicitura "atipica"', !/atipica/.test(tM));
check('M — nessun quantificatore few/many', !/“(few|many)”/.test(tM));
check('M — frase reattiva presente',
  /Popolazione uroteliale esente da atipie nucleari significative \(rapporto N\/C < 0,5\), con aspetti compatibili con modificazioni reattive\./.test(tM));

// N — AUC: "atipica" è corretto (è la categoria), ma few/many non si applica
// (quel quantificatore discrimina solo SHGUC da HGUC, non l'asse AUC).
const iN = inp({ campione: 'spontanea', ncRatio: '0.5-0.7', caratteri: { ipercromasia: true }, nCellule: 'sottoSoglia' });
const rN = classify(iN);
eq('N — categoria AUC', rN.categoria, 'AUC');
const tN = buildReferto(iN, rN, {});
check('N — dicitura "atipica" presente', /Popolazione uroteliale atipica/.test(tN));
check('N — nessun quantificatore few/many su AUC', !/“(few|many)”/.test(tN));

// J — oscuramento severo + AUC-morfologia → ND, adeguatezza dice "non valutabile per <causa>"
const iJ = inp({ campione: 'spontanea', oscuramento: 'severo', oscuramentoCausa: 'sangue',
  ncRatio: '0.5-0.7', caratteri: { ipercromasia: true }, nCellule: 'sottoSoglia' });
const tJ = buildReferto(iJ, classify(iJ), {});
check('J — categoria ND nel testo', /NON DIAGNOSTICO\/INADEGUATO \(ND\) secondo The Paris System \(TPS\) 2022\./.test(tJ));
check('J — adeguatezza "non valutabile per sangue"', /Campione non valutabile per sangue\./.test(tJ));

// L — NHGUC semplice: riga categoria formattata secondo lo stile di reparto (Formato A)
const iL = inp({ campione: 'spontanea' });
const tL = buildReferto(iL, classify(iL), {});
check('L — riga categoria formato di reparto',
  tL.split('\n').includes('NEGATIVO PER CARCINOMA UROTELIALE DI ALTO GRADO (NHGUC) secondo The Paris System (TPS) 2022.'));

section('coerenza versione');

// La versione vive in quattro posti (tps-data.js, package.json, i ?v= di index.html,
// VERSION in sw.js). Se divergono, il service worker puo' servire JS vecchio insieme
// a HTML nuovo: e' esattamente il disallineamento che il versionamento deve impedire.
{
  const fs = require('node:fs');
  const TPS_DATA = require('../tps-data.js');
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const V = TPS_DATA.versione;

  check('tps-data.js espone una versione semver', /^\d+\.\d+\.\d+$/.test(V || ''), String(V));
  eq('package.json allineato', pkg.version, V);

  const attesi = ['tps-data.js', 'classifier.js', 'referto.js', 'app.js'];
  attesi.forEach(f => {
    check(`index.html carica ${f}?v=${V}`, html.includes(`src="${f}?v=${V}"`));
  });
  check('index.html non carica script senza ?v=',
    !attesi.some(f => html.includes(`src="${f}"`)));

  const mSw = sw.match(/const VERSION = '([^']+)'/);
  eq('sw.js VERSION allineata', mSw && mSw[1], V);
  attesi.forEach(f => {
    check(`sw.js precarica ${f} versionato`, sw.includes(`'./${f}?v=' + VERSION`));
  });
  check('index.html mostra la versione', html.includes('id="app-version"'));
}

section('riclassificazione manuale');

// L'alert criteriParziali propone SHGUC: il referto deve saper tracciare l'elevazione,
// non solo il declassamento ad AUC.
{
  const iUp = inp({ ncRatio: '>=0.7', caratteri: { membranaIrregolare: true }, nCellule: 'pariOSopraSoglia' });
  const rUp = classify(iUp);
  eq('morfologica resta AUC', rUp.categoria, 'AUC');
  const aUp = rUp.alert.find(a => a.tipo === 'criteriParziali');
  check('alert criteriParziali presente', !!aUp);
  eq('azioneSuggerita SHGUC', aUp && aUp.azioneSuggerita, 'SHGUC');

  const tUp = buildReferto(iUp, rUp, { manualCategory: 'SHGUC', manualReason: TPS_DATA.motivoAlert.criteriParziali });
  check('referto riporta la categoria elevata',
    tUp.includes('SOSPETTO PER CARCINOMA UROTELIALE DI ALTO GRADO (SHGUC) secondo The Paris System (TPS) 2022.'));
  check('referto traccia la riclassificazione manuale',
    /riclassificata manualmente in Sospetto per carcinoma uroteliale di alto grado \(SHGUC\) per la presenza di atipia ritenuta marcata alla revisione/.test(tUp));

  // il declassamento per confondente deve continuare a funzionare
  const iDn = inp({ ncRatio: '>=0.7', caratteri: { ipercromasia: true, membranaIrregolare: true }, nCellule: 'pariOSopraSoglia', reperti: { polyoma: true } });
  const rDn = classify(iDn);
  const tDn = buildReferto(iDn, rDn, { manualCategory: 'AUC', manualReason: 'polyomavirus/decoy cells' });
  check('declassamento ad AUC ancora tracciato',
    /riclassificata manualmente in Cellule uroteliali atipiche \(AUC\) per la presenza di polyomavirus\/decoy cells/.test(tDn));
  eq('categoria morfologica intatta dopo il declassamento', rDn.categoria, 'HGUC');
}

section('0.3.2 — degenerazione, soglia orientativa, confondente su HGUC');
{
  const { sogliaOrientativa } = require('../classifier.js');
  const base = { ncRatio: '>=0.7', caratteri: { membranaIrregolare: true, cromatinaGrossolana: true } };

  const rMany = classify(inp({ ...base, nCellule: 'pariOSopraSoglia' }));
  eq('criteri completi + sopra soglia → HGUC', rMany.categoria, 'HGUC');
  check('motivazione HGUC elenca i criteri effettivi (niente ipercromasia fittizia)',
    rMany.motivazione.includes('membrana nucleare irregolare + cromatina grossolana') &&
    !rMany.motivazione.some(m => /ipercromasia/.test(m)));

  const iDeg = inp({ ...base, nCellule: 'pariOSopraSoglia', celluleDegenerate: true });
  const rDeg = classify(iDeg);
  eq('criteri completi + sopra soglia + degenerate → SHGUC', rDeg.categoria, 'SHGUC');
  check('motivazione cita la degenerazione', rDeg.motivazione.some(m => /degenerate/.test(m)));
  check('referto cita la degenerazione', /alterazioni degenerative/.test(buildReferto(iDeg, rDeg, {})));

  eq('degenerate + sotto soglia → SHGUC', classify(inp({ ...base, nCellule: 'sottoSoglia', celluleDegenerate: true })).categoria, 'SHGUC');
  eq('degenerate non eleva AUC', classify(inp({ ncRatio: '0.5-0.7', caratteri: { ipercromasia: true }, nCellule: 'sottoSoglia', celluleDegenerate: true })).categoria, 'AUC');

  const rHpoly = classify(inp({ ...base, nCellule: 'pariOSopraSoglia', reperti: { polyoma: true } }));
  eq('HGUC + confondente: categoria invariata', rHpoly.categoria, 'HGUC');
  eq('HGUC + confondente: suggerisce SHGUC', rHpoly.alert.find(a => a.tipo === 'confondente').azioneSuggerita, 'SHGUC');
  const rApoly = classify(inp({ ncRatio: '0.5-0.7', caratteri: { ipercromasia: true }, nCellule: 'sottoSoglia', reperti: { polyoma: true } }));
  eq('AUC + confondente: suggerisce NHGUC', rApoly.alert.find(a => a.tipo === 'confondente').azioneSuggerita, 'NHGUC');

  check('HGUC su washing → promemoria strumentazione',
    classify(inp({ ...base, campione: 'washing', nCellule: 'pariOSopraSoglia' })).promemoria.some(p => /strumentazione/.test(p)));
  check('soglia alte vie ≥10', /≥10/.test(sogliaOrientativa('alteVie')));
  check('soglia basse vie 5–10', /5–10/.test(sogliaOrientativa('spontanea')));
}

section('0.3.3 — ipercromasia graduata');
{
  eq('lieve + membrana → parziali', criteriLevel({ ipercromasia: 'lieve', membranaIrregolare: true }), 'parziali');
  eq('severa + membrana → completi', criteriLevel({ ipercromasia: 'severa', membranaIrregolare: true }), 'completi');
  eq('true retrocompatibile = severa', criteriLevel({ ipercromasia: true, cromatinaGrossolana: true }), 'completi');
  eq('solo lieve → parziali (vale per AUC)', criteriLevel({ ipercromasia: 'lieve' }), 'parziali');
  eq('stringa vuota = assente', criteriLevel({ ipercromasia: '' }), 'assenti');

  const rL = classify(inp({ ncRatio: '>=0.7', caratteri: { ipercromasia: 'lieve', membranaIrregolare: true }, nCellule: 'pariOSopraSoglia' }));
  eq('N/C≥0.7 + lieve + membrana → AUC (non SHGUC/HGUC)', rL.categoria, 'AUC');
  check('…con alert criteriParziali verso SHGUC', rL.alert.some(a => a.tipo === 'criteriParziali' && a.azioneSuggerita === 'SHGUC'));

  eq('N/C≥0.7 + severa + membrana, sotto soglia → SHGUC',
    classify(inp({ ncRatio: '>=0.7', caratteri: { ipercromasia: 'severa', membranaIrregolare: true }, nCellule: 'sottoSoglia' })).categoria, 'SHGUC');
  eq('N/C 0.5–0.7 + solo ipercromasia lieve → AUC',
    classify(inp({ ncRatio: '0.5-0.7', caratteri: { ipercromasia: 'lieve' }, nCellule: 'sottoSoglia' })).categoria, 'AUC');
  eq('lieve + membrana + cromatina → completi (2 criteri HG senza ipercromasia)',
    criteriLevel({ ipercromasia: 'lieve', membranaIrregolare: true, cromatinaGrossolana: true }), 'completi');

  let err = null; try { classify(inp({ caratteri: { ipercromasia: 'forte' } })); } catch (e) { err = e; }
  check('ipercromasia non valida → RangeError', err instanceof RangeError);

  const iR = inp({ ncRatio: '>=0.7', caratteri: { ipercromasia: 'lieve', membranaIrregolare: true }, nCellule: 'sottoSoglia' });
  check('referto riporta l’intensità', /ipercromasia lieve-moderata/.test(buildReferto(iR, classify(iR), {})));
  const iS = inp({ ncRatio: '>=0.7', caratteri: { ipercromasia: 'severa', cromatinaGrossolana: true }, nCellule: 'pariOSopraSoglia' });
  check('motivazione HGUC riporta ipercromasia moderata-severa', classify(iS).motivazione.some(m => /ipercromasia moderata-severa/.test(m)));
}

console.log(`\n${fail === 0 ? 'OK' : 'FALLITO'} — ${pass} pass, ${fail} fail`);
if (failures.length) { console.log('\nFallimenti:'); failures.forEach(f => console.log('  ✗ ' + f)); }
process.exit(fail === 0 ? 0 : 1);
