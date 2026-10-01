# Palang: bed designer

Design a plywood bed for your bedroom in 3D, see exactly what material it needs, and hand a clear spec to your carpenter.

**Live:** https://tiwari91.github.io/bed-designer/

## What it does

- **3D design** (three.js r147): Single 3×6.5 ft, Double 4×6.5, Queen 5×6.5, King 6×6.5 or a custom mattress size in inches. Bed height 14–20″. Storage: on legs, two drawers, or a hydraulic lift lid (single or split in two). Headboard: none, plain panel or cushioned, with optional side tables. Laminate finishes (walnut, teak, oak, white, grey) are procedural textures. The room has a tiled floor, two walls you can recolour, and a window. Drawers slide out and lids lift. Drag to orbit and pinch or scroll to zoom; this works on touch screens.
- **Material calculator from the actual geometry.** Every panel in the 3D model becomes a row in the cutting list (size in mm and inches, thickness, edge banding, laminate faces). Pieces are nested on 8×4 ft (2440×1220 mm) sheets per thickness with a 4 mm saw kerf, and the layouts are drawn as SVG.
- **Cost estimate** with editable unit prices: BWP vs MR plywood, laminate, edge band, hardware, labour days. Defaults are rough Pune figures, clearly marked, not live prices.
- **Carpenter sheet**: front, side and top dimensioned drawings, the cutting list, sheet layouts, materials, and notes. Export it with *Copy as text* (for WhatsApp), *Download PNG*, or *Print / PDF*.
- **Save and share**: the design is kept in localStorage, and the URL hash (`#bed=v1,…`) holds the whole design, so the link opens the same bed for the carpenter.

## How the material maths works

1. `js/geometry.js` builds the bed as a list of panels, each an axis-aligned box in mm with a thickness, laminated faces and banded edges. The 3D scene, the drawings and the cutting list all read this same list.
2. `js/materials.js` turns each panel into a cut piece (the two non-thickness dimensions). A panel bigger than a sheet (for example a 1549 × 1863 mm queen lid) is cut into equal strips that fit, plus a joint batten. Identical pieces are grouped.
3. `js/nesting.js` packs each thickness onto 2440 × 1220 sheets with a guillotine packer: every cut runs edge to edge, the way a carpenter cuts on a table saw. Rotation is allowed and each piece reserves 4 mm of kerf. It tries 24 strategies (3 sort orders × 4 split rules × 2 fit rules) and keeps the one with the fewest sheets, and among ties the emptiest last sheet.
4. **Wastage (default 10%, editable):** buy = max(nested sheets, ⌈parts area × 1.10 ÷ 2.977 m²⌉). The same allowance is added to laminate, edge band, screws, Fevicol, foam and fabric.
5. Edge band = the sum of exposed edges. Laminate = outer faces only, cut 10 mm oversize, nested on 8×4 sheets. Hardware is counted from the design (lift-kit pairs per lid, with strut force from lid + mattress weight; channel pairs per drawer; hinges per door).

Queen 5×6.5 ft, hydraulic single lid, 18″ box, plain 3.5 ft headboard: **4 sheets of 18 mm** (8.43 m² of parts, 71% use; with 10% wastage 9.27 m² still fits in 4), **2 sheets of 9 mm** for the storage floor, 3 laminate sheets, 13.2 m of edge band (buy 15 m), and 1 lift-kit pair.

## Construction assumptions

- The box is 1″ (25 mm) bigger than the mattress. 18 mm plywood for the box, lid and headboard; 9 mm for the storage floor; 12 mm for drawer boxes and the cushion board.
- With a headboard, the headboard panel forms the head end of the box. The lid sits behind a 140 mm fixed strip, and lift-kit brackets screw straight into the 18 mm lid.
- Joinery is screwed and glued butt joints.

## Run locally

Open `index.html` through any static server, e.g. `python3 -m http.server`. It needs network access for three.js (cdnjs), OrbitControls (jsdelivr) and Google Fonts.

## Tests

```sh
node --test tests/              # nesting + materials unit tests
node tests/check.mjs [--shots]  # headless Chromium: WebGL renders, zero console errors,
                                # cutting list follows size, queen sheet count,
                                # share URL round-trip, PNG export, no horizontal scroll on iPhone 12
```

`check.mjs` loads Playwright from the s2s-web-client checkout and uses `CHROME_BIN` (defaults to the local chrome-headless-shell). It starts and stops its own static server.

## Files

`index.html`, `css/styles.css`, `js/geometry.js`, `js/nesting.js`, `js/materials.js`, `js/drawings.js`, `js/textures.js`, `js/scene.js`, `js/export.js`, `js/ui.js`, `tests/`.
