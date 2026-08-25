/**
 * themes/starryNight.js — 2) 별이 빛나는 밤하늘
 * ---------------------------------------------------------------------------
 * QR 의 dark 모듈만 낮은 발광 강도의 별로 표현하고, light 모듈은
 * 거의 보이지 않는 어두운 바닥으로 남겨 은하수 같은 대비를 만든다.
 * 작은 행성 가장자리에 어린왕자 실루엣이 서 있다.
 *
 * 팔레트: 딥네이비 배경 + 골드 별빛
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
  id: 'starry-night',
  label: '별이 빛나는 밤하늘',
  caption: '은하수와 어린왕자',
  swatch: ['#0D1B3E', '#F2C14E', '#6E86C6'],
};

const PALETTE = {
  dark: '#F2C14E', // 별빛 골드
  darkEmissive: '#8A6412', // 낮은 발광 강도
  light: '#101F44', // 어두운 배경 모듈
  ground: '#0A1533',
  groundEmissive: '#020610',
  sky: '#0D1B3E',
  accent: '#F2C14E',
  scanDark: '#0A0A0A',
  scanLight: '#F7F7FA',
};

export function getPalette() {
  return { ...PALETTE };
}

export function getCurvature() {
  return 0.25; // 아주 완만한 곡률로 밤하늘이 감싸는 느낌만
}

export function getBlockGeometry(isDark) {
  if (isDark) {
    return {
      // 팔면체 — 뾰족한 별 실루엣
      geometry: new THREE.OctahedronGeometry(0.62, 0),
      material: flatMaterial(PALETTE.dark, {
        emissive: PALETTE.darkEmissive,
      }),
      height: 1.5,
    };
  }
  return {
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: flatMaterial(PALETTE.light, { emissive: '#050B1C' }),
    height: 0.14,
  };
}

export function getBackgroundSetup() {
  const rand = makeRandom(20240612);
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = 90 + rand() * 130;
    stars.push({
      type: 'farStar',
      position: [
        Math.sin(angle) * radius,
        12 + rand() * 90,
        Math.cos(angle) * radius,
      ],
      scale: 0.5 + rand() * 1.5,
      color: rand() > 0.75 ? '#FFFFFF' : PALETTE.accent,
    });
  }

  return {
    background: PALETTE.sky,
    fog: { color: '#0D1B3E', near: 70, far: 380 },
    lights: [
      { type: 'ambient', color: '#5C74B8', intensity: 1.1 },
      {
        type: 'directional',
        color: '#9FB6F0',
        intensity: 1.1,
        position: [26, 34, -18],
      },
      { type: 'hemisphere', sky: '#2A3E78', ground: '#05091A', intensity: 0.8 },
    ],
    objects: [
      ...stars,
      { type: 'moon', position: [78, 52, -86], scale: 6.5 },
    ],
  };
}

export function placeDecorations(matrixSize) {
  const [x, z] = ringPoint(matrixSize, -34, 7);
  return [
    {
      // 작은 행성 가장자리에 선 어린왕자
      type: 'princeOnPlanet',
      position: [x, 0, z],
      rotation: [0, 2.5, 0],
      scale: 1.85,
    },
  ];
}

export function buildDecoration(spec) {
  switch (spec.type) {
    case 'princeOnPlanet':
      return buildPrinceOnPlanet();
    case 'farStar':
      return buildFarStar(spec.color || PALETTE.accent);
    case 'moon':
      return buildMoon();
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* 오브젝트                                                            */
/* ------------------------------------------------------------------ */

/**
 * 작은 행성 + 그 위에 선 어린왕자 실루엣.
 * 원작 삽화를 옮기지 않고, 페이퍼컷 실루엣처럼 단순화한 독자 형태.
 */
function buildPrinceOnPlanet() {
  const planetMat = flatMaterial('#243B6B', { emissive: '#060C1C' });
  const silhouette = glowMaterial('#0A1128', { transparent: false });
  const scarfMat = glowMaterial('#F2C14E', { transparent: false });
  const hairMat = glowMaterial('#E8C46A', { transparent: false });

  const planet = blob(2.0, 1, planetMat, [0, 0.9, 0]);

  // 실루엣 인물: 다리 - 몸통 - 머리 - 머플러
  const legs = group(
    box(0.16, 0.6, 0.16, silhouette, [-0.13, 3.15, 0]),
    box(0.16, 0.6, 0.16, silhouette, [0.13, 3.15, 0])
  );
  const body = cylinder(0.22, 0.36, 0.85, 7, silhouette, [0, 3.85, 0]);
  const arms = group(
    (() => {
      const a = cylinder(0.08, 0.08, 0.6, 5, silhouette, [-0.34, 3.95, 0]);
      a.rotation.z = 0.5;
      return a;
    })(),
    (() => {
      const a = cylinder(0.08, 0.08, 0.6, 5, silhouette, [0.34, 3.95, 0]);
      a.rotation.z = -0.5;
      return a;
    })()
  );
  const head = blob(0.3, 1, silhouette, [0, 4.5, 0]);
  const hair = blob(0.33, 0, hairMat, [0, 4.62, -0.02]);

  const scarf = box(0.5, 0.12, 0.14, scarfMat, [0, 4.2, 0]);
  const scarfTail = box(0.5, 0.1, 0.1, scarfMat, [-0.42, 4.06, 0]);
  scarfTail.rotation.z = 0.5;

  const figure = group(legs, body, arms, head, hair, scarf, scarfTail);

  return group(planet, figure);
}

function buildFarStar(color) {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.5, 0),
    glowMaterial(color, { opacity: 0.85, depthWrite: false })
  );
  return group(mesh);
}

function buildMoon() {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28),
    glowMaterial('#F6EFD8', { opacity: 0.95 })
  );
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 28),
    glowMaterial('#F2C14E', { opacity: 0.14, depthWrite: false })
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
