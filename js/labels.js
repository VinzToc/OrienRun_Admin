/* Génération du PDF d'étiquettes (QR en vectoriel). Utilisable dans le navigateur et sous Node pour les tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ORUN_LABELS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LAYOUTS = { 6: [2, 3], 8: [2, 4], 12: [3, 4], 20: [4, 5] };
  const COL = { Jaune: [255, 214, 0], Bleu: [47, 128, 255], Rouge: [255, 59, 59] };

  function qrMatrix(qrcode, text, ecc) {
    const q = qrcode(0, ecc || 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), m = [];
    for (let r = 0; r < n; r++) { m.push([]); for (let c = 0; c < n; c++) m[r].push(q.isDark(r, c)); }
    return m;
  }

  /* balises : [{couleur,identifiant,code}] ; opts : {parPage, afficherCode, titre, qrPayload(b)} */
  function buildPdf(jsPDF, qrcode, balises, opts) {
    opts = opts || {};
    const per = LAYOUTS[opts.parPage] ? opts.parPage : 8, [cols, rows] = LAYOUTS[per];
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const PW = 210, PH = 297, M = 10, gap = 3;
    const w = (PW - 2 * M - gap * (cols - 1)) / cols, h = (PH - 2 * M - gap * (rows - 1)) / rows;
    balises.forEach((b, i) => {
      if (i > 0 && i % per === 0) doc.addPage();
      const k = i % per, cx = k % cols, cy = Math.floor(k / cols);
      const x = M + cx * (w + gap), y = M + cy * (h + gap);
      doc.setDrawColor(120); doc.setLineWidth(0.25); doc.rect(x, y, w, h);
      const c = COL[b.couleur] || [150, 150, 150];
      doc.setFillColor(c[0], c[1], c[2]); doc.rect(x, y, w, Math.min(7, h * 0.07), 'F');
      const bandH = Math.min(7, h * 0.07);
      // identifiant
      doc.setTextColor(0); doc.setFont('helvetica', 'bold');
      const idSize = Math.min(26, h * 0.2); doc.setFontSize(idSize * 2.2 > 40 ? 40 : idSize * 1.9);
      let ident = String(b.identifiant); doc.setFontSize(Math.min(36, h * 0.27));
      while (doc.getTextWidth(ident) > w - 6 && doc.getFontSize() > 8) doc.setFontSize(doc.getFontSize() - 1);
      const idY = y + bandH + Math.min(14, h * 0.17);
      doc.text(ident, x + w / 2, idY, { align: 'center' });
      // QR
      const payload = opts.qrPayload ? opts.qrPayload(b) : ('ORUN:' + encodeURIComponent(b.identifiant) + ':' + b.code);
      const mat = qrMatrix(qrcode, payload, opts.logo ? 'H' : 'M'), n = mat.length;
      const reserve = opts.afficherCode ? Math.min(13, h * 0.16) : 4;
      const avail = Math.min(w - 8, y + h - (idY + 3) - reserve);
      const mod = avail / (n + 2); // marge de silence de 1 module de chaque côté (ajoutée par le fond blanc)
      const qx = x + (w - mod * n) / 2, qy = idY + 3 + (avail - mod * n) / 2 + mod;
      doc.setFillColor(0, 0, 0);
      for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) if (mat[r][cc]) doc.rect(qx + cc * mod, qy + r * mod, mod + 0.02, mod + 0.02, 'F');
      if (opts.logo) { // zone dégagée au centre (≈20 % du côté du QR, correction d'erreur H) + logo carré
        const side = mod * n, ls = side * 0.2, lx = qx + (side - ls) / 2, ly = qy + (side - ls) / 2, pad = ls * 0.08;
        doc.setFillColor(255, 255, 255); doc.rect(lx - pad, ly - pad, ls + 2 * pad, ls + 2 * pad, 'F');
        doc.addImage(opts.logo, /^data:image\/jpe?g/i.test(opts.logo) ? 'JPEG' : 'PNG', lx, ly, ls, ls);
      }
      if (opts.afficherCode) {
        doc.setFont('courier', 'bold'); doc.setFontSize(Math.min(24, h * 0.14));
        doc.text(String(b.code), x + w / 2, y + h - 2.5, { align: 'center' });
      } else if (opts.legende) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(110);
        doc.text(String(opts.legende), x + w / 2, y + h - 2, { align: 'center' });
      }
    });
    return doc;
  }
  return { LAYOUTS, buildPdf, qrMatrix };
});
