/**
 * themes/moreumpyoExpedition.js — 8) 모름표 탐험대
 * ---------------------------------------------------------------------------
 * 창작뮤지컬 「모름표 탐험대」의 물음표 월드.
 *
 * 이 세계에서는 현실의 누군가가 궁금증을 하나 떠올릴 때마다 질문이 하나 태어나고,
 * 태어난 질문은 자기만의 문을 하나씩 갖는다. 문을 열면 길이 펼쳐지고, 질문은
 * 그 길을 따라 자기 답을 찾아 여행한다. 답이 어디 있는지는 아무도 모른다.
 *
 * 이 맵의 시간은 2막 3장 이후 — 답이 사라진 위기를 지나, 회색 천을 높이 걸어
 * '몰라 정류장'을 만들고 질문들이 다시 움직이기 시작한 시점이다.
 * 그러나 답이 돌아온 것은 아니다. 왕관을 받을 질문도 아직 없고, 아기 질문의
 * 문도 여전히 열리지 않는다. 그래서 이 맵은 해결된 유토피아도, 회색 폐허도
 * 아니다. "아직 모르는 것이 많지만 다시 움직이기 시작한 밝은 세계" 다.
 *
 * 공간 해석
 *   light 모듈 = 탐험길. 질문들이 실제로 걸어가는 낮고 밝은 크림빛 길.
 *   dark 모듈  = 질문 지형. 길 사이의 높고 낮은 언덕.
 *
 * 지형 높이는 Explorer 실측값에서 역산했다. 길(0.40)에서 점프하면 약 1.68 까지
 * 닿으므로, 지터로 흔들린 언덕 중 낮은 것은 기어오를 수 있고 높은 것은 벽이 된다.
 * 덕분에 QR 매트릭스를 그대로 두고도 "갈림길을 만나고, 벽을 돌아가고, 때로는
 * 막힌 길을 만나 다른 경로를 찾는" 답과의 술래잡기가 생긴다.
 *
 * 팔레트: 페리윈클 질문 지형 + 따뜻한 크림 탐험길 + 몰라 정류장의 앰버
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
  squareRingPoint,
  pickConnectedCells,
  makeRandom,
} from './_shared.js';

export const meta = {
  id: 'moreumpyo-expedition',
  label: '모름표 탐험대',
  caption: '물음표와 마침표 사이의 여행',
  swatch: ['#7C8CC8', '#B0A4EC', '#F2B45F'],
};

const PALETTE = {
  /* 3D 씬 */
  // 페리윈클(청보라)은 여덟 테마 중 아무도 쓰지 않던 자리다. 제안받은 블루그레이
  // #6E8FB8 은 '감자마켓'의 시안, '도시의 밤'의 남색과 같은 계열이라 비켰다.
  // 하늘도 처음엔 연한 하늘색으로 뒀다가 '숲 속의 쉼'(#A8D4E8)과 RGB 거리 25 밖에
  // 안 나와 라벤더 쪽으로 더 밀었다(거리 49). 기존 테마끼리의 최소 거리가 48 이다.
  dark: '#7C8CC8', // 질문 지형 — 높고 낮은 언덕
  darkEmissive: '#1B2140',
  light: '#FFF9C4', // 탐험길 — 옅은 버터크림
  // 바닥을 길과 같은 크림으로 두었더니 화면 대부분이 노란 한 덩어리가 되어
  // 라벤더 세계가 읽히지 않았다. 옅은 라벤더그레이로 내려 하늘과 묶고,
  // 밝은 버터크림 탐험길이 그 위에서 또렷하게 떠오르게 한다.
  ground: '#CFC9E0',
  groundEmissive: '#171626',
  sky: '#B0A4EC', // 연한 라벤더 하늘
  accent: '#F2B45F', // 몰라 정류장의 따뜻한 앰버

  /* 탑다운 스캔 뷰 (대비 10.1:1) — 크림 종이 위의 청보라 지도 */
  scanDark: '#2E3566',
  scanLight: '#FBF7EA',
  scanGround: '#E2D9A8',
  scanShadow: '#6A6E96',
};

/* 질문의 문 색 — 무지개처럼 흩뿌리지 않고 일곱 색만 돌려 쓴다 */
const DOOR_COLORS = [
  '#6FB6E8', // 스카이블루
  '#F08A72', // 코랄
  '#F2C75C', // 옐로
  '#6FC9AE', // 민트
  '#A98CD8', // 라일락
  '#F09BB8', // 핑크
  '#5FAFB0', // 청록
];

const CLOTH_GRAY = '#8B8E96'; // 몰라의 회색 천
const SPROUT_GREEN = '#7EBB6A';
const CROWN_GOLD = '#F5C64E'; // 마침표 왕관
const WARM_LIGHT = '#FFE3B0';
const STONE = '#A8A79E';
const WOOD = '#B08A5E';

export function getPalette() {
  return { ...PALETTE };
}

/** 작은 행성이 아니다. 여러 문과 길의 관계가 읽혀야 하므로 평면으로 둔다. */
export function getCurvature() {
  return 0;
}

/**
 * 질문 지형의 높이 사다리.
 *
 * 처음에는 엔진의 무작위 지터에 맡겼는데, 셀마다 높이가 제멋대로라 길(0.40)과
 * 언덕(1.16~) 사이가 텅 비어 버렸다. 그래서 실제로 걸어 보면 어디도 "올라가는"
 * 느낌이 없고 그냥 평지와 벽만 있었다.
 *
 * 이제 높이를 무작위가 아니라 설계한다. Explorer 의 stepHeight 는 0.58 이므로
 * 한 단을 0.52 로 잡으면 **걸어서** 한 칸씩 올라갈 수 있다.
 *
 *   길      0.40
 *   1단     0.92   (+0.52 — 걸어서 올라감)
 *   2단     1.44   (+0.52 — 걸어서 올라감)
 *   3단/단상 1.96  (+0.52 — 걸어서 올라감)
 *   벽      2.60~3.00  (3단에서 +0.64 이상이라 걸어서는 못 오르고 점프해야 한다)
 *
 * 실측한 점프 도달력은 단발 +1.80 / 삼단 +3.52 이므로, 벽도 마음먹으면 오를 수
 * 있지만 계단은 아무 조작 없이 걸어 올라간다.
 */
const TERRAIN = {
  path: 0.4,
  step1: 0.92,
  step2: 1.44,
  step3: 1.96,
  wallMin: 2.6,
  wallMax: 3.0,
};

/** 계단이 몇 군데 생길지 — 성능이 아니라 "특별함" 때문에 제한한다 */
const STAIRWAY_COUNT = 14;
/** 길가에 놓이는 낮은 단(테이블) 수 */
const PLATFORM_COUNT = 14;

/** 지형 설계는 매트릭스마다 한 번만 계산해 재사용한다 */
let terrainCache = { size: -1, matrix: null, plan: null };

/**
 * 어느 칸을 계단으로, 어느 칸을 낮은 단으로 만들지 정한다.
 *
 * 계단은 길에 면한 언덕에서 시작해 **안쪽으로** 세 칸 올라간다. 그래서 길을 걷다
 * 계단을 만나면 그대로 걸어 올라가 지형 위에 설 수 있다.
 *
 * @returns {Map<number, number>} 셀 인덱스 → 목표 높이
 */
