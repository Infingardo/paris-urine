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
