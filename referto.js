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
    if (input.oscuramentoCausa) righe.push('Fondo con ' + input.oscuramentoCausa + '.');

    if ((input.nCellule || '0') === '0') {
      righe.push('Non si osservano cellule uroteliali atipiche di rilievo.');
    } else {
      var crit = frasiCaratteri(input.caratteri);
      righe.push('Popolazione uroteliale atipica con rapporto N/C ' +
        DATA.ncLabel[input.ncRatio || '<0.5'] +
        (crit.length ? '; si osservano ' + join(crit) : ' senza atipie nucleari di rilievo') + '.');
      righe.push('Il numero di cellule atipiche è ' +
        (input.nCellule === 'pariOSopraSoglia' ? 'pari o superiore' : 'inferiore') +
        ' alla soglia quantitativa applicata (' + result.sogliaEffettiva + ' cellule).');
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

  var api = { buildReferto: buildReferto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TPS = root.TPS || {}; root.TPS.buildReferto = buildReferto; }
})(typeof self !== 'undefined' ? self : this);