function buildTerrainPlan(matrix, size) {
  if (terrainCache.size === size && terrainCache.matrix === matrix) {
    return terrainCache.plan;
  }

  const at = (row, col) => row * size + col;
  const plan = new Map();

  // 길에 면한 언덕과, 거기서 지형 안쪽으로 들어가는 방향
  const STEPS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const edges = [];
  for (let row = 2; row < size - 2; row += 1) {
    for (let col = 2; col < size - 2; col += 1) {
      if (!matrix[row][col]) continue;
      for (const [dr, dc] of STEPS) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
        if (matrix[nr][nc]) continue;
        // 길이 (nr,nc) 쪽에 있으니 오르는 방향은 그 반대다
        edges.push({ row, col, inDr: -dr, inDc: -dc });
        break;
      }
    }
  }

  const rand = makeRandom(size * 331 + 17);
  const used = [];
  const farEnough = (row, col, gap) =>
    used.every((u) => Math.hypot(u.row - row, u.col - col) >= gap);

  // 1) 계단 — 길에서 시작해 안쪽으로 세 단
  const ladder = [TERRAIN.step1, TERRAIN.step2, TERRAIN.step3];
  let placedStairs = 0;
  let gap = Math.max(size / 6, 4);
  while (placedStairs < STAIRWAY_COUNT && gap >= 2) {
    let placed = false;
    for (let attempt = 0; attempt < 300 && edges.length; attempt += 1) {
      const e = edges[Math.floor(rand() * edges.length)];
      if (!e || plan.has(at(e.row, e.col)) || !farEnough(e.row, e.col, gap)) continue;

      // 안쪽으로 이어지는 칸이 계속 언덕이어야 계단이 성립한다
      const run = [];
      let r = e.row;
      let c = e.col;
      for (let i = 0; i < ladder.length; i += 1) {
        if (r < 0 || c < 0 || r >= size || c >= size) break;
        if (!matrix[r][c] || plan.has(at(r, c))) break;
        run.push([r, c]);
        r += e.inDr;
        c += e.inDc;
      }
      if (run.length < 2) continue; // 두 단은 되어야 계단이다

      run.forEach(([rr, cc], i) => plan.set(at(rr, cc), ladder[i]));
      used.push({ row: e.row, col: e.col, kind: 'stair', dr: e.inDr, dc: e.inDc });
      placedStairs += 1;
      placed = true;
      break;
    }
    if (!placed) gap -= 1;
  }

  // 2) 낮은 단 — 길가에 놓인 테이블처럼, 걸어서 바로 올라설 수 있는 한 칸
  let placedPlatforms = 0;
  gap = Math.max(size / 7, 3);
  while (placedPlatforms < PLATFORM_COUNT && gap >= 2) {
    let placed = false;
    for (let attempt = 0; attempt < 300 && edges.length; attempt += 1) {
      const e = edges[Math.floor(rand() * edges.length)];
      if (!e || plan.has(at(e.row, e.col)) || !farEnough(e.row, e.col, gap)) continue;
      plan.set(at(e.row, e.col), TERRAIN.step1);
      used.push({ row: e.row, col: e.col, kind: 'platform' });
      placedPlatforms += 1;
      placed = true;
      break;
    }
    if (!placed) gap -= 1;
  }

  terrainCache = { size, matrix, plan, marks: used };
  return plan;
}

/** 계단·단의 위치를 장식 배치에서도 쓰기 위해 꺼낸다 */
function getTerrainMarks(matrix, size) {
  buildTerrainPlan(matrix, size);
  return terrainCache.marks || [];
}

/**
 * 능선에 대하여.
 *
 * 계단 꼭대기(1.96)에서 벽(2.60~3.00)까지는 걸어서는 못 오르지만 점프 한 번이면
 * 닿는다(실측 도달 +1.80). 그리고 벽끼리의 높이차는 0.40 이내라 일단 올라서면
 * 능선을 따라 걸어 다닐 수 있다. 계단을 찾아 올라가 한 번 뛰면 질문 지형 위에서
 * 세계 전체를 내려다볼 수 있다 — 이것이 이 지형의 보상이다.
 */

/**
 * 셀 높이를 테마가 직접 정한다.
 * 엔진은 이 값으로 렌더 높이와 충돌 높이를 함께 만들므로, 보이는 계단이
 * 실제로 밟히는 계단이 된다.
 */
export function getCellScale({ col, row, isDark, matrix, size }) {
  if (!isDark) return 1; // 길은 평평해야 걸어 다닐 수 있다

  const blockHeight = 2.0; // getBlockGeometry(true).height 와 같은 값
  const plan = buildTerrainPlan(matrix, size);
  const planned = plan.get(row * size + col);
  if (planned !== undefined) return planned / blockHeight;

  // 나머지는 벽. 결정론적으로 조금씩 높이를 달리해 능선이 밋밋하지 않게 한다.
  const n = Math.abs(Math.sin(col * 127.1 + row * 311.7) * 43758.5453) % 1;
  return (TERRAIN.wallMin + n * (TERRAIN.wallMax - TERRAIN.wallMin)) / blockHeight;
}

/** 1인칭에서 언덕 경계가 보이도록 */
export function getColorVariation() {
  return 0.18;
}

/** 언덕은 기둥이 아니라 이어진 지형으로 보여야 한다 */
export function getBlockSpread() {
  return 0.96;
}

export function getBlockGeometry(isDark) {
  if (isDark) {
    return {
      geometry: createHillGeometry(0.86),
      material: flatMaterial(PALETTE.dark, { emissive: PALETTE.darkEmissive }),
      // 도시의 밤(3.4)이나 감자마켓(2.6)보다 낮게 잡아 1인칭 시야를 틔운다
      height: 2.0,
    };
  }
  return {
    // 길은 정확한 정사각 타일 — 발밑이 매끈해야 걸어 다닐 수 있다
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: flatMaterial(PALETTE.light, { emissive: '#2A2618' }),
    height: 0.4,
  };
}

/**
 * 언덕 실루엣. 윗면을 좁혀 각진 블록이 아니라 둔덕처럼 보이게 한다.
 * 엔진이 밑면 1×1 로 정규화하므로 바닥은 정확히 맞물린다.
 */
function createHillGeometry(topScale) {
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

/** 1인칭 탐험 중 보조 조명 — 밝은 낮이라 언덕 그늘만 살짝 보정한다 */
export function getPlayerLight() {
  return 0.35;
}

/**
 * 탑다운 스캔 뷰의 모듈 색 후보.
 * 질문 지형의 청보라를 주조로, 문 색 몇 가지를 드문 포인트로 섞는다.
 *
 * 엔진이 이 색들의 명도만 스캔 안전 대역으로 끌어당기고 색상은 그대로 둔다.
 * 덕분에 QR 이 단색 검정이 아니라 3D 씬과 같은 색 계열의 모자이크가 된다.
 */
export function getScanColors() {
  return {
    dark: ['#7C8CC8', '#7C8CC8', '#6F7EBE', '#8A83CC', '#5F86C0', '#8B8E96'],
    light: ['#FFF9C4', '#FFF9C4', '#FDF6CE', '#FBF3BC', '#FEF8CE'],
  };
}

export function getBackgroundSetup() {
  const rand = makeRandom(20260828);
  const clouds = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6 + rand() * 0.7;
    const radius = 155 + rand() * 85;
    clouds.push({
      type: 'softCloud',
      position: [
        Math.sin(angle) * radius,
        46 + rand() * 30,
        Math.cos(angle) * radius,
      ],
      scale: 8 + rand() * 6,
    });
  }

  return {
    background: PALETTE.sky,
    // 회복이 시작된 밝은 세계다. 안개는 옅게, 멀리만 건다.
    fog: { color: '#D2CBF3', near: 86, far: 210 },
    lights: [
      { type: 'hemisphere', sky: '#EAF2FF', ground: '#A79E88', intensity: 2.0 },
      {
        type: 'directional',
        color: '#FFF6E2',
        intensity: 2.3,
        position: [-26, 48, 30],
      },
      { type: 'ambient', color: '#DCE4F5', intensity: 0.9 },
    ],
    objects: [...clouds, { type: 'daySun', position: [58, 38, -114], scale: 9 }],
  };
}

