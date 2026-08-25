/**
 * themes/b612.js — 1) B612 (작은 행성)
 * ---------------------------------------------------------------------------
 * QR 블록을 완만하게 구부러진 구면(리틀 플래닛) 위에 배치하고,
 * 바오밥나무 실루엣 · 화산 · 작은 의자를 로우폴리로 얹는다.
 * 지평선 근처에는 여러 개의 태양이 낮게 걸려 있다.
 *
 * 팔레트: 밝은 세이지그린 행성 표면 + 맑은 코발트블루 하늘
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
  makeRandom,
} from './_shared.js';

export const meta = {
  id: 'b612',
  label: 'B612',
  caption: '작은 행성',
  swatch: ['#A8C6A9', '#5E9FD4', '#FFD98A'],
};

const PALETTE = {
  /* 3D 씬 */
  dark: '#6E9B79', // 높은 블록 — 밝은 이끼빛
  darkEmissive: '#16261B',
  light: '#DCE9D6', // 낮은 블록 — 아주 밝은 세이지
  ground: '#A8C6A9', // 행성 표면
  groundEmissive: '#101C13',
  sky: '#5E9FD4', // 맑은 코발트블루
  accent: '#FFD98A', // 햇빛

  /* 탑다운 스캔 뷰 (대비 8.9:1) */
  scanDark: '#2E4A38',
  scanLight: '#F1F6EC',
  scanGround: '#B6D0B4', // QR 카드가 얹히는 풍경색
  scanShadow: '#5C7A63',
};

export function getPalette() {
  return { ...PALETTE };
}

/** 구면 배치 강도. 엔진이 progress 에 따라 0 으로 펴준다. */
export function getCurvature() {
  return 1;
}

export function getBlockGeometry(isDark) {
  if (isDark) {
    return {
      // 정사각 밑면 — 탑다운에서 모듈이 정확히 맞물리도록
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: flatMaterial(PALETTE.dark, { emissive: PALETTE.darkEmissive }),
      height: 1.75,
    };
  }
  return {
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: flatMaterial(PALETTE.light),
    height: 0.5,
  };
}

export function getBackgroundSetup() {
  return {
    background: PALETTE.sky,
    fog: { color: '#5E9FD4', near: 70, far: 175 },
    lights: [
      { type: 'hemisphere', sky: '#D8ECFF', ground: '#7E9C82', intensity: 2.0 },
      {
        type: 'directional',
        color: '#FFF0CE',
        intensity: 2.5,
        position: [-38, 30, 30],
      },
      { type: 'ambient', color: '#BFD9F2', intensity: 0.8 },
    ],
    /** 지평선 근처에 낮게 걸린 태양들 */
    objects: [
      { type: 'sun', position: [-70, 9, -95], scale: 7.5, color: '#FFE3A8' },
      { type: 'sun', position: [-24, 5, -110], scale: 5.2, color: '#FFCE8C' },
      { type: 'sun', position: [46, 12, -102], scale: 4.2, color: '#FFF0CE' },
      { type: 'sun', position: [92, 4, -78], scale: 3.0, color: '#FFC178' },
    ],
  };
}

export function placeDecorations(matrixSize) {
  const rand = makeRandom(matrixSize * 61 + 7);
  const specs = [];

  // 바오밥나무 2그루 — 행성 반대편 가장자리에
  const baobabAngles = [-58, 132];
  for (let i = 0; i < baobabAngles.length; i += 1) {
    const [x, z] = ringPoint(matrixSize, baobabAngles[i], 5.5);
    specs.push({
      type: 'baobab',
      position: [x, 0, z],
      rotation: [0, rand() * Math.PI * 2, 0],
      scale: 3.2 + i * 0.5,
    });
  }

  // 화산 2개
  const volcanoAngles = [38, -142];
  for (let i = 0; i < volcanoAngles.length; i += 1) {
    const [x, z] = ringPoint(matrixSize, volcanoAngles[i], 6);
    specs.push({
      type: 'volcano',
      position: [x, 0, z],
      rotation: [0, rand() * Math.PI * 2, 0],
      scale: 2.6 + i * 0.6,
    });
  }

  // 작은 의자 하나
  const [cx, cz] = ringPoint(matrixSize, -8, 5.5);
  specs.push({
    type: 'chair',
    position: [cx, 0, cz],
    rotation: [0, -0.35, 0],
    scale: 1.6,
  });

  // 탑다운에서도 남는 낮은 풍경 — QR 판 바깥 정사각 링 위에만 둔다
  for (let i = 0; i < 26; i += 1) {
    const angle = (360 / 26) * i + rand() * 9;
    const [gx, gz] = squareRingPoint(matrixSize, angle, 1.4 + rand() * 4.5);
    specs.push({
      type: rand() > 0.32 ? 'tuft' : 'pebble',
      position: [gx, 0, gz],
      rotation: [0, rand() * Math.PI * 2, 0],
      scale: 1.5 + rand() * 1.1,
      persistent: true,
    });
  }

  return specs;
}

