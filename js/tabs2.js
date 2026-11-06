/* OrienRun Admin – étiquettes, export/import, courses élèves */
(function () {
  'use strict';
  const A = window.A, O = A.O, $ = A.$, esc = A.esc, toast = A.toast;
  const COULEURS = ['Jaune', 'Bleu', 'Rouge'];

  /* ====================================================================
     ÉTIQUETTES
     ==================================================================== */
  const lab = { couleur: '', carte: '', parcours: '', parPage: 8, code: true, sel: null };
  function labSelection() {
    const b = A.base;
    let l = b.balises.filter(x => /^\d{4}$/.test(x.code || ''));
    if (lab.parcours) { const p = b.parcours.find(q => q.id === lab.parcours); l = p ? O.parcoursDetail(b, p) : l; }
    else { if (lab.couleur) l = l.filter(x => x.couleur === lab.couleur); if (lab.carte) l = l.filter(x => x.carteId === lab.carte); }
    return l;
  }
  A.addTab('etiquettes', '4 · Étiquettes', v => {
    const b = A.base, l = labSelection();
    v.innerHTML = '<div class="card"><h3>Étiquettes à imprimer</h3>' +
      '<div class="info">Chaque tuile porte l\'<b>identifiant</b> de la balise et son <b>QR code</b>. Le code à 4 chiffres est imprimé sous le QR (option décochable) pour permettre la saisie sans scan.</div>' +
      '<div class="grid2"><div class="field"><label>Couleur</label><select id="lC"><option value="">Toutes</option>' + COULEURS.map(c => '<option' + (lab.couleur === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Carte</label><select id="lK"><option value="">Toutes</option>' + b.cartes.map(c => '<option value="' + c.id + '"' + (lab.carte === c.id ? ' selected' : '') + '>' + esc(c.nom) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Ou : balises d\'un parcours</label><select id="lP"><option value="">—</option>' + b.parcours.map(p => '<option value="' + p.id + '"' + (lab.parcours === p.id ? ' selected' : '') + '>' + esc(p.code) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Étiquettes par page</label><select id="lN">' + [6, 8, 12, 20].map(n => '<option' + (lab.parPage === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div></div>' +
      '<label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" id="lCd" style="width:auto"' + (lab.code ? ' checked' : '') + '> Afficher le code à 4 chiffres sur l\'étiquette (l\'élève peut pointer sans scanner)</label>' +
      '<div class="field"><label>Logo au centre du QR code (image carrée, facultatif)</label><div class="row nogrow"><input type="file" id="lLg" accept="image/*" style="max-width:260px">' + (b.logo ? '<img src="' + b.logo + '" alt="logo" style="width:40px;height:40px;border-radius:6px;background:#fff"><button class="btn dng sm" id="lLx">Retirer</button>' : '') + '</div><div class="note">Le QR passe en correction d\'erreurs maximale pour rester lisible ; le logo occupe 20 % de sa largeur.</div></div>' +
      '<div class="row nogrow"><button class="btn" id="lPdf"' + (l.length ? '' : ' disabled') + '>📄 Générer le PDF (' + l.length + ' étiquette' + (l.length > 1 ? 's' : '') + ')</button></div>' +
      (!b.balises.length ? '<div class="empty">Crée d\'abord des balises.</div>' : '') +
      '<div class="tiles" id="lT"></div></div>';
    $('lC').onchange = e => { lab.couleur = e.target.value; A.render(); }; $('lK').onchange = e => { lab.carte = e.target.value; A.render(); };
    $('lP').onchange = e => { lab.parcours = e.target.value; A.render(); }; $('lN').onchange = e => { lab.parPage = +e.target.value; };
    $('lCd').onchange = e => { lab.code = e.target.checked; A.render(); };
    $('lLg').onchange = e => {
      const f = e.target.files[0]; if (!f) return; const img = new Image(), u = URL.createObjectURL(f);
      img.onload = () => { const m = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256); x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 256, 256); URL.revokeObjectURL(u); A.base.logo = c.toDataURL('image/png'); A.save(); A.render(); };
      img.onerror = () => toast('Image illisible'); img.src = u;
    };
    if ($('lLx')) $('lLx').onclick = () => { delete A.base.logo; A.save(); A.render(); };
    // aperçu (max 60 tuiles)
    const T = $('lT');
    l.slice(0, 60).forEach(x => {
      const q = qrcode(0, b.logo ? 'H' : 'M'); q.addData(O.qrPayload(x)); q.make();
      T.insertAdjacentHTML('beforeend', '<div class="tile"><div class="band ' + x.couleur + '"></div><div class="id">' + esc(x.identifiant) + '</div><div style="position:relative;width:70%;max-width:130px;margin:4px auto"><img alt="QR" style="width:100%;margin:0" src="' + q.createDataURL(4, 4) + '">' + (b.logo ? '<img alt="" src="' + b.logo + '" style="position:absolute;left:40%;top:40%;width:20%;height:20%;margin:0;background:#fff;outline:2px solid #fff">' : '') + '</div>' + (lab.code ? '<div class="cd">' + esc(x.code) + '</div>' : '') + '</div>');
    });
    if (l.length > 60) T.insertAdjacentHTML('beforeend', '<div class="note">… aperçu limité à 60 étiquettes (le PDF contient tout).</div>');
    $('lPdf').onclick = () => {
      try {
        const doc = ORUN_LABELS.buildPdf(window.jspdf.jsPDF, qrcode, l, { parPage: lab.parPage, afficherCode: lab.code, logo: b.logo || null, qrPayload: O.qrPayload, legende: A.base.nom });
        doc.save('OrienRun_etiquettes' + (lab.couleur ? '_' + lab.couleur : '') + '.pdf');
      } catch (e) { toast('Erreur PDF : ' + e.message, 5000); }
    };
  });

  /* ====================================================================
     EXPORT / IMPORT
     ==================================================================== */
  const secretDefault = () => /CHANGEZ/i.test(O.CFG.secret);

  /* Sauvegarde complète NON chiffrée : feuilles lisibles (Balises, Cartes, Parcours) + feuille JSON complète pour la restauration */
  function buildAdminWorkbook(base) {
    const wb = XLSX.utils.book_new();
    const bal = [['Couleur', 'Identifiant', 'Code', 'Latitude', 'Longitude', 'Carte']].concat(base.balises.map(b => [b.couleur, b.identifiant, b.code, b.lat, b.lon, A.carteNom(b.carteId)]));
    const car = [['Numéro', 'Nom', 'Référence', 'Image importée', 'Nord', 'Sud', 'Ouest', 'Est']].concat(base.cartes.map(c => [c.numero, c.nom, c.ref, c.image ? 'oui' : 'non', c.image ? c.image.bounds.n : '', c.image ? c.image.bounds.s : '', c.image ? c.image.bounds.o : '', c.image ? c.image.bounds.e : '']));
    const par = [['Code', 'Nom', 'Carte', 'Nb balises', 'Balises (ordre)']].concat(base.parcours.map(p => { const l = O.parcoursDetail(base, p); return [p.code, p.nom, A.carteNom(p.carteId), l.length, l.map(x => x.identifiant).join(' > ')]; }));
    const pad = [['Base', base.nom], ['Tolérance GPS (m)', base.seuilGPS], ['Exportée le', new Date().toLocaleString('fr-FR')], ['Application', 'OrienRun Admin ' + A.VERSION]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pad), 'Base');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bal), 'Balises');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(car), 'Cartes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(par), 'Parcours');
    const json = JSON.stringify(base), rows = [['ORIENRUN_ADMIN', 1], ['Ne pas modifier cette feuille : elle permet de restaurer la base à l\'identique.']];
    for (let i = 0; i < json.length; i += 30000) rows.push([json.slice(i, i + 30000)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'OrienRun_Admin_JSON');
    return wb;
  }
  async function readAdminWorkbook(wb) {
    const ws = wb.Sheets['OrienRun_Admin_JSON'];
    if (ws) {
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (!rows[0] || rows[0][0] !== 'ORIENRUN_ADMIN') throw new Error('Sauvegarde non reconnue.');
      const d = JSON.parse(rows.slice(2).map(r => r[0] || '').join(''));
      if (!d.balises || !d.parcours || !d.cartes) throw new Error('Sauvegarde incomplète.');
      return d;
    }
    // ancien format chiffré
    return (await O.readWorkbook(XLSX, wb, ['ADMIN'])).data;
  }

  A.addTab('export', '5 · Export / Import', v => {
    const b = A.base;
    v.innerHTML = '<div class="card"><h3>Base de référence</h3>' +
      (secretDefault() ? '<div class="warn">⚠ La clé de chiffrement par défaut est encore active (fichier <b>config.js</b>). Remplace-la par une phrase personnelle <b>identique dans l\'appli élève et dans cette appli</b> avant de diffuser les fichiers aux élèves.</div>' : '') +
      '<div class="grid2"><div class="field"><label>Nom de la base</label><input id="xN" value="' + esc(b.nom) + '"></div><div class="field"><label>Tolérance GPS (m)</label><input id="xS" inputmode="numeric" value="' + b.seuilGPS + '"></div></div>' +
      '<div class="note" style="margin-bottom:12px">' + b.balises.length + ' balises · ' + b.cartes.length + ' cartes · ' + b.parcours.length + ' parcours. Attention : la précision d\'un GPS de smartphone est souvent de 3 à 15 m ; une tolérance de 5 m peut refuser des balises correctement trouvées.</div>' +
      '<div class="col2 stack">' +
      '<div><button class="btn block" id="xE">📤 Base chiffrée pour les élèves (.xlsx)</button><div class="note" style="margin-top:6px">À déposer sur l\'ENT : illisible hors de l\'appli élève (codes et positions protégés).</div></div>' +
      '<div><button class="btn block" id="xA" style="background:linear-gradient(135deg,#1e6bff,#00b7ff);color:#fff;box-shadow:0 5px 20px rgba(30,107,255,.45)">🗄️ Sauvegarde complète (.xlsx)</button><div class="note" style="margin-top:6px">Fichier lisible (balises, codes, cartes, parcours), non chiffré : à conserver, à rouvrir ici ou à transmettre à Mes Apps EPS.</div></div></div>' +
      '<div class="row nogrow" style="margin-top:16px"><label class="btn sm" for="xF" style="background:linear-gradient(135deg,#ffd600,#ffb300);color:#1a1300">📂 Restaurer une sauvegarde complète</label><input type="file" id="xF" accept=".xlsx" hidden></div>' +
      '<div class="err" id="xErr"></div></div>' +
      '<div class="card" style="border-color:var(--ko);box-shadow:0 8px 32px rgba(255,93,93,.18)"><h3 style="color:var(--ko)">⚠ Zone sensible</h3>' +
      '<p style="font-size:.9rem;margin-bottom:12px">Ce bouton <b>remet l\'application à zéro</b> : toutes les balises, cartes et parcours enregistrés sur cet appareil seront <b>définitivement perdus</b> si tu n\'as pas fait de sauvegarde complète avant.</p>' +
      '<button class="btn block" id="xZ" style="background:#e02929;color:#fff;box-shadow:0 5px 20px rgba(224,41,41,.4)">🗑 Remettre l\'application à zéro</button></div>';
    const syncMeta = () => { b.nom = $('xN').value.trim() || b.nom; const s = A.num($('xS').value); if (s != null && s > 0) b.seuilGPS = s; A.save(); };
    $('xN').onchange = syncMeta; $('xS').onchange = syncMeta;
    const stamp = () => O.slug(b.nom) + '_' + new Date().toISOString().slice(0, 10);
    $('xE').onclick = async () => {
      syncMeta(); if (!b.parcours.length) return toast('Crée au moins un parcours avant d\'exporter.');
      A.dlXlsx(await O.buildBaseWorkbook(XLSX, b, 'BASE'), 'OrienRun_BASE_ELEVES_' + stamp() + '.xlsx');
    };
    $('xA').onclick = () => { syncMeta(); A.dlXlsx(buildAdminWorkbook(b), 'OrienRun_SAUVEGARDE_COMPLETE_' + stamp() + '.xlsx'); };
    $('xF').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const d = await readAdminWorkbook(XLSX.read(await f.arrayBuffer(), { type: 'array' }));
        if (!confirm('Remplacer la base actuelle par « ' + d.nom + ' » (' + d.balises.length + ' balises, ' + d.parcours.length + ' parcours) ?')) return;
        A.base = d; await A.save(); A.render(); toast('Sauvegarde restaurée ✔');
      } catch (er) { $('xErr').textContent = '⚠ ' + er.message; }
    };
    $('xZ').onclick = async () => {
      if (!confirm('REMISE À ZÉRO\n\nToutes les balises, cartes et parcours seront effacés.\nAs-tu fait ta sauvegarde complète ?')) return;
      if (!confirm('Dernière confirmation : effacer définitivement toutes les données ?')) return;
      A.base = A.newBase(); await A.save(); A.render();
    };
  });

  /* ====================================================================
     COURSES ÉLÈVES
     ==================================================================== */
  let fc = { classe: '' };
  const who = r => r.groupe ? r.groupe + ' (' + [r.eleve].concat(r.partenaires || []).map(p => p.prenom + ' ' + p.nom).join(', ') + ')' : r.eleve.prenom + ' ' + r.eleve.nom;
  const cls = s => s >= 75 ? 'good' : s >= 40 ? 'mid' : 'bad';
  A.addTab('courses', '6 · Résultats élèves', v => {
    const runs = A.runs.filter(r => !fc.classe || r.eleve.classe === fc.classe);
    const classes = Array.from(new Set(A.runs.map(r => r.eleve.classe))).sort();
    v.innerHTML = '<div class="card"><h3>Résultats des élèves – fichiers de course (' + A.runs.length + ')</h3>' +
      '<div class="bar"><label class="btn sm" for="cF">📂 Importer des fichiers (.xlsx)</label><input type="file" id="cF" accept=".xlsx" multiple hidden>' +
      '<select id="cCl" class="grow"><option value="">Toutes les classes</option>' + classes.map(c => '<option' + (fc.classe === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>' +
      '<button class="btn sec sm" id="cS"' + (A.runs.length ? '' : ' disabled') + '>📑 Synthèse (.xlsx)</button><button class="btn dng sm" id="cZ"' + (A.runs.length ? '' : ' disabled') + '>Vider</button></div>' +
      '<div class="info"><b>Mes Apps EPS</b> : une feuille « orienrun » avec une ligne par élève (équipe = une ligne par membre), au même format que les autres applications du portail (Nom, Prénom, Né(e) le, Classe, Date…). Les dates de naissance sont reprises de la feuille « Élèves » de ton fichier.' +
      '<div class="bar" style="margin:8px 0 0"><button class="btn sm" id="cM"' + (runs.length ? '' : ' disabled') + '>📤 Créer un fichier Mes Apps EPS</button><label class="btn sm" for="cMF" style="background:linear-gradient(135deg,#1e6bff,#00b7ff);color:#fff">🔀 Intégrer dans mon fichier Mes Apps EPS…</label><input type="file" id="cMF" accept=".xlsx" hidden>' +
      '<label style="display:flex;gap:6px;align-items:center;font-size:.8rem"><input type="checkbox" id="cMD" style="width:auto"> avec le détail balise par balise (feuille « orienrun_detail »)</label></div></div>' +
      '<div class="err" id="cE"></div>' +
      (runs.length ? '<div class="tw"><table><tr><th>Élève / groupe</th><th>Classe</th><th>Parcours</th><th>Réussite</th><th>Temps</th><th>Moy./balise</th><th>Erreurs</th></tr>' +
        runs.map(r => { const s = O.statsRun(r); return '<tr class="runrow" data-id="' + r.id + '"><td><b>' + esc(who(r)) + '</b></td><td>' + esc(r.eleve.classe) + '</td><td>' + esc(r.parcours.code) + '</td><td><span class="pill ' + cls(s.taux) + '">' + Math.round(s.taux) + ' %</span> <span class="note">' + s.valides + '/' + s.total + '</span></td><td>' + O.fmtDur(Math.round((r.arriveeTs - r.departTs) / 1000)) + '</td><td>' + (s.valides ? O.fmtDur(Math.round(s.tempsMoyen)) : '—') + '</td><td>' + (s.errCode + s.errPos) + '</td></tr>'; }).join('') + '</table></div>'
        : '<div class="empty">Importe les fichiers .xlsx remis par les élèves pour voir leurs résultats et comparer leur trace au parcours prévu.</div>') + '</div>';
    $('cCl').onchange = e => { fc.classe = e.target.value; A.render(); };
    $('cF').onchange = async e => {
      const fl = [].slice.call(e.target.files); e.target.value = ''; const errs = []; let n = 0;
      for (const f of fl) {
        try {
          const r = await O.readRunWorkbook(XLSX, XLSX.read(await f.arrayBuffer(), { type: 'array' }));
          const i = A.runs.findIndex(x => x.id === r.id); r._f = f.name; if (i >= 0) A.runs[i] = r; else A.runs.push(r); n++;
        } catch (er) { errs.push(f.name + ' : ' + er.message); }
      }
      await A.saveRuns(); A.render(); if (errs.length) $('cE').innerHTML = errs.map(esc).join('<br>'); toast(n + ' fichier(s) importé(s)');
    };
    $('cZ').onclick = async () => { if (confirm('Supprimer les ' + A.runs.length + ' courses importées (de cet appareil uniquement) ?')) { A.runs = []; await A.saveRuns(); A.render(); } };
    $('cS').onclick = () => synthese(runs);
    $('cM').onclick = () => { try { const wb = XLSX.utils.book_new(); mesAppsAdd(wb, runs, $('cMD').checked); A.dlXlsx(wb, 'Mes_Apps_EPS_OrienRun_' + new Date().toISOString().slice(0, 10) + '.xlsx'); } catch (e) { $('cE').textContent = e.message; } };
    $('cMF').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); const r = mesAppsAdd(wb, runs, $('cMD').checked);
        A.dlXlsx(wb, f.name.replace(/\.xlsx$/i, '') + '_OrienRun.xlsx'); toast(r.lignes + ' ligne(s) intégrée(s), ' + r.nouveaux + ' nouvel(le)s élève(s) ajouté(s) à « Élèves »', 5000);
      } catch (er) { $('cE').textContent = 'Fichier illisible : ' + er.message; }
    };
    v.onclick = e => { const tr = e.target.closest('.runrow'); if (tr) detail(A.runs.find(r => r.id === tr.dataset.id)); };
  });


  /* ---------- Format Mes Apps EPS : feuille « Élèves » + une feuille par appli (nom = clé de l'appli), une ligne par élève,
     colonnes Nom / Prénom / Né(e) le / Classe / Date (AAAA-MM-JJ) puis les champs de l'appli ; feuille masquée _meta (Feuille, Application, Mode) ---------- */
  const APP = 'orienrun', APP_DET = 'orienrun_detail';
  const MA_HEAD = ['Nom', 'Prénom', 'Né(e) le', 'Classe', 'Date', 'Présent', 'Groupe', 'Parcours', 'Carte', 'Balises validées', 'Total balises', 'Taux de réussite (%)', 'Heure départ', 'Heure arrivée', 'Temps total (s)', 'Temps moyen balise (s)', 'Erreurs de code', 'Erreurs de position', 'Non pointées', 'Distance parcourue (m)', 'Distance théorique (m)'];
  const DET_HEAD = ['Nom', 'Prénom', 'Né(e) le', 'Classe', 'Date', 'Parcours', 'Rang', 'Balise', 'Résultat', 'Mode', 'Code saisi', 'Distance à la balise (m)', 'Temps balise (s)'];
  const nrm = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const members = r => [r.eleve].concat(r.partenaires || []).map(p => ({ nom: p.nom, prenom: p.prenom, classe: p.classe || r.eleve.classe }));
  function mesAppsAdd(wb, runs, detail) {
    // --- feuille Élèves (référence) ---
    const wsE = wb.Sheets['Élèves'];
    const rowsE = wsE ? XLSX.utils.sheet_to_json(wsE, { header: 1, defval: '' }) : [['Nom', 'Prénom', 'Né(e) le', 'Classe', 'Régime']];
    const head = rowsE[0], ci = n => head.findIndex(h => nrm(h) === nrm(n));
    const iN = ci('Nom'), iP = ci('Prénom'), iD = ci('Né(e) le'), iC = ci('Classe');
    if (iN < 0 || iP < 0) throw new Error('feuille « Élèves » sans colonnes Nom / Prénom');
    const find = m => {
      const all = rowsE.slice(1).filter(r => nrm(r[iN]) === nrm(m.nom) && nrm(r[iP]) === nrm(m.prenom));
      return all.find(r => nrm(r[iC]) === nrm(m.classe)) || (all.length === 1 ? all[0] : null);
    };
    let nouveaux = 0;
    runs.forEach(r => members(r).forEach(m => { if (!find(m)) { const row = head.map(() => ''); row[iN] = m.nom; row[iP] = m.prenom; if (iC >= 0) row[iC] = m.classe; rowsE.push(row); nouveaux++; } }));
    const put = (name, aoa) => { const ws = XLSX.utils.aoa_to_sheet(aoa); if (wb.Sheets[name]) wb.Sheets[name] = ws; else XLSX.utils.book_append_sheet(wb, ws, name); };
    put('Élèves', rowsE);
    // --- feuille de l'appli : on conserve les lignes existantes, on remplace celles du même élève + date + parcours ---
    const mk = (nom, prenom, date, parcours) => [nrm(nom), nrm(prenom), date, nrm(parcours)].join('|');
    const lignes = [];
    runs.forEach(r => { const s = O.statsRun(r);
      members(r).forEach(m => { const e = find(m), dn = e && iD >= 0 ? e[iD] : '', cl = e && iC >= 0 && e[iC] ? e[iC] : m.classe;
        lignes.push({ k: mk(m.nom, m.prenom, r.date, r.parcours.code), row: [m.nom, m.prenom, dn, cl, r.date, 'Oui', r.groupe || '', r.parcours.code, r.parcours.carteNom || '', s.valides, s.total, Math.round(s.taux), O.fmtHeure(r.departTs), O.fmtHeure(r.arriveeTs), Math.round((r.arriveeTs - r.departTs) / 1000), s.valides ? Math.round(s.tempsMoyen) : '', s.errCode, s.errPos, s.nonPointees, Math.round(s.distTrace || 0), Math.round(s.distTheorique || 0)] }); }); });
    const exist = name => { const ws = wb.Sheets[name]; const v = ws ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) : []; return v.length && nrm(v[0][0]) === 'nom' ? v.slice(1) : []; };
    const nk = new Set(lignes.map(l => l.k));
    put(APP, [MA_HEAD].concat(exist(APP).filter(r => !nk.has(mk(r[0], r[1], r[4], r[7]))), lignes.map(l => l.row)));
    // --- détail facultatif ---
    if (detail) {
      const d = [];
      runs.forEach(r => members(r).forEach(m => { const e = find(m), dn = e && iD >= 0 ? e[iD] : '', cl = e && iC >= 0 && e[iC] ? e[iC] : m.classe;
        r.balises.forEach(b => d.push([m.nom, m.prenom, dn, cl, r.date, r.parcours.code, b.rang, b.identifiant, O.STATUTS[b.statut] || b.statut, b.mode || '', b.codeSaisi || '', b.distance != null ? b.distance : '', b.tempsInter != null ? b.tempsInter : ''])); }));
      const dk = new Set(runs.flatMap(r => members(r).map(m => mk(m.nom, m.prenom, r.date, r.parcours.code))));
      put(APP_DET, [DET_HEAD].concat(exist(APP_DET).filter(r => !dk.has(mk(r[0], r[1], r[4], r[5]))), d));
    }
    // --- feuille masquée _meta : déclare l'appli au portail (mode « lignes ») ---
    const meta = wb.Sheets['_meta'] ? XLSX.utils.sheet_to_json(wb.Sheets['_meta'], { header: 1, defval: '' }) : [['Feuille', 'Application', 'Mode']];
    if (!meta.some(r => r[0] === APP)) meta.push([APP, APP, 'lignes']);
    put('_meta', meta);
    wb.Workbook = wb.Workbook || {}; wb.Workbook.Sheets = wb.SheetNames.map((n, i) => Object.assign({}, (wb.Workbook.Sheets || [])[i] || {}, n === '_meta' ? { Hidden: 1 } : {}));
    return { lignes: lignes.length, nouveaux };
  }

  function synthese(runs) {
    const head = ['Date', 'Classe', 'Élève(s)', 'Groupe', 'Parcours', 'Balises validées', 'Total balises', 'Réussite %', 'Temps total', 'Temps moyen / balise', 'Erreurs code', 'Erreurs position', 'Non pointées', 'Distance parcourue (m)', 'Distance théorique (m)'];
    const rows = runs.map(r => { const s = O.statsRun(r); return [r.date, r.eleve.classe, [r.eleve].concat(r.partenaires || []).map(p => p.prenom + ' ' + p.nom).join(' ; '), r.groupe || '', r.parcours.code, s.valides, s.total, Math.round(s.taux), O.fmtDur(Math.round((r.arriveeTs - r.departTs) / 1000)), s.valides ? O.fmtDur(Math.round(s.tempsMoyen)) : '', s.errCode, s.errPos, s.nonPointees, Math.round(s.distTrace || 0), Math.round(s.distTheorique || 0)]; });
    const det = [['Classe', 'Élève(s)', 'Parcours', 'Rang', 'Balise', 'Résultat', 'Mode', 'Code saisi', 'Distance à la balise (m)', 'Temps balise', 'Essais']];
    runs.forEach(r => r.balises.forEach(b => det.push([r.eleve.classe, who(r), r.parcours.code, b.rang, b.identifiant, O.STATUTS[b.statut] || b.statut, b.mode || '', b.codeSaisi || '', b.distance != null ? b.distance : '', b.tempsInter != null ? O.fmtDur(b.tempsInter) : '', (b.essais || []).length])));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head].concat(rows)), 'Synthèse');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(det), 'Détail balises');
    A.dlXlsx(wb, 'OrienRun_synthese_' + (fc.classe ? O.slug(fc.classe) + '_' : '') + new Date().toISOString().slice(0, 10) + '.xlsx');
  }

  function detail(r) {
    if (!r) return; const s = O.statsRun(r);
    const p = A.base.parcours.find(x => x.code === r.parcours.code);
    const refBal = p ? O.parcoursDetail(A.base, p) : [];
    const carte = p ? A.carte(p.carteId) : null;
    const ref = refBal.length ? refBal.map(b => [b.lat, b.lon]) : r.balises.map(b => [b.lat, b.lon]);
    const tOK = refBal.length === r.balises.length && refBal.every((b, i) => b.identifiant === r.balises[i].identifiant);
    A.modal('<h3>' + esc(who(r)) + '</h3>' +
      '<div class="note" style="margin-bottom:8px">' + esc(r.eleve.classe) + ' · ' + esc(r.date) + ' · parcours ' + esc(r.parcours.code) + ' ' + esc(r.parcours.nom || '') + ' · ' + O.fmtHeure(r.departTs) + ' → ' + O.fmtHeure(r.arriveeTs) + '</div>' +
      '<div class="grid2"><div><div class="lbl">Réussite</div><span class="pill ' + cls(s.taux) + '" style="font-size:1.1rem">' + Math.round(s.taux) + ' %</span> <span class="note">' + s.valides + '/' + s.total + '</span></div>' +
      '<div><div class="lbl">Temps total · moyen</div><b>' + O.fmtDur(Math.round((r.arriveeTs - r.departTs) / 1000)) + '</b> · ' + (s.valides ? O.fmtDur(Math.round(s.tempsMoyen)) : '—') + '</div>' +
      '<div><div class="lbl">Distance parcourue</div><b>' + (s.distTrace ? Math.round(s.distTrace) + ' m' : '—') + '</b></div>' +
      '<div><div class="lbl">Distance théorique (vol d\'oiseau)</div><b>' + (s.distTheorique ? Math.round(s.distTheorique) + ' m' : '—') + '</b>' + (s.distTrace && s.distTheorique ? ' <span class="note">(×' + (s.distTrace / s.distTheorique).toFixed(2) + ')</span>' : '') + '</div></div>' +
      (!p ? '<div class="warn" style="margin-top:10px">Ce parcours n\'existe pas dans ta base actuelle : la ligne de référence est reconstruite d\'après le fichier de l\'élève.</div>' : (!tOK ? '<div class="warn" style="margin-top:10px">Le parcours de ta base a changé depuis la course (balises différentes).</div>' : '')) +
      '<div class="map tall" id="dM" style="margin:12px 0 4px"></div>' +
      '<div class="legend"><span><i style="background:#fff;height:2px"></i>parcours prévu</span><span><i style="background:#ff7a00"></i>trace de l\'élève</span><span>● vert : validée · rouge : non validée · ○ position de l\'élève lors de la saisie</span></div>' +
      '<div class="tw" style="margin-top:12px"><table><tr><th>#</th><th>Balise attendue</th><th>Résultat</th><th>Mode</th><th>Code saisi</th><th>Écart</th><th>Temps</th><th>Essais</th></tr>' +
      r.balises.map((b, i) => { const rb = refBal[i]; const ok = rb && b.codeSaisi && rb.code === b.codeSaisi; return '<tr><td>' + b.rang + '</td><td><b>' + esc(b.identifiant) + '</b></td><td class="st ' + b.statut + '" style="font-weight:800;color:' + (b.statut === 'valide' ? 'var(--ok)' : b.statut === 'non_pointee' ? 'var(--mut)' : 'var(--ko)') + '">' + esc(O.STATUTS[b.statut] || b.statut) + '</td><td>' + (b.mode || '—') + '</td><td>' + (b.codeSaisi ? '<span class="code">' + esc(b.codeSaisi) + '</span>' + (rb ? (ok ? ' ✔' : ' <span class="note">(attendu ' + esc(rb.code) + ')</span>') : '') : '—') + '</td><td>' + (b.distance != null ? b.distance.toFixed(1) + ' m' : '—') + '</td><td>' + (b.tempsInter != null ? O.fmtDur(b.tempsInter) : '—') + '</td><td>' + (b.essais || []).length + '</td></tr>'; }).join('') + '</table></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn dng" id="dDel">Retirer cette course</button><button class="btn" data-close>Fermer</button></div>', true, () => {
        $('dDel').onclick = async () => { A.runs = A.runs.filter(x => x.id !== r.id); await A.saveRuns(); A.closeModal(); A.render(); };
        setTimeout(() => {
          const m = A.mmap = L.map('dM'), img = A.imgOverlay(carte);
          A.mapLayers(m, null, 'osm', img ? { 'Carte importée (image)': img } : null);
          L.polyline(ref, { color: '#fff', weight: 2, dashArray: '6 6' }).addTo(m);
          const pts = ref.slice();
          if (r.trace && r.trace.length > 1) { const tr = r.trace.map(q => [q[0], q[1]]); L.polyline(tr, { color: '#ff7a00', weight: 4 }).addTo(m); pts.push.apply(pts, tr); }
          r.balises.forEach(b => {
            L.marker([b.lat, b.lon], { icon: L.divIcon({ className: '', iconSize: [24, 24], html: '<div style="width:24px;height:24px;border-radius:50%;background:' + (b.statut === 'valide' ? '#22e58b' : '#ff5d5d') + ';color:#000;font:800 11px system-ui;display:flex;align-items:center;justify-content:center;border:2px solid #fff">' + b.rang + '</div>' }) }).addTo(m).bindTooltip(b.identifiant);
            if (b.fix) { L.circleMarker([b.fix.lat, b.fix.lon], { radius: 5, color: '#ff7a00', fillOpacity: 0, weight: 2 }).addTo(m); L.polyline([[b.lat, b.lon], [b.fix.lat, b.fix.lon]], { color: '#ff7a00', weight: 1 }).addTo(m); }
          });
          m.fitBounds(pts, { padding: [24, 24] });
        }, 60);
      });
  }
})();
