/**
 * themes/forestRest.js — 6) 숲 속의 쉼
 * ---------------------------------------------------------------------------
 * dark 모듈은 이끼 덮인 숲 바닥의 둔덕, light 모듈은 그 사이의 오솔길이 된다.
 * 그리드 위로는 키 큰 나무들이 우거지고, 한가운데에는 작은 연못이 있다.
 *
 * 팔레트: 짙은 숲 초록 + 이끼빛 · 물빛
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
  id: 'forest-rest',
  label: '숲 속의 쉼',
  caption: '나무 사이 작은 연못',
  swatch: ['#5E9B63', '#2F6146', '#8FD6E8'],
};

const PALETTE = {
  /* 3D 씬 */
  dark: '#4C8757', // 이끼 둔덕
  darkEmissive: '#132318',
  light: '#CFE0B4', // 볕 드는 오솔길
  ground: '#7FAE72',
  groundEmissive: '#111E12',
  sky: '#A8D4E8',
  accent: '#8FD6E8',

  /* 탑다운 스캔 뷰 (대비 8.2:1) */
  scanDark: '#274A33',
  scanLight: '#F2F7EA',
  scanGround: '#8FBE80',
  scanShadow: '#4A7355',
};

export function getPalette() {
  return { ...PALETTE };
}

export function getCurvature() {
  return 0.2;
}

/** 숲 바닥의 기복 */
export function getHeightJitter() {
  return 0.35;
}

export function getBlockGeometry(isDark) {
  if (isDark) {
    return {
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: flatMaterial(PALETTE.dark, { emissive: PALETTE.darkEmissive }),
      height: 2.2,
    };
  }
  return {
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: flatMaterial(PALETTE.light),
    height: 0.5,
  };
}

/** 1인칭 탐험 중 보조 조명 세기 — 나무 그늘이 짙어 조금 밝혀 준다 */
export function getPlayerLight() {
  return 0.5;
}

export function getBackgroundSetup() {
  return {
    background: PALETTE.sky,
    fog: { color: '#A8D4E8', near: 70, far: 175 },
    lights: [
      { type: 'hemisphere', sky: '#E4F4FF', ground: '#4E7A52', intensity: 2.1 },
      {
        type: 'directional',
        color: '#FFF6D8',
        intensity: 2.3,
        position: [-30, 44, 24],
      },
      { type: 'ambient', color: '#C8E4D4', intensity: 0.9 },
    ],
    objects: [{ type: 'forestSun', position: [-58, 26, -112], scale: 8 }],
  };
}

export function placeDecorations(matrixSize, matrix) {
  const rand = makeRandom(matrixSize * 71 + 23);
  const specs = [];

  // 그리드 안쪽 둔덕(dark 모듈) 위에도 나무를 심는다.
  // 밖에만 심으면 1인칭으로 들어갔을 때 숲이 아니라 초록 복도가 된다.
  // 길(light 모듈)은 비워 두므로 걸어 다니는 데 방해가 되지 않는다.
  if (matrix) {
    const mounds = [];
    for (let row = 2; row < matrixSize - 2; row += 1) {
      for (let col = 2; col < matrixSize - 2; col += 1) {
        if (matrix[row][col]) {
          mounds.push([col - (matrixSize - 1) / 2, row - (matrixSize - 1) / 2]);
        }
      }
    }
    const step = Math.max(Math.floor(mounds.length / 26), 1);
    for (let i = 0; i < mounds.length; i += step) {
      const [mx, mz] = mounds[i];
      specs.push({
        type: rand() > 0.4 ? 'pine' : 'broadleaf',
        position: [mx, 0, mz],
        rotation: [0, rand() * Math.PI * 2, 0],
        scale: 0.85 + rand() * 0.7,
        snapToGround: true,
      });
    }
  }

  // 숲으로 들어가는 길목의 빈터에 작은 연못.
  //
  // 처음에는 그리드 한가운데에 두었는데, 가운데는 사방이 둔덕(dark 모듈)이라
  // 연못이 통째로 가려 보이지 않았다. 길목으로 옮기니 3D 뷰에서도 보이고
  // 1인칭으로 들어갈 때 가장 먼저 만나는 풍경이 된다.
  const pondRadius = Math.max(matrixSize * 0.14, 3.4);
  const [pondX, pondZ] = squareRingPoint(matrixSize, 152, 5.5);
  specs.push({
    type: 'pond',
    position: [pondX, 0.06, pondZ],
    rotation: [0, 0.3, 0],
    scale: pondRadius,
    persistent: true,
  });

  // 연못 곁의 통나무 벤치
  const [benchX, benchZ] = squareRingPoint(matrixSize, 138, 5.5);
  specs.push({
    type: 'logBench',
    position: [benchX, 0, benchZ],
    rotation: [0, -0.9, 0],
    scale: 1.6,
    persistent: true,
  });

  // 그리드를 둘러싼 키 큰 나무들
  for (let i = 0; i < 14; i += 1) {
    const angle = (360 / 14) * i + rand() * 14;
    const [tx, tz] = ringPoint(matrixSize, angle, 5 + rand() * 4);
    specs.push({
      type: rand() > 0.35 ? 'pine' : 'broadleaf',
      position: [tx, 0, tz],
      rotation: [0, rand() * Math.PI * 2, 0],
      scale: 2.6 + rand() * 1.8,
    });
  }

  // 탑다운에서도 남는 낮은 풍경 — 고사리와 버섯
  for (let i = 0; i < 30; i += 1) {
    const angle = (360 / 30) * i + rand() * 9;
    const [fx, fz] = squareRingPoint(matrixSize, angle, 1.2 + rand() * 4.6);
    specs.push({
      type: rand() > 0.28 ? 'fern' : 'mushroom',
      position: [fx, 0, fz],
      rotation: [0, rand() * Math.PI * 2, 0],
      scale: 1.2 + rand() * 0.9,
      persistent: true,
    });
  }

  return specs;
}

