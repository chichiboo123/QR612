/**
 * themes/desertFox.js — 3) 사막과 여우
 * ---------------------------------------------------------------------------
 * QR 블록의 높이차를 그대로 모래 언덕(사구)의 능선으로 읽히게 하고,
 * 여우 실루엣 · 작은 우물 · 절차적으로 이어지는 발자국 트레일을 배치한다.
 *
 * 팔레트: 선셋오렌지 + 샌드베이지
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
  ringPoint,
  squareRingPoint,
  pickWalkableCells,
  makeRandom,
} from './_shared.js';

export const meta = {
  id: 'desert-fox',
  label: '사막과 여우',
  caption: '사구를 넘는 발자국',
  swatch: ['#F2A583', '#F6E6C8', '#FFD9A8'],
};

const PALETTE = {
  /* 3D 씬 */
  dark: '#E8A35D', // 햇빛을 받은 황금빛 사구 능선
  darkEmissive: '#4A2010',
  light: '#F4D7A1', // 볕 드는 모래 — 샌드베이지
  ground: '#EBCB91',
  groundEmissive: '#2E2211',
  sky: '#FFD9B0',
  accent: '#FFB577',

  /* 탑다운 스캔 뷰 (대비 7.5:1) */
  scanDark: '#71361B',
  scanLight: '#FEF6E7',
  scanGround: '#EED9B2',
  scanShadow: '#B98A5C',
};

export function getPalette() {
  return { ...PALETTE };
}

export function getCurvature() {
  return 0.45; // 사막 지평선이 둥글게 휘는 정도
}

/**
 * QR 바깥 지면에 완만하게 이어지는 사구 파동을 만든다.
 * 그리드 안쪽은 탐험 충돌 높이와 맞아야 하므로 평평하게 두고 외곽만 변형한다.
 */
export function getGroundDisplacement(x, z, matrixSize) {
  const distance = Math.max(Math.abs(x), Math.abs(z));
  const edge = matrixSize / 2 + 1;
  const blend = Math.min(Math.max((distance - edge) / 10, 0), 1);
  if (blend === 0) return 0;

  const longWave = Math.sin(x * 0.095 + z * 0.035 + 0.8) * 0.8;
  const crossWave = Math.sin(z * 0.13 - x * 0.025 - 0.4) * 0.45;
  return (longWave + crossWave) * blend;
}

/** 사구는 능선마다 높이가 달라야 사막처럼 보인다 */
export function getHeightJitter() {
  return 0.5;
}

/** 사구마다 볕이 드는 정도가 달라 보이게 */
export function getColorVariation() {
  return 0.16;
}

/** 사구는 기둥이 아니라 덩어리로 보여야 하므로 블록 사이 틈을 거의 없앤다 */
export function getBlockSpread() {
  return 0.99;
}

export function getBlockGeometry(isDark) {
  if (isDark) {
    return {
      // 위로 갈수록 좁아지는 사면으로 블록이 아니라 사구 능선처럼 보이게 한다.
      geometry: createDuneBlockGeometry(0.72),
      material: flatMaterial(PALETTE.dark, { emissive: PALETTE.darkEmissive }),
      height: 3.6,
    };
  }
  return {
    geometry: createDuneBlockGeometry(0.88),
    material: flatMaterial(PALETTE.light),
    height: 0.52,
  };
}

/** 1인칭 탐험 중 보조 조명 세기 — 햇볕이 강해 거의 필요 없다 */
export function getPlayerLight() {
  return 0.25;
}

/**
 * 탑다운 스캔 뷰의 모듈 색 후보.
 * 사구의 노을빛 주황과 마른 모래빛.
 *
 * 엔진이 이 색들의 명도만 스캔 안전 대역으로 끌어당기고 색상은 그대로 둔다.
 * 덕분에 QR 이 단색 검정이 아니라 3D 씬과 같은 색 계열의 모자이크가 된다.
 */
export function getScanColors() {
  return {
    dark: ['#E8A35D', '#E8A35D', '#D78B46', '#F0B66F', '#D99652', '#C8793D'],
    light: ['#F4D7A1', '#F4D7A1', '#F7E0B7', '#EDC887'],
  };
}

export function getBackgroundSetup() {
  return {
    background: PALETTE.sky,
    fog: { color: '#FFD9B0', near: 70, far: 175 },
    lights: [
      { type: 'hemisphere', sky: '#FFEBD3', ground: '#B98A5C', intensity: 2.0 },
      {
        type: 'directional',
        color: '#FFE3C2',
        intensity: 2.5,
        position: [48, 26, -34],
      },
      { type: 'ambient', color: '#FFCFA6', intensity: 0.85 },
    ],
    objects: [{ type: 'sunset', position: [56, 8, -108], scale: 11 }],
  };
}

