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

  // Dipende da cellularità, oscuramento e categoria FINALE del classificatore.
  // Dopo la regola 4, un campione severamente oscurato o ipocellulare è già
  // NON_DIAGNOSTICO salvo cellule SHGUC/HGUC: qui distinguiamo solo la formulazione.
  function fraseAdeguatezza(input, result) {
    var causa = input.oscuramentoCausa || '';
    var severo = input.oscuramento === 'severo';

    if (result.categoria === 'NON_DIAGNOSTICO') {
      return (severo || causa)
        ? DATA.fraseNonValutabilePerOscuranti(causa)
        : DATA.fraseNonDiagnosticoPerCellularita;
    }
    if (severo && (result.categoria === 'HGUC' || result.categoria === 'SHGUC')) {
      return DATA.fraseLimitatoMaDiagnostico(causa);
    }
    if (input.oscuramento === 'moderato') return DATA.fraseValutabileConLimitazioni(causa);
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
    L.push('Adeguatezza: ' + fraseAdeguatezza(input, result));
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