/* ------------------------------------------------------------------ */
/* 배치                                                                */
/* ------------------------------------------------------------------ */

/** 각도 A(0° = +Z) 에 놓인 오브젝트가 세계 중심을 바라보게 하는 회전값 */
function facingCenter(angleDeg) {
  return (angleDeg * Math.PI) / 180 + Math.PI;
}

export function placeDecorations(matrixSize, matrix) {
  const rand = makeRandom(matrixSize * 149 + 61);
  const specs = [];

  /* --- 큰 장면들 (전환 중 사라진다) --------------------------------- */
  //
  // solid: true 인 장식은 실제로 밟히고 막히는 지형이 된다. 단상과 바위 위에는
  // 올라설 수 있고, 문과 기둥은 통과하지 못한다. 천막 지붕처럼 머리 위에 있는
  // 부분은 엔진이 알아서 제외하므로 정류장 아래로는 걸어 들어갈 수 있다.

  // 0° — 마침표 왕관 수여식장. 오늘 왕관을 받을 질문은 없다.
  const [cx, cz] = squareRingPoint(matrixSize, 0, 5.5);
  specs.push({
    type: 'crownCeremony',
    solid: true,
    position: [cx, 0, cz],
    rotation: [0, facingCenter(0), 0],
    scale: 1.5,
  });

  // 그 뒤 — 마침표 월드로 가는 큰 문. 아직 도달하지 못한 목적지라
  // 활짝 열린 포털이 아니라 닫힌 채 틈으로만 빛이 샌다.
  const [gx, gz] = squareRingPoint(matrixSize, 0, 10);
  specs.push({
    type: 'fullStopGate',
    solid: true,
    position: [gx, 0, gz],
    rotation: [0, facingCenter(0), 0],
    scale: 2.0,
  });

  // 200° — 몰라 정류장 광장. 회색 천을 높이 걸고 그 아래에서 함께 쉰다.
  const [mx, mz] = squareRingPoint(matrixSize, 200, 6.5);
  specs.push({
    type: 'mollaStopPlaza',
    solid: true,
    position: [mx, 0, mz],
    rotation: [0, facingCenter(200), 0],
    scale: 1.6,
  });

  // 110° — 코끼리 모양 바위. 서로 다른 두 길이 이어짐을 알아낸 기준점.
  const [ex, ez] = squareRingPoint(matrixSize, 110, 6);
  specs.push({
    type: 'elephantRockScene',
    solid: true,
    position: [ex, 0, ez],
    rotation: [0, facingCenter(110) + 0.4, 0],
    scale: 1.5,
  });

  // 285° — 아기 질문의 작은 문. 가장 조용한 자리에 둔다.
  const [bx, bz] = squareRingPoint(matrixSize, 285, 7);
  specs.push({
    type: 'babyDoorScene',
    solid: true,
    position: [bx, 0, bz],
    rotation: [0, facingCenter(285), 0],
    scale: 1.4,
  });

  // 지난 위기의 흔적 — 아무도 보지 않는 낡은 안내판
  const [sx, sz] = squareRingPoint(matrixSize, 245, 4.4);
  specs.push({
    type: 'oldSignpost',
    solid: true,
    position: [sx, 0, sz],
    rotation: [0, facingCenter(245) - 0.6, 0],
    scale: 1.2,
  });

  // 외곽에도 질문의 문 몇 개 — 세계가 QR 판 안에서 끝나지 않게
  for (let i = 0; i < 7; i += 1) {
    const angle = 30 + i * 47 + rand() * 9;
    const [dx, dz] = squareRingPoint(matrixSize, angle, 4.6 + rand() * 3.4);
    specs.push({
      type: 'questionDoor',
      solid: true,
      position: [dx, 0, dz],
      rotation: [0, facingCenter(angle) + (rand() - 0.5) * 0.6, 0],
      scale: 1.3 + rand() * 0.5,
      doorColor: DOOR_COLORS[i % DOOR_COLORS.length],
      // 이 시점에도 모든 문이 열린 것은 아니다
      ajar: rand() > 0.55,
    });
  }

  /* --- 낮은 풍경 (탑다운에서도 남는다) ------------------------------ */
  //
  // persistent 는 반드시 squareRingPoint 위에만 둔다. 원형 링은 대각선에서
  // QR 판 위로 올라오므로 스캔을 방해한다.

  const sceneryTypes = [
    'sprout',
    'sprout',
    'seed',
    'pathMarker',
    'smallStone',
    'birthSpark',
  ];

  for (let i = 0; i < 30; i += 1) {
    const angle = (360 / 30) * i + rand() * 9;
    const [ox, oz] = squareRingPoint(matrixSize, angle, 1.5 + rand() * 4.2);
    specs.push({
      type: sceneryTypes[Math.floor(rand() * sceneryTypes.length)],
      position: [ox, 0, oz],
      rotation: [0, rand() * Math.PI * 2, 0],
      scale: 0.85 + rand() * 0.5,
      persistent: true,
    });
  }

  /* --- 복도에 면한 언덕 위의 질문 문 --------------------------------- */
  //
  // 질문마다 자기 문이 하나씩 있지만, 셀마다 문을 세우면 53×53 에서 오브젝트가
  // 수백 개로 폭증한다. 그래서 "길에 면한 언덕"(light 이웃이 하나 이상인 dark
  // 셀)만 추린 뒤 결정론적으로 정확히 16개만 고른다. QR 크기와 무관하게 개수가
  // 고정되고, 문이 지형 안쪽에 파묻히지 않고 반드시 길에서 보인다.

  if (matrix) {
    for (const door of pickCorridorDoors(matrixSize, matrix, 16)) {
      specs.push({
        type: 'wallDoor',
        solid: true,
        position: [door.x, 0, door.z],
        rotation: [0, door.facing, 0],
        scale: 0.9,
        doorColor: door.color,
        ajar: door.ajar,
        glowing: door.glowing,
        snapToGround: true,
      });
    }
  }

  /* --- 계단과 단의 표식 ---------------------------------------------- */
  //
  // 높이만 낮춰 두면 "여기로 올라갈 수 있다" 는 것이 눈에 보이지 않는다.
  // snapToGround 로 실제 지형 높이에 정확히 붙는 표식을 얹어 오르는 길을 알린다.

  if (matrix) {
    for (const mark of getTerrainMarks(matrix, matrixSize)) {
      const x = mark.col - (matrixSize - 1) / 2;
      const z = mark.row - (matrixSize - 1) / 2;
      if (mark.kind === 'stair') {
        specs.push({
          type: 'stairRail',
          position: [x, 0, z],
          // 오르는 방향을 바라보게 세운다
          rotation: [0, Math.atan2(mark.dc, mark.dr), 0],
          scale: 1,
          snapToGround: true,
        });
      } else {
        specs.push({
          type: 'platformMark',
          position: [x, 0, z],
          rotation: [0, rand() * Math.PI * 2, 0],
          scale: 1,
          snapToGround: true,
        });
      }
    }
  }

  return specs;
}