export function placeDecorations(matrixSize) {
  const rand = makeRandom(matrixSize * 131 + 29);
  const specs = [];

  // QR 지형 바깥에도 길고 낮은 사구를 겹쳐 사막의 수평 능선을 만든다.
  for (let i = 0; i < 14; i += 1) {
    const angle = (360 / 14) * i + rand() * 16;
    const [dx, dz] = squareRingPoint(matrixSize, angle, 7 + rand() * 12);
    specs.push({
      type: 'sandDune',
      position: [dx, -0.15, dz],
      rotation: [0, rand() * Math.PI, 0],
      scale: 1.2 + rand() * 1.1,
    });
  }

  // 여우 — 그리드 남동쪽 사구 위
  const [fx, fz] = ringPoint(matrixSize, 152, 5);
  specs.push({
    type: 'fox',
    position: [fx, 0, fz],
    rotation: [0, -2.4, 0],
    scale: 2.1,
  });

  // 우물 — 북서쪽
  const [wx, wz] = ringPoint(matrixSize, -118, 6);
  specs.push({
    type: 'well',
    position: [wx, 0, wz],
    rotation: [0, 0.6, 0],
    scale: 2.4,
  });

  // 우물 → 여우로 이어지는 발자국 트레일 (절차적).
  // QR 판 바깥 정사각 링을 따라 이어지므로 탑다운 뷰에서도 그대로 남는다.
  const steps = 34;
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const angle = -118 + (152 + 118) * t;
    const wobble = (rand() - 0.5) * 2.2;
    const [px, pz] = squareRingPoint(matrixSize, angle, 2.4 + wobble);
    specs.push({
      type: 'footprint',
      position: [px, 0.02, pz],
      rotation: [0, (angle * Math.PI) / 180 + (rand() - 0.5) * 0.4, 0],
      scale: 1.0 + rand() * 0.4,
      side: i % 2 === 0 ? 1 : -1,
      persistent: true,
    });
  }

  // 사구 사이의 마른 덤불 — 탑다운에서도 남는다
  for (let i = 0; i < 16; i += 1) {
    const angle = (360 / 16) * i + rand() * 12;
    const [bx, bz] = squareRingPoint(matrixSize, angle, 1.3 + rand() * 4.6);
    specs.push({
      type: 'bush',
      position: [bx, 0, bz],
      rotation: [0, rand() * Math.PI * 2, 0],
      scale: 1.4 + rand() * 1.0,
      persistent: true,
    });
  }

  return specs;
}

export function placeLandmarks(matrixSize, matrix) {
  const entries = [
    {
      title: '우물로 가는 길',
      message: '모래 위 발자국이 이쪽으로 이어집니다.',
      color: '#7FD6E8',
    },
    {
      title: '사구 그늘',
      message: '해가 넘어가는 쪽 능선이 그늘을 드리웁니다.',
      color: '#FFC46B',
    },
    {
      title: '여우가 앉았던 자리',
      message: '모래가 조금 눌려 있습니다. 방금까지 누가 있었나 봅니다.',
      color: '#E07A3C',
    },
    {
      title: '가장 높은 능선',
      message: '점프해서 올라가면 사막 전체가 보입니다.',
      color: '#FFE38A',
    },
    {
      title: '마른 우물터',
      message: '두레박 줄만 남아 바람에 흔들립니다.',
      color: '#C08A55',
    },
    {
      title: '별을 세던 자리',
      message: '밤이면 여기 누워 하늘을 봤겠지요.',
      color: '#F49FC4',
    },
  ];

  return pickWalkableCells(matrixSize, matrix, entries.length, 41).map(
    (point, i) => ({ ...entries[i], ...point })
  );
}

export function buildDecoration(spec) {
  switch (spec.type) {
    case 'fox':
      return buildFox();
    case 'well':
      return buildWell();
    case 'footprint':
      return buildFootprint(spec.side ?? 1);
    case 'sunset':
      return buildSunset();
    case 'bush':
      return buildBush();
    case 'sandDune':
      return buildSandDune();
    default:
      return null;
  }
}

