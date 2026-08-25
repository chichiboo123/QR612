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
  makeRandom,
} from './_shared.js';

export const meta = {
  id: 'rose',
  label: '장미',
  caption: '유리돔 속 정원',
  swatch: ['#E8A0B4', '#1F3D2E', '#F5E1E7'],
};

const PALETTE = {
  dark: '#E8A0B4', // 꽃잎빛 타일
  darkEmissive: '#3A1420',
  light: '#28513C', // 잎사귀빛 타일
  ground: '#1F3D2E', // 미드나잇그린 정원 바닥
  groundEmissive: '#050D09',
  sky: '#132A20',
  accent: '#F5E1E7',
  scanDark: '#160B10',
  scanLight: '#FAF4F6',
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
      // 살짝 모따기한 정사각 타일 기둥
      geometry: new THREE.CylinderGeometry(0.92, 0.98, 1, 8, 1),
      material: flatMaterial(PALETTE.dark, { emissive: PALETTE.darkEmissive }),
      height: 1.7,
    };
  }
  return {
    // 낮은 원형 타일
    geometry: new THREE.CylinderGeometry(0.86, 0.86, 1, 12, 1),
    material: flatMaterial(PALETTE.light, { emissive: '#04100A' }),
    height: 0.4,
  };
}

export function getBackgroundSetup() {
  return {
    background: PALETTE.sky,
    fog: { color: '#163325', near: 60, far: 330 },
    lights: [
      { type: 'hemisphere', sky: '#F5CBD8', ground: '#12291D', intensity: 1.3 },
      {
        type: 'directional',
        color: '#FFE9F0',
        intensity: 2.0,
        position: [-22, 40, 26],
      },
      { type: 'ambient', color: '#8FA9A0', intensity: 0.6 },
      {
        type: 'point',
        color: '#F7B8C8',
        intensity: 180,
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

  // 정원 가장자리를 도는 작은 새싹들
  for (let i = 0; i < 9; i += 1) {
    const angle = (360 / 9) * i + rand() * 12;
    const [sx, sz] = ringPoint(matrixSize, angle, 2.8 + rand() * 1.4);
    specs.push({
      type: 'sprout',
      position: [sx, 0, sz],
      rotation: [0, rand() * Math.PI, 0],
      scale: 0.9 + rand() * 0.5,
    });
  }

  return specs;
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
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* 오브젝트                                                            */
/* ------------------------------------------------------------------ */

/** 로우폴리 장미 한 송이 */
function buildRose() {
  const stemMat = flatMaterial('#2F6B45', { emissive: '#061109' });
  const leafMat = flatMaterial('#3E8A56');
  const petalOuter = flatMaterial('#E8A0B4', { emissive: '#3A1420' });
  const petalInner = flatMaterial('#C95F7D', { emissive: '#2A0A14' });

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

  // 꽃받침 + 겹쳐진 꽃잎
  const calyx = cone(0.24, 0.34, 6, stemMat, [0, 2.6, 0]);
  const bloom = group();
  const rings = [
    { r: 0.44, y: 2.86, count: 6, tilt: 0.85, mat: petalOuter },
    { r: 0.32, y: 3.0, count: 5, tilt: 0.55, mat: petalOuter },
    { r: 0.2, y: 3.12, count: 4, tilt: 0.3, mat: petalInner },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i += 1) {
      const a = ((Math.PI * 2) / ring.count) * i + ring.r;
      const petal = new THREE.Mesh(new THREE.CircleGeometry(0.34, 5), ring.mat);
      petal.material.side = THREE.DoubleSide;
      petal.position.set(Math.sin(a) * ring.r, ring.y, Math.cos(a) * ring.r);
      petal.rotation.set(-ring.tilt, a, 0);
      bloom.add(petal);
    }
  }
  const core = blob(0.14, 0, petalInner, [0, 3.18, 0]);

  return group(stem, leaves, calyx, bloom, core);
}

/** 작은 물뿌리개 */
function buildWateringCan() {
  const metalMat = flatMaterial('#9FB8C4', { emissive: '#101A1E' });
  const trimMat = flatMaterial('#E8A0B4');

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
    color: new THREE.Color('#CFE6DA'),
    emissive: new THREE.Color('#0E2018'),
    transparent: true,
    opacity: 0.16,
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
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.018, 6, 40),
    rimMat
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;

  const knob = blob(0.05, 0, rimMat, [0, 0.8, 0]);

  return group(dome, rim, knob);
}

/** 원형 정원 바닥 */
function buildGardenFloor() {
  const mat = flatMaterial('#173025', { emissive: '#040A07' });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat);
  disc.rotation.x = -Math.PI / 2;

  const edgeMat = flatMaterial('#3C6B51');
  const edge = new THREE.Mesh(
    new THREE.RingGeometry(0.98, 1.02, 48),
    edgeMat
  );
  edge.material.side = THREE.DoubleSide;
  edge.rotation.x = -Math.PI / 2;
  edge.position.y = 0.01;

  return group(disc, edge);
}

function buildSprout() {
  const mat = flatMaterial('#4E9463');
  const stem = cylinder(0.03, 0.04, 0.5, 5, mat, [0, 0.25, 0]);
  const leafA = new THREE.Mesh(new THREE.CircleGeometry(0.18, 5), mat);
  leafA.material.side = THREE.DoubleSide;
  leafA.position.set(0.12, 0.48, 0);
  leafA.rotation.set(-1.1, 0.4, 0);
  const leafB = leafA.clone();
  leafB.position.set(-0.12, 0.44, 0.04);
  leafB.rotation.set(-1.1, -0.6, 0);

  return group(stem, leafA, leafB);
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
