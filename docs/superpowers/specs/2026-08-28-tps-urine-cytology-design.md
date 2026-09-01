# Citologia urinaria — Sistema di Parigi (TPS 2022)

Design doc — 2026-08-28 (rev. 2)

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
  Spontanea vs strumentato e basse vie vs alte vie modificano la logica (vedi §4).
- **Categorie TPS prodotte**: `NON_DIAGNOSTICO`, `NHGUC`, `AUC`, `SHGUC`, `HGUC`,
  `ALTRE_NEOPLASIE`. **LGUN non è una categoria autonoma**: è un `qualificatore` di `NHGUC`.
- Fuori ambito: ROHM (percentuali di rischio), raccomandazioni di gestione clinica,
  quantificazione automatica da immagine, multilingua.

## 3. Architettura

Repo separato `Infingardo/paris-urine` → `infingardo.github.io/paris-urine/`.
Nessuna dipendenza esterna, nessun build.

```
paris-urine/
  index.html            struttura + CSS (tema coerente con le altre app del dominio)
  tps-data.js           dati puri: definizioni categorie, criteri, frasi di referto
  classifier.js         funzione pura classify(input) -> risultato ; shim module.exports
  referto.js            funzione pura buildReferto(input, result, scelte) -> stringa ; shim module.exports
  app.js                UI: form, chiama classify()/buildReferto(), export, "Nuovo caso"
  manifest.json         id/scope = "./", start_url "./", display standalone, lang it
  sw.js                 cache-first asset, network-first HTML, CACHE = 'paris-v1'
  icon-192.png, icon-512.png
  package.json          "test": "node tests/run.mjs"
  tests/run.mjs         casi sul classificatore + sul referto, exit code 0/1
  README.md
```

### Decisioni tecniche

- **Script classici** (non ES modules) con namespace `TPS.*`: `index.html` funziona anche
  aperto da `file://` con doppio clic. Ordine di caricamento: `tps-data.js`,
  `classifier.js`, `referto.js`, `app.js`.
- `classifier.js` e `referto.js` chiudono con
  `if (typeof module !== 'undefined') module.exports = ...` per l'import da node nei test.
  Nessuno dei due tocca il DOM.
- `localStorage`: **solo** impostazioni (soglia lab basse vie, tema). Nessun dato clinico.
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

`classify` restituisce **solo la categoria morfologica** e gli alert. Non applica mai
declassamenti. La riclassificazione manuale è responsabilità della UI (§5.3).

### 4.1 Input

| Campo | Valori |
|---|---|
| `campione` | `spontanea` \| `cateterismo` \| `washing` \| `alteVie` |
| `cellularitaAdeguata` | `true` \| `false` |
| `oscuramento` | `assente-lieve` \| `moderato` \| `severo` |
| `oscuramentoCausa` | testo libero opzionale (sangue, flogosi, scarsa conservazione/citolisi, degenerazione, abbondante flora batterica) |
| `ncRatio` | `<0.5` \| `0.5-0.7` \| `>=0.7` (popolazione più atipica) |
| `caratteri` | sottoinsieme di `{ ipercromasia, membranaIrregolare, cromatinaGrossolana }` |
| `sogliaLabBasseVie` | `5` \| `10` — impostazione, default **5** (ignorata per `alteVie`) |
| `nCellule` | `0` \| `sottoSoglia` \| `pariOSopraSoglia` — numero di cellule della **popolazione atipica** (N/C aumentato), rispetto alla soglia effettiva (§4.3). Le etichette UI mostrano il numero concreto (es. "1–4" / "≥ 5"). |
| `reperti` | sottoinsieme di `{ papillareFibrovascolare, squamoseAtipiche, ghiandolariAtipiche, nonUroteliale, polyoma, effettoTerapia, litiasi }` |
| `nonUrotelialeTipo` | testo libero (se `nonUroteliale` attivo) |

### 4.2 Criteri nucleari (asse qualitativo)

