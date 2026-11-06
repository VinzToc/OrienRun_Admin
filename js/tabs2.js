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
  A.addTab('etiquettes', '🏷️ Étiquettes', v => {
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
  A.addTab('export', '💾 Export / Import', v => {
    const b = A.base;
    v.innerHTML = '<div class="card"><h3>Base de référence</h3>' +
      (secretDefault() ? '<div class="warn">⚠ La clé de chiffrement par défaut est encore active (fichier <b>config.js</b>). Remplace-la par une phrase personnelle <b>identique dans l\'appli élève et dans cette appli</b> avant de diffuser les fichiers aux élèves.</div>' : '') +
      '<div class="grid2"><div class="field"><label>Nom de la base</label><input id="xN" value="' + esc(b.nom) + '"></div><div class="field"><label>Tolérance GPS (m)</label><input id="xS" inputmode="numeric" value="' + b.seuilGPS + '"></div></div>' +
      '<div class="note" style="margin-bottom:12px">' + b.balises.length + ' balises · ' + b.cartes.length + ' cartes · ' + b.parcours.length + ' parcours. Attention : la précision d\'un GPS de smartphone est souvent de 3 à 15 m ; une tolérance de 5 m peut refuser des balises correctement trouvées.</div>' +
      '<div class="col2 stack">' +
      '<div><button class="btn block" id="xE">📤 Base chiffrée pour les élèves (.xlsx)</button><div class="note" style="margin-top:6px">À déposer sur l\'ENT : illisible hors de l\'appli élève (codes et positions protégés).</div></div>' +
      '<div><button class="btn sec block" id="xA">🗄️ Sauvegarde complète (.xlsx chiffrée)</button><div class="note" style="margin-top:6px">Pour toi : inclut les images de cartes ; se réimporte ci-dessous.</div></div></div>' +
      '<div class="row nogrow" style="margin-top:14px"><button class="btn sec sm" id="xR">📋 Export lisible (codes visibles, .xlsx)</button><label class="btn sec sm" for="xF">📂 Restaurer une sauvegarde complète</label><input type="file" id="xF" accept=".xlsx" hidden></div>' +
      '<div class="err" id="xErr"></div></div>' +
      '<div class="card flat"><h3>Zone sensible</h3><button class="btn dng sm" id="xZ">🗑 Repartir d\'une base vide</button></div>';
    const syncMeta = () => { b.nom = $('xN').value.trim() || b.nom; const s = A.num($('xS').value); if (s != null && s > 0) b.seuilGPS = s; A.save(); };
    $('xN').onchange = syncMeta; $('xS').onchange = syncMeta;
    const stamp = () => O.slug(b.nom) + '_' + new Date().toISOString().slice(0, 10);
    $('xE').onclick = async () => {
      syncMeta(); if (!b.parcours.length) return toast('Crée au moins un parcours avant d\'exporter.');
      A.dlXlsx(await O.buildBaseWorkbook(XLSX, b, 'BASE'), 'OrienRun_BASE_ELEVES_' + stamp() + '.xlsx');
    };
    $('xA').onclick = async () => { syncMeta(); A.dlXlsx(await O.buildBaseWorkbook(XLSX, b, 'ADMIN'), 'OrienRun_SAUVEGARDE_ADMIN_' + stamp() + '.xlsx'); };
    $('xR').onclick = () => A.dlXlsx(O.buildBaseReadableWorkbook(XLSX, b), 'OrienRun_BASE_LISIBLE_' + stamp() + '.xlsx');
    $('xF').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const r = await O.readWorkbook(XLSX, XLSX.read(await f.arrayBuffer(), { type: 'array' }), ['ADMIN']);
        if (!confirm('Remplacer la base actuelle par « ' + r.data.nom + ' » (' + r.data.balises.length + ' balises, ' + r.data.parcours.length + ' parcours) ?')) return;
        A.base = r.data; await A.save(); A.render(); toast('Sauvegarde restaurée ✔');
      } catch (er) { $('xErr').textContent = '⚠ ' + er.message; }
    };
    $('xZ').onclick = async () => { if (confirm('Effacer toute la base actuelle (balises, cartes, parcours) ?\nPense à exporter une sauvegarde avant.')) { A.base = A.newBase(); await A.save(); A.render(); } };
  });

  /* ====================================================================
     COURSES ÉLÈVES
     ==================================================================== */
  let fc = { classe: '' };
  const who = r => r.groupe ? r.groupe + ' (' + [r.eleve].concat(r.partenaires || []).map(p => p.prenom + ' ' + p.nom).join(', ') + ')' : r.eleve.prenom + ' ' + r.eleve.nom;
  const cls = s => s >= 75 ? 'good' : s >= 40 ? 'mid' : 'bad';
  A.addTab('courses', '📊 Courses élèves', v => {
    const runs = A.runs.filter(r => !fc.classe || r.eleve.classe === fc.classe);
    const classes = Array.from(new Set(A.runs.map(r => r.eleve.classe))).sort();
    v.innerHTML = '<div class="card"><h3>Fichiers de course des élèves (' + A.runs.length + ')</h3>' +
      '<div class="bar"><label class="btn sm" for="cF">📂 Importer des fichiers (.xlsx)</label><input type="file" id="cF" accept=".xlsx" multiple hidden>' +
      '<select id="cCl" class="grow"><option value="">Toutes les classes</option>' + classes.map(c => '<option' + (fc.classe === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>' +
      '<button class="btn sec sm" id="cS"' + (A.runs.length ? '' : ' disabled') + '>📑 Synthèse (.xlsx)</button><button class="btn dng sm" id="cZ"' + (A.runs.length ? '' : ' disabled') + '>Vider</button></div>' +
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
    v.onclick = e => { const tr = e.target.closest('.runrow'); if (tr) detail(A.runs.find(r => r.id === tr.dataset.id)); };
  });

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
          A.mapLayers(m, img ? { 'Carte importée (hors ligne)': img } : null);
          if (img) { img.addTo(m); }
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
