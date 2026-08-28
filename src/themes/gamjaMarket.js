/**
 * themes/gamjaMarket.js — 7) 감자마켓
 * ---------------------------------------------------------------------------
 * 2025년 초등 뮤지컬 동아리 창작뮤지컬 「감자마켓」의 세계관.
 *
 * '감자' 는 감(정)·(상)자 — 감정상자다. 켜면 그 안에 담긴 감정이 잠시 흘러나오고,
 * 시간이 지나면 빛이 꺼진다. 이 시장에서 감정은 상품이고, 추억은 화폐다.
 *
 * 비주얼 콘셉트: 「낮의 도시」 + 「감자마켓 앱 속의 세상」
 *
 * 처음에는 따뜻한 장터 색으로 만들었더니 '사막과 여우' 와 주조색이 거의 같아졌다
 * (#E8A13A 대 #E8A35D). 그래서 팔레트를 통째로 뒤집었다. 시장 바닥의 모래색을
 * 걷어내고, 한낮의 도시 블록과 앱 UI 의 흰 카드를 기본 언어로 삼는다.
 *
 * 공간 해석
 *   dark 모듈 = 감정 진열대 = 앱 카드가 세워진 시안빛 도시 블록.
 *   light 모듈 = 마켓 골목 = 한낮의 밝은 보도.
 *
 * 색의 역할이 바뀌었다. 감자 골드는 더 이상 바탕이 아니라 액센트다.
 * 차가운 도시 위에 놓인 금색이라 오히려 눈에 더 잘 띈다.
 * 반대로 무료나눔 벤치와 추억 계열만 따뜻한 나무빛을 지킨다 — 화려한 거래의
 * 세계는 서늘하고, 진짜 마음이 있는 자리는 따뜻하다.
 *
 * 외곽에는 이야기의 장면들이 각 방향으로 흩어져 있다.
 *   0°   메인 카운터(운영자 감자1·2·3의 부스 세 개)
 *   90°  감자데이 쇼츠 촬영장
 *   180° 추억 주머니 — 비어가는 화폐
 *   225° 수상한 특가 노점 — 감사꾼
 *   285° 무료나눔 벤치 — 거래의 반대편, 가장 조용한 자리
 *
 * 팔레트: 감자 황금주황 + 크림베이지 + 새싹 초록
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
  id: 'gamja-market',
  label: '감자마켓',
  caption: '감정을 사고파는 마음의 시장',
  swatch: ['#5FB0C4', '#A8DCF7', '#FFC24D'],
};

const PALETTE = {
  /* 3D 씬 — 한낮의 도시 블록과 앱 캔버스 */
  dark: '#5FBBD1', // 감정 진열대 = 앱 카드가 세워진 시안빛 도시 블록
  darkEmissive: '#12333D',
  light: '#EDF3F7', // 마켓 골목 = 한낮의 밝은 보도
  ground: '#DCE8F0', // 앱 캔버스
  groundEmissive: '#141C24',
  sky: '#6BC5EE', // 맑은 낮 하늘
  accent: '#FFC24D', // 감자 골드 — 이제 바탕이 아니라 액센트

  /* 탑다운 스캔 뷰 (대비 10.2:1) — 앱 화면 위의 도시 도면 */
  scanDark: '#164A55',
  scanLight: '#F4F9FC',
  scanGround: '#C6DAE8',
  scanShadow: '#5E8598',
};

/**
 * 감정별 포인트 색.
 * 감자 하나하나가 어떤 감정을 담고 있는지 암시하는 용도라 무지개처럼 흩뿌리지
 * 않고, 한 장면에는 두세 색만 모아 쓴다.
 */
const EMOTION = {
  joy: '#FFD65A', // 기쁨
  flutter: '#F98FB0', // 설렘
  sorry: '#4E93D6', // 미안함
  confidence: '#FF9F43', // 자신감
  empathy: '#4FC4A8', // 공감
  lonely: '#7C7FD0', // 외로움
  envy: '#9BD24F', // 질투
};

const EMOTION_KEYS = Object.keys(EMOTION);

const SPROUT_GREEN = '#6FC26A'; // 도시의 초록 — 하늘색 위에서 선명하게
const MEMORY_GOLD = '#FFD65A'; // 추억 조각
const SUSPICIOUS_RED = '#E0574F'; // 수상한 노점 — 서늘한 도시 속 유일한 붉은 구역
const POTATO_SKIN = '#E8B057'; // 감자 = 액센트 골드
const CRATE_WOOD = '#A9C4D4'; // 마켓 물류 상자 — 앱 배송함 같은 쿨 그레이블루

/* 앱 UI 자재 — 흰 카드와 쿨 그레이 프레임 */
const UI_CARD = '#F7FAFC'; // 앱 카드 표면
const UI_PANEL = '#DCE7EF'; // 카드 안쪽 패널
const UI_FRAME = '#9FB6C6'; // 지지대·프레임
const UI_FRAME_DEEP = '#7E93A4';
const UI_DEVICE = '#3E4A56'; // 기기 몸체
const UI_SCREEN = '#DCF0FF'; // 화면 빛

/* 따뜻한 자재 — 추억과 무료나눔에만 쓴다 */
const WARM_WOOD = '#C9A06B';
const WARM_WOOD_DEEP = '#9C7A4E';
const WARM_CLOTH = '#D6A45E';

export function getPalette() {
  return { ...PALETTE };
}

/** 스마트폰 앱 속 가상 시장이라 지면은 평평한 편이 자연스럽다. */
export function getCurvature() {
  return 0;
}

/** 매대 높이만 살짝 들쭉날쭉하게 — 스카이라인이 아니라 시장 차양의 기복 */
export function getHeightJitter() {
  return 0.18;
}

/** 도시 블록마다 밝기를 달리해 서로 다른 건물처럼 보이게 한다 */
export function getColorVariation() {
  return 0.22;
}

/** 부스 사이에 골목 틈이 남도록 살짝 벌린다 */
export function getBlockSpread() {
  return 0.92;
}

/**
 * dark 는 위로 살짝 좁아지는 도시 블록(세워 둔 앱 카드), light 는 낮은 보도.
 *
 * 높이는 Explorer 규칙(stepHeight 0.58, 제자리 점프 도달 약 1.28)에 맞춰
 * 정했다. 골목 0.42 는 바깥 바닥에서 걸어 들어올 수 있고, 매대 2.6 은
 * 넘어갈 수 없어 시장 골목이 미로로 유지된다.
 */
export function getBlockGeometry(isDark) {
  if (isDark) {
    return {
      geometry: createStallGeometry(0.94),
      material: flatMaterial(PALETTE.dark, { emissive: PALETTE.darkEmissive }),
      height: 2.6,
    };
  }
  return {
    // 보도는 정확한 정사각 타일 — 발밑이 매끈해야 걸어 다닐 수 있다
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: flatMaterial(PALETTE.light, { emissive: '#1A2630' }),
    height: 0.42,
  };
}

/**
 * 도시 블록 실루엣.
 * 윗면을 살짝 좁혀 건물이 위로 가늘어지는 배흘림을 준다. 엔진이 지오메트리를
 * 밑면 1×1 로 정규화하므로 바닥은 정확히 맞물리고 위쪽만 가늘어진다.
 */