/**
 * 길에 면한 언덕을 골라 그 위에 세울 문의 자리와 방향을 정한다.
 *
 * @param {number} matrixSize
 * @param {boolean[][]} matrix
 * @param {number} count
 * @returns {{x:number, z:number, facing:number, color:string, ajar:boolean, glowing:boolean}[]}
 */
function pickCorridorDoors(matrixSize, matrix, count) {
  const N = matrixSize;
  const STEPS = [
    [-1, 0, Math.PI], // 위쪽(-row)이 길이면 문은 -Z 를 본다
    [1, 0, 0],
    [0, -1, -Math.PI / 2],
    [0, 1, Math.PI / 2],
  ];

  const walls = [];
  for (let row = 2; row < N - 2; row += 1) {
    for (let col = 2; col < N - 2; col += 1) {
      if (!matrix[row][col]) continue;
      for (const [dr, dc, facing] of STEPS) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
        if (matrix[nr][nc]) continue;
        walls.push({
          x: col - (N - 1) / 2,
          z: row - (N - 1) / 2,
          facing,
        });
        break; // 한 언덕에 문은 하나
      }
    }
  }

  if (!walls.length) return [];

  const rand = makeRandom(N * 613 + 7);
  const step = Math.max(Math.floor(walls.length / count), 1);
  const doors = [];
  for (let i = 0; i < walls.length && doors.length < count; i += step) {
    const wall = walls[i];
    doors.push({
      ...wall,
      color: DOOR_COLORS[doors.length % DOOR_COLORS.length],
      // 닫힌 문이 더 많다. 이 시점에도 모든 질문이 다시 길을 나선 것은 아니다.
      ajar: rand() > 0.66,
      // 문 너머에서 빛이 새어 나오는 문은 아주 드물게
      glowing: rand() > 0.86,
    });
  }
  return doors;
}

/**
 * 탐험 중 만나는 여섯 장면.
 *
 * 몰라 정류장과 코끼리 바위는 "여러 길이 만나는 곳" 이어야 의미가 산다.
 * 그래서 매트릭스에서 차수(상하좌우로 이어지는 길의 수)가 3 이상인 교차로만
 * 골라 놓는다. 우연에 맡기지 않고 계산으로 보장한다.
 */
export function placeLandmarks(matrixSize, matrix) {
  if (!matrix) return [];

  const junctionEntries = [
    {
      type: 'mollaStop',
      title: '몰라 정류장',
      message: '어디로 갈지는 몰라도, 여기서는 잠깐 함께 쉬어가도 됩니다.',
      color: PALETTE.accent,
    },
    {
      type: 'elephantRock',
      title: '코끼리 모양 바위',
      message: '혼자 걸을 때는 몰랐던 길이, 서로의 이야기 속에서 이어졌습니다.',
      color: STONE,
    },
  ];

  const pathEntries = [
    {
      type: 'birthPoint',
      title: '새로운 질문의 탄생점',
      message: '누군가의 궁금증 하나가, 또 하나의 여행을 시작했습니다.',
      color: '#9FD8F5',
    },
    {
      type: 'ownDoor',
      title: '자기만의 문',
      message: '모든 질문에게는 자기만의 문이 하나씩 있습니다.',
      color: DOOR_COLORS[0],
    },
    {
      type: 'waitingCrown',
      title: '주인을 기다리는 마침표 왕관',
      message: '왕관은 아직 다음 질문을 기다리고 있습니다.',
      color: CROWN_GOLD,
    },
    {
      type: 'babyDoor',
      title: '아기 질문의 닫힌 문',
      message: '오늘은 열리지 않았습니다. 내일 다시 와보면 달라질지도 몰라요.',
      color: WARM_LIGHT,
    },
  ];

  // 먼저 교차로 두 곳, 그다음 나머지를 그 자리들과 떨어뜨려 고른다
  const junctions = pickConnectedCells(matrixSize, matrix, 2, 53, {
    minDegree: 3,
  });
  const rest = pickConnectedCells(matrixSize, matrix, 4, 57, {
    exclude: junctions,
  });

  const placed = [];
  junctions.forEach((point, i) => {
    if (junctionEntries[i]) {
      placed.push({ ...junctionEntries[i], x: point.x, z: point.z });
    }
  });
  rest.forEach((point, i) => {
    if (pathEntries[i]) {
      placed.push({ ...pathEntries[i], x: point.x, z: point.z });
    }
  });
  return placed;
}

/* ------------------------------------------------------------------ */
/* 애니메이션                                                          */
/* ------------------------------------------------------------------ */

/**
 * 아주 절제된 움직임만 둔다.
 *
 * 엔진은 theme.update 가 있으면 매 프레임 그림자맵을 다시 굽는다. 그 비용은
 * 훅의 존재 자체에서 오므로 오브젝트를 몇 개 움직이든 같다. 대신 프레임 안에서는
 * 스칼라 연산만 쓰고 할당은 하지 않는다.
 *
 * 발광 맥동을 opacity 가 아니라 색 밝기로 만드는 이유: 엔진은 3D→QR 전환 중
 * _fadeGroup 으로 decorGroup 의 material.opacity 를 직접 덮어쓴다. 여기서
 * opacity 를 매 프레임 쓰면 페이드아웃과 싸워 장식이 스캔 뷰에 남는다.
 */
export function update(dt, { elapsed, decorGroup, sceneryGroup }) {
  for (const obj of [...decorGroup.children, ...sceneryGroup.children]) {
    const kind = obj.userData.kind;
    if (!kind) continue;

    switch (kind) {
      case 'crownCeremony':
      case 'waitingCrown': {
        // 왕관은 주인 없이 아주 느리게 떠 있다
        const crown = obj.getObjectByName('crown');
        if (crown) {
          crown.rotation.y = elapsed * 0.32;
          crown.position.y = crown.userData.baseY + Math.sin(elapsed * 0.9) * 0.06;
        }
        break;
      }

      case 'mollaStopPlaza':
      case 'mollaStop': {
        // 높이 걸린 회색 천이 아주 미세하게 흔들린다 (천 시뮬레이션은 쓰지 않는다)
        const cloth = obj.getObjectByName('cloth');
        if (cloth) {
          cloth.rotation.z = cloth.userData.baseRotZ + Math.sin(elapsed * 0.6) * 0.02;
          cloth.rotation.x = cloth.userData.baseRotX + Math.sin(elapsed * 0.43) * 0.015;
        }
        break;
      }

      case 'babyDoorScene':
      case 'babyDoor': {
        // 닫힌 문 곁의 작고 조용한 빛
        pulseGlow(obj.getObjectByName('door-glow'), elapsed, 0.55, 0.22);
        break;
      }

      case 'birthPoint': {
        // 새 질문이 태어나는 자리의 작은 빛 입자
        const motes = obj.getObjectByName('birth-motes');
        if (motes) {
          motes.rotation.y = elapsed * 0.5;
          motes.position.y = 0.3 + Math.sin(elapsed * 1.2) * 0.08;
        }
        break;
      }

      case 'ownDoor':
      case 'questionDoor': {
        // 문틈으로 새어 나오는 빛이 숨 쉬듯 변한다
        pulseGlow(obj.getObjectByName('door-glow'), elapsed, 0.8, 0.3);
        break;
      }

      default:
        break;
    }
  }
}

/** 발광 세기만 사인파로 흔든다 (opacity 가 아니라 색 밝기) */
function pulseGlow(mesh, elapsed, speed, depth) {
  if (!mesh) return;
  const base = mesh.userData.baseColor;
  if (!base) return;
  const k = 1 - depth + depth * (Math.sin(elapsed * speed) * 0.5 + 0.5);
  mesh.material.color.copy(base).multiplyScalar(k);
}

