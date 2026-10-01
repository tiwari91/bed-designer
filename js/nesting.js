/* Palang: guillotine sheet nesting with saw kerf. No DOM. Browser: window.BedCore; Node: require().
   Every layout it returns can be cut with straight, edge-to-edge (guillotine) cuts, the way a
   carpenter cuts plywood on a table saw or with a track saw. */
(function (root) {
  'use strict';
  var B = root.BedCore || (root.BedCore = {});
  if (typeof module === 'object' && module.exports) module.exports = B;

  var SORTS = {
    long: function (m, n) { return (n.a - m.a) || (n.b - m.b) || (m.i - n.i); },
    area: function (m, n) { return (n.a * n.b - m.a * m.b) || (n.a - m.a) || (m.i - n.i); },
    short: function (m, n) { return (n.b - m.b) || (n.a - m.a) || (m.i - n.i); }
  };
  // How a free rectangle is split after a piece is placed in its corner.
  var SPLITS = {
    shorterLeftover: function (rw, rh) { return rw < rh; },
    longerLeftover: function (rw, rh) { return rw >= rh; },
    alongLength: function () { return true; },   // rip the full sheet length first (strips)
    acrossWidth: function () { return false; }
  };
  // Lower score = better spot.
  var FITS = {
    shortSide: function (fw, fh) { return [Math.min(fw, fh), Math.max(fw, fh)]; },
    area: function (fw, fh, r) { return [r.w * r.h, Math.min(fw, fh)]; }
  };

  function packOnce(list, SW, SH, K, sortKey, splitKey, fitKey) {
    var CW = SW + K, CH = SH + K;
    var items = list.slice().sort(SORTS[sortKey]);
    var split = SPLITS[splitKey], fit = FITS[fitKey];
    var sheets = [];
    for (var n = 0; n < items.length; n++) {
      var p = items[n].p, best = null;
      for (var si = 0; si < sheets.length; si++) {
        var free = sheets[si].free;
        for (var ri = 0; ri < free.length; ri++) {
          var r = free[ri];
          for (var o = 0; o < 2; o++) {
            var pw = o ? p.h : p.w, ph = o ? p.w : p.h;
            var w = pw + K, h = ph + K;
            if (w > r.w || h > r.h) continue;
            var s = fit(r.w - w, r.h - h, r);
            if (!best || s[0] < best.s[0] || (s[0] === best.s[0] && s[1] < best.s[1])) {
              best = { s: s, si: si, ri: ri, w: pw, h: ph, rot: !!o };
            }
          }
        }
      }
      if (!best) {
        sheets.push({ free: [{ x: 0, y: 0, w: CW, h: CH }], placed: [] });
        var rot = !(p.w <= SW && p.h <= SH);
        best = { si: sheets.length - 1, ri: 0, w: rot ? p.h : p.w, h: rot ? p.w : p.h, rot: rot };
      }
      var sh = sheets[best.si], fr = sh.free[best.ri];
      var bw = best.w + K, bh = best.h + K, rw = fr.w - bw, rh = fr.h - bh, a, b;
      sh.placed.push({ x: fr.x, y: fr.y, w: best.w, h: best.h, rot: best.rot, ref: p.ref, label: p.label, piece: p });
      sh.free.splice(best.ri, 1);
      if (split(rw, rh)) { a = { x: fr.x + bw, y: fr.y, w: rw, h: bh }; b = { x: fr.x, y: fr.y + bh, w: fr.w, h: rh }; }
      else { a = { x: fr.x + bw, y: fr.y, w: rw, h: fr.h }; b = { x: fr.x, y: fr.y + bh, w: bw, h: rh }; }
      if (a.w > K && a.h > K) sh.free.push(a);
      if (b.w > K && b.h > K) sh.free.push(b);
    }
    return sheets;
  }

  /* pieces: [{ w, h, ref?, label? }] in mm. opt: { W: 2440, H: 1220, kerf: 4 }.
     Returns { sheets: [{ placed: [{x,y,w,h,rot,ref,label}], used }], count, oversize, usedM2, sheetM2, utilisation, strategy }. */
  function nest(pieces, opt) {
    opt = opt || {};
    var SW = opt.W || 2440, SH = opt.H || 1220, K = opt.kerf == null ? 4 : Number(opt.kerf);
    var oversize = [], list = [];
    (pieces || []).forEach(function (p, i) {
      if (!(p.w > 0 && p.h > 0)) return;
      var ok = (p.w <= SW && p.h <= SH) || (p.h <= SW && p.w <= SH);
      if (!ok) oversize.push(p);
      else list.push({ p: p, i: i, a: Math.max(p.w, p.h), b: Math.min(p.w, p.h) });
    });
    var best = null;
    Object.keys(SORTS).forEach(function (sk) {
      Object.keys(SPLITS).forEach(function (pk) {
        Object.keys(FITS).forEach(function (fk) {
          var sheets = packOnce(list, SW, SH, K, sk, pk, fk);
          // fewest sheets; then the emptiest last sheet (biggest usable offcut)
          var last = sheets.length ? sheets[sheets.length - 1].placed.reduce(function (t, q) { return t + q.w * q.h; }, 0) : 0;
          if (!best || sheets.length < best.sheets.length || (sheets.length === best.sheets.length && last < best.last)) {
            best = { sheets: sheets, last: last, strategy: sk + '/' + pk + '/' + fk };
          }
        });
      });
    });
    var used = 0;
    best.sheets.forEach(function (s) {
      s.used = s.placed.reduce(function (t, q) { return t + q.w * q.h; }, 0) / 1e6;
      used += s.used;
      delete s.free;
    });
    var sheetM2 = SW * SH / 1e6;
    return {
      sheets: best.sheets, count: best.sheets.length, oversize: oversize, usedM2: used, sheetM2: sheetM2,
      utilisation: best.sheets.length ? used / (best.sheets.length * sheetM2) : 0, strategy: best.strategy,
      kerf: K, W: SW, H: SH
    };
  }

  B.nest = nest;
})(typeof globalThis !== 'undefined' ? globalThis : this);