function createStallGeometry(topScale) {
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

/** 1인칭 탐험 중 보조 조명 세기 — 한낮의 시장이라 골목만 살짝 밝혀 준다 */
export function getPlayerLight() {
  return 0.3;
}

/**
 * 탑다운 스캔 뷰의 모듈 색 후보.
 * 한낮의 도시 블록이 띠는 시안틸을 주조로 쓴다.
 *
 * 엔진이 이 색들의 명도만 스캔 안전 대역으로 끌어당기고 색상은 그대로 둔다.
 * 덕분에 QR 이 단색 검정이 아니라 3D 씬과 같은 색 계열의 모자이크가 된다.
 */
export function getScanColors() {
  return {
    // 도시 블록의 시안틸이 주조. 감자 골드와 노점 레드는 드문 포인트로만 섞어
    // 최종 QR 이 '도시의 밤'의 남색 도면이나 사막의 갈색과 겹치지 않게 한다.
    dark: ['#3E8E9E', '#3E8E9E', '#357F92', '#4A6FA5', '#E8A13A', '#D9614E'],
    light: ['#EDF3F7', '#EDF3F7', '#E4ECF5', '#F5F9FC', '#DCE8F2'],
  };
}

export function getBackgroundSetup() {
  const rand = makeRandom(20250828);
  const clouds = [];
  for (let i = 0; i < 7; i += 1) {
    const angle = (Math.PI * 2 * i) / 7 + rand() * 0.6;
    const radius = 150 + rand() * 90;
    clouds.push({
      type: 'dayCloud',
      position: [
        Math.sin(angle) * radius,
        44 + rand() * 34,
        Math.cos(angle) * radius,
      ],
      scale: 8 + rand() * 7,
    });
  }

  return {
    background: PALETTE.sky,
    // 한낮이라 안개는 아주 옅게, 멀리만 건다
    fog: { color: '#A8DDF4', near: 88, far: 215 },
    lights: [
      { type: 'hemisphere', sky: '#EAF7FF', ground: '#8FA6B8', intensity: 2.0 },
      {
        type: 'directional',
        color: '#FFF8E4',
        intensity: 2.35,
        position: [30, 50, 26],
      },
      { type: 'ambient', color: '#D6EAF6', intensity: 0.9 },
    ],
    objects: [
      ...clouds,
      { type: 'marketSun', position: [-64, 40, -118], scale: 9 },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* 배치                                                                */
/* ------------------------------------------------------------------ */

/** 각도 A(0° = +Z) 에 놓인 오브젝트가 시장 중심을 바라보게 하는 회전값 */
function facingCenter(angleDeg) {
  return (angleDeg * Math.PI) / 180 + Math.PI;
}

export function placeDecorations(matrixSize, matrix) {
  const rand = makeRandom(matrixSize * 97 + 41);
  const specs = [];

  /* --- 큰 장면들 (전환 중 사라진다) --------------------------------- */

  // 0° — 메인 카운터. 감자1·2·3 세 운영자를 부스 세 개로 암시한다.
  const [cx, cz] = squareRingPoint(matrixSize, 0, 5);
  specs.push({
    type: 'marketCounter',
    solid: true,
    position: [cx, 0, cz],
    rotation: [0, facingCenter(0), 0],
    scale: 1.5,
  });

  // 카운터 양옆의 앱 알림등 — update() 에서 아주 느리게 맥동한다
  for (const angle of [-19, 19]) {
    const [nx, nz] = squareRingPoint(matrixSize, angle, 4.2);
    specs.push({
      type: 'notifyPost',
      solid: true,
      position: [nx, 0, nz],
      rotation: [0, facingCenter(angle), 0],
      scale: 1.2,
    });
  }

  // 90° — 감자데이 쇼츠 촬영장 "왜 파셨어요? 왜 사셨어요?"
  const [sx, sz] = squareRingPoint(matrixSize, 90, 6);
  specs.push({
    type: 'shortsStage',
    solid: true,
    position: [sx, 0, sz],
    rotation: [0, facingCenter(90), 0],
    scale: 1.5,
  });

  // 180° — 추억 주머니. 감정을 사는 동안 비어가는 화폐.
  const [px, pz] = squareRingPoint(matrixSize, 180, 5.5);
  specs.push({
    type: 'memoryPouch',
    solid: true,
    position: [px, 0, pz],
    rotation: [0, facingCenter(180) + 0.3, 0],
    scale: 1.6,
  });

  // 225° — 수상한 특가 노점. 시장 한쪽 구석, 매대가 기울어져 있다.
  const [ux, uz] = squareRingPoint(matrixSize, 225, 5);
  specs.push({
    type: 'suspiciousStall',
    solid: true,
    position: [ux, 0, uz],
    rotation: [0, facingCenter(225) - 0.35, 0],
    scale: 1.45,
  });

  // 285° — 무료나눔 벤치. 화려한 중앙에서 가장 멀리 떨어뜨린다.
  const [bx, bz] = squareRingPoint(matrixSize, 285, 7.5);
  specs.push({
    type: 'freeShareCorner',
    solid: true,
    position: [bx, 0, bz],
    rotation: [0, facingCenter(285) + 0.2, 0],
    scale: 1.5,
  });

  // 320° — 불 꺼진 감자와 빈 상자.
  // "곧 삭제됩니다" — 언젠가 떠나는 공간이라는 정서를 은근히 남긴다.
  const [dx, dz] = squareRingPoint(matrixSize, 320, 4.4);
  specs.push({
    type: 'dimmedCrate',
    solid: true,
    position: [dx, 0, dz],
    rotation: [0, facingCenter(320) - 0.5, 0],
    scale: 1.25,
  });

  /* --- 앱 속 세상: 공중에 떠 있는 UI ------------------------------- */
  //
  // 이 시장이 스마트폰 앱 안이라는 것을 형태로만 알려 준다.
  // QR 판 위로는 절대 올리지 않고, 바깥 링 위에 띄운다.

  const cardEmotions = ['flutter', 'confidence', 'lonely'];
  cardEmotions.forEach((emotion, i) => {
    const angle = 40 + i * 128;
    const [ux, uz] = squareRingPoint(matrixSize, angle, 3.4);
    specs.push({
      type: 'uiCard',
      position: [ux, 2.5 + i * 0.55, uz],
      rotation: [0, facingCenter(angle), 0],
      scale: 1.15,
      emotion,
    });
  });

  for (const angle of [64, 244]) {
    const [tx, tz] = squareRingPoint(matrixSize, angle, 6.6);
    specs.push({
      type: 'toastPopup',
      position: [tx, 3.3, tz],
      rotation: [0, facingCenter(angle), 0],
      scale: 1.05,
    });
  }

  // 로딩 스피너 — 앱이 무언가를 불러오는 중
  const [lx, lz] = squareRingPoint(matrixSize, 150, 4.2);
  specs.push({
    type: 'loadingRing',
    position: [lx, 0, lz],
    rotation: [0, facingCenter(150), 0],
    scale: 1.2,
  });

  /* --- 낮의 도시: 횡단보도와 가로수 --------------------------------- */

  // 판의 네 변 앞에 하나씩. 모서리(대각선)에 놓으면 줄무늬가 비스듬해져
  // 횡단보도가 아니라 빗금처럼 보이므로, 변의 방향에 맞춰 각을 스냅한다.
  for (const angle of [25, 115, 205, 295]) {
    const [wx, wz] = squareRingPoint(matrixSize, angle, 3.2);
    const edgeAngle = Math.round(angle / 90) * 90;
    specs.push({
      type: 'crosswalk',
      position: [wx, 0, wz],
      rotation: [0, (edgeAngle * Math.PI) / 180, 0],
      scale: 1.3,
      persistent: true,
    });
  }

  for (let i = 0; i < 10; i += 1) {
    const angle = (360 / 10) * i + 18 + rand() * 6;
    const [tx, tz] = squareRingPoint(matrixSize, angle, 5.4 + rand() * 3.2);
    specs.push({
      type: 'streetTree',
      solid: true,
      position: [tx, 0, tz],
      rotation: [0, rand() * Math.PI * 2, 0],
      scale: 1.3 + rand() * 0.7,
    });
  }

  /* --- 낮은 풍경 (탑다운에서도 남는다) ------------------------------ */
  //
  // persistent 는 반드시 squareRingPoint 위에만 둔다. 원형 링은 대각선에서
  // QR 판 위로 올라오므로 스캔을 방해한다.

  const sceneryTypes = [
    'sceneryPotato',
    'sceneryPotato',
    'sprout',
    'memoryShard',
    'crate',
    'shoppingBag',
    'floorSticker',
    'lowLamp',
  ];

  for (let i = 0; i < 26; i += 1) {
    const angle = (360 / 26) * i + rand() * 10;
    const [ox, oz] = squareRingPoint(matrixSize, angle, 1.4 + rand() * 4.4);
    const type = sceneryTypes[Math.floor(rand() * sceneryTypes.length)];
    specs.push({
      type,
      position: [ox, 0, oz],
      rotation: [0, rand() * Math.PI * 2, 0],
      scale: 0.85 + rand() * 0.5,
      emotion: EMOTION_KEYS[Math.floor(rand() * EMOTION_KEYS.length)],
      persistent: true,
    });
  }

  /* --- 매대 위 소품 --------------------------------------------------- */
  //
  // 모든 dark 셀에 오브젝트를 얹으면 큰 QR(53×53)에서 개수가 폭증한다.
  // 결정론적으로 훑어 18개 안팎만 고른다.

  if (matrix) {
    const stalls = [];
    for (let row = 2; row < matrixSize - 2; row += 1) {
      for (let col = 2; col < matrixSize - 2; col += 1) {
        if (matrix[row][col]) {
          stalls.push([col - (matrixSize - 1) / 2, row - (matrixSize - 1) / 2]);
        }
      }
    }
    const step = Math.max(Math.floor(stalls.length / 18), 1);
    for (let i = 0; i < stalls.length; i += step) {
      const [mx, mz] = stalls[i];
      specs.push({
        type: rand() > 0.42 ? 'stallPotato' : 'stallSign',
        position: [mx, 0, mz],
        rotation: [0, rand() * Math.PI * 2, 0],
        scale: 0.8 + rand() * 0.35,
        emotion: EMOTION_KEYS[Math.floor(rand() * EMOTION_KEYS.length)],
        snapToGround: true,
      });
    }
  }

  return specs;
}

/**
 * 골목에서 발견하는 여섯 장면 — 작품의 줄거리를 그대로 따라간다.
 * 걸어서 닿아야 하므로 실제로 도달 가능한 light 모듈(골목) 위에만 놓는다.
 */
export function placeLandmarks(matrixSize, matrix) {
  const entries = [
    {
      type: 'wishPotato',
      title: '처음 찜한 감자',
      message:
        '필요한 마음도 찜할 수 있다면, 무엇을 가장 먼저 고르게 될까요?',
      color: EMOTION.flutter,
    },
    {
      type: 'shortsSpot',
      title: '감자데이 촬영장',
      message: '감정 하나마다 저마다의 사연이 있습니다.',
      color: EMOTION.joy,
    },
    {
      type: 'emptyPouch',
      title: '비어가는 추억 주머니',
      message: '마음을 얻는 동안, 무엇을 놓치고 있었을까요?',
      color: MEMORY_GOLD,
    },
    {
      type: 'suspiciousPotato',
      title: '수상한 특가 감자',
      message: '겉에 적힌 이름과 안에 든 마음은 같지 않을 수도 있습니다.',
      color: EMOTION.sorry,
    },
    {
      type: 'lastMemory',
      title: '마지막 추억 조각',
      message: '잊고 있던 마음은 오래된 기억 속에 남아 있었습니다.',
      color: MEMORY_GOLD,
    },
    {
      type: 'shareBench',
      title: '무료나눔 벤치',
      message: '필요한 감정은, 정말 밖에서 사 와야 하는 걸까요?',
      color: SPROUT_GREEN,
    },
  ];

  // pickConnectedCells 는 실제로 걸어서 닿는 칸만 고른다.
  // pickWalkableCells 는 light 모듈인지만 보고 연결성을 보지 않아, 사방이 막힌
  // 골목에 랜드마크가 놓이면 영영 발견할 수 없다.
  return pickConnectedCells(matrixSize, matrix, entries.length, 37).map(
    (point, i) => ({ ...entries[i], x: point.x, z: point.z })
  );
}

/* ------------------------------------------------------------------ */
/* 애니메이션                                                          */
/* ------------------------------------------------------------------ */

/**
 * 아주 절제된 움직임만 둔다.
 *
 * 엔진은 theme.update 가 있으면 매 프레임 그림자맵을 다시 굽는다. 그 비용은
 * 훅의 존재 자체에서 오므로 오브젝트를 몇 개 움직이든 같다. 대신 프레임 안에서는
 * 스칼라 연산과 미리 만들어 둔 THREE.Color 의 제자리 보간만 쓴다(할당 0).
 * 움직이는 오브젝트는 15개 아래로 묶고, 감자의 빛이나 시장 조명처럼 정적
 * emissive 로 대체할 수 있는 것은 전부 그렇게 처리했다.
 */
export function update(dt, { elapsed, decorGroup, sceneryGroup }) {
  for (const obj of [...decorGroup.children, ...sceneryGroup.children]) {
    const kind = obj.userData.kind;
    if (!kind) continue;

    switch (kind) {
      case 'suspiciousPotato':
      case 'suspiciousStall':
        // 겉은 미안함의 차분한 푸른빛, 속에서는 억울함이 새어 나온다.
        // 주기 약 9초로 아주 느리게 — 이 작품은 호러가 아니다.
        tintSuspiciousCore(obj, elapsed);
        break;

      case 'lastMemory': {
        // 소중한 기억 하나가 손끝에서 조용히 떠 있다
        const crystal = obj.getObjectByName('memory-crystal');
        if (crystal) {
          crystal.rotation.y = elapsed * 0.5;
          crystal.position.y = 0.62 + Math.sin(elapsed * 1.1) * 0.05;
        }
        break;
      }

      case 'emptyPouch': {
        // 남은 조각들이 주머니에서 하나둘 떠오르는 중
        const shards = obj.getObjectByName('pouch-shards');
        if (shards) {
          shards.position.y = 0.1 + Math.sin(elapsed * 0.9) * 0.06;
          shards.rotation.y = elapsed * 0.35;
        }
        break;
      }

      case 'wishPotato': {
        const ring = obj.getObjectByName('wish-ring');
        if (ring) ring.rotation.y = elapsed * 0.9;
        break;
      }

      case 'shortsSpot':
      case 'shortsStage': {
        // 링라이트가 촬영 중인 것처럼 숨 쉰다
        pulseGlow(obj.getObjectByName('ring-light'), elapsed, 1.4, 0.35);
        break;
      }

      case 'loadingRing': {
        // 앱이 무언가를 불러오는 중 — 아주 느린 스피너
        const arc = obj.getObjectByName('spinner-arc');
        if (arc) arc.rotation.z = -elapsed * 1.1;
        break;
      }

      case 'uiCard': {
        // 공중의 카드가 아주 조금 떠다닌다
        const anchor = obj.userData.anchor;
        if (anchor) obj.position.y = anchor.y + Math.sin(elapsed * 0.8 + anchor.x) * 0.12;
        break;
      }

      case 'shareBench': {
        // 골목 가로등의 따뜻한 빛
        pulseGlow(obj.getObjectByName('bench-lamp'), elapsed, 0.7, 0.18);
        break;
      }

      case 'notifyPost': {
        // 앱 알림등 — 가끔 반짝인다
        pulseGlow(obj.getObjectByName('notify-bulb'), elapsed, 2.1, 0.45);
        break;
      }

      default:
        break;
    }
  }
}

/** 미리 만들어 둔 두 색 사이를 제자리 보간한다 (프레임 중 할당 없음) */
function tintSuspiciousCore(obj, elapsed) {
  const core = obj.getObjectByName('suspicious-core');
  if (!core) return;
  const data = core.userData;
  if (!data.calmColor) return;

  // 0 → 1 → 0 을 오가되 붉은 쪽에 오래 머물지 않게 한다
  const t = (Math.sin(elapsed * 0.7) * 0.5 + 0.5) ** 1.6;
  core.material.color.copy(data.calmColor).lerp(data.leakColor, t);
}

/**
 * 발광 세기만 사인파로 흔든다.
 *
 * opacity 가 아니라 색의 밝기를 흔드는 이유: 엔진은 3D→QR 전환 중
 * _fadeGroup 으로 decorGroup 의 material.opacity 를 직접 덮어쓴다. 여기서
 * opacity 를 매 프레임 쓰면 페이드아웃과 싸워 장식이 스캔 뷰에 남는다.
 * 색은 엔진이 건드리지 않으므로 안전하다.
 */
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
    case 'marketCounter':
      return buildMarketCounter();
    case 'notifyPost':
      return buildNotifyPost();
    case 'shortsStage':
      return buildShortsStage();
    case 'memoryPouch':
      return buildMemoryPouch();
    case 'suspiciousStall':
      return buildSuspiciousStall();
    case 'freeShareCorner':
      return buildFreeShareCorner();
    case 'dimmedCrate':
      return buildDimmedCrate();
    case 'marketSun':
      return buildMarketSun();
    case 'dayCloud':
      return buildDayCloud();

    /* 앱 속 세상 */
    case 'uiCard':
      return buildUiCard(spec);
    case 'toastPopup':
      return buildToastPopup();
    case 'loadingRing':
      return buildLoadingRing();

    /* 낮의 도시 */
    case 'crosswalk':
      return buildCrosswalk();
    case 'streetTree':
      return buildStreetTree();

    /* 낮은 풍경 */
    case 'sceneryPotato':
      return buildScenerySprout(spec);
    case 'sprout':
      return buildSprout();
    case 'memoryShard':
      return buildMemoryShard();
    case 'crate':
      return buildCrate();
    case 'shoppingBag':
      return buildShoppingBag();
    case 'floorSticker':
      return buildFloorSticker(spec);
    case 'lowLamp':
      return buildLowLamp();

    /* 매대 위 소품 */
    case 'stallPotato':
      return buildStallPotato(spec);
    case 'stallSign':
      return buildStallSign(spec);

    default:
      return null;
  }
}

export function buildLandmark(spec) {
  switch (spec.type) {
    case 'wishPotato':
      return buildWishPotato();
    case 'shortsSpot':
      return buildShortsSpot();
    case 'emptyPouch':
      return buildEmptyPouch();
    case 'suspiciousPotato':
      return buildSuspiciousPotato();
    case 'lastMemory':
      return buildLastMemory();
    case 'shareBench':
      return buildShareBench();
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* 감자 — 감정상자                                                     */
/* ------------------------------------------------------------------ */

/**
 * 감정 감자.
 *
 * 식용 감자가 아니라 감정상자다. 눌린 로우폴리 실루엣에 새싹을 얹되,
 * 발광 코어와 얇은 링을 더해 "작동하는 장치" 로 읽히게 한다.
 *
 * @param {string} emotionColor 감정 포인트 색
 * @param {object} [options]
 * @param {number} [options.radius]
 * @param {boolean} [options.dimmed] 빛이 꺼진 감자 (결말의 정서)
 * @param {string} [options.skin]
 */
function buildEmotionPotato(emotionColor, options = {}) {
  const radius = options.radius ?? 0.34;
  const skinMat = flatMaterial(options.skin || POTATO_SKIN, {
    emissive: options.dimmed ? '#1E242A' : '#3A2A12',
  });

  // 살짝 눌린 비대칭 실루엣 — 귀엽고 친근한 감자 모양
  const bodyMesh = blob(radius, 0, skinMat, [0, radius * 0.78, 0]);
  bodyMesh.scale.set(1.12, 0.8, 0.92);

  const parts = [bodyMesh];

  // 작동하는 장치임을 알려 주는 발광 코어와 얇은 링
  if (!options.dimmed) {
    const core = blob(
      radius * 0.3,
      0,
      glowMaterial(emotionColor, { transparent: false }),
      [0, radius * 0.82, radius * 0.72]
    );
    core.name = options.coreName || '';
    parts.push(core);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.52, radius * 0.07, 4, 12),
      glowMaterial(emotionColor, { opacity: 0.55, depthWrite: false })
    );
    ring.position.set(0, radius * 0.82, radius * 0.5);
    parts.push(ring);
  } else {
    // 꺼진 감자 — 코어 자리에 회색 렌즈만 남는다
    parts.push(
      blob(radius * 0.28, 0, flatMaterial('#94A5B2'), [
        0,
        radius * 0.82,
        radius * 0.7,
      ])
    );
  }

  // 새싹 — 감정이 아직 자라고 있다는 표시
  const sproutMat = flatMaterial(options.dimmed ? '#7E8C93' : SPROUT_GREEN);
  parts.push(
    cone(radius * 0.16, radius * 0.62, 4, sproutMat, [
      radius * 0.16,
      radius * 1.62,
      0,
    ])
  );
  const leaf = blob(radius * 0.2, 0, sproutMat, [
    radius * 0.34,
    radius * 1.72,
    0,
  ]);
  leaf.scale.set(1.3, 0.35, 0.7);
  parts.push(leaf);

  return group(...parts);
}

/** 작은 버튼 하나 달린 매대용 미니 감자 */
function buildStallPotato(spec) {
  const color = EMOTION[spec.emotion] || EMOTION.joy;
  const g = buildEmotionPotato(color, { radius: 0.26 });
  return g;
}

/** 매대 위의 감정 이름표 — 텍스트 대신 색 패널로 감정을 표시한다 */
function buildStallSign(spec) {
  const color = EMOTION[spec.emotion] || EMOTION.empathy;
  const postMat = flatMaterial(UI_FRAME);

  const post = cylinder(0.035, 0.045, 0.5, 5, postMat, [0, 0.25, 0]);
  const board = box(0.46, 0.26, 0.05, flatMaterial(UI_CARD), [0, 0.58, 0]);
  const tag = box(0.3, 0.09, 0.03, glowMaterial(color, { transparent: false }), [
    0,
    0.62,
    0.04,
  ]);
  // 가격표 — 추억 조각 한 개
  const price = blob(0.05, 0, glowMaterial(MEMORY_GOLD, { transparent: false }), [
    -0.14,
    0.5,
    0.04,
  ]);

  return group(post, board, tag, price);
}

/** 링 바깥의 작은 감자 — 탑다운에서도 남는다 */
function buildScenerySprout(spec) {
  const color = EMOTION[spec.emotion] || EMOTION.joy;
  const g = buildEmotionPotato(color, { radius: 0.22 });
  return g;
}

/* ------------------------------------------------------------------ */
/* 낮은 풍경 (persistent)                                              */
/* ------------------------------------------------------------------ */

function buildSprout() {
  const mat = flatMaterial(SPROUT_GREEN);
  const soil = cylinder(0.12, 0.15, 0.08, 6, flatMaterial(UI_FRAME_DEEP), [0, 0.04, 0]);
  const stem = cylinder(0.02, 0.03, 0.24, 5, mat, [0, 0.2, 0]);
  const leafA = blob(0.11, 0, mat, [0.09, 0.31, 0]);
  leafA.scale.set(1.4, 0.32, 0.7);
  const leafB = blob(0.09, 0, mat, [-0.08, 0.27, 0.03]);
  leafB.scale.set(1.3, 0.3, 0.66);
  return group(soil, stem, leafA, leafB);
}

/** 추억 조각 — 이 세계의 화폐 */
function buildMemoryShard() {
  const shard = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.15, 0),
    glowMaterial(MEMORY_GOLD, { opacity: 0.92 })
  );
  shard.scale.set(0.75, 1.25, 0.75);
  shard.position.y = 0.18;
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.26, 12),
    glowMaterial(MEMORY_GOLD, { opacity: 0.18, depthWrite: false })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.012;
  return group(halo, shard);
}