export function placeLandmarks(matrixSize, matrix) {
  const entries = [
    {
      title: '연못가',
      message: '물 위로 나뭇잎 하나가 천천히 지나갑니다.',
      color: '#8FD6E8',
    },
    {
      title: '이끼 낀 바위',
      message: '손을 대면 서늘합니다. 여기서 잠깐 쉬어 가세요.',
      color: '#A6E38F',
    },
    {
      title: '새소리가 나는 곳',
      message: '위를 올려다보면 잎 사이로 하늘이 조각나 있습니다.',
      color: '#FFE38A',
    },
    {
      title: '버섯 고리',
      message: '동그랗게 돋아난 버섯들. 밟지 않게 조심.',
      color: '#F49FC4',
    },
    {
      title: '쓰러진 나무',
      message: '넘어간 줄기를 밟고 위로 올라갈 수 있습니다.',
      color: '#C9A227',
    },
    {
      title: '가장 깊은 그늘',
      message: '숲에서 가장 조용한 자리입니다.',
      color: '#7FE3C4',
    },
  ];

  return pickWalkableCells(matrixSize, matrix, entries.length, 29).map(
    (point, i) => ({ ...entries[i], ...point })
  );
}

export function buildDecoration(spec) {
  switch (spec.type) {
    case 'pond':
      return buildPond();
    case 'logBench':
      return buildLogBench();
    case 'pine':
      return buildPine();
    case 'broadleaf':
      return buildBroadleaf();
    case 'fern':
      return buildFern();
    case 'mushroom':
      return buildMushroom();
    case 'forestSun':
      return buildForestSun();
    default:
      return null;
  }
}

/** 연못 물결을 아주 느리게 움직인다 */
export function update(dt, { elapsed, decorGroup, sceneryGroup }) {
  for (const obj of [...decorGroup.children, ...sceneryGroup.children]) {
    if (obj.userData.kind !== 'pond') continue;
    const ripple = obj.getObjectByName('pond-ripple');
    if (!ripple) continue;
    const wave = 1 + Math.sin(elapsed * 0.8) * 0.04;
    ripple.scale.set(wave, 1, wave);
    ripple.rotation.y = elapsed * 0.12;
  }
}

/* ------------------------------------------------------------------ */
/* 오브젝트                                                            */
/* ------------------------------------------------------------------ */

