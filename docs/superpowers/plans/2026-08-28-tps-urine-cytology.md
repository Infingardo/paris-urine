# Citologia urinaria — Sistema di Parigi (TPS 2022) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web offline (PWA) che, da un questionario citomorfologico strutturato, deriva la categoria del Sistema di Parigi 2022 (asse alto grado vs non alto grado) e genera un referto editabile.

**Architecture:** Nessun build, nessuna dipendenza. Due funzioni pure testate — `classify(input)` (logica diagnostica, solo categoria morfologica + alert, nessun declassamento automatico) e `buildReferto(input, result, scelte)` (testo) — più `tps-data.js` (dati/template) e `app.js` (sola UI). Script classici con namespace `TPS.*` così `index.html` si apre anche da `file://`; PWA con `manifest.json` + `sw.js` propri (schema identico all'app TNM del dominio).

**Tech Stack:** HTML5, CSS (custom properties, tema chiaro/scuro), JavaScript ES2015 vanilla, Service Worker, Node.js ≥ 18 solo per i test (`node tests/run.mjs`), Python 3 + Pillow solo per generare le icone una tantum.

**Spec di riferimento:** `docs/superpowers/specs/2026-08-28-tps-urine-cytology-design.md`

---

## File Structure

| File | Responsabilità |
|---|---|
| `classifier.js` | Funzione pura `classify(input)` + helper `criteriLevel`, `sogliaEffettiva`. Nessun DOM. Enum categorie. |
| `tps-data.js` | Oggetto dati `TPS_DATA`: nomi estesi categorie, frammenti di frase per adeguatezza / quadro citomorfologico / note. Nessuna logica. |
| `referto.js` | Funzione pura `buildReferto(input, result, scelte)` → stringa. Usa `TPS_DATA`. Nessun DOM. |
| `app.js` | Sola UI: legge il form, chiama `classify`/`buildReferto`, render risultato, box alert + riclassificazione manuale, "Nuovo caso", export (appunti + `.txt`), impostazioni in `localStorage`, registrazione Service Worker. |
| `index.html` | Struttura + CSS inline (variabili tema, layout a due colonne, toggle chiaro/scuro). Carica gli script in ordine: `tps-data.js`, `classifier.js`, `referto.js`, `app.js`. |
| `manifest.json` | `id`/`scope`/`start_url` = `./`, `display: standalone`, `lang: it`, icone 192/512. |
| `sw.js` | `CACHE = 'paris-v1'`. Precache shell; cache-first asset, network-first HTML. |
| `icon-192.png`, `icon-512.png` | Icone PWA (quadrato arrotondato teal, testo "TPS"). Generate da `tools/make-icons.py`. |
| `tools/make-icons.py` | Script una tantum per generare le icone con Pillow. |
| `tests/run.mjs` | Runner senza framework: 19 casi su `classify` + 7 (A–G) su `buildReferto`. Exit code 0/1. |
| `README.md` | Descrizione, uso, avvertenza, come lanciare i test. |
| `package.json` | `"test": "node tests/run.mjs"`. |

Modifica in un **secondo repo** (`/Users/filippo/Documents/GitHub/infingardo.github.io`): aggiunta di una voce all'array `MEDICINA` in `index.html` (Task 11).

---

## Task 1: Scaffold del progetto

**Files:**
- Create: `/Users/filippo/Documents/GitHub/paris-urine/package.json`
- Create: `/Users/filippo/Documents/GitHub/paris-urine/tests/run.mjs`
- Create: `/Users/filippo/Documents/GitHub/paris-urine/README.md`
- Verifica: `.gitignore` già presente (contiene `node_modules/` e `.DS_Store`)

- [ ] **Step 1: Creare `package.json`**

```json
{
  "name": "paris-urine",
  "version": "0.1.0",
  "private": true,
  "description": "Citologia urinaria — Sistema di Parigi (TPS 2022): categorizzazione e referto",
  "scripts": {
    "test": "node tests/run.mjs"
  }
}
```

- [ ] **Step 2: Creare `tests/run.mjs` come runner minimo (ancora senza casi)**

```js
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
```

- [ ] **Step 3: Creare `README.md`**

```markdown
# Citologia urinaria — Sistema di Parigi (TPS 2022)

App web a pagina singola (HTML/CSS/JavaScript, nessuna dipendenza) per la categorizzazione
citologica secondo il Sistema di Parigi 2ª edizione (2022) e la generazione del referto.

Asse clinico: **alto grado vs non alto grado** (rule-out del carcinoma uroteliale di alto grado).

## Uso

Aprire `index.html` in un browser (doppio clic) oppure installarla come PWA da
`https://infingardo.github.io/paris-urine/`.

## Test

    npm test

Esegue `tests/run.mjs`: casi su `classify()` e `buildReferto()`. Exit code 0 = tutti passano.

## Avvertenza

Strumento di supporto alla decisione. La categoria proposta va confermata con correlazione
clinico-strumentale. L'app non applica mai declassamenti automatici: i fattori confondenti
(polyomavirus/decoy cells, effetto terapia) generano solo un avviso; l'eventuale
riclassificazione è una scelta esplicita e tracciata del citopatologo.
```

- [ ] **Step 4: Verificare che i test girino (a vuoto)**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: fallisce con `Cannot find module '../classifier.js'` — atteso, i moduli non esistono ancora. (Il runner completo arriva quando i moduli esistono; per ora è normale.)

- [ ] **Step 5: Commit**

```bash
cd /Users/filippo/Documents/GitHub/paris-urine
git add package.json tests/run.mjs README.md
git commit -m "chore: scaffold progetto (package.json, runner test, README)"
```

---

## Task 2: `classifier.js` — helper `criteriLevel` e `sogliaEffettiva`

**Files:**
- Create: `/Users/filippo/Documents/GitHub/paris-urine/classifier.js`
- Modify: `/Users/filippo/Documents/GitHub/paris-urine/tests/run.mjs`

- [ ] **Step 1: Aggiungere i test degli helper in `tests/run.mjs`** (subito prima della riga `console.log(\`\n${fail === 0 ...`)

```js
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
```

- [ ] **Step 2: Eseguire i test per vederli fallire**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: FAIL con `Cannot find module '../classifier.js'`

- [ ] **Step 3: Creare `classifier.js` con solo gli helper e lo shim modulo**

```js
;(function (root) {
  'use strict';

  var CATEGORIE = ['NON_DIAGNOSTICO', 'NHGUC', 'AUC', 'SHGUC', 'HGUC', 'ALTRE_NEOPLASIE'];

  // 'assenti' | 'parziali' | 'completi'
  // completi = ipercromasia OBBLIGATORIA + almeno uno tra membrana irregolare / cromatina grossolana
  function criteriLevel(caratteri) {
    caratteri = caratteri || {};
    var iper = !!caratteri.ipercromasia;
    var memb = !!caratteri.membranaIrregolare;
    var crom = !!caratteri.cromatinaGrossolana;
    if (!iper && !memb && !crom) return 'assenti';
    if (iper && (memb || crom)) return 'completi';
    return 'parziali';
  }

  // Soglia quantitativa HGUC effettiva: 10 forzata per le alte vie, altrimenti 5 o 10 da impostazione.
  function sogliaEffettiva(input) {
    input = input || {};
    if (input.campione === 'alteVie') return 10;
    return input.sogliaLabBasseVie === 10 ? 10 : 5;
  }

  var api = { CATEGORIE: CATEGORIE, criteriLevel: criteriLevel, sogliaEffettiva: sogliaEffettiva };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TPS = root.TPS || {}; for (var k in api) root.TPS[k] = api[k]; }
})(typeof self !== 'undefined' ? self : this);
```

- [ ] **Step 4: Eseguire i test**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: FAIL sul `require('../referto.js')` (non esiste ancora) ma gli 8 check di `criteriLevel`/`sogliaEffettiva` passano. Se anche solo questo blocca il runner, commentare temporaneamente la riga `const { buildReferto } = require('../referto.js');` **non** è consentito — invece: spostare quel `require` dentro un `try { } catch { }` che assegna `buildReferto = null`. Applicare questa modifica ora:

```js
let buildReferto = null;
try { ({ buildReferto } = require('../referto.js')); } catch { /* creato nel Task 7 */ }
```

Ri-eseguire: Expected PASS `8 pass, 0 fail`.

- [ ] **Step 5: Commit**

```bash
cd /Users/filippo/Documents/GitHub/paris-urine
git add classifier.js tests/run.mjs
git commit -m "feat(classifier): helper criteriLevel e sogliaEffettiva"
```

---

## Task 3: `classify` — asse alto grado (regole 0–4) + ALTRE_NEOPLASIE

**Files:**
- Modify: `/Users/filippo/Documents/GitHub/paris-urine/classifier.js`
- Modify: `/Users/filippo/Documents/GitHub/paris-urine/tests/run.mjs`

Contesto: `input` ha la forma della spec §4.1. Campi usati qui: `campione`, `ncRatio`
(`'<0.5'|'0.5-0.7'|'>=0.7'`), `caratteri` (oggetto booleani), `nCellule`
(`'0'|'sottoSoglia'|'pariOSopraSoglia'`), `reperti.nonUroteliale`, `nonUrotelialeTipo`.

- [ ] **Step 1: Aggiungere in `tests/run.mjs` un helper e i casi 1–7, 17, 18**

```js
const { classify } = require('../classifier.js');

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
```

- [ ] **Step 2: Eseguire per vedere fallire**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: FAIL — `classify is not a function`

- [ ] **Step 3: Implementare `classify` in `classifier.js`** (aggiungere la funzione e inserirla in `api`; lasciare invariati gli helper)

```js
  function classify(input) {
    input = input || {};
    var caratteri = input.caratteri || {};
    var reperti = input.reperti || {};
    var crit = criteriLevel(caratteri);
    var soglia = sogliaEffettiva(input);
    var nCel = input.nCellule || '0';
    var nc = input.ncRatio || '<0.5';

    var out = {
      categoria: null,
      qualificatore: null,
      sogliaEffettiva: soglia,
      motivazione: [],
      alert: [],
      promemoria: []
    };

    // Regola 1 — cellule non uroteliali
    if (reperti.nonUroteliale) {
      out.categoria = 'ALTRE_NEOPLASIE';
      out.motivazione.push('Cellule non uroteliali atipiche' +
        (input.nonUrotelialeTipo ? ' (' + input.nonUrotelialeTipo + ')' : ''));
      return finalize(out, reperti);
    }

    // Regola 0 — senza popolazione atipica, le regole 2–4 non si applicano
    var popolazioneAtipica = nCel !== '0';

    if (popolazioneAtipica) {
      if (nc === '>=0.7' && crit === 'completi' && nCel === 'pariOSopraSoglia') {
        out.categoria = 'HGUC';
        out.motivazione.push('N/C ≥ 0.7', 'ipercromasia + (membrana irregolare o cromatina grossolana)',
          'cellule atipiche in numero pari o superiore alla soglia (' + soglia + ')');
      } else if (nc === '>=0.7' && crit === 'completi' && nCel === 'sottoSoglia') {
        out.categoria = 'SHGUC';
        out.motivazione.push('N/C ≥ 0.7', 'criteri nucleari completi',
          'cellule atipiche in numero inferiore alla soglia (' + soglia + ') → SHGUC anziché HGUC');
      } else if (nc === '0.5-0.7' && crit !== 'assenti') {
        out.categoria = 'AUC';
        out.motivazione.push('N/C 0.5–0.7 con almeno un criterio nucleare');
      } else if (nc === '>=0.7' && crit === 'parziali') {
        out.categoria = 'AUC';
        out.motivazione.push('N/C ≥ 0.7 ma criteri nucleari incompleti');
        out.alert.push({
          tipo: 'criteriParziali',
          messaggio: 'N/C ≥ 0.7 con criteri nucleari incompleti: considerare SHGUC secondo giudizio se l’atipia è marcata.',
          azioneSuggerita: 'SHGUC'
        });
      } else if (nc === '>=0.7' && crit === 'assenti') {
        out.categoria = 'AUC';
        out.motivazione.push('N/C ≥ 0.7 senza criteri nucleari (default prudenziale)');
      }
    }

    // Le regole 5–7 arrivano nel Task 4. Per ora: se nessuna categoria, NHGUC provvisorio.
    if (!out.categoria) {
      out.categoria = 'NHGUC';
      out.motivazione.push('Assenza di criteri per AUC o categoria superiore');
    }

    return finalize(out, reperti);
  }

  // finalize: aggiunge gli alert che non cambiano mai la categoria (Task 5 li completa).
  function finalize(out, reperti) {
    return out;
  }
```

Aggiungere `classify` all'oggetto `api`:

```js
  var api = { CATEGORIE: CATEGORIE, criteriLevel: criteriLevel, sogliaEffettiva: sogliaEffettiva, classify: classify };
```

- [ ] **Step 4: Eseguire i test**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: PASS su tutti i casi finora (helper + #1–#7, #17, #18 + forma output).

- [ ] **Step 5: Commit**

```bash
cd /Users/filippo/Documents/GitHub/paris-urine
git add classifier.js tests/run.mjs
git commit -m "feat(classifier): asse alto grado (HGUC/SHGUC/AUC), ALTRE_NEOPLASIE, normalizzazione"
```

---

## Task 4: `classify` — LGUN qualificatore, NON_DIAGNOSTICO, NHGUC (regole 5–7)

**Files:**
- Modify: `/Users/filippo/Documents/GitHub/paris-urine/classifier.js`
- Modify: `/Users/filippo/Documents/GitHub/paris-urine/tests/run.mjs`

- [ ] **Step 1: Aggiungere in `tests/run.mjs` i casi 10, 11, 14, 15, 16**

```js
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
```

- [ ] **Step 2: Eseguire per vedere fallire**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: FAIL su `#10 qualificatore LGUN` (atteso `"LGUN"`, ottenuto `null`), `#14`, ecc.

- [ ] **Step 3: Sostituire in `classifier.js` il blocco provvisorio "regole 5–7"** (la parte da `// Le regole 5–7 arrivano nel Task 4.` fino a prima di `return finalize(out, reperti);`) con:

```js
    // Regola 5 — NHGUC con qualificatore LGUN (solo se nessuna categoria ≥ AUC assegnata)
    if (!out.categoria && reperti.papillareFibrovascolare) {
      if (input.campione === 'spontanea' || input.campione === 'alteVie') {
        out.categoria = 'NHGUC';
        out.qualificatore = 'LGUN';
        out.motivazione.push('Frammenti papillari con asse fibrovascolare in campione non strumentato');
      } else {
        out.promemoria.push('Frammenti papillari con asse fibrovascolare: reperto atteso in campione strumentato, non qualificato come LGUN.');
      }
    }

    // Regola 6 — non diagnostico (se non ci sono cellule SHGUC/HGUC: quelle rendono il campione adeguato per definizione)
    if (!out.categoria) {
      var severo = input.oscuramento === 'severo';
      if (severo || input.cellularitaAdeguata === false) {
        out.categoria = 'NON_DIAGNOSTICO';
        out.motivazione.push(severo
          ? 'Valutazione compromessa da elementi oscuranti'
          : 'Cellularità non adeguata per la valutazione');
      }
    }

    // Regola 7 — default
    if (!out.categoria) {
      out.categoria = 'NHGUC';
      out.motivazione.push('Assenza di criteri per AUC o categoria superiore');
    }
```

- [ ] **Step 4: Eseguire i test**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: PASS su tutti i casi finora.

- [ ] **Step 5: Commit**

```bash
cd /Users/filippo/Documents/GitHub/paris-urine
git add classifier.js tests/run.mjs
git commit -m "feat(classifier): regole LGUN qualificatore, non diagnostico, NHGUC"
```

---

## Task 5: `classify` — alert confondenti + litiasi + soglia alte vie, suite completa

**Files:**
- Modify: `/Users/filippo/Documents/GitHub/paris-urine/classifier.js`
- Modify: `/Users/filippo/Documents/GitHub/paris-urine/tests/run.mjs`

- [ ] **Step 1: Aggiungere in `tests/run.mjs` i casi 8, 9, 12, 13, 19**

```js
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
```

- [ ] **Step 2: Eseguire per vedere fallire**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: FAIL su `#8 alert confondente`, `#19 alert litiasi`, ecc.

- [ ] **Step 3: Completare `finalize` in `classifier.js`**

```js
  function finalize(out, reperti) {
    var atipica = out.categoria === 'AUC' || out.categoria === 'SHGUC' || out.categoria === 'HGUC';

    if ((reperti.polyoma || reperti.effettoTerapia) && atipica) {
      out.alert.push({
        tipo: 'confondente',
        messaggio: 'Polyomavirus/decoy cells o effetto terapia segnalati: possibile mimica di HGUC. ' +
                   'Il confondente può coesistere con un carcinoma vero.',
        azioneSuggerita: 'AUC'
      });
    }

    if (reperti.litiasi) {
      out.alert.push({
        tipo: 'litiasi',
        messaggio: 'Litiasi segnalata: possibili atipie reattive/degenerative da correlare.',
        azioneSuggerita: null
      });
    }

    return out;
  }
```

- [ ] **Step 4: Eseguire i test**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: PASS su tutti i 19 casi `classify` + helper. Riga finale `OK — NN pass, 0 fail`.

- [ ] **Step 5: Commit**

```bash
cd /Users/filippo/Documents/GitHub/paris-urine
git add classifier.js tests/run.mjs
git commit -m "feat(classifier): alert confondenti e litiasi, nessun declassamento automatico"
```

---

## Task 6: `tps-data.js` — dati e frammenti di testo

**Files:**
- Create: `/Users/filippo/Documents/GitHub/paris-urine/tps-data.js`
- Modify: `/Users/filippo/Documents/GitHub/paris-urine/tests/run.mjs`

- [ ] **Step 1: Aggiungere in `tests/run.mjs` i controlli sul dataset**

```js
const TPS_DATA = require('../tps-data.js');

section('tps-data');
['NON_DIAGNOSTICO', 'NHGUC', 'AUC', 'SHGUC', 'HGUC', 'ALTRE_NEOPLASIE'].forEach(k => {
  check('nome esteso per ' + k, typeof TPS_DATA.categoriaEstesa[k] === 'string' && TPS_DATA.categoriaEstesa[k].length > 0);
});
check('etichetta campione spontanea', TPS_DATA.campioneEsteso.spontanea === 'urina spontanea');
check('frase soglia alte vie presente', typeof TPS_DATA.fraseSogliaAlteVie === 'string' && /alte vie/i.test(TPS_DATA.fraseSogliaAlteVie));
check('frase LGUN presente', /basso grado/i.test(TPS_DATA.fraseQualificatoreLGUN));
```

- [ ] **Step 2: Eseguire per vedere fallire**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: FAIL — `Cannot find module '../tps-data.js'`

- [ ] **Step 3: Creare `tps-data.js`**

```js
;(function (root) {
  'use strict';

  var TPS_DATA = {
    categoriaEstesa: {
      NON_DIAGNOSTICO: 'Non diagnostico / insoddisfacente per la valutazione (ND)',
      NHGUC: 'Negativo per carcinoma uroteliale di alto grado (NHGUC)',
      AUC: 'Cellule uroteliali atipiche (AUC)',
      SHGUC: 'Sospetto per carcinoma uroteliale di alto grado (SHGUC)',
      HGUC: 'Carcinoma uroteliale di alto grado (HGUC)',
      ALTRE_NEOPLASIE: 'Altra neoplasia — primitiva o secondaria'
    },
    categoriaSigla: {
      NON_DIAGNOSTICO: 'ND', NHGUC: 'NHGUC', AUC: 'AUC', SHGUC: 'SHGUC', HGUC: 'HGUC', ALTRE_NEOPLASIE: '—'
    },
    campioneEsteso: {
      spontanea: 'urina spontanea',
      cateterismo: 'urina da cateterismo',
      washing: 'washing vescicale',
      alteVie: 'campione da alte vie escretrici'
    },
    ncLabel: {
      '<0.5': 'inferiore a 0.5',
      '0.5-0.7': 'compreso tra 0.5 e 0.7',
      '>=0.7': 'pari o superiore a 0.7'
    },
    criterioLabel: {
      ipercromasia: 'ipercromasia',
      membranaIrregolare: 'membrana nucleare irregolare',
      cromatinaGrossolana: 'cromatina grossolana'
    },
    // Adeguatezza
    fraseAdeguato: 'Adeguato per la valutazione citologica.',
    fraseNonValutabile: function (causa) {
      return 'Campione non valutabile' + (causa ? ' per ' + causa : ' per elementi oscuranti') + '.';
    },
    fraseLimitatoMaDiagnostico: function (causa) {
      return 'Campione limitato da ' + (causa || 'elementi oscuranti') +
        ', ma diagnostico per la presenza di cellule fortemente atipiche.';
    },
    fraseParzialmenteLimitato: function (causa) {
      return 'Valutazione parzialmente limitata da ' + (causa || 'elementi oscuranti') + '.';
    },
    // Note
    fraseSogliaAlteVie: 'Per il campione da alte vie escretrici è stata applicata la soglia quantitativa TPS più restrittiva.',
    fraseQualificatoreLGUN: 'Qualificatore: quadro compatibile con neoplasia uroteliale papillare di basso grado ' +
      '(frammenti papillari con asse fibrovascolare); la diagnosi definitiva è istologica.',
    fraseRiclassificaManuale: function (manualEstesa, motivo, morfologicaEstesa) {
      return 'Su valutazione del citopatologo, la categoria è stata riclassificata come ' + manualEstesa +
        ' per la presenza di ' + (motivo || 'confondente morfologico') +
        '. Il quadro morfologico di partenza mostrava criteri sospetti per ' + morfologicaEstesa + '.';
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TPS_DATA;
  else root.TPS_DATA = TPS_DATA;
})(typeof self !== 'undefined' ? self : this);
```

- [ ] **Step 4: Eseguire i test**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: PASS sui controlli `tps-data`.

- [ ] **Step 5: Commit**

```bash
cd /Users/filippo/Documents/GitHub/paris-urine
git add tps-data.js tests/run.mjs
git commit -m "feat(data): tps-data.js con nomi categorie e frammenti di referto"
```

---

## Task 7: `referto.js` — `buildReferto(input, result, scelte)`

**Files:**
- Create: `/Users/filippo/Documents/GitHub/paris-urine/referto.js`
- Modify: `/Users/filippo/Documents/GitHub/paris-urine/tests/run.mjs`

Firma: `buildReferto(input, result, scelte)` dove `input` è l'oggetto della spec §4.1,
`result` è l'output di `classify`, `scelte = { manualCategory, manualReason, applicaLGUN }`
(tutti opzionali; `applicaLGUN` default `true`).

- [ ] **Step 1: Aggiungere in `tests/run.mjs` i casi A–G** (dopo il blocco tps-data)

```js
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
check('B — categoria nel testo è AUC', /Cellule uroteliali atipiche \(AUC\)/.test(tB));
check('B — cita SHGUC come quadro di partenza', /sospetti per Sospetto per carcinoma uroteliale di alto grado \(SHGUC\)|criteri sospetti per .*SHGUC/.test(tB));

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

// G — riga "Categoria diagnostica" non contiene "riclassificata"; la frase sta nella Nota
const catLineB = tB.split('\n').find(l => /Cellule uroteliali atipiche \(AUC\)/.test(l)) || '';
check('G — riga categoria senza "riclassificata"', !/riclassificat/i.test(catLineB));
check('G — frase citopatologo nella Nota', /Su valutazione del citopatologo/.test(tB));
```

- [ ] **Step 2: Eseguire per vedere fallire**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: FAIL — `buildReferto is not a function` / il `try/catch` del Task 2 lo lascia `null`.

- [ ] **Step 3: Creare `referto.js`**

```js
;(function (root) {
  'use strict';

  var DATA = (typeof TPS_DATA !== 'undefined')
    ? TPS_DATA
    : (typeof require !== 'undefined' ? require('./tps-data.js') : {});

  function join(list) {
    if (list.length === 0) return '';
    if (list.length === 1) return list[0];
    return list.slice(0, -1).join(', ') + ' e ' + list[list.length - 1];
  }

  function frasiCaratteri(caratteri) {
    caratteri = caratteri || {};
    var l = [];
    ['ipercromasia', 'membranaIrregolare', 'cromatinaGrossolana'].forEach(function (k) {
      if (caratteri[k]) l.push(DATA.criterioLabel[k]);
    });
    return l;
  }

  function paragrafoCitomorfologico(input, result) {
    var righe = [];
    righe.push(input.cellularitaAdeguata === false ? 'Cellularità scarsa.' : 'Cellularità adeguata.');
    if (input.oscuramentoCausa) righe.push('Fondo con ' + input.oscuramentoCausa + '.');

    if ((input.nCellule || '0') === '0') {
      righe.push('Non si osservano cellule uroteliali atipiche di rilievo.');
    } else {
      var crit = frasiCaratteri(input.caratteri);
      var critTxt = crit.length ? ', ' + join(crit) : ', senza atipie nucleari di rilievo';
      var conteggio = input.nCellule === 'pariOSopraSoglia'
        ? ' in numero pari o superiore alla soglia quantitativa di laboratorio (' + result.sogliaEffettiva + ' cellule)'
        : ' in numero inferiore alla soglia quantitativa di laboratorio (' + result.sogliaEffettiva + ' cellule)';
      righe.push('Presente popolazione di cellule uroteliali con rapporto nucleo/citoplasma ' +
        DATA.ncLabel[input.ncRatio || '<0.5'] + critTxt + conteggio + '.');
    }
    return righe.join(' ');
  }

  function fraseAdeguatezza(input, result, categoriaEffettiva) {
    var causa = input.oscuramentoCausa || '';
    if (categoriaEffettiva === 'NON_DIAGNOSTICO') return DATA.fraseNonValutabile(causa);
    if (input.oscuramento === 'severo' && (result.categoria === 'HGUC' || result.categoria === 'SHGUC')) {
      return DATA.fraseLimitatoMaDiagnostico(causa);
    }
    if (input.oscuramento === 'moderato') return DATA.fraseParzialmenteLimitato(causa);
    return DATA.fraseAdeguato;
  }

  function buildReferto(input, result, scelte) {
    input = input || {}; result = result || {}; scelte = scelte || {};
    var manual = scelte.manualCategory || null;
    var categoriaEffettiva = manual || result.categoria;
    var applicaLGUN = scelte.applicaLGUN !== false;

    var L = [];
    L.push('CITOLOGIA URINARIA — Sistema di Parigi (TPS 2022)');
    L.push('');
    L.push('Campione: ' + (DATA.campioneEsteso[input.campione] || '—'));
    L.push('Adeguatezza: ' + fraseAdeguatezza(input, result, categoriaEffettiva));
    L.push('');
    L.push('Quadro citomorfologico:');
    L.push('  ' + paragrafoCitomorfologico(input, result));
    L.push('');
    L.push('Categoria diagnostica:');
    var estesa = DATA.categoriaEstesa[categoriaEffettiva] || categoriaEffettiva;
    if (categoriaEffettiva === 'ALTRE_NEOPLASIE' && input.nonUrotelialeTipo) {
      estesa += ' (' + input.nonUrotelialeTipo + ')';
    }
    L.push('  ' + estesa);
    if (categoriaEffettiva === 'NHGUC' && result.qualificatore === 'LGUN' && applicaLGUN) {
      L.push('  ' + DATA.fraseQualificatoreLGUN);
    }

    // Blocco Nota
    var note = [];
    (result.promemoria || []).forEach(function (p) { note.push(p); });
    (result.alert || []).forEach(function (a) { note.push(a.messaggio); });
    if (manual) {
      note.push(DATA.fraseRiclassificaManuale(
        DATA.categoriaEstesa[manual] || manual,
        scelte.manualReason,
        DATA.categoriaEstesa[result.categoria] || result.categoria));
    }
    if (input.campione === 'alteVie') note.push(DATA.fraseSogliaAlteVie);

    if (note.length) {
      L.push('');
      L.push('Nota:');
      note.forEach(function (n) { L.push('  ' + n); });
    }

    return L.join('\n');
  }

  var api = { buildReferto: buildReferto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TPS = root.TPS || {}; root.TPS.buildReferto = buildReferto; }
})(typeof self !== 'undefined' ? self : this);
```

- [ ] **Step 4: Ripristinare in `tests/run.mjs` l'import diretto di `buildReferto`**

Sostituire il blocco `try { ({ buildReferto } = require('../referto.js')); } catch ...` con:

```js
const { buildReferto } = require('../referto.js');
```

- [ ] **Step 5: Eseguire i test**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node tests/run.mjs`
Expected: PASS totale. Riga finale `OK — NN pass, 0 fail`.

- [ ] **Step 6: Commit**

```bash
cd /Users/filippo/Documents/GitHub/paris-urine
git add referto.js tests/run.mjs
git commit -m "feat(referto): buildReferto — testo strutturato con adeguatezza, quadro, categoria, nota"
```

---

## Task 8: `index.html` — struttura e stile

**Files:**
- Create: `/Users/filippo/Documents/GitHub/paris-urine/index.html`

Nessun test automatico: verifica visiva nel Task 12. Gli `id` qui definiti sono il
contratto usato da `app.js` (Task 9).

- [ ] **Step 1: Creare `index.html`**

```html
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" content="#0e7c7b">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="TPS Urine">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icon-192.png">
<title>Citologia urinaria — Sistema di Parigi (TPS 2022)</title>
<style>
:root{
  --bg:#eef2f4;--panel:#fff;--border:#d3dade;--accent:#0e7c7b;--accent-d:#0a5a59;
  --text:#1c2529;--muted:#61707a;--chip:#e6edef;--ok:#1f7a34;--warn:#9a4a00;--danger:#a11f2e;
  --radius:8px;
}
:root[data-theme="dark"]{
  --bg:#12191c;--panel:#1b2429;--border:#33424a;--accent:#3fb6b3;--accent-d:#2b8f8c;
  --text:#e6edf0;--muted:#9fb0b8;--chip:#243138;--ok:#5cc46f;--warn:#e0a35c;--danger:#e0707d;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.55;padding:16px}
header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
header h1{font-size:1.15rem;font-weight:650}
.spacer{flex:1}
button{font:inherit;cursor:pointer;border:1px solid var(--border);background:var(--panel);color:var(--text);border-radius:var(--radius);padding:7px 12px}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
button.primary:hover{background:var(--accent-d)}
.wrap{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:860px){.wrap{grid-template-columns:1fr}}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:14px}
.panel h2{font-size:.95rem;margin-bottom:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.field{margin-bottom:12px}
.field label{display:block;font-size:.9rem;margin-bottom:4px}
.field select,.field input[type=text]{width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)}
.checks{display:flex;flex-direction:column;gap:5px}
.checks label{font-size:.9rem;display:flex;gap:7px;align-items:flex-start}
.hint{font-size:.8rem;color:var(--muted);margin-top:3px}
.result-cat{font-size:1.1rem;font-weight:700;margin:4px 0 8px}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;background:var(--chip);font-size:.8rem;margin-left:6px}
ul.motiv{margin:6px 0 10px 18px;font-size:.9rem}
.alert{border-left:4px solid var(--warn);background:var(--chip);padding:8px 10px;border-radius:6px;margin:8px 0;font-size:.9rem}
.alert.confondente{border-left-color:var(--danger)}
.alert button{margin-top:6px;font-size:.85rem}
textarea#referto{width:100%;min-height:280px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.85rem;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);white-space:pre-wrap}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.avvertenza{font-size:.8rem;color:var(--muted);margin-top:14px;border-top:1px solid var(--border);padding-top:8px}
</style>
</head>
<body>
<header>
  <h1>Citologia urinaria — Sistema di Parigi (TPS 2022)</h1>
  <span class="spacer"></span>
  <button id="btn-nuovo-caso">Nuovo caso</button>
  <button id="theme-toggle" title="Tema chiaro/scuro">◑</button>
</header>

<div class="wrap">
  <section class="panel" id="form-panel">
    <h2>Reperti</h2>

    <div class="field">
      <label for="campione">Tipo di campione</label>
      <select id="campione">
        <option value="spontanea">Urina spontanea</option>
        <option value="cateterismo">Cateterismo</option>
        <option value="washing">Washing vescicale</option>
        <option value="alteVie">Alte vie escretrici</option>
      </select>
      <div class="hint" id="hint-campione"></div>
    </div>

    <div class="field checks">
      <label><input type="checkbox" id="cellularitaAdeguata" checked> Cellularità adeguata</label>
    </div>

    <div class="field">
      <label for="oscuramento">Elementi oscuranti</label>
      <select id="oscuramento">
        <option value="assente-lieve">Assenti / lievi</option>
        <option value="moderato">Moderati</option>
        <option value="severo">Severi — valutazione compromessa</option>
      </select>
    </div>
    <div class="field">
      <label for="oscuramentoCausa">Causa dell'oscuramento (opzionale)</label>
      <input type="text" id="oscuramentoCausa" placeholder="sangue, flogosi, lubrificante, degenerazione, overgrowth batterico">
    </div>

    <div class="field">
      <label for="ncRatio">Rapporto nucleo/citoplasma (popolazione più atipica)</label>
      <select id="ncRatio">
        <option value="&lt;0.5">&lt; 0.5</option>
        <option value="0.5-0.7">0.5 – 0.7</option>
        <option value="&gt;=0.7">&ge; 0.7</option>
      </select>
    </div>

    <div class="field checks">
      <label>Criteri nucleari</label>
      <label><input type="checkbox" id="car-ipercromasia"> Ipercromasia</label>
      <label><input type="checkbox" id="car-membrana"> Membrana nucleare irregolare</label>
      <label><input type="checkbox" id="car-cromatina"> Cromatina grossolana</label>
      <div class="hint">Criteri completi = ipercromasia + almeno uno tra membrana e cromatina.</div>
    </div>

    <div class="field">
      <label for="nCellule">Numero di cellule della popolazione atipica</label>
      <select id="nCellule">
        <option value="0">Nessuna</option>
        <option value="sottoSoglia">1 – sotto soglia</option>
        <option value="pariOSopraSoglia">Pari o sopra soglia</option>
      </select>
      <div class="hint" id="hint-soglia"></div>
    </div>

    <div class="field checks">
      <label>Reperti accessori</label>
      <label><input type="checkbox" id="rep-papillare"> Frammenti papillari con asse fibrovascolare</label>
      <label><input type="checkbox" id="rep-squamose"> Cellule squamose atipiche</label>
      <label><input type="checkbox" id="rep-ghiandolari"> Cellule ghiandolari atipiche</label>
      <label><input type="checkbox" id="rep-nonuroteliale"> Neoplasia non uroteliale</label>
      <label><input type="checkbox" id="rep-polyoma"> Decoy cells / polyomavirus</label>
      <label><input type="checkbox" id="rep-terapia"> Effetto terapia (BCG / chemio / RT)</label>
      <label><input type="checkbox" id="rep-litiasi"> Litiasi</label>
    </div>
    <div class="field">
      <label for="nonUrotelialeTipo">Tipo di neoplasia non uroteliale (se applicabile)</label>
      <input type="text" id="nonUrotelialeTipo" placeholder="es. adenocarcinoma, carcinoma squamoso, metastasi…">
    </div>

    <div class="field">
      <label for="sogliaLabBasseVie">Soglia quantitativa HGUC — basse vie (impostazione)</label>
      <select id="sogliaLabBasseVie">
        <option value="5">5 cellule (default prudenziale)</option>
        <option value="10">10 cellule</option>
      </select>
      <div class="hint">Per le alte vie la soglia è fissata a 10 e non modificabile.</div>
    </div>
  </section>

  <section class="panel" id="result-panel">
    <h2>Risultato</h2>
    <div class="result-cat" id="risultato-categoria">—</div>
    <ul class="motiv" id="risultato-motivazione"></ul>
    <div id="risultato-alert"></div>
    <div id="risultato-promemoria"></div>

    <h2 style="margin-top:14px">Referto</h2>
    <textarea id="referto" spellcheck="false"></textarea>
    <div class="row">
      <button class="primary" id="btn-copia">Copia negli appunti</button>
      <button id="btn-scarica">Scarica .txt</button>
    </div>

    <p class="avvertenza">
      Strumento di supporto alla decisione. La categoria proposta va confermata con
      correlazione clinico-strumentale. Nessun declassamento è applicato automaticamente.
    </p>
  </section>
</div>

<script src="tps-data.js"></script>
<script src="classifier.js"></script>
<script src="referto.js"></script>
<script src="app.js"></script>
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js')
      .then(function (r) { console.log('SW registrato:', r.scope); })
      .catch(function (e) { console.warn('SW errore:', e); });
  });
}
</script>
</body>
</html>
```

- [ ] **Step 2: Verifica sintattica rapida (apertura file)**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node -e "const s=require('fs').readFileSync('index.html','utf8'); if(!/id=\"referto\"/.test(s)) throw new Error('manca #referto'); console.log('index.html ok, '+s.length+' byte')"`
Expected: `index.html ok, N byte`