/** 맥동시킬 발광체에 원래 색을 물려 둔다 (프레임 중 할당을 없애기 위해) */
function primeGlow(mesh, name) {
  mesh.name = name;
  mesh.userData.baseColor = mesh.material.color.clone();
  return mesh;
}

/* ------------------------------------------------------------------ */
/* 디스패치                                                            */
/* ------------------------------------------------------------------ */

export function buildDecoration(spec) {
  switch (spec.type) {
    case 'crownCeremony':
      return buildCrownCeremony();
    case 'fullStopGate':
      return buildFullStopGate();
    case 'mollaStopPlaza':
      return buildMollaStopPlaza();
    case 'elephantRockScene':
      return buildElephantRockScene();
    case 'babyDoorScene':
      return buildBabyDoorScene();
    case 'oldSignpost':
      return buildOldSignpost();
    case 'questionDoor':
      return buildQuestionDoor(spec, 1.6);
    case 'wallDoor':
      return buildQuestionDoor(spec, 1.15);
    case 'stairRail':
      return buildStairRail();
    case 'platformMark':
      return buildPlatformMark();

    /* 배경 */
    case 'daySun':
      return buildDaySun();
    case 'softCloud':
      return buildSoftCloud();

    /* 낮은 풍경 */
    case 'sprout':
      return buildSprout();
    case 'seed':
      return buildSeed();
    case 'pathMarker':
      return buildPathMarker();
    case 'smallStone':
      return buildSmallStone();
    case 'birthSpark':
      return buildBirthSpark();

    default:
      return null;
  }
}

export function buildLandmark(spec) {
  switch (spec.type) {
    case 'mollaStop':
      return buildMollaStopSmall();
    case 'elephantRock':
      return buildElephantRockSmall();
    case 'birthPoint':
      return buildBirthPoint();
    case 'ownDoor':
      return buildOwnDoor();
    case 'waitingCrown':
      return buildWaitingCrown();
    case 'babyDoor':
      return buildBabyDoorSmall();
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* 질문의 문                                                           */
/* ------------------------------------------------------------------ */

/**
 * 질문의 문.
 *
 * 이 세계에서 문은 장식이 아니라 "질문이 자기 탐험을 시작할 수 있는 가능성" 이다.
 * 낮은 프레임 + 문짝 + 작은 손잡이, 그리고 열린 문에서는 문 너머로 빛이 샌다.
 *
 * @param {object} spec
 * @param {number} height 문 높이
 */
function buildQuestionDoor(spec, height) {
  const color = spec.doorColor || DOOR_COLORS[0];
  const frameMat = flatMaterial(WOOD);
  const panelMat = flatMaterial(color, { emissive: '#0E1020' });

  const w = height * 0.62;
  const t = height * 0.09;

  const g = group();

  // 문틀
  g.add(box(t, height, t, frameMat, [-w / 2, height / 2, 0]));
  g.add(box(t, height, t, frameMat, [w / 2, height / 2, 0]));
  g.add(box(w + t, t, t, frameMat, [0, height + t / 2, 0]));

  // 문짝 — 살짝 열린 문은 경첩을 축으로 돌려 둔다
  const leaf = group();
  const panel = box(w, height, t * 0.55, panelMat, [w / 2, height / 2, 0]);
  leaf.add(panel);
  // 손잡이
  leaf.add(
    blob(height * 0.05, 0, flatMaterial('#EFE6D2'), [w * 0.86, height * 0.5, t * 0.4])
  );
  leaf.position.x = -w / 2;
  if (spec.ajar) leaf.rotation.y = 0.62;
  g.add(leaf);

  // 문 너머에서 새어 나오는 빛
  if (spec.ajar || spec.glowing) {
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.8, height * 0.86),
      glowMaterial(WARM_LIGHT, { opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })
    );
    glow.position.set(0, height * 0.45, -t * 0.4);
    g.add(primeGlow(glow, 'door-glow'));
    // 빛이 숨 쉬는 것은 '빛이 새어 나오는' 드문 문에서만.
    // 살짝 열린 문까지 전부 애니메이션하면 대상이 30개를 넘는다.
    if (spec.glowing) g.userData.kind = 'questionDoor';
  }

  // 문 앞의 작은 새싹 — 질문은 계속 자란다
  const sprout = buildSprout();
  sprout.position.set(w * 0.72, 0, t * 1.8);
  sprout.scale.setScalar(0.7);
  g.add(sprout);

  return g;
}

/**
 * 계단 난간.
 *
 * 계단 자체는 지형(블록 높이)이 만든다. 이 난간은 "여기로 올라갈 수 있다" 는
 * 것을 멀리서도 알아보게 하는 표식이다. 오르는 방향을 향해 선다.
 */
function buildStairRail() {
  const railMat = flatMaterial(WOOD);

  // 난간을 양옆으로 세우면 계단 하나에 메시가 아홉 개가 되어 드로우콜이 크게
  // 늘었다. 오르는 입구를 알리는 작은 문틀 하나면 같은 뜻이 전달된다.
  const postL = cylinder(0.05, 0.06, 0.66, 5, railMat, [-0.34, 0.33, 0]);
  const postR = cylinder(0.05, 0.06, 0.66, 5, railMat, [0.34, 0.33, 0]);
  const lintel = box(0.8, 0.08, 0.09, railMat, [0, 0.7, 0]);

  // 올라가는 방향을 가리키는 화살 표식
  const arrow = cone(0.15, 0.24, 4, glowMaterial(PALETTE.accent, { transparent: false }), [
    0,
    0.07,
    0.34,
  ]);
  arrow.rotation.x = -Math.PI / 2;

  return group(postL, postR, lintel, arrow);
}

