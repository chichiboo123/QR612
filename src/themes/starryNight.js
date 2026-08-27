/**
 * themes/starryNight.js — 2) 별이 빛나는 밤하늘
 * ---------------------------------------------------------------------------
 * QR 의 dark 모듈만 낮은 발광 강도의 별로 표현하고, light 모듈은
 * 어두운 바닥으로 남겨 은하수 같은 대비를 만든다.
 * 작은 행성 가장자리에는 어린왕자의 가로등이 따뜻하게 켜져 있다.
 * (인물 형상은 두지 않고 소품과 빛으로만 이야기를 전한다.)
 *
 * 팔레트: 밝은 인디고 밤하늘 + 골드 별빛
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
  id: 'starry-night',
  label: '별이 빛나는 밤하늘',
  caption: '은하수와 가로등',
  swatch: ['#22336B', '#FFD972', '#8FA6E0'],
};

const PALETTE = {
  /* 3D 씬 */
  dark: '#FFD972', // 별빛 골드
  darkEmissive: '#7A5A14', // 낮은 발광 강도
  light: '#2E4288', // 은은한 인디고 바닥
  ground: '#22336B',
  groundEmissive: '#0A1130',
  sky: '#263A79', // 밝힌 밤하늘
  revealSky: '#7896C9', // 해가 들기 시작한 푸른 새벽
  revealGround: '#667DB2',
  accent: '#FFD972',

  /* 탑다운 스캔 뷰 (대비 12.4:1) — 달빛 종이 위의 인디고 */
  scanDark: '#1E2B57',
  scanLight: '#FAF4E2',
  scanGround: '#4A5FA8',
  scanShadow: '#16204A',
};

export function getPalette() {
  return { ...PALETTE };
}

export function getCurvature() {
  return 0.3;
}

export function getBlockGeometry(isDark) {
  if (isDark) {
    return {
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: flatMaterial(PALETTE.dark, { emissive: PALETTE.darkEmissive }),
      height: 1.4,
    };
  }
  return {
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: flatMaterial(PALETTE.light, { emissive: '#0B1637' }),
    height: 0.24,
  };
}

/** 1인칭 탐험 중 보조 조명 세기 — 밤하늘 아래는 발밑이 잘 안 보인다 */
export function getPlayerLight() {
  return 0.9;
}

/** QR 리빌에서는 달빛이 새벽빛으로 바뀌며 그림자를 함께 보여 준다. */
export function getRevealLighting() {
  return { sun: 2.15, fill: 0.92 };
}

/**
 * 탑다운 스캔 뷰의 모듈 색 후보.
 * 밤하늘의 남색과 별빛의 금빛(어둡게 내린 청동빛).
 *
 * 엔진이 이 색들의 명도만 스캔 안전 대역으로 끌어당기고 색상은 그대로 둔다.
 * 덕분에 QR 이 단색 검정이 아니라 3D 씬과 같은 색 계열의 모자이크가 된다.
 */
export function getScanColors() {
  return {
    dark: ['#FFD972', '#FFD972', '#F4C95D', '#FFE18A', '#E9B942', '#FFD972'],
    light: ['#2E4288', '#2E4288', '#354B94', '#283B7C'],
  };
}

export function getBackgroundSetup() {
  const rand = makeRandom(20240612);
  const stars = [];

  // 작은 행성이 우주에 떠 있는 구도이므로, 별을 상반구가 아니라
  // 씬을 감싸는 커다란 구(球) 전체에 고르게 뿌린다.
  for (let i = 0; i < 240; i += 1) {
    const u = rand() * 2 - 1; // cos(polar)
    const phi = rand() * Math.PI * 2;
    const ring = Math.sqrt(1 - u * u);
    const radius = 190 + rand() * 110;

    stars.push({
      type: 'farStar',
      position: [
        Math.cos(phi) * ring * radius,
        u * radius,
        Math.sin(phi) * ring * radius,
      ],
      scale: 1.7 + rand() * 3.4,
      color: rand() > 0.75 ? '#FFFFFF' : PALETTE.accent,
    });
  }

  return {
    background: PALETTE.sky,
    fog: { color: '#263A79', near: 70, far: 175 },
    lights: [
      { type: 'ambient', color: '#8CA2E0', intensity: 1.9 },
      {
        type: 'directional',
        color: '#CFDBFF',
        intensity: 1.5,
        position: [26, 38, -18],
      },
      { type: 'hemisphere', sky: '#5A72C4', ground: '#141F44', intensity: 1.0 },
    ],
    objects: [...stars, { type: 'moon', position: [64, 18, -132], scale: 8 }],
  };
}