- [ ] **Step 3: Commit**

```bash
cd /Users/filippo/Documents/GitHub/paris-urine
git add index.html
git commit -m "feat(ui): index.html — struttura form + risultato, tema chiaro/scuro"
```

---

## Task 9: `app.js` — collegamento UI

**Files:**
- Create: `/Users/filippo/Documents/GitHub/paris-urine/app.js`

Nessun test automatico (nessun DOM nei test): verifica nel Task 12.

- [ ] **Step 1: Creare `app.js`**

```js
;(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LS_TEMA = 'paris.tema', LS_SOGLIA = 'paris.sogliaBasseVie';

  var stato = { manualCategory: null, manualReason: '' };

  // ── Tema ───────────────────────────────────────────────
  function applicaTema(t) {
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
    try { localStorage.setItem(LS_TEMA, t); } catch (e) {}
  }
  applicaTema((function () { try { return localStorage.getItem(LS_TEMA) || 'light'; } catch (e) { return 'light'; } })());
  $('theme-toggle').addEventListener('click', function () {
    applicaTema(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  // ── Impostazione soglia (persistita) ──────────────────
  try {
    var s = localStorage.getItem(LS_SOGLIA);
    if (s) $('sogliaLabBasseVie').value = s;
  } catch (e) {}
  $('sogliaLabBasseVie').addEventListener('change', function () {
    try { localStorage.setItem(LS_SOGLIA, $('sogliaLabBasseVie').value); } catch (e) {}
    aggiorna();
  });

  // ── Lettura form → input per classify ─────────────────
  function leggiInput() {
    return {
      campione: $('campione').value,
      cellularitaAdeguata: $('cellularitaAdeguata').checked,
      oscuramento: $('oscuramento').value,
      oscuramentoCausa: $('oscuramentoCausa').value.trim(),
      ncRatio: $('ncRatio').value,           // i value dell'option sono già '<0.5' / '0.5-0.7' / '>=0.7'
      caratteri: {
        ipercromasia: $('car-ipercromasia').checked,
        membranaIrregolare: $('car-membrana').checked,
        cromatinaGrossolana: $('car-cromatina').checked
      },
      sogliaLabBasseVie: parseInt($('sogliaLabBasseVie').value, 10),
      nCellule: $('nCellule').value,
      reperti: {
        papillareFibrovascolare: $('rep-papillare').checked,
        squamoseAtipiche: $('rep-squamose').checked,
        ghiandolariAtipiche: $('rep-ghiandolari').checked,
        nonUroteliale: $('rep-nonuroteliale').checked,
        polyoma: $('rep-polyoma').checked,
        effettoTerapia: $('rep-terapia').checked,
        litiasi: $('rep-litiasi').checked
      },
      nonUrotelialeTipo: $('nonUrotelialeTipo').value.trim()
    };
  }

  // ── Vincolo UI: nCellule=0 incompatibile con criteri nucleari ──
  function sincronizzaVincoli(input) {
    var qualcheCriterio = input.caratteri.ipercromasia || input.caratteri.membranaIrregolare || input.caratteri.cromatinaGrossolana;
    if (qualcheCriterio && $('nCellule').value === '0') {
      $('nCellule').value = 'sottoSoglia';
      return true;
    }
    return false;
  }

  function etichettaSoglia(input) {
    var soglia = input.campione === 'alteVie' ? 10 : input.sogliaLabBasseVie;
    $('hint-soglia').textContent = 'Soglia effettiva: ' + soglia + ' cellule' +
      (input.campione === 'alteVie' ? ' (fissata per le alte vie)' : '');
    $('nCellule').options[1].textContent = '1 – ' + (soglia - 1);
    $('nCellule').options[2].textContent = '≥ ' + soglia;
  }

  function hintCampione(input) {
    $('hint-campione').textContent = (input.campione === 'cateterismo' || input.campione === 'washing')
      ? 'Campione strumentato: aggregati uroteliali benigni e frammenti papillari attesi, non sovrastimare.'
      : '';
  }

  // ── Render risultato ─────────────────────────────────
  function render(input, result) {
    var estesa = TPS_DATA.categoriaEstesa[stato.manualCategory || result.categoria] || (stato.manualCategory || result.categoria);
    $('risultato-categoria').textContent = estesa;
    if (result.qualificatore === 'LGUN' && !stato.manualCategory) {
      var b = document.createElement('span'); b.className = 'badge'; b.textContent = 'qualificatore LGUN';
      $('risultato-categoria').appendChild(b);
    }

    var ul = $('risultato-motivazione'); ul.innerHTML = '';
    result.motivazione.forEach(function (m) { var li = document.createElement('li'); li.textContent = m; ul.appendChild(li); });

    var ab = $('risultato-alert'); ab.innerHTML = '';
    result.alert.forEach(function (a) {
      var d = document.createElement('div');
      d.className = 'alert' + (a.tipo === 'confondente' ? ' confondente' : '');
      d.textContent = a.messaggio;
      if (a.tipo === 'confondente' && !stato.manualCategory) {
        var btn = document.createElement('button');
        btn.textContent = 'Riclassifica manualmente come AUC per confondente morfologico';
        btn.addEventListener('click', function () {
          stato.manualCategory = 'AUC';
          stato.manualReason = input.reperti.polyoma ? 'polyomavirus/decoy cells' : 'effetto terapia';
          aggiorna();
        });
        d.appendChild(document.createElement('br'));
        d.appendChild(btn);
      }
      ab.appendChild(d);
    });
    if (stato.manualCategory) {
      var undo = document.createElement('button');
      undo.textContent = 'Annulla riclassificazione manuale';
      undo.addEventListener('click', function () { stato.manualCategory = null; stato.manualReason = ''; aggiorna(); });
      ab.appendChild(undo);
    }

    var pb = $('risultato-promemoria'); pb.innerHTML = '';
    result.promemoria.forEach(function (p) { var d = document.createElement('div'); d.className = 'alert'; d.textContent = p; pb.appendChild(d); });
  }

  // ── Ciclo di aggiornamento ───────────────────────────
  function aggiorna() {
    var input = leggiInput();
    if (sincronizzaVincoli(input)) input = leggiInput();
    etichettaSoglia(input);
    hintCampione(input);
    var result = TPS.classify(input);
    render(input, result);
    $('referto').value = TPS.buildReferto(input, result, {
      manualCategory: stato.manualCategory,
      manualReason: stato.manualReason,
      applicaLGUN: true
    });
  }

  // ── Eventi ───────────────────────────────────────────
  ['campione','cellularitaAdeguata','oscuramento','oscuramentoCausa','ncRatio',
   'car-ipercromasia','car-membrana','car-cromatina','nCellule',
   'rep-papillare','rep-squamose','rep-ghiandolari','rep-nonuroteliale','rep-polyoma','rep-terapia','rep-litiasi',
   'nonUrotelialeTipo'].forEach(function (id) {
    var el = $(id);
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', aggiorna);
  });

  $('btn-nuovo-caso').addEventListener('click', function () {
    $('form-panel').querySelectorAll('input[type=text]').forEach(function (i) { i.value = ''; });
    $('form-panel').querySelectorAll('input[type=checkbox]').forEach(function (c) { c.checked = c.id === 'cellularitaAdeguata'; });
    $('campione').value = 'spontanea';
    $('oscuramento').value = 'assente-lieve';
    $('ncRatio').value = '<0.5';
    $('nCellule').value = '0';
    stato.manualCategory = null; stato.manualReason = '';
    aggiorna();
  });

  $('btn-copia').addEventListener('click', function () {
    navigator.clipboard.writeText($('referto').value).then(function () {
      $('btn-copia').textContent = 'Copiato ✓';
      setTimeout(function () { $('btn-copia').textContent = 'Copia negli appunti'; }, 1500);
    });
  });

  $('btn-scarica').addEventListener('click', function () {
    var blob = new Blob([$('referto').value], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'referto-citologia-urinaria.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });

  aggiorna();
})();
```