/** 감자 상자 */
function buildCrate() {
  const woodMat = flatMaterial(CRATE_WOOD);
  const shell = box(0.52, 0.3, 0.4, woodMat, [0, 0.15, 0]);
  const rim = box(0.56, 0.05, 0.44, flatMaterial('#8FAABC'), [0, 0.31, 0]);
  const inner = group();
  for (const [ix, iz] of [
    [-0.12, -0.06],
    [0.11, 0.05],
    [0.02, -0.1],
  ]) {
    const spud = blob(0.1, 0, flatMaterial(POTATO_SKIN), [ix, 0.35, iz]);
    spud.scale.set(1.1, 0.72, 0.9);
    inner.add(spud);
  }
  return group(shell, rim, inner);
}

/** 마켓 쇼핑백 — 거래가 오간 흔적 */
function buildShoppingBag() {
  const bagMat = flatMaterial('#FFC24D');
  const bag = box(0.3, 0.36, 0.18, bagMat, [0, 0.18, 0]);
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.1, 0.018, 4, 10, Math.PI),
    flatMaterial(UI_FRAME)
  );
  handle.position.set(0, 0.36, 0);
  const badge = box(0.14, 0.1, 0.02, glowMaterial(SPROUT_GREEN, { transparent: false }), [
    0,
    0.2,
    0.1,
  ]);
  return group(bag, handle, badge);
}

