# Citologia urinaria — Sistema di Parigi (TPS 2022)

Design doc — 2026-08-28

## 1. Scopo

App web per anatomia patologica che copre due funzioni:

1. **Supporto decisionale**: da un questionario citomorfologico strutturato deriva la
   categoria diagnostica del Sistema di Parigi 2ª edizione (2022).
2. **Generatore di referto**: compone un testo di referto in italiano, editabile ed
   esportabile.

Asse clinico centrale: **alto grado vs non alto grado** (rule-out dell'HGUC).

Non è un dispositivo medico. È uno strumento di supporto: la categoria va confermata
con correlazione clinico-strumentale. L'avvertenza compare nell'interfaccia e nel
README, **non** nel testo di referto esportato.

## 2. Ambito

- **Riferimento unico**: TPS 2ª edizione (2022).
- **Tipi di campione gestiti**: urina spontanea, cateterismo, washing vescicale, alte vie.
  La distinzione spontanea vs strumentato modifica la logica (vedi §4).
- **Categorie prodotte**: Non diagnostico, NHGUC, AUC, SHGUC, HGUC, LGUN, Altre neoplasie.
- Fuori ambito: ROHM (rischio di alto grado con percentuali), raccomandazioni di
  gestione clinica, quantificazione automatica da immagine, multilingua.

## 3. Architettura

Repo separato `Infingardo/paris-urine` → `infingardo.github.io/paris-urine/`.
Nessuna dipendenza esterna, nessun build.

```
paris-urine/
  index.html            struttura + CSS (tema coerente con le altre app del dominio)
  tps-data.js           dati puri: definizioni categorie, criteri, frasi di referto
  classifier.js         funzione pura classify(input) -> risultato ; shim module.exports per i test
  app.js                UI: legge il form, chiama classify(), compone il referto, export, "Nuovo caso"
  manifest.json         id/scope = "./", start_url "./", display standalone, lang it
  sw.js                 cache-first asset, network-first HTML, CACHE = 'paris-v1'
  icon-192.png, icon-512.png
  package.json          "test": "node tests/run.mjs"
  tests/run.mjs         ~15 casi sul classificatore, exit code 0/1
  README.md
```

### Decisioni tecniche

- **Script classici** (non ES modules) con namespace `TPS.*`: `index.html` funziona anche
  aperto da `file://` con doppio clic. Ordine di caricamento: `tps-data.js`,
  `classifier.js`, `app.js`.
- `classifier.js` chiude con `if (typeof module !== 'undefined') module.exports = { classify };`
  per l'import da node nei test. Non tocca il DOM.
- `localStorage`: **solo** impostazioni (soglia lab, tema). Nessun dato clinico persistito.
- Offline: `sw.js` proprio con scope `./` (schema identico a TNM). L'app funziona offline
  anche aperta direttamente, non solo dalla dashboard.

### Integrazione dashboard

Aggiungere in `infingardo.github.io/index.html`, array `MEDICINA`:

```js
{ name: 'Citologia urinaria - Sistema di Parigi (TPS 2022)',
  url: 'https://infingardo.github.io/paris-urine/',
  description: 'Categorizzazione TPS e referto',
  icon: <Microscope className="w-6 h-6" />,
  color: 'from-teal-500 to-cyan-600',
  sub: 'Citologia', updated: 'ago 2026' }
```

## 4. Classificatore — `classify(input)`

### 4.1 Input

| Campo | Valori |
|---|---|
| `campione` | `spontanea` \| `cateterismo` \| `washing` \| `alteVie` |
| `cellularitaAdeguata` | `true` \| `false` |
| `elementiOscuranti` | `nessuno` \| `sangue` \| `flogosi` \| `lubrificante` \| `degenerazione` \| `overgrowthBatterico` |
| `ncRatio` | `<0.5` \| `0.5-0.7` \| `>=0.7` (popolazione più atipica) |
| `caratteri` | sottoinsieme di `{ ipercromasia, membranaIrregolare, cromatinaGrossolana }` |
| `sogliaLab` | `5` \| `10` — impostazione, default **5** |
| `nCellule` | `0` \| `sottoSoglia` (1 … `sogliaLab`−1) \| `pariOSopraSoglia` (≥ `sogliaLab`) — numero di cellule della **popolazione atipica** (N/C aumentato). Le etichette UI mostrano il numero concreto in base a `sogliaLab` (es. "1–4" / "≥ 5"). `caratteri` descrive se quella popolazione mostra anche caratteri nucleari. |
| `reperti` | sottoinsieme di `{ papillareFibrovascolare, squamoseAtipiche, ghiandolariAtipiche, nonUroteliale, polyoma, effettoTerapia, litiasi }` |
| `nonUrotelialeTipo` | testo libero (se `nonUroteliale` attivo) |
| `override` | opzionale: forza la categoria morfologica ignorando il declassamento |

### 4.2 Logica decisionale (priorità decrescente)

0. **Normalizzazione**: se `nCellule = 0` non esiste popolazione atipica: le regole 2–4
   non si applicano, qualunque sia `ncRatio`. La UI impedisce la combinazione `nCellule = 0`
   con `caratteri` non vuoto (non si descrivono caratteri nucleari su zero cellule atipiche).
1. **`nonUroteliale`** attivo → `ALTRE_NEOPLASIE` (primaria/secondaria, tipo a testo libero). Stop.
2. **HGUC**: `ncRatio = >=0.7` **e** `caratteri` non vuoto **e** `nCellule = pariOSopraSoglia`.
3. **SHGUC**: `ncRatio = >=0.7` **e** `caratteri` non vuoto **e** `nCellule = sottoSoglia`.
4. **AUC** (richiede `nCellule` ≠ `0`):
   - `ncRatio = 0.5-0.7` **e** `caratteri` non vuoto ; **oppure**
   - `ncRatio = >=0.7` **e** `caratteri` vuoto  *(scelta di default prudenziale — dichiarata come tale nell'app)*
5. **LGUN**: `papillareFibrovascolare` attivo **e** `campione` ∈ `{spontanea, alteVie}` → `LGUN`
   (con nota: diagnosi definitiva istologica). Se `campione` ∈ `{cateterismo, washing}` →
   **non** propone LGUN, aggiunge promemoria "frammenti papillari attesi in campione strumentato".
6. **Non diagnostico**: (`cellularitaAdeguata = false` **oppure** `elementiOscuranti` ∈
   `{sangue, flogosi, lubrificante, degenerazione, overgrowthBatterico}`) **e** nessuna
   cellula da SHGUC/HGUC (regole 2–3 non soddisfatte) → `NON_DIAGNOSTICO`.
   *(se ci sono cellule HGUC/SHGUC il campione è adeguato per definizione — regole 2–3 hanno priorità)*
7. Altrimenti → `NHGUC`.

### 4.3 Declassamento per confondenti

Applicato **dopo** il calcolo della categoria morfologica:

- `polyoma` **oppure** `effettoTerapia` attivi:
  - categoria morfologica `SHGUC` → proposta `AUC`
  - categoria morfologica `AUC` → proposta `NHGUC`
  - in entrambi i casi: `declassata = true`, `warning` esplicito, `categoriaMorfologica`
    conservata. Il toggle `override = true` ripristina la categoria morfologica.
- categoria morfologica `HGUC` con `polyoma`/`effettoTerapia`: **nessun** declassamento
  automatico, ma `warning` di cautela obbligatorio.
- `litiasi` e campione strumentato: solo `promemoria`, nessun declassamento.

### 4.4 Output

```js
{
  categoria: "SHGUC",              // categoria finale (dopo eventuale declassamento/override)
  categoriaMorfologica: "SHGUC",   // prima del declassamento
  declassata: false,
  motivazione: [ "N/C >= 0.7", "ipercromasia + membrana irregolare",
                 "1-4 cellule (< soglia lab 5) -> SHGUC anziche HGUC" ],
  warning: [ "Effetto terapia BCG segnalato: considerare declassamento ad AUC" ],
  promemoria: []
}
```

`categoria` è una delle: `NON_DIAGNOSTICO`, `NHGUC`, `AUC`, `SHGUC`, `HGUC`, `LGUN`, `ALTRE_NEOPLASIE`.

### 4.5 Basi TPS 2022 e scelte di default

**Regole del sistema (fatti TPS 2022):**

- HGUC e SHGUC richiedono entrambi `N/C >= 0.7` **più** almeno un carattere nucleare
  (ipercromasia / membrana irregolare / cromatina grossolana). L'N/C alto da solo non basta.
- HGUC vs SHGUC è distinzione quantitativa/qualitativa: poche cellule o caratteri
  incompleti → SHGUC.
- Il cutoff numerico (5–10 cellule) è deciso dal singolo laboratorio; TPS non impone un numero.
- Polyomavirus/decoy cells è il mimic classico dell'HGUC; TPS raccomanda cautela esplicita.

**Scelte di default dell'app (modificabili, etichettate come "default prudenziale, verificare
con il proprio laboratorio"):**

- `N/C >= 0.7` senza alcun carattere → `AUC` (non `NHGUC`).
- `sogliaLab` default = `5` (più sensibile per l'alto grado; valore più usato negli studi
  di validazione). Opzione `10` disponibile.
- Declassamento confondenti come §4.3, sempre con override.

## 5. Generatore di referto

### 5.1 Struttura

```
CITOLOGIA URINARIA — Sistema di Parigi (TPS 2022)

Campione: <tipo campione>
Adeguatezza: <frase dedicata, sempre presente>

Quadro citomorfologico:
  <descrizione assemblata dagli assi: cellularita, fondo, N/C, caratteri, n. cellule>

Categoria diagnostica:
  <CATEGORIA TPS in forma estesa + sigla>

Nota:
  <solo se presenti warning / promemoria / override / declassamento>
```

### 5.2 Regole di composizione

- Descrizione citomorfologica e frasi di adeguatezza: **template + valori** da `tps-data.js`.
  Nessun testo generato liberamente.
- Blocco **Nota**: presente solo se `warning`, `promemoria`, o `declassata` non vuoti.
  Se `declassata`, esplicita il passaggio: "categoria morfologica SHGUC declassata ad AUC
  per <motivo>".
- Referto in `<textarea>` editabile prima dell'export.
- Export: copia negli appunti **e** download `.txt`.
- **Nessun** blocco ROHM, gestione clinica o disclaimer nel testo esportato.

## 6. UI

- Colonna sinistra: form a 5 assi (§4.1) + impostazione `sogliaLab`.
- Colonna destra: risultato (`categoria`, `motivazione`, `warning`, `promemoria`),
  toggle override se `declassata`, referto editabile, pulsanti Copia / Scarica.
- **"Nuovo caso"**: pulsante sempre visibile in alto; azzera form + referto + override.
- Toggle tema chiaro/scuro (persistito).
- Avvertenza "strumento di supporto" visibile in interfaccia.

## 7. Test — `tests/run.mjs`

`node tests/run.mjs` (via `npm test`). Importa `classifier.js`. Exit code 0 = tutti passano.

Casi minimi (≈15), uno per categoria + confini critici:

| # | Input sintetico | Atteso |
|---|---|---|
| 1 | N/C ≥0.7 + ipercromasia + `nCellule 1-4` | `SHGUC` |
| 2 | come #1 ma `nCellule >=5-10` | `HGUC` |
| 3 | N/C 0.5-0.7 + 1 carattere | `AUC` |
| 4 | N/C ≥0.7 + 0 caratteri + `nCellule` ≥1 | `AUC` (default) |
| 5 | #1 + `effettoTerapia` | `AUC`, `declassata=true`, warning |
| 6 | #5 + `override=true` | `SHGUC`, `declassata=false` |
| 7 | #2 + `polyoma` | `HGUC`, warning cautela, non declassata |
| 8 | `papillareFibrovascolare` + `campione=spontanea` | `LGUN` |
| 9 | `papillareFibrovascolare` + `campione=washing` | non `LGUN` (→ `NHGUC`), promemoria |
| 10 | `cellularitaAdeguata=false`, nessuna atipia | `NON_DIAGNOSTICO` |
| 11 | `cellularitaAdeguata=false` ma quadro #2 | `HGUC` (adeguato per definizione) |
| 12 | `nonUroteliale` + tipo "adenocarcinoma" | `ALTRE_NEOPLASIE` |
| 13 | quadro normale, N/C <0.5, 0 caratteri | `NHGUC` |
| 14 | N/C ≥0.7, `nCellule = 0` (nessuna popolazione atipica) | `NHGUC` (regola 0) |
| 15 | AUC (#3) + `litiasi` | `AUC`, promemoria, non declassata |

## 8. Rischi e limiti

- **Errore ad alto costo**: l'app propone una categoria diagnostica. Mitigazioni: funzione
  pura testata, override sempre disponibile, referto editabile a mano, scelte di default
  dichiarate come prudenziali e non vincolanti.
- L'utente dichiara di non essere esperto di TPS: i default sono impostati sul lato
  conservativo (declassamento attivo, soglia sensibile) e ogni scelta non-di-sistema è
  etichettata.
- La granularità dell'input (3 livelli di N/C, 3 fasce di conteggio) è una
  semplificazione dell'esame reale: accettata per l'uso previsto (supporto, non sostituzione).
- LGUN da citologia è raramente conclusiva: l'app lo esplicita nella nota.
