/* OrienRun Admin – noyau, balises, cartes, parcours */
(function () {
  'use strict';
  const O = window.ORUN, $ = id => document.getElementById(id);
  const A = window.A = { VERSION: '2.3', O, $, base: null, runs: [], tabs: [], cur: 'balises', map: null };

  A.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const esc = A.esc;
  A.toast = (msg, ms) => { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(A.toast.t); A.toast.t = setTimeout(() => t.classList.remove('show'), ms || 2600); };
  const toast = A.toast;

  /* ---------- Stockage IndexedDB ---------- */
  let dbp;
  function db() {
    return dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('orienrun_admin', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
  }
  A.kvGet = async k => { try { const d = await db(); return await new Promise((res, rej) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch (e) { return null; } };
  A.kvSet = async (k, v) => { try { const d = await db(); await new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { toast('⚠ Sauvegarde locale impossible : ' + e.message, 5000); } };
  A.save = () => A.kvSet('base', A.base);
  A.saveRuns = () => A.kvSet('runs', A.runs);
  const newBase = () => ({ app: 'orienrun', v: 1, id: O.uid(), nom: 'Ma base de balises', seuilGPS: O.CFG.seuilGPS || 5, cartes: [], balises: [], parcours: [] });

  /* ---------- Utilitaires ---------- */
  A.num = v => { const n = parseFloat(String(v).replace(',', '.').trim()); return isFinite(n) ? n : null; };
  A.carte = id => A.base.cartes.find(c => c.id === id);
  A.carteNom = id => { const c = A.carte(id); return c ? (c.nom || 'Carte ' + c.numero) : '—'; };
  A.download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); };
  A.dlXlsx = (wb, name) => A.download(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
  A.randCode = () => {
    const used = new Set(A.base.balises.map(b => String(b.code)));
    if (used.size >= 10000) return '0000';
    let c; do { c = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); } while (used.has(c)); return c;
  };
  A.modal = (html, wide, onMount) => {
    $('ov').innerHTML = '<div class="overlay"><div class="modal' + (wide ? ' wide' : '') + '">' + html + '</div></div>';
    if (onMount) onMount($('ov').querySelector('.modal'));
  };
  A.closeModal = () => { if (A.mmap) { A.mmap.remove(); A.mmap = null; } $('ov').innerHTML = ''; };
  A.mapLayers = (map, extra, def, overlays) => {
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: 'Carte © OpenTopoMap (CC-BY-SA) · données © OpenStreetMap' });
    (def === 'osm' ? osm : topo).addTo(map);
    const ctl = Object.assign({ 'Topographique (OpenTopoMap)': topo, 'OpenStreetMap': osm }, extra || {});
    L.control.layers(ctl, overlays || null, { collapsed: true }).addTo(map);
  };
  A.imgOverlay = c => c && c.image && c.image.dataUrl && c.image.bounds ? L.imageOverlay(c.image.dataUrl, [[c.image.bounds.s, c.image.bounds.o], [c.image.bounds.n, c.image.bounds.e]], { opacity: .85 }) : null;

  /* ---------- Navigation ---------- */
  A.addTab = (id, label, render) => A.tabs.push({ id, label, render });
  A.render = () => {
    $('tabs').innerHTML = A.tabs.map(t => '<button class="tab' + (t.id === A.cur ? ' on' : '') + '" data-t="' + t.id + '">' + t.label + '</button>').join('');
    if (A.map) { A.map.remove(); A.map = null; }
    const t = A.tabs.find(x => x.id === A.cur) || A.tabs[0]; t.render($('view'));
  };
  $('tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) { A.cur = t.dataset.t; A.render(); } });
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) A.closeModal(); });

  /* ====================================================================
     BALISES
     ==================================================================== */
  const COULEURS = ['Jaune', 'Bleu', 'Rouge'];
  let fb = { couleur: '', carte: '', q: '' }, selB = new Set();
  A.addTab('balises', '1 · Balises', v => {
    const b = A.base;
    const list = b.balises.filter(x => (!fb.couleur || x.couleur === fb.couleur) && (!fb.carte || x.carteId === fb.carte) && (!fb.q || (x.identifiant + ' ' + x.code).toLowerCase().includes(fb.q.toLowerCase())));
    const dupCodes = {}; b.balises.forEach(x => dupCodes[x.code] = (dupCodes[x.code] || 0) + 1);
    v.innerHTML =
      '<div class="card"><h3>Référentiel de balises (' + b.balises.length + ')</h3>' +
      '<div class="bar"><button class="btn sm" data-a="add">➕ Ajouter une balise</button><button class="btn sec sm" data-a="rand">🎲 Codes aléatoires</button><button class="btn sec sm" data-a="kml">📥 Importer un KML</button><button class="btn sec sm" data-a="tab">📥 Importer un tableau (.xlsx / .csv)</button></div>' +
      '<div class="bar"><select class="grow" id="fbC"><option value="">Toutes couleurs</option>' + COULEURS.map(c => '<option' + (fb.couleur === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select>' +
      '<select class="grow" id="fbK"><option value="">Toutes cartes</option>' + b.cartes.map(c => '<option value="' + c.id + '"' + (fb.carte === c.id ? ' selected' : '') + '>' + esc(c.nom || 'Carte ' + c.numero) + '</option>').join('') + '</select>' +
      '<input class="grow" id="fbQ" placeholder="Rechercher…" value="' + esc(fb.q) + '"></div>' +
      (selB.size ? '<div class="info"><div class="bar" style="margin:0"><b>' + selB.size + ' sélectionnée(s)</b><select id="sC" class="grow"><option value="">Carte à affecter…</option>' + b.cartes.map(c => '<option value="' + c.id + '">' + esc(c.nom || 'Carte ' + c.numero) + '</option>').join('') + '<option value="-">(aucune carte)</option></select><button class="btn sm" data-a="batch">Affecter</button><button class="btn dng sm" data-a="batchdel">Supprimer</button><button class="btn sec sm" data-a="unsel">Désélectionner</button></div></div>' : '') +
      (b.balises.length ? '<div class="tw"><table><tr><th><input type="checkbox" id="sAll" style="width:auto" title="Tout sélectionner (liste filtrée)"' + (list.length && list.every(x => selB.has(x.id)) ? ' checked' : '') + '></th><th>Couleur</th><th>Identifiant</th><th>Code</th><th>Latitude</th><th>Longitude</th><th>Carte</th><th></th></tr>' +
        list.map(x => '<tr><td><input type="checkbox" class="sRow" data-id="' + x.id + '" style="width:auto"' + (selB.has(x.id) ? ' checked' : '') + '></td><td><i class="cdot ' + x.couleur + '"></i>' + x.couleur + '</td><td><b>' + esc(x.identifiant) + '</b></td><td class="code">' + esc(x.code) + (dupCodes[x.code] > 1 ? ' <span title="Code en double" style="color:var(--wa)">⚠</span>' : '') + '</td><td>' + (x.lat != null ? x.lat.toFixed(6) : '<span class="err">?</span>') + '</td><td>' + (x.lon != null ? x.lon.toFixed(6) : '') + '</td><td>' + esc(A.carteNom(x.carteId)) + '</td><td class="act"><button data-a="edit" data-id="' + x.id + '" title="Modifier">✏️</button><button data-a="del" data-id="' + x.id + '" title="Supprimer">🗑</button></td></tr>').join('') + '</table></div>'
        : '<div class="empty">Aucune balise pour l\'instant. Ajoute-les une à une, ou importe un fichier KML (Google Earth / My Maps).</div>') +
      '</div>';
    $('fbC').onchange = e => { fb.couleur = e.target.value; A.render(); };
    $('fbK').onchange = e => { fb.carte = e.target.value; A.render(); };
    $('fbQ').oninput = e => { fb.q = e.target.value; clearTimeout(fb.t); fb.t = setTimeout(() => { A.render(); const i = $('fbQ'); i.focus(); i.setSelectionRange(99, 99); }, 350); };
    v.onchange = e => {
      if (e.target.id === 'sAll') { list.forEach(x => e.target.checked ? selB.add(x.id) : selB.delete(x.id)); A.render(); }
      else if (e.target.classList.contains('sRow')) { e.target.checked ? selB.add(e.target.dataset.id) : selB.delete(e.target.dataset.id); A.render(); }
    };
    v.onclick = e => {
      const bt = e.target.closest('[data-a]'); if (!bt) return; const a = bt.dataset.a, id = bt.dataset.id;
      if (a === 'batch') { const c = $('sC').value; if (!c) return toast('Choisis une carte'); selB.forEach(i => { const x = A.base.balises.find(q => q.id === i); if (x) x.carteId = c === '-' ? '' : c; }); toast(selB.size + ' balise(s) affectée(s)'); selB.clear(); A.save(); A.render(); }
      else if (a === 'batchdel') { if (confirm('Supprimer les ' + selB.size + ' balises sélectionnées ?')) { A.base.balises = A.base.balises.filter(x => !selB.has(x.id)); A.base.parcours.forEach(p => p.balises = p.balises.filter(i => !selB.has(i))); selB.clear(); A.save(); A.render(); } }
      else if (a === 'unsel') { selB.clear(); A.render(); }
      else if (a === 'add') editBalise(); else if (a === 'edit') editBalise(id);
      else if (a === 'del') delBalise(id); else if (a === 'rand') randCodes(); else if (a === 'kml') importKml(); else if (a === 'tab') importTable();
    };
  });

  function delBalise(id) {
    const x = A.base.balises.find(b => b.id === id); if (!x) return;
    const used = A.base.parcours.filter(p => p.balises.includes(id));
    if (!confirm('Supprimer la balise ' + x.identifiant + (used.length ? ' ? Elle sera retirée de ' + used.length + ' parcours (' + used.map(p => p.code).join(', ') + ').' : ' ?'))) return;
    A.base.balises = A.base.balises.filter(b => b.id !== id);
    A.base.parcours.forEach(p => p.balises = p.balises.filter(i => i !== id));
    A.save(); A.render();
  }
  function randCodes() {
    const sans = A.base.balises.filter(b => !/^\d{4}$/.test(b.code || ''));
    const all = confirm('OK = régénérer TOUS les codes (' + A.base.balises.length + ' balises)\nAnnuler = attribuer seulement aux balises sans code (' + sans.length + ')');
    const cible = all ? A.base.balises : sans;
    if (all) { const keep = A.base.balises.slice(); keep.forEach(b => b.code = ''); }
    cible.forEach(b => b.code = A.randCode());
    A.save(); A.render(); toast(cible.length + ' code(s) attribué(s)');
  }

  function editBalise(id, draft) {
    const x0 = id ? A.base.balises.find(b => b.id === id) : { couleur: 'Jaune', identifiant: '', code: '', lat: null, lon: null, carteId: fb.carte || (A.base.cartes[0] || {}).id || '' };
    const x = Object.assign({}, x0, draft || {});
    A.modal('<h3>' + (id ? 'Modifier' : 'Nouvelle') + ' balise</h3>' +
      '<div class="field"><label>Couleur (niveau)</label><select id="eC">' + COULEURS.map(c => '<option' + (x.couleur === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Identifiant (libre)</label><input id="eI" value="' + esc(x.identifiant) + '" placeholder="Ex : J12"></div>' +
      '<div class="field"><label>Code à 4 chiffres</label><div class="row"><input id="eK" inputmode="numeric" maxlength="4" value="' + esc(x.code) + '"><button class="btn sec sm" id="eR" type="button" style="flex:0 0 auto">🎲 Aléatoire</button></div></div>' +
      '<div class="grid2"><div class="field"><label>Latitude</label><input id="eLa" inputmode="decimal" value="' + (x.lat != null ? x.lat : '') + '"></div><div class="field"><label>Longitude</label><input id="eLo" inputmode="decimal" value="' + (x.lon != null ? x.lon : '') + '"></div></div>' +
      '<div class="row nogrow" style="margin-bottom:12px"><button class="btn sec sm" id="eG" type="button">📍 Ma position</button><button class="btn sec sm" id="eM" type="button">🗺️ Choisir sur la carte</button></div>' +
      '<div class="field"><label>Carte</label><select id="eCa"><option value="">—</option>' + A.base.cartes.map(c => '<option value="' + c.id + '"' + (x.carteId === c.id ? ' selected' : '') + '>' + esc(c.nom || 'Carte ' + c.numero) + '</option>').join('') + '</select></div>' +
      '<div class="err" id="eErr"></div><div class="row"><button class="btn dng" data-close>Annuler</button><button class="btn" id="eOk">Enregistrer</button></div>', false, m => {
        $('eR').onclick = () => { $('eK').value = A.randCode(); };
        $('eG').onclick = () => {
          if (!navigator.geolocation) return toast('GPS indisponible');
          $('eG').textContent = '📍 Recherche…';
          navigator.geolocation.getCurrentPosition(p => { $('eLa').value = p.coords.latitude.toFixed(6); $('eLo').value = p.coords.longitude.toFixed(6); $('eG').textContent = '📍 Ma position (±' + Math.round(p.coords.accuracy) + ' m)'; },
            () => { $('eG').textContent = '📍 Ma position'; toast('Position refusée ou indisponible'); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        };
        $('eM').onclick = () => {
          const d = { couleur: $('eC').value, identifiant: $('eI').value, code: $('eK').value, lat: A.num($('eLa').value), lon: A.num($('eLo').value), carteId: $('eCa').value };
          pickOnMap(d.lat, d.lon, (la, lo) => editBalise(id, Object.assign(d, la == null ? {} : { lat: la, lon: lo })));
        };
        $('eOk').onclick = () => {
          const ident = $('eI').value.trim(), code = $('eK').value.trim(), la = A.num($('eLa').value), lo = A.num($('eLo').value), err = $('eErr');
          if (!ident) return err.textContent = 'Identifiant obligatoire.';
          if (A.base.balises.some(b => b.id !== id && b.identifiant === ident)) return err.textContent = 'Cet identifiant existe déjà.';
          if (!/^\d{4}$/.test(code)) return err.textContent = 'Le code doit comporter exactement 4 chiffres.';
          if (A.base.balises.some(b => b.id !== id && b.code === code) && !confirm('Ce code est déjà utilisé par une autre balise. Continuer ?')) return;
          if (la == null || lo == null || Math.abs(la) > 90 || Math.abs(lo) > 180) return err.textContent = 'Position GPS invalide.';
          const o = { couleur: $('eC').value, identifiant: ident, code, lat: la, lon: lo, carteId: $('eCa').value };
          if (id) Object.assign(x0, o); else A.base.balises.push(Object.assign({ id: O.uid() }, o));
          A.save(); A.closeModal(); A.render();
        };
      });
  }

  function pickOnMap(la, lo, cb) {
    A.modal('<h3>Choisir la position</h3><div class="note" style="margin-bottom:8px">Touche la carte pour placer la balise.</div><div class="map tall" id="pm"></div><div class="row" style="margin-top:10px"><button class="btn dng" id="pmC">Annuler</button><button class="btn" id="pmO" disabled>Valider cette position</button></div>', true, () => {
      const others = A.base.balises.filter(b => b.lat != null);
      const c = la != null ? [la, lo] : others.length ? [others[0].lat, others[0].lon] : [46.6, 2.4];
      const m = A.mmap = L.map('pm').setView(c, la != null || others.length ? 17 : 6); A.mapLayers(m);
      others.forEach(b => L.circleMarker([b.lat, b.lon], { radius: 5, color: '#fff', fillColor: '#7CFF6B', fillOpacity: 1, weight: 1 }).addTo(m).bindTooltip(b.identifiant));
      let mk = la != null ? L.marker([la, lo]).addTo(m) : null, sel = la != null ? [la, lo] : null;
      if (sel) $('pmO').disabled = false;
      m.on('click', e => { sel = [e.latlng.lat, e.latlng.lng]; if (mk) mk.setLatLng(e.latlng); else mk = L.marker(e.latlng).addTo(m); $('pmO').disabled = false; });
      $('pmC').onclick = () => { A.closeModal(); cb(null, null); }; $('pmO').onclick = () => { A.closeModal(); cb(sel[0], sel[1]); };
    });
  }

  /* ---------- Import tableau ---------- */
  function importTable() {
    A.modal('<h3>Importer un tableau</h3><div class="note" style="margin-bottom:10px">Fichier .xlsx ou .csv dont la première feuille a des colonnes <b>Couleur, Identifiant, Code, Latitude, Longitude</b> (et facultativement <b>Carte</b> = nom ou numéro). L\'« Export lisible » de l\'onglet Export / Import a déjà ce format. Les identifiants existants sont mis à jour.</div>' +
      '<div class="field"><label>Fichier</label><input type="file" id="tF" accept=".xlsx,.csv,.txt"></div><div class="err" id="tE"></div><div class="row"><button class="btn dng" data-close>Annuler</button><button class="btn" id="tOk">Importer</button></div>', false, () => {
        $('tOk').onclick = async () => {
          const f = $('tF').files[0]; if (!f) return $('tE').textContent = 'Choisis un fichier.';
          try {
            const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
            const norm = k => String(k).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            let add = 0, upd = 0, bad = 0;
            rows.forEach(r => {
              const o = {}; Object.keys(r).forEach(k => o[norm(k)] = r[k]);
              const ident = String(o.identifiant || '').trim(), la = A.num(o.latitude), lo = A.num(o.longitude); if (!ident || la == null || lo == null) { bad++; return; }
              const cn = String(o.couleur || '').trim().toLowerCase(), couleur = /^j/.test(cn) ? 'Jaune' : /^b/.test(cn) ? 'Bleu' : /^r/.test(cn) ? 'Rouge' : 'Jaune';
              const code = String(o.code || '').trim().padStart(4, '0').slice(-4), cr = String(o.carte || '').trim().toLowerCase();
              const carte = cr ? A.base.cartes.find(c => String(c.numero) === cr || (c.nom || '').toLowerCase() === cr) : null;
              const ex = A.base.balises.find(b => b.identifiant === ident);
              const val = { couleur, identifiant: ident, code: /^\d{4}$/.test(code) ? code : A.randCode(), lat: la, lon: lo, carteId: carte ? carte.id : (ex ? ex.carteId : '') };
              if (ex) { Object.assign(ex, val); upd++; } else { A.base.balises.push(Object.assign({ id: O.uid() }, val)); add++; }
            });
            A.save(); A.closeModal(); A.render(); toast(add + ' ajoutée(s), ' + upd + ' mise(s) à jour' + (bad ? ', ' + bad + ' ligne(s) ignorée(s)' : ''), 4000);
          } catch (e) { $('tE').textContent = 'Fichier illisible : ' + e.message; }
        };
      });
  }

  /* ---------- Import KML ---------- */
  function importKml() {
    A.modal('<h3>Importer un KML</h3><div class="note" style="margin-bottom:10px">Fichier exporté depuis Google Earth / My Maps : chaque repère devient une balise (nom = identifiant, couleur déduite du dossier ou de la première lettre J / B / R). Les balises dont l\'identifiant existe déjà voient leur position mise à jour.</div>' +
      '<div class="field"><label>Fichier .kml</label><input type="file" id="kF" accept=".kml,application/vnd.google-earth.kml+xml,text/xml"></div>' +
      '<div class="field"><label>Carte associée</label><select id="kC"><option value="">—</option>' + A.base.cartes.map(c => '<option value="' + c.id + '">' + esc(c.nom || 'Carte ' + c.numero) + '</option>').join('') + '</select></div>' +
      '<label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" id="kR" checked style="width:auto"> Attribuer un code aléatoire aux nouvelles balises</label>' +
      '<div class="err" id="kE"></div><div class="row"><button class="btn dng" data-close>Annuler</button><button class="btn" id="kOk">Importer</button></div>', false, () => {
        $('kOk').onclick = async () => {
          const f = $('kF').files[0]; if (!f) return $('kE').textContent = 'Choisis un fichier.';
          try {
            const doc = new DOMParser().parseFromString(await f.text(), 'text/xml'), pms = [].slice.call(doc.getElementsByTagName('Placemark'));
            let add = 0, upd = 0; const imported = [];
            pms.forEach(pm => {
              const co = pm.getElementsByTagName('coordinates')[0]; if (!co) return;
              const [lo, la] = co.textContent.trim().split(/[,\s]+/).map(Number); if (!isFinite(la) || !isFinite(lo)) return;
              const nm = (pm.getElementsByTagName('name')[0] || {}).textContent; if (!nm) return; const ident = nm.trim();
              const par = pm.parentNode && pm.parentNode.tagName === 'Folder' ? ((pm.parentNode.getElementsByTagName('name')[0] || {}).textContent || '') : '';
              const t = (par + ' ' + ident).toLowerCase();
              const couleur = /jaune|yellow/.test(par.toLowerCase()) ? 'Jaune' : /bleu|blue/.test(par.toLowerCase()) ? 'Bleu' : /rouge|red/.test(par.toLowerCase()) ? 'Rouge' : ({ j: 'Jaune', b: 'Bleu', r: 'Rouge' }[ident[0].toLowerCase()] || 'Jaune');
              const ex = A.base.balises.find(b => b.identifiant === ident);
              if (ex) { ex.lat = la; ex.lon = lo; upd++; imported.push(ex.id); }
              else { const nb = { id: O.uid(), couleur, identifiant: ident, code: $('kR').checked ? A.randCode() : '', lat: la, lon: lo, carteId: $('kC').value }; A.base.balises.push(nb); imported.push(nb.id); add++; }
            });
            selB = new Set(imported); A.save(); A.closeModal(); A.render(); toast(add + ' ajoutée(s), ' + upd + ' mise(s) à jour' + (imported.length ? ' — sélectionnées : affecte-les à une carte ci-dessus' : ''), 5000);
          } catch (e) { $('kE').textContent = 'Fichier illisible : ' + e.message; }
        };
      });
  }

  /* ====================================================================
     CARTES
     ==================================================================== */
  A.addTab('cartes', '2 · Cartes', v => {
    const b = A.base;
    v.innerHTML = '<div class="card"><h3>Cartes de course (' + b.cartes.length + ')</h3><div class="bar"><button class="btn sm" data-a="add">➕ Ajouter une carte</button></div>' +
      (b.cartes.length ? '<div class="tw"><table><tr><th>N°</th><th>Nom</th><th>Référence</th><th>Fond de carte</th><th>Balises</th><th>Parcours</th><th></th></tr>' +
        b.cartes.slice().sort((x, y) => (x.numero || 0) - (y.numero || 0)).map(c => '<tr><td><b>' + esc(c.numero) + '</b></td><td>' + esc(c.nom) + '</td><td>' + esc(c.ref) + '</td><td>' + (c.image ? '🖼️ importé' : '<span class="note">en ligne (OSM)</span>') + '</td><td>' + b.balises.filter(x => x.carteId === c.id).length + '</td><td>' + b.parcours.filter(p => p.carteId === c.id).length + '</td><td class="act"><button data-a="edit" data-id="' + c.id + '">✏️</button><button data-a="del" data-id="' + c.id + '">🗑</button></td></tr>').join('') + '</table></div>'
        : '<div class="empty">Aucune carte. Une carte regroupe des balises et des parcours (ex. « Carte 2 – Parc Jean Renaux »).</div>') +
      '<div class="info" style="margin-top:12px">💡 <b>Visuel hors ligne</b> : importe l\'image de ta carte de course (export PNG/JPG d\'OCAD, d\'un fond IGN/OSM…) et indique les coordonnées de ses 4 bords. Elle sera proposée comme fond de carte alternatif (sélecteur de couches) dans l\'analyse des courses, y compris sans connexion. Par défaut, l\'analyse utilise OpenStreetMap en ligne avec les positions réelles des balises.</div></div>';
    v.onclick = e => { const bt = e.target.closest('[data-a]'); if (!bt) return; const a = bt.dataset.a; if (a === 'add') editCarte(); else if (a === 'edit') editCarte(bt.dataset.id); else if (a === 'del') delCarte(bt.dataset.id); };
  });
  function delCarte(id) {
    const c = A.carte(id); if (!c) return;
    const nb = A.base.balises.filter(b => b.carteId === id).length, np = A.base.parcours.filter(p => p.carteId === id).length;
    if (!confirm('Supprimer « ' + (c.nom || 'Carte ' + c.numero) + ' » ?' + (nb || np ? '\n' + np + ' parcours associé(s) seront supprimés ; les ' + nb + ' balises resteront sans carte.' : ''))) return;
    A.base.cartes = A.base.cartes.filter(x => x.id !== id); A.base.parcours = A.base.parcours.filter(p => p.carteId !== id);
    A.base.balises.forEach(b => { if (b.carteId === id) b.carteId = ''; }); A.save(); A.render();
  }
  function reduceImage(file) {
    return new Promise((res, rej) => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, 2400 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', .85)); };
      img.onerror = () => rej(new Error('Image illisible')); img.src = u;
    });
  }
  function editCarte(id) {
    const c = id ? A.carte(id) : { numero: Math.max(0, ...A.base.cartes.map(x => x.numero || 0)) + 1, nom: '', ref: '', image: null };
    const work = JSON.parse(JSON.stringify(c)); const bd = (work.image && work.image.bounds) || { n: '', s: '', o: '', e: '' };
    A.modal('<h3>' + (id ? 'Modifier' : 'Nouvelle') + ' carte</h3>' +
      '<div class="grid2"><div class="field"><label>Numéro</label><input id="cN" inputmode="numeric" value="' + esc(c.numero) + '"></div><div class="field"><label>Nom</label><input id="cNm" value="' + esc(c.nom) + '" placeholder="Parc Jean Renaux"></div></div>' +
      '<div class="field"><label>Référence de la carte</label><input id="cR" value="' + esc(c.ref) + '" placeholder="Échelle, édition, lieu…"></div>' +
      '<div class="field"><label>Image de la carte (facultatif, pour l\'affichage hors ligne)</label><input type="file" id="cI" accept="image/*"></div>' +
      '<div id="cB" ' + (work.image ? '' : 'hidden') + '><div class="lbl">Coordonnées des bords de l\'image (degrés décimaux)</div><div class="grid2">' +
      '<div class="field"><label>Nord (lat. haut)</label><input id="bN" value="' + bd.n + '"></div><div class="field"><label>Sud (lat. bas)</label><input id="bS" value="' + bd.s + '"></div>' +
      '<div class="field"><label>Ouest (lon. gauche)</label><input id="bO" value="' + bd.o + '"></div><div class="field"><label>Est (lon. droite)</label><input id="bE" value="' + bd.e + '"></div></div>' +
      '<div class="row nogrow" style="margin-bottom:8px"><button class="btn sec sm" id="cA" type="button">🎯 Caler autour des balises</button><button class="btn dng sm" id="cX" type="button">Retirer l\'image</button></div>' +
      '<div class="map" id="cM"></div><div class="note">Vérifie que les balises (points verts) tombent bien sur leurs lanternes ; ajuste les 4 valeurs sinon.</div></div>' +
      '<div class="err" id="cErr"></div><div class="row" style="margin-top:12px"><button class="btn dng" data-close>Annuler</button><button class="btn" id="cOk">Enregistrer</button></div>', true, () => {
        let m = null, ov = null;
        // balises de cette carte ; à défaut (aucune encore affectée) : toutes les balises de la base
        const balCarte = () => { const all = A.base.balises.filter(b => b.lat != null), own = id ? all.filter(b => b.carteId === id) : []; return own.length ? own : all; };
        const getB = () => { const n = A.num($('bN').value), s = A.num($('bS').value), o = A.num($('bO').value), e = A.num($('bE').value); return [n, s, o, e].every(x => x != null) && n > s && e > o ? { n, s, o, e } : null; };
        const preview = () => {
          if (!work.image) return; $('cB').hidden = false;
          if (!m) { m = A.mmap = L.map('cM'); A.mapLayers(m); const bl = balCarte(); bl.forEach(b => L.circleMarker([b.lat, b.lon], { radius: 5, color: '#fff', fillColor: '#7CFF6B', fillOpacity: 1, weight: 1 }).addTo(m)); const pts = bl.map(b => [b.lat, b.lon]); m.setView(pts[0] || [46.6, 2.4], pts.length ? 16 : 6); if (pts.length > 1) m.fitBounds(pts, { padding: [30, 30] }); }
          if (ov) { m.removeLayer(ov); ov = null; }
          const b = getB(); if (b) { ov = L.imageOverlay(work.image.dataUrl, [[b.s, b.o], [b.n, b.e]], { opacity: .8 }).addTo(m); }
        };
        if (work.image) setTimeout(preview, 50);
        ['bN', 'bS', 'bO', 'bE'].forEach(k => $(k).oninput = () => { clearTimeout(preview.t); preview.t = setTimeout(preview, 300); });
        $('cI').onchange = async e => {
          const f = e.target.files[0]; if (!f) return;
          try { work.image = { dataUrl: await reduceImage(f), bounds: null }; $('cB').hidden = false; if (m) { m.remove(); m = A.mmap = null; } setTimeout(preview, 50); } catch (er) { $('cErr').textContent = er.message; }
        };
        $('cX').onclick = () => { work.image = null; $('cB').hidden = true; if (m) { m.remove(); m = A.mmap = null; } };
        $('cA').onclick = () => {
          const bl = balCarte(); if (!bl.length) return toast('Aucune balise dans la base');
          const la = bl.map(b => b.lat), lo = bl.map(b => b.lon), dl = (Math.max(...la) - Math.min(...la)) * .15 || .0005, dn = (Math.max(...lo) - Math.min(...lo)) * .15 || .0005;
          $('bN').value = (Math.max(...la) + dl).toFixed(6); $('bS').value = (Math.min(...la) - dl).toFixed(6); $('bE').value = (Math.max(...lo) + dn).toFixed(6); $('bO').value = (Math.min(...lo) - dn).toFixed(6); preview();
        };
        $('cOk').onclick = () => {
          const err = $('cErr'), num = A.num($('cN').value);
          if (num == null) return err.textContent = 'Numéro invalide.';
          if (A.base.cartes.some(x => x.id !== id && x.numero === num)) return err.textContent = 'Ce numéro de carte existe déjà.';
          let image = null;
          if (work.image) { const b = getB(); if (!b) return err.textContent = 'Renseigne les 4 bords de l\'image (Nord > Sud, Est > Ouest).'; image = { dataUrl: work.image.dataUrl, bounds: b }; }
          const o = { numero: num, nom: $('cNm').value.trim() || ('Carte ' + num), ref: $('cR').value.trim(), image };
          if (id) Object.assign(c, o); else A.base.cartes.push(Object.assign({ id: O.uid() }, o));
          A.save(); A.closeModal(); A.render();
        };
      });
  }

  /* ====================================================================
     PARCOURS
     ==================================================================== */
  A.addTab('parcours', '3 · Parcours', v => {
    const b = A.base;
    v.innerHTML = '<div class="card"><h3>Parcours (' + b.parcours.length + ')</h3><div class="bar"><button class="btn sm" data-a="add"' + (b.cartes.length && b.balises.length ? '' : ' disabled') + '>➕ Créer un parcours</button></div>' +
      (b.parcours.length ? '<div class="tw"><table><tr><th>Code</th><th>Nom</th><th>Carte</th><th>Balises</th><th>Distance</th><th></th></tr>' +
        b.parcours.slice().sort((x, y) => x.code.localeCompare(y.code)).map(p => { const bl = O.parcoursDetail(b, p); return '<tr><td><b>' + esc(p.code) + '</b></td><td>' + esc(p.nom) + '</td><td>' + esc(A.carteNom(p.carteId)) + '</td><td>' + bl.length + ' · ' + bl.map(x => '<i class="cdot ' + x.couleur + '" style="margin:0 1px"></i>').join('') + '</td><td>' + Math.round(O.pathLength(bl.map(x => [x.lat, x.lon]))) + ' m</td><td class="act"><button data-a="edit" data-id="' + p.id + '">✏️</button><button data-a="dup" data-id="' + p.id + '" title="Dupliquer">⧉</button><button data-a="del" data-id="' + p.id + '">🗑</button></td></tr>'; }).join('') + '</table></div>'
        : '<div class="empty">' + (b.cartes.length && b.balises.length ? 'Aucun parcours. Crée-en un à partir des balises du référentiel.' : 'Crée d\'abord au moins une carte et des balises.') + '</div>') + '</div>';
    v.onclick = e => {
      const bt = e.target.closest('[data-a]'); if (!bt || bt.disabled) return; const a = bt.dataset.a, id = bt.dataset.id;
      if (a === 'add') editParcours(); else if (a === 'edit') editParcours(id);
      else if (a === 'dup') { const p = b.parcours.find(x => x.id === id); b.parcours.push(Object.assign({}, p, { id: O.uid(), code: p.code + '-copie', balises: p.balises.slice() })); A.save(); A.render(); }
      else if (a === 'del' && confirm('Supprimer ce parcours ?')) { b.parcours = b.parcours.filter(x => x.id !== id); A.save(); A.render(); }
    };
  });
  function suggestCode(carteId) {
    const c = A.carte(carteId); if (!c) return '';
    const n = A.base.parcours.filter(p => p.carteId === carteId).length + 1; return 'C' + String(c.numero).padStart(2, '0') + ' - P' + String(n).padStart(2, '0');
  }
  function editParcours(id) {
    const p0 = id ? A.base.parcours.find(x => x.id === id) : null;
    const w = p0 ? { carteId: p0.carteId, code: p0.code, nom: p0.nom, balises: p0.balises.slice() } : { carteId: (A.base.cartes[0] || {}).id, code: '', nom: '', balises: [] };
    let codeTouched = !!p0;
    const draw = () => {
      const m = $('ov').querySelector('.modal'); const bl = w.balises.map(i => A.base.balises.find(b => b.id === i)).filter(Boolean);
      const dispo = A.base.balises.filter(b => !w.balises.includes(b.id) && (!w.carteId || b.carteId === w.carteId || !b.carteId));
      m.innerHTML = '<h3>' + (id ? 'Modifier' : 'Nouveau') + ' parcours</h3>' +
        '<div class="field"><label>Carte</label><select id="pC">' + A.base.cartes.map(c => '<option value="' + c.id + '"' + (w.carteId === c.id ? ' selected' : '') + '>' + esc(c.nom || 'Carte ' + c.numero) + '</option>').join('') + '</select></div>' +
        '<div class="grid2"><div class="field"><label>Code du parcours</label><input id="pK" value="' + esc(w.code) + '" placeholder="C02 - P01"></div><div class="field"><label>Nom</label><input id="pN" value="' + esc(w.nom) + '" placeholder="Parcours 1"></div></div>' +
        '<div class="lbl">Balises dans l\'ordre (' + bl.length + ') · ' + Math.round(O.pathLength(bl.map(x => [x.lat, x.lon]))) + ' m à vol d\'oiseau</div><div class="plist">' +
        (bl.map((b, i) => '<div class="it"><span class="n">' + (i + 1) + '</span><span class="t"><i class="cdot ' + b.couleur + '"></i><b>' + esc(b.identifiant) + '</b> <span class="code">' + esc(b.code) + '</span></span><button class="btn sec sm" data-m="u" data-i="' + i + '"' + (i ? '' : ' disabled') + '>↑</button><button class="btn sec sm" data-m="d" data-i="' + i + '"' + (i < bl.length - 1 ? '' : ' disabled') + '>↓</button><button class="btn dng sm" data-m="x" data-i="' + i + '">✕</button></div>').join('') || '<div class="empty">Aucune balise</div>') + '</div>' +
        '<div class="row" style="margin:10px 0"><select id="pA"><option value="">+ Ajouter une balise…</option>' + dispo.map(b => '<option value="' + b.id + '">' + b.couleur[0] + ' · ' + esc(b.identifiant) + '</option>').join('') + '</select></div>' +
        '<div class="err" id="pErr"></div><div class="row"><button class="btn dng" data-close>Annuler</button><button class="btn" id="pOk">Enregistrer</button></div>';
      $('pC').onchange = e => { w.carteId = e.target.value; if (!codeTouched) w.code = suggestCode(w.carteId); w.nom = $('pN').value; draw(); };
      $('pK').oninput = e => { codeTouched = true; w.code = e.target.value; }; $('pN').oninput = e => w.nom = e.target.value;
      $('pA').onchange = e => { if (e.target.value) { w.balises.push(e.target.value); draw(); } };
      m.onclick = e => {
        const bt = e.target.closest('[data-m]'); if (!bt) return; const i = +bt.dataset.i, k = bt.dataset.m;
        if (k === 'x') w.balises.splice(i, 1); else { const j = k === 'u' ? i - 1 : i + 1;[w.balises[i], w.balises[j]] = [w.balises[j], w.balises[i]]; } draw();
      };
      $('pOk').onclick = () => {
        const err = $('pErr'); w.code = $('pK').value.trim(); w.nom = $('pN').value.trim();
        if (!w.carteId) return err.textContent = 'Choisis une carte.'; if (!w.code) return err.textContent = 'Code de parcours obligatoire.';
        if (A.base.parcours.some(x => x.id !== id && x.code === w.code)) return err.textContent = 'Ce code de parcours existe déjà.';
        if (!w.balises.length) return err.textContent = 'Ajoute au moins une balise.';
        if (id) Object.assign(p0, w); else A.base.parcours.push(Object.assign({ id: O.uid() }, w));
        A.save(); A.closeModal(); A.render();
      };
    };
    A.modal('', false); if (!w.code) w.code = suggestCode(w.carteId); draw();
  }

  /* ---------- Démarrage (après chargement des autres modules) ---------- */
  A.start = async () => {
    A.base = (await A.kvGet('base')) || newBase(); A.runs = (await A.kvGet('runs')) || [];
    A.newBase = newBase; A.render(); ORUN_UPDATE.mount($('verBox'), A.VERSION);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  };
  window.addEventListener('load', () => A.start());
})();
