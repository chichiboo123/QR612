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
import { Explorer } from './explorer.js';
import {
  buildScanPalette,
  pickCellColor,
  DARK_GRAY,
  LIGHT_GRAY,
} from './scanColors.js';

const UP = new THREE.Vector3(0, 1, 0);
const BLACK = new THREE.Color(0x000000);

/** 블록 사이 z-fighting 방지를 위한 최소 단차 */
const GROUND_OFFSET = 0.02;

/** 평탄화된 3D 블록 바로 위에서 자연스럽게 이어지는 스캔 카드 높이. */
const SCAN_CARD_Y = 0.38;

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
      // 스캔 뷰 PNG 저장을 위해 드로잉 버퍼를 보존한다
      preserveDrawingBuffer: true,
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
    this.decorGroup = new THREE.Group(); // 전환 중 사라지는 큰 장식
    this.sceneryGroup = new THREE.Group(); // 스캔 뷰에서도 남는 낮은 풍경 요소
    this.celestialGroup = new THREE.Group();
    this.lightGroup = new THREE.Group();
    this.scanLightGroup = new THREE.Group();
    this.scene.add(
      this.blockGroup,
      this.decorGroup,
      this.sceneryGroup,
      this.celestialGroup,
      this.lightGroup,
      this.scanLightGroup
    );
    this._buildScanLights();
    this._buildPlayerLight();

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    this.transition = new TransitionController({
      // 모션 민감 설정을 켠 사용자에게는 전환을 거의 즉시 끝낸다
      duration: reducedMotion ? 0.08 : undefined,
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

    this.explorer = new Explorer(this, {
      onEvent: (event) => this.options.onExplorerEvent?.(event),
    });

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
    this.colorVariation = this.theme.getColorVariation
      ? this.theme.getColorVariation()
      : 0.12;
    this.sphereRadius = size * 1.25;

    this.scanDark = new THREE.Color(palette.scanDark || '#101010');
    this.scanLight = new THREE.Color(palette.scanLight || '#FAFAFA');
    this.scanGround = new THREE.Color(
      palette.scanGround || palette.ground || palette.light || '#DDDDDD'
    );

    // 테마가 준 색 목록을 스캔 안전 대역으로 보정해 둔다.
    // 색상은 그대로 두고 명도만 끌어당기므로 3D 씬의 색감이 살아남는다.
    const scanColors = this.theme.getScanColors?.() || {};
    this.scanDarkPalette = buildScanPalette(
      scanColors.dark || [palette.scanDark],
      DARK_GRAY
    );
    this.scanLightPalette = buildScanPalette(
      scanColors.light || [palette.scanLight],
      LIGHT_GRAY
    );

    this._buildBackground();
    this._buildBlocks(matrix, size);
    this._buildGround(size);
    this._buildHeightmap(size);
    this._buildDecorations(size);
    this._buildLandmarks(size);
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

    // 테마가 요청하면 셀마다 높이를 조금씩 흔든다.
    // 사막의 사구, 도시의 높고 낮은 건물처럼 "같은 높이 블록의 평평한 판" 이
    // 아니라 기복 있는 지형으로 읽히게 하는 장치. (탑다운 스캔 뷰에서는
    // 높이가 스캔값으로 수렴하고 스캔 카드가 덮으므로 인식에는 영향이 없다.)
    const jitter = this.theme.getHeightJitter ? this.theme.getHeightJitter() : 0;

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const cell = {
          x: col - (size - 1) / 2,
          z: row - (size - 1) / 2,
          col,
          row,
          // 길(light)까지 심하게 흔들면 발밑이 계단투성이가 되어 걸어 다닐 수
          // 없으므로, 지터는 덩어리(dark)에만 세게 준다.
          scale:
            jitter > 0
              ? 1 +
                (cellNoise(col, row) - 0.5) *
                  2 *
                  jitter *
                  (matrix[row][col] ? 1 : 0.2)
              : 1,
          tint: cellNoise(col * 7 + 3, row * 11 + 5),
        };
        (matrix[row][col] ? darkCells : lightCells).push(cell);
      }
    }

    for (const cell of darkCells) {
      cell.scanColor = pickCellColor(this.scanDarkPalette, cell.col, cell.row, 3);
    }
    for (const cell of lightCells) {
      cell.scanColor = pickCellColor(this.scanLightPalette, cell.col, cell.row, 11);
    }

    this.darkCells = darkCells;
    this.lightCells = lightCells;
    this.matrix = matrix;

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

    // 재질 색은 흰색으로 두고 실제 albedo 는 인스턴스 색으로 넘긴다.
    // 그래야 셀마다 다른 색(3D 테마색 → 스캔색)을 자유롭게 보간할 수 있다.
    const baseColor = material.color.clone();
    material.color.setRGB(1, 1, 1);

    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(count, 1));
    mesh.count = count;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // 인스턴스마다 밝기를 조금씩 달리한다.
    // 같은 색 블록이 맞붙어 있으면 1인칭에서 벽이 통짜 단색 화면으로 보여
    // 어디가 어디인지 알 수 없다. 이 변주가 블록 경계를 드러낸다.
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(Math.max(count, 1) * 3),
      3
    );
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

    this._trackDisposable(mesh);

    return {
      mesh,
      material,
      baseColor,
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
    // 화면 밖까지 아주 넉넉히 깔고, 안개가 배경색으로 녹여주도록 한다.
    // (평면 테마에서 바닥판의 직선 모서리가 지평선처럼 보이는 것을 막는다)
    const span = (size + quiet * 2 + 8) * 6;
    const segments = 128;

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
      basePositions: Float32Array.from(geometry.attributes.position.array),
    };
    this._groundBend = -1;
  }

  /* --------------------------------------------------------------- */
  /* 스캔 카드 (탑다운 뷰의 실제 QR)                                    */
  /* --------------------------------------------------------------- */

  /**
   * 엔진 소유의 스캔 조명 리그.
   *
   * 탑다운 뷰에서 조명을 완전히 꺼버리면 QR 이 "그냥 검은 QR" 로 보인다.
   * 대신 위에서 내려오는 부드러운 톱라이트를 유지해, 타일 윗면은 고유색 그대로
   * 밝게 나오고 옆면만 살짝 어두워지도록 한다. 스캔 대비는 그대로 지키면서
   * "위에서 내려다본 낮은 복셀 풍경" 처럼 읽히게 하는 장치.
   */
  _buildScanLights() {
    this.scanAmbient = new THREE.AmbientLight(0xffffff, 0);
    this.scanKey = new THREE.DirectionalLight(0xffffff, 0);
    this.scanKey.position.set(38, 120, 26);
    this.scanLightGroup.add(this.scanAmbient, this.scanKey);
  }

  /**
   * 1인칭 탐험 중에만 켜지는 보조 조명.
   *
   * 처음엔 플레이어를 따라다니는 포인트라이트로 만들었지만, 벽에 바짝 붙으면
   * 거리 감쇠 때문에 화면이 하얗게 타버린다. 위치 개념이 없는 앰비언트 필로
   * 바꿔 어떤 자세에서도 밝기가 폭주하지 않게 했다.
   */
  _buildPlayerLight() {
    this.playerLight = new THREE.AmbientLight(0xffe6bd, 0);
    this.playerLight.visible = false;
    this.scene.add(this.playerLight);
  }

  /** @param {boolean} on */
  setPlayerLight(on) {
    if (!this.playerLight) return;
    const strength = this.theme?.getPlayerLight?.() ?? 0.4;
    this.playerLight.visible = on && strength > 0;
    this.playerLight.intensity = on ? strength : 0;
  }

  /** 앰비언트라 위치는 쓰지 않는다 (컨트롤러 쪽 호출부를 위해 남겨 둔다) */
  movePlayerLight() {}

  /**
   * progress 가 커질수록 페이드인되는 "스캔 카드".
   *
   * 구성 (아래 → 위)
   *   1. 그림자 판 — 카드가 풍경 위에 얹힌 것처럼 보이게 하는 살짝 큰 어두운 판
   *   2. 바탕 판   — QR + quiet zone(여유 1.5모듈 추가)을 덮는 테마 밝은색 판
   *   3. 모듈 타일 — 정확히 1×1 크기의 얕은 박스, 테마 어두운색
   *
   * 순수 흑백이 아니라 테마 팔레트를 쓰고, 평면이 아니라 얕은 박스를 조명 아래
   * 두기 때문에 탑다운 뷰에서도 테마의 정체성이 남는다. 그러면서 모듈 실루엣은
   * 정확히 1×1 이므로 테마가 어떤 블록 지오메트리를 쓰든 스캔은 보장된다.
   */
  _buildScanOverlay(size) {
    const quiet = this.qr.quietZone ?? 4;
    const cardHalf = size / 2 + quiet + 1.5;
    const y = SCAN_CARD_Y;

    const makeMaterial = (color) =>
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0,
        fog: false,
        side: THREE.FrontSide,
      });

    // 1. 그림자 판
    const shadowMat = makeMaterial(this.palette.scanShadow || '#000000');
    const shadow = new THREE.Mesh(
      new THREE.BoxGeometry(cardHalf * 2 + 1.6, 0.12, cardHalf * 2 + 1.6),
      shadowMat
    );
    shadow.position.set(0.8, y - 0.16, 0.8);
    shadow.frustumCulled = false;
    shadow.visible = false;

    // 2. 바탕 판 — light 팔레트 중 가장 밝은 색으로 (모듈 사이 바탕)
    const plateColor = new THREE.Color().setRGB(
      ...brightest(this.scanLightPalette)
    );
    const baseMat = makeMaterial(plateColor);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(cardHalf * 2, 0.3, cardHalf * 2),
      baseMat
    );
    base.position.y = y;
    base.frustumCulled = false;
    base.visible = false;

    // 3. 모듈 타일 — dark와 light 모두 3D 블록에서 이어진 셀별 색으로 칠한다.
    // 이전에는 dark만 타일이고 light는 단색 판이라 3D 장면과 결과의 괴리가 컸다.
    // 두 팔레트 모두 동일 밝기로 정규화되므로 light 타일을 추가해도 판독성은 유지된다.
    const scanCells = [...this.darkCells, ...this.lightCells];
    const moduleMat = makeMaterial('#ffffff');
    const modules = new THREE.InstancedMesh(
      // 1.004 — 부동소수 오차로 모듈 사이에 실틈이 생기지 않도록 아주 살짝 겹친다
      new THREE.BoxGeometry(1.004, 0.34, 1.004),
      moduleMat,
      Math.max(scanCells.length, 1)
    );
    modules.count = scanCells.length;
    modules.frustumCulled = false;
    modules.visible = false;
    modules.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(Math.max(scanCells.length, 1) * 3),
      3
    );

    const dummy = this._dummy;
    for (let i = 0; i < scanCells.length; i += 1) {
      const cell = scanCells[i];
      dummy.position.set(cell.x, y + 0.22, cell.z);
      dummy.quaternion.identity();
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      modules.setMatrixAt(i, dummy.matrix);
      modules.instanceColor.setXYZ(i, ...cell.scanColor);
    }
    modules.instanceMatrix.needsUpdate = true;
    modules.instanceColor.needsUpdate = true;

    this.scene.add(shadow, base, modules);
    this._trackDisposable(shadow);
    this._trackDisposable(base);
    this._trackDisposable(modules);

    this.scanOverlay = {
      meshes: [shadow, base, modules],
      materials: [shadowMat, baseMat, moduleMat],
      opacities: [0.24, 1, 1],
      cardHalf,
    };
  }

  /* --------------------------------------------------------------- */
  /* 장식 오브젝트                                                     */
  /* --------------------------------------------------------------- */

  /**
   * 장식 배치.
   *
   * spec.persistent 가 true 인 오브젝트는 탑다운 뷰에서도 사라지지 않는다.
   * QR 판 바깥의 낮은 풍경 요소(풀포기·조약돌·발자국 등)를 남겨두면
   * 스캔 뷰가 "검은 QR" 이 아니라 "위에서 내려다본 풍경" 으로 읽힌다.
   * 대신 QR 판을 침범할 수 있는 큰 오브젝트는 반드시 사라져야 한다.
   */
  _buildDecorations(size) {
    const specs = this.theme.placeDecorations(size, this.matrix) || [];
    for (const spec of specs) {
      const obj = this.theme.buildDecoration?.(spec);
      if (!obj) continue;

      // snapToGround 스펙은 블록 위에 얹는다 (예: 둔덕 위의 나무)
      let placed = spec;
      if (spec.snapToGround) {
        const [sx = 0, , sz = 0] = spec.position || [];
        placed = {
          ...spec,
          position: [sx, this.getHeightAt(sx, sz) + (spec.lift ?? 0), sz],
        };
      }

      applySpecTransform(obj, placed);
      this._applyDomeToObject(obj, 1);
      (spec.persistent ? this.sceneryGroup : this.decorGroup).add(obj);
      this._trackDisposable(obj);
    }
    this._decorBend = 1;
  }

  /* --------------------------------------------------------------- */
  /* 하이트맵 (1인칭 탐험 모드의 지형)                                  */
  /* --------------------------------------------------------------- */

  /**
   * 3D 뷰 기준의 셀별 높이표를 만든다.
   * QR 매트릭스가 그대로 지형이 되므로 별도의 충돌 메시가 필요 없다.
   */
  _buildHeightmap(size) {
    const darkH = this.darkMesh?.height3d ?? 2.2;
    const lightH = this.lightMesh?.height3d ?? 0.5;

    const heights = new Float32Array(size * size);
    for (const cell of this.darkCells) {
      heights[cell.row * size + cell.col] = darkH * cell.scale;
    }
    for (const cell of this.lightCells) {
      heights[cell.row * size + cell.col] = lightH * cell.scale;
    }

    this.heightmap = { size, heights };
  }

  /**
   * 월드 좌표의 지면 높이. 그리드 밖은 0(바닥판).
   * @param {number} x
   * @param {number} z
   * @returns {number}
   */
  getHeightAt(x, z) {
    const map = this.heightmap;
    if (!map) return 0;

    const col = Math.floor(x + map.size / 2);
    const row = Math.floor(z + map.size / 2);
    if (col < 0 || row < 0 || col >= map.size || row >= map.size) return 0;
    return map.heights[row * map.size + col];
  }

  /* --------------------------------------------------------------- */
  /* 랜드마크 (탐험 중 발견하는 지점)                                   */
  /* --------------------------------------------------------------- */

  _buildLandmarks(size) {
    this.landmarks = [];
    const specs = this.theme.placeLandmarks?.(size, this.matrix) || [];

    for (const spec of specs) {
      const y = this.getHeightAt(spec.x, spec.z);
      const beacon =
        this.theme.buildLandmark?.(spec) ||
        buildBeacon(spec.color || this.palette.accent || '#FFD972');
      beacon.position.set(spec.x, y, spec.z);
      beacon.userData.anchor = { x: spec.x, y, z: spec.z };
      beacon.userData.baseQuaternion = beacon.quaternion.clone();
      this.decorGroup.add(beacon);
      this._trackDisposable(beacon);

      this.landmarks.push({
        ...spec,
        y,
        beacon,
        found: false,
      });
    }
  }

  /* --------------------------------------------------------------- */
  /* 전환 상태 적용                                                    */
  /* --------------------------------------------------------------- */

  _state() {
    const size = this.qr?.size ?? 25;
    // 1인칭 탐험 중에는 progress 0 의 3D 씬을, 다만 지형이 휘지 않도록
    // 곡률 0 으로 고정해 사용한다. (구면 위를 걷게 하면 발밑이 어긋난다)
    const exploring = this.explorer?.active;
    return computeTransitionState(exploring ? 0 : this.transition.progress, {
      matrixSize: size,
      quietZone: this.qr?.quietZone ?? 4,
      aspect: this.camera.aspect,
      curvature: exploring ? 0 : (this.curvature ?? 0),
      darkHeight3d: this.darkMesh?.height3d,
      lightHeight3d: this.lightMesh?.height3d,
      blockSpread: this.theme?.getBlockSpread?.(),
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
    const { meshes, materials, opacities } = this.scanOverlay;
    const o = state.scanOverlay;
    // 평탄화된 블록 바로 위에 같은 셀 색으로 겹쳐 페이드하므로 하나의 QR처럼 보인다.
    const visible = o > 0.001;

    for (let i = 0; i < meshes.length; i += 1) {
      meshes[i].visible = visible;
      materials[i].opacity = visible ? opacities[i] : 0;
    }

    const replaced = o >= 0.999;
    if (this.darkMesh?.mesh) this.darkMesh.mesh.visible = !replaced;
    if (this.lightMesh?.mesh) this.lightMesh.mesh.visible = !replaced;
  }

  _applyCamera(state) {
    // 1인칭 탐험 중에는 카메라를 탐험 컨트롤러가 온전히 소유한다
    if (this.explorer?.active) return;

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
    this._writeInstances(this.lightMesh, this.lightCells, state.lightHeight, state);
  }

  _writeInstances(entry, cells, height, state) {
    const dummy = this._dummy;
    const R = this.sphereRadius;
    const bend = state.bend;
    const sxz = state.blockScaleXZ;

    // 3D 에서는 테마색 × 셀별 밝기 변주,
    // 스캔 뷰에서는 셀별 스캔색으로 부드럽게 갈아탄다.
    const variation = this.colorVariation * (1 - state.flat);
    const colors = entry.mesh.instanceColor;
    const base = entry.baseColor;
    const flat = state.flat;

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
      dummy.scale.set(sxz, height * (cells[i].scale ?? 1), sxz);
      dummy.updateMatrix();
      entry.mesh.setMatrixAt(i, dummy.matrix);

      if (colors) {
        const tint = 1 + (cells[i].tint - 0.5) * 2 * variation;
        const scan = cells[i].scanColor;
        colors.setXYZ(
          i,
          base.r * tint + (scan[0] - base.r * tint) * flat,
          base.g * tint + (scan[1] - base.g * tint) * flat,
          base.b * tint + (scan[2] - base.b * tint) * flat
        );
      }
    }

    entry.mesh.instanceMatrix.needsUpdate = true;
    if (colors) colors.needsUpdate = true;
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
        const themeShape = this.theme?.getGroundDisplacement?.(
          x,
          z,
          this.qr?.size ?? 25
        ) ?? 0;
        const shapeWeight = this.curvature
          ? state.bend / this.curvature
          : 1 - state.flat;
        const y =
          -((x * x + z * z) / (2 * R)) * state.bend +
          themeShape * shapeWeight;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      this._groundBend = state.bend;
    }

    if (Math.abs(state.bend - this._decorBend) > 0.001) {
      for (const group of [this.decorGroup, this.sceneryGroup]) {
        for (const obj of group.children) {
          this._applyDomeToObject(obj, state.bend);
        }
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

    // 블록 albedo 는 instanceColor 가 셀 단위로 다루므로 여기서는 발광만 끈다.
    // (스캔 뷰에서 발광이 남으면 셀별 색이 씻겨 대비가 흐려진다)
    for (const entry of [this.darkMesh, this.lightMesh]) {
      if (!entry?.material.emissive) continue;
      entry.material.emissive.copy(entry.baseEmissive).lerp(BLACK, flat);
    }

    // 바닥은 흰색이 아니라 "밝은 풍경색" 으로 수렴한다.
    // QR 판(스캔 카드)이 그 위에 얹힌 구도가 되어, 탑다운 뷰가
    // 종이 위의 검은 QR 이 아니라 위에서 본 풍경으로 읽힌다.
    if (this.ground) {
      this.ground.material.color
        .copy(this.ground.baseColor)
        .lerp(this.scanGround, flat);
      this.ground.material.emissive
        .copy(this.ground.baseEmissive)
        .lerp(BLACK, flat);
    }

    if (this.scene.background) {
      this._tmpColor.copy(this.baseBackground).lerp(this.scanGround, flat);
      this.scene.background.copy(this._tmpColor);
    }

    if (this.scene.fog && this.baseFog) {
      const release = 1 + state.fogRelease * 60;
      this.scene.fog.near = this.baseFog.near * release;
      this.scene.fog.far = this.baseFog.far * release;
    }

    // 테마 조명은 스캔 뷰에서 완전히 끈다.
    // (장미 테마의 중앙 포인트라이트처럼 국소적으로 밝은 얼룩을 만들면
    //  QR 대비가 그 부분만 무너져 스캔이 불안정해진다. 색은 albedo 로 유지된다.)
    for (const { light, baseIntensity } of this.lights || []) {
      light.intensity = baseIntensity * (1 - flat);
    }

    // 엔진 소유의 스캔 조명 리그를 서서히 올린다.
    if (this.scanAmbient) {
      const lit = state.scanLighting;
      this.scanAmbient.intensity = 1.55 * lit;
      this.scanKey.intensity = 1.35 * lit;
    }
  }

  _applyDecorFade(state) {
    // 큰 장식·하늘 오브젝트는 사라지고, 낮은 풍경 요소는 끝까지 남는다.
    this._fadeGroup(this.decorGroup, state.decorOpacity);
    this._fadeGroup(this.celestialGroup, state.decorOpacity);
    this._fadeGroup(this.sceneryGroup, 1);
  }

  _fadeGroup(group, opacity) {
    group.visible = opacity > 0.01;
    if (!group.visible) return;

    group.traverse((obj) => {
      if (!obj.material) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of materials) {
        if (m.userData.baseOpacity === undefined) {
          m.userData.baseOpacity = m.opacity ?? 1;
        }
        const next = m.userData.baseOpacity * opacity;
        m.opacity = next;
        m.transparent = next < 0.999;
        m.depthWrite = next > 0.9;
      }
    });
  }

  /* --------------------------------------------------------------- */
  /* 뷰 전환 API                                                       */
  /* --------------------------------------------------------------- */

  toggleView() {
    return this.transition.toggle();
  }

  /** 1인칭 탐험 시작. 성공하면 true */
  enterExplorer() {
    return this.explorer.enter();
  }

  exitExplorer() {
    this.explorer.exit();
  }

  get isExploring() {
    return this.explorer.active;
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

  /**
   * 현재 테마의 탑다운 스캔 뷰를 정사각형 PNG 데이터 URL 로 렌더링한다.
   * 화면 상태(progress·뷰포트)는 건드리지 않고, 렌더러 크기와 카메라만
   * 잠시 빌려 썼다가 곧바로 되돌린다.
   *
   * @param {number} [pixels] 한 변의 픽셀 수
   * @returns {string|null} data:image/png URL
   */
  captureScanImage(pixels = 1240) {
    if (!this.qr || !this.theme) return null;

    const canvas = this.renderer.domElement;
    const prevWidth = canvas.width;
    const prevHeight = canvas.height;
    const prevRatio = this.renderer.getPixelRatio();
    const prevAspect = this.camera.aspect;

    try {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(pixels, pixels, false);
      this.camera.aspect = 1;

      const state = computeTransitionState(1, {
        matrixSize: this.qr.size,
        quietZone: this.qr.quietZone ?? 4,
        aspect: 1,
        curvature: this.curvature ?? 0,
        darkHeight3d: this.darkMesh?.height3d,
        lightHeight3d: this.lightMesh?.height3d,
        blockSpread: this.theme?.getBlockSpread?.(),
      });

      // 캡처 중에는 자동 회전/드래그 오프셋을 무시해 항상 정면 탑다운으로 담는다.
      const azimuth = this.autoAzimuth;
      const elevation = this.userElevation;
      const userAzimuth = this.userAzimuth;
      this.autoAzimuth = 0;
      this.userAzimuth = 0;
      this.userElevation = 0;

      this._applyState(state);
      this.renderer.render(this.scene, this.camera);
      const dataUrl = canvas.toDataURL('image/png');

      this.autoAzimuth = azimuth;
      this.userAzimuth = userAzimuth;
      this.userElevation = elevation;

      return dataUrl;
    } catch (error) {
      console.error('[QR612] 이미지 캡처 실패', error);
      return null;
    } finally {
      this.renderer.setPixelRatio(prevRatio);
      this.renderer.setSize(prevWidth / prevRatio, prevHeight / prevRatio, false);
      this.camera.aspect = prevAspect;
      this.camera.updateProjectionMatrix();
      this.resize();
      this._needsInstanceUpdate = true;
    }
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
    this._elapsed = (this._elapsed || 0) + dt;

    const exploring = this.explorer?.active;
    const changed = exploring ? false : this.transition.update(dt);
    const state = this._state();

    if (!this._dragging && !exploring) {
      this.autoAzimuth += dt * 3.2 * state.interactivity;
    }

    if (changed || this._needsInstanceUpdate) {
      this._applyState(state);
      this._needsInstanceUpdate = false;
    } else if (!exploring) {
      this._applyCamera(state);
    }

    // 테마가 스스로 움직이는 오브젝트를 가질 수 있다 (예: 도시의 자동차)
    this.theme?.update?.(dt, {
      elapsed: this._elapsed,
      decorGroup: this.decorGroup,
      sceneryGroup: this.sceneryGroup,
      matrixSize: this.qr?.size ?? 0,
    });

    this._animateLandmarks(dt);

    if (exploring) this.explorer.update(dt);

    this._updateBillboards();
    this.renderer.render(this.scene, this.camera);
  }

  _animateLandmarks(dt) {
    if (!this.landmarks?.length) return;
    for (const landmark of this.landmarks) {
      if (landmark.found) continue;
      const gem = landmark.beacon.getObjectByName('beacon-gem');
      if (!gem) continue;
      gem.rotation.y += dt * 1.6;
      gem.position.y = 1.15 + Math.sin(this._elapsed * 2.4 + landmark.x) * 0.16;
    }
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
    const dragThreshold = window.matchMedia?.('(pointer: coarse)').matches
      ? 14
      : 8;

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
      if (this.explorer?.active) return; // 시점 조작은 탐험 컨트롤러가 맡는다
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < dragThreshold) return;

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
      if (!moved && !this.explorer?.active) this.toggleView();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', () => {
      pointerId = null;
      this._dragging = false;
    });
    el.addEventListener('keydown', (e) => {
      if (this.explorer?.active) return;
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
      this.sceneryGroup,
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
    this.landmarks = [];
    this.heightmap = null;
  }

  dispose() {
    this.stop();
    this.explorer.dispose();
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

/** 팔레트에서 가장 밝은 색 (선형 RGB) */
function brightest(palette) {
  return palette.reduce((best, c) =>
    0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] >
    0.2126 * best[0] + 0.7152 * best[1] + 0.0722 * best[2]
      ? c
      : best
  );
}

/** 탐험 중 눈에 띄어야 하는 랜드마크 표식 (빛기둥 + 회전하는 마름모) */
function buildBeacon(color) {
  const tint = new THREE.Color(color);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 3.4, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: tint,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })
  );
  pillar.position.y = 1.7;

  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.3, 0),
    new THREE.MeshBasicMaterial({ color: tint, fog: false, toneMapped: false })
  );
  gem.position.y = 1.15;
  gem.name = 'beacon-gem';

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.66, 20),
    new THREE.MeshBasicMaterial({
      color: tint,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;

  const g = new THREE.Group();
  g.add(pillar, gem, ring);
  g.userData.kind = 'beacon';
  return g;
}

/**
 * 셀 좌표로부터 0~1 의 결정론적 노이즈를 만든다.
 * 같은 QR·같은 테마면 항상 같은 지형이 나오도록.
 */
function cellNoise(col, row) {
  let h = (col * 374761393 + row * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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
