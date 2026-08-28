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
