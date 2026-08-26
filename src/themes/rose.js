/**
 * themes/rose.js — 4) 장미
 * ---------------------------------------------------------------------------
 * QR 블록을 유리돔 안의 원형 정원 타일로 배치하고, 중심에 로우폴리 장미
 * 한 송이를 세운다. 작은 물뿌리개와 반투명 유리돔 실루엣이 함께 놓인다.
 *
 * 팔레트: 로즈핑크 + 미드나잇그린
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
  id: 'rose',
  label: '장미',
  caption: '유리돔 속 정원',
  swatch: ['#F2B3C5', '#3E7A5A', '#D92F3D'],
};

const PALETTE = {
  /* 3D 씬 */
  dark: '#F2B3C5', // 정원 블록은 기존의 부드러운 꽃잎 핑크
  darkEmissive: '#4A1F2C',
  light: '#4E8F6C', // 잎사귀빛 타일
  ground: '#3E7A5A', // 밝힌 미드나잇그린 정원 바닥
  groundEmissive: '#0C1D14',
  sky: '#2F5F46',
  accent: '#FFF0F4',

  /* 탑다운 스캔 뷰 (대비 9.5:1) */
  scanDark: '#6E2540',
  scanLight: '#FDF1F4',
  scanGround: '#5E9E7A',
  scanShadow: '#2E5B44',
};

export function getPalette() {
  return { ...PALETTE };
}

export function getCurvature() {
  return 0; // 정원 바닥은 평평하고, 대신 유리돔이 감싼다
}

export function getBlockGeometry(isDark) {
  if (isDark) {
    return {
      // 정사각 밑면 — 탑다운에서 모듈이 정확히 맞물리도록
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: flatMaterial(PALETTE.dark, { emissive: PALETTE.darkEmissive }),
      height: 1.5,
    };
  }
  return {
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: flatMaterial(PALETTE.light, { emissive: '#0C2317' }),
    height: 0.42,
  };
}

/** 1인칭 탐험 중 보조 조명 세기 — 유리돔 안이라 은은하게 */
export function getPlayerLight() {
  return 0.45;
}

/**
 * 탑다운 스캔 뷰의 모듈 색 후보.
 * 장미의 자줏빛과 정원 잎사귀의 초록.
 *
 * 엔진이 이 색들의 명도만 스캔 안전 대역으로 끌어당기고 색상은 그대로 둔다.
 * 덕분에 QR 이 단색 검정이 아니라 3D 씬과 같은 색 계열의 모자이크가 된다.
 */
export function getScanColors() {
  return {
    dark: ['#F2B3C5', '#F2B3C5', '#E8A2B8', '#F7C2D2', '#DC91AA', '#F2B3C5'],
    light: ['#4E8F6C', '#4E8F6C', '#5A9B76', '#447F60'],
  };
}

export function getBackgroundSetup() {
  return {
    background: PALETTE.sky,
    fog: { color: '#2F5F46', near: 70, far: 175 },
    lights: [
      { type: 'hemisphere', sky: '#FFE0EA', ground: '#2E5B44', intensity: 1.8 },
      {
        type: 'directional',
        color: '#FFF4F8',
        intensity: 2.3,
        position: [-22, 44, 26],
      },
      { type: 'ambient', color: '#CFE0D8', intensity: 0.95 },
      {
        type: 'point',
        color: '#FFCBDA',
        intensity: 200,
        distance: 90,
        position: [0, 12, 0],
      },
    ],
    objects: [],
  };
}

