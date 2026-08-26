/**
 * core/scanColors.js
 * ---------------------------------------------------------------------------
 * 탑다운 스캔 뷰의 모듈 색을 정한다.
 *
 * 목표는 두 가지이고, 보통은 서로 충돌한다.
 *   1. 3D 씬의 색을 최대한 그대로 남긴다 (잎의 초록, 벽돌의 주황, 밤의 남색…)
 *   2. QR 이 확실히 읽혀야 한다 (dark/light 사이에 충분한 명암차)
 *
 * 해법: **색상(hue)과 채도는 그대로 두고 명도만 안전 대역으로 끌어당긴다.**
 * 밝은 잎 초록은 어두운 잎 초록이 되지만 "초록" 이라는 정체성은 남는다.
 *
 * 이 모듈은 Three.js 에 의존하지 않는 순수 계산 계층이다.
 */

/**
 * 렌더 이득 — 스캔 조명(앰비언트 1.55 + 키 1.35)이 윗면 albedo 에 곱하는 계수.
 * 화면에 실제로 찍히는 값으로 판정해야 하므로 미리 반영한다.
 */
export const RENDER_GAIN = 0.888;

/**
 * 모듈 색이 지켜야 하는 밝기 — "대역" 이 아니라 **하나의 값** 이다.
 *
 * 실제 QR 디코더(ZXing / jsQR)의 바이너라이저는 8×8 픽셀 블록마다 임계값을 정하는데,
 * 블록 안의 max−min 이 24/255 를 넘으면 **그 블록의 평균**을 임계값으로 삼는다.
 * 그래서 서로 붙은 dark 모듈끼리 밝기가 다르면, 두 모듈 사이에 걸친 블록에서
 * 밝은 쪽 dark 모듈이 light 로 뒤집혀 코드가 깨진다.
 * (모듈이 커서 블록이 모듈 안에 통째로 들어갈 때 특히 잘 터진다)
 *
 * 그러니 **밝기는 모두 같은 값으로 맞추고, 색상(hue)과 채도만 달리한다.**
 * 눈에는 여러 색의 모자이크로 보이지만 디코더에는 균일한 흑백으로 보인다.
 */
/*
 * 실측으로 정한 값이다.
 *
 * URL 5종 × 테마 6종 × 축소 9단계(네이티브 1400px 포함) 디코딩과,
 * 저장 PNG(1240px) 직접 디코딩으로 여러 후보를 재 봤다.
 *
 *   0.14 → 축소 스윕 268/270(99%), 저장 PNG 36/36(100%)
 *   0.18 → 1400px 27/30(90%)
 *   0.22 → 1400px 26/30(87%), 저장 PNG 29/36(81%)
 *
 * 모듈이 아주 클 때(≈48px/모듈) 디코더의 균일 블록 폴백이 "순수 검정이 아닌"
 * 색을 흰색으로 밀어 버리는 경우가 생기고, 밝을수록 그 확률이 올라간다.
 * 화면을 캡처해 공유한 이미지를 갤러리 앱이 파일째 읽는 경우가 실제로 있으므로
 * 안전한 쪽을 골랐다. 0.14 에서도 색상은 테마 고유의 색으로 또렷하게 남는다.
 */
export const DARK_GRAY = 0.14;
export const LIGHT_GRAY = 0.9;

/**
 * 등가중·녹색가중 그레이가 벌어져도 되는 최대 폭.
 * 팔레트 안 밝기 편차를 8×8 블록 한계(24/255 ≈ 0.094) 아래로 묶어 준다.
 */
export const MAX_DIVERGENCE = 0.045;

/* ------------------------------------------------------------------ */
/* 색 변환                                                             */
/* ------------------------------------------------------------------ */

/** sRGB 성분(0~1) → 선형 */
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** 선형 성분(0~1) → sRGB */
export function linearToSrgb(c) {
  const v = Math.min(Math.max(c, 0), 1);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/** '#RRGGBB' → 선형 [r, g, b] */
export function hexToLinear(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) =>
    srgbToLinear(parseInt(value.slice(i, i + 2), 16) / 255)
  );
}