/** 바닥 스티커 — 앱 UI 가 바닥에 찍힌 듯한 장식 */
function buildFloorSticker(spec) {
  const color = EMOTION[spec.emotion] || EMOTION.empathy;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 10),
    glowMaterial(color, { opacity: 0.34, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.015;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.44, 10),
    glowMaterial(UI_CARD, { opacity: 0.42, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.014;

  return group(disc, ring);
}

/** 낮은 마켓 조명 — 스캔 뷰에서도 남으므로 키를 낮게 잡는다 */
function buildLowLamp() {
  const poleMat = flatMaterial(UI_FRAME);
  const pole = cylinder(0.035, 0.05, 0.44, 5, poleMat, [0, 0.22, 0]);
  const shade = cone(0.16, 0.16, 6, flatMaterial('#FFC24D'), [0, 0.52, 0]);
  shade.rotation.x = Math.PI;
  const bulb = blob(0.07, 0, glowMaterial('#FFE9AE', { transparent: false }), [
    0,
    0.45,
    0,
  ]);
  return group(pole, shade, bulb);
}

/* ------------------------------------------------------------------ */
/* 메인 카운터 — 감자1·2·3                                             */
/* ------------------------------------------------------------------ */

/**
 * 감자마켓 메인 카운터.
 *
 * 사람 형상은 두지 않고, 성격이 다른 세 부스로 운영자 셋을 암시한다.
 *   왼쪽  감자1 — 하이텐션 쇼호스트. 화려한 배너와 스포트라이트.
 *   가운데 감자2 — 기계적. 태블릿과 거래량 그래프 패널.
 *   오른쪽 감자3 — 따뜻함. 낮고 둥근 상담대와 부드러운 등.
 */
function buildMarketCounter() {
  const deckMat = flatMaterial(UI_PANEL);
  const frameMat = flatMaterial(UI_FRAME);
  const panelMat = flatMaterial(UI_CARD);

  const g = group();

  // 공용 카운터 상판
  g.add(box(4.6, 0.16, 1.0, deckMat, [0, 0.86, 0]));
  for (const lx of [-2.1, -0.7, 0.7, 2.1]) {
    g.add(box(0.14, 0.86, 0.14, frameMat, [lx, 0.43, 0.36]));
    g.add(box(0.14, 0.86, 0.14, frameMat, [lx, 0.43, -0.36]));
  }
  g.add(box(4.6, 0.62, 0.08, deckMat, [0, 0.55, -0.44]));

  /* 감자1 부스 — 이벤트 배너와 스포트라이트 */
  const boothA = group();
  boothA.position.x = -1.6;
  boothA.add(cylinder(0.05, 0.05, 1.5, 5, frameMat, [-0.5, 1.6, -0.3]));
  boothA.add(cylinder(0.05, 0.05, 1.5, 5, frameMat, [0.5, 1.6, -0.3]));
  const banner = box(1.2, 0.5, 0.06, glowMaterial(EMOTION.joy, { transparent: false }), [
    0,
    2.14,
    -0.3,
  ]);
  boothA.add(banner);
  // 세일 리본 세 줄 — 텍스트 없이 "이벤트 중" 느낌만
  for (let i = 0; i < 3; i += 1) {
    boothA.add(
      box(0.9, 0.06, 0.02, glowMaterial('#FFFFFF', { opacity: 0.7 }), [
        0,
        2.24 - i * 0.14,
        -0.25,
      ])
    );
  }
  const spot = cone(0.18, 0.26, 6, frameMat, [0, 1.86, 0.14]);
  spot.rotation.x = Math.PI * 0.85;
  boothA.add(spot);
  boothA.add(
    blob(0.09, 0, glowMaterial('#FFE9AE', { transparent: false }), [0, 1.74, 0.2])
  );
  // 진열된 감정 감자 두 개
  const potA1 = buildEmotionPotato(EMOTION.joy, { radius: 0.2 });
  potA1.position.set(-0.3, 0.94, 0.16);
  const potA2 = buildEmotionPotato(EMOTION.confidence, { radius: 0.2 });
  potA2.position.set(0.24, 0.94, 0.1);
  boothA.add(potA1, potA2);
  g.add(boothA);

  /* 감자2 부스 — 태블릿과 데이터 패널 */
  const boothB = group();
  const tablet = box(0.62, 0.44, 0.05, panelMat, [0, 1.2, -0.1]);
  tablet.rotation.x = -0.35;
  boothB.add(tablet);
  boothB.add(cylinder(0.05, 0.1, 0.28, 5, frameMat, [0, 1.0, -0.05]));
  // 거래량 막대 — 높이가 제각각인 정적 그래프
  const bars = [0.14, 0.26, 0.19, 0.34, 0.22];
  bars.forEach((h, i) => {
    boothB.add(
      box(0.07, h, 0.02, glowMaterial(EMOTION.empathy, { transparent: false }), [
        -0.22 + i * 0.11,
        1.16 + h / 2 - 0.16,
        -0.06,
      ])
    );
  });
  // 인기순위 패널
  const rank = box(0.5, 0.62, 0.05, panelMat, [0.9, 1.5, -0.42]);
  boothB.add(rank);
  for (let i = 0; i < 3; i += 1) {
    boothB.add(
      box(0.34, 0.09, 0.02, glowMaterial(EMOTION.sorry, { transparent: false }), [
        0.9,
        1.68 - i * 0.16,
        -0.38,
      ])
    );
  }
  g.add(boothB);

  /* 감자3 부스 — 낮고 둥근 상담대 */
  const boothC = group();
  boothC.position.x = 1.7;
  const roundTop = cylinder(0.52, 0.52, 0.12, 10, deckMat, [0, 0.72, 0.5]);
  boothC.add(roundTop);
  boothC.add(cylinder(0.12, 0.16, 0.72, 6, frameMat, [0, 0.36, 0.5]));
  // 손님의 마음을 살피는 부드러운 등
  boothC.add(cylinder(0.04, 0.04, 0.9, 5, frameMat, [0.42, 1.25, 0.2]));
  const warmShade = cone(0.24, 0.24, 7, flatMaterial('#F29BB2'), [0.42, 1.78, 0.2]);
  warmShade.rotation.x = Math.PI;
  boothC.add(warmShade);
  boothC.add(
    blob(0.1, 0, glowMaterial('#FFE0DA', { transparent: false }), [0.42, 1.68, 0.2])
  );
  const potC = buildEmotionPotato(EMOTION.empathy, { radius: 0.22 });
  potC.position.set(0, 0.78, 0.5);
  boothC.add(potC);
  g.add(boothC);

  return g;
}

/** 앱 알림등 — 새 거래 알림이 도착한다 */
function buildNotifyPost() {
  const poleMat = flatMaterial(UI_FRAME);
  const pole = cylinder(0.05, 0.07, 1.8, 6, poleMat, [0, 0.9, 0]);
  const head = box(0.44, 0.5, 0.08, flatMaterial(UI_CARD), [0, 2.0, 0]);
  const bulbMat = glowMaterial(EMOTION.flutter, { opacity: 0.95, depthWrite: true });
  const bulb = blob(0.12, 0, bulbMat, [0, 2.16, 0.07]);
  primeGlow(bulb, 'notify-bulb');
  // 알림 뱃지 두 줄
  const lineA = box(0.26, 0.05, 0.02, glowMaterial('#FFC24D', { opacity: 0.8 }), [
    0,
    1.94,
    0.05,
  ]);
  const lineB = box(0.18, 0.05, 0.02, glowMaterial('#FFC24D', { opacity: 0.6 }), [
    -0.04,
    1.84,
    0.05,
  ]);

  const g = group(pole, head, bulb, lineA, lineB);
  g.userData.kind = 'notifyPost';
  return g;
}

/* ------------------------------------------------------------------ */
/* 감자데이 쇼츠 촬영장                                                */
/* ------------------------------------------------------------------ */

/**
 * "왜 파셨어요? 왜 사셨어요?"
 * 감정을 판 사람과 산 사람이 자기 사연을 짧은 영상으로 이야기하는 자리.
 * 텍스트 없이 무대·링라이트·폰 프레임·카메라의 형태만으로 알아보게 한다.
 */
function buildShortsStage() {
  const frameMat = flatMaterial(UI_FRAME);
  const g = group();

  // 작은 원형 무대
  const stage = cylinder(1.5, 1.62, 0.22, 14, flatMaterial('#E6EFF5'), [0, 0.11, 0]);
  g.add(stage);
  const stageRim = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.68, 14),
    glowMaterial(EMOTION.flutter, { opacity: 0.4, depthWrite: false })
  );
  stageRim.rotation.x = -Math.PI / 2;
  stageRim.position.y = 0.23;
  g.add(stageRim);

  // 링라이트
  const ringStand = cylinder(0.05, 0.07, 1.5, 6, frameMat, [0, 0.97, -0.9]);
  g.add(ringStand);
  const ringLight = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.1, 6, 18),
    glowMaterial('#FFF3D2', { opacity: 0.95, depthWrite: true })
  );
  ringLight.position.set(0, 2.0, -0.86);
  primeGlow(ringLight, 'ring-light');
  g.add(ringLight);

  // 세로 스마트폰 프레임 — 쇼츠 화면
  const phoneStand = cylinder(0.05, 0.07, 1.1, 6, frameMat, [1.1, 0.55, 0.2]);
  g.add(phoneStand);
  const phoneBody = box(0.6, 1.1, 0.08, flatMaterial(UI_DEVICE), [1.1, 1.62, 0.2]);
  const phoneScreen = box(0.5, 0.96, 0.03, glowMaterial(UI_SCREEN, { opacity: 0.9 }), [
    1.1,
    1.62,
    0.26,
  ]);
  g.add(phoneBody, phoneScreen);

  // 삼각대 카메라
  const tripod = group();
  tripod.position.set(-1.25, 0, 0.35);
  for (const a of [0, 2.1, 4.2]) {
    const leg = cylinder(0.03, 0.04, 1.2, 4, frameMat, [
      Math.sin(a) * 0.2,
      0.6,
      Math.cos(a) * 0.2,
    ]);
    leg.rotation.set(Math.cos(a) * 0.22, 0, -Math.sin(a) * 0.22);
    tripod.add(leg);
  }
  tripod.add(box(0.4, 0.3, 0.5, flatMaterial('#4A5763'), [0, 1.35, 0]));
  const lens = cylinder(0.12, 0.12, 0.16, 8, flatMaterial('#232B33'), [0, 1.35, 0.3]);
  lens.rotation.x = Math.PI / 2;
  tripod.add(lens);
  tripod.add(
    blob(0.05, 0, glowMaterial(SUSPICIOUS_RED, { transparent: false }), [
      0.15,
      1.5,
      0.2,
    ])
  );
  g.add(tripod);

  // 사연을 가진 감정들이 무대 위에 진열되어 있다
  // (자신감 판매자 · 자신감 구매자 · 외로움 판매자 · 외로움 구매자)
  const shelf = box(1.6, 0.1, 0.44, flatMaterial(UI_PANEL), [0, 0.5, 0.75]);
  g.add(shelf);
  for (const lx of [-0.5, -0.16]) {
    g.add(cylinder(0.05, 0.05, 0.34, 5, frameMat, [lx, 0.28, 0.75]));
  }
  for (const lx of [0.16, 0.5]) {
    g.add(cylinder(0.05, 0.05, 0.34, 5, frameMat, [lx, 0.28, 0.75]));
  }
  const displayed = [EMOTION.confidence, EMOTION.confidence, EMOTION.lonely, EMOTION.lonely];
  displayed.forEach((color, i) => {
    const potato = buildEmotionPotato(color, { radius: 0.19 });
    potato.position.set(-0.52 + i * 0.35, 0.55, 0.75);
    g.add(potato);
  });

  const stageGroup = group(g);
  stageGroup.userData.kind = 'shortsStage';
  return stageGroup;
}