function buildPond() {
  const waterMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color('#6FC4DE'),
    emissive: new THREE.Color('#123A48'),
    transparent: true,
    opacity: 0.82,
    flatShading: true,
  });
  const bankMat = flatMaterial('#8A7A5C');
  const stoneMat = flatMaterial('#B4B7AE');

  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 22), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.02;

  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 22),
    glowMaterial('#DFF6FF', { opacity: 0.35, depthWrite: false })
  );
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = 0.05;
  ripple.name = 'pond-ripple';

  const bank = new THREE.Mesh(new THREE.RingGeometry(1, 1.18, 22), bankMat);
  bank.material.side = THREE.DoubleSide;
  bank.rotation.x = -Math.PI / 2;
  bank.position.y = 0.015;

  const stones = group();
  const rand = makeRandom(4242);
  for (let i = 0; i < 9; i += 1) {
    const a = (Math.PI * 2 * i) / 9 + rand() * 0.4;
    const r = 1.06 + rand() * 0.12;
    const stone = blob(0.09 + rand() * 0.06, 0, stoneMat, [
      Math.sin(a) * r,
      0.04,
      Math.cos(a) * r,
    ]);
    stone.scale.y = 0.6;
    stones.add(stone);
  }

  const g = group(water, ripple, bank, stones);
  g.userData.kind = 'pond';
  return g;
}

function buildLogBench() {
  const barkMat = flatMaterial('#8A6A4A');
  const coreMat = flatMaterial('#C8A87C');

  const log = cylinder(0.28, 0.28, 2.2, 8, barkMat, [0, 0.34, 0]);
  log.rotation.z = Math.PI / 2;

  const capA = cylinder(0.28, 0.28, 0.06, 8, coreMat, [1.1, 0.34, 0]);
  capA.rotation.z = Math.PI / 2;
  const capB = capA.clone();
  capB.position.x = -1.1;

  const legs = group(
    box(0.24, 0.34, 0.4, barkMat, [0.7, 0.17, 0]),
    box(0.24, 0.34, 0.4, barkMat, [-0.7, 0.17, 0])
  );

  return group(log, capA, capB, legs);
}

function buildPine() {
  const barkMat = flatMaterial('#7A5A3C');
  const leafMat = flatMaterial('#2F6146', { emissive: '#0A1710' });

  const trunk = cylinder(0.14, 0.24, 1.5, 6, barkMat, [0, 0.75, 0]);
  const tiers = group(
    cone(1.0, 1.5, 7, leafMat, [0, 1.75, 0]),
    cone(0.78, 1.3, 7, leafMat, [0, 2.55, 0]),
    cone(0.52, 1.05, 7, leafMat, [0, 3.25, 0])
  );

  return group(trunk, tiers);
}

function buildBroadleaf() {
  const barkMat = flatMaterial('#8A6A4A');
  const leafMat = flatMaterial('#4C8757', { emissive: '#0F1E14' });

  const trunk = cylinder(0.16, 0.28, 1.9, 6, barkMat, [0, 0.95, 0]);
  const canopy = group(
    blob(1.0, 0, leafMat, [0, 2.5, 0]),
    blob(0.66, 0, leafMat, [0.7, 2.15, 0.3]),
    blob(0.6, 0, leafMat, [-0.62, 2.2, -0.3]),
    blob(0.5, 0, leafMat, [0.15, 2.05, -0.72])
  );

  return group(trunk, canopy);
}

function buildFern() {
  const mat = flatMaterial('#5E9B63');
  const g = group();
  for (let i = 0; i < 5; i += 1) {
    const a = (Math.PI * 2 * i) / 5;
    const frond = cone(0.09, 0.62, 4, mat, [
      Math.sin(a) * 0.1,
      0.31,
      Math.cos(a) * 0.1,
    ]);
    frond.rotation.set(Math.sin(a) * 0.45, -a, -Math.cos(a) * 0.45);
    frond.scale.set(1, 1, 0.5);
    g.add(frond);
  }
  return g;
}

function buildMushroom() {
  const stemMat = flatMaterial('#F2E6CE');
  const capMat = flatMaterial('#E8736B', { emissive: '#3A100C' });

  const stem = cylinder(0.07, 0.09, 0.3, 6, stemMat, [0, 0.15, 0]);
  const cap = cone(0.22, 0.24, 8, capMat, [0, 0.38, 0]);
  const dot = blob(0.04, 0, stemMat, [0.07, 0.44, 0.03]);

  return group(stem, cap, dot);
}

function buildForestSun() {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28),
    glowMaterial('#FFF6D8', { opacity: 0.92 })
  );
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 28),
    glowMaterial('#FFE9A8', { opacity: 0.2, depthWrite: false })
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
  placeDecorations,
  placeLandmarks,
  getBackgroundSetup,
  getPlayerLight,
  getCurvature,
  getHeightJitter,
  buildDecoration,
  update,
};
