/**
 * themes/cityNight.js — 5) 도시의 밤
 * ---------------------------------------------------------------------------
 * dark 모듈은 높이가 제각각인 건물 블록, light 모듈은 낮은 도로가 된다.
 * QR 판 바깥으로는 순환도로가 있고, 자동차가 헤드라이트를 켜고 돌아다닌다.
 *
 * 팔레트: 미드나잇블루 도시 + 네온 앰버 창문
 */

import * as THREE from 'three';
import {
  flatMaterial,
  glowMaterial,
  box,
  cone,
  cylinder,
  blob,
  group,
  squareRingPoint,
  pickWalkableCells,
  makeRandom,
} from './_shared.js';

export const meta = {
  id: 'city-night',
  label: '도시의 밤',
  caption: '창문마다 켜진 불',
  swatch: ['#2B3A63', '#FFC46B', '#7FE3E0'],
};

const PALETTE = {
  /* 3D 씬 */
  dark: '#4A5C8C', // 건물 외벽
  darkEmissive: '#161F3A',
  light: '#2A3352', // 도로
  ground: '#222A44',
  groundEmissive: '#080C18',
  sky: '#1B2440',
  accent: '#FFC46B',

  /* 탑다운 스캔 뷰 (대비 11.6:1) — 도면 위의 도시 */
  scanDark: '#22304F',
  scanLight: '#F2F4FA',
  scanGround: '#5A6E9E',
  scanShadow: '#182034',
};

export function getPalette() {
  return { ...PALETTE };
}

export function getCurvature() {
  return 0;
}

/** 건물 높이를 크게 흔들어 스카이라인을 만든다 */
export function getHeightJitter() {
  return 0.6;
}

/** 건물마다 밝기를 크게 달리해 창문 불빛이 제각각인 느낌을 낸다 */
export function getColorVariation() {
  return 0.34;
}

/** 건물은 블록끼리 붙어 하나의 큰 빌딩처럼 보이는 편이 도시답다 */
export function getBlockSpread() {
  return 0.96;
}

export function getBlockGeometry(isDark) {
  if (isDark) {
    return {
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: createBuildingMaterial(),
      height: 3.4,
    };
  }
  return {
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: flatMaterial(PALETTE.light, { emissive: '#0D142A' }),
    height: 0.3,
  };
}

/** 1인칭 탐험 중 보조 조명 세기 — 밤거리라 손전등 없이는 벽 사이가 캄캄하다 */
export function getPlayerLight() {
  return 1.15;
}

/**
 * 탑다운 스캔 뷰의 모듈 색 후보.
 * 건물 외벽의 남색과 창문 불빛의 앰버(어둡게 내린 색).
 *
 * 엔진이 이 색들의 명도만 스캔 안전 대역으로 끌어당기고 색상은 그대로 둔다.
 * 덕분에 QR 이 단색 검정이 아니라 3D 씬과 같은 색 계열의 모자이크가 된다.
 */
export function getScanColors() {
  return {
    // 건물 외벽의 청회색을 주조색으로, 창문 앰버는 드문 포인트로 쓴다.
    dark: ['#4A5C8C', '#4A5C8C', '#3E507F', '#566996', '#4A5C8C', '#FFC46B'],
    light: ['#2A3352', '#2A3352', '#303A5C', '#26304E'],
  };
}

export function getBackgroundSetup() {
  const rand = makeRandom(76543);
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    const u = rand() * 0.9 + 0.05;
    const phi = rand() * Math.PI * 2;
    const ring = Math.sqrt(1 - u * u);
    const radius = 200 + rand() * 90;
    stars.push({
      type: 'cityStar',
      position: [
        Math.cos(phi) * ring * radius,
        u * radius,
        Math.sin(phi) * ring * radius,
      ],
      scale: 1.2 + rand() * 2,
    });
  }

  return {
    background: PALETTE.sky,
    fog: { color: '#1B2440', near: 70, far: 175 },
    lights: [
      { type: 'ambient', color: '#8FA2D6', intensity: 1.7 },
      {
        type: 'directional',
        color: '#C9D6FF',
        intensity: 1.3,
        position: [30, 46, 22],
      },
      { type: 'hemisphere', sky: '#5D74B8', ground: '#161D33', intensity: 1.0 },
    ],
    objects: [...stars, { type: 'cityMoon', position: [-88, 30, -118], scale: 7 }],
  };
}