/* ------------------------------------------------------------------ */
/* 추억 주머니                                                         */
/* ------------------------------------------------------------------ */

/**
 * 감정을 살 때마다 하나씩 사라지는 추억 조각.
 * 주머니는 반쯤 헐거워졌고, 남은 조각 몇 개가 그 위에 흩어져 있다.
 */
function buildMemoryPouch() {
  const clothMat = flatMaterial(WARM_CLOTH, { emissive: '#3A2110' });
  const g = group();

  // 낮은 좌대
  g.add(cylinder(0.9, 1.0, 0.18, 10, flatMaterial(UI_PANEL), [0, 0.09, 0]));

  // 주머니 본체 — 위로 갈수록 좁아지는 자루
  const pouch = cylinder(0.36, 0.62, 0.9, 8, clothMat, [0, 0.63, 0]);
  g.add(pouch);
  // 주머니 입구 끈
  const tie = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.05, 4, 10),
    flatMaterial(UI_FRAME_DEEP)
  );
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 1.06;
  g.add(tie);
  // 벌어진 입구 — 안이 비어 보인다
  const mouth = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 8),
    flatMaterial('#6B5240')
  );
  mouth.rotation.x = -Math.PI / 2;
  mouth.position.y = 1.09;
  g.add(mouth);

  // 남은 조각 몇 개, 그리고 이미 떠나 버린 자리(희미한 흔적)
  const rand = makeRandom(8123);
  for (let i = 0; i < 4; i += 1) {
    const a = (Math.PI * 2 * i) / 4 + 0.4;
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13, 0),
      glowMaterial(MEMORY_GOLD, { opacity: 0.9 })
    );
    shard.scale.set(0.75, 1.3, 0.75);
    shard.position.set(Math.sin(a) * 0.62, 1.18 + rand() * 0.2, Math.cos(a) * 0.62);
    g.add(shard);
  }
  for (let i = 0; i < 5; i += 1) {
    const a = (Math.PI * 2 * i) / 5 + 1.1;
    const ghost = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11, 0),
      glowMaterial(MEMORY_GOLD, { opacity: 0.14, depthWrite: false })
    );
    ghost.scale.set(0.75, 1.3, 0.75);
    ghost.position.set(Math.sin(a) * 1.0, 1.5 + i * 0.16, Math.cos(a) * 1.0);
    g.add(ghost);
  }

  return g;
}

