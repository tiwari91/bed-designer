/* Palang: three.js scene. Renders exactly the parts produced by BedCore.buildDesign. */
(function (root) {
  'use strict';
  var THREE = root.THREE, TX = root.BedTextures;
  var MM = 0.001;
  var DIRS = ['+x', '-x', '+y', '-y', '+z', '-z'];

  function roundedBox(w, h, d, r, seg) {
    r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
    var g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
    var pos = g.attributes.position, nor = g.attributes.normal;
    var hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      c.set(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
      n.subVectors(v, c);
      if (n.lengthSq() < 1e-12) n.fromBufferAttribute(nor, i);
      n.normalize();
      v.copy(c).addScaledVector(n, r);
      pos.setXYZ(i, v.x, v.y, v.z); nor.setXYZ(i, n.x, n.y, n.z);
    }
    return g;
  }

  /* Box whose UVs are in metres so wood grain has a real-world scale and runs along each face's long side. */
  function scaledBox(sx, sy, sz, tileU, tileV, seed) {
    var g = new THREE.BoxGeometry(sx, sy, sz);
    var uv = g.attributes.uv, dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
    var off = (seed * 0.6180339) % 1;
    for (var f = 0; f < 6; f++) {
      var du = dims[f][0], dv = dims[f][1];
      for (var k = 0; k < 4; k++) {
        var i = f * 4 + k, u = uv.getX(i), w = uv.getY(i);
        if (dv > du) uv.setXY(i, w * dv / tileU + off, u * du / tileV + off * 0.37);
        else uv.setXY(i, u * du / tileU + off, w * dv / tileV + off * 0.37);
      }
    }
    return g;
  }

  function BedScene(container) {
    this.el = container;
    this.isMobile = Math.min(window.innerWidth, window.innerHeight) < 700;
    var r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    r.domElement.setAttribute('aria-label', '3D view of the bed. Drag to orbit, pinch or scroll to zoom.');
    r.domElement.setAttribute('role', 'img');

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
    this.camera.position.set(3, 2, 4);
    this.texCache = {};
    this.matCache = {};
    this.openT = 0; this.openTarget = 0;
    this.needsRender = true;
    this.lidGroups = []; this.drawerGroups = []; this.struts = [];
    this._lights();
    this.bed = new THREE.Group(); this.scene.add(this.bed);
    this.room = new THREE.Group(); this.scene.add(this.room);

    var C = THREE.OrbitControls;
    if (C) {
      this.controls = new C(this.camera, r.domElement);
      this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
      this.controls.maxPolarAngle = Math.PI * 0.485; this.controls.minPolarAngle = 0.12;
      this.controls.screenSpacePanning = true; this.controls.rotateSpeed = 0.8;
      var self = this;
      this.controls.addEventListener('change', function () { self.needsRender = true; });
    }
    var me = this;
    if (root.ResizeObserver) new ResizeObserver(function () { me.resize(); }).observe(container);
    window.addEventListener('resize', function () { me.resize(); });
    this.resize();
    this._last = performance.now();
    (function loop(t) { requestAnimationFrame(loop); me._tick(t); })(this._last);
  }

  BedScene.prototype._lights = function () {
    var s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xfff3e4, 0xa8957d, 0.62); s.add(this.hemi);
    s.add(new THREE.AmbientLight(0xffffff, 0.12));
    var sun = this.sun = new THREE.DirectionalLight(0xfff0dc, 1.35);
    sun.castShadow = true;
    var m = this.isMobile ? 1024 : 2048;
    sun.shadow.mapSize.set(m, m);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
    var cam = sun.shadow.camera; cam.left = -3.4; cam.right = 3.4; cam.top = 3.4; cam.bottom = -3.4; cam.near = 0.5; cam.far = 14;
    s.add(sun); s.add(sun.target);
    var fill = new THREE.DirectionalLight(0xe4ecff, 0.28); fill.position.set(4, 2.5, 5); s.add(fill);
  };

  BedScene.prototype.tex = function (key, make, repeat) {
    if (!this.texCache[key]) {
      var t = new THREE.CanvasTexture(make());
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      if (repeat) t.repeat.set(repeat[0], repeat[1]);
      this.texCache[key] = t;
    }
    return this.texCache[key];
  };
  BedScene.prototype.mat = function (key, make) {
    if (!this.matCache[key]) this.matCache[key] = make();
    return this.matCache[key];
  };

  BedScene.prototype.setTheme = function (dark) {
    this.scene.background = new THREE.Color(dark ? 0x17140f : 0xf1ece4);
    this.needsRender = true;
  };

  BedScene.prototype._clear = function (g) {
    for (var i = g.children.length - 1; i >= 0; i--) {
      var o = g.children[i];
      this._clear(o);
      if (o.geometry) o.geometry.dispose();
      g.remove(o);
    }
  };

  BedScene.prototype.setDesign = function (d) {
    var self = this, c = d.cfg;
    this.design = d;
    this._clear(this.bed);
    this.lidGroups = []; this.drawerGroups = []; this.struts = [];
    var fin = this.mat('lam-' + c.finish, function () {
      return new THREE.MeshStandardMaterial({ map: self.tex('lam-' + c.finish, function () { return TX.laminate(c.finish); }),
        roughness: c.finish === 'white' ? 0.5 : 0.58, metalness: 0 });
    });
    var raw = this.mat('ply', function () {
      return new THREE.MeshStandardMaterial({ map: self.tex('ply', TX.plywood), roughness: 0.82 });
    });
    var groups = { static: this.bed };
    d.lids.forEach(function (l) {
      var g = new THREE.Group(); g.position.set(l.pivot[0] * MM, l.pivot[1] * MM, l.pivot[2] * MM);
      g.userData = { pivot: l.pivot }; self.bed.add(g); groups[l.group] = g; self.lidGroups.push(g);
    });
    d.drawers.forEach(function (dr) {
      var g = new THREE.Group(); g.userData = { pivot: [0, 0, 0], dir: dr.dir, travel: dr.travel };
      self.bed.add(g); groups[dr.group] = g; self.drawerGroups.push(g);
    });
    var seed = 1;
    d.parts.forEach(function (p) {
      var parent = groups[p.group] || self.bed;
      var pv = parent.userData && parent.userData.pivot || [0, 0, 0];
      var mats;
      if (p.kind === 'timber') mats = fin;
      else mats = DIRS.map(function (dir) { return p.lam.indexOf(dir) >= 0 || p.band.indexOf(dir) >= 0 ? fin : raw; });
      BedCore.solidBoxes(p).forEach(function (b) {
        var sx = (b[3] - b[0]) * MM, sy = (b[4] - b[1]) * MM, sz = (b[5] - b[2]) * MM;
        var m = new THREE.Mesh(scaledBox(sx, sy, sz, 1.2, 0.6, seed++), mats);
        m.position.set(((b[0] + b[3]) / 2 - pv[0]) * MM, ((b[1] + b[4]) / 2 - pv[1]) * MM, ((b[2] + b[5]) / 2 - pv[2]) * MM);
        m.castShadow = m.receiveShadow = true;
        m.userData.part = p.id;
        parent.add(m);
      });
    });
    this._softGoods(d, groups);
    this._struts(d);
    this._decor(d);
    this._room(d);
    this._applyOpen();
    if (!this._framed) { this.resetView(); this._framed = true; }
    this.needsRender = true;
  };

  BedScene.prototype._softGoods = function (d, groups) {
    var self = this, c = d.cfg, mb = d.mattress.box;
    var single = d.lids.length === 1;
    var parent = single ? groups.lid0 : this.bed;
    var pv = single ? d.lids[0].pivot : [0, 0, 0];
    var mg = this.mattressGroup = new THREE.Group();
    mg.position.set(-pv[0] * MM, -pv[1] * MM, -pv[2] * MM);
    parent.add(mg);
    var quiltMat = this.mat('quilt', function () {
      return new THREE.MeshStandardMaterial({ map: self.tex('quilt', TX.quilt, [3, 3]), roughness: 0.95, transparent: true });
    });
    var mw = (mb[3] - mb[0]) * MM, mh = (mb[4] - mb[1]) * MM, ml = (mb[5] - mb[2]) * MM;
    var mat = new THREE.Mesh(roundedBox(mw, mh, ml, 0.045, 6), quiltMat);
    mat.position.set(0, (mb[1] * MM) + mh / 2, (mb[2] * MM) + ml / 2);
    mat.castShadow = mat.receiveShadow = true; mg.add(mat);
    var top = mb[4] * MM;
    var pillowMat = this.mat('pillow', function () { return new THREE.MeshStandardMaterial({ color: 0xfbf8f2, roughness: 0.95, transparent: true }); });
    var n = mw > 1.1 ? 2 : 1, pw = n === 2 ? Math.min(0.64, mw / 2 - 0.06) : Math.min(0.64, mw - 0.16);
    for (var i = 0; i < n; i++) {
      var pl = new THREE.Mesh(roundedBox(pw, 0.12, 0.42, 0.055, 6), pillowMat);
      pl.position.set(n === 2 ? (i ? 1 : -1) * (mw / 4) : 0, top + 0.075, mb[2] * MM + 0.27);
      pl.rotation.x = -0.32; pl.castShadow = pl.receiveShadow = true; mg.add(pl);
    }
    var throwMat = this.mat('throw', function () {
      return new THREE.MeshStandardMaterial({ map: self.tex('throw', TX.blockPrint, [2.5, 1.2]), roughness: 0.9, transparent: true });
    });
    var tl = Math.min(0.62, ml * 0.32), tw = mw + 0.04;
    var th = new THREE.Mesh(roundedBox(tw, 0.03, tl, 0.014, 3), throwMat);
    th.position.set(0, top + 0.012, mb[5] * MM - tl / 2 + 0.02); th.castShadow = th.receiveShadow = true; mg.add(th);
    var drape = new THREE.Mesh(roundedBox(tw, Math.min(0.2, mh + 0.05), 0.014, 0.006, 2), throwMat);
    drape.position.set(0, top - Math.min(0.2, mh + 0.05) / 2 + 0.02, mb[5] * MM + 0.025); drape.castShadow = true; mg.add(drape);
    this.softMats = [quiltMat, pillowMat, throwMat];

    if (d.cushion) {
      var cu = d.cushion, fabMat = this.mat('fab-' + c.fab, function () {
        return new THREE.MeshStandardMaterial({ map: self.tex('fab-' + c.fab, function () { return TX.fabric(BedCore.FABRICS[c.fab].color); }, [4, 4]), roughness: 0.92 });
      });
      var cw = (cu.x1 - cu.x0) / cu.n, ch = (cu.y1 - cu.y0) * MM;
      for (var k = 0; k < cu.n; k++) {
        var m = new THREE.Mesh(roundedBox(cw * MM - 0.004, ch, (cu.z1 - cu.z0) * MM, 0.024, 5), fabMat);
        m.position.set((cu.x0 + cw * (k + 0.5)) * MM, (cu.y0 * MM) + ch / 2, (cu.z0 + cu.z1) / 2 * MM);
        m.castShadow = m.receiveShadow = true; this.bed.add(m);
      }
    }
  };

  BedScene.prototype._struts = function (d) {
    var self = this;
    var body = this.mat('strut', function () { return new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.35, metalness: 0.6 }); });
    var rod = this.mat('rod', function () { return new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.2, metalness: 0.9 }); });
    d.lids.forEach(function (l, i) {
      l.struts.forEach(function (s) {
        var a = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 12), body);
        var b = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1, 10), rod);
        self.bed.add(a); self.bed.add(b);
        self.struts.push({ a: a, b: b, lo: new THREE.Vector3(s.lo[0] * MM, s.lo[1] * MM, s.lo[2] * MM),
          hiLocal: new THREE.Vector3((s.hi[0] - l.pivot[0]) * MM, (s.hi[1] - l.pivot[1]) * MM, (s.hi[2] - l.pivot[2]) * MM), lid: self.lidGroups[i] });
      });
    });
  };

  var UP = new THREE.Vector3(0, 1, 0);
  BedScene.prototype._updateStruts = function () {
    var hi = new THREE.Vector3(), dir = new THREE.Vector3();
    this.struts.forEach(function (s) {
      s.lid.updateMatrixWorld(true);
      hi.copy(s.hiLocal).applyMatrix4(s.lid.matrix);
      dir.subVectors(hi, s.lo);
      var len = dir.length(), q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
      var bodyLen = Math.min(len * 0.6, 0.32);
      s.a.quaternion.copy(q); s.b.quaternion.copy(q);
      s.a.scale.set(1, bodyLen, 1); s.b.scale.set(1, len - bodyLen, 1);
      s.a.position.copy(s.lo).addScaledVector(dir, bodyLen / len / 2);
      s.b.position.copy(hi).addScaledVector(dir, -(len - bodyLen) / len / 2);
    });
  };

  BedScene.prototype._decor = function (d) {
    var self = this;
    d.decor.forEach(function (o) {
      var x = o.x * MM, y = o.y * MM, z = o.z * MM;
      if (o.type === 'lamp') {
        var base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.2, 24), self.mat('ceramic', function () { return new THREE.MeshStandardMaterial({ color: 0xb46a4c, roughness: 0.4 }); }));
        base.position.set(x, y + 0.1, z); base.castShadow = true; self.bed.add(base);
        var shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.16, 28, 1, true), self.mat('shade', function () {
          return new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffcf8a, emissiveIntensity: 0.55, roughness: 0.9, side: THREE.DoubleSide });
        }));
        shade.position.set(x, y + 0.28, z); shade.castShadow = true; self.bed.add(shade);
      } else {
        var cols = [0x3c4a6b, 0xc39434, 0x8f9e88];
        for (var i = 0; i < 3; i++) {
          var b = new THREE.Mesh(new THREE.BoxGeometry(0.22 - i * 0.02, 0.03, 0.16 - i * 0.01), self.mat('book' + i, function () { return new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.8 }); }));
          b.position.set(x, y + 0.015 + i * 0.03, z); b.rotation.y = (i - 1) * 0.18; b.castShadow = true; self.bed.add(b);
        }
      }
    });
  };

  BedScene.prototype._room = function (d) {
    var self = this;
    this._clear(this.room);
    var bz = d.room.backZ * MM, lx = d.room.leftX * MM, Hh = 3.0;
    var floorMat = this.mat('floor', function () {
      return new THREE.MeshStandardMaterial({ map: self.tex('tiles', TX.tiles, [10, 10]), roughness: 0.32, metalness: 0.02 });
    });
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(lx + 6, 0, bz + 6); floor.receiveShadow = true; this.room.add(floor);
    var wallMat = this.wallMat = this.mat('wall', function () { return new THREE.MeshStandardMaterial({ color: 0xe9e1d4, roughness: 0.95 }); });
    wallMat.color.set(d.cfg.wall);
    var back = new THREE.Mesh(new THREE.PlaneGeometry(12, Hh), wallMat);
    back.position.set(lx + 6, Hh / 2, bz); back.receiveShadow = true; this.room.add(back);
    var left = new THREE.Mesh(new THREE.PlaneGeometry(12, Hh), wallMat);
    left.rotation.y = Math.PI / 2; left.position.set(lx, Hh / 2, bz + 6); left.receiveShadow = true; this.room.add(left);
    var skirt = this.mat('skirt', function () { return new THREE.MeshStandardMaterial({ color: 0xf3efe8, roughness: 0.6 }); });
    var s1 = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 0.012), skirt); s1.position.set(lx + 6, 0.04, bz + 0.006); s1.receiveShadow = true; this.room.add(s1);
    var s2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.08, 12), skirt); s2.position.set(lx + 0.006, 0.04, bz + 6); s2.receiveShadow = true; this.room.add(s2);
    // window on the left wall
    var wz = bz + Math.max(2.4, d.dims.L * MM + 0.4), wy = 1.55, ww = 1.3, wh = 1.3;
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), this.mat('glass', function () {
      return new THREE.MeshStandardMaterial({ color: 0xdfeaf2, emissive: 0xeaf3ff, emissiveIntensity: 0.9, roughness: 0.2 });
    }));
    glass.rotation.y = Math.PI / 2; glass.position.set(lx + 0.004, wy, wz); this.room.add(glass);
    var frameMat = this.mat('frame', function () { return new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.5 }); });
    [[0.05, wh + 0.1, 0, 0, -ww / 2], [0.05, wh + 0.1, 0, 0, ww / 2], [0.05, 0.05, ww, wh / 2, 0], [0.05, 0.05, ww, -wh / 2, 0], [0.03, wh, 0, 0, 0], [0.12, 0.04, ww + 0.16, -wh / 2 - 0.04, 0]].forEach(function (f) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(f[0], f[1], f[2] || 0.05), frameMat);
      m.position.set(lx + f[0] / 2, wy + f[3], wz + f[4]); m.castShadow = true; self.room.add(m);
    });
    // sun comes in through the window side
    var cx = 0, cz = d.dims.L * MM / 2;
    this.sun.position.set(lx + 0.6, 3.6, wz + 1.2);
    this.sun.target.position.set(cx, 0.3, cz);
    this.sun.target.updateMatrixWorld();
  };

  BedScene.prototype.setWall = function (hex) { if (this.wallMat) { this.wallMat.color.set(hex); this.needsRender = true; } };

  BedScene.prototype.setOpen = function (open) { this.openTarget = open ? 1 : 0; this.needsRender = true; };
  BedScene.prototype._applyOpen = function () {
    var t = this.openT, e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    var ang = (this.design && this.design.cfg.lid === 'split' ? 46 : 40) * Math.PI / 180;
    this.lidGroups.forEach(function (g) { g.rotation.x = -ang * e; });
    this.drawerGroups.forEach(function (g) { g.position.x = g.userData.dir * g.userData.travel * MM * e; });
    if (this.softMats) {
      var ghost = this.lidGroups.length > 1 ? 1 - 0.85 * e : 1;
      this.softMats.forEach(function (m) { m.opacity = ghost; m.depthWrite = ghost > 0.98; });
      if (this.mattressGroup) this.mattressGroup.visible = ghost > 0.03;
    }
    if (this.struts.length) this._updateStruts();
  };

  BedScene.prototype.resetView = function () {
    var box = new THREE.Box3().setFromObject(this.bed);
    if (box.isEmpty()) return;
    var sph = box.getBoundingSphere(new THREE.Sphere());
    var aspect = this.camera.aspect || 1;
    var vf = this.camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    var dist = sph.radius / Math.sin(Math.min(vf, hf) / 2) * (aspect < 1 ? 0.92 : 0.98);
    var dir = new THREE.Vector3(0.62, 0.5, 1).normalize();
    var target = sph.center.clone(); target.y *= 0.72;
    this.camera.position.copy(target).addScaledVector(dir, dist);
    this.camera.lookAt(target);
    if (this.controls) {
      this.controls.target.copy(target);
      this.controls.minDistance = sph.radius * 0.6; this.controls.maxDistance = sph.radius * 4.5;
      this.controls.update();
    }
    this.needsRender = true;
  };

  BedScene.prototype.resize = function () {
    var w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.needsRender = true;
  };

  BedScene.prototype._tick = function (t) {
    var dt = Math.min(0.05, (t - this._last) / 1000); this._last = t;
    if (this.controls && this.controls.update()) this.needsRender = true;
    if (this.openT !== this.openTarget) {
      var step = dt / 0.9;
      this.openT = this.openTarget > this.openT ? Math.min(1, this.openT + step) : Math.max(0, this.openT - step);
      this._applyOpen(); this.needsRender = true;
    }
    if (this.needsRender) { this.renderer.render(this.scene, this.camera); this.needsRender = false; this.frames = (this.frames || 0) + 1; }
  };

  /* Render now and sample pixels (used by the headless check). */
  BedScene.prototype.stats = function () {
    this.renderer.render(this.scene, this.camera);
    var gl = this.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    var px = new Uint8Array(64 * 64 * 4);
    gl.readPixels(Math.floor(w / 2) - 32, Math.floor(h / 2) - 32, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px);
    var set = {};
    for (var i = 0; i < px.length; i += 4) set[(px[i] >> 3) + ',' + (px[i + 1] >> 3) + ',' + (px[i + 2] >> 3)] = 1;
    return { width: w, height: h, uniqueColours: Object.keys(set).length, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, meshes: this.bed.children.length };
  };

  root.BedScene = BedScene;
})(window);
