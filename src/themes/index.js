/**
 * themes/index.js
 * ---------------------------------------------------------------------------
 * 테마 레지스트리. 공통 엔진 위에 플러그인처럼 갈아끼운다.
 *
 * 모든 테마 모듈은 아래 인터페이스를 따른다.
 *   getBlockGeometry(isDark) → { geometry, material, height }
 *   getPalette()             → { dark, light, ground, sky, scanDark, scanLight, ... }
 *   placeDecorations(size)   → [{ type, position, rotation, scale, ... }]
 *   getBackgroundSetup()     → { background, fog, lights, objects }
 * 선택 확장
 *   getCurvature()           → 구면 배치 강도(0 = 평면)
 *   getHeightJitter()        → 셀별 높이 흔들기 정도(사구·스카이라인)
 *   getGroundDisplacement()  → 장면 바닥의 절차적 높이 변형(사구 등)
 *   buildDecoration(spec)    → THREE.Object3D (placeDecorations 스펙을 실제 오브젝트로)
 *   placeLandmarks(size, m)  → 1인칭 탐험 중 발견하는 지점 배열
 *     (_shared.js 의 pickConnectedCells 를 쓰면 실제로 걸어서 닿는 자리만
 *      고른다. pickWalkableCells 는 연결성을 보장하지 않는다.)
 *   update(dt, ctx)          → 프레임마다 호출 (예: 도시의 자동차, 연못 물결)
 */

import b612 from './b612.js';
import starryNight from './starryNight.js';
import desertFox from './desertFox.js';
import rose from './rose.js';
import cityNight from './cityNight.js';
import forestRest from './forestRest.js';
import gamjaMarket from './gamjaMarket.js';
import moreumpyoExpedition from './moreumpyoExpedition.js';

export const THEMES = [
  b612,
  starryNight,
  desertFox,
  rose,
  cityNight,
  forestRest,
  gamjaMarket,
  moreumpyoExpedition,
];

export const DEFAULT_THEME_ID = b612.id;

/** id 로 테마를 찾는다. 없으면 기본 테마. */
export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export {
  b612,
  starryNight,
  desertFox,
  rose,
  cityNight,
  forestRest,
  gamjaMarket,
  moreumpyoExpedition,
};
