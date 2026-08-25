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
 *   buildDecoration(spec)    → THREE.Object3D (placeDecorations 스펙을 실제 오브젝트로)
 */

import b612 from './b612.js';
import starryNight from './starryNight.js';
import desertFox from './desertFox.js';
import rose from './rose.js';

export const THEMES = [b612, starryNight, desertFox, rose];

export const DEFAULT_THEME_ID = b612.id;

/** id 로 테마를 찾는다. 없으면 기본 테마. */
export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export { b612, starryNight, desertFox, rose };
