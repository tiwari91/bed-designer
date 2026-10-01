/* Palang: SVG drawings (front / side / top, dimensioned) and sheet-layout diagrams.
   Pure string builders, projected from the same parts as the 3D model. */
(function (root) {
  'use strict';
  var B = root.BedCore || (root.BedCore = {});
  if (typeof module === 'object' && module.exports) module.exports = B;

  var FONT = "font-family=\"'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif\"";
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function lbl(mm) { return Math.round(mm) + ' mm · ' + (mm >= 610 ? B.ftIn(mm) : B.inch(mm)); }
  function tint(hex, f) {
    var n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return 'rgb(' + c.map(function (v) { return Math.round(v + (255 - v) * f); }).join(',') + ')';
  }

  var VIEWS = {
    front: { title: 'Front view', sub: 'from the foot end', u: 0, v: 1, depth: function (b) { return b[5]; }, face: '+z', flipU: false },
    side: { title: 'Side view', sub: 'from the left', u: 2, v: 1, depth: function (b) { return -b[0]; }, face: '-x', flipU: false },
    top: { title: 'Top view', sub: 'plan, head end at top', u: 0, v: 2, depth: function (b) { return b[4]; }, face: '+y', flipU: false, vDown: true }
  };

  function extents(d, key) {
    var V = VIEWS[key], lo = [1e9, 1e9], hi = [-1e9, -1e9];
    d.parts.forEach(function (p) {
      var b = p.box;
      lo[0] = Math.min(lo[0], b[V.u]); hi[0] = Math.max(hi[0], b[V.u + 3]);
      lo[1] = Math.min(lo[1], b[V.v]); hi[1] = Math.max(hi[1], b[V.v + 3]);
    });
    var m = d.mattress.box;
    lo[0] = Math.min(lo[0], m[V.u]); hi[0] = Math.max(hi[0], m[V.u + 3]);
    lo[1] = Math.min(lo[1], m[V.v]); hi[1] = Math.max(hi[1], m[V.v + 3]);
    return { lo: lo, hi: hi, w: hi[0] - lo[0], h: hi[1] - lo[1] };
  }

  /* One scale for all three views so they read as a set. */
  function drawingScale(d, maxWidthPx) {
    var f = extents(d, 'front'), s = extents(d, 'side'), t = extents(d, 'top');
    var W = maxWidthPx || 1040;
    return Math.min((W - 2 * 2 * 78) / (f.w + s.w), 420 / Math.max(f.h, s.h), (W - 160) / t.w, 560 / t.h);
  }

  function view(d, key, scale, opt) {
    opt = opt || {};
    var V = VIEWS[key], ex = extents(d, key), P = 78, PT = 46, s = scale;
    var fin = B.FINISHES[d.cfg.finish].color, fab = B.FABRICS[d.cfg.fab].color;
    var Wpx = Math.round(ex.w * s + 2 * P), Hpx = Math.round(ex.h * s + P + PT + 26);
    var X = function (u) { return P + (u - ex.lo[0]) * s; };
    var Y = V.vDown ? function (v) { return PT + 14 + (v - ex.lo[1]) * s; } : function (v) { return PT + 14 + (ex.hi[1] - v) * s; };
    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + Wpx + '" height="' + Hpx + '" viewBox="0 0 ' + Wpx + ' ' + Hpx + '" ' + FONT + ' class="drawing">');
    out.push('<text x="' + 8 + '" y="20" font-size="15" font-weight="700" fill="#1f1b17">' + V.title + '</text>');
    out.push('<text x="' + 8 + '" y="37" font-size="11.5" fill="#6f665d">' + V.sub + '</text>');
    var boxes = [];
    d.parts.forEach(function (p) {
      B.solidBoxes(p).forEach(function (b) { boxes.push({ b: b, p: p }); });
    });
    if (d.cushion) {
      var cu = d.cushion, cw = (cu.x1 - cu.x0) / cu.n;
      for (var k = 0; k < cu.n; k++) boxes.push({ b: [cu.x0 + k * cw, cu.y0, cu.z0, cu.x0 + (k + 1) * cw, cu.y1, cu.z1], p: { kind: 'fabric', lam: [] } });
    }
    boxes.sort(function (a, c) { return V.depth(a.b) - V.depth(c.b); });
    boxes.forEach(function (o) {
      var b = o.b, p = o.p;
      var x0 = X(b[V.u]), x1 = X(b[V.u + 3]), y0 = Y(b[V.v]), y1 = Y(b[V.v + 3]);
      var fill = p.kind === 'fabric' ? tint(fab, 0.45) : p.kind === 'timber' ? tint(fin, 0.55) : (p.lam.indexOf(V.face) >= 0 ? tint(fin, 0.72) : '#ffffff');
      var w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      if (w < 0.3 || h < 0.3) return;
      out.push('<rect x="' + Math.min(x0, x1).toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + fill + '" stroke="#2b2621" stroke-width="0.9"/>');
    });
    // mattress, dashed
    var m = d.mattress.box;
    out.push('<rect x="' + X(m[V.u]).toFixed(1) + '" y="' + Math.min(Y(m[V.v]), Y(m[V.v + 3])).toFixed(1) + '" width="' + ((m[V.u + 3] - m[V.u]) * s).toFixed(1) + '" height="' + ((m[V.v + 3] - m[V.v]) * s).toFixed(1) + '" rx="6" fill="none" stroke="#8a7f74" stroke-width="1" stroke-dasharray="5 4"/>');
    if (key === 'top' && d.cfg.storage === 'hydraulic' && d.lids.length > 1) {
      out.push('<line x1="' + X(0) + '" y1="' + Y(d.dims.S) + '" x2="' + X(0) + '" y2="' + Y(d.dims.L) + '" stroke="#c4573a" stroke-width="1.2" stroke-dasharray="7 4"/>');
    }
    if (key === 'front') out.push('<line x1="' + (P - 30) + '" y1="' + Y(0) + '" x2="' + (Wpx - P + 30) + '" y2="' + Y(0) + '" stroke="#2b2621" stroke-width="1.6"/>');
    if (key === 'side') out.push('<line x1="' + (P - 30) + '" y1="' + Y(0) + '" x2="' + (Wpx - P + 30) + '" y2="' + Y(0) + '" stroke="#2b2621" stroke-width="1.6"/>');

    var dims = [];
    function dimH(u0, u1, v, off, text) { dims.push({ t: 'h', a: X(u0), b: X(u1), c: Y(v), off: off, text: text }); }
    function dimV(v0, v1, u, off, text) { dims.push({ t: 'v', a: Y(v0), b: Y(v1), c: X(u), off: off, text: text }); }
    var D = d.dims, xl = -D.W / 2, xr = D.W / 2;
    if (key === 'front') {
      dimH(xl, xr, 0, 30, 'Box ' + lbl(D.W));
      if (D.overallW > D.W + 1) dimH(-D.overallW / 2, D.overallW / 2, 0, 56, 'Overall ' + lbl(D.overallW));
      dimV(0, D.H, ex.hi[0], 26, lbl(D.H));
      if (D.HBH) dimV(0, D.HBH, ex.lo[0], -26, 'Headboard ' + lbl(D.HBH));
      if (D.HT) dimV(0, D.HT, ex.hi[0], 52, 'Table ' + lbl(D.HT));
    } else if (key === 'side') {
      dimH(0, D.L, 0, 30, 'Box ' + lbl(D.L));
      if (ex.lo[0] < -1) dimH(ex.lo[0], ex.hi[0], 0, 56, 'Overall ' + lbl(ex.w));
      dimV(0, D.H, ex.hi[0], 26, lbl(D.H));
      dimV(D.H, D.H + D.mt, ex.hi[0], 52, 'Mattress ' + lbl(D.mt));
      if (d.drawers.length) {
        var sidePart = d.parts.filter(function (p) { return p.holes && p.holes.length; })[0];
        if (sidePart) { var h = sidePart.holes[0]; dimH(h[2], h[5], h[4], -14, 'Drawer opening ' + Math.round(h[5] - h[2]) + ' × ' + Math.round(h[4] - h[1])); }
      }
      if (d.cfg.storage === 'hydraulic') dimH(0, D.S, D.H, -14, D.S + ' strip');
    } else {
      dimH(xl, xr, ex.hi[1], 30, lbl(D.W));
      dimV(0, D.L, ex.hi[0], 26, lbl(D.L));
      if (D.HT) dimH(xr + 20, xr + 470, ex.lo[1], -14, '450 × 400 table');
    }
    dims.forEach(function (q) {
      var c = '#c4573a';
      if (q.t === 'h') {
        var y = q.c + q.off, a = Math.min(q.a, q.b), b = Math.max(q.a, q.b);
        out.push('<g stroke="' + c + '" stroke-width="1"><line x1="' + a + '" y1="' + y + '" x2="' + b + '" y2="' + y + '"/>' +
          '<line x1="' + a + '" y1="' + (y - 6) + '" x2="' + a + '" y2="' + (y + 6) + '"/><line x1="' + b + '" y1="' + (y - 6) + '" x2="' + b + '" y2="' + (y + 6) + '"/>' +
          '<line x1="' + (a - 4) + '" y1="' + (y + 4) + '" x2="' + (a + 4) + '" y2="' + (y - 4) + '"/><line x1="' + (b - 4) + '" y1="' + (y + 4) + '" x2="' + (b + 4) + '" y2="' + (y - 4) + '"/></g>');
        out.push('<text x="' + ((a + b) / 2) + '" y="' + (y - 5) + '" font-size="11.5" font-weight="600" text-anchor="middle" fill="' + c + '" paint-order="stroke" stroke="#fff" stroke-width="3">' + esc(q.text) + '</text>');
      } else {
        var x = q.c + q.off, top = Math.min(q.a, q.b), bot = Math.max(q.a, q.b);
        out.push('<g stroke="' + c + '" stroke-width="1"><line x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + bot + '"/>' +
          '<line x1="' + (x - 6) + '" y1="' + top + '" x2="' + (x + 6) + '" y2="' + top + '"/><line x1="' + (x - 6) + '" y1="' + bot + '" x2="' + (x + 6) + '" y2="' + bot + '"/>' +
          '<line x1="' + (x - 4) + '" y1="' + (top + 4) + '" x2="' + (x + 4) + '" y2="' + (top - 4) + '"/><line x1="' + (x - 4) + '" y1="' + (bot + 4) + '" x2="' + (x + 4) + '" y2="' + (bot - 4) + '"/></g>');
        var tx = x + (q.off < 0 ? -6 : 6), ty = (top + bot) / 2;
        out.push('<text x="' + tx + '" y="' + ty + '" font-size="11.5" font-weight="600" text-anchor="middle" fill="' + c + '" paint-order="stroke" stroke="#fff" stroke-width="3" transform="rotate(-90 ' + tx + ' ' + ty + ')" dy="' + (q.off < 0 ? -2 : 10) + '">' + esc(q.text) + '</text>');
      }
    });
    out.push('</svg>');
    return { svg: out.join(''), w: Wpx, h: Hpx };
  }

  function hue(n) { return 'hsl(' + ((n * 47) % 360) + ' 55% 86%)'; }

  /* Sheet layout diagram for one nested sheet. */
  function sheetSVG(sheet, idx, total, label, widthPx) {
    var Wpx = widthPx || 360, s = (Wpx - 2) / 2440, Hpx = Math.round(1220 * s) + 2;
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + Wpx + '" height="' + Hpx + '" viewBox="0 0 ' + Wpx + ' ' + Hpx + '" ' + FONT + ' class="sheet-svg" role="img" aria-label="' + esc(label + ' sheet ' + (idx + 1) + ' of ' + total) + '">'];
    out.push('<rect x="1" y="1" width="' + (Wpx - 2) + '" height="' + (Hpx - 2) + '" fill="#f6efe3" stroke="#a89a88" stroke-width="1" stroke-dasharray="3 3"/>');
    sheet.placed.forEach(function (p) {
      var x = 1 + p.x * s, y = 1 + p.y * s, w = p.w * s, h = p.h * s;
      out.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + hue(p.ref) + '" stroke="#4b4036" stroke-width="0.8"/>');
      var big = w > 34 && h > 15;
      if (big) {
        out.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2 + (h > 34 ? -2 : 4)).toFixed(1) + '" font-size="11" font-weight="700" text-anchor="middle" fill="#2b2621">' + esc(p.label) + '</text>');
        if (h > 34 && w > 70) out.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2 + 11).toFixed(1) + '" font-size="9" text-anchor="middle" fill="#4b4036">' + Math.round(p.w) + '×' + Math.round(p.h) + '</text>');
      } else if (w > 10 && h > 6) {
        out.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + h / 2 + 3).toFixed(1) + '" font-size="7.5" font-weight="700" text-anchor="middle" fill="#2b2621">' + esc(p.label) + '</text>');
      }
    });
    out.push('</svg>');
    return out.join('');
  }

  B.drawingScale = drawingScale;
  B.drawView = view;
  B.sheetSVG = sheetSVG;
  B.esc = esc;
  B.dimLabel = lbl;
})(typeof globalThis !== 'undefined' ? globalThis : this);
