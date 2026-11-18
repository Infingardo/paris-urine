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
    var ip = caratteri.ipercromasia;
    if (ip === true || ip === 'severa') l.push(DATA.criterioLabel.ipercromasiaSevera);
    else if (ip === 'lieve') l.push(DATA.criterioLabel.ipercromasiaLieve);
    ['membranaIrregolare', 'cromatinaGrossolana'].forEach(function (k) {
      if (caratteri[k]) l.push(DATA.criterioLabel[k]);
    });
    return l;
  }

  // Concordanza: "si osserva X" con un solo criterio, "si osservano X e Y" con piu'.
  function siOsserva(list) {
    return (list.length === 1 ? 'si osserva ' : 'si osservano ') + join(list);
  }

  function paragrafoCitomorfologico(input, result) {
    // (a) Non diagnostico: nessuna descrizione citomorfologica. Un campione
    // dichiarato non valutabile non puo' essere descritto come privo di atipie;
    // resta solo la frase di adeguatezza.
    if (result.categoria === 'NON_DIAGNOSTICO') return '';

    var righe = [];
    if (input.oscuramentoCausa) righe.push('Fondo con ' + input.oscuramentoCausa + '.');

    // (b) Altre neoplasie: descrive le cellule neoplastiche non uroteliali invece
    // della popolazione uroteliale. N/C e criteri solo se c'e' una popolazione inserita.
    if (result.categoria === 'ALTRE_NEOPLASIE') {
      var fr = 'Presenza di cellule neoplastiche di natura non uroteliale' +
        (input.nonUrotelialeTipo ? ' (' + input.nonUrotelialeTipo + ')' : '');
      if ((input.nCellule || '0') !== '0') {
        var critN = frasiCaratteri(input.caratteri);
        fr += ', con rapporto N/C ' + DATA.ncLabel[input.ncRatio || '<0.5'] +
          (critN.length ? '; ' + siOsserva(critN) : '');
      }
      righe.push(fr + '.');
      return righe.join(' ');
    }

    if ((input.nCellule || '0') === '0') {
      righe.push('Non si osservano cellule uroteliali atipiche di rilievo.');
      return righe.join(' ');
    }

    // "Atipica" e il quantificatore "few"/"many" sono terminologia TPS specifica
    // dell'asse AUC/SHGUC/HGUC: usarli quando la categoria finale è NHGUC descrive
    // come sospetta una popolazione che il classificatore ha già escluso, e il
    // quantificatore "few/many" discrimina propriamente solo tra SHGUC e HGUC.
    var categoria = result.categoria;
    var asseAltoGrado = categoria === 'SHGUC' || categoria === 'HGUC';
    var atipica = asseAltoGrado || categoria === 'AUC';
    var crit = frasiCaratteri(input.caratteri);

    if (atipica) {
      righe.push('Popolazione uroteliale atipica con rapporto N/C ' +
        DATA.ncLabel[input.ncRatio || '<0.5'] +
        (crit.length ? '; ' + siOsserva(crit) : ' senza atipie nucleari di rilievo') + '.');
    } else if (crit.length) {
      // (c) NHGUC con criteri inseriti ma insufficienti per AUC: descrivere
      // quanto osservato, senza "atipica" e senza negarlo.
      righe.push('Popolazione uroteliale con ' +
        join(['rapporto N/C ' + DATA.ncLabel[input.ncRatio || '<0.5']].concat(crit)) +
        ', insufficiente per la categoria AUC; aspetti compatibili con modificazioni reattive.');
    } else {
      righe.push('Popolazione uroteliale esente da atipie nucleari significative (rapporto N/C ' +
        DATA.ncLabel[input.ncRatio || '<0.5'] + '), con aspetti compatibili con modificazioni reattive.');
    }

    if (asseAltoGrado) {
      righe.push(input.nCellule === 'pariOSopraSoglia'
        ? 'Le cellule diagnostiche sono numerose (“many” secondo TPS 2.0).'
        : 'Le cellule diagnostiche sono poche (“few” secondo TPS 2.0).');
      if (input.celluleDegenerate && categoria === 'SHGUC')
        righe.push('Le cellule diagnostiche presentano alterazioni degenerative/preservazione subottimale che ne limitano la valutazione.');
    }
    return righe.join(' ');
  }

  // Dipende da cellularità, oscuramento e categoria FINALE del classificatore.
  // Dopo la regola 4, un campione severamente oscurato o ipocellulare è già
  // NON_DIAGNOSTICO salvo cellule SHGUC/HGUC: qui distinguiamo solo la formulazione.
  function fraseAdeguatezza(input, result) {
    var causa = input.oscuramentoCausa || '';
    var severo = input.oscuramento === 'severo';

    if (result.categoria === 'NON_DIAGNOSTICO') {
      // "non valutabile per oscuranti" dipende SOLO da oscuramento === 'severo':
      // il testo libero in oscuramentoCausa non deve dirottare un ND da ipocellularità.
      return severo
        ? DATA.fraseNonValutabilePerOscuranti(causa)
        : DATA.fraseNonDiagnosticoPerCellularita;
    }
    if (severo && (result.categoria === 'HGUC' || result.categoria === 'SHGUC')) {
      return DATA.fraseLimitatoMaDiagnostico(causa);
    }
    if (input.oscuramento === 'moderato') return DATA.fraseValutabileConLimitazioni(causa);
    // Nessuna limitazione: l'adeguatezza non va dichiarata esplicitamente (stile referto interno).
    return '';
  }

  function buildReferto(input, result, scelte) {
    input = input || {}; result = result || {}; scelte = scelte || {};
    var manual = scelte.manualCategory || null;
    var categoriaEffettiva = manual || result.categoria;
    var applicaLGUN = scelte.applicaLGUN !== false;

    var L = [];
    var adeguatezza = fraseAdeguatezza(input, result);
    var quadro = paragrafoCitomorfologico(input, result);
    L.push([adeguatezza, quadro].filter(Boolean).join(' '));
    L.push('');

    var estesa = DATA.categoriaEstesa[categoriaEffettiva] || categoriaEffettiva;
    if (categoriaEffettiva === 'ALTRE_NEOPLASIE' && input.nonUrotelialeTipo) {
      estesa += ' (' + input.nonUrotelialeTipo + ')';
    }
    L.push(estesa.toUpperCase() + ' ' + DATA.fraseSecondoTPS);
    if (categoriaEffettiva === 'NHGUC' && result.qualificatore === 'LGUN' && applicaLGUN) {
      L.push(DATA.fraseQualificatoreLGUN);
    }

    // Blocco Nota
    var note = [];
    (result.promemoria || []).forEach(function (p) { note.push(p); });
    (result.alert || []).forEach(function (a) { note.push(a.messaggio); });
    if (manual && manual !== result.categoria) {
      note.push(DATA.fraseRiclassificaManuale(
        DATA.categoriaEstesa[result.categoria] || result.categoria,
        DATA.categoriaEstesa[manual] || manual,
        scelte.manualReason));
    }
    if (input.campione === 'alteVie') note.push(DATA.fraseSogliaAlteVie);

    if (note.length) {
      L.push('');
      L.push('Nota:');
      note.forEach(function (n) { L.push('  ' + n); });
    }

    return L.join('\n');
  }

  // Motivo tracciato in Nota quando si accetta l'azione suggerita da un alert.
  // (Spostato da app.js senza cambiarne il comportamento, per poterlo testare.)
  function motivoRiclassifica(alert, input) {
    if (alert.tipo === 'confondente')
      return (input.reperti || {}).polyoma ? 'polyomavirus/decoy cells' : 'effetto terapia';
    return (DATA.motivoAlert && DATA.motivoAlert[alert.tipo]) || '';
  }

  // Una riclassificazione manuale nasce da un alert preciso su una categoria
  // morfologica precisa. Resta valida solo finche' il classificatore produce
  // ancora la stessa categoria e lo stesso alert, con la stessa azione e lo
  // stesso motivo; altrimenti va annullata, per non firmare una categoria
  // scelta su un quadro che non esiste piu'.
  // scelta = { manualCategory, manualReason, origine, alertTipo }
  function sceltaManualeValida(scelta, input, result) {
    if (!scelta || !scelta.manualCategory) return false;
    if (scelta.origine !== result.categoria) return false;
    return (result.alert || []).some(function (a) {
      return a.tipo === scelta.alertTipo &&
        a.azioneSuggerita === scelta.manualCategory &&
        motivoRiclassifica(a, input) === (scelta.manualReason || '');
    });
  }

  var api = { buildReferto: buildReferto, motivoRiclassifica: motivoRiclassifica, sceltaManualeValida: sceltaManualeValida };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TPS = root.TPS || {}; for (var k in api) root.TPS[k] = api[k]; }
})(typeof self !== 'undefined' ? self : this);
