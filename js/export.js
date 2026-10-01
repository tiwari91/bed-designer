/* Palang: carpenter sheet as HTML, as WhatsApp text, and as a PNG (SVG drawn to a canvas). */
(function (root) {
  'use strict';
  var B = root.BedCore, esc = B.esc;
  var LOGO = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#c4573a"/><path d="M9 11v18M9 22.5h22V29M9 18h7.5a4 4 0 0 1 4 4.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="13.2" cy="15" r="2.4" fill="#fff"/></svg>';

  function plural(u, n) { return n === 1 || u === 'm' || u === 'kg' || u === 'm²' || u === 'box of 100' ? u : u === 'pc' ? 'pcs' : u + 's'; }
  function today() { try { return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  function mmIn(a, b) { return a + ' × ' + b + ' mm'; }
  function inIn(a, b) { return B.inch(a) + ' × ' + B.inch(b); }

  function specs(d, mats) {
    var c = d.cfg, D = d.dims, out = [];
    out.push(['Mattress', c.w + '″ × ' + c.l + '″ × ' + c.mt + '″']);
    out.push(['Box (outer)', D.W + ' × ' + D.L + ' mm']);
    out.push(['Box height', D.H + ' mm (' + c.h + '″)']);
    out.push(['Overall', D.overallW + ' × ' + D.overallL + ' × ' + D.overallH + ' mm']);
    out.push(['Storage', c.storage === 'hydraulic' ? 'Hydraulic, ' + (c.lid === 'split' ? 'split lid' : 'single lid') : c.storage === 'drawers' ? '2 drawers' : 'None, on legs']);
    out.push(['Headboard', c.hb === 'none' ? 'None' : (c.hb === 'cushioned' ? 'Cushioned, ' : 'Plain, ') + D.HBH + ' mm (' + c.hbh + '″)']);
    out.push(['Side tables', c.tables ? '2 × 450 × 400 × ' + D.HT + ' mm' : 'No']);
    out.push(['Plywood', B.GRADES[c.grade]]);
    out.push(['Laminate', '1 mm ' + B.FINISHES[c.finish].label]);
    out.push(['Edge band', '22 × 0.8 mm, ' + B.FINISHES[c.finish].band]);
    if (mats.liftN) out.push(['Lift kit', mats.liftN + ' N struts × ' + d.lids.length + ' pair']);
    if (d.drawers.length) out.push(['Channels', d.drawers[0].depth + ' mm × ' + d.drawers.length + ' pair']);
    return out;
  }

  function sheetLines(mats) {
    var l = [];
    [18, 12, 9].forEach(function (t) {
      var p = mats.ply[t]; if (!p) return;
      l.push({ item: t + ' mm plywood, 8 × 4 ft', spec: p.nest.count + ' nested (' + Math.round(p.nest.utilisation * 100) + '% used), +' + mats.wastage + '% wastage', qty: p.buy, unit: 'sheet' });
    });
    if (mats.laminate.buy) l.push({ item: 'Laminate 1 mm, 8 × 4 ft', spec: mats.laminate.nest.count + ' nested, outer faces only', qty: mats.laminate.buy, unit: 'sheet' });
    l.push({ item: 'PVC edge band 22 × 0.8 mm', spec: mats.bandM + ' m measured, +' + mats.wastage + '%', qty: mats.bandBuyM, unit: 'm' });
    mats.hardware.forEach(function (h) { l.push({ item: h.name, spec: h.spec, qty: h.qty, unit: h.unit }); });
    return l;
  }

  function cutTable(mats) {
    var h = '<div class="table-wrap"><table><thead><tr><th>#</th><th>Part</th><th class="r">Qty</th><th class="r">L × W mm</th><th class="r">inches</th><th class="r">T</th><th>Edge band</th><th>Lam.</th></tr></thead><tbody>';
    mats.rows.forEach(function (r) {
      h += '<tr><td class="n">' + r.no + '</td><td>' + esc(r.name) + (r.note ? '<span class="sub">' + esc(r.note) + '</span>' : '') + '</td><td class="r">' + r.qty +
        '</td><td class="r">' + mmIn(r.a, r.b) + '</td><td class="r">' + inIn(r.a, r.b) + '</td><td class="r">' + r.t + '</td><td>' + esc(r.bandDesc) + '</td><td>' + (r.lam ? r.lam + ' face' : '—') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function matTable(mats) {
    var h = '<div class="table-wrap"><table><thead><tr><th>Item</th><th>Details</th><th class="r">Qty</th></tr></thead><tbody>';
    sheetLines(mats).forEach(function (l) {
      h += '<tr><td><b>' + esc(l.item) + '</b></td><td>' + esc(l.spec) + '</td><td class="r">' + l.qty + ' ' + esc(plural(l.unit, l.qty)) + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function sheetHTML(d, mats, link) {
    var c = d.cfg, s = B.drawingScale(d, 940);
    var views = ['front', 'side', 'top'].map(function (k) { return B.drawView(d, k, s).svg; }).join('');
    var lay = '';
    [18, 12, 9].forEach(function (t) {
      var p = mats.ply[t]; if (!p) return;
      p.nest.sheets.forEach(function (sh, i) {
        lay += '<div><div class="cap">' + t + ' mm · sheet ' + (i + 1) + ' of ' + p.nest.count + '</div>' + B.sheetSVG(sh, i, p.nest.count, t + ' mm', 300) + '</div>';
      });
    });
    return '<header class="sh-head"><div><div class="sh-brand">' + LOGO + 'Palang · carpenter sheet</div><h1>' + esc(B.title(c)) + '</h1><div class="meta">' + esc(B.summary(c)) + '</div></div>' +
      '<div class="meta">' + today() + '</div></header>' +
      '<div class="specs">' + specs(d, mats).map(function (r) { return '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div>' +
      '<h2>Drawings</h2><div class="drawings">' + views + '</div>' +
      '<h2>Cutting list</h2>' + cutTable(mats) +
      '<p class="meta">L = long edge, S = short edge to band. Sizes are finished sizes; saw kerf (' + mats.kerf + ' mm) is allowed for in the sheet layouts.</p>' +
      '<h2>Sheet layouts</h2><div class="mini-layouts">' + lay + '</div>' +
      '<h2>Materials &amp; hardware</h2>' + matTable(mats) +
      '<h2>Notes</h2><ol>' + B.notes(d, mats).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ol>' +
      '<div class="foot">Design link: ' + esc(link) + '<br>Check every size against the actual mattress and room before cutting.</div>';
  }

  function sheetText(d, mats, link) {
    var c = d.cfg, D = d.dims, L = [];
    L.push('*' + B.title(c) + '*');
    L.push(B.summary(c));
    L.push('');
    specs(d, mats).forEach(function (r) { L.push(r[0] + ': ' + r[1]); });
    L.push('');
    L.push('*Cutting list* (L × W × T mm)');
    mats.rows.forEach(function (r) {
      L.push(r.no + '. ' + r.name + ' ×' + r.qty + ' — ' + r.a + ' × ' + r.b + ' × ' + r.t + ' (' + inIn(r.a, r.b) + ')' +
        (r.bandDesc !== '—' ? ' · band ' + r.bandDesc : '') + (r.lam ? ' · lam ' + r.lam + ' face' : '') + (r.note ? ' · ' + r.note : ''));
    });
    L.push('');
    L.push('*Materials*');
    sheetLines(mats).forEach(function (l) { L.push('• ' + l.item + ': ' + l.qty + ' ' + plural(l.unit, l.qty) + ' (' + l.spec + ')'); });
    L.push('');
    L.push('*Notes*');
    B.notes(d, mats).forEach(function (n, i) { L.push((i + 1) + '. ' + n); });
    L.push('');
    L.push('Design (opens in 3D): ' + link);
    return L.join('\n');
  }

  /* Compose one tall SVG of the whole sheet and draw it onto a canvas. */
  function sheetSVGFull(d, mats, link) {
    var W = 1240, P = 48, y = 0, out = [], F = 'font-family="Helvetica Neue, Helvetica, Arial, sans-serif"';
    function t(x, yy, s, size, weight, fill, anchor) {
      out.push('<text x="' + x + '" y="' + yy + '" font-size="' + size + '" font-weight="' + (weight || 400) + '" fill="' + (fill || '#1f1b17') + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + esc(s) + '</text>');
    }
    function h2(s) { y += 40; t(P, y, s.toUpperCase(), 14, 700, '#a8442a'); y += 14; }
    function wrap(s, max) {
      var words = String(s).split(' '), lines = [], cur = '';
      words.forEach(function (w) { if ((cur + ' ' + w).length > max && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; });
      if (cur) lines.push(cur); return lines;
    }
    var c = d.cfg;
    y = 56;
    out.push('<g transform="translate(' + P + ',28) scale(0.8)">' + LOGO.replace('<svg ', '<svg width="40" height="40" ') + '</g>');
    t(P + 42, 50, 'Palang · carpenter sheet', 17, 700, '#c4573a');
    t(W - P, 50, today(), 14, 400, '#5d544b', 'end');
    y = 96; t(P, y, B.title(c), 32, 700);
    y += 28; t(P, y, B.summary(c), 16, 400, '#5d544b');
    y += 16; out.push('<rect x="' + P + '" y="' + y + '" width="' + (W - 2 * P) + '" height="2.5" fill="#1f1b17"/>');
    var sp = specs(d, mats), colW = (W - 2 * P) / 3;
    y += 30;
    sp.forEach(function (r, i) {
      var col = i % 3, row = Math.floor(i / 3), x = P + col * colW, yy = y + row * 26;
      t(x, yy, r[0], 13.5, 400, '#5d544b'); t(x + colW - 18, yy, r[1], 13.5, 700, '#1f1b17', 'end');
    });
    y += Math.ceil(sp.length / 3) * 26;
    h2('Drawings');
    var s = B.drawingScale(d, W - 2 * P), f = B.drawView(d, 'front', s), sd = B.drawView(d, 'side', s), tp = B.drawView(d, 'top', s);
    var nest = function (v, x, yy) { out.push(v.svg.replace('<svg ', '<svg x="' + x + '" y="' + yy + '" ')); };
    nest(f, P, y); nest(sd, P + f.w + 24, y); y += Math.max(f.h, sd.h) + 10;
    nest(tp, P, y);
    var lay = [], lx = P + tp.w + 30, lyy = y + 30, lw = Math.min(330, W - P - lx);
    if (lw > 200) {
      t(lx, y + 16, 'Sheet layouts (8 × 4 ft)', 14, 700);
      [18, 12, 9].forEach(function (th) {
        var p = mats.ply[th]; if (!p) return;
        p.nest.sheets.forEach(function (sh, i) { lay.push({ cap: th + ' mm · sheet ' + (i + 1) + ' of ' + p.nest.count, sh: sh }); });
      });
      var cols = Math.max(1, Math.floor((W - P - lx) / (lw / 1.6 + 12))), cw = (W - P - lx - (cols - 1) * 12) / cols;
      lay.forEach(function (l, i) {
        var cx = lx + (i % cols) * (cw + 12), cy = lyy + Math.floor(i / cols) * (cw / 2 + 30);
        t(cx, cy + 10, l.cap, 11.5, 600, '#5d544b');
        out.push(B.sheetSVG(l.sh, i, 0, '', Math.round(cw)).replace('<svg ', '<svg x="' + cx + '" y="' + (cy + 16) + '" '));
      });
      var layH = lay.length ? Math.ceil(lay.length / cols) * (cw / 2 + 30) + 30 : 0;
      y += Math.max(tp.h, layH);
    } else y += tp.h;
    h2('Cutting list');
    var cols2 = [[P, '#'], [P + 34, 'Part'], [P + 520, 'Qty', 'end'], [P + 680, 'L × W mm', 'end'], [P + 860, 'Inches', 'end'], [P + 910, 'T', 'end'], [P + 930, 'Band'], [P + 1040, 'Laminate']];
    y += 12; out.push('<rect x="' + P + '" y="' + (y - 4) + '" width="' + (W - 2 * P) + '" height="28" fill="#f3ede4"/>');
    cols2.forEach(function (cc) { t(cc[0] + (cc[2] ? 0 : 6), y + 14, cc[1], 12, 700, '#5d544b', cc[2]); });
    y += 28;
    mats.rows.forEach(function (r, i) {
      var rowH = r.note ? 38 : 26;
      if (i % 2) out.push('<rect x="' + P + '" y="' + (y - 4) + '" width="' + (W - 2 * P) + '" height="' + rowH + '" fill="#faf6f0"/>');
      var vals = [r.no, r.name, r.qty, r.a + ' × ' + r.b, inIn(r.a, r.b), r.t, r.bandDesc, r.lam ? r.lam + ' face' : '—'];
      cols2.forEach(function (cc, k) { t(cc[0] + (cc[2] ? 0 : 6), y + 13, vals[k], 13, k === 1 ? 600 : 400, k === 0 ? '#8a8076' : '#1f1b17', cc[2]); });
      if (r.note) t(P + 40, y + 29, r.note, 11.5, 400, '#8a8076');
      y += rowH;
    });
    h2('Materials & hardware');
    y += 6;
    sheetLines(mats).forEach(function (l) {
      t(P, y + 13, l.item, 13.5, 700); t(P + 470, y + 13, l.spec, 13, 400, '#5d544b'); t(W - P, y + 13, l.qty + ' ' + plural(l.unit, l.qty), 13.5, 700, '#1f1b17', 'end');
      out.push('<rect x="' + P + '" y="' + (y + 22) + '" width="' + (W - 2 * P) + '" height="1" fill="#e3dbcf"/>');
      y += 28;
    });
    h2('Notes');
    y += 6;
    B.notes(d, mats).forEach(function (n, i) {
      wrap(n, 150).forEach(function (line, k) { t(P + (k ? 22 : 0), y + 14, (k ? '' : (i + 1) + '.  ') + line, 13.5, 400); y += 21; });
      y += 4;
    });
    y += 20; out.push('<rect x="' + P + '" y="' + y + '" width="' + (W - 2 * P) + '" height="1" fill="#e3dbcf"/>');
    y += 24; wrap('Design link: ' + link, 160).forEach(function (line) { t(P, y, line, 12, 400, '#5d544b'); y += 17; });
    t(P, y + 4, 'Check every size against the actual mattress and room before cutting.', 12, 400, '#5d544b');
    y += 36;
    return { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + y + '" viewBox="0 0 ' + W + ' ' + y + '" ' + F + '><rect width="100%" height="100%" fill="#fffdf9"/>' + out.join('') + '</svg>', w: W, h: y };
  }

  function sheetPNG(d, mats, link) {
    var full = sheetSVGFull(d, mats, link);
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(2, Math.sqrt(16e6 / (full.w * full.h)));
        var cv = document.createElement('canvas');
        cv.width = Math.round(full.w * scale); cv.height = Math.round(full.h * scale);
        var g = cv.getContext('2d');
        g.fillStyle = '#fffdf9'; g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) { b ? resolve({ blob: b, width: cv.width, height: cv.height }) : reject(new Error('PNG encode failed')); }, 'image/png');
      };
      img.onerror = function () { reject(new Error('Could not render the sheet image')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(full.svg);
    });
  }

  root.BedExport = { sheetHTML: sheetHTML, sheetText: sheetText, sheetPNG: sheetPNG, sheetSVGFull: sheetSVGFull, sheetLines: sheetLines };
})(window);