export function placeDecorations(matrixSize) {
  const rand = makeRandom(matrixSize * 97 + 13);
  const specs = [
    // 원형 정원 바닥 — 타일 아래에 깔리는 낮은 원판
    { type: 'gardenFloor', position: [0, -0.05, 0], scale: matrixSize / 2 + 6 },
    // 중심의 장미 한 송이
    { type: 'rose', position: [0, 0, 0], rotation: [0, 0.4, 0], scale: 3.1 },
    // 유리돔
    { type: 'glassDome', position: [0, 0, 0], scale: matrixSize / 2 + 7 },
  ];

  const [wx, wz] = ringPoint(matrixSize, 42, 4.2);
  specs.push({
    type: 'wateringCan',
    position: [wx, 0, wz],
    rotation: [0, -0.9, 0],
    scale: 1.9,
  });

  // 정원 가장자리를 도는 작은 새싹과 떨어진 꽃잎 —
  // QR 판 바깥 정사각 링 위에 두어 탑다운 뷰에서도 그대로 남는다.
  for (let i = 0; i < 28; i += 1) {
    const angle = (360 / 28) * i + rand() * 9;
    const [sx, sz] = squareRingPoint(matrixSize, angle, 1.3 + rand() * 4.6);
    specs.push({
      type: rand() > 0.4 ? 'sprout' : 'petal',
      position: [sx, 0, sz],
      rotation: [0, rand() * Math.PI * 2, 0],
      scale: 1.6 + rand() * 1.1,
      persistent: true,
    });
  }

  return specs;
}

export function placeLandmarks(matrixSize, matrix) {
  const entries = [
    {
      title: '장미 발치',
      message: '가시 네 개로 세상을 다 막을 수 있다고 믿었지요.',
      color: '#F2B3C5',
    },
    {
      title: '물뿌리개가 놓인 곳',
      message: '아침마다 여기서 물을 주었습니다.',
      color: '#C2D6DF',
    },
    {
      title: '유리돔 이음새',
      message: '바람이 아주 조금 새어 들어옵니다.',
      color: '#E8F6EE',
    },
    {
      title: '떨어진 꽃잎 더미',
      message: '밟으면 소리가 납니다.',
      color: '#F5C2D0',
    },
    {
      title: '가장 높은 타일',
      message: '여기서 보면 정원이 동그랗다는 걸 알 수 있습니다.',
      color: '#FFF0F4',
    },
    {
      title: '새싹이 돋은 자리',
      message: '다음 장미가 준비되고 있습니다.',
      color: '#6FBF87',
    },
  ];

  return pickWalkableCells(matrixSize, matrix, entries.length, 67).map(
    (point, i) => ({ ...entries[i], ...point })
  );
}

export function buildDecoration(spec) {
  switch (spec.type) {
    case 'rose':
      return buildRose();
    case 'wateringCan':
      return buildWateringCan();
    case 'glassDome':
      return buildGlassDome();
    case 'gardenFloor':
      return buildGardenFloor();
    case 'sprout':
      return buildSprout();
    case 'petal':
      return buildPetal();
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* 오브젝트                                                            */
/* ------------------------------------------------------------------ */

/** 로우폴리 장미 한 송이 */
function buildRose() {
  const stemMat = flatMaterial('#3F8A5A', { emissive: '#0C1D12' });
  const leafMat = flatMaterial('#5AA875');
  const petalOuter = flatMaterial('#E53945', { emissive: '#4A0D16' });
  const petalInner = flatMaterial('#B9152B', { emissive: '#35070F' });

  const stem = cylinder(0.055, 0.08, 2.6, 6, stemMat, [0, 1.3, 0]);

  const leaves = group();
  for (const [ly, angle, tilt] of [
    [0.85, 0.4, 0.9],
    [1.45, 2.6, -0.85],
  ]) {
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.4, 6), leafMat);
    leaf.material.side = THREE.DoubleSide;
    leaf.scale.set(1, 0.5, 1);
    leaf.position.set(Math.sin(angle) * 0.3, ly, Math.cos(angle) * 0.3);
    leaf.rotation.set(-Math.PI / 2 + tilt * 0.5, angle, 0);
    leaves.add(leaf);
  }

  // 꽃받침 + 겹쳐진 꽃잎 (원뿔을 눕혀 겹치는 로우폴리 방식)
  const calyx = cone(0.26, 0.34, 6, stemMat, [0, 2.62, 0]);
  const bloom = group();
  const rings = [
    {
      r: 0.34,
      y: 2.84,
      count: 7,
      tilt: 1.15,
      size: 0.3,
      len: 0.62,
      mat: petalOuter,
    },
    {
      r: 0.22,
      y: 3.0,
      count: 5,
      tilt: 0.72,
      size: 0.24,
      len: 0.5,
      mat: petalOuter,
    },
    {
      r: 0.12,
      y: 3.12,
      count: 4,
      tilt: 0.34,
      size: 0.18,
      len: 0.38,
      mat: petalInner,
    },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i += 1) {
      const a = ((Math.PI * 2) / ring.count) * i + ring.r * 3;
      const petal = cone(ring.size, ring.len, 5, ring.mat, [
        Math.sin(a) * ring.r,
        ring.y,
        Math.cos(a) * ring.r,
      ]);
      petal.rotation.set(Math.sin(a) * ring.tilt, -a, -Math.cos(a) * ring.tilt);
      petal.scale.set(1, 1, 0.55);
      bloom.add(petal);
    }
  }
  const core = cone(0.13, 0.26, 5, petalInner, [0, 3.2, 0]);

  return group(stem, leaves, calyx, bloom, core);
}

