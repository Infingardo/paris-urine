;(function (root) {
  'use strict';

  var CATEGORIE = ['NON_DIAGNOSTICO', 'NHGUC', 'AUC', 'SHGUC', 'HGUC', 'ALTRE_NEOPLASIE'];

  var NC_VALIDI = { '<0.5': 1, '0.5-0.7': 1, '>=0.7': 1 };
  var NCEL_VALIDI = { '0': 1, sottoSoglia: 1, pariOSopraSoglia: 1 };
  var CAMPIONI_VALIDI = { spontanea: 1, cateterismo: 1, washing: 1, alteVie: 1 };
  var OSCURAMENTO_VALIDI = { 'assente-lieve': 1, moderato: 1, severo: 1 };

  // Rifiuta esplicitamente enum malformati: meglio un errore visibile che una
  // classificazione silenziosa verso la categoria più benigna. I campi assenti
  // (null/undefined) restano ammessi e ricadono sui default.
  function validaInput(input) {
    if (input.ncRatio != null && !NC_VALIDI[input.ncRatio])
      throw new RangeError('ncRatio non valido: ' + JSON.stringify(input.ncRatio));
    if (input.nCellule != null && !NCEL_VALIDI[input.nCellule])
      throw new RangeError('nCellule non valido: ' + JSON.stringify(input.nCellule));
    if (input.campione != null && !CAMPIONI_VALIDI[input.campione])
      throw new RangeError('campione non valido: ' + JSON.stringify(input.campione));
    if (input.oscuramento != null && !OSCURAMENTO_VALIDI[input.oscuramento])
      throw new RangeError('oscuramento non valido: ' + JSON.stringify(input.oscuramento));
  }

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
    return Number(input.sogliaLabBasseVie) === 10 ? 10 : 5;
  }

  function classify(input) {
    input = input || {};
    validaInput(input);

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

    // Senza popolazione atipica (nCellule = 0) i rami di alto grado e AUC non si applicano.
    var popolazioneAtipica = nCel !== '0';

    // Regole 2–3 — carcinoma uroteliale di alto grado. Richiedono N/C ≥ 0.7 + criteri completi.
    if (popolazioneAtipica && nc === '>=0.7' && crit === 'completi') {
      if (nCel === 'pariOSopraSoglia') {
        out.categoria = 'HGUC';
        out.motivazione.push('N/C ≥ 0.7', 'ipercromasia + (membrana irregolare o cromatina grossolana)',
          'cellule atipiche in numero pari o superiore alla soglia (' + soglia + ')');
      } else {
        out.categoria = 'SHGUC';
        out.motivazione.push('N/C ≥ 0.7', 'criteri nucleari completi',
          'cellule atipiche in numero inferiore alla soglia (' + soglia + ') → SHGUC anziché HGUC');
      }
    }

    // Regola 4 — non diagnostico: l'inadeguatezza (oscuramento severo o cellularità
    // insufficiente) prevale su AUC / NHGUC / LGUN, ma NON su SHGUC/HGUC — cellule
    // francamente maligne rendono il campione diagnostico per definizione.
    if (!out.categoria) {
      var severo = input.oscuramento === 'severo';
      var ipocellulare = input.cellularitaAdeguata === false;
      if (severo || ipocellulare) {
        out.categoria = 'NON_DIAGNOSTICO';
        out.motivazione.push(severo
          ? 'Valutazione compromessa da elementi oscuranti'
          : 'Cellularità insufficiente per la valutazione');
      }
    }

    // Regola 5 — cellule uroteliali atipiche (AUC). Richiede popolazione atipica.
    if (!out.categoria && popolazioneAtipica) {
      if (nc === '0.5-0.7' && crit !== 'assenti') {
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

    // Regola 6 — NHGUC con qualificatore LGUN. Solo campione spontaneo: nei campioni
    // strumentati (cateterismo, washing, alte vie) i frammenti papillari sono attesi
    // o artefattuali → promemoria descrittivo, non qualificatore diagnostico.
    if (!out.categoria && reperti.papillareFibrovascolare) {
      if (input.campione === 'spontanea') {
        out.categoria = 'NHGUC';
        out.qualificatore = 'LGUN';
        out.motivazione.push('Frammenti papillari con asse fibrovascolare in campione spontaneo');
      } else {
        out.promemoria.push('Frammenti papillari con asse fibrovascolare: reperto atteso o da correlare in campione strumentato, non qualificato come LGUN.');
      }
    }

    // Regola 7 — default
    if (!out.categoria) {
      out.categoria = 'NHGUC';
      out.motivazione.push('Assenza di criteri per AUC o categoria superiore');
    }

    return finalize(out, reperti);
  }

  // finalize: aggiunge SOLO alert — non modifica mai la categoria.
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

  var api = { CATEGORIE: CATEGORIE, criteriLevel: criteriLevel, sogliaEffettiva: sogliaEffettiva, classify: classify };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TPS = root.TPS || {}; for (var k in api) root.TPS[k] = api[k]; }
})(typeof self !== 'undefined' ? self : this);
