;(function (root) {
  'use strict';

  var CATEGORIE = ['NON_DIAGNOSTICO', 'NHGUC', 'AUC', 'SHGUC', 'HGUC', 'ALTRE_NEOPLASIE'];

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
    return input.sogliaLabBasseVie === 10 ? 10 : 5;
  }

  var api = { CATEGORIE: CATEGORIE, criteriLevel: criteriLevel, sogliaEffettiva: sogliaEffettiva };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TPS = root.TPS || {}; for (var k in api) root.TPS[k] = api[k]; }
})(typeof self !== 'undefined' ? self : this);
