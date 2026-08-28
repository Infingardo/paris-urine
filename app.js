;(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LS_TEMA = 'paris.tema', LS_SOGLIA = 'paris.sogliaBasseVie';

  var stato = { manualCategory: null, manualReason: '' };

  // ── Tema ───────────────────────────────────────────────
  function applicaTema(t) {
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
    try { localStorage.setItem(LS_TEMA, t); } catch (e) {}
  }
  applicaTema((function () { try { return localStorage.getItem(LS_TEMA) || 'light'; } catch (e) { return 'light'; } })());
  $('theme-toggle').addEventListener('click', function () {
    applicaTema(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  // ── Impostazione soglia (persistita) ──────────────────
  try {
    var s = localStorage.getItem(LS_SOGLIA);
    if (s) $('sogliaLabBasseVie').value = s;
  } catch (e) {}
  $('sogliaLabBasseVie').addEventListener('change', function () {
    try { localStorage.setItem(LS_SOGLIA, $('sogliaLabBasseVie').value); } catch (e) {}
    aggiorna();
  });

  // ── Lettura form → input per classify ─────────────────
  function leggiInput() {
    return {
      campione: $('campione').value,
      cellularitaAdeguata: $('cellularitaAdeguata').checked,
      oscuramento: $('oscuramento').value,
      oscuramentoCausa: $('oscuramentoCausa').value.trim(),
      ncRatio: $('ncRatio').value,           // i value dell'option sono già '<0.5' / '0.5-0.7' / '>=0.7'
      caratteri: {
        ipercromasia: $('car-ipercromasia').checked,
        membranaIrregolare: $('car-membrana').checked,
        cromatinaGrossolana: $('car-cromatina').checked
      },
      sogliaLabBasseVie: parseInt($('sogliaLabBasseVie').value, 10),
      nCellule: $('nCellule').value,
      reperti: {
        papillareFibrovascolare: $('rep-papillare').checked,
        squamoseAtipiche: $('rep-squamose').checked,
        ghiandolariAtipiche: $('rep-ghiandolari').checked,
        nonUroteliale: $('rep-nonuroteliale').checked,
        polyoma: $('rep-polyoma').checked,
        effettoTerapia: $('rep-terapia').checked,
        litiasi: $('rep-litiasi').checked
      },
      nonUrotelialeTipo: $('nonUrotelialeTipo').value.trim()
    };
  }

  // ── Vincolo UI: nCellule=0 incompatibile con criteri nucleari ──
  function sincronizzaVincoli(input) {
    var qualcheCriterio = input.caratteri.ipercromasia || input.caratteri.membranaIrregolare || input.caratteri.cromatinaGrossolana;
    if (qualcheCriterio && $('nCellule').value === '0') {
      $('nCellule').value = 'sottoSoglia';
      return true;
    }
    return false;
  }

  function etichettaSoglia(input) {
    var soglia = input.campione === 'alteVie' ? 10 : input.sogliaLabBasseVie;
    $('hint-soglia').textContent = 'Soglia effettiva: ' + soglia + ' cellule' +
      (input.campione === 'alteVie' ? ' (fissata per le alte vie)' : '');
    $('nCellule').options[1].textContent = '1 – ' + (soglia - 1);
    $('nCellule').options[2].textContent = '≥ ' + soglia;
  }

  function hintCampione(input) {
    $('hint-campione').textContent = (input.campione === 'cateterismo' || input.campione === 'washing')
      ? 'Campione strumentato: aggregati uroteliali benigni e frammenti papillari attesi, non sovrastimare.'
      : '';
  }

  // ── Render risultato ─────────────────────────────────
  function render(input, result) {
    var estesa = TPS_DATA.categoriaEstesa[stato.manualCategory || result.categoria] || (stato.manualCategory || result.categoria);
    $('risultato-categoria').textContent = estesa;
    if (result.qualificatore === 'LGUN' && !stato.manualCategory) {
      var b = document.createElement('span'); b.className = 'badge'; b.textContent = 'qualificatore LGUN';
      $('risultato-categoria').appendChild(b);
    }

    var ul = $('risultato-motivazione'); ul.innerHTML = '';
    result.motivazione.forEach(function (m) { var li = document.createElement('li'); li.textContent = m; ul.appendChild(li); });

    var ab = $('risultato-alert'); ab.innerHTML = '';
    result.alert.forEach(function (a) {
      var d = document.createElement('div');
      d.className = 'alert' + (a.tipo === 'confondente' ? ' confondente' : '');
      d.textContent = a.messaggio;
      if (a.tipo === 'confondente' && !stato.manualCategory) {
        var btn = document.createElement('button');
        btn.textContent = 'Riclassifica manualmente come AUC per confondente morfologico';
        btn.addEventListener('click', function () {
          stato.manualCategory = 'AUC';
          stato.manualReason = input.reperti.polyoma ? 'polyomavirus/decoy cells' : 'effetto terapia';
          aggiorna();
        });
        d.appendChild(document.createElement('br'));
        d.appendChild(btn);
      }
      ab.appendChild(d);
    });
    if (stato.manualCategory) {
      var undo = document.createElement('button');
      undo.textContent = 'Annulla riclassificazione manuale';
      undo.addEventListener('click', function () { stato.manualCategory = null; stato.manualReason = ''; aggiorna(); });
      ab.appendChild(undo);
    }

    var pb = $('risultato-promemoria'); pb.innerHTML = '';
    result.promemoria.forEach(function (p) { var d = document.createElement('div'); d.className = 'alert'; d.textContent = p; pb.appendChild(d); });
  }

  // ── Ciclo di aggiornamento ───────────────────────────
  function aggiorna() {
    var input = leggiInput();
    if (sincronizzaVincoli(input)) input = leggiInput();
    etichettaSoglia(input);
    hintCampione(input);
    var result = TPS.classify(input);
    render(input, result);
    $('referto').value = TPS.buildReferto(input, result, {
      manualCategory: stato.manualCategory,
      manualReason: stato.manualReason,
      applicaLGUN: true
    });
  }

  // ── Eventi ───────────────────────────────────────────
  ['campione','cellularitaAdeguata','oscuramento','oscuramentoCausa','ncRatio',
   'car-ipercromasia','car-membrana','car-cromatina','nCellule',
   'rep-papillare','rep-squamose','rep-ghiandolari','rep-nonuroteliale','rep-polyoma','rep-terapia','rep-litiasi',
   'nonUrotelialeTipo'].forEach(function (id) {
    var el = $(id);
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', aggiorna);
  });

  $('btn-nuovo-caso').addEventListener('click', function () {
    $('form-panel').querySelectorAll('input[type=text]').forEach(function (i) { i.value = ''; });
    $('form-panel').querySelectorAll('input[type=checkbox]').forEach(function (c) { c.checked = c.id === 'cellularitaAdeguata'; });
    $('campione').value = 'spontanea';
    $('oscuramento').value = 'assente-lieve';
    $('ncRatio').value = '<0.5';
    $('nCellule').value = '0';
    stato.manualCategory = null; stato.manualReason = '';
    aggiorna();
  });

  $('btn-copia').addEventListener('click', function () {
    navigator.clipboard.writeText($('referto').value).then(function () {
      $('btn-copia').textContent = 'Copiato ✓';
      setTimeout(function () { $('btn-copia').textContent = 'Copia negli appunti'; }, 1500);
    });
  });

  $('btn-scarica').addEventListener('click', function () {
    var blob = new Blob([$('referto').value], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'referto-citologia-urinaria.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });

  aggiorna();
})();
