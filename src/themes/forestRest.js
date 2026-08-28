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

/**
 * 탑다운 스캔 뷰의 모듈 색 후보.
 * 잎사귀의 여러 초록과 나무껍질의 갈색.
 *
 * 엔진이 이 색들의 명도만 스캔 안전 대역으로 끌어당기고 색상은 그대로 둔다.
 * 덕분에 QR 이 단색 검정이 아니라 3D 씬과 같은 색 계열의 모자이크가 된다.
 */
export function getScanColors() {
  return {
    dark: ['#4C8757', '#4C8757', '#427A4D', '#579461', '#3F7049', '#4C8757'],
    light: ['#CFE0B4', '#CFE0B4', '#D7E6BE', '#C5D9A8'],
  };
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
        solid: true,
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
    solid: true,
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
      solid: true,
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
      type: 'squirrel',
      title: '도토리를 든 다람쥐',
      message: '다람쥐가 꼬리를 흔들며 나무 뒤로 몸을 숨깁니다.',
    },
    {
      type: 'butterfly',
      title: '숲나비',
      message: '노란 나비가 고사리 위를 가볍게 맴돕니다.',
    },
    {
      type: 'forestBird',
      title: '파랑새',
      message: '작은 새가 고개를 갸웃하고 짧게 지저귑니다.',
    },
    {
      type: 'wildflower',
      title: '바람꽃',
      message: '하얀 꽃잎이 숲바람을 따라 천천히 흔들립니다.',
    },
    {
      type: 'sapling',
      title: '어린 참나무',
      message: '막 펼쳐진 연두 잎이 햇빛을 향하고 있습니다.',
    },
    {
      type: 'mushroomFriend',
      title: '꼬마 버섯 가족',
      message: '크기가 다른 버섯 셋이 나란히 돋아났습니다.',
    },
  ];

  return pickWalkableCells(matrixSize, matrix, entries.length, 29).map(
    (point, i) => ({ ...entries[i], ...point })
  );
}

/** 탐험 랜드마크를 추상 보석 대신 숲의 동물과 식물로 만든다. */
export function buildLandmark(spec) {
  switch (spec.type) {
    case 'squirrel':
      return buildSquirrel();
    case 'butterfly':
      return buildButterfly();
    case 'forestBird':
      return buildBird();
    case 'wildflower':
      return buildWildflower();
    case 'sapling':
      return buildSapling();
    case 'mushroomFriend':
      return buildMushroomFamily();
    default:
      return null;
  }
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
    const kind = obj.userData.kind;
    if (kind === 'pond') {
      const ripple = obj.getObjectByName('pond-ripple');
      if (!ripple) continue;
      const wave = 1 + Math.sin(elapsed * 0.8) * 0.04;
      ripple.scale.set(wave, 1, wave);
      ripple.rotation.y = elapsed * 0.12;
    } else if (kind === 'squirrel') {
      obj.rotation.y = Math.sin(elapsed * 1.8) * 0.32;
      const tail = obj.getObjectByName('squirrel-tail');
      if (tail) tail.rotation.z = -0.65 + Math.sin(elapsed * 4) * 0.18;
    } else if (kind === 'butterfly') {
      obj.position.y = obj.userData.anchor.y + 0.75 + Math.sin(elapsed * 2.4) * 0.2;
      const wings = obj.getObjectByName('butterfly-wings');
      if (wings) wings.scale.x = 0.35 + Math.abs(Math.sin(elapsed * 7)) * 0.65;
    } else if (kind === 'forestBird') {
      obj.position.y = obj.userData.anchor.y + 0.35 + Math.sin(elapsed * 3) * 0.08;
      obj.rotation.y = Math.sin(elapsed * 1.1) * 0.5;
    } else if (['wildflower', 'sapling', 'mushroomFriend'].includes(kind)) {
      obj.rotation.z = Math.sin(elapsed * 1.5 + obj.position.x) * 0.05;
    }
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

function buildSquirrel() {
  const fur = flatMaterial('#B96F3F', { emissive: '#2A1007' });
  const cream = flatMaterial('#F1D3A4');
  const dark = flatMaterial('#33241B');
  const body = blob(0.28, 0, fur, [0, 0.34, 0]);
  body.scale.set(0.8, 1.25, 0.75);
  const head = blob(0.2, 0, fur, [0, 0.68, 0.08]);
  const ears = group(
    cone(0.07, 0.18, 5, fur, [-0.1, 0.87, 0.06]),
    cone(0.07, 0.18, 5, fur, [0.1, 0.87, 0.06])
  );
  const tail = cone(0.28, 0.85, 7, fur, [0, 0.52, -0.38]);
  tail.name = 'squirrel-tail';
  tail.rotation.z = -0.65;
  const acorn = group(
    blob(0.08, 0, cream, [0, 0.44, 0.27]),
    cylinder(0.02, 0.02, 0.1, 5, dark, [0, 0.55, 0.27])
  );
  const animal = group(body, head, ears, tail, acorn);
  animal.userData.kind = 'squirrel';
  return animal;
}

function buildButterfly() {
  const wingMat = flatMaterial('#FFD85E', { emissive: '#4A3708' });
  const bodyMat = flatMaterial('#493826');
  const wings = group();
  wings.name = 'butterfly-wings';
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.CircleGeometry(0.2, 7), wingMat);
    wing.material.side = THREE.DoubleSide;
    wing.scale.set(0.8, 1.25, 1);
    wing.position.x = side * 0.16;
    wing.rotation.y = side * 0.45;
    wings.add(wing);
  }
  const body = cylinder(0.025, 0.035, 0.34, 5, bodyMat, [0, 0, 0]);
  body.rotation.x = Math.PI / 2;
  const animal = group(wings, body);
  animal.userData.kind = 'butterfly';
  return animal;
}

