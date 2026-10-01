// Headless Chromium check for Palang. Usage: node tests/check.mjs [--shots]
// Starts its own static server on a free port and always closes it.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/Users/shankartiwar/Cayuse/s2s-web-client/package.json');
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots');
const CHROME = process.env.CHROME_BIN || `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function newPage(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  return { ctx, page, errors };
}
const ready = page => page.waitForFunction(() => window.__bed && window.__bed.scene() && window.__bed.scene().frames > 0, null, { timeout: 30000 });

try {
  // ---------- desktop
  const { ctx, page, errors } = await newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(BASE);
  await ready(page);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => window.__bed.scene().stats());
  ok(st.width > 500 && st.uniqueColours > 20, `WebGL canvas renders (${st.width}×${st.height}, ${st.uniqueColours} colours, ${st.calls} draw calls)`);

  const queen = await page.evaluate(() => { window.__bed.setState({ size: 'queen', h: 18, storage: 'hydraulic', lid: 'single', hb: 'plain', hbh: 42 }); const m = window.__bed.mats; return { n: m.ply[18].nest.count, buy: m.ply[18].buy, area: m.ply[18].areaM2, rows: m.rows.length }; });
  ok(queen.n >= 3 && queen.n <= 4, `queen hydraulic 5×6.5 ft, 18″, 3.5 ft headboard → ${queen.n} sheets of 18 mm before wastage (${queen.area.toFixed(2)} m², buy ${queen.buy})`);

  const before = await page.evaluate(() => ({ rows: JSON.stringify(window.__bed.mats.rows.map(r => [r.name, r.a, r.b])), sheets: window.__bed.mats.ply[18].nest.count }));
  await page.evaluate(() => window.__bed.setTab('materials'));
  await page.locator('#t-design').click();
  await page.locator('#sizeChips [data-value="king"]').click();
  const after = await page.evaluate(() => ({ rows: JSON.stringify(window.__bed.mats.rows.map(r => [r.name, r.a, r.b])), sheets: window.__bed.mats.ply[18].nest.count, foot: window.__bed.mats.rows.find(r => r.name === 'Foot panel').a }));
  ok(before.rows !== after.rows && after.foot === 1818, `changing size (queen → king) updates the cutting list (foot panel ${after.foot} mm)`);
  await page.locator('#t-materials').click();
  const matText = await page.locator('#tab-materials').innerText();
  ok(/1818 × 439/.test(matText), 'materials tab shows the king cutting list');
  await page.locator('#t-design').click();
  await page.locator('#sizeChips [data-value="single"]').click();
  const single = await page.evaluate(() => window.__bed.mats.ply[18].nest.count);
  ok(single < after.sheets, `sheet count follows size (king ${after.sheets} → single ${single})`);

  // share URL round trip
  const custom = { size: 'custom', w: 66, l: 80, h: 16, storage: 'drawers', lid: 'single', hb: 'cushioned', hbh: 48, tables: true, finish: 'oak', fab: 'sage', wall: '#c7d1bf', grade: 'mr', mt: 8 };
  const url = await page.evaluate(c => { window.__bed.setState(c); return window.__bed.shareURL(); }, custom);
  const p2 = await newPage({ viewport: { width: 1200, height: 800 } });
  await p2.page.goto(url);
  await ready(p2.page);
  const restored = await p2.page.evaluate(() => window.__bed.state);
  ok(JSON.stringify(restored) === JSON.stringify(await page.evaluate(() => window.__bed.state)), `share URL round-trips (${url.split('#')[1]})`);
  ok(await p2.page.locator('#customSize').isVisible(), 'restored design shows custom size inputs');
  // localStorage restore (no hash)
  await p2.page.goto(BASE);
  await ready(p2.page);
  ok((await p2.page.evaluate(() => window.__bed.state.finish)) === 'oak', 'design restored from localStorage');
  ok(p2.errors.length === 0, 'no console errors on restored page' + (p2.errors.length ? ': ' + p2.errors.join(' | ') : ''));
  await p2.ctx.close();

  // animation + sheet + png
  await page.evaluate(() => window.__bed.setState({ size: 'queen', storage: 'hydraulic', hb: 'cushioned', tables: true, finish: 'walnut' }));
  await page.locator('#openBtn').click();
  await page.waitForTimeout(1200);
  const rot = await page.evaluate(() => window.__bed.scene().lidGroups[0].rotation.x);
  ok(rot < -0.5, `lid lifts (rotation ${rot.toFixed(2)} rad)`);
  if (SHOTS) await page.screenshot({ path: path.join(ROOT, 'screenshots/desktop-light-open.png') });
  await page.locator('#openBtn').click();
  await page.waitForTimeout(1100);
  await page.evaluate(() => window.__bed.setState({ size: 'queen', h: 18, storage: 'hydraulic', lid: 'single', hb: 'plain', hbh: 42, tables: true, finish: 'walnut', wall: '#e9e1d4', grade: 'bwp' }));
  await page.evaluate(() => window.__bed.scene().resetView());
  await page.waitForTimeout(600);
  if (SHOTS) await page.screenshot({ path: path.join(ROOT, 'screenshots/desktop-light.png') });
  await page.locator('#sheetBtn').click();
  const sheetText = await page.locator('#sheet').innerText();
  ok(/Cutting list/i.test(sheetText) && (await page.locator('#sheet svg.drawing').count()) === 3, 'carpenter sheet shows 3 drawings and the cutting list');
  const png = await page.evaluate(() => window.__bed.png());
  ok(png.w >= 1240 && png.size > 50000, `PNG export renders (${png.w}×${png.h}, ${(png.size / 1024).toFixed(0)} KB)`);
  const txt = await page.evaluate(() => window.__bed.text());
  ok(/Cutting list/.test(txt) && /#bed=v1,/.test(txt), 'copy-as-text includes cutting list and design link');
  if (SHOTS) {
    await page.locator('#sheet').screenshot({ path: path.join(ROOT, 'screenshots/carpenter-sheet.png') });
    const buf = await page.evaluate(async () => {
      const B = window.BedCore; const X = window.BedExport; const b = window.__bed;
      const r = await X.sheetPNG(b.design, b.mats, b.shareURL());
      const a = new Uint8Array(await r.blob.arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode.apply(null, a.subarray(i, i + 32768)); return btoa(s);
    });
    fs.writeFileSync(path.join(ROOT, 'screenshots/carpenter-sheet-export.png'), Buffer.from(buf, 'base64'));
  }
  await page.locator('#sheetBack').click();
  await page.locator('#themeBtn').click();
  ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'theme toggles to dark');
  await page.waitForTimeout(300);
  if (SHOTS) {
    await page.screenshot({ path: path.join(ROOT, 'screenshots/desktop-dark.png') });
    await page.locator('#t-materials').click(); await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(ROOT, 'screenshots/desktop-dark-materials.png') });
    await page.locator('#t-cost').click(); await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(ROOT, 'screenshots/desktop-dark-cost.png') });
  }
  await page.locator('#themeBtn').click();
  ok(errors.length === 0, 'zero console errors on desktop' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();

  // ---------- iPhone 12
  for (const scheme of ['light', 'dark']) {
    const m = await newPage({ ...devices['iPhone 12'], colorScheme: scheme });
    await m.page.goto(BASE + '#bed=v1,queen,60,78,18,hydraulic,single,plain,42,1,walnut,linen,e9e1d4,bwp,6');
    await ready(m.page);
    await m.page.waitForTimeout(700);
    const sw = await m.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(sw.sw <= sw.cw, `iPhone 12 (${scheme}): no horizontal scroll (${sw.sw} ≤ ${sw.cw})`);
    if (SHOTS) {
      await m.page.screenshot({ path: path.join(ROOT, `screenshots/iphone12-${scheme}.png`) });
      await m.page.evaluate(() => window.scrollTo(0, 700)); await m.page.waitForTimeout(250);
      await m.page.screenshot({ path: path.join(ROOT, `screenshots/iphone12-${scheme}-scrolled.png`) });
    }
    for (const t of ['materials', 'cost']) {
      await m.page.locator('#t-' + t).click(); await m.page.waitForTimeout(250);
      const w = await m.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      ok(w, `iPhone 12 (${scheme}) ${t} tab: no horizontal scroll`);
      if (SHOTS && scheme === 'light') await m.page.screenshot({ path: path.join(ROOT, `screenshots/iphone12-${t}.png`) });
    }
    await m.page.locator('#sheetBtn').click(); await m.page.waitForTimeout(300);
    const sv = await m.page.evaluate(() => { const v = document.getElementById('sheetView'); return v.scrollWidth <= v.clientWidth; });
    ok(sv, `iPhone 12 (${scheme}) carpenter sheet: no horizontal scroll`);
    if (SHOTS && scheme === 'light') await m.page.screenshot({ path: path.join(ROOT, 'screenshots/iphone12-sheet.png') });
    ok(m.errors.length === 0, `zero console errors on iPhone 12 (${scheme})` + (m.errors.length ? ': ' + m.errors.join(' | ') : ''));
    await m.ctx.close();
  }
} catch (e) {
  console.error(e); failures++;
} finally {
  await browser.close();
  await new Promise(r => server.close(r));
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