export function placeDecorations(matrixSize) {
  const rand = makeRandom(matrixSize * 53 + 19);
  const specs = [];

  // 순환도로 — QR 판 바깥을 도는 정사각 트랙
  specs.push({
    type: 'ringRoad',
    position: [0, 0.02, 0],
    scale: 1,
    matrixSize,
    persistent: true,
  });

  // 자동차 — update() 에서 트랙을 따라 움직인다
  const carColors = ['#FF8A65', '#7FE3E0', '#FFD972', '#F49FC4', '#A6E38F'];
  for (let i = 0; i < 10; i += 1) {
    const direction = i % 2 === 0 ? 1 : -1;
    specs.push({
      type: 'car',
      position: [0, 0.12, 0],
      scale: 0.9 + rand() * 0.3,
      color: carColors[i % carColors.length],
      // Five evenly spaced cars per lane.  Cars in one lane deliberately use
      // one convoy speed: varying it let a rear car catch and pass through the
      // car ahead because these decorative meshes have no physics collider.
      trackOffset: i / 10,
      // 안쪽 차선은 시계 방향, 바깥 차선은 반시계 방향으로만 달린다.
      // 방향과 차선을 묶어 마주 오는 차가 같은 차선을 공유하지 않게 한다.
      direction,
      trackSpeed: direction * 0.036,
      lane: i % 2 === 0 ? -0.9 : 0.9,
      persistent: true,
    });
  }

  // 가로등
  for (let i = 0; i < 20; i += 1) {
    const angle = (360 / 20) * i;
    const [lx, lz] = squareRingPoint(matrixSize, angle, 4.6);
    specs.push({
      type: 'streetLamp',
      position: [lx, 0, lz],
      rotation: [0, 0, 0],
      scale: 1.1,
      persistent: true,
    });
  }

  return specs;
}

/**
 * Building facade material with deterministic lit windows.
 *
 * The window grid is evaluated in each box's local coordinates, so it also
 * works on the instanced, differently scaled skyline without adding thousands
 * of individual window meshes. Roofs remain plain and the warm emissive light
 * is independent of the night lighting.
 */
