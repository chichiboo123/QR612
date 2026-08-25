/**
 * core/transition.js
 * ---------------------------------------------------------------------------
 * 단일 progress 값(0~1)으로 3D 아이소메트릭 씬 ↔ 2D 탑다운 스캔 뷰를
 * 보간하는 컨트롤러.
 *
 *   progress = 0 → 완전한 아이소메트릭 3D 씬 (장식 오브젝트 표시, 블록 높이 최대)
 *   progress = 1 → 완전한 탑다운 스캔 뷰 (장식 숨김, 블록 평탄화, 순수 흑백 대비)
 *
 * 이 모듈은 Three.js 에 의존하지 않는 순수 수학 계층이다.
 */

export const DEG = Math.PI / 180;

export function clamp(v, min = 0, max = 1) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Hermite smoothstep. edge0 이하 → 0, edge1 이상 → 1 */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function easeInOutCubic(t) {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/* ------------------------------------------------------------------ */
/* 전환 파라미터 (튜닝 지점을 한곳에 모아둔다)                          */
/* ------------------------------------------------------------------ */

export const TRANSITION = {
  /** 3D 뷰 카메라 */
  fov3d: 42,
  elevation3d: 31, // 지평선 기준 올려본 각도(도)
  azimuth3d: 45, // 아이소메트릭 느낌의 사선 방위각(도)

  /**
   * 2D 스캔 뷰 카메라.
   * FOV 를 아주 작게 주고 멀리 떨어뜨려 원근 왜곡이 거의 없는
   * (= 정사영에 가까운) 탑다운 뷰를 만든다. 스캔 성공률의 핵심.
   */
  fov2d: 7,
  elevation2d: 89.4, // 90도는 up 벡터가 특이점이 되므로 살짝 눕힌다
  azimuth2d: 0,

  /** 블록 XZ 스케일: 2D 에서는 반드시 1.0 (모듈 사이 틈이 없어야 스캔됨) */
  blockScale3d: 0.88,
  blockScale2d: 1.0,

  /** 2D 스캔 뷰에서의 블록 높이 (거의 평면) */
  darkHeight2d: 0.3,
  lightHeight2d: 0.08,

  /** 장식 오브젝트 페이드아웃 구간 */
  decorFadeStart: 0.02,
  decorFadeEnd: 0.42,

  /** 색상 평탄화(조명 무시, 순수 스캔 색상) 구간 */
  flattenStart: 0.5,
  flattenEnd: 0.97,

  /** 블록 XZ 스케일이 1.0 으로 닫히는 구간 */
  tightenStart: 0.3,
  tightenEnd: 0.88,

  /** 구면 곡률(B612)이 평면으로 펴지는 구간 */
  flattenCurveStart: 0.12,
  flattenCurveEnd: 0.72,

  /**
   * 스캔 보장 오버레이가 페이드인되는 구간.
   * 마지막 순간에 "정확히 1×1 모듈, 순수 흑백" 평면을 겹쳐 올려
   * 테마가 어떤 지오메트리를 쓰든 스캔 성공률을 보장한다.
   */
  scanOverlayStart: 0.86,
  scanOverlayEnd: 1.0,

  /** 전환 소요 시간(초) */
  duration: 1.15,
};

/* ------------------------------------------------------------------ */
/* 컨트롤러                                                            */
/* ------------------------------------------------------------------ */

/**
 * progress 를 target 으로 부드럽게 이동시키는 컨트롤러.
 * 렌더 루프에서 update(dt) 를 호출하고, 반환값이 true 일 때만 씬을 갱신한다.
 */
export class TransitionController {
  constructor({ duration = TRANSITION.duration, onChange = null } = {}) {
    this.duration = duration;
    this.progress = 0;
    this.target = 0;
    this.onChange = onChange;
    this._settled = true;
  }

  /** 0 ↔ 1 토글 */
  toggle() {
    this.setTarget(this.target > 0.5 ? 0 : 1);
    return this.target;
  }

  setTarget(value) {
    const next = clamp(value);
    if (next === this.target) return;
    this.target = next;
    this._settled = false;
    this.onChange?.(this.target);
  }

  /** 애니메이션 없이 즉시 이동 */
  jumpTo(value) {
    this.progress = clamp(value);
    this.target = this.progress;
    this._settled = true;
    this.onChange?.(this.target);
  }

  get isScanView() {
    return this.target > 0.5;
  }

  get settled() {
    return this._settled;
  }

  /**
   * @param {number} dt 초 단위 델타 타임
   * @returns {boolean} progress 가 변했는지 여부
   */
  update(dt) {
    if (this._settled) return false;

    const step = Math.min(dt, 0.05) / this.duration;
    const diff = this.target - this.progress;

    if (Math.abs(diff) <= step) {
      this.progress = this.target;
      this._settled = true;
      return true;
    }

    this.progress += Math.sign(diff) * step;
    return true;
  }
}

/* ------------------------------------------------------------------ */
/* 상태 계산                                                           */
/* ------------------------------------------------------------------ */

/**
 * 카메라가 halfSpan 반경을 화면에 담기 위해 필요한 거리.
 * 세로/가로 FOV 를 모두 고려하므로 모바일 세로 화면에서도 잘린 QR 이 나오지 않는다.
 */
export function fitDistance(fovDeg, aspect, halfSpan) {
  const vHalf = Math.tan((fovDeg * DEG) / 2);
  const hHalf = vHalf * Math.max(aspect, 0.0001);
  return Math.max(halfSpan / vHalf, halfSpan / hHalf);
}

/**
 * progress 로부터 씬 전체의 보간 상태를 계산한다. (순수 함수)
 *
 * @param {number} progress 0~1
 * @param {object} ctx
 * @param {number} ctx.matrixSize QR 한 변의 모듈 수
 * @param {number} ctx.quietZone QR 여백 모듈 수
 * @param {number} ctx.aspect 뷰포트 가로/세로 비율
 * @param {number} [ctx.curvature] 테마 곡률(0 = 평면)
 * @param {number} [ctx.darkHeight3d] 테마별 dark 블록 3D 높이
 * @param {number} [ctx.lightHeight3d] 테마별 light 블록 3D 높이
 * @returns {object} 보간된 씬 상태
 */
export function computeTransitionState(progress, ctx) {
  const p = clamp(progress);
  const {
    matrixSize,
    quietZone = 4,
    aspect = 1,
    curvature = 0,
    darkHeight3d = 2.4,
    lightHeight3d = 0.5,
  } = ctx;

  const t = easeInOutCubic(p);

  const fov = lerp(TRANSITION.fov3d, TRANSITION.fov2d, t);
  const elevation = lerp(TRANSITION.elevation3d, TRANSITION.elevation2d, t);
  const azimuth = lerp(TRANSITION.azimuth3d, TRANSITION.azimuth2d, t);

  // 3D 에서는 장식까지 담을 여유를, 2D 에서는 QR + quiet zone 만 정확히 담는다.
  const halfSpan3d = matrixSize * 0.62 + 4;
  const halfSpan2d = matrixSize / 2 + quietZone + 0.6;
  const halfSpan = lerp(halfSpan3d, halfSpan2d, t);
  const distance = fitDistance(fov, aspect, halfSpan);

  const tighten = smoothstep(TRANSITION.tightenStart, TRANSITION.tightenEnd, p);
  const blockScaleXZ = lerp(
    TRANSITION.blockScale3d,
    TRANSITION.blockScale2d,
    tighten
  );

  const darkHeight = lerp(darkHeight3d, TRANSITION.darkHeight2d, t);
  const lightHeight = lerp(lightHeight3d, TRANSITION.lightHeight2d, t);

  const decorOpacity =
    1 - smoothstep(TRANSITION.decorFadeStart, TRANSITION.decorFadeEnd, p);

  const flat = smoothstep(TRANSITION.flattenStart, TRANSITION.flattenEnd, p);

  const bend =
    curvature *
    (1 -
      smoothstep(
        TRANSITION.flattenCurveStart,
        TRANSITION.flattenCurveEnd,
        p
      ));

  return {
    progress: p,
    t,
    fov,
    elevation,
    azimuth,
    distance,
    blockScaleXZ,
    darkHeight,
    lightHeight,
    decorOpacity,
    flat,
    bend,
    /** 스캔 보장 오버레이 불투명도 */
    scanOverlay: smoothstep(
      TRANSITION.scanOverlayStart,
      TRANSITION.scanOverlayEnd,
      p
    ),
    /** 3D 자유 조작(드래그/자동회전) 허용 정도 */
    interactivity: 1 - smoothstep(0.05, 0.5, p),
  };
}