/** 선형 [r, g, b] → '#RRGGBB' */
export function linearToHex(rgb) {
  return (
    '#' +
    rgb
      .map((c) =>
        Math.round(linearToSrgb(c) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

/** 선형 RGB 의 상대휘도 */
export function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 두 색의 명암비 (WCAG) */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ------------------------------------------------------------------ */
/* 명도 보정                                                           */
/* ------------------------------------------------------------------ */

/**
 * 실제 바이너라이저가 보는 그레이스케일 (sRGB 성분 등가중 평균).
 * jsQR 계열이 쓰는 방식.
 * @param {number[]} rgb 선형 RGB
 */
export function meanGray(rgb) {
  return (linearToSrgb(rgb[0]) + linearToSrgb(rgb[1]) + linearToSrgb(rgb[2])) / 3;
}

/**
 * 녹색에 가중치를 둔 그레이스케일 (r + 2g + b) / 4.
 * ZXing 계열이 쓰는 방식이라 안드로이드·iOS 스캐너가 이쪽인 경우가 많다.
 * @param {number[]} rgb 선형 RGB
 */
export function greenWeightedGray(rgb) {
  const r = linearToSrgb(rgb[0]);
  const g = linearToSrgb(rgb[1]);
  const b = linearToSrgb(rgb[2]);
  return (r + 2 * g + b) / 4;
}

/**
 * 두 방식 중 더 밝게 보는 쪽.
 * 어느 디코더로 봐도 충분히 어둡게 만들려면 이 값을 기준으로 잡아야 한다.
 */
export function maxGray(rgb) {
  return Math.max(meanGray(rgb), greenWeightedGray(rgb));
}

/** 두 방식이 얼마나 다르게 보는지 */
export function grayDivergence(rgb) {
  return Math.abs(meanGray(rgb) - greenWeightedGray(rgb));
}

/** 화면에 찍히는 값 (조명 이득 반영) */
function rendered(rgb) {
  return rgb.map((c) => c * RENDER_GAIN);
}

/**
 * 색상(hue)과 채도는 최대한 유지한 채, 화면에 찍히는 밝기를 목표값에 맞춘다.
 *
 * 선형 RGB 를 그대로 곱하는 동안에는 색상과 채도가 **정확히** 보존된다.
 * 그래서 밝기가 모자라도 먼저 곱해서 올리고, 채널이 1 에 닿아 더 못 올릴 때만
 * 흰색과 섞는다. (처음엔 어두운 색을 곧장 흰색과 섞었는데, 채도가 다 빠져
 * 초록이 초록으로 안 보이는 탁한 색이 됐다)
 *
 * 기준은 등가중·녹색가중 중 **더 밝게 보는 쪽**이다.
 * 어느 디코더로 읽어도 목표보다 밝아지지 않는다.
 *
 * @param {number[]} rgb 선형 RGB
 * @param {number} targetGray 화면에 찍히는 등가중 그레이 목표값
 * @returns {number[]} 선형 RGB
 */
export function matchGray(rgb, targetGray) {
  const grayOf = (candidate) => maxGray(rendered(candidate));
  const scale = (k) => rgb.map((c) => c * k);

  // 어떤 채널도 1 을 넘지 않는 최대 배율 — 여기까지는 채도가 그대로다
  const maxChannel = Math.max(rgb[0], rgb[1], rgb[2], 1e-6);
  const kMax = 1 / maxChannel;

  if (grayOf(scale(kMax)) >= targetGray) {
    let lo = 0;
    let hi = kMax;
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      if (grayOf(scale(mid)) > targetGray) hi = mid;
      else lo = mid;
    }
    return scale((lo + hi) / 2);
  }

  // 최대로 밝혀도 모자라면(= 아주 짙은 색) 흰색과 섞어 마저 올린다
  const brightest = scale(kMax);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    const mixed = brightest.map((c) => c + (1 - c) * mid);
    if (grayOf(mixed) > targetGray) hi = mid;
    else lo = mid;
  }
  const t = (lo + hi) / 2;
  return brightest.map((c) => c + (1 - c) * t);
}

/* ------------------------------------------------------------------ */
/* 셀별 색 배정                                                        */
/* ------------------------------------------------------------------ */

/**
 * 결정론적 셀 노이즈 (엔진의 것과 같은 계열, 시드만 다르게 쓴다)
 */
export function noise2d(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * 테마 색 목록을 "밝기는 같고 색상만 다른" 스캔 팔레트로 만든다.
 *
 * @param {string[]} colors 테마의 3D 색상들 ('#RRGGBB')
 * @param {number} targetGray DARK_GRAY 또는 LIGHT_GRAY
 * @returns {number[][]} 선형 RGB 배열
 */
export function buildScanPalette(colors, targetGray) {
  const list = colors?.length ? colors : ['#202020'];
  return list.map((hex) =>
    matchGray(limitDivergence(hexToLinear(hex), MAX_DIVERGENCE), targetGray)
  );
}

/**
 * 등가중과 녹색가중이 너무 다르게 보는 색은 채도를 조금 낮춘다.
 *
 * 두 지표가 크게 벌어지는 색(아주 진한 초록 ↔ 아주 진한 빨강)이 한 팔레트에
 * 섞이면, 한쪽 지표로 볼 때 팔레트 안 밝기 편차가 8×8 블록 한계(24/255)를
 * 넘어 인접한 dark 모듈끼리 갈라진다. 필요한 만큼만 중성 쪽으로 당긴다.
 *
 * @param {number[]} rgb 선형 RGB
 * @param {number} limit 허용 발산 폭
 * @returns {number[]} 선형 RGB
 */
export function limitDivergence(rgb, limit) {
  if (grayDivergence(rgb) <= limit) return rgb.slice();

  const neutral = (rgb[0] + rgb[1] + rgb[2]) / 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    const mixed = rgb.map((c) => c + (neutral - c) * mid);
    if (grayDivergence(mixed) > limit) lo = mid;
    else hi = mid;
  }
  return rgb.map((c) => c + (neutral - c) * hi);
}

/**
 * 셀 하나에 팔레트 색을 고른다.
 *
 * 순수 난수로 고르면 소금·후추처럼 흩어져 지저분하다.
 * 굵은 노이즈로 덩어리를 만들고, 일부 셀만 다른 색으로 튀게 해
 * 잎 뭉치처럼 뭉쳐 보이게 한다.
 *
 * @param {number[][]} palette
 * @param {number} col
 * @param {number} row
 * @param {number} [seed]
 * @returns {number[]} 선형 RGB
 */
export function pickCellColor(palette, col, row, seed = 0) {
  if (palette.length === 1) return palette[0];

  const coarse = noise2d(col >> 1, row >> 1, seed);
  const speckle = noise2d(col, row, seed + 7);

  let index = Math.floor(coarse * palette.length);
  if (speckle > 0.74) {
    index = Math.floor(noise2d(col, row, seed + 13) * palette.length);
  }

  return palette[Math.min(index, palette.length - 1)];
}