/* ------------------------------------------------------------------ */
/* 수상한 특가 노점 — 감사꾼                                           */
/* ------------------------------------------------------------------ */

/**
 * "미안함 감자, 추억 1조각"
 *
 * 시장 전체는 따뜻한 노랑·크림인데 이 자리만 붉다. 매대가 기울어져 있고
 * 가격표가 과장되어 있다. 다만 이 작품은 호러가 아니므로, 어둡게 만들지 않고
 * "조금 이상한 노점" 정도의 불안감만 남긴다.
 */
function buildSuspiciousStall() {
  const woodMat = flatMaterial('#A85F63', { emissive: '#2E1008' });
  const g = group();

  // 삐뚤어진 매대
  const table = group();
  table.rotation.z = 0.09;
  table.add(box(2.0, 0.12, 0.9, woodMat, [0, 0.82, 0]));
  table.add(box(0.12, 0.82, 0.12, woodMat, [-0.85, 0.41, 0.32]));
  table.add(box(0.12, 0.78, 0.12, woodMat, [0.85, 0.39, 0.32]));
  table.add(box(0.12, 0.82, 0.12, woodMat, [-0.85, 0.41, -0.32]));
  table.add(box(0.12, 0.74, 0.12, woodMat, [0.85, 0.37, -0.32]));
  g.add(table);

  // 기울어진 차양 — 붉은 조명이 여기서 나온다
  const canopy = box(2.2, 0.08, 1.0, flatMaterial(SUSPICIOUS_RED, { emissive: '#3E0E06' }), [
    0,
    1.95,
    -0.1,
  ]);
  canopy.rotation.z = -0.13;
  g.add(canopy);
  g.add(cylinder(0.05, 0.06, 1.9, 5, woodMat, [-0.9, 0.95, -0.35]));
  g.add(cylinder(0.05, 0.06, 1.75, 5, woodMat, [0.9, 0.88, -0.35]));

  // 붉은 바닥 조명 — 이 구역만 색이 다르다
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 14),
    glowMaterial(SUSPICIOUS_RED, { opacity: 0.2, depthWrite: false })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.02;
  g.add(pool);

  // 과장된 특가 팻말 — 큰 판에 붉은 띠 두 줄
  const signBoard = box(0.9, 0.6, 0.06, flatMaterial(UI_CARD), [0.85, 1.35, 0.3]);
  signBoard.rotation.z = -0.22;
  g.add(signBoard);
  for (let i = 0; i < 2; i += 1) {
    const stripe = box(0.62, 0.1, 0.03, glowMaterial(SUSPICIOUS_RED, { transparent: false }), [
      0.85,
      1.45 - i * 0.2,
      0.34,
    ]);
    stripe.rotation.z = -0.22;
    g.add(stripe);
  }
  // 추억 1조각 — 말도 안 되게 싼 가격
  g.add(
    blob(0.08, 0, glowMaterial(MEMORY_GOLD, { transparent: false }), [0.62, 1.16, 0.34])
  );

  // 매대 위의 수상한 감자 — 겉은 미안함의 푸른빛
  const potato = buildEmotionPotato(EMOTION.sorry, {
    radius: 0.3,
    coreName: 'suspicious-core',
  });
  potato.position.set(-0.35, 0.92, 0.05);
  potato.rotation.z = 0.09;
  g.add(potato);
  primeSuspiciousCore(g);

  // 싸구려로 쌓아 둔 재고 상자
  const stock = buildCrate();
  stock.position.set(-1.15, 0, 0.55);
  stock.scale.setScalar(1.1);
  stock.rotation.y = 0.4;
  g.add(stock);

  g.userData.kind = 'suspiciousStall';
  return g;
}

/**
 * 수상한 감자의 코어에 두 색을 미리 물려 둔다.
 * update() 는 매 프레임 이 두 색 사이를 제자리 보간만 하므로 할당이 없다.
 */
function primeSuspiciousCore(root) {
  const core = root.getObjectByName('suspicious-core');
  if (!core) return;
  core.userData.calmColor = new THREE.Color(EMOTION.sorry);
  core.userData.leakColor = new THREE.Color(SUSPICIOUS_RED);
}

/* ------------------------------------------------------------------ */
/* 무료나눔 골목                                                       */
/* ------------------------------------------------------------------ */

/**
 * 거래의 반대편.
 *
 * 화려한 마켓에서 가장 멀리 떨어진 조용한 골목이다. 여기서는 감정을 건네주지
 * 않는다. 다만 자기 안의 추억을 다시 들여다보게 해 줄 뿐이다.
 * 그래서 진열대도 가격표도 없고, 벤치와 등과 작은 새싹만 있다.
 */
function buildFreeShareCorner() {
  const woodMat = flatMaterial(WARM_WOOD);
  const g = group();

  // 낮은 골목 바닥 — 주변보다 차분한 색
  const path = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 16),
    flatMaterial('#E8DCC4')
  );
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.02;
  g.add(path);

  // 나무 벤치
  const bench = group();
  bench.position.set(0.2, 0, 0);
  bench.add(box(1.9, 0.12, 0.52, woodMat, [0, 0.46, 0]));
  bench.add(box(1.9, 0.42, 0.1, woodMat, [0, 0.72, -0.22]));
  for (const lx of [-0.75, 0.75]) {
    bench.add(box(0.12, 0.46, 0.44, woodMat, [lx, 0.23, 0]));
  }
  g.add(bench);

  // 따뜻한 가로등 — 이 골목의 유일한 빛
  const lampPost = cylinder(0.06, 0.09, 2.4, 6, flatMaterial(UI_FRAME_DEEP), [-1.5, 1.2, -0.3]);
  g.add(lampPost);
  const lampShade = cone(0.3, 0.34, 7, flatMaterial(UI_PANEL), [-1.5, 2.5, -0.3]);
  lampShade.rotation.x = Math.PI;
  g.add(lampShade);
  const lampBulb = blob(0.14, 0, glowMaterial('#FFE3AE', { opacity: 0.95, depthWrite: true }), [
    -1.5,
    2.34,
    -0.3,
  ]);
  g.add(lampBulb);
  const lampHalo = blob(
    0.6,
    0,
    glowMaterial('#FFE3AE', { opacity: 0.13, depthWrite: false }),
    [-1.5, 2.3, -0.3]
  );
  g.add(lampHalo);

  // 소박한 안내판 — 값도 순위도 적혀 있지 않다
  const signPost = cylinder(0.04, 0.05, 0.8, 5, woodMat, [1.5, 0.4, 0.5]);
  const signBoard = box(0.6, 0.36, 0.05, flatMaterial(UI_CARD), [1.5, 0.94, 0.5]);
  signBoard.rotation.y = -0.3;
  const signMark = box(0.3, 0.08, 0.02, glowMaterial(SPROUT_GREEN, { transparent: false }), [
    1.52,
    0.98,
    0.53,
  ]);
  signMark.rotation.y = -0.3;
  g.add(signPost, signBoard, signMark);

  // 벤치 위에 놓인 황금빛 추억 조각들 — 누군가 두고 간 것이 아니라
  // 여기 앉은 사람이 자기 주머니에서 꺼낸 것이다
  for (const [mx, my, mz] of [
    [-0.15, 0.7, 0.08],
    [0.45, 0.68, -0.02],
  ]) {
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13, 0),
      glowMaterial(MEMORY_GOLD, { opacity: 0.92 })
    );
    shard.scale.set(0.75, 1.3, 0.75);
    shard.position.set(mx, my, mz);
    g.add(shard);
  }

  // 작은 식물과 새싹
  const rand = makeRandom(5150);
  for (let i = 0; i < 5; i += 1) {
    const sprout = buildSprout();
    const a = 1.2 + (Math.PI * 1.4 * i) / 5;
    sprout.position.set(Math.sin(a) * 2.0, 0, Math.cos(a) * 2.0);
    sprout.scale.setScalar(0.9 + rand() * 0.6);
    g.add(sprout);
  }

  return g;
}