/** 길가의 낮은 단 — 걸어서 바로 올라설 수 있는 자리라는 표식 */
function buildPlatformMark() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.4, 12),
    glowMaterial(PALETTE.accent, { opacity: 0.4, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;

  const pip = blob(0.09, 0, glowMaterial(SPROUT_GREEN, { transparent: false }), [0, 0.1, 0]);

  return group(ring, pip);
}

/* ------------------------------------------------------------------ */
/* 마침표 왕관 수여식장                                                 */
/* ------------------------------------------------------------------ */

/**
 * 마침표 왕관.
 *
 * 금속 왕관처럼 사실적으로 만들지 않는다. 작은 골드 링 + 위로 솟은 몇 개의
 * 포인트 + 가운데 마침표를 연상시키는 둥근 보석. 멀리서도 특별해 보이면 된다.
 */
function buildCrown(radius) {
  const goldMat = flatMaterial(CROWN_GOLD, { emissive: '#4A3208' });

  const band = new THREE.Mesh(
    new THREE.TorusGeometry(radius, radius * 0.18, 5, 12),
    goldMat
  );
  band.rotation.x = Math.PI / 2;

  const points = group();
  for (let i = 0; i < 5; i += 1) {
    const a = (Math.PI * 2 * i) / 5;
    points.add(
      cone(radius * 0.2, radius * 0.66, 4, goldMat, [
        Math.sin(a) * radius,
        radius * 0.42,
        Math.cos(a) * radius,
      ])
    );
  }

  // 가운데의 마침표
  const dot = blob(
    radius * 0.3,
    0,
    glowMaterial('#FFF0C0', { transparent: false }),
    [0, radius * 0.34, 0]
  );

  return group(band, points, dot);
}

/**
 * 마침표 왕관 수여식장.
 * 오늘 왕관을 받을 질문은 없다. 축제가 진행 중인 장소처럼 만들지 않는다.
 * 중앙 자리는 비어 있고, 축하 조명은 꺼져 있거나 아주 은은하다.
 */
function buildCrownCeremony() {
  const stoneMat = flatMaterial('#DCD6C2');
  const g = group();

  // 낮은 원형 단상
  g.add(cylinder(2.3, 2.5, 0.22, 14, stoneMat, [0, 0.11, 0]));
  g.add(cylinder(1.5, 1.7, 0.2, 12, flatMaterial('#F7F1CE'), [0, 0.32, 0]));

  // 비어 있는 중앙 자리 — 아무도 서 있지 않다
  const emptySeat = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.7, 14),
    glowMaterial(CROWN_GOLD, { opacity: 0.22, depthWrite: false })
  );
  emptySeat.rotation.x = -Math.PI / 2;
  emptySeat.position.y = 0.43;
  g.add(emptySeat);

  // 주인을 기다리는 왕관 — 빈 자리 위에 떠 있다
  const crown = buildCrown(0.42);
  crown.position.y = 1.15;
  crown.name = 'crown';
  crown.userData.baseY = 1.15;
  g.add(crown);

  // 꺼져 있는 축하 조명 기둥들. 불이 켜진 것은 하나도 없다.
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI * 2 * i) / 6;
    const px = Math.sin(a) * 2.9;
    const pz = Math.cos(a) * 2.9;
    g.add(cylinder(0.06, 0.08, 1.5, 6, flatMaterial('#B7B2A2'), [px, 0.75, pz]));
    g.add(
      blob(0.13, 0, flatMaterial('#9E9A8C'), [px, 1.56, pz])
    );
  }

  g.userData.kind = 'crownCeremony';
  return g;
}

/**
 * 마침표 월드로 가는 큰 문.
 * 2막 3장 시점에 이 문이 다시 열렸다는 근거는 없다. 그래서 활짝 열린 포털이
 * 아니라, 닫힌 채 문틈으로만 빛이 새는 "아직 도달하지 못한 목적지" 로 둔다.
 */
function buildFullStopGate() {
  const stoneMat = flatMaterial('#C9C3B0');
  const g = group();

  const h = 4.2;
  const w = 2.6;

  g.add(box(0.42, h, 0.42, stoneMat, [-w / 2, h / 2, 0]));
  g.add(box(0.42, h, 0.42, stoneMat, [w / 2, h / 2, 0]));
  g.add(box(w + 0.42, 0.44, 0.5, stoneMat, [0, h + 0.22, 0]));

  // 상인방 위의 마침표 — 이 문 너머가 마침표 월드다
  g.add(
    blob(0.3, 0, glowMaterial('#FFF0C0', { opacity: 0.9 }), [0, h + 0.72, 0])
  );

  // 닫힌 두 문짝
  const doorMat = flatMaterial('#8E93B8', { emissive: '#171B33' });
  g.add(box(w / 2 - 0.04, h - 0.2, 0.16, doorMat, [-w / 4, (h - 0.2) / 2, 0]));
  g.add(box(w / 2 - 0.04, h - 0.2, 0.16, doorMat, [w / 4, (h - 0.2) / 2, 0]));

  // 두 문짝 사이의 얇은 틈으로만 빛이 샌다
  const seam = box(
    0.1,
    h - 0.4,
    0.05,
    glowMaterial('#FFF4D8', { opacity: 0.75, depthWrite: false }),
    [0, (h - 0.2) / 2, 0.1]
  );
  g.add(seam);

  return g;
}

/* ------------------------------------------------------------------ */
/* 몰라 정류장                                                          */
/* ------------------------------------------------------------------ */

/**
 * 몰라의 회색 천.
 *
 * 바닥에 깔지 않는다. 바닥에 깔면 그건 '몰라도대지' 이고, 그 위에 올라간 질문은
 * 서로 보이지도 들리지도 않는다. 이 맵은 천을 높이 건 이후의 세계다.
 *
 * 천 시뮬레이션은 쓰지 않는다. PlaneGeometry 의 정점을 한 번만 아래로 당겨
 * 살짝 처진 canopy 를 만든다.
 */
function buildCloth(width, depth, sag) {
  const geometry = new THREE.PlaneGeometry(width, depth, 4, 3);
  const pos = geometry.attributes.position;
  const halfW = width / 2;
  const halfD = depth / 2;
  for (let i = 0; i < pos.count; i += 1) {
    const u = Math.abs(pos.getX(i)) / halfW;
    const v = Math.abs(pos.getY(i)) / halfD;
    // 가장자리는 기둥에 매여 있고 가운데로 갈수록 늘어진다
    pos.setZ(i, -(1 - u * u) * (1 - v * v) * sag);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();

  const cloth = new THREE.Mesh(
    geometry,
    flatMaterial(CLOTH_GRAY, { side: THREE.DoubleSide, emissive: '#1C1D21' })
  );
  cloth.rotation.x = -Math.PI / 2;
  return cloth;
}

/**
 * 몰라 정류장 광장.
 *
 * 목적지가 아니라 잠시 쉬어가는 곳이다. 천 아래에서 질문들은 서로 보이고
 * 들린다. 여러 방향으로 다시 나갈 수 있어야 하므로 길이 세 갈래로 뻗는다.
 */
function buildMollaStopPlaza() {
  const g = group();
  const postMat = flatMaterial(WOOD);

  // 바닥 광장
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 16),
    flatMaterial('#F5EFC8')
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  g.add(plaza);

  // 세 방향으로 뻗는 길 — 막다른 정자가 아니라 길이 만나는 곳이다
  for (const angle of [0, 2.1, 4.2]) {
    const road = box(1.5, 0.04, 4.2, flatMaterial('#FFF9C4'), [
      Math.sin(angle) * 4.4,
      0.03,
      Math.cos(angle) * 4.4,
    ]);
    road.rotation.y = angle;
    g.add(road);
  }

  // 기둥 넷과 높이 걸린 회색 천
  const h = 3.0;
  for (const [px, pz] of [
    [-2.2, -2.2],
    [2.2, -2.2],
    [-2.2, 2.2],
    [2.2, 2.2],
  ]) {
    g.add(cylinder(0.11, 0.15, h, 6, postMat, [px, h / 2, pz]));
  }

  const cloth = buildCloth(5.0, 5.0, 0.85);
  cloth.position.y = h;
  cloth.userData.baseRotX = cloth.rotation.x;
  cloth.userData.baseRotZ = cloth.rotation.z;
  cloth.name = 'cloth';
  g.add(cloth);

  // 천 아래의 따뜻한 앰버 — 여기서는 서로가 보인다
  const warmPool = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 16),
    glowMaterial(PALETTE.accent, { opacity: 0.2, depthWrite: false })
  );
  warmPool.rotation.x = -Math.PI / 2;
  warmPool.position.y = 0.05;
  g.add(warmPool);

  // 여러 질문이 함께 앉을 수 있는 낮은 벤치 셋
  for (const [bx, bz, ry] of [
    [0, -1.6, 0],
    [-1.5, 0.9, 2.1],
    [1.5, 0.9, -2.1],
  ]) {
    const bench = buildBench();
    bench.position.set(bx, 0, bz);
    bench.rotation.y = ry;
    g.add(bench);
  }

  // 정류장 표지 — 목적지가 아니라 도중에 들르는 곳이라는 표시
  g.add(cylinder(0.07, 0.09, 2.0, 6, postMat, [2.9, 1.0, -0.6]));
  const signBoard = box(0.7, 0.34, 0.07, flatMaterial('#EFE6D2'), [2.9, 2.14, -0.6]);
  g.add(signBoard);
  g.add(
    box(0.4, 0.09, 0.03, glowMaterial(PALETTE.accent, { transparent: false }), [
      2.9,
      2.16,
      -0.56,
    ])
  );

  g.userData.kind = 'mollaStopPlaza';
  return g;
}

