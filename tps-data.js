;(function (root) {
  'use strict';

  var TPS_DATA = {
    // Fonte unica della versione. Deve restare allineata a package.json, ai
    // parametri ?v= degli script in index.html e a VERSION in sw.js: il test
    // 'coerenza versione' in tests/run.mjs fallisce se divergono.
    versione: '0.2.0',
    categoriaEstesa: {
      NON_DIAGNOSTICO: 'Non diagnostico/inadeguato (ND)',
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
      '<0.5': '< 0,5',
      '0.5-0.7': '0,5–0,7',
      '>=0.7': '≥ 0,7'
    },
    criterioLabel: {
      ipercromasia: 'ipercromasia',
      membranaIrregolare: 'membrana nucleare irregolare',
      cromatinaGrossolana: 'cromatina grossolana'
    },
    // Formula fissa di chiusura della categoria diagnostica (stile referto interno).
    fraseSecondoTPS: 'secondo The Paris System (TPS) 2022.',
    // Adeguatezza
    fraseNonValutabilePerOscuranti: function (causa) {
      return 'Campione non valutabile' + (causa ? ' per ' + causa : ' per elementi oscuranti') + '.';
    },
    fraseNonDiagnosticoPerCellularita: 'Campione non diagnostico per cellularità insufficiente.',
    fraseLimitatoMaDiagnostico: function (causa) {
      return 'Campione limitato da ' + (causa || 'elementi oscuranti') +
        ', ma diagnostico per la presenza di cellule fortemente atipiche.';
    },
    fraseValutabileConLimitazioni: function (causa) {
      return 'Valutabile, con limitazioni' + (causa ? ' (' + causa + ')' : '') + '.';
    },
    // Note
    fraseSogliaAlteVie: 'Per il campione da alte vie escretrici è stata applicata la soglia quantitativa TPS più restrittiva.',
    fraseQualificatoreLGUN: 'Qualificatore: quadro compatibile con neoplasia uroteliale papillare di basso grado ' +
      '(frammenti papillari con asse fibrovascolare); la diagnosi definitiva è istologica.',
    // Motivo tracciato nel referto quando si accetta l'azione suggerita da un alert.
    motivoAlert: {
      criteriParziali: 'atipia ritenuta marcata alla revisione',
      confondente: 'confondente morfologico'
    },
    fraseRiclassificaManuale: function (morfologicaEstesa, sceltaEstesa, motivo) {
      return 'Su valutazione del citopatologo la categoria morfologica ' + morfologicaEstesa +
        ' è stata riclassificata manualmente in ' + sceltaEstesa +
        (motivo ? ' per la presenza di ' + motivo : '') + '.';
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TPS_DATA;
  else root.TPS_DATA = TPS_DATA;
})(typeof self !== 'undefined' ? self : this);