/* ------------------------------------------------------------------ */
/* 결말 — 불 꺼진 감자                                                 */
/* ------------------------------------------------------------------ */

/**
 * "감자마켓은 곧 삭제됩니다."
 * 감자마켓은 실패한 시스템이 아니라, 사람들이 자기 감정을 찾을 때까지
 * 잠시 옆에서 빛을 밝혀 준 도구였다. 그 역할이 끝난 자리.
 */
function buildDimmedCrate() {
  const g = group();

  const crate = buildCrate();
  crate.scale.setScalar(1.7);
  g.add(crate);

  const emptyCrate = box(0.9, 0.5, 0.7, flatMaterial('#9DB6C7'), [1.1, 0.25, 0.3]);
  emptyCrate.rotation.z = 0.16;
  g.add(emptyCrate);

  // 빛이 꺼진 감자 두 개
  const offA = buildEmotionPotato(null, { radius: 0.28, dimmed: true });
  offA.position.set(-0.9, 0, 0.5);
  const offB = buildEmotionPotato(null, { radius: 0.24, dimmed: true });
  offB.position.set(-0.5, 0, 0.95);
  offB.rotation.y = 1.1;
  g.add(offA, offB);

  // 그래도 상자 곁에서 새싹 하나가 돋는다 — 작별이지 끝이 아니다
  const sprout = buildSprout();
  sprout.position.set(1.6, 0, -0.35);
  sprout.scale.setScalar(1.4);
  g.add(sprout);

  return g;
}

/* ------------------------------------------------------------------ */
/* 배경                                                                */
/* ------------------------------------------------------------------ */

function buildMarketSun() {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 26),
    glowMaterial('#FFFDF2', { opacity: 0.95 })
  );
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 26),
    glowMaterial('#DFF2FF', { opacity: 0.24, depthWrite: false })
  );
  halo.position.z = -0.05;
  const g = group(halo, disc);
  g.userData.billboard = true;
  return g;
}

/** 한낮의 옅은 구름 — 하늘이 비어 보이지 않게 */
function buildDayCloud() {
  const puff = (r, x, y) => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 12),
      glowMaterial('#FFFFFF', { opacity: 0.62, depthWrite: false })
    );
    m.position.set(x, y, 0);
    return m;
  };
  const g = group(puff(1, -0.7, 0), puff(1.3, 0.1, 0.14), puff(0.86, 0.9, -0.04));
  g.userData.billboard = true;
  return g;
}

/* ------------------------------------------------------------------ */
/* 앱 속 세상 — 떠 있는 UI                                             */
/* ------------------------------------------------------------------ */

/**
 * 공중에 떠 있는 앱 카드.
 *
 * 이 시장이 스마트폰 앱 안이라는 것을 텍스트 없이 알려 주는 장치다.
 * 둥근 흰 카드 위에 감정 색 띠 하나와 회색 본문 줄 두 개 — 딱 그만큼만
 * 그려도 "상품 카드" 로 읽힌다.
 */
function buildUiCard(spec) {
  const color = EMOTION[spec.emotion] || EMOTION.empathy;

  const card = box(1.5, 1.0, 0.09, flatMaterial(UI_CARD), [0, 0, 0]);
  const thumb = box(1.24, 0.44, 0.04, glowMaterial(color, { transparent: false }), [
    0,
    0.22,
    0.06,
  ]);
  const lineA = box(1.0, 0.09, 0.03, flatMaterial(UI_PANEL), [-0.1, -0.14, 0.06]);
  const lineB = box(0.62, 0.09, 0.03, flatMaterial(UI_PANEL), [-0.29, -0.32, 0.06]);
  // 가격표 — 추억 한 조각
  const price = blob(0.08, 0, glowMaterial(MEMORY_GOLD, { transparent: false }), [
    0.55,
    -0.3,
    0.07,
  ]);

  const g = group(card, thumb, lineA, lineB, price);
  g.userData.kind = 'uiCard';
  return g;
}

/** 알림 토스트 — 새 거래가 올라왔다는 팝업 */
function buildToastPopup() {
  const panel = box(1.7, 0.5, 0.09, flatMaterial(UI_CARD), [0, 0, 0]);
  const dot = blob(0.12, 0, glowMaterial(EMOTION.joy, { transparent: false }), [
    -0.62,
    0,
    0.06,
  ]);
  const lineA = box(0.72, 0.08, 0.03, flatMaterial(UI_PANEL), [0.06, 0.11, 0.06]);
  const lineB = box(0.48, 0.08, 0.03, flatMaterial(UI_PANEL), [-0.06, -0.09, 0.06]);
  const badge = blob(0.11, 0, glowMaterial(SUSPICIOUS_RED, { transparent: false }), [
    0.74,
    0.19,
    0.06,
  ]);
  return group(panel, dot, lineA, lineB, badge);
}

/**
 * 로딩 스피너.
 * 링의 일부만 밝게 두고 아주 느리게 돌린다. 앱이 무언가를 불러오는 중이라는,
 * 이 세계가 프로그램 안이라는 신호.
 */
function buildLoadingRing() {
  const track = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.07, 6, 20),
    glowMaterial(UI_PANEL, { opacity: 0.5, depthWrite: false })
  );
  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.08, 6, 20, Math.PI * 0.6),
    glowMaterial(PALETTE.accent, { transparent: false })
  );
  arc.name = 'spinner-arc';

  const spinner = group(track, arc);
  spinner.position.y = 1.5;
  const post = cylinder(0.05, 0.07, 1.5, 6, flatMaterial(UI_FRAME), [0, 0.75, 0]);

  const g = group(post, spinner);
  g.userData.kind = 'loadingRing';
  return g;
}

/* ------------------------------------------------------------------ */
/* 낮의 도시                                                           */
/* ------------------------------------------------------------------ */

/** 횡단보도 — 바닥에 붙는 납작한 흰 줄무늬 */
function buildCrosswalk() {
  const g = group();
  const stripeMat = glowMaterial('#FFFFFF', { opacity: 0.62, depthWrite: false });
  for (let i = 0; i < 5; i += 1) {
    const stripe = box(0.3, 0.02, 1.5, stripeMat, [-0.72 + i * 0.36, 0.014, 0]);
    g.add(stripe);
  }
  return g;
}

/** 가로수 — 한낮의 도시 초록 */
function buildStreetTree() {
  const trunk = cylinder(0.08, 0.12, 0.8, 6, flatMaterial(UI_FRAME_DEEP), [0, 0.4, 0]);
  const leafMat = flatMaterial(SPROUT_GREEN, { emissive: '#12300F' });
  const crown = group(
    blob(0.52, 0, leafMat, [0, 1.16, 0]),
    blob(0.34, 0, leafMat, [0.32, 0.94, 0.1]),
    blob(0.3, 0, leafMat, [-0.28, 0.98, -0.12])
  );
  const planter = cylinder(0.3, 0.34, 0.16, 8, flatMaterial(UI_PANEL), [0, 0.08, 0]);
  return group(planter, trunk, crown);
}


/* ------------------------------------------------------------------ */
/* 랜드마크 — 골목에서 만나는 여섯 장면                                */
/* ------------------------------------------------------------------ */