/** 작은 물뿌리개 */
function buildWateringCan() {
  const metalMat = flatMaterial('#C2D6DF', { emissive: '#1A2529' });
  const trimMat = flatMaterial('#F2B3C5');

  const body = cylinder(0.42, 0.5, 0.75, 10, metalMat, [0, 0.4, 0]);
  const rim = cylinder(0.46, 0.46, 0.08, 10, trimMat, [0, 0.8, 0]);

  const spout = cylinder(0.09, 0.14, 0.95, 7, metalMat, [0.5, 0.62, 0]);
  spout.rotation.z = -0.85;
  const nozzle = cylinder(0.19, 0.11, 0.16, 8, trimMat, [0.86, 0.95, 0]);
  nozzle.rotation.z = -0.85;

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.05, 5, 12, Math.PI),
    metalMat
  );
  handle.position.set(-0.3, 0.78, 0);
  handle.rotation.set(0, Math.PI / 2, -0.3);

  return group(body, rim, spout, nozzle, handle);
}

/** 반투명 유리돔 실루엣 */
function buildGlassDome() {
  const glassMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color('#E8F6EE'),
    emissive: new THREE.Color('#1A3327'),
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
    flatShading: false,
  });

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2),
    glassMat
  );
  dome.scale.set(1, 0.78, 1);

  const rimMat = flatMaterial('#D6A9B8', { emissive: '#2A1119' });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 6, 40), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;

  return group(dome, rim);
}

/** 원형 정원 바닥 */
function buildGardenFloor() {
  const mat = flatMaterial('#356B4E', { emissive: '#0A1610' });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat);
  disc.rotation.x = -Math.PI / 2;

  const edgeMat = flatMaterial('#7FC49B');
  const edge = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.02, 48), edgeMat);
  edge.material.side = THREE.DoubleSide;
  edge.rotation.x = -Math.PI / 2;
  edge.position.y = 0.01;

  return group(disc, edge);
}

/** 탑다운에서도 남는, 바닥에 떨어진 꽃잎 */
function buildPetal() {
  const mat = flatMaterial('#F5C2D0', { transparent: true, opacity: 0.9 });
  const petal = new THREE.Mesh(new THREE.CircleGeometry(0.3, 6), mat);
  petal.material.side = THREE.DoubleSide;
  petal.rotation.x = -Math.PI / 2;
  petal.scale.set(1, 0.62, 1);
  petal.position.y = 0.05;
  return group(petal);
}

function buildSprout() {
  const mat = flatMaterial('#6FBF87');
  const g = group();
  for (const [bx, bz, tilt, h] of [
    [0, 0, 0, 0.5],
    [0.15, 0.07, 0.42, 0.38],
    [-0.14, -0.06, -0.38, 0.34],
    [0.04, -0.16, 0.18, 0.28],
  ]) {
    const leaf = cone(0.1, h, 4, mat, [bx, h / 2, bz]);
    leaf.rotation.z = tilt;
    leaf.scale.set(1, 1, 0.6);
    g.add(leaf);
  }
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
  buildDecoration,
};