function createBuildingMaterial() {
  const material = flatMaterial(PALETTE.dark, {
    emissive: PALETTE.darkEmissive,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.windowColor = { value: new THREE.Color('#FFD67A') };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vBuildingPosition;\nvarying vec3 vBuildingNormal;\nvarying float vBuildingSeed;'
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vBuildingPosition = position;
         vBuildingNormal = normal;
         vBuildingSeed = 0.0;
         #ifdef USE_INSTANCING
           vBuildingSeed = dot(instanceMatrix[3].xz, vec2(17.17, 41.73));
         #endif`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 windowColor;\nvarying vec3 vBuildingPosition;\nvarying vec3 vBuildingNormal;\nvarying float vBuildingSeed;'
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float facade = step(abs(vBuildingNormal.y), 0.2);
         vec2 facadeUv = abs(vBuildingNormal.x) > 0.5
           ? vec2(vBuildingPosition.z, vBuildingPosition.y)
           : vec2(vBuildingPosition.x, vBuildingPosition.y);
         vec2 windowCell = fract((facadeUv + 0.5) * vec2(2.0, 4.0));
         float frame = step(0.24, windowCell.x) * step(windowCell.x, 0.76)
           * step(0.26, windowCell.y) * step(windowCell.y, 0.70);
         vec2 windowId = floor((facadeUv + 0.5) * vec2(2.0, 4.0));
         float randomWindow = fract(sin(dot(windowId + vBuildingSeed, vec2(12.9898, 78.233))) * 43758.5453);
         float lit = step(0.62, randomWindow);
         totalEmissiveRadiance += windowColor * facade * frame * lit * 0.72;`
      );
  };
  material.customProgramCacheKey = () => 'qr612-city-lit-windows-v2';
  return material;
}

/**
 * 탐험 중 만나는 지점들.
 * 걸어서 닿을 수 있도록 light 모듈(도로) 위에만 놓는다.
 */
export function placeLandmarks(matrixSize, matrix) {
  const entries = [
    {
      title: '전광판 앞',
      message: '건물 사이로 광고판 불빛이 깜빡입니다.',
      color: '#FFC46B',
    },
    {
      title: '골목 모퉁이',
      message: '가장 높은 건물의 그림자가 여기까지 닿습니다.',
      color: '#7FE3E0',
    },
    {
      title: '횡단보도',
      message: '차가 지나가길 기다렸다가 건너세요.',
      color: '#F49FC4',
    },
    {
      title: '옥상이 보이는 자리',
      message: '점프해서 건물 위로 올라가 볼까요?',
      color: '#A6E38F',
    },
    {
      title: '한밤의 분수대',
      message: '물소리만 남은 도심 한가운데입니다.',
      color: '#FFD972',
    },
    {
      title: '막차 정류장',
      message: '오늘의 마지막 버스가 방금 떠났습니다.',
      color: '#FF8A65',
    },
  ];

  return pickWalkableCells(matrixSize, matrix, entries.length, 17).map(
    (point, i) => ({ ...entries[i], ...point })
  );
}

export function buildDecoration(spec) {
  switch (spec.type) {
    case 'ringRoad':
      return buildRingRoad(spec.matrixSize);
    case 'car':
      return buildCar(spec);
    case 'streetLamp':
      return buildStreetLamp();
    case 'cityStar':
      return buildCityStar();
    case 'cityMoon':
      return buildCityMoon();
    default:
      return null;
  }
}

/**
 * 프레임마다 자동차를 순환도로 위로 움직인다.
 * 엔진이 매 프레임 호출한다.
 */
export function update(dt, { decorGroup, sceneryGroup, matrixSize }) {
  if (!matrixSize) return;

  for (const group of [decorGroup, sceneryGroup]) {
    for (const obj of group.children) {
      if (obj.userData.kind !== 'car') continue;

      const data = obj.userData;
      data.t = (data.t + data.speed * dt + 1) % 1;

      const { x, z, angle } = trackPoint(matrixSize, data.t, data.lane);
      obj.position.x = x;
      obj.position.z = z;
      obj.rotation.y = angle + (data.speed < 0 ? Math.PI : 0);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 순환도로 트랙                                                       */
/* ------------------------------------------------------------------ */

/** 도로 중심선의 반경(정사각 기준 절반 길이) */
function trackHalf(matrixSize) {
  return matrixSize / 2 + 4 + 1.5 + 3;
}

/**
 * t(0~1) 위치의 정사각 트랙 좌표와 진행 방향.
 * @returns {{x:number, z:number, angle:number}}
 */
function trackPoint(matrixSize, t, lane = 0) {
  const half = trackHalf(matrixSize) + lane;
  const side = Math.floor(t * 4) % 4;
  const local = t * 4 - Math.floor(t * 4);
  const along = (local - 0.5) * 2 * half;

  // 자동차 모델의 앞은 로컬 +X다. 반환 각도는 +X가 진행 벡터를 보도록 한다.
  switch (side) {
    case 0:
      return { x: along, z: -half, angle: 0 };
    case 1:
      return { x: half, z: along, angle: -Math.PI / 2 };
    case 2:
      return { x: -along, z: half, angle: Math.PI };
    default:
      return { x: -half, z: -along, angle: Math.PI / 2 };
  }
}

/* ------------------------------------------------------------------ */
/* 오브젝트                                                            */
/* ------------------------------------------------------------------ */

function buildRingRoad(matrixSize) {
  const half = trackHalf(matrixSize);
  const width = 4.2;
  const asphalt = flatMaterial('#2C3450', { emissive: '#0A0E1C' });
  const lineMat = glowMaterial('#E8EDF7', { opacity: 0.5, transparent: true });

  const g = group();

  for (const [px, pz, sx, sz] of [
    [0, -half, half * 2 + width, width],
    [0, half, half * 2 + width, width],
    [-half, 0, width, half * 2 + width],
    [half, 0, width, half * 2 + width],
  ]) {
    g.add(box(sx, 0.08, sz, asphalt, [px, 0.04, pz]));
  }

  // 두 차선을 가르는 중앙선 — 짧은 선분을 반복해 점선으로
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 26; j += 1) {
      const t = (i + (j + 0.5) / 26) / 4;
      const { x, z, angle } = trackPoint(matrixSize, t, 0);
      const dash = box(0.9, 0.02, 0.12, lineMat, [x, 0.1, z]);
      dash.rotation.y = angle;
      g.add(dash);
    }
  }

  return g;
}

function buildCar(spec) {
  const bodyMat = flatMaterial(spec.color, { emissive: '#1A0F06' });
  const glassMat = flatMaterial('#2A3352', { emissive: '#0B1020' });
  const lampMat = glowMaterial('#FFF3C4', { transparent: false });
  const tailMat = glowMaterial('#FF6B6B', { transparent: false });

  const body = box(1.7, 0.42, 0.9, bodyMat, [0, 0.3, 0]);
  const cabin = box(0.9, 0.36, 0.78, glassMat, [-0.05, 0.66, 0]);

  const wheels = group();
  for (const [wx, wz] of [
    [0.55, 0.44],
    [-0.55, 0.44],
    [0.55, -0.44],
    [-0.55, -0.44],
  ]) {
    const wheel = cylinder(0.17, 0.17, 0.12, 8, flatMaterial('#141A2C'), [
      wx,
      0.17,
      wz,
    ]);
    wheel.rotation.x = Math.PI / 2;
    wheels.add(wheel);
  }

  const lamps = group(
    blob(0.09, 0, lampMat, [0.87, 0.32, 0.28]),
    blob(0.09, 0, lampMat, [0.87, 0.32, -0.28]),
    blob(0.07, 0, tailMat, [-0.87, 0.32, 0.26]),
    blob(0.07, 0, tailMat, [-0.87, 0.32, -0.26])
  );

  const g = group(body, cabin, wheels, lamps);
  g.userData.kind = 'car';
  g.userData.t = spec.trackOffset ?? 0;
  g.userData.speed = spec.trackSpeed ?? 0.03;
  g.userData.lane = spec.lane ?? 0;
  return g;
}

function buildStreetLamp() {
  const poleMat = flatMaterial('#8494BE');
  const glowMat = glowMaterial(PALETTE.accent, { transparent: false });

  const pole = cylinder(0.06, 0.09, 2.6, 6, poleMat, [0, 1.3, 0]);
  const arm = box(0.5, 0.06, 0.06, poleMat, [0.22, 2.6, 0]);
  const head = cone(0.2, 0.24, 6, poleMat, [0.45, 2.52, 0]);
  const bulb = blob(0.13, 0, glowMat, [0.45, 2.36, 0]);
  const halo = blob(
    0.5,
    0,
    glowMaterial(PALETTE.accent, { opacity: 0.14, depthWrite: false }),
    [0.45, 2.3, 0]
  );

  return group(pole, arm, head, bulb, halo);
}

function buildCityStar() {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.45, 0),
    glowMaterial('#DCE6FF', { opacity: 0.8, depthWrite: false })
  );
  return group(mesh);
}

function buildCityMoon() {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28),
    glowMaterial('#F4F1E4', { opacity: 0.96 })
  );
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 28),
    glowMaterial('#9FB4F0', { opacity: 0.14, depthWrite: false })
  );
  halo.position.z = -0.05;
  const g = group(halo, disc);
  g.userData.billboard = true;
  return g;
}

/* ------------------------------------------------------------------ */

export default {
  ...meta,
  getBlockGeometry,
  getPalette,
  getScanColors,
  placeDecorations,
  placeLandmarks,
  getBackgroundSetup,
  getPlayerLight,
  getCurvature,
  getHeightJitter,
  getColorVariation,
  getBlockSpread,
  buildDecoration,
  update,
};