function buildBird() {
  const blue = flatMaterial('#4B9CC8', { emissive: '#0C2634' });
  const belly = flatMaterial('#DDF2E9');
  const beak = flatMaterial('#E8A64A');
  const body = blob(0.24, 0, blue, [0, 0.24, 0]);
  body.scale.set(1, 0.8, 1.25);
  const chest = blob(0.13, 0, belly, [0, 0.22, 0.19]);
  const head = blob(0.16, 0, blue, [0, 0.48, 0.12]);
  const bill = cone(0.055, 0.2, 4, beak, [0, 0.46, 0.34]);
  bill.rotation.x = Math.PI / 2;
  const animal = group(body, chest, head, bill);
  animal.userData.kind = 'forestBird';
  return animal;
}

function buildWildflower() {
  const stem = cylinder(0.025, 0.035, 0.55, 5, flatMaterial('#4C8757'), [0, 0.275, 0]);
  const petals = group();
  const petalMat = flatMaterial('#FFF7E4');
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI * 2 * i) / 6;
    const petal = blob(0.09, 0, petalMat, [Math.cos(a) * 0.12, 0.62, Math.sin(a) * 0.12]);
    petal.scale.set(1.35, 0.45, 0.8);
    petals.add(petal);
  }
  const plant = group(stem, petals, blob(0.06, 0, flatMaterial('#F2C94C'), [0, 0.62, 0]));
  plant.userData.kind = 'wildflower';
  return plant;
}

function buildSapling() {
  const trunk = cylinder(0.04, 0.06, 0.85, 5, flatMaterial('#866447'), [0, 0.425, 0]);
  const leaves = group(
    blob(0.24, 0, flatMaterial('#77B95B'), [0, 0.9, 0]),
    blob(0.16, 0, flatMaterial('#91CD68'), [0.2, 0.76, 0.04]),
    blob(0.15, 0, flatMaterial('#91CD68'), [-0.18, 0.72, -0.02])
  );
  const plant = group(trunk, leaves);
  plant.userData.kind = 'sapling';
  return plant;
}

function buildMushroomFamily() {
  const family = group();
  for (const [x, scale] of [[-0.2, 0.75], [0, 1], [0.22, 0.6]]) {
    const mushroom = buildMushroom();
    mushroom.position.x = x;
    mushroom.scale.setScalar(scale);
    family.add(mushroom);
  }
  family.userData.kind = 'mushroomFriend';
  return family;
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
  getScanColors,
  placeDecorations,
  placeLandmarks,
  getBackgroundSetup,
  getPlayerLight,
  getCurvature,
  getHeightJitter,
  buildDecoration,
  buildLandmark,
  update,
};
