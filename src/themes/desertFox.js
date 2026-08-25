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
  makeRandom,
} from './_shared.js';

export const meta = {
  id: 'desert-fox',
  label: '사막과 여우',
  caption: '사구를 넘는 발자국',
  swatch: ['#E8896B', '#E8D5B5', '#B4643F'],
};

const PALETTE = {
  dark: '#E8896B', // 사구 능선 — 선셋오렌지
  darkEmissive: '#3A1509',
  light: '#E8D5B5', // 그늘진 모래 — 샌드베이지
  ground: '#E3CFAC',
  groundEmissive: '#241A0C',
  sky: '#F6C9A8',
  accent: '#B4643F',
  scanDark: '#241108',
  scanLight: '#FCF7EE',
};

export function getPalette() {
  return { ...PALETTE };
}

export function getCurvature() {
  return 0.45; // 사막 지평선이 둥글게 휘는 정도
}

export function getBlockGeometry(isDark) {
  if (isDark) {
    return {
      // 살짝 기울어진 사구 능선처럼 보이도록 윗면을 좁힌 사각 기둥
      geometry: new THREE.CylinderGeometry(0.55, 1, 1, 4, 1),
      material: flatMaterial(PALETTE.dark, { emissive: PALETTE.darkEmissive }),
      height: 2.3,
    };
  }
  return {
    geometry: new THREE.CylinderGeometry(0.9, 1, 1, 4, 1),
    material: flatMaterial(PALETTE.light),
    height: 0.8,
  };
}

export function getBackgroundSetup() {
  return {
    background: PALETTE.sky,
    fog: { color: '#F0B48C', near: 88, far: 235 },
    lights: [
      { type: 'hemisphere', sky: '#FFDDBB', ground: '#8A5A38', intensity: 1.6 },
      {
        type: 'directional',
        color: '#FFD1A1',
        intensity: 2.4,
        position: [48, 20, -34],
      },
      { type: 'ambient', color: '#E8A883', intensity: 0.55 },
    ],
    objects: [
      { type: 'sunset', position: [56, 8, -108], scale: 11 },
    ],
  };
}

export function placeDecorations(matrixSize) {
  const rand = makeRandom(matrixSize * 131 + 29);
  const specs = [];

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

  // 우물 → 여우로 이어지는 발자국 트레일 (절차적)
  const steps = 22;
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const angle = -118 + (152 + 118) * t;
    const wobble = (rand() - 0.5) * 1.6;
    const [px, pz] = ringPoint(matrixSize, angle, 6.4 + wobble);
    specs.push({
      type: 'footprint',
      position: [px, 0.02, pz],
      rotation: [0, (angle * Math.PI) / 180 + (rand() - 0.5) * 0.4, 0],
      scale: 0.55 + rand() * 0.2,
      side: i % 2 === 0 ? 1 : -1,
    });
  }

  return specs;
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
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* 오브젝트                                                            */
/* ------------------------------------------------------------------ */

/** 로우폴리 여우 실루엣 — 원작 삽화가 아닌 독자적인 단순 형태 */
function buildFox() {
  const furMat = flatMaterial('#C4622F', { emissive: '#2A0E03' });
  const bellyMat = flatMaterial('#F2DCC0');
  const tipMat = flatMaterial('#3A2418');

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
  const stoneMat = flatMaterial('#B9A88C', { emissive: '#1A150E' });
  const woodMat = flatMaterial('#8A6440');
  const waterMat = flatMaterial('#4C89A8', { emissive: '#0A2230' });
  const ropeMat = flatMaterial('#D8C49B');

  const wall = cylinder(0.8, 0.9, 0.7, 10, stoneMat, [0, 0.35, 0]);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 12),
    waterMat
  );
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
  const mat = flatMaterial('#C7AC85', {
    transparent: true,
    opacity: 0.75,
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
  placeDecorations,
  getBackgroundSetup,
  getCurvature,
  buildDecoration,
};