function buildBench() {
  const woodMat = flatMaterial(WOOD);
  return group(
    box(1.5, 0.1, 0.42, woodMat, [0, 0.38, 0]),
    box(0.11, 0.38, 0.36, woodMat, [-0.58, 0.19, 0]),
    box(0.11, 0.38, 0.36, woodMat, [0.58, 0.19, 0])
  );
}

/* ------------------------------------------------------------------ */
/* 코끼리 모양 바위                                                     */
/* ------------------------------------------------------------------ */

/**
 * 코끼리 모양 바위.
 *
 * 코끼리 캐릭터 모델이 아니다. 멀리서 보면 코끼리처럼 보이는 정도의 자연석
 * 덩어리다. 두 질문이 서로 이야기를 합쳐 자기들 길이 이어져 있음을 알아낸
 * 공통 기준점이라, 이 바위를 끼고 두 갈래 길이 만난다.
 */
function buildElephantRock(scale = 1) {
  const rockMat = flatMaterial(STONE, { emissive: '#1A1A18' });
  const g = group();

  const body = blob(1.0, 0, rockMat, [0, 0.9, 0]);
  body.scale.set(1.25, 0.92, 1.0);
  g.add(body);

  // 코처럼 늘어진 부분
  const trunk = cylinder(0.16, 0.3, 1.5, 6, rockMat, [1.15, 0.75, 0.1]);
  trunk.rotation.z = 0.42;
  g.add(trunk);
  const trunkTip = blob(0.17, 0, rockMat, [1.5, 0.12, 0.1]);
  g.add(trunkTip);

  // 귀처럼 넓적한 판
  const ear = blob(0.55, 0, rockMat, [0.35, 1.25, -0.62]);
  ear.scale.set(0.85, 1.0, 0.28);
  ear.rotation.z = -0.25;
  g.add(ear);

  // 다리처럼 뭉툭한 받침
  for (const [lx, lz] of [
    [-0.6, 0.45],
    [-0.6, -0.45],
    [0.6, 0.45],
  ]) {
    g.add(cylinder(0.26, 0.3, 0.5, 6, rockMat, [lx, 0.25, lz]));
  }

  g.scale.setScalar(scale);
  return g;
}

/** 바위와, 그 곁에서 만나는 두 갈래 길 */
function buildElephantRockScene() {
  const g = group();
  g.add(buildElephantRock(1));

  // 서로 다른 방향에서 와서 바위 앞에서 만나는 두 길
  const pathMat = flatMaterial('#FFF9C4');
  for (const [angle, len] of [
    [0.55, 5.0],
    [-1.05, 4.4],
  ]) {
    const road = box(1.25, 0.05, len, pathMat, [
      Math.sin(angle) * (len / 2 + 1.4),
      0.03,
      Math.cos(angle) * (len / 2 + 1.4),
    ]);
    road.rotation.y = angle;
    g.add(road);
  }

  // 두 길이 만나는 자리의 표식
  const joinMark = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.66, 12),
    glowMaterial(PALETTE.accent, { opacity: 0.34, depthWrite: false })
  );
  joinMark.rotation.x = -Math.PI / 2;
  joinMark.position.set(0, 0.06, 2.0);
  g.add(joinMark);

  const sprout = buildSprout();
  sprout.position.set(-1.5, 0, 1.4);
  g.add(sprout);

  return g;
}

/* ------------------------------------------------------------------ */
/* 아기 질문의 문                                                       */
/* ------------------------------------------------------------------ */

/**
 * 아기 질문의 작은 문.
 *
 * 다른 문보다 작고, 아직 닫혀 있다. 하지만 부서져 있지도, 검게 죽어 있지도
 * 않다. 실패의 상징이 아니라 "오늘은 열리지 않았지만 내일 다시 올 문" 이다.
 * 그래서 곁에 작은 새싹과 따뜻한 빛을 둔다.
 */
function buildBabyDoor(height) {
  const frameMat = flatMaterial(WOOD);
  const panelMat = flatMaterial('#EBD9B8', { emissive: '#2A1F0C' });

  const w = height * 0.6;
  const t = height * 0.1;

  const g = group();
  g.add(box(t, height, t, frameMat, [-w / 2, height / 2, 0]));
  g.add(box(t, height, t, frameMat, [w / 2, height / 2, 0]));
  g.add(box(w + t, t, t, frameMat, [0, height + t / 2, 0]));

  // 닫힌 문짝. 열려 있지 않다.
  g.add(box(w, height, t * 0.55, panelMat, [0, height / 2, 0]));
  // 아기 질문이 잡았던 작은 손잡이
  g.add(
    blob(height * 0.055, 0, flatMaterial('#EFE6D2'), [
      w * 0.32,
      height * 0.48,
      t * 0.4,
    ])
  );

  // 문 아래로 스며드는 작고 조용한 빛 — 꺼지지 않았다
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(w * 0.95, 14),
    glowMaterial(WARM_LIGHT, { opacity: 0.34, depthWrite: false })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.03, t * 1.6);
  g.add(primeGlow(glow, 'door-glow'));

  return g;
}

function buildBabyDoorScene() {
  const g = group();
  g.add(buildBabyDoor(1.35));

  // 문 곁의 새싹들 — 내일 다시 올 수 있다는 표시
  const rand = makeRandom(717);
  for (let i = 0; i < 4; i += 1) {
    const a = 0.6 + (Math.PI * 1.5 * i) / 4;
    const sprout = buildSprout();
    sprout.position.set(Math.sin(a) * 1.3, 0, Math.cos(a) * 1.3 + 0.5);
    sprout.scale.setScalar(0.85 + rand() * 0.5);
    g.add(sprout);
  }

  // 아기 질문이 앉아 기다린 작은 돌
  const stone = buildSmallStone();
  stone.position.set(1.25, 0, 1.0);
  stone.scale.setScalar(1.4);
  g.add(stone);

  g.userData.kind = 'babyDoorScene';
  return g;
}

/* ------------------------------------------------------------------ */
/* 위기의 흔적                                                          */
/* ------------------------------------------------------------------ */