export function placeDecorations(matrixSize) {
  const rand = makeRandom(matrixSize * 37 + 11);
  const specs = [];

  // 작은 행성 위의 가로등 — 어린왕자의 가로등 켜는 별에서 온 모티브
  const [x, z] = ringPoint(matrixSize, -34, 7);
  specs.push({
    type: 'lampPlanet',
    position: [x, 0, z],
    rotation: [0, 2.5, 0],
    scale: 2.2,
  });

  // 반대편에 떠 있는 작은 소행성
  const [ax, az] = ringPoint(matrixSize, 128, 8);
  specs.push({
    type: 'asteroid',
    position: [ax, 1.5, az],
    rotation: [0.3, 0.8, 0.2],
    scale: 1.6,
  });

  // 탑다운에서도 남는 낮은 풍경 — 바닥에 내려앉은 잔별
  for (let i = 0; i < 30; i += 1) {
    const angle = (360 / 30) * i + rand() * 8;
    const [gx, gz] = squareRingPoint(matrixSize, angle, 1.2 + rand() * 4.8);
    specs.push({
      type: 'groundStar',
      position: [gx, 0, gz],
      rotation: [0, rand() * Math.PI, 0],
      scale: 1.1 + rand() * 1.1,
      persistent: true,
    });
  }

  return specs;
}

export function placeLandmarks(matrixSize, matrix) {
  const entries = [
    {
      title: '가로등이 비치는 자리',
      message: '불빛이 닿는 데까지가 오늘 걸을 수 있는 거리입니다.',
      color: '#FFD972',
    },
    {
      title: '별이 내려앉은 곳',
      message: '바닥에 잔별 하나가 굴러다닙니다.',
      color: '#FFFFFF',
    },
    {
      title: '소행성이 지나간 자리',
      message: '머리 위로 조용히 하나가 지나갔습니다.',
      color: '#8FA6E0',
    },
    {
      title: '가장 어두운 골목',
      message: '여기서는 별이 제일 잘 보입니다.',
      color: '#5A72C4',
    },
    {
      title: '높은 별기둥 위',
      message: '점프해서 올라가면 은하수가 발밑에 깔립니다.',
      color: '#FFE9A8',
    },
    {
      title: '불 꺼진 자리',
      message: '누군가 방금 등불을 껐습니다.',
      color: '#F5A8C0',
    },
  ];

  return pickWalkableCells(matrixSize, matrix, entries.length, 53).map(
    (point, i) => ({ ...entries[i], ...point })
  );
}

export function buildDecoration(spec) {
  switch (spec.type) {
    case 'lampPlanet':
      return buildLampPlanet();
    case 'asteroid':
      return buildAsteroid();
    case 'farStar':
      return buildFarStar(spec.color || PALETTE.accent);
    case 'moon':
      return buildMoon();
    case 'groundStar':
      return buildGroundStar();
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* 오브젝트                                                            */
/* ------------------------------------------------------------------ */

/** 작은 행성 + 그 위에 켜진 가로등 (인물 없음) */
function buildLampPlanet() {
  const planetMat = flatMaterial('#41599E', { emissive: '#131E44' });
  const postMat = flatMaterial('#D6DEF5');
  const glassMat = glowMaterial('#FFE9A8', { opacity: 0.95, transparent: true });
  const haloMat = glowMaterial('#FFD972', {
    opacity: 0.18,
    depthWrite: false,
  });

  const planet = blob(2.0, 1, planetMat, [0, 0.9, 0]);

  const post = cylinder(0.07, 0.1, 2.4, 6, postMat, [0, 3.9, 0]);
  const foot = cylinder(0.24, 0.3, 0.16, 8, postMat, [0, 2.78, 0]);
  const arm = box(0.62, 0.07, 0.07, postMat, [0.28, 5.06, 0]);

  const lantern = group(
    cone(0.26, 0.3, 6, postMat, [0.55, 5.14, 0]),
    box(0.3, 0.34, 0.3, glassMat, [0.55, 4.79, 0]),
    cone(0.2, 0.16, 6, postMat, [0.55, 4.55, 0])
  );

  const halo = blob(0.85, 1, haloMat, [0.55, 4.8, 0]);

  const flowers = group(
    blob(
      0.13,
      0,
      glowMaterial('#F5A8C0', { transparent: false }),
      [1.15, 2.35, 0.5]
    ),
    blob(0.1, 0, glowMaterial('#F5A8C0', { transparent: false }), [-1.0, 2.3, -0.7])
  );

  return group(planet, foot, post, arm, lantern, halo, flowers);
}

/** 떠 있는 작은 소행성 */
function buildAsteroid() {
  const rockMat = flatMaterial('#4C63A8', { emissive: '#141F44' });
  const rock = blob(1.1, 0, rockMat, [0, 0, 0]);
  rock.scale.set(1.2, 0.8, 1);
  const cap = blob(0.42, 0, flatMaterial('#7C92D6'), [0.3, 0.7, -0.2]);
  return group(rock, cap);
}

function buildFarStar(color) {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.5, 0),
    glowMaterial(color, { opacity: 0.9, depthWrite: false })
  );
  return group(mesh);
}

function buildMoon() {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28),
    glowMaterial('#FBF3DC', { opacity: 0.97 })
  );
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 28),
    glowMaterial('#FFD972', { opacity: 0.16, depthWrite: false })
  );
  halo.position.z = -0.05;

  const g = group(halo, disc);
  g.userData.billboard = true;
  return g;
}

/** 탑다운에서도 남는, 바닥에 내려앉은 잔별 */
function buildGroundStar() {
  const mat = glowMaterial('#FFD972', { opacity: 0.85, transparent: true });
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), mat);
  star.scale.set(1, 0.5, 1);
  star.position.y = 0.16;
  return group(star);
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
  getRevealLighting,
  getCurvature,
  buildDecoration,
};
