# Citologia urinaria — Sistema di Parigi (TPS 2022)

App web a pagina singola (HTML/CSS/JavaScript, nessuna dipendenza) per la categorizzazione
citologica secondo il Sistema di Parigi 2ª edizione (2022) e la generazione del referto.

Asse clinico: **alto grado vs non alto grado** (rule-out del carcinoma uroteliale di alto grado).

La versione 0.3 applica la regola TPS 2.0 di almeno due fra i tre criteri nucleari,
senza rendere obbligatoria l'ipercromasia. La distinzione SHGUC/HGUC usa “poche”
versus “molte” cellule diagnostiche e non un cutoff numerico rigido; la decisione deve
integrare intensità dell'atipia, tipo di campione e contesto clinico.

La versione 0.3.1 corregge il testo del referto per gli esiti negativi: "atipica" e il
quantificatore "poche/molte" sono terminologia TPS specifica dell'asse AUC/SHGUC/HGUC,
non descrittori generici — un caso NHGUC non li usa più.

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