/** 아무도 보지 않는 낡은 안내판 — 답이 사라졌던 378일의 흔적 */
function buildOldSignpost() {
  const mat = flatMaterial('#9C8C74');
  const g = group();
  const post = cylinder(0.08, 0.1, 1.9, 6, mat, [0, 0.95, 0]);
  post.rotation.z = 0.08; // 살짝 기울어 있다
  g.add(post);

  const board = box(1.1, 0.5, 0.07, flatMaterial('#D8CFB6'), [0.08, 1.75, 0]);
  board.rotation.z = 0.08;
  g.add(board);
  // 글자 대신 바랜 줄 두 개
  for (let i = 0; i < 2; i += 1) {
    const line = box(0.66, 0.07, 0.03, flatMaterial('#B0A88E'), [
      0.02,
      1.84 - i * 0.18,
      0.05,
    ]);
    line.rotation.z = 0.08;
    g.add(line);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* 낮은 풍경                                                            */
/* ------------------------------------------------------------------ */

/** 궁금해 씨앗에서 자라난 새싹 */
function buildSprout() {
  const mat = flatMaterial(SPROUT_GREEN);
  const soil = cylinder(0.13, 0.16, 0.08, 6, flatMaterial('#B49B74'), [0, 0.04, 0]);
  const stem = cylinder(0.02, 0.03, 0.26, 5, mat, [0, 0.21, 0]);
  const leafA = blob(0.11, 0, mat, [0.09, 0.33, 0]);
  leafA.scale.set(1.4, 0.32, 0.7);
  const leafB = blob(0.09, 0, mat, [-0.08, 0.29, 0.03]);
  leafB.scale.set(1.3, 0.3, 0.66);
  return group(soil, stem, leafA, leafB);
}

/** 아직 심기지 않은 궁금해 씨앗 */
function buildSeed() {
  const seed = blob(0.12, 0, flatMaterial('#C8A46E'), [0, 0.1, 0]);
  seed.scale.set(0.8, 1.1, 0.8);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 10),
    glowMaterial(SPROUT_GREEN, { opacity: 0.16, depthWrite: false })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.012;
  return group(halo, seed);
}

/** 길표식 — 어느 질문이 지나간 흔적 */
function buildPathMarker() {
  const mat = flatMaterial('#C9C3B0');
  const post = cylinder(0.04, 0.05, 0.42, 5, mat, [0, 0.21, 0]);
  const arrow = box(0.3, 0.1, 0.04, flatMaterial(PALETTE.accent), [0.12, 0.4, 0]);
  return group(post, arrow);
}

function buildSmallStone() {
  const stone = blob(0.17, 0, flatMaterial(STONE), [0, 0.1, 0]);
  stone.scale.set(1.15, 0.66, 0.95);
  return group(stone);
}

/** 새 질문이 태어나는 작은 빛 */
function buildBirthSpark() {
  const spark = blob(0.1, 0, glowMaterial('#BFE6FF', { opacity: 0.85 }), [0, 0.24, 0]);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 12),
    glowMaterial('#BFE6FF', { opacity: 0.18, depthWrite: false })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.012;
  return group(halo, spark);
}

/* ------------------------------------------------------------------ */
/* 배경                                                                */
/* ------------------------------------------------------------------ */

function buildDaySun() {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 26),
    glowMaterial('#FFFAE8', { opacity: 0.94 })
  );
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 26),
    glowMaterial('#FFE9BE', { opacity: 0.22, depthWrite: false })
  );
  halo.position.z = -0.05;
  const g = group(halo, disc);
  g.userData.billboard = true;
  return g;
}

function buildSoftCloud() {
  const puff = (r, x, y) => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 12),
      glowMaterial('#FFFFFF', { opacity: 0.6, depthWrite: false })
    );
    m.position.set(x, y, 0);
    return m;
  };
  const g = group(puff(1, -0.72, 0), puff(1.28, 0.12, 0.15), puff(0.84, 0.92, -0.05));
  g.userData.billboard = true;
  return g;
}

/* ------------------------------------------------------------------ */
/* 랜드마크 — 탐험길에서 만나는 여섯 장면                                */
/* ------------------------------------------------------------------ */

/** 1. 새로운 질문의 탄생점 */
function buildBirthPoint() {
  const base = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 14),
    glowMaterial('#BFE6FF', { opacity: 0.24, depthWrite: false })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.02;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.76, 14),
    glowMaterial('#9FD8F5', { opacity: 0.5, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.024;

  // 위로 떠오르는 아주 작은 입자들 — 질문이 막 태어나는 중이다
  const motes = group();
  motes.name = 'birth-motes';
  const rand = makeRandom(313);
  for (let i = 0; i < 7; i += 1) {
    const a = (Math.PI * 2 * i) / 7;
    const r = 0.16 + rand() * 0.2;
    motes.add(
      blob(0.035, 0, glowMaterial('#E8F6FF', { opacity: 0.8, depthWrite: false }), [
        Math.sin(a) * r,
        rand() * 0.55,
        Math.cos(a) * r,
      ])
    );
  }

  const sprout = buildSprout();
  sprout.position.set(0.4, 0, 0.24);
  sprout.scale.setScalar(0.8);

  const g = group(base, ring, motes, sprout);
  g.userData.kind = 'birthPoint';
  return g;
}

/** 2. 자기만의 문 */
function buildOwnDoor() {
  const g = buildQuestionDoor(
    { doorColor: DOOR_COLORS[0], ajar: true },
    1.25
  );
  g.userData.kind = 'ownDoor';
  return g;
}

/** 3. 주인을 기다리는 마침표 왕관 */
function buildWaitingCrown() {
  const podium = cylinder(0.42, 0.5, 0.32, 10, flatMaterial('#DCD6C2'), [0, 0.16, 0]);

  // 비어 있는 자리
  const emptySeat = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.3, 12),
    glowMaterial(CROWN_GOLD, { opacity: 0.26, depthWrite: false })
  );
  emptySeat.rotation.x = -Math.PI / 2;
  emptySeat.position.y = 0.33;

  const crown = buildCrown(0.24);
  crown.position.y = 0.78;
  crown.name = 'crown';
  crown.userData.baseY = 0.78;

  const g = group(podium, emptySeat, crown);
  g.userData.kind = 'waitingCrown';
  return g;
}

/** 4. 코끼리 모양 바위 — 두 길이 만나는 교차로에 놓인다 */
function buildElephantRockSmall() {
  const rock = buildElephantRock(0.42);

  // 두 길이 이어졌음을 표시하는 링
  const joinMark = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.76, 14),
    glowMaterial(PALETTE.accent, { opacity: 0.32, depthWrite: false })
  );
  joinMark.rotation.x = -Math.PI / 2;
  joinMark.position.y = 0.02;

  return group(joinMark, rock);
}

/** 5. 몰라 정류장 — 탐험 중 만나는 작은 기착점 */
function buildMollaStopSmall() {
  const g = group();
  const postMat = flatMaterial(WOOD);

  const h = 1.5;
  for (const [px, pz] of [
    [-0.85, -0.85],
    [0.85, -0.85],
    [-0.85, 0.85],
    [0.85, 0.85],
  ]) {
    g.add(cylinder(0.06, 0.08, h, 5, postMat, [px, h / 2, pz]));
  }

  const cloth = buildCloth(2.1, 2.1, 0.36);
  cloth.position.y = h;
  cloth.userData.baseRotX = cloth.rotation.x;
  cloth.userData.baseRotZ = cloth.rotation.z;
  cloth.name = 'cloth';
  g.add(cloth);

  // 천 아래 — 여기서는 서로 보이고 들린다
  const warmPool = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 14),
    glowMaterial(PALETTE.accent, { opacity: 0.26, depthWrite: false })
  );
  warmPool.rotation.x = -Math.PI / 2;
  warmPool.position.y = 0.02;
  g.add(warmPool);

  const bench = buildBench();
  bench.scale.setScalar(0.6);
  bench.position.z = -0.3;
  g.add(bench);

  g.userData.kind = 'mollaStop';
  return g;
}

/** 6. 아기 질문의 닫힌 문 */
function buildBabyDoorSmall() {
  const g = group(buildBabyDoor(0.95));
  g.userData.kind = 'babyDoor';
  return g;
}

/* ------------------------------------------------------------------ */

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
  getCellScale,
  getColorVariation,
  getBlockSpread,
  buildDecoration,
  buildLandmark,
  update,
};
