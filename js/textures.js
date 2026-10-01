/* Palang: procedural canvas textures (laminates, tiles, mattress, fabric). Browser only. */
(function (root) {
  'use strict';
  function rng(seed) { var s = seed % 2147483647 || 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function shade(c, f) { return c.map(function (v) { return Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); }); }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  var WOOD = {
    walnut: { base: '#5d3c28', dark: -0.45, light: 0.12, lines: 150, wave: 9, pores: 900 },
    teak: { base: '#a2663a', dark: -0.35, light: 0.14, lines: 130, wave: 6, pores: 700 },
    oak: { base: '#c8a679', dark: -0.25, light: 0.16, lines: 170, wave: 4, pores: 1400, rays: true },
    white: { base: '#eeebe5', flat: true, speck: 0.035 },
    grey: { base: '#7e8286', flat: true, speck: 0.06 }
  };

  /* Laminate: 1024 x 512 canvas covering 1.2 m x 0.6 m, grain along u. */
  function laminate(key) {
    var o = WOOD[key] || WOOD.walnut, cv = canvas(1024, 512), g = cv.getContext('2d'), R = rng(key.length * 977 + 13);
    var base = hex(o.base);
    g.fillStyle = o.base; g.fillRect(0, 0, 1024, 512);
    if (o.flat) {
      for (var i = 0; i < 26000; i++) {
        var lv = R() < 0.5 ? shade(base, -0.25) : shade(base, 0.3);
        g.fillStyle = rgba(lv, o.speck * R()); g.fillRect(R() * 1024, R() * 512, 1.5, 1.5);
      }
      for (var k = 0; k < 60; k++) {
        g.strokeStyle = rgba(shade(base, -0.12), 0.05); g.lineWidth = 1;
        var yy = R() * 512; g.beginPath(); g.moveTo(0, yy); g.lineTo(1024, yy + (R() - 0.5) * 6); g.stroke();
      }
      return cv;
    }
    // broad colour bands
    for (var b = 0; b < 14; b++) {
      var y0 = R() * 512, hgt = 20 + R() * 70;
      var grad = g.createLinearGradient(0, y0, 0, y0 + hgt);
      var col = R() < 0.5 ? shade(base, o.dark * 0.35) : shade(base, o.light * 0.8);
      grad.addColorStop(0, rgba(col, 0)); grad.addColorStop(0.5, rgba(col, 0.45)); grad.addColorStop(1, rgba(col, 0));
      g.fillStyle = grad; g.fillRect(0, y0, 1024, hgt);
    }
    // grain lines (wrapped vertically so the texture tiles)
    for (var l = 0; l < o.lines; l++) {
      var y = R() * 512, amp = o.wave * (0.3 + R()), f1 = (1 + Math.floor(R() * 3)) * Math.PI * 2 / 1024, ph = R() * 6.28;
      var f2 = (3 + Math.floor(R() * 4)) * Math.PI * 2 / 1024, ph2 = R() * 6.28;
      var dark = R() < 0.72;
      g.strokeStyle = rgba(dark ? shade(base, o.dark * (0.4 + R() * 0.6)) : shade(base, o.light), 0.08 + R() * 0.22);
      g.lineWidth = 0.6 + R() * 2.2;
      for (var rep = -1; rep <= 1; rep++) {
        g.beginPath();
        for (var x = 0; x <= 1024; x += 8) {
          var yy2 = y + rep * 512 + Math.sin(x * f1 + ph) * amp + Math.sin(x * f2 + ph2) * amp * 0.25;
          if (x === 0) g.moveTo(x, yy2); else g.lineTo(x, yy2);
        }
        g.stroke();
      }
    }
    // pores
    for (var p = 0; p < o.pores; p++) {
      g.fillStyle = rgba(shade(base, o.dark), 0.25 + R() * 0.3);
      g.fillRect(R() * 1024, R() * 512, 3 + R() * 9, 0.8);
    }
    if (o.rays) for (var r = 0; r < 80; r++) { g.fillStyle = rgba(shade(base, 0.25), 0.25); g.fillRect(R() * 1024, R() * 512, 6 + R() * 14, 2); }
    return cv;
  }

  /* Raw plywood face (birch-like) for inside surfaces. */
  function plywood() {
    var cv = canvas(512, 256), g = cv.getContext('2d'), R = rng(4242), base = hex('#d8be93');
    g.fillStyle = '#d8be93'; g.fillRect(0, 0, 512, 256);
    for (var l = 0; l < 70; l++) {
      var y = R() * 256, amp = 3 + R() * 6, ph = R() * 6.28;
      g.strokeStyle = rgba(shade(base, -0.2 - R() * 0.15), 0.12 + R() * 0.12); g.lineWidth = 0.6 + R() * 1.6;
      for (var rep = -1; rep <= 1; rep++) {
        g.beginPath();
        for (var x = 0; x <= 512; x += 8) { var yy = y + rep * 256 + Math.sin(x * Math.PI * 4 / 512 + ph) * amp; if (!x) g.moveTo(x, yy); else g.lineTo(x, yy); }
        g.stroke();
      }
    }
    return cv;
  }

  /* Vitrified floor tiles: 2 x 2 tiles of 600 mm (canvas = 1.2 m). */
  function tiles() {
    var cv = canvas(1024, 1024), g = cv.getContext('2d'), R = rng(99);
    var bases = ['#e6dfd4', '#e9e2d8', '#e3dccf', '#e8e0d5'];
    for (var i = 0; i < 4; i++) {
      var x = (i % 2) * 512, y = Math.floor(i / 2) * 512;
      g.fillStyle = bases[i]; g.fillRect(x, y, 512, 512);
      for (var v = 0; v < 7; v++) {
        g.strokeStyle = 'rgba(160,145,125,' + (0.05 + R() * 0.08) + ')'; g.lineWidth = 1 + R() * 3;
        g.beginPath(); var sx = x + R() * 512, sy = y; g.moveTo(sx, sy);
        for (var s = 1; s <= 8; s++) g.lineTo(x + Math.min(511, Math.max(0, sx - 256 + R() * 512 * (s / 8) + (R() - 0.5) * 60)), y + s * 64);
        g.stroke();
      }
      for (var d = 0; d < 1800; d++) { g.fillStyle = 'rgba(120,105,90,' + R() * 0.06 + ')'; g.fillRect(x + R() * 512, y + R() * 512, 2, 2); }
    }
    g.fillStyle = '#c9bfb1';
    g.fillRect(0, 0, 1024, 3); g.fillRect(0, 510, 1024, 4); g.fillRect(0, 0, 3, 1024); g.fillRect(510, 0, 4, 1024);
    g.fillRect(0, 1021, 1024, 3); g.fillRect(1021, 0, 3, 1024);
    return cv;
  }

  /* Quilted mattress cover. */
  function quilt() {
    var cv = canvas(512, 512), g = cv.getContext('2d');
    g.fillStyle = '#f4f1eb'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(150,140,125,0.28)'; g.lineWidth = 2;
    for (var i = -512; i <= 1024; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 512, 512); g.stroke();
      g.beginPath(); g.moveTo(i, 512); g.lineTo(i + 512, 0); g.stroke();
    }
    return cv;
  }

  /* Block-print throw (indigo motifs on cream). */
  function blockPrint() {
    var cv = canvas(512, 512), g = cv.getContext('2d');
    g.fillStyle = '#f1e9da'; g.fillRect(0, 0, 512, 512);
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
      var cx = x * 64 + (y % 2 ? 32 : 0) + 16, cy = y * 64 + 32;
      g.fillStyle = '#34497a';
      for (var p = 0; p < 6; p++) {
        var a = p * Math.PI / 3;
        g.beginPath(); g.ellipse(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 6, 3.4, a, 0, 6.29); g.fill();
      }
      g.fillStyle = '#b5523a'; g.beginPath(); g.arc(cx, cy, 3.6, 0, 6.29); g.fill();
    }
    g.fillStyle = '#34497a'; g.fillRect(0, 0, 512, 10); g.fillRect(0, 502, 512, 10);
    return cv;
  }

  /* Woven upholstery fabric tinted to a colour. */
  function fabric(color) {
    var cv = canvas(256, 256), g = cv.getContext('2d'), R = rng(321), base = hex(color);
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    for (var y = 0; y < 256; y += 2) { g.fillStyle = rgba(shade(base, R() < 0.5 ? -0.12 : 0.08), 0.35); g.fillRect(0, y, 256, 1); }
    for (var x = 0; x < 256; x += 2) { g.fillStyle = rgba(shade(base, R() < 0.5 ? -0.1 : 0.06), 0.25); g.fillRect(x, 0, 1, 256); }
    return cv;
  }

  /* Small circular swatch for the UI picker. */
  function swatchURL(key) {
    var src = laminate(key), c = canvas(96, 96), g = c.getContext('2d');
    g.drawImage(src, 180, 120, 260, 260, 0, 0, 96, 96);
    return c.toDataURL('image/png');
  }

  root.BedTextures = { laminate: laminate, plywood: plywood, tiles: tiles, quilt: quilt, blockPrint: blockPrint, fabric: fabric, swatchURL: swatchURL };
})(typeof window !== 'undefined' ? window : globalThis);
