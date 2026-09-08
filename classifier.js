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
  // completi = almeno due dei tre criteri TPS 2.0. L'ipercromasia non e'
  // obbligatoria: esistono HGUC ipo-/normocromatici.
  function criteriLevel(caratteri) {
    caratteri = caratteri || {};
    var iper = !!caratteri.ipercromasia;
    var memb = !!caratteri.membranaIrregolare;
    var crom = !!caratteri.cromatinaGrossolana;
    if (!iper && !memb && !crom) return 'assenti';
    if (Number(iper) + Number(memb) + Number(crom) >= 2) return 'completi';
    return 'parziali';
  }

  function classify(input) {
    input = input || {};
    validaInput(input);

    var caratteri = input.caratteri || {};
    var reperti = input.reperti || {};
    var crit = criteriLevel(caratteri);
    var nCel = input.nCellule || '0';
    var nc = input.ncRatio || '<0.5';

    var out = {
      categoria: null,
      qualificatore: null,
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

    // Regole 2–3 — asse di alto grado. TPS 2.0 non sostiene un cutoff numerico
    // rigido: SHGUC = poche cellule diagnostiche; HGUC = molte cellule diagnostiche.
    if (popolazioneAtipica && nc === '>=0.7' && crit === 'completi') {
      if (nCel === 'pariOSopraSoglia') {
        out.categoria = 'HGUC';
        out.motivazione.push('N/C ≥ 0.7', 'ipercromasia + (membrana irregolare o cromatina grossolana)',
          'numerose cellule diagnostiche (“many” secondo TPS 2.0)');
      } else {
        out.categoria = 'SHGUC';
        out.motivazione.push('N/C ≥ 0.7', 'criteri nucleari completi',
          'poche cellule diagnostiche (“few” secondo TPS 2.0) → SHGUC anziché HGUC');
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
        out.promemoria.push('N/C elevato isolato: non sufficiente per AUC; escludere cellule basali, strumentazione e degenerazione.');
      }
    }

    // Regola 6 — LGUN non e' piu' una categoria autonoma in TPS 2.0. Un autentico
    // asse fibrovascolare con cellule blande puo' essere segnalato sotto NHGUC anche
    // nei campioni strumentati, con la dovuta cautela morfologico-clinica.
    if (!out.categoria && reperti.papillareFibrovascolare) {
      out.categoria = 'NHGUC';
      out.qualificatore = 'LGUN';
      out.motivazione.push('Frammenti papillari con autentico asse fibrovascolare e citologia di basso grado');
      if (input.campione !== 'spontanea')
        out.promemoria.push('Campione strumentato: distinguere un autentico asse fibrovascolare dagli aggregati papillaroidi da strumentazione e correlare con il quadro endoscopico.');
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

    if (reperti.squamoseAtipiche)
      out.promemoria.push('Cellule squamose atipiche: descrivere separatamente; non includere nella categoria AUC.');
    if (reperti.ghiandolariAtipiche)
      out.promemoria.push('Cellule ghiandolari atipiche: descrivere separatamente; non includere nella categoria AUC.');

    return out;
  }

  var api = { CATEGORIE: CATEGORIE, criteriLevel: criteriLevel, classify: classify };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TPS = root.TPS || {}; for (var k in api) root.TPS[k] = api[k]; }
})(typeof self !== 'undefined' ? self : this);
