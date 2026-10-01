/* Palang: UI wiring, state, persistence, share links. */
(function () {
  'use strict';
  var B = window.BedCore, X = window.BedExport;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'palang.design.v1', PKEY = 'palang.prices.v1', TKEY = 'palang.theme';

  function load(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: the URL hash still holds the design */ } }

  function fromHash() {
    var m = /(?:^|[#&])bed=([^&]+)/.exec(location.hash || '');
    return m ? B.decode(decodeURIComponent(m[1])) : null;
  }
  var state = fromHash() || B.normalize(load(KEY) || B.DEFAULTS);
  var costState = load(PKEY) || { prices: {}, days: null, wastage: 10 };
  var tab = 'design', design, mats, cost, scene = null, open = false;

  function shareURL() { return location.origin + location.pathname + '#bed=' + B.encode(state); }

  /* ---------- small builders */
  function radio(container, items, current, onPick, render) {
    container.innerHTML = '';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.value = it.value;
      b.setAttribute('aria-checked', String(it.value === current));
      b.tabIndex = it.value === current ? 0 : -1;
      b.innerHTML = render ? render(it) : it.label;
      if (it.title) b.title = it.title;
      b.addEventListener('click', function () { onPick(it.value); });
      container.appendChild(b);
    });
    container.onkeydown = function (e) {
      var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!keys[e.key]) return;
      e.preventDefault();
      var btns = [].slice.call(container.querySelectorAll('[role=radio]'));
      var i = btns.indexOf(document.activeElement); if (i < 0) i = 0;
      var n = btns[(i + keys[e.key] + btns.length) % btns.length];
      n.click(); var again = container.querySelector('[data-value="' + n.dataset.value + '"]'); if (again) again.focus();
    };
  }
  function setRange(el, v) {
    el.value = v;
    el.style.setProperty('--p', ((v - el.min) / (el.max - el.min) * 100) + '%');
  }

  var ICONS = {
    legs: '<svg viewBox="0 0 54 34"><path d="M5 12h44v8H5zM9 20v10M45 20v10M5 12V6"/></svg>',
    drawers: '<svg viewBox="0 0 54 34"><path d="M5 8h44v22H5zM10 14h16v12H10zM30 14h14v12H30zM16 20h4M35 20h4"/></svg>',
    hydraulic: '<svg viewBox="0 0 54 34"><path d="M5 18h44v12H5zM8 16L45 4M20 18l8-9"/></svg>'
  };
  var WALLS = ['#efe8dc', '#e9e1d4', '#e3d3bb', '#c7d1bf', '#c3cfd9', '#d9a68c', '#4b4d50'];

  function update(rebuild) {
    state = B.normalize(state);
    design = B.buildDesign(state);
    mats = B.computeMaterials(design, { wastage: costState.wastage });
    cost = B.computeCost(design, mats, costState.prices, { days: costState.days });
    save(KEY, state);
    try { history.replaceState(null, '', '#bed=' + B.encode(state)); } catch (e) { /* file:// or sandbox */ }
    renderControls();
    renderSummary();
    if (tab === 'materials') renderMaterials();
    if (tab === 'cost') renderCost();
    if (!$('sheetView').hidden) renderSheet();
    if (scene && rebuild !== false) scene.setDesign(design);
  }

  function set(k, v) { state[k] = v; if (k === 'storage' || k === 'size') { open = false; if (scene) scene.setOpen(false); } update(); }

  /* ---------- design tab */
  function renderControls() {
    var c = state;
    radio($('sizeChips'), Object.keys(B.SIZES).map(function (k) { return { value: k, label: B.SIZES[k].label, sub: B.SIZES[k].ft }; }), c.size, function (v) {
      if (v === 'custom') { state.w = c.w; state.l = c.l; }
      set('size', v);
    }, function (it) { return '<b>' + it.label + '</b><small>' + it.sub + '</small>'; });
    [].forEach.call($('sizeChips').children, function (b) { b.className = 'chip'; });
    $('customSize').hidden = c.size !== 'custom';
    if (document.activeElement !== $('cw')) $('cw').value = c.w;
    if (document.activeElement !== $('cl')) $('cl').value = c.l;
    setRange($('h'), c.h); $('hOut').textContent = c.h + '″ · ' + Math.round(c.h * 25.4) + ' mm';
    radio($('mtSeg'), [5, 6, 8].map(function (v) { return { value: v, label: v + '″' }; }), c.mt, function (v) { set('mt', v); });
    radio($('storageCards'), ['legs', 'drawers', 'hydraulic'].map(function (k) { return { value: k, label: { legs: 'On legs', drawers: '2 drawers', hydraulic: 'Hydraulic' }[k], sub: { legs: 'No storage', drawers: 'Side pull-outs', hydraulic: 'Lift-up lid' }[k] }; }), c.storage,
      function (v) { set('storage', v); }, function (it) { return ICONS[it.value] + '<b>' + it.label + '</b><small>' + it.sub + '</small>'; });
    [].forEach.call($('storageCards').children, function (b) { b.className = 'card'; });
    $('lidField').hidden = c.storage !== 'hydraulic';
    radio($('lidSeg'), [{ value: 'single', label: 'Single lid' }, { value: 'split', label: 'Split in two' }], c.lid, function (v) { set('lid', v); });
    radio($('hbSeg'), Object.keys(B.HEADBOARDS).map(function (k) { return { value: k, label: { none: 'None', plain: 'Plain', cushioned: 'Cushioned' }[k] }; }), c.hb, function (v) { set('hb', v); });
    $('hbhField').hidden = c.hb === 'none';
    var hbh = $('hbh'); hbh.min = c.h + c.mt + 6; setRange(hbh, c.hbh);
    $('hbhOut').textContent = c.hbh + '″ · ' + B.ftIn(c.hbh * 25.4) + ' from floor';
    $('fabField').hidden = c.hb !== 'cushioned';
    radio($('fabSw'), Object.keys(B.FABRICS).map(function (k) { return { value: k, label: B.FABRICS[k].label, title: B.FABRICS[k].label }; }), c.fab, function (v) { set('fab', v); },
      function (it) { return '<span class="dot" style="background:' + B.FABRICS[it.value].color + '"></span><span class="l">' + it.label + '</span>'; });
    [].forEach.call($('fabSw').children, function (b) { b.className = 'swatch'; b.setAttribute('aria-label', b.title); });
    $('tables').checked = c.tables;
    radio($('finishSw'), Object.keys(B.FINISHES).map(function (k) { return { value: k, label: B.FINISHES[k].label.split(' ').pop() }; }), c.finish, function (v) { set('finish', v); },
      function (it) { return '<span class="dot" style="background-image:url(' + swatch(it.value) + ')"></span><span class="l">' + it.label + '</span>'; });
    [].forEach.call($('finishSw').children, function (b) { b.className = 'swatch'; });
    var walls = WALLS.map(function (w) { return { value: w, label: w, title: 'Wall ' + w }; });
    radio($('wallSw'), walls, c.wall, function (v) { set('wall', v); }, function (it) { return '<span class="dot" style="background:' + it.value + '"></span>'; });
    [].forEach.call($('wallSw').children, function (b) { b.className = 'swatch'; b.setAttribute('aria-label', b.title); });
    var custom = document.createElement('label');
    custom.className = 'swatch custom'; custom.title = 'Pick any colour';
    custom.setAttribute('aria-checked', String(WALLS.indexOf(c.wall) < 0));
    custom.innerHTML = '<span class="dot" style="' + (WALLS.indexOf(c.wall) < 0 ? 'background:' + c.wall : '') + '"><input type="color" aria-label="Custom wall colour" value="' + c.wall + '"></span>';
    custom.querySelector('input').addEventListener('input', function (e) { state.wall = e.target.value; if (scene) scene.setWall(state.wall); });
    custom.querySelector('input').addEventListener('change', function (e) { set('wall', e.target.value); });
    $('wallSw').appendChild(custom);
    radio($('gradeSeg'), [{ value: 'bwp', label: 'BWP · IS 710' }, { value: 'mr', label: 'MR · IS 303' }], c.grade, function (v) { set('grade', v); });
    $('gradeHelp').textContent = c.grade === 'bwp' ? 'Water-proof grade. Best for a box that sits on a mopped floor.' : 'Moisture-resistant, cheaper. Fine for a dry room; keep the floor of the box dry.';
    var ob = $('openBtn');
    ob.hidden = c.storage === 'legs';
    ob.textContent = c.storage === 'drawers' ? (open ? 'Close drawers' : 'Open drawers') : (open ? 'Close lid' : (c.lid === 'split' ? 'Lift lids' : 'Lift lid'));
    ob.setAttribute('aria-pressed', String(open));
    var D = design.dims;
    $('dimChip').textContent = B.ftIn(D.W) + ' × ' + B.ftIn(D.L) + ' box · ' + c.h + '″ high';
  }
  function plural(u, n) { return n === 1 || u === 'm' || u === 'kg' || u === 'm²' || u === 'lump sum' || u === 'box of 100' ? u : u === 'pc' ? 'pcs' : u + 's'; }
  var swCache = {};
  function swatch(k) { if (!swCache[k]) { try { swCache[k] = window.BedTextures.swatchURL(k); } catch (e) { swCache[k] = ''; } } return swCache[k]; }

  function renderSummary() {
    var p = mats.ply[18];
    $('sumSheets').textContent = '≈ ' + B.inr(cost.total) + ' est.';
    $('sumCost').textContent = (p ? p.buy + ' × 18 mm sheets · ' : '') + mats.rows.reduce(function (t, r) { return t + r.qty; }, 0) + ' parts';
  }

  /* ---------- materials tab */
  function renderMaterials() {
    var el = $('tab-materials'), h = '';
    h += '<div class="stats">';
    [18, 12, 9].forEach(function (t) {
      var p = mats.ply[t]; if (!p) return;
      h += '<div class="stat' + (t === 18 ? ' hl' : '') + '"><div class="k">' + t + ' mm plywood</div><div class="v">' + p.buy + ' <small style="font-size:13px;font-weight:600">sheet' + (p.buy > 1 ? 's' : '') + '</small></div><div class="s">' + p.nest.count + ' nested · ' + Math.round(p.nest.utilisation * 100) + '% used</div></div>';
    });
    h += '<div class="stat"><div class="k">Laminate 1 mm</div><div class="v">' + mats.laminate.buy + ' <small style="font-size:13px;font-weight:600">sheets</small></div><div class="s">outer faces, ' + mats.laminate.areaM2.toFixed(1) + ' m²</div></div>';
    h += '<div class="stat"><div class="k">Edge band</div><div class="v">' + mats.bandBuyM + ' <small style="font-size:13px;font-weight:600">m</small></div><div class="s">' + mats.bandM + ' m + ' + mats.wastage + '%</div></div>';
    h += '</div>';
    var p18 = mats.ply[18];
    if (p18) h += '<p class="note"><b>How the count works:</b> the parts below are nested onto 8 × 4 ft (2440 × 1220 mm) sheets with a ' + mats.kerf + ' mm saw kerf, using straight, edge-to-edge cuts. For 18 mm the parts use ' + p18.areaM2.toFixed(2) + ' m² across ' + p18.nest.count + ' sheets. Adding ' + mats.wastage + '% wastage gives ' + p18.withWastageM2.toFixed(2) + ' m²; buy ' + p18.buy + ' (one sheet = ' + B.SHEET_M2.toFixed(2) + ' m²).</p>';
    h += '<h3 class="section-h">Cutting list<small>' + mats.rows.length + ' sizes</small></h3><div class="table-wrap"><table><thead><tr><th>#</th><th>Part</th><th class="r">Qty</th><th class="r">Size mm</th><th class="r">T</th></tr></thead><tbody>';
    var lastT = null;
    mats.rows.forEach(function (r) {
      if (r.t !== lastT) { h += '<tr class="tgroup"><td colspan="5">' + r.t + ' mm plywood</td></tr>'; lastT = r.t; }
      h += '<tr><td class="n">' + r.no + '</td><td>' + B.esc(r.name) + '<span class="sub">' + [r.bandDesc !== '—' ? 'band ' + r.bandDesc : '', r.lam ? 'laminate ' + r.lam + ' face' : '', r.note].filter(Boolean).map(B.esc).join(' · ') + '</span></td><td class="r">' + r.qty + '</td><td class="r">' + r.a + ' × ' + r.b + '<span class="sub">' + B.inch(r.a) + ' × ' + B.inch(r.b) + '</span></td><td class="r">' + r.t + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<h3 class="section-h">Sheet layouts<small>numbers match the cutting list</small></h3><div class="layouts">';
    [18, 12, 9].forEach(function (t) {
      var p = mats.ply[t]; if (!p) return;
      p.nest.sheets.forEach(function (sh, i) {
        h += '<div class="layout-card"><div class="cap"><span>' + t + ' mm · sheet ' + (i + 1) + ' of ' + p.nest.count + '</span><span>' + Math.round(sh.used / B.SHEET_M2 * 100) + '% used</span></div>' + B.sheetSVG(sh, i, p.nest.count, t + ' mm', 400) + '</div>';
      });
    });
    if (mats.laminate.nest.count) mats.laminate.nest.sheets.forEach(function (sh, i) {
      h += '<div class="layout-card"><div class="cap"><span>Laminate · sheet ' + (i + 1) + ' of ' + mats.laminate.nest.count + '</span><span>pieces cut 10 mm oversize</span></div>' + B.sheetSVG(sh, i, mats.laminate.nest.count, 'laminate', 400) + '</div>';
    });
    h += '</div>';
    h += '<h3 class="section-h">Hardware &amp; consumables</h3><div class="table-wrap"><table><tbody>';
    mats.hardware.forEach(function (x) { h += '<tr><td><b>' + B.esc(x.name) + '</b><span class="sub">' + B.esc(x.spec) + '</span></td><td class="r">' + x.qty + ' ' + x.unit + '</td></tr>'; });
    h += '</tbody></table></div>';
    el.innerHTML = h;
  }

  /* ---------- cost tab */
  function renderCost() {
    var el = $('tab-cost'), h = '';
    h += '<p class="note"><b>Rough estimates only.</b> The default prices are typical Pune retail figures, not live quotes. They change with brand (Century, Greenply, Merino, Ebco, Hettich…) and shop, so edit any price to match your quote. Your prices are saved on this device.</p>';
    var g = null;
    cost.lines.forEach(function (l) {
      if (l.group !== g) { h += '<div class="cost-group">' + l.group + '</div>'; g = l.group; }
      var isDays = l.key === 'carp';
      h += '<div class="cost-row"><div><div class="lbl">' + B.esc(l.label) + (costState.prices[l.key] == null ? '<span class="est">est.</span>' : '') + '</div><div class="qty">' +
        (isDays ? '<label class="price days"><input type="number" inputmode="decimal" step="0.5" min="0" data-days value="' + l.qty + '" aria-label="Carpenter days"><span>days</span></label>' : l.qty + ' ' + plural(l.unit, l.qty)) +
        ' × <label class="price"><span>₹</span><input type="number" inputmode="decimal" min="0" step="1" data-key="' + l.key + '" value="' + l.price + '" aria-label="Price per ' + l.unit + ' for ' + B.esc(l.label) + '"></label>' + (isDays ? '' : '<span>/' + l.unit + '</span>') +
        (isDays && costState.days != null ? ' <button class="link-btn" data-autodays type="button">use ' + cost.suggestedDays + '</button>' : '') + '</div></div><div class="amt">' + B.inr(l.amount) + '</div></div>';
    });
    h += '<div class="cost-row"><div><div class="lbl">Wastage allowance</div><div class="qty">applied to plywood, laminate, edge band and consumables</div></div><label class="price days"><input type="number" min="0" max="40" step="1" data-wastage value="' + costState.wastage + '" aria-label="Wastage percent"><span>%</span></label></div>';
    h += '<div class="total"><span>Estimated total</span><b>' + B.inr(cost.total) + '</b></div>';
    h += '<p class="note">Labour assumes a carpenter + helper on site, ' + cost.suggestedDays + ' days for this design. Prices vary by brand and shop; this is not a quote. <button class="link-btn" id="resetPrices" type="button">Reset prices to defaults</button></p>';
    el.innerHTML = h;
    el.querySelectorAll('input[data-key]').forEach(function (inp) {
      inp.addEventListener('change', function () { var v = parseFloat(inp.value); if (isFinite(v) && v >= 0) costState.prices[inp.dataset.key] = v; else delete costState.prices[inp.dataset.key]; save(PKEY, costState); update(false); });
    });
    var dInp = el.querySelector('[data-days]');
    dInp.addEventListener('change', function () { var v = parseFloat(dInp.value); costState.days = isFinite(v) && v >= 0 ? v : null; save(PKEY, costState); update(false); });
    var wInp = el.querySelector('[data-wastage]');
    wInp.addEventListener('change', function () { var v = parseFloat(wInp.value); costState.wastage = isFinite(v) ? Math.min(40, Math.max(0, v)) : 10; save(PKEY, costState); update(false); });
    var ad = el.querySelector('[data-autodays]'); if (ad) ad.addEventListener('click', function () { costState.days = null; save(PKEY, costState); update(false); });
    $('resetPrices').addEventListener('click', function () { costState = { prices: {}, days: null, wastage: 10 }; save(PKEY, costState); update(false); toast('Prices reset'); });
  }

  /* ---------- tabs */
  function setTab(t, focus) {
    tab = t;
    document.body.className = document.body.className.replace(/\btab-\w+/g, '').trim() + ' tab-' + t;
    ['design', 'materials', 'cost'].forEach(function (k) {
      var b = $('t-' + k), on = k === t;
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      $('tab-' + k).hidden = !on;
    });
    if (t === 'materials') renderMaterials();
    if (t === 'cost') renderCost();
    if (focus) $('t-' + t).focus();
    if (window.innerWidth < 960) {
      var top = $('stage').offsetTop + (t === 'design' ? 0 : $('stage').offsetHeight);
      if (window.scrollY > top) window.scrollTo(0, top);
    }
    if (scene) setTimeout(function () { scene.resize(); }, 0);
  }

  /* ---------- carpenter sheet */
  function renderSheet() { $('sheet').innerHTML = X.sheetHTML(design, mats, shareURL()); }
  function openSheet() {
    renderSheet();
    $('sheetView').hidden = false; $('sheetView').scrollTop = 0;
    document.body.style.overflow = 'hidden';
    $('sheetBack').focus();
  }
  function closeSheet() { $('sheetView').hidden = true; document.body.style.overflow = ''; $('sheetBtn').focus(); }

  function copy(text, msg) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? msg : 'Copy failed. Select the text and copy it yourself.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(msg); }, fallback);
    else fallback();
  }
  var tt;
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('show'); }, 2200); }

  /* ---------- theme */
  function currentDark() {
    var a = document.documentElement.getAttribute('data-theme');
    if (a) return a === 'dark';
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function syncTheme() {
    var dark = currentDark();
    $('themeBtn').setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    if (scene) scene.setTheme(dark);
  }

  /* ---------- wire up */
  function init() {
    $('cw').addEventListener('change', function () { state.w = this.value; update(); });
    $('cl').addEventListener('change', function () { state.l = this.value; update(); });
    var hT;
    $('h').addEventListener('input', function () { state.h = +this.value; clearTimeout(hT); update(false); hT = setTimeout(function () { if (scene) scene.setDesign(design); }, 60); });
    $('hbh').addEventListener('input', function () { state.hbh = +this.value; clearTimeout(hT); update(false); hT = setTimeout(function () { if (scene) scene.setDesign(design); }, 60); });
    $('tables').addEventListener('change', function () { set('tables', this.checked); });
    document.querySelectorAll('.tabs [role=tab]').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); }); });
    $('t-design').parentNode.addEventListener('keydown', function (e) {
      var order = ['design', 'materials', 'cost'], i = order.indexOf(tab);
      if (e.key === 'ArrowRight') setTab(order[(i + 1) % 3], true);
      if (e.key === 'ArrowLeft') setTab(order[(i + 2) % 3], true);
    });
    $('openBtn').addEventListener('click', function () { open = !open; if (scene) scene.setOpen(open); renderControls(); });
    $('resetView').addEventListener('click', function () { if (scene) scene.resetView(); });
    $('sheetBtn').addEventListener('click', openSheet);
    $('sheetBack').addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheetView').hidden) closeSheet(); });
    $('copyText').addEventListener('click', function () { copy(X.sheetText(design, mats, shareURL()), 'Spec copied. Paste it into WhatsApp.'); });
    $('copyLink').addEventListener('click', function () { copy(shareURL(), 'Design link copied'); });
    $('printBtn').addEventListener('click', function () { window.print(); });
    $('downloadPng').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      X.sheetPNG(design, mats, shareURL()).then(function (r) {
        var a = document.createElement('a'); a.href = URL.createObjectURL(r.blob);
        a.download = 'palang-' + B.encode(state).split(',').slice(1, 6).join('-') + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        toast('PNG saved (' + r.width + ' × ' + r.height + ')');
      }).catch(function (e) { toast(e.message); }).then(function () { btn.disabled = false; });
    });
    $('shareBtn').addEventListener('click', function () {
      var url = shareURL();
      if (navigator.share && /Mobi|iPhone|Android/i.test(navigator.userAgent)) {
        navigator.share({ title: 'My bed design', text: B.title(state) + ' · ' + B.summary(state), url: url }).catch(function () {});
      } else copy(url, 'Design link copied. Send it to your carpenter.');
    });
    $('themeBtn').addEventListener('click', function () {
      var next = currentDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(TKEY, next); } catch (e) { /* ignore */ }
      syncTheme();
    });
    if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', syncTheme); }
    window.addEventListener('hashchange', function () { var h = fromHash(); if (h && B.encode(h) !== B.encode(state)) { state = h; update(); } });

    update(false);
    try {
      if (!window.THREE || !window.BedScene) throw new Error('3D library did not load');
      scene = new window.BedScene($('viewport'));
      syncTheme();
      scene.setDesign(design);
      $('loading').classList.add('done');
      var hideHint = function () { $('hint').classList.add('gone'); };
      $('viewport').addEventListener('pointerdown', hideHint, { once: true });
      setTimeout(hideHint, 7000);
    } catch (e) {
      $('loading').innerHTML = '3D preview unavailable on this device. The cutting list and carpenter sheet still work.';
      if (window.console) console.warn(e);
    }
    window.__bed = {
      get state() { return state; }, get design() { return design; }, get mats() { return mats; }, get cost() { return cost; },
      set: function (k, v) { set(k, v); }, setState: function (s) { state = B.normalize(s); update(); }, scene: function () { return scene; },
      shareURL: shareURL, setTab: setTab, openSheet: openSheet, closeSheet: closeSheet,
      png: function () { return X.sheetPNG(design, mats, shareURL()).then(function (r) { return { w: r.width, h: r.height, size: r.blob.size }; }); },
      text: function () { return X.sheetText(design, mats, shareURL()); }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
