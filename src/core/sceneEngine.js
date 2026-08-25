/**
 * core/sceneEngine.js
 * ---------------------------------------------------------------------------
 * QR 매트릭스 → InstancedMesh 블록 그리드로 변환하는 "테마와 무관한" 공통 엔진.
 *
 * 엔진이 책임지는 것
 *   - 매트릭스 → 블록 인스턴스 매핑 (dark = 높은 블록 / light = 낮은 블록)
 *   - 카메라·조명·바닥·배경 구성
 *   - progress(0~1) 로 3D ↔ 2D 를 보간 (core/transition.js 사용)
 *   - 탑다운 뷰에서의 스캔 가능성 보장
 *       · 블록 XZ 스케일을 정확히 1.0 으로 닫아 모듈 사이 틈 제거
 *       · emissive 로 순수 스캔 색상 출력(조명·안개 영향 제거)
 *       · quiet zone 을 포함한 밝은 바닥면
 *       · 장식 오브젝트 완전 페이드아웃
 *
 * 테마가 책임지는 것 (src/themes/*.js)
 *   - getBlockGeometry(isDark) / getPalette() / placeDecorations(size) /
 *     getBackgroundSetup()
 */

import * as THREE from 'three';
import {
  TransitionController,
  computeTransitionState,
  clamp,
  DEG,
} from './transition.js';

const UP = new THREE.Vector3(0, 1, 0);
const BLACK = new THREE.Color(0x000000);

/** 블록 사이 z-fighting 방지를 위한 최소 단차 */
const GROUND_OFFSET = 0.02;

export class SceneEngine {
  /**
   * @param {HTMLElement} container 렌더러가 붙을 DOM 요소
   * @param {object} [options]
   * @param {(target:number)=>void} [options.onViewChange] 3D/2D 전환 시 콜백
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;

    this.theme = null;
    this.qr = null;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.domElement.classList.add('qr612-canvas');
    this.renderer.domElement.setAttribute('tabindex', '0');
    this.renderer.domElement.setAttribute('role', 'button');
    this.renderer.domElement.setAttribute(
      'aria-label',
      '탭하여 QR코드 보기 / 3D 장면으로 돌아가기'
    );
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 8000);
    this.target = new THREE.Vector3(0, 0, 0);

    /** 씬 그룹 */
    this.blockGroup = new THREE.Group();
    this.decorGroup = new THREE.Group();
    this.celestialGroup = new THREE.Group();
    this.lightGroup = new THREE.Group();
    this.scene.add(
      this.blockGroup,
      this.decorGroup,
      this.celestialGroup,
      this.lightGroup
    );

    this.transition = new TransitionController({
      onChange: (t) => this.options.onViewChange?.(t),
    });

    /** 사용자 조작 오프셋(도) */
    this.autoAzimuth = 0;
    this.userAzimuth = 0;
    this.userElevation = 0;

    this._dummy = new THREE.Object3D();
    this._tmpColor = new THREE.Color();
    this._clock = new THREE.Clock();
    this._needsInstanceUpdate = true;
    this._disposables = [];
    this._running = false;

