/**
 * core/transition.js
 * ---------------------------------------------------------------------------
 * 단일 progress 값(0~1)으로 3D 씬 ↔ 2D 탑다운 스캔 뷰를 보간하는 컨트롤러.
 *
 *   progress = 0 → 3D 씬. 해가 비스듬히 걸려 있고 블록마다 그림자가 누워 있다.
 *   progress = 1 → 탑다운 스캔 뷰 (장식 숨김, 블록 평탄화, 스캔 카드 표시)
 *
 * ── 연출: "그림자 리빌" ─────────────────────────────────────────────
 * 전환의 주인공은 카메라가 아니라 **해**다. 카메라는 앞부분에서 한 번 빠르게
 * 올라가 자리를 잡고, 그 뒤로는 거의 멈춘 채 해가 하는 일을 지켜본다.
 *
 *   1) 0.00~0.34  카메라가 높은 사선(68도)까지 단숨에 올라가고, 그 사이 해는
 *                 오히려 낮게 기운다. 블록마다 그림자가 길게 늘어나 이웃 모듈
 *                 위를 덮으면서 QR 격자가 명암에 파묻혀 읽을 수 없게 된다.
 *   2) 0.20~0.80  해가 천정으로 떠오른다. 그림자가 제 발자국으로 물러나면서
 *                 어질러져 있던 명암이 걷히고 QR 격자가 또렷해진다.
 *                 = 이 풍경이 사실 QR 이었다는 것이 빛으로 드러난다.
 *   3) 0.56~1.00  블록이 내려앉아 평평해지고 색이 스캔 색으로 수렴한다.
 *   4) 0.72~1.00  카메라가 마지막으로 정수리까지 올라가고 스캔 카드가 덮는다.
 *
 * 그림자 길이는 실제 광학과 같게 h / tan(태양고도) 로 계산한다. 해가 천정에
 * 서면 길이가 정확히 0 이 되어 그림자는 자기 모듈 발자국 안으로 사라진다.
 * 연출과 물리가 어긋나는 지점이 없다.
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
  elevation3d: 36, // 지평선 기준 올려본 각도(도)
  azimuth3d: 45, // 아이소메트릭 느낌의 사선 방위각(도)

  /**
   * 2D 스캔 뷰 카메라.
   * FOV 를 아주 작게 주고 멀리 떨어뜨려 원근 왜곡이 거의 없는
   * (= 정사영에 가까운) 탑다운 뷰를 만든다. 스캔 성공률의 핵심.
   */
  fov2d: 7,
  elevation2d: 89.4, // 90도는 up 벡터가 특이점이 되므로 살짝 눕힌다
  azimuth2d: 0,

  /**
   * 중간 관람석.
   *
   * 그림자는 블록 사이 낮은 면(= light 모듈 윗면)에 떨어지는데, 낮은 사선에서는
   * 그 면이 앞쪽 블록에 완전히 가려 그림자가 한 톨도 보이지 않는다. 그래서
   * 카메라를 먼저 이 높은 사선까지 올려 두고, 거기서 해가 하는 일을 지켜본다.
   * 68도면 블록 뒤로 숨는 폭이 0.4모듈 정도라 골목 바닥이 대부분 드러난다.
   */
  fovWatch: 34,
  elevationWatch: 68,
  azimuthWatch: 20,

  /** 카메라가 관람석까지 올라가는 구간 (전환 앞부분에서 빠르게) */
  camLiftEnd: 0.34,
  /** 관람석에서 정수리까지 마지막으로 올라가는 구간 */
  camSettleStart: 0.72,

  /* --- 해(그림자 리빌의 주인공) ---------------------------------- */

  /** 도입부에서 해가 잠깐 내려앉는 고도(도). 그림자가 가장 길어지는 지점 */
  sunElevationLow: 15,
  /** 마지막에 해가 서는 고도(도). 90도 = 그림자 길이 0 = 모듈 발자국 */
  sunElevationHigh: 90,
  /** 해가 기우는 구간 → 다시 떠오르는 구간 (두 값이 같아야 이어진다) */
  sunDipEnd: 0.2,
  sunRiseEnd: 0.8,
  /**
   * 해의 방위각이 최종 카메라 방위(azimuth2d)로 도는 구간.
   * 마지막에 그림자가 카메라 반대편으로 눕기 때문에 블록 뒤로 깨끗이 접힌다.
   */
  sunSwingStart: 0.05,
  sunSwingEnd: 0.72,
  /** 그림자가 아무리 길어져도 이 길이(모듈)를 부드럽게 넘지 않는다 */
  maxShadowLength: 14,

  /** 그림자 농도: 평상시 → 수렴할 때 짙어짐 → 스캔 카드에 자리를 내주며 소멸 */
  shadowOpacityRest: 0.34,
  shadowOpacityPeak: 0.56,
  shadowFadeStart: 0.84,
  shadowFadeEnd: 0.97,

  /* --- 블록 · 장식 ------------------------------------------------ */

  /** 블록 XZ 스케일: 2D 에서는 반드시 1.0 (모듈 사이 틈이 없어야 스캔됨) */
  blockScale3d: 0.88,
  blockScale2d: 1.0,

  /** 2D 스캔 뷰에서의 블록 높이 (거의 평면) */
  darkHeight2d: 0.3,
  lightHeight2d: 0.08,

  /**
   * 블록이 자기 그림자 자리로 내려앉는 구간.
   * 그림자가 이미 발자국으로 수렴한 뒤에 시작해야 "그림자와 블록이 만나
   * 하나가 된다" 로 읽힌다.
   */
  sinkStart: 0.56,
  sinkEnd: 0.96,

  /**
   * 큰 장식(나무·화산·우물 등) 페이드아웃 구간.
   * 긴 그림자를 드리우는 동안은 남아 있어야 하므로 해가 떠오른 뒤에 사라진다.
   */
  decorFadeStart: 0.4,
  decorFadeEnd: 0.74,

  /** 테마 색상 → 스캔 색상으로 수렴하는 구간 */
  flattenStart: 0.58,
  flattenEnd: 0.94,

  /** 블록 XZ 스케일이 1.0 으로 닫히는 구간 */
  tightenStart: 0.5,
  tightenEnd: 0.92,

  /**
   * 구면 곡률(B612)이 평면으로 펴지는 구간.
   * 그림자도 정점 셰이더에서 같은 곡률을 따라가므로(makeShadowMaterial)
   * 작은 행성의 모양을 전환 중반까지 넉넉히 남겨둘 수 있다.
   */
  flattenCurveStart: 0.1,
  flattenCurveEnd: 0.55,

  /**
   * 스캔 카드(정확히 1×1 모듈로 이루어진 테마 색상 QR 판)가 페이드인되는 구간.
   * 아래에 깔린 테마 블록도 같은 스캔 색상 · 같은 조명으로 수렴하므로
   * 교체되는 순간이 눈에 띄지 않는다.
   */
  scanOverlayStart: 0.9,
  scanOverlayEnd: 1,

  /** 전환 소요 시간(초) — 그림자가 훑고 지나가는 시간이 필요하다 */
  duration: 1.85,
};

