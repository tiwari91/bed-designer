// Unit tests for the nesting + materials maths. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const B = require('../js/materials.js');

const overlaps = (a, b, k) => a.x < b.x + b.w + k && b.x < a.x + a.w + k && a.y < b.y + b.h + k && b.y < a.y + a.h + k;
function assertValid(res, pieces) {
  let placed = 0;
  for (const s of res.sheets) {
    for (const p of s.placed) {
      assert.ok(p.x >= 0 && p.y >= 0, 'inside sheet');
      assert.ok(p.x + p.w <= res.W + 1e-9 && p.y + p.h <= res.H + 1e-9, `piece ${p.w}x${p.h} at ${p.x},${p.y} inside sheet`);
    }
    for (let i = 0; i < s.placed.length; i++)
      for (let j = i + 1; j < s.placed.length; j++)
        assert.ok(!overlaps(s.placed[i], s.placed[j], res.kerf - 1e-9), 'no overlap, kerf respected');
    placed += s.placed.length;
  }
  assert.equal(placed + res.oversize.length, pieces.length, 'every piece placed or reported oversize');
}

test('a full sheet fills exactly one sheet', () => {
  const r = B.nest([{ w: 2440, h: 1220 }]);
  assert.equal(r.count, 1);
  assert.equal(r.oversize.length, 0);
});

test('kerf is accounted for: two 1218-wide pieces fit on one 2440 sheet, two 1220s do not', () => {
  assert.equal(B.nest([{ w: 1218, h: 1220 }, { w: 1218, h: 1220 }], { kerf: 4 }).count, 1);
  assert.equal(B.nest([{ w: 1220, h: 1220 }, { w: 1220, h: 1220 }], { kerf: 4 }).count, 2);
  assert.equal(B.nest([{ w: 1220, h: 1220 }, { w: 1220, h: 1220 }], { kerf: 0 }).count, 1);
});

test('rotation is used when it helps', () => {
  const r = B.nest([{ w: 1000, h: 2000 }]);
  assert.equal(r.count, 1);
  assert.equal(r.sheets[0].placed[0].rot, true);
});

test('pieces larger than a sheet are reported, not silently placed', () => {
  const r = B.nest([{ w: 2500, h: 500 }, { w: 500, h: 500 }]);
  assert.equal(r.oversize.length, 1);
  assert.equal(r.count, 1);
});

test('random piece sets never overlap and never exceed the sheet', () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let t = 0; t < 40; t++) {
    const pieces = Array.from({ length: 5 + Math.floor(rnd() * 25) }, () => ({ w: 30 + Math.round(rnd() * 2000), h: 30 + Math.round(rnd() * 1100) }));
    const r = B.nest(pieces, { kerf: 4 });
    assertValid(r, pieces);
    const area = pieces.reduce((a, p) => a + p.w * p.h, 0) / 1e6;
    assert.ok(r.count >= Math.ceil(area / (2.44 * 1.22) - 1e-9), 'never below the area lower bound');
  }
});

test('splitToFit cuts oversize panels into the fewest pieces that fit', () => {
  assert.deepEqual(B.splitToFit(2000, 1000), { n: 1, a: 2000, b: 1000 });
  const s = B.splitToFit(1863, 1549);
  assert.equal(s.n, 2);
  assert.ok(B.fits(s.a, s.b));
});

test('queen 5x6.5 ft hydraulic, 18 in high, 3.5 ft headboard: 3-4 sheets of 18 mm before wastage', () => {
  const d = B.buildDesign({ size: 'queen', h: 18, storage: 'hydraulic', lid: 'single', hb: 'plain', hbh: 42 });
  const m = B.computeMaterials(d);
  const n = m.ply[18].nest;
  assert.ok(n.count >= 3 && n.count <= 4, 'got ' + n.count);
  assertValid(n, Array(m.rows.filter(r => r.t === 18).reduce((a, r) => a + r.qty, 0)).fill(0));
  assert.ok(m.ply[18].buy >= n.count, 'wastage never lowers the count');
  assert.ok(m.ply[18].withWastageM2 > m.ply[18].areaM2 * 1.099);
  assert.equal(m.hardware.find(h => h.key === 'hyd').qty, 1);
});

test('changing the size changes the cutting list', () => {
  const q = B.computeMaterials(B.buildDesign({ size: 'queen' }));
  const k = B.computeMaterials(B.buildDesign({ size: 'king' }));
  const side = m => m.rows.find(r => r.name === 'Foot panel');
  assert.equal(side(k).a - side(q).a, 305); // king is 12″ (305 mm) wider
});

test('split lid needs two lift kits, drawers need two channel pairs', () => {
  const s = B.computeMaterials(B.buildDesign({ storage: 'hydraulic', lid: 'split' }));
  assert.equal(s.hardware.find(h => h.key === 'hyd').qty, 2);
  const d = B.computeMaterials(B.buildDesign({ storage: 'drawers' }));
  assert.equal(d.hardware.find(h => h.key === 'chan').qty, 2);
  assert.ok(d.rows.some(r => r.name === 'Drawer bottom' && r.t === 12));
});

test('share code round-trips', () => {
  const cfg = { size: 'custom', w: 66, l: 80, h: 16, storage: 'drawers', lid: 'split', hb: 'cushioned', hbh: 48, tables: true, finish: 'oak', fab: 'sage', wall: '#c7d1bf', grade: 'mr', mt: 8 };
  assert.deepEqual(B.decode(B.encode(cfg)), B.normalize(cfg));
  assert.equal(B.decode('garbage'), null);
});
