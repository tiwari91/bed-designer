/* Palang: materials, hardware, cost and carpenter notes derived from the geometry. No DOM. Browser: window.BedCore; Node: require(). */
(function (root) {
  'use strict';
  var B = root.BedCore || (root.BedCore = {});
  if (typeof module === 'object' && module.exports) module.exports = B;

  if (typeof require === 'function' && typeof module === 'object') { require('./geometry.js'); require('./nesting.js'); }
  var IN = B.IN, SHEET_L = B.SHEET_L, SHEET_W = B.SHEET_W, SHEET_M2 = B.SHEET_M2, FINISHES = B.FINISHES, FABRICS = B.FABRICS;
  var inch = B.inch, faceDims = B.faceDims, edgeLen = B.edgeLen;
  function nest(p, o) { return B.nest(p, o); }
  function fits(a, b) { return (a <= SHEET_L && b <= SHEET_W) || (a <= SHEET_W && b <= SHEET_L); }
  function splitToFit(a, b) {
    if (fits(a, b)) return { n: 1, a: a, b: b };
    for (var n = 2; n <= 6; n++) {
      if (fits(a, Math.ceil(b / n))) return { n: n, a: a, b: Math.ceil(b / n), joint: a };
      if (fits(Math.ceil(a / n), b)) return { n: n, a: Math.ceil(a / n), b: b, joint: b };
    }
    return { n: 1, a: a, b: b, oversize: true };
  }

  /* ---------- materials from geometry */
  var DEFAULT_PRICES = {
    ply18_bwp: 4200, ply18_mr: 2600, ply12_bwp: 3100, ply12_mr: 1950, ply9_bwp: 2500, ply9_mr: 1550,
    lam: 1400, band: 15, hyd: 2400, chan: 550, hinge: 120, handle: 250, screw: 120, fevicol: 480,
    foam: 1200, fabric: 450, leg: 450, bracket: 40, carp: 1400, helper: 800, misc: 1500
  };
  var PRICE_INFO = {
    ply18_bwp: ['18 mm BWP plywood', 'sheet'], ply18_mr: ['18 mm MR plywood', 'sheet'],
    ply12_bwp: ['12 mm BWP plywood', 'sheet'], ply12_mr: ['12 mm MR plywood', 'sheet'],
    ply9_bwp: ['9 mm BWP plywood', 'sheet'], ply9_mr: ['9 mm MR plywood', 'sheet'],
    lam: ['1 mm decorative laminate', 'sheet'], band: ['PVC edge band 22 × 0.8 mm', 'm'],
    hyd: ['Hydraulic bed-lift kit', 'pair'], chan: ['Telescopic drawer channel', 'pair'],
    hinge: ['Auto-close hinge', 'pc'], handle: ['Handle / pull', 'pc'], screw: ['Wood screws', 'box of 100'],
    fevicol: ['Fevicol (SH / Marine)', 'kg'], foam: ['PU foam 50 mm, 32 density', 'm²'],
    fabric: ['Upholstery fabric, 54″ roll', 'm'], leg: ['Solid-wood leg 75 × 75 mm', 'pc'],
    bracket: ['L-bracket', 'pc'], carp: ['Carpenter', 'day'], helper: ['Helper', 'day'],
    misc: ['Transport + sundries (sandpaper, nails, pins)', 'lump sum']
  };

  function suggestDays(c) {
    var d = { legs: 3, drawers: 5, hydraulic: 4 }[c.storage];
    if (c.hb === 'plain') d += 0.5;
    if (c.hb === 'cushioned') d += 1;
    if (c.tables) d += 1.5;
    if (c.w >= 72) d += 0.5;
    return d;
  }

  function liftRating(kg) {
    var table = [[30, 600], [45, 800], [60, 1000], [80, 1200], [1e9, 1500]];
    for (var i = 0; i < table.length; i++) if (kg <= table[i][0]) return table[i][1];
    return 1500;
  }

  function computeMaterials(design, opts) {
    opts = opts || {};
    var wastage = opts.wastage == null ? 10 : Number(opts.wastage);
    var kerf = opts.kerf == null ? 4 : Number(opts.kerf);
    var wf = 1 + wastage / 100;
    var c = design.cfg;
    var items = [];
    design.parts.forEach(function (p) {
      if (p.kind !== 'ply') return;
      var d = faceDims(p), a = d[0], b = d[1];
      var band = 0, L = 0, S = 0;
      p.band.forEach(function (dir) {
        var e = edgeLen(p, dir); band += e;
        if (Math.abs(e - a) <= Math.abs(e - b)) L++; else S++;
      });
      var bandDesc = (L ? L + 'L' : '') + (L && S ? ' ' : '') + (S ? S + 'S' : '') || '—';
      var cut = splitToFit(a, b);
      var note = p.holes && p.holes.length ? p.holes.length + ' drawer cut-out' + (p.holes.length > 1 ? 's' : '') + ' ' +
        Math.round(p.holes[0][5] - p.holes[0][2]) + ' × ' + Math.round(p.holes[0][4] - p.holes[0][1]) : '';
      if (cut.n > 1) {
        note = (note ? note + '; ' : '') + 'cut as ' + cut.n + ' pcs from ' + a + ' × ' + b + ', join on batten';
        for (var k = 0; k < cut.n; k++) {
          items.push({ name: p.name, a: Math.max(cut.a, cut.b), b: Math.min(cut.a, cut.b), t: p.t, band: Math.round(band / cut.n), bandDesc: 'outer edges', lam: p.lam.length, note: note });
        }
        for (var j = 0; j < cut.n - 1; j++) {
          items.push({ name: 'Joint batten', a: cut.joint, b: 100, t: 18, band: 0, bandDesc: '—', lam: 0, note: 'under ' + p.name.toLowerCase() + ' joint' });
        }
      } else {
        items.push({ name: p.name, a: a, b: b, t: p.t, band: band, bandDesc: bandDesc, lam: p.lam.length, note: note, oversize: cut.oversize });
      }
    });

    var rows = [], map = {};
    items.forEach(function (it) {
      var key = [it.name, it.a, it.b, it.t, it.bandDesc, it.lam, it.note].join('|');
      if (!map[key]) {
        map[key] = { name: it.name, a: it.a, b: it.b, t: it.t, qty: 0, band: it.band, bandDesc: it.bandDesc, lam: it.lam, note: it.note };
        rows.push(map[key]);
      }
      map[key].qty++;
    });
    rows.sort(function (m, n) { return (n.t - m.t) || (n.a * n.b - m.a * m.b); });
    rows.forEach(function (r, i) { r.no = i + 1; });

    var thick = [18, 12, 9];
    var ply = {};
    thick.forEach(function (t) {
      var pcs = [];
      rows.filter(function (r) { return r.t === t; }).forEach(function (r) {
        for (var q = 0; q < r.qty; q++) pcs.push({ w: r.a, h: r.b, ref: r.no, label: String(r.no) });
      });
      if (!pcs.length) return;
      var n = nest(pcs, { kerf: kerf });
      var area = n.usedM2;
      var buy = Math.max(n.count, Math.ceil(area * wf / SHEET_M2 - 1e-9));
      ply[t] = { nest: n, pieces: pcs.length, areaM2: area, withWastageM2: area * wf, buy: buy };
    });

    var lamPcs = [];
    rows.forEach(function (r) {
      for (var q = 0; q < r.qty * r.lam; q++) lamPcs.push({ w: r.a + 20, h: r.b + 20, ref: r.no, label: String(r.no) });
    });
    var lamNest = nest(lamPcs, { kerf: kerf });
    var lamArea = rows.reduce(function (t, r) { return t + r.qty * r.lam * r.a * r.b; }, 0) / 1e6;
    var lamBuy = lamPcs.length ? Math.max(lamNest.count, Math.ceil(lamNest.usedM2 * wf / SHEET_M2 - 1e-9)) : 0;

    var bandM = rows.reduce(function (t, r) { return t + r.qty * r.band; }, 0) / 1000;
    var plyAreaAll = rows.reduce(function (t, r) { return t + r.qty * r.a * r.b; }, 0) / 1e6;

    var s38 = 0, s25 = 0;
    rows.forEach(function (r) {
      var per = Math.ceil(2 * (r.a + r.b) / (r.t >= 18 ? 300 : 250));
      if (r.t >= 18) s38 += per * r.qty; else s25 += per * r.qty;
    });
    var r50 = function (n) { return Math.ceil(n * wf / 50) * 50; };
    s38 = r50(s38); s25 = r50(s25);

    var hw = [];
    var lidRating = 0;
    if (design.lids.length) {
      var maxKg = Math.max.apply(null, design.lids.map(function (l) { return l.kg; }));
      lidRating = liftRating(maxKg);
      hw.push({ key: 'hyd', name: 'Hydraulic bed-lift kit (pair of struts + brackets)', spec: '≈' + maxKg + ' kg per lid incl. mattress → ' + lidRating + ' N struts', qty: design.lids.length, unit: 'pair' });
    }
    if (design.drawers.length) {
      hw.push({ key: 'chan', name: 'Telescopic ball-bearing drawer channel', spec: design.drawers[0].depth + ' mm (' + inch(design.drawers[0].depth) + '), 35 kg+', qty: design.drawers.length, unit: 'pair' });
    }
    var doorsN = design.parts.filter(function (p) { return p.name === 'Side table: door'; }).length;
    if (doorsN) hw.push({ key: 'hinge', name: 'Auto-close hinge (full overlay, 0 crank)', spec: '2 per side-table door', qty: doorsN * 2, unit: 'pc' });
    var handles = design.drawers.length + design.lids.length + doorsN;
    if (handles) hw.push({ key: 'handle', name: 'Handles / pulls', spec: [design.drawers.length ? design.drawers.length + ' drawer' : '', design.lids.length ? design.lids.length + ' lid pull' : '', doorsN ? doorsN + ' door knob' : ''].filter(Boolean).join(', '), qty: handles, unit: 'pc' });
    var legsN = design.parts.filter(function (p) { return p.kind === 'timber'; }).length;
    if (legsN) {
      var lg = design.parts.filter(function (p) { return p.kind === 'timber'; })[0];
      hw.push({ key: 'leg', name: 'Solid-wood legs (sal / teak), 75 × 75 mm', spec: 'up to ' + Math.round(lg.box[4] - lg.box[1]) + ' mm long, ' + Math.round(design.parts.filter(function (p) { return p.kind === 'timber'; }).reduce(function (m, p) { return Math.min(m, p.box[1] === 0 ? (design.dims.H - 18 - 200) : m); }, 1e9)) + ' mm show below rail', qty: legsN, unit: 'pc' });
    }
    hw.push({ key: 'screw', name: 'Wood screws', spec: s38 + ' × 38 mm (1½″)' + (s25 ? ', ' + s25 + ' × 25 mm (1″)' : ''), qty: Math.ceil((s38 + s25) / 100), unit: 'box of 100' });
    var fevKg = Math.max(1, Math.ceil((0.12 * plyAreaAll + 0.3 * lamArea) * wf));
    hw.push({ key: 'fevicol', name: 'Fevicol SH / Marine', spec: 'joinery + laminate pasting', qty: fevKg, unit: 'kg' });
    var brackets = (c.hb !== 'none' ? 4 : 0) + (c.tables ? 4 : 0);
    if (brackets) hw.push({ key: 'bracket', name: 'L-brackets', spec: 'headboard / side tables to bed box', qty: brackets, unit: 'pc' });
    var foamM2 = 0, fabricM = 0;
    if (design.cushion) {
      foamM2 = Math.round(design.cushion.foamM2 * wf * 100) / 100;
      fabricM = Math.ceil(design.cushion.fabricM2 * wf / 1.37 * 10) / 10;
      hw.push({ key: 'foam', name: 'PU foam 50 mm (32 density)', spec: Math.round(design.cushion.x1 - design.cushion.x0) + ' × ' + Math.round(design.cushion.y1 - design.cushion.y0) + ' mm area', qty: foamM2, unit: 'm²' });
      hw.push({ key: 'fabric', name: 'Upholstery fabric (' + FABRICS[c.fab].label.toLowerCase() + '), 54″ wide', spec: 'with 120 mm wrap allowance', qty: fabricM, unit: 'm' });
    }

    return {
      rows: rows, ply: ply, laminate: { nest: lamNest, areaM2: lamArea, pieces: lamPcs.length, buy: lamBuy, withWastageM2: lamNest.usedM2 * wf },
      bandM: Math.round(bandM * 10) / 10, bandBuyM: Math.ceil(bandM * wf), hardware: hw, liftN: lidRating,
      wastage: wastage, kerf: kerf, plyAreaM2: plyAreaAll, screws: { s38: s38, s25: s25 }
    };
  }

  function computeCost(design, mats, prices, labour) {
    var P = {};
    for (var k in DEFAULT_PRICES) P[k] = prices && prices[k] != null && isFinite(prices[k]) ? Number(prices[k]) : DEFAULT_PRICES[k];
    var g = design.cfg.grade;
    var lines = [];
    [18, 12, 9].forEach(function (t) {
      if (!mats.ply[t]) return;
      var key = 'ply' + t + '_' + g;
      lines.push({ key: key, label: PRICE_INFO[key][0], qty: mats.ply[t].buy, unit: 'sheet', group: 'Sheet goods' });
    });
    if (mats.laminate.buy) lines.push({ key: 'lam', label: PRICE_INFO.lam[0] + ' (' + FINISHES[design.cfg.finish].label.toLowerCase() + ')', qty: mats.laminate.buy, unit: 'sheet', group: 'Sheet goods' });
    lines.push({ key: 'band', label: PRICE_INFO.band[0], qty: mats.bandBuyM, unit: 'm', group: 'Sheet goods' });
    mats.hardware.forEach(function (h) { lines.push({ key: h.key, label: PRICE_INFO[h.key][0], qty: h.qty, unit: h.unit, group: 'Hardware & consumables' }); });
    var days = labour && labour.days != null && isFinite(labour.days) ? Number(labour.days) : suggestDays(design.cfg);
    var hdays = Math.ceil(days / 2 * 2) / 2;
    hdays = Math.round(days * 0.5 * 2) / 2;
    lines.push({ key: 'carp', label: 'Carpenter', qty: days, unit: 'day', group: 'Labour' });
    lines.push({ key: 'helper', label: 'Helper', qty: hdays, unit: 'day', group: 'Labour' });
    lines.push({ key: 'misc', label: PRICE_INFO.misc[0], qty: 1, unit: 'lump sum', group: 'Labour' });
    var total = 0;
    lines.forEach(function (l) { l.price = P[l.key]; l.amount = l.qty * l.price; total += l.amount; });
    return { lines: lines, total: total, days: days, suggestedDays: suggestDays(design.cfg), prices: P };
  }

  function title(c) {
    var s = SIZES[c.size];
    var size = c.size === 'custom' ? 'Custom ' + c.w + '″ × ' + c.l + '″' : s.label + ' ' + s.ft;
    return size + ' bed';
  }
  function summary(c) {
    var st = c.storage === 'hydraulic' ? 'hydraulic lift, ' + (c.lid === 'split' ? 'split lid' : 'single lid')
      : c.storage === 'drawers' ? 'two drawers' : 'on legs, no storage';
    var hbS = c.hb === 'none' ? 'no headboard' : (c.hb === 'cushioned' ? 'cushioned' : 'plain') + ' headboard ' + c.hbh + '″';
    return st + ' · ' + hbS + (c.tables ? ' + side tables' : '') + ' · ' + FINISHES[c.finish].label.toLowerCase() + ' laminate';
  }

  function notes(design, mats) {
    var c = design.cfg, d = design.dims, out = [];
    out.push('Plywood: ' + (c.grade === 'bwp' ? 'BWP / IS 710 (water-proof) for every panel. Worth it for a bed box that sits on a mopped floor.' : 'MR / IS 303 (moisture resistant). Keep the box off a wet floor; BWP is the safer choice for the bottom.') + ' 18 mm for box, top, lid and headboard; 12 mm for drawer boxes and the cushion board; 9 mm for the storage floor and side-table backs.');
    out.push('Laminate: 1 mm ' + FINISHES[c.finish].label.toLowerCase() + ' on outer faces only (sides, foot, headboard front, drawer fronts, side tables). Inside faces stay raw or take a 0.8 mm liner if you want.');
    out.push('Edge band: 22 × 0.8 mm PVC, ' + FINISHES[c.finish].band + ' to match the laminate, on every exposed edge (L = long edge, S = short edge in the cutting list).');
    out.push('Joinery: screwed and glued (Fevicol on every joint, screws at about 250–300 mm centres, pre-drilled). Corners are butt joints with the side panels running full length; with a headboard, the headboard panel is the head end of the box.');
    if (c.storage === 'hydraulic') out.push('Hydraulic lift: ' + design.lids.length + ' kit' + (design.lids.length > 1 ? 's' : '') + ' (one pair of struts per lid). Lid + mattress ≈ ' + Math.max.apply(null, design.lids.map(function (l) { return l.kg; })) + ' kg per lid, so use ' + mats.liftN + ' N struts or the next size up. Screw the kit brackets to the underside of the 18 mm lid and to the side panels' + (d.hasDiv && c.lid === 'split' ? ' / centre divider' : '') + '. 140 mm fixed strip at the head end.');
    if (c.storage === 'drawers') out.push('Drawers: ' + design.drawers.length + ' drawers, ' + design.drawers[0].width + ' mm wide × ' + design.drawers[0].depth + ' mm deep on ' + design.drawers[0].depth + ' mm telescopic channels. Fronts sit flush, inset in the side cut-out with a 3 mm gap. The cut-out piece can become the drawer front.');
    if (c.storage === 'legs') out.push('Legs: solid wood 75 × 75 mm, glued and screwed inside the rail corners. ' + (d.H - 18 - 200) + ' mm of leg shows below the 200 mm rail; top platform at ' + d.H + ' mm.');
    else out.push('Box height ' + d.H + ' mm (' + inch(d.H) + ') to the top of the lid/platform; sits on the floor on 30 mm cleats. Add small felt or PVC pads under the box.');
    if (c.hb === 'cushioned') out.push('Cushioned headboard: 12 mm board + 50 mm PU foam (32 density), wrapped in ' + FABRICS[c.fab].label.toLowerCase() + ' fabric and stapled at the back, in ' + (design.cushion ? design.cushion.n : 3) + ' vertical channels. Screw the board to the backing panel from behind.');
    if (c.tables) out.push('Side tables: ' + 450 + ' × ' + 400 + ' mm, ' + d.HT + ' mm high (level with the mattress top). Open shelf above, door below on 2 hinges each. Bracket them to the headboard.');
    out.push('Mattress: ' + c.w + '″ × ' + c.l + '″ × ' + c.mt + '″. The box is 1″ (25 mm) bigger than the mattress in width and length.');
    out.push('Check the room before cutting: measure the mattress you actually have, and the door width the bed has to pass through.');
    return out;
  }

  B.fits = fits;
  B.splitToFit = splitToFit;
  B.DEFAULT_PRICES = DEFAULT_PRICES;
  B.PRICE_INFO = PRICE_INFO;
  B.suggestDays = suggestDays;
  B.liftRating = liftRating;
  B.computeMaterials = computeMaterials;
  B.computeCost = computeCost;
  B.title = title;
  B.summary = summary;
  B.notes = notes;
})(typeof globalThis !== 'undefined' ? globalThis : this);