/* ------------------------------------------------------------------ */
/* 그림자 수학                                                          */
/* ------------------------------------------------------------------ */

/**
 * 평행광 아래에서 높이 h 인 물체가 드리우는 그림자의 길이.
 *
 * 기본은 실제 광학과 같은 h / tan(고도) 이지만, 해가 아주 낮을 때 그림자가
 * 화면 밖까지 뻗어 나가면 화면이 지저분해지므로 max 로 완만히 수렴시킨다.
 * (1 - e^-x) 형태라 짧은 그림자는 거의 그대로 두고 긴 그림자만 눌린다.
 *
 * @param {number} height 그림자를 받는 면 위로 솟은 높이
 * @param {number} sunElevationDeg 태양 고도(도)
 * @param {number} [max] 부드럽게 수렴할 최대 길이
 * @returns {number}
 */
export function shadowLength(
  height,
  sunElevationDeg,
  max = TRANSITION.maxShadowLength
) {
  if (height <= 0) return 0;
  const el = clamp(sunElevationDeg, 0.5, 90) * DEG;
  const raw = height / Math.tan(el);
  return max * (1 - Math.exp(-raw / max));
}

/** from 에서 to 로 갈 때 360도를 넘지 않는 최단 경로의 목표각 */
export function shortestAngle(from, to) {
  const delta = (((to - from + 180) % 360) + 360) % 360 - 180;
  return from + delta;
}

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

    // 프레임이 길어져도(저사양 기기) 전환이 느려지지 않도록 넉넉히 잡는다.
    const step = Math.min(dt, 0.12) / this.duration;
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
 * @param {number} [ctx.sunElevation3d] 테마가 배치한 태양의 고도(도)
 * @param {number} [ctx.sunAzimuth3d] 테마가 배치한 태양의 방위각(도)
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
    blockSpread = TRANSITION.blockScale3d,
    sunElevation3d = 34,
    sunAzimuth3d = -40,
  } = ctx;

  /* --- 해 ------------------------------------------------------- */

  // 1) 테마가 놓은 자리에서 잠깐 더 기울었다가 2) 천정까지 떠오른다.
  // 어떤 테마에서 시작하든 같은 지점(sunElevationLow)을 지나므로
  // 그림자가 길게 눕는 순간이 여섯 테마 모두에서 똑같이 만들어진다.
  const sunElevation =
    p <= TRANSITION.sunDipEnd
      ? lerp(
          sunElevation3d,
          TRANSITION.sunElevationLow,
          easeInOutCubic(p / TRANSITION.sunDipEnd)
        )
      : lerp(
          TRANSITION.sunElevationLow,
          TRANSITION.sunElevationHigh,
          // 그림자 길이는 1/tan(고도) 라 낮은 각도에서 급격히 변한다.
          // 고도를 선형으로 올리면 그림자가 초반에 훅 사라져 버리므로,
          // 낮게 머물다 뒤로 갈수록 빨라지는 곡선을 써서 그림자가 물러나는
          // 속도를 눈에 고르게 만든다.
          Math.pow(
            clamp(
              (p - TRANSITION.sunDipEnd) /
                (TRANSITION.sunRiseEnd - TRANSITION.sunDipEnd)
            ),
            1.7
          )
        );

  const sunAzimuth = lerp(
    sunAzimuth3d,
    shortestAngle(sunAzimuth3d, TRANSITION.azimuth2d),
    easeInOutCubic(
      smoothstep(TRANSITION.sunSwingStart, TRANSITION.sunSwingEnd, p)
    )
  );

  const shadowStrength =
    lerp(
      TRANSITION.shadowOpacityRest,
      TRANSITION.shadowOpacityPeak,
      smoothstep(0, 0.45, p)
    ) *
    (1 - smoothstep(TRANSITION.shadowFadeStart, TRANSITION.shadowFadeEnd, p));

  /* --- 카메라 (2단: 관람석까지 → 정수리까지) ---------------------- */

  // 1단. 그림자가 보이는 높은 사선까지 먼저 올라간다.
  const lift = easeInOutCubic(smoothstep(0, TRANSITION.camLiftEnd, p));
  // 2단. 해가 제 할 일을 끝낸 뒤에야 정수리로 마저 올라간다.
  const settle = easeInOutCubic(smoothstep(TRANSITION.camSettleStart, 1, p));

  const stage = (from, watch, to) =>
    lerp(lerp(from, watch, lift), to, settle);

  const fov = stage(TRANSITION.fov3d, TRANSITION.fovWatch, TRANSITION.fov2d);
  const elevation = stage(
    TRANSITION.elevation3d,
    TRANSITION.elevationWatch,
    TRANSITION.elevation2d
  );
  const azimuth = stage(
    TRANSITION.azimuth3d,
    TRANSITION.azimuthWatch,
    TRANSITION.azimuth2d
  );

  // 3D 에서는 장식까지 담을 여유를, 관람석에서는 길게 뻗은 그림자가 화면 안에
  // 들어오도록 넉넉히, 2D 에서는 QR 판 + 그 바깥 풍경이 살짝 보이도록 남긴다.
  // (탑다운 뷰가 "검은 QR" 이 아니라 "위에서 본 풍경" 으로 읽히게 하는 핵심)
  const halfSpan = stage(
    matrixSize * 0.72 + 7,
    matrixSize / 2 + quietZone + 11,
    matrixSize / 2 + quietZone + 7.5
  );
  const distance = fitDistance(fov, aspect, halfSpan);

  /* --- 블록 ------------------------------------------------------ */

  const tighten = smoothstep(TRANSITION.tightenStart, TRANSITION.tightenEnd, p);
  // 3D 뷰의 블록 간격은 테마가 정한다.
  // 사막의 사구처럼 "덩어리" 로 읽혀야 하는 테마는 틈을 거의 두지 않는다.
  const blockScaleXZ = lerp(blockSpread, TRANSITION.blockScale2d, tighten);

  // 그림자가 발자국으로 수렴한 뒤에야 블록이 그 자리로 내려앉는다.
  const sink = easeInOutCubic(
    smoothstep(TRANSITION.sinkStart, TRANSITION.sinkEnd, p)
  );
  const darkHeight = lerp(darkHeight3d, TRANSITION.darkHeight2d, sink);
  const lightHeight = lerp(lightHeight3d, TRANSITION.lightHeight2d, sink);

  const decorOpacity =
    1 - smoothstep(TRANSITION.decorFadeStart, TRANSITION.decorFadeEnd, p);

  const flat = smoothstep(TRANSITION.flattenStart, TRANSITION.flattenEnd, p);

  const bend =
    curvature *
    (1 - smoothstep(TRANSITION.flattenCurveStart, TRANSITION.flattenCurveEnd, p));

  return {
    progress: p,
    /** 카메라가 3D 사선에서 탑다운까지 온 정도 */
    t: settle,
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
    /** 태양 고도(도). 그림자 길이와 테마 키라이트 위치를 함께 결정한다 */
    sunElevation,
    /** 태양 방위각(도). 카메라와 같은 좌표계(0도 = +Z) */
    sunAzimuth,
    /** 그림자 불투명도 */
    shadowStrength,
    /** 안개를 걷어내는 정도 (스캔 카드가 오기 전에 대비를 확보한다) */
    fogRelease: smoothstep(0.35, 0.8, p),
    /**
     * 스캔 조명 리그의 세기.
     * 스캔 뷰에서도 조명을 완전히 끄지 않고 부드러운 톱라이트를 유지해
     * 타일이 종이가 아니라 낮은 복셀 블록처럼 보이게 한다.
     */
    scanLighting: smoothstep(0.55, 0.95, p),
    /** 스캔 보장 오버레이 불투명도 */
    scanOverlay: smoothstep(
      TRANSITION.scanOverlayStart,
      TRANSITION.scanOverlayEnd,
      p
    ),
    /**
     * 3D 자유 조작(드래그/자동회전) 허용 정도.
     * 그림자가 훑고 지나가는 동안은 살아 있어야 한다 — 천천히 도는 카메라
     * 아래에서 그림자가 움직이는 게 이 연출의 볼거리다.
     */
    interactivity: 1 - smoothstep(0.28, 0.62, p),
  };
}