- [ ] **Step 2: Verifica sintassi con Node**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && node --check app.js && echo "app.js: sintassi OK"`
Expected: `app.js: sintassi OK`

- [ ] **Step 3: Verifica coerenza id form ↔ app.js**

Run:
```bash
cd /Users/filippo/Documents/GitHub/paris-urine && node -e "
const html=require('fs').readFileSync('index.html','utf8');
const js=require('fs').readFileSync('app.js','utf8');
const ids=[...js.matchAll(/\\\$\('([a-zA-Z-]+)'\)/g)].map(m=>m[1]);
const missing=[...new Set(ids)].filter(id=>!html.includes('id=\"'+id+'\"'));
if(missing.length) throw new Error('id mancanti in index.html: '+missing.join(', '));
console.log('tutti gli id di app.js esistono in index.html');
"
```
Expected: `tutti gli id di app.js esistono in index.html`

- [ ] **Step 4: Commit**

```bash
cd /Users/filippo/Documents/GitHub/paris-urine
git add app.js
git commit -m "feat(ui): app.js — form live, alert, riclassificazione manuale, export, tema"
```

---

## Task 10: PWA — `manifest.json`, `sw.js`, icone

**Files:**
- Create: `/Users/filippo/Documents/GitHub/paris-urine/manifest.json`
- Create: `/Users/filippo/Documents/GitHub/paris-urine/sw.js`
- Create: `/Users/filippo/Documents/GitHub/paris-urine/tools/make-icons.py`
- Create (generati): `/Users/filippo/Documents/GitHub/paris-urine/icon-192.png`, `icon-512.png`

- [ ] **Step 1: Creare `manifest.json`**

```json
{
  "name": "Citologia urinaria — Sistema di Parigi (TPS 2022)",
  "short_name": "TPS Urine",
  "description": "Categorizzazione citologica secondo il Sistema di Parigi 2022 e generazione del referto",
  "id": "./",
  "scope": "./",
  "start_url": "./",
  "display": "standalone",
  "orientation": "portrait-primary",
  "lang": "it",
  "background_color": "#eef2f4",
  "theme_color": "#0e7c7b",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: Creare `sw.js`** (schema identico all'app TNM del dominio)

```js
const CACHE = 'paris-v1';
const ASSETS = [
  './', './index.html', './manifest.json',
  './tps-data.js', './classifier.js', './referto.js', './app.js',
  './icon-192.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const isDoc = e.request.mode === 'navigate' || /\.html$/.test(new URL(e.request.url).pathname);
  if (isDoc) {
    e.respondWith(
      fetch(e.request)
        .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request).then(m => m || caches.match('./index.html')))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(m => m || fetch(e.request).then(r => {
        if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
        return r;
      }))
    );
  }
});
```

- [ ] **Step 3: Creare `tools/make-icons.py`**

```python
"""Genera icon-192.png e icon-512.png: quadrato arrotondato teal con testo 'TPS'.
Uso: python3 tools/make-icons.py   (richiede Pillow)"""
from PIL import Image, ImageDraw, ImageFont

BG = (14, 124, 123, 255)   # #0e7c7b
FG = (255, 255, 255, 255)

def make(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * 0.18)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)
    txt = "TPS"
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", int(size * 0.34))
    except Exception:
        font = ImageFont.load_default()
    bbox = d.textbbox((0, 0), txt, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), txt, font=font, fill=FG)
    img.convert("RGB").save(path, "PNG")
    print("scritto", path)

make(192, "icon-192.png")
make(512, "icon-512.png")
```

- [ ] **Step 4: Generare le icone**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && python3 tools/make-icons.py`
Expected:
```
scritto icon-192.png
scritto icon-512.png
```

- [ ] **Step 5: Verificare le dimensioni**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && file icon-192.png icon-512.png`
Expected: `PNG image data, 192 x 192` e `512 x 512`

- [ ] **Step 6: Commit**

```bash
cd /Users/filippo/Documents/GitHub/paris-urine
git add manifest.json sw.js tools/make-icons.py icon-192.png icon-512.png
git commit -m "feat(pwa): manifest, service worker (schema TNM), icone"
```

---

## Task 11: Integrazione nella dashboard `infingardo.github.io`

**Files:**
- Modify: `/Users/filippo/Documents/GitHub/infingardo.github.io/index.html` (array `MEDICINA`, ~riga 135)

- [ ] **Step 1: Individuare l'ultima voce dell'array `MEDICINA`**

Run: `cd /Users/filippo/Documents/GitHub/infingardo.github.io && grep -n "Stomaco - Gastriti" index.html`
Expected: una riga tipo `135: { name: 'Stomaco - Gastriti (USS e OLGA)', ... },`

- [ ] **Step 2: Aggiungere la voce dopo quella "Stomaco - Gastriti"**

Inserire questa riga subito dopo la riga individuata (mantenendo l'allineamento a colonne dello stile esistente non è necessario: basta un oggetto valido):

```js
            { name: 'Citologia urinaria - Sistema di Parigi (TPS 2022)', url: 'https://infingardo.github.io/paris-urine/', description: 'Categorizzazione TPS e generazione del referto', icon: <Microscope className="w-6 h-6" />, color: 'from-teal-500 to-cyan-600', sub: 'Citologia', updated: 'ago 2026' },
```

- [ ] **Step 3: Verificare che `Microscope` sia già importato** (lo è: usato da altre voci). Verifica rapida:

Run: `cd /Users/filippo/Documents/GitHub/infingardo.github.io && grep -c "Microscope" index.html`
Expected: numero ≥ 2

- [ ] **Step 4: Verificare che il file resti JS valido estraendo l'array**

Run:
```bash
cd /Users/filippo/Documents/GitHub/infingardo.github.io && node -e "
const s=require('fs').readFileSync('index.html','utf8');
const m=s.match(/const MEDICINA = \[([\s\S]*?)\];/);
if(!m) throw new Error('array MEDICINA non trovato');
if(!m[1].includes('paris-urine')) throw new Error('voce paris-urine non inserita');
const open=(m[1].match(/\{/g)||[]).length, close=(m[1].match(/\}/g)||[]).length;
if(open!==close) throw new Error('parentesi graffe sbilanciate: '+open+' vs '+close);
console.log('MEDICINA ok, '+open+' voci, paris-urine presente');
"
```
Expected: `MEDICINA ok, N voci, paris-urine presente`

- [ ] **Step 5: Commit (nel repo della dashboard)**

```bash
cd /Users/filippo/Documents/GitHub/infingardo.github.io
git add index.html
git commit -m "Aggiunta app Citologia urinaria (Sistema di Parigi TPS 2022)"
```

Nota: il push di questo repo NON è in questo piano — vedi Task 12, step finale.

---

## Task 12: Verifica end-to-end, README, consegna

**Files:**
- Modify: `/Users/filippo/Documents/GitHub/paris-urine/README.md` (se emergono correzioni)

- [ ] **Step 1: Suite di test completa**

Run: `cd /Users/filippo/Documents/GitHub/paris-urine && npm test`
Expected: `OK — NN pass, 0 fail`, exit code 0.

- [ ] **Step 2: Avviare l'anteprima nel browser** (Browser pane)

Usare `preview_start` con:
```json
{ "name": "paris-urine" }
```
Se `.claude/launch.json` non esiste, crearlo:
```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "paris-urine", "runtimeExecutable": "npx", "runtimeArgs": ["-y", "serve", "-l", "4173", "."], "port": 4173 }
  ]
}
```
(Serve un server HTTP perché il Service Worker non si registra da `file://`. In alternativa `python3 -m http.server 4173`.)

- [ ] **Step 3: Verifiche funzionali nel browser** (via `read_page` / `computer` / `read_console_messages`)

Controllare, nell'ordine:
1. Nessun errore in console (`read_console_messages`).
2. Stato iniziale: categoria mostrata = "Negativo per carcinoma uroteliale di alto grado (NHGUC)".
3. Impostare N/C ≥ 0.7, spuntare Ipercromasia + Membrana irregolare, nCellule "Pari o sopra soglia" → categoria "Carcinoma uroteliale di alto grado (HGUC)"; il referto in textarea contiene "HGUC".
4. Spuntare "Effetto terapia" → compare un box alert rosso con il pulsante "Riclassifica manualmente come AUC…"; la categoria NON cambia da sola.
5. Cliccare quel pulsante → categoria mostrata diventa "Cellule uroteliali atipiche (AUC)"; nel referto, blocco "Nota:" con la frase "Su valutazione del citopatologo…".
6. "Nuovo caso" → form e referto tornano allo stato iniziale, categoria di nuovo NHGUC.
7. Cambiare campione in "Alte vie escretrici" → l'hint sotto "Numero di cellule" dice "Soglia effettiva: 10 cellule (fissata per le alte vie)".
8. "Copia negli appunti" → il pulsante mostra "Copiato ✓".
9. Toggle tema (◑) → i colori passano a scuro; ricaricando la pagina il tema resta.

- [ ] **Step 4: Verifica PWA**

`read_network_requests` / console: `SW registrato: <scope che termina in /paris-urine/ o />`. Nessun 404 su `manifest.json`, `icon-192.png`, `icon-512.png`.

- [ ] **Step 5: Screenshot di conferma**

`computer` → `screenshot`. Allegare per l'utente lo stato con un caso HGUC + alert confondente visibile.

- [ ] **Step 6: Aggiornare il README se il Task 12 ha rivelato scostamenti** (altrimenti saltare). Commit eventuale:

```bash
cd /Users/filippo/Documents/GitHub/paris-urine
git add -A && git commit -m "docs: note d'uso dopo verifica end-to-end"
```

- [ ] **Step 7: Consegna — azioni che restano all'utente**

Riferire all'utente (NON eseguire senza conferma esplicita):
1. Creare il repo GitHub `Infingardo/paris-urine` e fare `git push -u origin main` dalla cartella `/Users/filippo/Documents/GitHub/paris-urine`.
2. Attivare GitHub Pages sul repo (branch `main`, root).
3. `git push` del repo `infingardo.github.io` per pubblicare la voce in dashboard.
4. Prima apertura online necessaria una volta per l'attivazione offline.

---

## Self-Review (svolto in fase di stesura)

**1. Copertura spec:**
- §3 architettura/file → File Structure + Task 1,8,9,10
- §4.1 input → Task 3/9 (`leggiInput`), §4.2 criteri → Task 2, §4.3 soglia → Task 2/5, §4.4 regole 0–7 → Task 3,4, §4.5 alert → Task 3,5, §4.6 output → Task 3 (forma) + campi aggiunti in 3–5, §4.7 default → Task 3
- §5 referto (struttura, frasi chiave, riclassificazione, export) → Task 6,7,9
- §6 UI (form, colonna risultato, Nuovo caso, tema, avvertenza) → Task 8,9
- §7 test (19 classify + A–G referto) → Task 2–7
- §8 rischi → mitigazioni implementate (nessun declassamento automatico: Task 5; riclassificazione tracciata: Task 7/9)
- Integrazione dashboard → Task 11

**2. Placeholder:** nessun "TBD"/"gestire edge case" — ogni step ha codice o comando completo.

**3. Coerenza tipi:** `classify(input)` → `{ categoria, qualificatore, sogliaEffettiva, motivazione[], alert[], promemoria[] }` usato identico in Task 3–5, 7, 9. `buildReferto(input, result, scelte)` con `scelte = { manualCategory, manualReason, applicaLGUN }` coerente tra Task 7 e Task 9. `criteriLevel` → `'assenti'|'parziali'|'completi'` coerente Task 2↔3. Valori `nCellule` `'0'|'sottoSoglia'|'pariOSopraSoglia'` coerenti tra `index.html` (Task 8), `app.js` (Task 9), test (Task 3–5). `ncRatio` `'<0.5'|'0.5-0.7'|'>=0.7'`: nelle `<option>` HTML sono scritti con entità (`&lt;0.5` ecc.) ma il `.value` restituito dal DOM è già la stringa decodificata — coerente con classifier e test.

**4. Rischio residuo noto:** `app.js` non è coperto da test automatici (nessun DOM headless, coerente con la scelta della spec). Mitigato dalla checklist di verifica manuale nel Task 12 e dai due controlli statici (sintassi + coerenza id) nei Task 9 step 2–3.