export function buildDecoration(spec) {
  switch (spec.type) {
    case 'baobab':
      return buildBaobab();
    case 'volcano':
      return buildVolcano();
    case 'chair':
      return buildChair();
    case 'sun':
      return buildSun(spec.color || PALETTE.accent);
    case 'tuft':
      return buildTuft();
    case 'pebble':
      return buildPebble();
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* 오브젝트                                                            */
/* ------------------------------------------------------------------ */

function buildBaobab() {
  const barkMat = flatMaterial('#8A6A4A');
  const leafMat = flatMaterial('#4E8360', { emissive: '#0E1D14' });

  const trunk = cylinder(0.34, 0.72, 2.1, 6, barkMat, [0, 1.05, 0]);

  const branches = group();
  const dirs = [
    [0.55, 2.2, 0.15, 0.9],
    [-0.5, 2.15, -0.3, -0.85],
    [0.1, 2.35, -0.6, 0.2],
  ];
  for (const [bx, by, bz, tilt] of dirs) {
    const branch = cylinder(0.1, 0.2, 1.1, 5, barkMat, [bx, by, bz]);
    branch.rotation.z = tilt * 0.6;
    branch.rotation.x = bz * 0.7;
    branches.add(branch);
  }

  const canopy = group(
    blob(0.95, 0, leafMat, [0, 2.95, 0]),
    blob(0.62, 0, leafMat, [0.85, 2.6, 0.25]),
    blob(0.55, 0, leafMat, [-0.75, 2.55, -0.35]),
    blob(0.45, 0, leafMat, [0.1, 2.5, -0.8])
  );

  return group(trunk, branches, canopy);
}

function buildVolcano() {
  const rockMat = flatMaterial('#93A48F', { emissive: '#161E16' });
  const craterMat = flatMaterial('#F0906A', { emissive: '#5A2410' });

  const body = cylinder(0.55, 1.5, 1.5, 7, rockMat, [0, 0.75, 0]);
  const crater = cylinder(0.42, 0.5, 0.16, 7, craterMat, [0, 1.5, 0]);
  const smoke = group(
    blob(
      0.22,
      0,
      flatMaterial('#E4EDEF', { transparent: true, opacity: 0.6 }),
      [0.05, 1.85, 0]
    ),
    blob(
      0.15,
      0,
      flatMaterial('#F1F6F7', { transparent: true, opacity: 0.45 }),
      [0.2, 2.2, 0.08]
    )
  );

  return group(body, crater, smoke);
}

function buildChair() {
  const woodMat = flatMaterial('#E8B93F', { emissive: '#2E230A' });
  const seat = box(0.9, 0.1, 0.85, woodMat, [0, 0.55, 0]);
  const back = box(0.9, 0.75, 0.1, woodMat, [0, 0.95, -0.38]);

  const legs = group();
  for (const [lx, lz] of [
    [0.36, 0.36],
    [-0.36, 0.36],
    [0.36, -0.36],
    [-0.36, -0.36],
  ]) {
    legs.add(box(0.1, 0.55, 0.1, woodMat, [lx, 0.28, lz]));
  }

  return group(seat, back, legs);
}

function buildSun(color) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 26),
    glowMaterial(color, { opacity: 0.95 })
  );
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 26),
    glowMaterial(color, { opacity: 0.2, depthWrite: false })
  );
  halo.position.z = -0.05;

  const g = group(halo, disc);
  g.userData.billboard = true;
  return g;
}

/** 탑다운에서도 남는 작은 풀포기 */
function buildTuft() {
  const mat = flatMaterial('#6FA87C');
  const g = group();
  for (const [bx, bz, tilt, h] of [
    [0, 0, 0, 0.5],
    [0.16, 0.08, 0.35, 0.38],
    [-0.15, -0.06, -0.32, 0.34],
  ]) {
    const blade = cone(0.09, h, 4, mat, [bx, h / 2, bz]);
    blade.rotation.z = tilt;
    g.add(blade);
  }
  return g;
}

/** 탑다운에서도 남는 작은 조약돌 */
function buildPebble() {
  const mat = flatMaterial('#C3D2BE');
  const rock = blob(0.26, 0, mat, [0, 0.12, 0]);
  rock.scale.set(1.2, 0.55, 1);
  return group(rock);
}

export default {
  ...meta,
  getBlockGeometry,
  getPalette,
  placeDecorations,
  getBackgroundSetup,
  getCurvature,
  buildDecoration,
};