/** 1. 처음 찜한 감자 — 아직 사지는 않았고, 마음만 담아 두었다 */
function buildWishPotato() {
  const potato = buildEmotionPotato(EMOTION.flutter, { radius: 0.3 });

  // 찜 표시 — 감자를 감싸고 도는 얇은 링
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.035, 4, 16),
    glowMaterial(EMOTION.flutter, { opacity: 0.6, depthWrite: false })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.32;
  ring.name = 'wish-ring';

  const tag = box(0.24, 0.16, 0.03, glowMaterial('#FFFFFF', { opacity: 0.75 }), [
    0,
    0.78,
    0.1,
  ]);

  const g = group(potato, ring, tag);
  g.userData.kind = 'wishPotato';
  return g;
}

/** 2. 감자데이 촬영장 — 감정마다 사연이 있다 */
function buildShortsSpot() {
  const frameMat = flatMaterial(UI_FRAME);

  const stand = cylinder(0.04, 0.06, 0.8, 5, frameMat, [0, 0.4, 0]);
  const ringLight = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.06, 5, 14),
    glowMaterial('#FFF3D2', { opacity: 0.95, depthWrite: true })
  );
  ringLight.position.y = 1.0;
  primeGlow(ringLight, 'ring-light');

  // 세로 폰 프레임
  const phone = box(0.3, 0.54, 0.05, flatMaterial(UI_DEVICE), [0.42, 0.72, 0.05]);
  const screen = box(0.24, 0.46, 0.03, glowMaterial(UI_SCREEN, { opacity: 0.9 }), [
    0.42,
    0.72,
    0.09,
  ]);

  const potato = buildEmotionPotato(EMOTION.joy, { radius: 0.2 });
  potato.position.set(-0.36, 0, 0.1);

  const g = group(stand, ringLight, phone, screen, potato);
  g.userData.kind = 'shortsSpot';
  return g;
}

/** 3. 비어가는 추억 주머니 — 감정을 사는 동안 잃어 가는 것 */
function buildEmptyPouch() {
  const clothMat = flatMaterial(WARM_CLOTH, { emissive: '#3A2110' });

  const pouch = cylinder(0.2, 0.34, 0.5, 8, clothMat, [0, 0.25, 0]);
  const tie = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.035, 4, 10),
    flatMaterial(UI_FRAME_DEEP)
  );
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 0.5;
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.17, 8), flatMaterial('#6B5240'));
  mouth.rotation.x = -Math.PI / 2;
  mouth.position.y = 0.52;

  // 남은 조각 두 개가 주머니 위로 떠오른다
  const shards = group();
  shards.name = 'pouch-shards';
  shards.position.y = 0.1;
  for (const [sx, sy, sz] of [
    [0.16, 0.66, 0.06],
    [-0.14, 0.78, -0.05],
  ]) {
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.1, 0),
      glowMaterial(MEMORY_GOLD, { opacity: 0.9 })
    );
    shard.scale.set(0.75, 1.3, 0.75);
    shard.position.set(sx, sy, sz);
    shards.add(shard);
  }
  // 이미 사라진 자리
  for (const [sx, sy, sz] of [
    [0.3, 1.0, -0.1],
    [-0.26, 1.14, 0.12],
  ]) {
    const ghost = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09, 0),
      glowMaterial(MEMORY_GOLD, { opacity: 0.13, depthWrite: false })
    );
    ghost.scale.set(0.75, 1.3, 0.75);
    ghost.position.set(sx, sy, sz);
    shards.add(ghost);
  }

  const g = group(pouch, tie, mouth, shards);
  g.userData.kind = 'emptyPouch';
  return g;
}

/** 4. 수상한 특가 감자 — 겉에 적힌 이름과 안에 든 마음이 다르다 */
function buildSuspiciousPotato() {
  const potato = buildEmotionPotato(EMOTION.sorry, {
    radius: 0.32,
    coreName: 'suspicious-core',
  });

  // 반값 팻말 — 기울어져 있다
  const post = cylinder(0.03, 0.04, 0.5, 5, flatMaterial('#A85F63'), [0.4, 0.25, 0.1]);
  const board = box(0.34, 0.22, 0.04, flatMaterial(UI_CARD), [0.4, 0.58, 0.1]);
  board.rotation.z = -0.2;
  const stripe = box(0.24, 0.06, 0.02, glowMaterial(SUSPICIOUS_RED, { transparent: false }), [
    0.4,
    0.6,
    0.13,
  ]);
  stripe.rotation.z = -0.2;

  // 발밑의 옅은 붉은 웅덩이 — 이 자리만 색이 다르다
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 12),
    glowMaterial(SUSPICIOUS_RED, { opacity: 0.16, depthWrite: false })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.02;

  const g = group(pool, potato, post, board, stripe);
  primeSuspiciousCore(g);
  g.userData.kind = 'suspiciousPotato';
  return g;
}

/**
 * 5. 마지막 추억 조각.
 *
 * 엄마가 불러 주던 노래, 머리를 빗어 주던 손, 비 오는 날의 우산.
 * 보석이 아니라 "누군가의 소중한 기억" 으로 보여야 하므로, 결정 하나만
 * 두지 않고 작은 기억 상자 위에 얹고 빛 입자로 감싼다.
 */
function buildLastMemory() {
  const woodMat = flatMaterial(WARM_WOOD);

  // 작은 오르골 같은 기억 상자
  const boxBody = box(0.5, 0.28, 0.4, woodMat, [0, 0.14, 0]);
  const boxLid = box(0.54, 0.06, 0.44, flatMaterial('#E8C07A'), [0, 0.31, 0]);
  const hinge = cylinder(0.02, 0.02, 0.4, 5, flatMaterial(UI_FRAME_DEEP), [0, 0.31, -0.2]);
  hinge.rotation.z = Math.PI / 2;
  // 오르골 태엽
  const crank = cylinder(0.02, 0.02, 0.14, 5, flatMaterial(UI_FRAME_DEEP), [0.3, 0.16, 0]);
  crank.rotation.z = Math.PI / 2;

  // 따뜻한 황금빛 결정 — 투명하고 작다
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.2, 0),
    glowMaterial(MEMORY_GOLD, { opacity: 0.85 })
  );
  crystal.scale.set(0.8, 1.35, 0.8);
  crystal.position.y = 0.62;
  crystal.name = 'memory-crystal';

  // 결정을 감싸는 빛 입자
  const motes = group();
  const rand = makeRandom(2211);
  for (let i = 0; i < 7; i += 1) {
    const a = (Math.PI * 2 * i) / 7;
    const r = 0.26 + rand() * 0.12;
    motes.add(
      blob(0.028, 0, glowMaterial('#FFF0C0', { opacity: 0.7, depthWrite: false }), [
        Math.sin(a) * r,
        0.5 + rand() * 0.4,
        Math.cos(a) * r,
      ])
    );
  }

  // 바닥의 따뜻한 빛무리
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 14),
    glowMaterial(MEMORY_GOLD, { opacity: 0.18, depthWrite: false })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.015;

  const g = group(halo, boxBody, boxLid, hinge, crank, crystal, motes);
  g.userData.kind = 'lastMemory';
  return g;
}

/** 6. 무료나눔 벤치 — 감정을 파는 대신 마음을 나누기로 한 자리 */
function buildShareBench() {
  const woodMat = flatMaterial(WARM_WOOD);

  const bench = group();
  bench.add(box(0.9, 0.07, 0.3, woodMat, [0, 0.26, 0]));
  bench.add(box(0.9, 0.24, 0.06, woodMat, [0, 0.4, -0.12]));
  bench.add(box(0.07, 0.26, 0.26, woodMat, [-0.36, 0.13, 0]));
  bench.add(box(0.07, 0.26, 0.26, woodMat, [0.36, 0.13, 0]));

  // 작은 가로등
  const post = cylinder(0.035, 0.05, 1.0, 5, flatMaterial(UI_FRAME_DEEP), [-0.62, 0.5, -0.12]);
  const shade = cone(0.16, 0.18, 6, flatMaterial(UI_PANEL), [-0.62, 1.09, -0.12]);
  shade.rotation.x = Math.PI;
  const lamp = blob(0.08, 0, glowMaterial('#FFE3AE', { opacity: 0.95, depthWrite: true }), [
    -0.62,
    1.0,
    -0.12,
  ]);
  primeGlow(lamp, 'bench-lamp');

  // 벤치 위의 추억 조각과 서툴게 쓴 편지
  const shard = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.1, 0),
    glowMaterial(MEMORY_GOLD, { opacity: 0.9 })
  );
  shard.scale.set(0.75, 1.3, 0.75);
  shard.position.set(0.16, 0.4, 0.02);

  const letter = box(0.22, 0.02, 0.16, flatMaterial(UI_CARD), [-0.14, 0.31, 0.04]);
  letter.rotation.y = 0.3;

  const sprout = buildSprout();
  sprout.position.set(0.6, 0, 0.22);
  sprout.scale.setScalar(0.9);

  const g = group(bench, post, shade, lamp, shard, letter, sprout);
  g.userData.kind = 'shareBench';
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
  getHeightJitter,
  getColorVariation,
  getBlockSpread,
  buildDecoration,
  buildLandmark,
  update,
};
