/**
 * themes/b612.js — 1) B612 (작은 행성)
 * ---------------------------------------------------------------------------
 * QR 블록을 완만하게 구부러진 구면(리틀 플래닛) 위에 배치하고,
 * 바오밥나무 실루엣 · 화산 · 작은 의자를 로우폴리로 얹는다.
 * 지평선 근처에는 여러 개의 태양이 낮게 걸려 있다.
 *
 * 팔레트: 세이지그린 행성 표면 + 코발트블루 하늘
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
  makeRandom,
} from './_shared.js';

export const meta = {
  id: 'b612',
  label: 'B612',
  caption: '작은 행성',
  swatch: ['#8FA998', '#2C5F8A', '#F0C987'],
};

const PALETTE = {
  /** 3D 씬용 */
  dark: '#3E5C4B', // 높은 블록 — 깊은 이끼빛
  darkEmissive: '#0B140F',
  light: '#A9C0AC', // 낮은 블록 — 밝은 세이지
  ground: '#8FA998', // 행성 표면
  groundEmissive: '#0A1410',
  sky: '#2C5F8A', // 코발트블루 하늘
  accent: '#F0C987', // 태양빛
  /** 2D 스캔 뷰용 (대비 확보) */
  scanDark: '#12241B',
  scanLight: '#FAFBF7',
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
      // 살짝 좁아지는 사다리꼴 기둥 — 로우폴리 바위 느낌
      geometry: new THREE.CylinderGeometry(0.78, 1, 1, 4, 1),
      material: flatMaterial(PALETTE.dark, { emissive: PALETTE.darkEmissive }),
      height: 2.5,
    };
  }
  return {
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: flatMaterial(PALETTE.light),
    height: 0.45,
  };
}

export function getBackgroundSetup() {
  return {
    background: PALETTE.sky,
    fog: { color: '#3A6E96', near: 92, far: 265 },
    lights: [
      { type: 'hemisphere', sky: '#BFD9F2', ground: '#4E6B58', intensity: 1.5 },
      {
        type: 'directional',
        color: '#FFE3B0',
        intensity: 2.2,
        position: [-38, 26, 30],
      },
      { type: 'ambient', color: '#7FA6C9', intensity: 0.5 },
    ],
    /** 지평선 근처에 낮게 걸린 태양들 */
    objects: [
      { type: 'sun', position: [-70, 9, -95], scale: 7.5, color: '#F6D18B' },
      { type: 'sun', position: [-24, 5, -110], scale: 5.2, color: '#F0B473' },
      { type: 'sun', position: [46, 12, -102], scale: 4.2, color: '#FBE3B6' },
      { type: 'sun', position: [92, 4, -78], scale: 3.0, color: '#EBA96A' },
    ],
  };
}

export function placeDecorations(matrixSize) {
  const rand = makeRandom(matrixSize * 61 + 7);
  const specs = [];

  // 바오밥나무 2그루 — 행성 반대편 가장자리에
  const baobabAngles = [-58, 132];
  for (let i = 0; i < baobabAngles.length; i += 1) {
    const [x, z] = ringPoint(matrixSize, baobabAngles[i], 4.5);
    specs.push({
      type: 'baobab',
      position: [x, 0, z],
      rotation: [0, rand() * Math.PI * 2, 0],
      scale: 3.4 + i * 0.5,
    });
  }

  // 화산 2개
  const volcanoAngles = [38, -142];
  for (let i = 0; i < volcanoAngles.length; i += 1) {
    const [x, z] = ringPoint(matrixSize, volcanoAngles[i], 5.5);
    specs.push({
      type: 'volcano',
      position: [x, 0, z],
      rotation: [0, rand() * Math.PI * 2, 0],
      scale: 2.6 + i * 0.6,
    });
  }

  // 작은 의자 하나
  const [cx, cz] = ringPoint(matrixSize, -8, 5);
  specs.push({
    type: 'chair',
    position: [cx, 0, cz],
    rotation: [0, -0.35, 0],
    scale: 1.5,
  });

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
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* 오브젝트                                                            */
/* ------------------------------------------------------------------ */

function buildBaobab() {
  const barkMat = flatMaterial('#5B4634');
  const leafMat = flatMaterial('#2F4A38', { emissive: '#07110B' });

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
  const rockMat = flatMaterial('#6E7F6E', { emissive: '#0B120C' });
  const craterMat = flatMaterial('#D97A4E', { emissive: '#4A1D0C' });

  const body = cylinder(0.55, 1.5, 1.5, 7, rockMat, [0, 0.75, 0]);
  const crater = cylinder(0.42, 0.5, 0.16, 7, craterMat, [0, 1.5, 0]);
  const smoke = group(
    blob(0.22, 0, flatMaterial('#B9C6C9', { transparent: true, opacity: 0.55 }), [0.05, 1.85, 0]),
    blob(0.15, 0, flatMaterial('#CBD5D7', { transparent: true, opacity: 0.4 }), [0.2, 2.2, 0.08])
  );

  return group(body, crater, smoke);
}

function buildChair() {
  const woodMat = flatMaterial('#C9A227', { emissive: '#231A05' });
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
    glowMaterial(color, { opacity: 0.92 })
  );
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 26),
    glowMaterial(color, { opacity: 0.18, depthWrite: false })
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
  getBackgroundSetup,
  getCurvature,
  buildDecoration,
};
