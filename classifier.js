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

  function classify(input) {
    input = input || {};
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

    // Regola 0 — senza popolazione atipica, le regole 2–4 non si applicano
    var popolazioneAtipica = nCel !== '0';

    if (popolazioneAtipica) {
      if (nc === '>=0.7' && crit === 'completi' && nCel === 'pariOSopraSoglia') {
        out.categoria = 'HGUC';
        out.motivazione.push('N/C ≥ 0.7', 'ipercromasia + (membrana irregolare o cromatina grossolana)',
          'cellule atipiche in numero pari o superiore alla soglia (' + soglia + ')');
      } else if (nc === '>=0.7' && crit === 'completi' && nCel === 'sottoSoglia') {
        out.categoria = 'SHGUC';
        out.motivazione.push('N/C ≥ 0.7', 'criteri nucleari completi',
          'cellule atipiche in numero inferiore alla soglia (' + soglia + ') → SHGUC anziché HGUC');
      } else if (nc === '0.5-0.7' && crit !== 'assenti') {
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

    // Le regole 5–7 arrivano nel Task 4. Per ora: se nessuna categoria, NHGUC provvisorio.
    if (!out.categoria) {
      out.categoria = 'NHGUC';
      out.motivazione.push('Assenza di criteri per AUC o categoria superiore');
    }

    return finalize(out, reperti);
  }

  // finalize: aggiunge gli alert che non cambiano mai la categoria (Task 5 li completa).
  function finalize(out, reperti) {
    return out;
  }

  var api = { CATEGORIE: CATEGORIE, criteriLevel: criteriLevel, sogliaEffettiva: sogliaEffettiva, classify: classify };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TPS = root.TPS || {}; for (var k in api) root.TPS[k] = api[k]; }
})(typeof self !== 'undefined' ? self : this);