    this._bindPointer();
    this._bindResize();
    this.resize();
  }

  /* --------------------------------------------------------------- */
  /* 구성                                                             */
  /* --------------------------------------------------------------- */

  /** @param {object} theme src/themes/*.js 의 테마 모듈 */
  setTheme(theme) {
    this.theme = theme;
    if (this.qr) this.rebuild();
  }

  /** @param {{matrix: boolean[][], size: number, quietZone: number}} qr */
  setMatrix(qr) {
    this.qr = qr;
    if (this.theme) this.rebuild();
  }

  /** 테마 + 매트릭스로 씬 전체를 다시 만든다. */
  rebuild() {
    if (!this.theme || !this.qr) return;

    this._clearScene();

    const { matrix, size } = this.qr;
    const palette = this.theme.getPalette();
    this.palette = palette;
    this.curvature = this.theme.getCurvature ? this.theme.getCurvature() : 0;
    this.sphereRadius = size * 1.25;

    this.scanDark = new THREE.Color(palette.scanDark || '#101010');
    this.scanLight = new THREE.Color(palette.scanLight || '#FAFAFA');

    this._buildBackground();
    this._buildBlocks(matrix, size);
    this._buildGround(size);
    this._buildDecorations(size);
    this._buildScanOverlay(size);

    this._needsInstanceUpdate = true;
    this.resize();
    this._applyState(this._state());
  }

  /* --------------------------------------------------------------- */
  /* 배경 · 조명                                                       */
  /* --------------------------------------------------------------- */

  _buildBackground() {
    const setup = this.theme.getBackgroundSetup() || {};
    this.backgroundSetup = setup;

    this.baseBackground = new THREE.Color(setup.background || '#101018');
    this.scene.background = this.baseBackground.clone();

    if (setup.fog) {
      this.baseFog = { ...setup.fog };
      this.scene.fog = new THREE.Fog(
        setup.fog.color || setup.background || '#101018',
        setup.fog.near ?? 40,
        setup.fog.far ?? 260
      );
    } else {
      this.baseFog = null;
      this.scene.fog = null;
    }

    this.lights = [];
    for (const spec of setup.lights || []) {
      const light = createLight(spec);
      if (!light) continue;
      this.lightGroup.add(light);
      this.lights.push({ light, baseIntensity: light.intensity, spec });
    }

    for (const spec of setup.objects || []) {
      const obj = this.theme.buildDecoration?.(spec);
      if (obj) {
        applySpecTransform(obj, spec);
        this.celestialGroup.add(obj);
        this._trackDisposable(obj);
      }
    }
  }

  /* --------------------------------------------------------------- */
  /* 블록 그리드                                                       */
  /* --------------------------------------------------------------- */

  _buildBlocks(matrix, size) {
    const darkCells = [];
    const lightCells = [];

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const cell = { x: col - (size - 1) / 2, z: row - (size - 1) / 2 };
        (matrix[row][col] ? darkCells : lightCells).push(cell);
      }
    }

    this.darkCells = darkCells;
    this.lightCells = lightCells;

    this.darkMesh = this._createInstancedMesh(true, darkCells.length);
    this.lightMesh = this._createInstancedMesh(false, lightCells.length);
    this.blockGroup.add(this.darkMesh.mesh, this.lightMesh.mesh);
  }

  _createInstancedMesh(isDark, count) {
    const spec = this.theme.getBlockGeometry(isDark);
    const geometry = normalizeBlockGeometry(spec.geometry);
    const material = spec.material;
    // 3D 뷰의 공기감을 위해 안개를 켜둔다.
    // 전환이 시작되면 엔진이 안개를 걷어내고(fogRelease), 스캔 뷰에서는
    // 안개 영향을 받지 않는 오버레이가 최종 QR을 그리므로 대비는 안전하다.
    material.fog = true;

    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(count, 1));
    mesh.count = count;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this._trackDisposable(mesh);

    return {
      mesh,
      material,
      baseColor: material.color ? material.color.clone() : new THREE.Color(),
      baseEmissive: material.emissive
        ? material.emissive.clone()
        : new THREE.Color(0x000000),
      height3d: spec.height ?? (isDark ? 2.4 : 0.5),
    };
  }

  /* --------------------------------------------------------------- */
  /* 바닥 (quiet zone 포함)                                            */
  /* --------------------------------------------------------------- */

  _buildGround(size) {
    const quiet = this.qr.quietZone ?? 4;
    // 화면 밖까지 넉넉히 깔아 바닥면의 직선 모서리가 보이지 않게 한다.
    const span = (size + quiet * 2 + 8) * 2.2;
    const segments = 96;

    const geometry = new THREE.PlaneGeometry(span, span, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(this.palette.ground || this.palette.light),
      emissive: new THREE.Color(this.palette.groundEmissive || '#000000'),
      fog: true,
      side: THREE.FrontSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -GROUND_OFFSET;
    mesh.renderOrder = -1;
    this.blockGroup.add(mesh);
    this._trackDisposable(mesh);

    this.ground = {
      mesh,
      material,
      baseColor: material.color.clone(),
      baseEmissive: material.emissive.clone(),
      basePositions: Float32Array.from(
        geometry.attributes.position.array
      ),
    };
    this._groundBend = -1;
  }

  /* --------------------------------------------------------------- */
  /* 스캔 보장 오버레이                                                */
  /* --------------------------------------------------------------- */

  /**
   * progress 가 1 에 가까워질 때만 나타나는 "정답 QR" 레이어.
   *
   * - dark 모듈: 정확히 1×1 크기의 순수 scanDark 평면
   * - 바탕: QR + quiet zone 을 덮는 순수 scanLight 평면
   * - depthTest 를 끄고 렌더 순서를 최상단으로 두어 장식/조명의 영향을 완전히 차단
   *
   * 덕분에 테마는 블록 지오메트리를 자유롭게(별 모양, 원형 타일 등) 쓰면서도
   * 탑다운 뷰의 스캔 성공률을 잃지 않는다.
   */
  _buildScanOverlay(size) {
    const quiet = this.qr.quietZone ?? 4;
    const span = size + quiet * 2;

    const baseGeo = new THREE.PlaneGeometry(span, span);
    baseGeo.rotateX(-Math.PI / 2);
    const baseMat = new THREE.MeshBasicMaterial({
      color: this.scanLight.clone(),
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.4;
    base.renderOrder = 900;
    base.visible = false;
    base.frustumCulled = false;

    const moduleGeo = new THREE.PlaneGeometry(1, 1);
    moduleGeo.rotateX(-Math.PI / 2);
    const moduleMat = new THREE.MeshBasicMaterial({
      color: this.scanDark.clone(),
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const modules = new THREE.InstancedMesh(
      moduleGeo,
      moduleMat,
      Math.max(this.darkCells.length, 1)
    );
    modules.count = this.darkCells.length;
    modules.renderOrder = 901;
    modules.visible = false;
    modules.frustumCulled = false;

    const dummy = this._dummy;
    for (let i = 0; i < this.darkCells.length; i += 1) {
      const { x, z } = this.darkCells[i];
      dummy.position.set(x, 0.42, z);
      dummy.quaternion.identity();
      // 1.002 — 부동소수 오차로 모듈 사이에 실틈이 생기지 않도록 아주 살짝 겹친다
      dummy.scale.set(1.002, 1, 1.002);
      dummy.updateMatrix();
      modules.setMatrixAt(i, dummy.matrix);
    }
    modules.instanceMatrix.needsUpdate = true;

    this.scene.add(base, modules);
    this._trackDisposable(base);
    this._trackDisposable(modules);
    this.scanOverlay = { base, baseMat, modules, moduleMat };
  }

  /* --------------------------------------------------------------- */
  /* 장식 오브젝트                                                     */
  /* --------------------------------------------------------------- */

  _buildDecorations(size) {
    const specs = this.theme.placeDecorations(size) || [];
    for (const spec of specs) {
      const obj = this.theme.buildDecoration?.(spec);
      if (!obj) continue;
      applySpecTransform(obj, spec);
      this._applyDomeToObject(obj, 1);
      this.decorGroup.add(obj);
      this._trackDisposable(obj);
    }
    this._decorBend = 1;
  }

  /* --------------------------------------------------------------- */
  /* 전환 상태 적용                                                    */
  /* --------------------------------------------------------------- */

  _state() {
    const size = this.qr?.size ?? 25;
    return computeTransitionState(this.transition.progress, {
      matrixSize: size,
      quietZone: this.qr?.quietZone ?? 4,
      aspect: this.camera.aspect,
      curvature: this.curvature ?? 0,
      darkHeight3d: this.darkMesh?.height3d,
      lightHeight3d: this.lightMesh?.height3d,
    });
  }

  _applyState(state) {
    this._applyCamera(state);
    this._applyInstances(state);
    this._applyGround(state);
    this._applyMaterials(state);
    this._applyDecorFade(state);
    this._applyScanOverlay(state);
  }

  _applyScanOverlay(state) {
    if (!this.scanOverlay) return;
    const { base, baseMat, modules, moduleMat } = this.scanOverlay;
    const o = state.scanOverlay;
    const visible = o > 0.001;

    base.visible = visible;
    modules.visible = visible;
    baseMat.opacity = o;
    moduleMat.opacity = o;
  }

  _applyCamera(state) {
    const interact = state.interactivity;
    const azimuth =
      state.azimuth + (this.autoAzimuth + this.userAzimuth) * interact;
    const elevation = clamp(
      state.elevation + this.userElevation * interact,
      8,
      89.4
    );

    const el = elevation * DEG;
    const az = azimuth * DEG;
    const r = state.distance;

    this.camera.fov = state.fov;
    // 하늘의 배경 오브젝트(먼 별·해)가 잘리지 않도록 넉넉한 far
    this.camera.far = r * 9;
    this.camera.near = Math.max(0.5, r * 0.02);
    this.camera.position.set(
      r * Math.cos(el) * Math.sin(az),
      r * Math.sin(el),
      r * Math.cos(el) * Math.cos(az)
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }

  _applyInstances(state) {
    if (!this.darkMesh) return;

    this._writeInstances(this.darkMesh, this.darkCells, state.darkHeight, state);
    this._writeInstances(
      this.lightMesh,
      this.lightCells,
      state.lightHeight,
      state
    );
  }

  _writeInstances(entry, cells, height, state) {
    const dummy = this._dummy;
    const R = this.sphereRadius;
    const bend = state.bend;
    const sxz = state.blockScaleXZ;

    for (let i = 0; i < cells.length; i += 1) {
      const { x, z } = cells[i];
      let y = 0;

      if (bend > 0.0001) {
        y = -((x * x + z * z) / (2 * R)) * bend;
        dummy.quaternion.setFromUnitVectors(
          UP,
          new THREE.Vector3((x / R) * bend, 1, (z / R) * bend).normalize()
        );
      } else {
        dummy.quaternion.identity();
      }

      dummy.position.set(x, y, z);
      dummy.scale.set(sxz, height, sxz);
      dummy.updateMatrix();
      entry.mesh.setMatrixAt(i, dummy.matrix);
    }

    entry.mesh.instanceMatrix.needsUpdate = true;
    entry.mesh.computeBoundingSphere();
  }

  _applyGround(state) {
    if (!this.ground) return;

    // 곡률이 바뀔 때만 정점 재계산
    if (Math.abs(state.bend - this._groundBend) > 0.001) {
      const geo = this.ground.mesh.geometry;
      const pos = geo.attributes.position;
      const base = this.ground.basePositions;
      const R = this.sphereRadius;

      for (let i = 0; i < pos.count; i += 1) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        const y = -((x * x + z * z) / (2 * R)) * state.bend;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      this._groundBend = state.bend;
    }

    if (Math.abs(state.bend - this._decorBend) > 0.001) {
      for (const obj of this.decorGroup.children) {
        this._applyDomeToObject(obj, state.bend);
      }
      this._decorBend = state.bend;
    }
  }

  /** 장식 오브젝트를 구면 표면에 얹고 법선 방향으로 기울인다. */
  _applyDomeToObject(obj, bend) {
    const anchor = obj.userData.anchor;
    if (!anchor) return;

    const R = this.sphereRadius;
    const { x, z, y } = anchor;
    const drop =
      this.curvature > 0 ? -((x * x + z * z) / (2 * R)) * bend * this.curvature : 0;

    obj.position.set(x, y + drop, z);

    if (this.curvature > 0) {
      const normal = new THREE.Vector3(
        (x / R) * bend * this.curvature,
        1,
        (z / R) * bend * this.curvature
      ).normalize();
      const tilt = new THREE.Quaternion().setFromUnitVectors(UP, normal);
      obj.quaternion.copy(tilt).multiply(obj.userData.baseQuaternion);
    }
  }

  _applyMaterials(state) {
    const flat = state.flat;

    for (const entry of [this.darkMesh, this.lightMesh]) {
      if (!entry) continue;
      const scan = entry === this.darkMesh ? this.scanDark : this.scanLight;
      entry.material.color.copy(entry.baseColor).lerp(BLACK, flat);
      if (entry.material.emissive) {
        entry.material.emissive.copy(entry.baseEmissive).lerp(scan, flat);
      }
    }

    if (this.ground) {
      this.ground.material.color.copy(this.ground.baseColor).lerp(BLACK, flat);
      this.ground.material.emissive
        .copy(this.ground.baseEmissive)
        .lerp(this.scanLight, flat);
    }

    if (this.scene.background) {
      this._tmpColor.copy(this.baseBackground).lerp(this.scanLight, flat);
      this.scene.background.copy(this._tmpColor);
    }

    if (this.scene.fog && this.baseFog) {
      const release = 1 + state.fogRelease * 60;
      this.scene.fog.near = this.baseFog.near * release;
      this.scene.fog.far = this.baseFog.far * release;
    }

    for (const { light, baseIntensity } of this.lights || []) {
      light.intensity = baseIntensity * (1 - flat);
    }
  }

  _applyDecorFade(state) {
    const opacity = state.decorOpacity;
    const visible = opacity > 0.01;

    for (const group of [this.decorGroup, this.celestialGroup]) {
      group.visible = visible;
      if (!visible) continue;
      group.traverse((obj) => {
        if (!obj.material) return;
        const materials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        for (const m of materials) {
          if (m.userData.baseOpacity === undefined) {
            m.userData.baseOpacity = m.opacity ?? 1;
          }
          m.transparent = true;
          m.opacity = m.userData.baseOpacity * opacity;
          m.depthWrite = m.opacity > 0.9;
        }
      });
    }
  }

  /* --------------------------------------------------------------- */
  /* 뷰 전환 API                                                       */
  /* --------------------------------------------------------------- */

  toggleView() {
    return this.transition.toggle();
  }

  setProgress(value, { animate = true } = {}) {
    if (animate) this.transition.setTarget(value);
    else {
      this.transition.jumpTo(value);
      this._applyState(this._state());
    }
  }

  get isScanView() {
    return this.transition.isScanView;
  }

  /* --------------------------------------------------------------- */
  /* 루프                                                              */
  /* --------------------------------------------------------------- */

  start() {
    if (this._running) return;
    this._running = true;
    this._clock.start();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  stop() {
    this._running = false;
    this.renderer.setAnimationLoop(null);
  }

  _tick() {
    const dt = Math.min(this._clock.getDelta(), 0.1);
    const changed = this.transition.update(dt);
    const state = this._state();

    if (!this._dragging) {
      this.autoAzimuth += dt * 3.2 * state.interactivity;
    }

    if (changed || this._needsInstanceUpdate) {
      this._applyState(state);
      this._needsInstanceUpdate = false;
    } else {
      this._applyCamera(state);
    }

    this._updateBillboards();
    this.renderer.render(this.scene, this.camera);
  }

  /** 항상 카메라를 바라봐야 하는 배경 오브젝트(해·달 등) */
  _updateBillboards() {
    if (!this.celestialGroup.visible) return;
    for (const obj of this.celestialGroup.children) {
      if (obj.userData.billboard) obj.quaternion.copy(this.camera.quaternion);
    }
  }

  /* --------------------------------------------------------------- */
  /* 입력                                                              */
  /* --------------------------------------------------------------- */

  _bindPointer() {
    const el = this.renderer.domElement;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let pointerId = null;

    const onDown = (e) => {
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      moved = false;
      this._dragging = false;
      el.setPointerCapture?.(pointerId);
    };

    const onMove = (e) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 8) return;

      moved = true;
      this._dragging = true;
      this.userAzimuth += dx * 0.35;
      this.userElevation = clamp(this.userElevation - dy * 0.2, -18, 45);
      startX = e.clientX;
      startY = e.clientY;
    };

    const onUp = (e) => {
      if (pointerId === null) return;
      el.releasePointerCapture?.(pointerId);
      pointerId = null;
      this._dragging = false;
      if (!moved) this.toggleView();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', () => {
      pointerId = null;
      this._dragging = false;
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleView();
      }
    });
  }

  _bindResize() {
    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(this.container);
  }

  resize() {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.qr && this.theme) this._applyCamera(this._state());
  }

  /* --------------------------------------------------------------- */
  /* 정리                                                              */
  /* --------------------------------------------------------------- */

  _trackDisposable(obj) {
    this._disposables.push(obj);
  }

  _clearScene() {
    if (this.scanOverlay) {
      this.scene.remove(this.scanOverlay.base, this.scanOverlay.modules);
      this.scanOverlay = null;
    }

    for (const group of [
      this.blockGroup,
      this.decorGroup,
      this.celestialGroup,
      this.lightGroup,
    ]) {
      group.clear();
    }

    for (const obj of this._disposables) disposeObject(obj);
    this._disposables = [];

    this.darkMesh = null;
    this.lightMesh = null;
    this.ground = null;
    this.lights = [];
  }

  dispose() {
    this.stop();
    this._clearScene();
    this._resizeObserver?.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/* ------------------------------------------------------------------ */
/* 유틸                                                                */
/* ------------------------------------------------------------------ */

/**
 * 테마가 준 지오메트리를 "밑면 1×1, 높이 1, 원점은 밑면 중앙" 으로 정규화한다.
 * 엔진이 XZ 스케일을 1.0 으로 닫았을 때 모듈이 정확히 맞물리도록 보장하는 장치.
 *
 * @param {THREE.BufferGeometry} geometry
 * @returns {THREE.BufferGeometry}
 */
export function normalizeBlockGeometry(geometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const sizeX = Math.max(box.max.x - box.min.x, 1e-6);
  const sizeY = Math.max(box.max.y - box.min.y, 1e-6);
  const sizeZ = Math.max(box.max.z - box.min.z, 1e-6);

  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    -box.min.y,
    -(box.min.z + box.max.z) / 2
  );
  geometry.scale(1 / sizeX, 1 / sizeY, 1 / sizeZ);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createLight(spec) {
  const color = new THREE.Color(spec.color || '#ffffff');
  switch (spec.type) {
    case 'ambient':
      return new THREE.AmbientLight(color, spec.intensity ?? 1);
    case 'hemisphere':
      return new THREE.HemisphereLight(
        new THREE.Color(spec.sky || spec.color || '#ffffff'),
        new THREE.Color(spec.ground || '#404040'),
        spec.intensity ?? 1
      );
    case 'directional': {
      const light = new THREE.DirectionalLight(color, spec.intensity ?? 1);
      const [x, y, z] = spec.position || [10, 20, 10];
      light.position.set(x, y, z);
      return light;
    }
    case 'point': {
      const light = new THREE.PointLight(
        color,
        spec.intensity ?? 1,
        spec.distance ?? 0,
        spec.decay ?? 2
      );
      const [x, y, z] = spec.position || [0, 10, 0];
      light.position.set(x, y, z);
      return light;
    }
    default:
      return null;
  }
}

function applySpecTransform(obj, spec) {
  const [x = 0, y = 0, z = 0] = spec.position || [];
  const [rx = 0, ry = 0, rz = 0] = spec.rotation || [];
  const scale = spec.scale ?? 1;

  obj.position.set(x, y, z);
  obj.rotation.set(rx, ry, rz);
  obj.scale.setScalar(scale);

  obj.userData.anchor = { x, y, z };
  obj.userData.baseQuaternion = obj.quaternion.clone();
  return obj;
}

function disposeObject(root) {
  root.traverse?.((obj) => {
    obj.geometry?.dispose?.();
    const materials = Array.isArray(obj.material)
      ? obj.material
      : obj.material
        ? [obj.material]
        : [];
    for (const m of materials) {
      for (const key of Object.keys(m)) {
        const value = m[key];
        if (value && value.isTexture) value.dispose();
      }
      m.dispose?.();
    }
  });
}