/** 정사각 밑면을 유지하면서 윗면만 좁힌 낮은 사구 타일. */
function createDuneBlockGeometry(topScale) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    if (positions.getY(i) > 0) {
      positions.setX(i, positions.getX(i) * topScale);
      positions.setZ(i, positions.getZ(i) * topScale);
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** 지평선에 겹쳐지는 길고 낮은 반구형 모래 능선. */
function buildSandDune() {
  const geometry = new THREE.SphereGeometry(
    1,
    24,
    10,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2
  );
  const mesh = new THREE.Mesh(
    geometry,
    flatMaterial('#E6B66F', { emissive: '#3B2510' })
  );
  mesh.scale.set(4.8, 1.15, 2.2);
  return group(mesh);
}

/* ------------------------------------------------------------------ */
/* 오브젝트                                                            */
/* ------------------------------------------------------------------ */

/** 로우폴리 여우 실루엣 — 원작 삽화가 아닌 독자적인 단순 형태 */
function buildFox() {
  const furMat = flatMaterial('#E07A3C', { emissive: '#3A1607' });
  const bellyMat = flatMaterial('#FFF0DC');
  const tipMat = flatMaterial('#5A3A26');

  const body = cylinder(0.34, 0.44, 1.0, 6, furMat, [0, 0.72, 0]);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0.72, 0);

  const chest = blob(0.3, 0, bellyMat, [0, 0.6, 0.4]);

  const head = blob(0.32, 0, furMat, [0, 1.05, 0.52]);
  const snout = cone(0.16, 0.4, 5, furMat, [0, 0.98, 0.85]);
  snout.rotation.x = Math.PI / 2;

  const ears = group(
    cone(0.15, 0.4, 4, furMat, [-0.18, 1.34, 0.46]),
    cone(0.15, 0.4, 4, furMat, [0.18, 1.34, 0.46])
  );

  const legs = group();
  for (const [lx, lz] of [
    [0.2, 0.3],
    [-0.2, 0.3],
    [0.2, -0.3],
    [-0.2, -0.3],
  ]) {
    legs.add(cylinder(0.08, 0.08, 0.62, 5, furMat, [lx, 0.31, lz]));
  }

  const tail = cone(0.26, 1.1, 6, furMat, [0, 0.86, -0.72]);
  tail.rotation.x = -1.15;
  const tailTip = cone(0.16, 0.3, 6, bellyMat, [0, 1.18, -1.16]);
  tailTip.rotation.x = -1.15;

  const nose = blob(0.07, 0, tipMat, [0, 0.98, 1.04]);

  return group(body, chest, head, snout, ears, legs, tail, tailTip, nose);
}

/** 사막의 작은 우물 */
function buildWell() {
  const stoneMat = flatMaterial('#D3C2A4', { emissive: '#241E14' });
  const woodMat = flatMaterial('#A67A50');
  const waterMat = flatMaterial('#6BA8C4', { emissive: '#123040' });
  const ropeMat = flatMaterial('#EEDDB6');

  const wall = cylinder(0.8, 0.9, 0.7, 10, stoneMat, [0, 0.35, 0]);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.7, 12), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.55;

  const posts = group(
    box(0.12, 1.3, 0.12, woodMat, [-0.72, 1.05, 0]),
    box(0.12, 1.3, 0.12, woodMat, [0.72, 1.05, 0])
  );
  const beam = box(1.7, 0.12, 0.12, woodMat, [0, 1.7, 0]);
  const roofA = box(1.1, 0.08, 0.9, woodMat, [-0.28, 1.95, 0]);
  roofA.rotation.z = 0.55;
  const roofB = box(1.1, 0.08, 0.9, woodMat, [0.28, 1.95, 0]);
  roofB.rotation.z = -0.55;

  const rope = cylinder(0.03, 0.03, 0.75, 4, ropeMat, [0, 1.28, 0]);
  const bucket = cylinder(0.2, 0.17, 0.26, 8, woodMat, [0, 0.95, 0]);

  return group(wall, water, posts, beam, roofA, roofB, rope, bucket);
}

/** 발자국 — 바닥에 살짝 눌린 타원 자국 */
function buildFootprint(side) {
  const mat = flatMaterial('#D9BC90', {
    transparent: true,
    opacity: 0.8,
  });
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.32, 10), mat);
  pad.rotation.x = -Math.PI / 2;
  pad.scale.set(1, 1.35, 1);
  pad.position.x = 0.28 * side;

  const toe = new THREE.Mesh(new THREE.CircleGeometry(0.13, 8), mat);
  toe.rotation.x = -Math.PI / 2;
  toe.position.set(0.28 * side, 0, 0.34);

  return group(pad, toe);
}

/** 탑다운에서도 남는 마른 덤불 */
function buildBush() {
  const mat = flatMaterial('#C08A55');
  const g = group();
  for (const [bx, bz, tilt, h] of [
    [0, 0, 0, 0.55],
    [0.18, 0.1, 0.4, 0.42],
    [-0.16, -0.08, -0.36, 0.38],
    [0.05, -0.18, 0.15, 0.3],
  ]) {
    const twig = cone(0.08, h, 4, mat, [bx, h / 2, bz]);
    twig.rotation.z = tilt;
    g.add(twig);
  }
  return g;
}

function buildSunset() {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32),
    glowMaterial('#FFE0B0', { opacity: 0.95 })
  );
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 32),
    glowMaterial('#F0A268', { opacity: 0.22, depthWrite: false })
  );
  halo.position.z = -0.05;

  const g = group(halo, disc);
  g.userData.billboard = true;
  return g;
}

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
  getGroundDisplacement,
  getHeightJitter,
  getColorVariation,
  getBlockSpread,
  buildDecoration,
};