- `criteriCompleti` = `ipercromasia && (membranaIrregolare || cromatinaGrossolana)`
- `criteriParziali` = almeno un criterio, ma non `criteriCompleti`
  (include il caso `membranaIrregolare && cromatinaGrossolana` **senza** ipercromasia:
  biologicamente possibile, ma non entra nel ramo automatico HGUC/SHGUC — genera alert)
- `criteriAssenti` = nessun criterio

Motivazione della scelta: aderente alla logica TPS classica (ipercromasia come criterio
cardine dell'HGUC), più leggibile per l'utente, più prudente come default algoritmico.

### 4.3 Soglia quantitativa effettiva

- `campione = alteVie` → soglia HGUC **= 10, forzata e non modificabile**
  (atipia reattiva e artefatti da strumentazione più frequenti; specificità inferiore).
- basse vie (`spontanea` / `cateterismo` / `washing`) → soglia = `sogliaLabBasseVie` (5 o 10, default 5).

`nCellule = pariOSopraSoglia` va inteso rispetto a questa soglia effettiva.

### 4.4 Logica decisionale (priorità decrescente)

Normalizzazione: se `nCellule = 0` non esiste popolazione atipica — le regole 2–3 e 5
non si applicano, qualunque sia `ncRatio`. La UI impedisce `nCellule = 0` con `caratteri`
non vuoto. Enum malformati (`ncRatio`, `nCellule`, `campione`, `oscuramento` fuori dai
valori ammessi) → `classify` lancia `RangeError` (fallimento esplicito, non silenzioso).

1. **`nonUroteliale`** attivo → `ALTRE_NEOPLASIE` (primaria/secondaria, tipo a testo libero). Stop.
2. **HGUC**: `ncRatio = >=0.7` **e** `criteriCompleti` **e** `nCellule = pariOSopraSoglia`.
3. **SHGUC**: `ncRatio = >=0.7` **e** `criteriCompleti` **e** `nCellule = sottoSoglia`.
4. **NON_DIAGNOSTICO**: (`oscuramento = severo` **oppure** `cellularitaAdeguata = false`)
   **e** nessuna categoria assegnata sopra (cioè non SHGUC/HGUC).
   *L'inadeguatezza prevale su AUC / NHGUC / LGUN, ma non su SHGUC/HGUC: cellule
   francamente maligne rendono il campione diagnostico per definizione. Un campione
   dichiarato non valutabile non può portare un qualificatore LGUN o una categoria AUC.*
5. **AUC** (richiede `nCellule` ≠ `0`):
   - `ncRatio = 0.5-0.7` **e** almeno un criterio ; **oppure**
   - `ncRatio = >=0.7` **e** `criteriParziali` → `AUC` + alert `"considerare SHGUC secondo giudizio se atipia marcata"` ; **oppure**
   - `ncRatio = >=0.7` **e** `criteriAssenti` → `AUC` *(default prudenziale, dichiarato nell'app)*
6. **NHGUC + qualificatore LGUN**: `papillareFibrovascolare` attivo **e** `campione = spontanea`
   **e** nessuna categoria assegnata sopra → `{ categoria: "NHGUC", qualificatore: "LGUN" }`.
   Se `campione` ∈ `{cateterismo, washing, alteVie}` (tutti strumentati) → **nessun**
   qualificatore, `promemoria` "frammenti papillari attesi/da correlare in campione strumentato".
7. Altrimenti → `NHGUC`.

### 4.5 Alert (nessuna azione automatica)

`classify` popola `alert[]` con oggetti `{ tipo, messaggio, azioneSuggerita }`:

- `polyoma` **oppure** `effettoTerapia` attivi, con categoria ∈ `{AUC, SHGUC, HGUC}`:
  `{ tipo: "confondente",
     messaggio: "Polyomavirus/decoy cells o effetto terapia segnalati: possibile mimica di HGUC. Il confondente può coesistere con carcinoma vero.",
     azioneSuggerita: "AUC" }`
  (per HGUC la `azioneSuggerita` resta comunque solo un suggerimento; nessun automatismo)
- `criteriParziali` con `ncRatio = >=0.7`: alert "considerare SHGUC secondo giudizio".
- `litiasi`: alert informativo, nessuna azione.
- campione strumentato con `papillareFibrovascolare`: promemoria (§4.4 punto 6).

### 4.6 Output di `classify`

```js
{
  categoria: "SHGUC",                 // categoria morfologica; una di:
                                      // NON_DIAGNOSTICO | NHGUC | AUC | SHGUC | HGUC | ALTRE_NEOPLASIE
  qualificatore: null,                // null | "LGUN"
  sogliaEffettiva: 5,                 // 5 o 10 (10 forzato se campione = alteVie)
  motivazione: [ "N/C >= 0.7", "ipercromasia + membrana irregolare",
                 "3 cellule (< soglia 5) -> SHGUC anziche HGUC" ],
  alert: [ { tipo: "confondente", messaggio: "...", azioneSuggerita: "AUC" } ],
  promemoria: []
}
```

### 4.7 Basi TPS 2022 e scelte di default

**Regole del sistema (fatti TPS 2022):**

- HGUC/SHGUC richiedono `N/C >= 0.7` **più** ipercromasia **più** almeno uno tra membrana
  irregolare e cromatina grossolana. L'N/C alto da solo non basta; l'ipercromasia è il
  criterio cardine.
- HGUC vs SHGUC è distinzione quantitativa/qualitativa: poche cellule o criteri incompleti → SHGUC.
- Il cutoff numerico (5–10) è deciso dal laboratorio; TPS non impone un numero.
- Polyomavirus/decoy cells è il mimic classico dell'HGUC; TPS raccomanda cautela esplicita.
- LGUN è "negative for HGUC": collocarla come qualificatore di `NHGUC` è coerente con TPS 2.0
  e con il suo scarso valore conclusivo in citologia.

**Scelte di default dell'app (etichettate come "default prudenziale, verificare con il
proprio laboratorio"):**

- `N/C >= 0.7` + `criteriParziali` → `AUC` con alert (non SHGUC automatico).
- `N/C >= 0.7` + `criteriAssenti` → `AUC` (non `NHGUC`).
- `sogliaLabBasseVie` default = `5`. `alteVie` sempre 10.
- Confondenti: solo alert, nessun declassamento automatico.

## 5. Referto — `buildReferto(input, result, scelte)`

Funzione pura: `buildReferto(input, classifyResult, { manualCategory, manualReason, applicaLGUN })`
→ stringa. Riceve anche `input` perché il paragrafo "Quadro citomorfologico" è
assemblato dagli assi inseriti. Nessun accesso al DOM.

### 5.1 Struttura

Allineata (2026-09-01) allo stile reale di reparto, verificato su referti effettivi
invece che su un'ipotesi di formato "a moduli": paragrafo narrativo, poi la riga
categoriale fissa, poi la Nota solo se c'è qualcosa da dire. Nessuna etichetta
`Campione:` / `Adeguatezza:` / `Quadro citomorfologico:` / `Categoria diagnostica:` —
il reparto non le scrive, e produrle avrebbe reso il testo da editare più lontano dal
referto finale, non più vicino.

```
<frase di adeguatezza, solo se c'è una limitazione da dichiarare> <quadro citomorfologico>

<CATEGORIA TPS IN FORMA ESTESA (SIGLA)> secondo The Paris System (TPS) 2022.
<se qualificatore LGUN applicato: riga "Qualificatore: neoplasia uroteliale di basso
 grado sospetta/presente — frammenti papillari con asse fibrovascolare; diagnosi
 definitiva istologica">

Nota:
  <solo se presenti alert / promemoria / riclassificazione manuale>
```

Decisione di reparto (2026-09-01, confermata dall'utente su due varianti realmente in
uso — vedi §5.2.1): riga categoriale in **Formato A** — sigla inline, "The Paris System
(TPS)" abbreviato, edizione **2022** di default. Scartata la variante a due righe senza
sigla con dicitura estesa tra virgolette (`Classificazione secondo "The Paris System for
Reporting Urinary Cytology"`), osservata anch'essa in referti reali ma non scelta come
standard. La ricerca CTM (`"Negativa/positiva la ricerca di CTM"`, vista in più referti
reali) resta fuori scope: è un esito ancillare non-TPS, testo libero aggiunto a mano.

### 5.2 Frasi chiave (template in `tps-data.js`)

La frase di adeguatezza dipende da `cellularitaAdeguata`, `oscuramento` **e** dalla
categoria **finale** del classificatore (`result.categoria`). A differenza della
versione precedente di questo documento, il caso "nessuna limitazione" non produce più
alcuna frase: i referti reali non dichiarano mai l'adeguatezza quando è scontata.

- categoria `NON_DIAGNOSTICO`, con `oscuramento = severo` o `oscuramentoCausa` indicata:
  *"Campione non valutabile per &lt;causa | 'elementi oscuranti'&gt;."*
- categoria `NON_DIAGNOSTICO`, per sola ipocellularità (nessun oscuramento):
  *"Campione non diagnostico per cellularità insufficiente."*
- `oscuramento = severo` + categoria `HGUC`/`SHGUC`:
  *"Campione limitato da &lt;causa&gt;, ma diagnostico per la presenza di cellule fortemente atipiche."*
- `oscuramento = moderato` (categoria valutabile):
  *"Valutabile, con limitazioni (&lt;causa&gt;)."*
- altrimenti: nessuna frase (stringa vuota, non concatenata).

Nota: dopo la regola 4, `oscuramento = severo` o `cellularitaAdeguata = false` implicano
già `NON_DIAGNOSTICO` salvo `HGUC`/`SHGUC` — quindi le categorie `AUC`/`NHGUC`/`LGUN`
compaiono solo con `oscuramento` ∈ `{assente-lieve, moderato}` e cellularità adeguata.

La riga categoriale è sempre `DATA.categoriaEstesa[categoria].toUpperCase() + ' ' +
DATA.fraseSecondoTPS` (`fraseSecondoTPS` = *"secondo The Paris System (TPS) 2022."*),
tranne per il qualificatore LGUN che resta in forma sentence-case (nota accessoria, non
la riga categoriale primaria).

#### 5.2.1 Fonte del confronto

Confronto fatto su due lotti di referti reali incollati in chat (2026-09-01), oltre a un
export di lista (formato BIFF2, non lo standard xls moderno) con diagnosi troncate.
Il primo lotto usava sistematicamente il Formato A; il secondo un formato alternativo a
due righe con edizione dichiarata in modo incoerente (`2016`, assente, mai `2022`) — da
cui la scelta esplicita di standardizzare, invece di dedurre un'unica convenzione
implicita dal materiale.

- Soglia alte vie:
  *"Per il campione da alte vie escretrici è stata applicata la soglia quantitativa TPS più restrittiva."*
- Riclassificazione manuale (`manualCategory` valorizzato e ≠ `result.categoria`) — deve
  risultare una scelta del citopatologo, neutra rispetto alla direzione (declassamento o
  elevazione):
  *"Su valutazione del citopatologo la categoria morfologica &lt;X&gt; è stata
  riclassificata manualmente in &lt;Y&gt; per la presenza di &lt;motivo&gt;."*
  La riga compare nel blocco **Nota**; la riga "Categoria diagnostica" riporta direttamente
  &lt;Y&gt; senza prefissi tipo "riclassificata".

### 5.3 Riclassificazione manuale (UI)

Lo stato manuale vive in `app.js`, non nel classificatore:

```js
manualCategory: null | "NHGUC" | "AUC" | "SHGUC" | "HGUC"
manualReason:   string        // es. "polyomavirus", "effetto terapia BCG"
```

- Quando `classify` restituisce un `alert` di tipo `confondente`, la UI mostra l'alert ad
  alta visibilità con un pulsante: **"Riclassifica manualmente come AUC per confondente
  morfologico"**. Il click imposta `manualCategory`/`manualReason`.
- `buildReferto` usa `manualCategory` se valorizzato, e aggiunge la frase §5.2 che rende
  tracciabile la modifica e cita la categoria morfologica iniziale.
- "Nuovo caso" azzera anche `manualCategory`/`manualReason`.

### 5.4 Composizione ed export

- Descrizione citomorfologica e frasi di adeguatezza: **template + valori** da `tps-data.js`.
  Nessun testo generato liberamente.
- Blocco **Nota**: presente solo se almeno una tra `result.alert`, `result.promemoria`,
  riclassificazione manuale, o `campione = alteVie` (frase soglia restrittiva).
- Referto in `<textarea>` editabile prima dell'export.
- Export: copia negli appunti **e** download `.txt`.
- **Nessun** blocco ROHM, gestione clinica o disclaimer nel testo esportato.

## 6. UI

- Colonna sinistra: form (§4.1) + impostazione `sogliaLabBasseVie`.
- Colonna destra: `categoria` (+ `qualificatore`), `motivazione`, `alert` ad alta
  visibilità con pulsante di riclassificazione manuale, `promemoria`, referto editabile,
  pulsanti Copia / Scarica.
- **"Nuovo caso"**: pulsante sempre visibile in alto; azzera form, referto e stato manuale.
- Toggle tema chiaro/scuro (persistito).
- Avvertenza "strumento di supporto" visibile in interfaccia.

## 7. Test — `tests/run.mjs`

`node tests/run.mjs` (via `npm test`). Importa `classifier.js` e `referto.js`. Exit code 0 = tutti passano.

### 7.1 `classify`

| # | Input sintetico | Atteso |
|---|---|---|
| 1 | N/C ≥0.7 + ipercromasia + membrana irreg. + `nCellule sottoSoglia` | `SHGUC` |
| 2 | come #1 ma `nCellule pariOSopraSoglia` | `HGUC` |
| 3 | N/C ≥0.7 + solo ipercromasia (`criteriParziali`) + `nCellule pariOSopraSoglia` | `AUC` + alert "considerare SHGUC" |
| 4 | N/C ≥0.7 + membrana irreg. + cromatina grossolana, **no** ipercromasia | `AUC` + alert |
| 5 | N/C 0.5-0.7 + 1 criterio | `AUC` |
| 6 | N/C ≥0.7 + `criteriAssenti` + `nCellule ≥1` | `AUC` (default) |
| 7 | N/C ≥0.7, `nCellule = 0` | `NHGUC` (regola 0) |
| 8 | #1 + `effettoTerapia` | `SHGUC` invariato + `alert` confondente con `azioneSuggerita: "AUC"` |
| 9 | #2 + `polyoma` | `HGUC` invariato + `alert` confondente |
| 10 | `papillareFibrovascolare` + `campione=spontanea` | `NHGUC`, `qualificatore = "LGUN"` |
| 11 | `papillareFibrovascolare` + `campione=washing` | `NHGUC`, `qualificatore = null`, promemoria |
| 12 | `campione=alteVie` + `criteriCompleti` + `ncRatio ≥0.7` + `nCellule` fra 5 e 9 | `SHGUC` (non `HGUC`), `sogliaEffettiva = 10` |
| 13 | come #12 ma `nCellule` ≥ 10 | `HGUC`, `sogliaEffettiva = 10` |
| 14 | `oscuramento=severo`, nessuna atipia | `NON_DIAGNOSTICO` |
| 15 | `oscuramento=severo` ma quadro #2 | `HGUC` (adeguato per definizione) |
| 16 | `oscuramento=moderato`, quadro normale | `NHGUC` (moderato non è inadeguatezza) |
| 17 | `nonUroteliale` + tipo "adenocarcinoma" | `ALTRE_NEOPLASIE` |
| 18 | N/C <0.5, `criteriAssenti` | `NHGUC` |
| 19 | `AUC` (#5) + `litiasi` | `AUC` + alert informativo litiasi |
| 20 | `oscuramento=severo` + `papillareFibrovascolare` | `NON_DIAGNOSTICO`, `qualificatore = null` (ND prevale su LGUN) |
| 21 | `cellularitaAdeguata=false` + `papillareFibrovascolare` | `NON_DIAGNOSTICO` (ND prevale su LGUN) |
| 22 | N/C ≥0.7 + `criteriAssenti` + `nCellule pariOSopraSoglia` | `AUC` (**non** `HGUC` — sicurezza) |
| 23 | `campione=cateterismo` + `papillareFibrovascolare` | `NHGUC`, `qualificatore = null`, promemoria |
| 24 | `campione=alteVie` + `papillareFibrovascolare` | `NHGUC`, `qualificatore = null`, promemoria (alte vie = strumentato) |
| 25 | `ncRatio` / `campione` fuori enum | `classify` lancia `RangeError` |
| 26 | `oscuramento=severo` + morfologia da AUC (N/C 0.5-0.7 + 1 criterio) | `NON_DIAGNOSTICO` (inadeguatezza prevale su AUC) |
| — | `classify(input)` non muta `input` | oggetto invariato dopo la chiamata |

### 7.2 `buildReferto`

| # | Scenario | Verifica |
|---|---|---|
| A | `HGUC`, oscuramento severo, cellule atipiche | contiene "diagnostico per la presenza di cellule fortemente atipiche" |
| B | `SHGUC` + `manualCategory="AUC"`, `manualReason="polyomavirus"` | riga categoriale = "CELLULE UROTELIALI ATIPICHE (AUC) secondo The Paris System (TPS) 2022."; nota di riclassificazione cita "SHGUC" |
| C | `NHGUC` + `qualificatore="LGUN"`, `applicaLGUN=true` | contiene riga qualificatore LGUN |
| D | `campione=alteVie` | contiene frase "soglia quantitativa TPS più restrittiva" |
| E | categoria semplice `NHGUC`, campione non-alteVie, nessun alert | blocco "Nota:" assente |
| F | `SHGUC` da `alteVie` sotto soglia (test classify #12) | referto contiene sia "SHGUC" sia la frase soglia alte vie |
| G | `manualCategory="AUC"` | riga categoriale = "AUC" senza "riclassificata"; frase "Su valutazione del citopatologo…" nel blocco Nota |
| H | `oscuramento=moderato`, categoria `NHGUC` | adeguatezza = "Valutabile, con limitazioni (…)"; **mai** "Adeguato per la valutazione" |
| I | `cellularitaAdeguata=false`, nessun oscuramento | adeguatezza = "Campione non diagnostico per cellularità insufficiente"; non attribuita a elementi oscuranti |
| J | `oscuramento=severo` + morfologia AUC + causa "sangue" | categoria `NON_DIAGNOSTICO`; riga categoriale = "NON DIAGNOSTICO/INADEGUATO (ND) secondo The Paris System (TPS) 2022."; adeguatezza = "Campione non valutabile per sangue" |
| L | `NHGUC` semplice | riga categoriale = "NEGATIVO PER CARCINOMA UROTELIALE DI ALTO GRADO (NHGUC) secondo The Paris System (TPS) 2022." verbatim (Formato A di reparto) |

## 8. Rischi e limiti

- **Errore ad alto costo**: l'app propone una categoria diagnostica. Mitigazioni: funzioni
  pure testate, nessun declassamento automatico, referto editabile a mano, scelte di
  default dichiarate come prudenziali e non vincolanti, riclassificazione manuale tracciata.
- L'utente è un citopatologo esperto (direttore di SC di Anatomia Patologica): i default
  prudenziali (criteri completi con ipercromasia obbligatoria, soglia sensibile per basse
  vie, soglia restrittiva forzata per alte vie) sono scelte di reparto dichiarate, non
  supplenza a una competenza mancante — restano comunque overridabili in sede di
  riclassificazione manuale.
- La granularità dell'input (3 livelli di N/C, 3 fasce di conteggio, 3 livelli di
  oscuramento) è una semplificazione: accettata per l'uso previsto (supporto, non sostituzione).
- LGUN da citologia è raramente conclusiva: resa come qualificatore di `NHGUC` con nota
  esplicita sul limite.
- I confondenti (polyoma, terapia) possono **coesistere** con carcinoma: l'app lo segnala
  esplicitamente e non declassa mai da sola.
