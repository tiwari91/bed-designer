/* Palang: constants, share-link encoding, formatting and the parametric bed geometry. No DOM. Browser: window.BedCore; Node: require(). */
(function (root) {
  'use strict';
  var B = root.BedCore || (root.BedCore = {});
  if (typeof module === 'object' && module.exports) module.exports = B;
  var IN = 25.4;
  var SHEET_L = 2440, SHEET_W = 1220;
  var SHEET_M2 = SHEET_L * SHEET_W / 1e6;

  var SIZES = {
    single: { label: 'Single', ft: '3 × 6.5 ft', w: 36, l: 78 },
    double: { label: 'Double', ft: '4 × 6.5 ft', w: 48, l: 78 },
    queen: { label: 'Queen', ft: '5 × 6.5 ft', w: 60, l: 78 },
    king: { label: 'King', ft: '6 × 6.5 ft', w: 72, l: 78 },
    custom: { label: 'Custom', ft: 'in inches' }
  };
  var FINISHES = {
    walnut: { label: 'Walnut', color: '#5b3b28', band: 'walnut brown' },
    teak: { label: 'Teak', color: '#a4683b', band: 'teak' },
    oak: { label: 'Oak', color: '#c9a77a', band: 'light oak' },
    white: { label: 'Frosty white', color: '#eeebe5', band: 'white' },
    grey: { label: 'Slate grey', color: '#7f8387', band: 'grey' }
  };
  var FABRICS = {
    linen: { label: 'Linen beige', color: '#cbbb9f' },
    sage: { label: 'Sage', color: '#8f9e88' },
    indigo: { label: 'Indigo', color: '#3c4a6b' },
    mustard: { label: 'Mustard', color: '#c39434' },
    charcoal: { label: 'Charcoal', color: '#4a4846' }
  };
  var STORAGE = { legs: 'No storage (on legs)', drawers: 'Two drawers', hydraulic: 'Hydraulic lift' };
  var HEADBOARDS = { none: 'No headboard', plain: 'Plain panel', cushioned: 'Cushioned (padded)' };
  var GRADES = { bwp: 'BWP (IS 710)', mr: 'MR (IS 303)' };

  var DEFAULTS = {
    size: 'queen', w: 60, l: 78, h: 18, storage: 'hydraulic', lid: 'single',
    hb: 'plain', hbh: 42, tables: false, finish: 'walnut', fab: 'linen',
    wall: '#e9e1d4', grade: 'bwp', mt: 6
  };

  function clampNum(v, lo, hi, d) {
    v = Number(v);
    if (!isFinite(v)) return d;
    return Math.min(hi, Math.max(lo, v));
  }

  function normalize(s) {
    s = s || {};
    var o = {};
    o.size = SIZES[s.size] ? s.size : DEFAULTS.size;
    if (o.size !== 'custom') { o.w = SIZES[o.size].w; o.l = SIZES[o.size].l; }
    else { o.w = Math.round(clampNum(s.w, 30, 84, 60)); o.l = Math.round(clampNum(s.l, 72, 84, 78)); }
    o.h = Math.round(clampNum(s.h, 14, 20, DEFAULTS.h));
    o.storage = STORAGE[s.storage] ? s.storage : DEFAULTS.storage;
    o.lid = s.lid === 'split' ? 'split' : 'single';
    o.hb = HEADBOARDS[s.hb] ? s.hb : DEFAULTS.hb;
    o.mt = [5, 6, 8].indexOf(Number(s.mt)) >= 0 ? Number(s.mt) : DEFAULTS.mt;
    o.hbh = Math.round(clampNum(s.hbh, 30, 54, DEFAULTS.hbh));
    if (o.hbh < o.h + o.mt + 6) o.hbh = o.h + o.mt + 6;
    o.tables = s.tables === true || s.tables === 1 || s.tables === '1' || s.tables === 'true';
    o.finish = FINISHES[s.finish] ? s.finish : DEFAULTS.finish;
    o.fab = FABRICS[s.fab] ? s.fab : DEFAULTS.fab;
    o.wall = /^#[0-9a-f]{6}$/i.test(s.wall || '') ? String(s.wall).toLowerCase() : DEFAULTS.wall;
    o.grade = s.grade === 'mr' ? 'mr' : 'bwp';
    return o;
  }

  /* ---------- share-link encoding: #bed=v1,queen,60,78,18,hydraulic,single,plain,42,0,walnut,linen,e9e1d4,bwp,6 */
  var ORDER = ['size', 'w', 'l', 'h', 'storage', 'lid', 'hb', 'hbh', 'tables', 'finish', 'fab', 'wall', 'grade', 'mt'];
  function encode(cfg) {
    var c = normalize(cfg);
    return 'v1,' + ORDER.map(function (k) {
      if (k === 'wall') return c.wall.slice(1);
      if (k === 'tables') return c.tables ? 1 : 0;
      return c[k];
    }).join(',');
  }
  function decode(str) {
    if (!str) return null;
    var a = String(str).split(',');
    if (a[0] !== 'v1' || a.length < ORDER.length + 1) return null;
    var o = {};
    ORDER.forEach(function (k, i) { o[k] = a[i + 1]; });
    o.wall = '#' + o.wall;
    o.tables = o.tables === '1';
    return normalize(o);
  }

  /* ---------- formatting */
  var FR = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
  function inch(mm) {
    var e = Math.round(mm / IN * 8);
    var whole = Math.floor(e / 8), f = e % 8;
    return (whole || !f ? whole : '') + FR[f] + '″';
  }
  function ftIn(mm) {
    var t = Math.round(mm / IN);
    var ft = Math.floor(t / 12), i = t - ft * 12;
    return ft + '′ ' + i + '″';
  }
  function inr(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }

  /* ---------- geometry helpers. Boxes are [x0,y0,z0,x1,y1,z1] in mm.
     x = across the bed, y = up, z = from head (0) to foot. */
  var AXI = { x: 0, y: 1, z: 2 };
  function bsize(b) { return [b[3] - b[0], b[4] - b[1], b[5] - b[2]]; }
  function thickAxis(p) {
    var s = bsize(p.box), best = 0, d = 1e9;
    for (var i = 0; i < 3; i++) { var e = Math.abs(s[i] - p.t); if (e < d) { d = e; best = i; } }
    return best;
  }
  function faceDims(p) {
    var s = bsize(p.box), ta = thickAxis(p);
    var o = [0, 1, 2].filter(function (i) { return i !== ta; }).map(function (i) { return Math.round(s[i]); });
    return o.sort(function (a, b) { return b - a; });
  }
  function edgeLen(p, dir) {
    var s = bsize(p.box), ta = thickAxis(p), da = AXI[dir[1]];
    for (var i = 0; i < 3; i++) if (i !== ta && i !== da) return Math.round(s[i]);
    return 0;
  }

  /* Split a panel into solid boxes around its holes (used by 3D and drawings). */
  function solidBoxes(p) {
    if (!p.holes || !p.holes.length) return [p.box.slice()];
    var ta = thickAxis(p);
    var ax = [0, 1, 2].filter(function (i) { return i !== ta; });
    var u = ax[0], v = ax[1], b = p.box;
    var us = [b[u], b[u + 3]], vs = [b[v], b[v + 3]];
    p.holes.forEach(function (h) { us.push(h[u], h[u + 3]); vs.push(h[v], h[v + 3]); });
    var num = function (a, c) { return a - c; };
    us = us.filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(num);
    vs = vs.filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(num);
    var out = [];
    for (var j = 0; j < vs.length - 1; j++) {
      var run = null;
      for (var i = 0; i < us.length - 1; i++) {
        var cu = (us[i] + us[i + 1]) / 2, cv = (vs[j] + vs[j + 1]) / 2;
        var inHole = p.holes.some(function (h) { return cu > h[u] && cu < h[u + 3] && cv > h[v] && cv < h[v + 3]; });
        if (!inHole) {
          if (run) run[u + 3] = us[i + 1];
          else { run = b.slice(); run[u] = us[i]; run[u + 3] = us[i + 1]; run[v] = vs[j]; run[v + 3] = vs[j + 1]; out.push(run); }
        } else run = null;
      }
    }
    return out;
  }

  /* ---------- the parametric bed */
  function buildDesign(input) {
    var c = normalize(input);
    var T = 18, F = 9, CL = 30, S = 140, CUSH_D = 62;
    var mw = Math.round(c.w * IN), ml = Math.round(c.l * IN), mt = Math.round(c.mt * IN);
    var H = Math.round(c.h * IN), hb = c.hb, cush = hb === 'cushioned';
    var W = mw + 25;  // box is 1" bigger than the mattress (12.5 mm reveal each side)
    var mz0 = cush ? CUSH_D + 12 : 12;
    var L = mz0 + ml + 13;
    var xl = -W / 2, xr = W / 2, hasDiv = W > 1100, yTop = H - T;
    var parts = [], lids = [], drawers = [], decor = [];
    var pid = 0;
    function add(p) {
      var q = { kind: 'ply', lam: [], band: [], group: 'static', holes: null, note: '' };
      for (var k in p) q[k] = p[k];
      q.id = 'p' + (++pid);
      parts.push(q);
      return q;
    }
    var headVisible = hb === 'none' && !c.tables;

    if (c.storage !== 'legs') {
      var sideBand = headVisible ? ['+z', '-z'] : ['+z'];
      var sL = add({ name: 'Side panel', t: T, box: [xl, 0, 0, xl + T, yTop, L], lam: ['-x'], band: sideBand, holes: [] });
      var sR = add({ name: 'Side panel', t: T, box: [xr - T, 0, 0, xr, yTop, L], lam: ['+x'], band: sideBand, holes: [] });
      // With a headboard, the headboard panel is the head end of the box; otherwise the box gets its own head panel.
      var Z = hb !== 'none' ? 0 : T;
      if (hb === 'none') add({ name: 'Head panel', t: T, box: [xl + T, 0, 0, xr - T, yTop, T], lam: headVisible ? ['-z'] : [] });
      add({ name: 'Foot panel', t: T, box: [xl + T, 0, L - T, xr - T, yTop, L], lam: ['+z'] });
      add({ name: 'Floor cleat', t: T, box: [xl + T, 0, Z, xl + 2 * T, CL, L - T] });
      add({ name: 'Floor cleat', t: T, box: [xr - 2 * T, 0, Z, xr - T, CL, L - T] });
      add({ name: 'Floor cleat', t: T, box: [xl + 2 * T, 0, Z, xr - 2 * T, CL, Z + T] });
      add({ name: 'Floor cleat', t: T, box: [xl + 2 * T, 0, L - 2 * T, xr - 2 * T, CL, L - T] });
      if (hasDiv) {
        add({ name: 'Floor cleat', t: T, box: [-T / 2, 0, Z + T, T / 2, CL, L - 2 * T] });
        add({ name: 'Storage floor', t: F, box: [xl + T, CL, Z, 0, CL + F, L - T] });
        add({ name: 'Storage floor', t: F, box: [0, CL, Z, xr - T, CL + F, L - T] });
        add({ name: 'Centre divider', t: T, box: [-T / 2, CL + F, Z, T / 2, yTop, L - T] });
      } else {
        add({ name: 'Storage floor', t: F, box: [xl + T, CL, Z, xr - T, CL + F, L - T] });
      }

      if (c.storage === 'drawers') {
        var CH = 13, oy0 = 70, oy1 = yTop - 35, openH = oy1 - oy0;
        var avail = hasDiv ? (W / 2 - T - T / 2) : (W - 2 * T);
        var depth = [600, 550, 500, 450, 400, 350, 300].filter(function (d) { return d <= avail - 40; })[0] || 300;
        var Dw = hasDiv ? Math.min(760, Math.floor((L - 2 * T) / 2) - 2 * CH - T)
          : Math.min(700, Math.floor((L - 4 * T) / 2) - 2 * CH);
        var bl = Dw + 2 * CH;
        var bays = [];
        if (hasDiv) {
          bays.push({ side: -1, z1: L - T });
          bays.push({ side: 1, z1: L - T });
        } else {
          bays.push({ side: 1, z1: L - T });
          bays.push({ side: 1, z1: L - T - bl - T });
        }
        bays.forEach(function (bay, i) {
          var z1 = bay.z1, z0 = z1 - bl, sd = bay.side, g = 'drawer' + i;
          var px0 = hasDiv ? (sd < 0 ? xl + T : T / 2) : xl + T;
          var px1 = hasDiv ? (sd < 0 ? -T / 2 : xr - T) : xr - T;
          add({ name: 'Drawer bay partition', t: T, box: [px0, CL + F, z0 - T, px1, yTop, z0] });
          var side = sd < 0 ? sL : sR;
          side.holes.push([side.box[0], oy0, z0, side.box[3], oy1, z1]);
          var fx0 = sd < 0 ? xl : xr - T;
          add({ name: 'Drawer front', t: T, box: [fx0, oy0 + 3, z0 + 3, fx0 + T, oy1 - 3, z1 - 3], lam: [sd < 0 ? '-x' : '+x'], band: ['+y', '-y', '+z', '-z'], group: g });
          var bx0 = sd < 0 ? xl + T : xr - T - depth, bx1 = bx0 + depth;
          var yb = oy0 + 3, bh = openH - 38;
          add({ name: 'Drawer bottom', t: 12, box: [bx0, yb, z0 + CH, bx1, yb + 12, z1 - CH], group: g });
          add({ name: 'Drawer side', t: 12, box: [bx0, yb + 12, z0 + CH, bx1, yb + 12 + bh, z0 + CH + 12], group: g });
          add({ name: 'Drawer side', t: 12, box: [bx0, yb + 12, z1 - CH - 12, bx1, yb + 12 + bh, z1 - CH], group: g });
          var bkx = sd < 0 ? bx1 - 12 : bx0;
          add({ name: 'Drawer back', t: 12, box: [bkx, yb + 12, z0 + CH + 12, bkx + 12, yb + 12 + bh, z1 - CH - 12], group: g });
          drawers.push({ group: g, dir: sd, travel: Math.round(depth * 0.82), depth: depth, width: Dw, height: bh + 12 });
        });
        add({ name: 'Top platform', t: T, box: [xl, yTop, 0, xr, H, L], band: headVisible ? ['+x', '-x', '+z', '-z'] : ['+x', '-x', '+z'] });
      } else {
        add({ name: 'Fixed head strip', t: T, box: [xl, yTop, 0, xr, H, S], band: ['+z', '+x', '-x'] });
        var defs = c.lid === 'split' ? [[xl, -1.5], [1.5, xr]] : [[xl, xr]];
        var totalLid = 0;
        defs.forEach(function (d) { totalLid += (d[1] - d[0]) * (L - S - 3); });
        defs.forEach(function (d, i) {
          var a = d[0], b = d[1], g = 'lid' + i;
          add({ name: c.lid === 'split' ? 'Lift-up lid (half)' : 'Lift-up lid', t: T, box: [a, yTop, S + 3, b, H, L], band: ['+x', '-x', '+z', '-z'], group: g });
          var inA = a === xl ? xl + T + 6 : T / 2 + 6;
          var inB = b === xr ? xr - T - 6 : -T / 2 - 6;
          // lift-kit brackets screw straight into the 18 mm lid and the wall next to it
          var area = (b - a) * (L - S - 3) / 1e6;
          var lidKg = area * 0.018 * 650;
          var matKg = (mw * ml / 1e6) * c.mt * 1.5 * ((b - a) * (L - S - 3) / totalLid);
          lids.push({
            group: g, pivot: [0, H, S + 3], x: [a, b], kg: Math.round(lidKg + matKg),
            struts: [inA + 14, inB - 14].map(function (x) {
              return { lo: [x, Math.max(70, yTop - 240), S + 70], hi: [x, yTop - 45, S + 3 + Math.round((L - S) * 0.38)] };
            })
          });
        });
      }
    } else {
      var AP = 200, yR0 = H - T - AP, yR1 = H - T;
      var railBand = headVisible ? ['-y', '+z', '-z'] : ['-y', '+z'];
      add({ name: 'Side rail (apron)', t: T, box: [xl, yR0, 0, xl + T, yR1, L], lam: ['-x'], band: railBand });
      add({ name: 'Side rail (apron)', t: T, box: [xr - T, yR0, 0, xr, yR1, L], lam: ['+x'], band: railBand });
      add({ name: 'Head rail', t: T, box: [xl + T, yR0, 0, xr - T, yR1, T], lam: headVisible ? ['-z'] : [], band: ['-y'] });
      add({ name: 'Foot rail', t: T, box: [xl + T, yR0, L - T, xr - T, yR1, L], lam: ['+z'], band: ['-y'] });
      if (hasDiv) add({ name: 'Centre rail', t: T, box: [-T / 2, yR1 - 150, T, T / 2, yR1, L - T] });
      [Math.round(L / 3), Math.round(2 * L / 3)].forEach(function (z) {
        if (hasDiv) {
          add({ name: 'Cross batten', t: T, box: [xl + T, yR1 - 75, z, -T / 2, yR1, z + T] });
          add({ name: 'Cross batten', t: T, box: [T / 2, yR1 - 75, z, xr - T, yR1, z + T] });
        } else add({ name: 'Cross batten', t: T, box: [xl + T, yR1 - 75, z, xr - T, yR1, z + T] });
      });
      add({ name: 'Top platform', t: T, box: [xl, yR1, 0, xr, H, L], band: headVisible ? ['+x', '-x', '+z', '-z'] : ['+x', '-x', '+z'] });
      var LG = 75, legs = [[xl + T, T], [xr - T - LG, T], [xl + T, L - T - LG], [xr - T - LG, L - T - LG]];
      if (hasDiv) legs.push([xl + T, L / 2 - LG / 2], [xr - T - LG, L / 2 - LG / 2]);
      legs.forEach(function (l) {
        add({ name: 'Leg', kind: 'timber', t: LG, box: [l[0], 0, l[1], l[0] + LG, yR1, l[1] + LG] });
      });
      if (hasDiv) add({ name: 'Leg', kind: 'timber', t: LG, box: [-LG / 2, 0, L / 2 - LG / 2, LG / 2, yR1 - 150, L / 2 + LG / 2] });
    }

    /* headboard + side tables */
    var TW = 450, TD = 400, TG = 20;
    var hbW = W + (c.tables ? 2 * (TW + TG) : 0);
    var HBH = Math.round(c.hbh * IN);
    var cushion = null;
    if (hb !== 'none') {
      add({ name: cush ? 'Headboard backing panel' : 'Headboard panel', t: T, box: [-hbW / 2, 0, -T, hbW / 2, HBH, 0], lam: ['+z'], band: ['+y', '+x', '-x'] });
      if (cush) {
        var cy0 = H + 40, cy1 = HBH - 70, cw = W - 40;
        if (cy1 - cy0 >= 120) {
          add({ name: 'Cushion board', t: 12, box: [-cw / 2, cy0, 0, cw / 2, cy1, 12] });
          var n = Math.max(2, Math.round(cw / 330));
          cushion = { x0: -cw / 2, x1: cw / 2, y0: cy0, y1: cy1, z0: 12, z1: CUSH_D, n: n,
            foamM2: cw * (cy1 - cy0) / 1e6, fabricM2: (cw + 240) * (cy1 - cy0 + 240) / 1e6 };
        }
      }
    }
    var HT = 0;
    if (c.tables) {
      HT = Math.max(450, H + mt);
      var shelfY = Math.round(HT * 0.55);
      [-1, 1].forEach(function (s) {
        var x0 = s < 0 ? xl - TG - TW : xr + TG, x1 = x0 + TW;
        add({ name: 'Side table: side', t: T, box: [x0, 0, 0, x0 + T, HT - T, TD], lam: ['-x'], band: ['+z'] });
        add({ name: 'Side table: side', t: T, box: [x1 - T, 0, 0, x1, HT - T, TD], lam: ['+x'], band: ['+z'] });
        add({ name: 'Side table: top', t: T, box: [x0, HT - T, 0, x1, HT, TD + T], lam: ['+y'], band: ['+z', '+x', '-x'] });
        add({ name: 'Side table: bottom', t: T, box: [x0 + T, 60, 9, x1 - T, 60 + T, TD] });
        add({ name: 'Side table: plinth', t: T, box: [x0 + T, 0, TD - 40 - T, x1 - T, 60, TD - 40], lam: ['+z'], band: ['-y'] });
        add({ name: 'Side table: shelf', t: T, box: [x0 + T, shelfY, 9, x1 - T, shelfY + T, TD], band: ['+z'] });
        add({ name: 'Side table: back', t: F, box: [x0 + T, 60, 0, x1 - T, HT - T, 9] });
        add({ name: 'Side table: door', t: T, box: [x0 + 2, 62, TD, x1 - 2, shelfY + T - 3, TD + T], lam: ['+z'], band: ['+y', '-y', '+x', '-x'] });
        decor.push({ type: s > 0 ? 'lamp' : 'books', x: (x0 + x1) / 2, y: HT, z: TD / 2 });
      });
    }

    var minX = Math.min(xl, c.tables ? -hbW / 2 : xl, hb !== 'none' ? -hbW / 2 : xl);
    var overallW = c.tables || hb !== 'none' ? Math.max(W, hbW) : W;
    var backZ = hb !== 'none' ? -T - 12 : -12;
    return {
      cfg: c,
      dims: {
        W: W, L: L, H: H, mw: mw, ml: ml, mt: mt, hbW: hbW, HBH: hb !== 'none' ? HBH : 0, HT: HT, S: S,
        overallW: overallW, overallL: L + (hb !== 'none' ? T : 0) + (c.tables && hb === 'none' ? 0 : 0),
        overallH: Math.max(H + mt, hb !== 'none' ? HBH : 0, HT), hasDiv: hasDiv
      },
      parts: parts, lids: lids, drawers: drawers, cushion: cushion, decor: decor,
      mattress: { box: [-mw / 2, H, mz0, mw / 2, H + mt, mz0 + ml] },
      room: { backZ: backZ, leftX: minX - 650 }
    };
  }
  B.IN = IN;
  B.SHEET_L = SHEET_L;
  B.SHEET_W = SHEET_W;
  B.SHEET_M2 = SHEET_M2;
  B.SIZES = SIZES;
  B.FINISHES = FINISHES;
  B.FABRICS = FABRICS;
  B.STORAGE = STORAGE;
  B.HEADBOARDS = HEADBOARDS;
  B.GRADES = GRADES;
  B.DEFAULTS = DEFAULTS;
  B.normalize = normalize;
  B.encode = encode;
  B.decode = decode;
  B.inch = inch;
  B.ftIn = ftIn;
  B.inr = inr;
  B.bsize = bsize;
  B.thickAxis = thickAxis;
  B.faceDims = faceDims;
  B.edgeLen = edgeLen;
  B.solidBoxes = solidBoxes;
  B.buildDesign = buildDesign;
})(typeof globalThis !== 'undefined' ? globalThis : this);
