/**
 * ui/explorerHud.js — "QR 여행" 1인칭 모드의 화면 오버레이
 *
 * 데스크톱: 마우스로 시점(포인터 락), WASD 이동, Space 점프, Esc 종료
 * 모바일:   왼쪽 조이스틱 이동, 오른쪽 점프 버튼, 빈 곳 드래그로 시점
 */

const LOOK_SENSITIVITY = 0.0026;
const POINTER_LOCK_SENSITIVITY = 0.0022;

/**
 * @param {object} options
 * @param {HTMLElement} options.stage 3D 스테이지 요소
 * @param {HTMLCanvasElement} options.canvas
 * @param {import('../core/explorer.js').Explorer} options.explorer
 * @param {() => void} options.onExit
 */
export function createExplorerHud({ stage, canvas, explorer, onExit }) {
  const root = document.createElement('div');
  root.className = 'explorer-hud';
  root.hidden = true;
  root.innerHTML = `
    <div class="explorer-hud__top">
      <span class="explorer-hud__count" role="status" aria-live="polite">
        <span class="material-icons-outlined" aria-hidden="true">explore</span>
        <span class="explorer-hud__count-text">0 / 0</span>
      </span>
      <div class="explorer-hud__top-actions">
        <button type="button" class="explorer-hud__fullscreen" aria-pressed="false">
          <span class="material-icons-outlined" aria-hidden="true">fullscreen</span>
          <span class="explorer-hud__fullscreen-label">전체화면</span>
        </button>
        <button type="button" class="explorer-hud__exit">
          <span class="material-icons-outlined" aria-hidden="true">close</span>
          여행 끝내기
        </button>
      </div>
    </div>

    <div class="explorer-hud__toast" role="status" aria-live="polite" hidden>
      <span class="explorer-hud__toast-title"></span>
      <span class="explorer-hud__toast-body"></span>
    </div>

    <div class="explorer-hud__crosshair" aria-hidden="true" hidden></div>

    <p class="explorer-hud__tip"></p>

    <div class="explorer-hud__controls">
      <div class="explorer-hud__stick" aria-hidden="true">
        <div class="explorer-hud__stick-knob"></div>
      </div>
      <button type="button" class="explorer-hud__jump">
        <span class="material-icons-outlined" aria-hidden="true">keyboard_double_arrow_up</span>
        점프
      </button>
    </div>
  `;

  const countText = root.querySelector('.explorer-hud__count-text');
  const toast = root.querySelector('.explorer-hud__toast');
  const toastTitle = root.querySelector('.explorer-hud__toast-title');
  const toastBody = root.querySelector('.explorer-hud__toast-body');
  const tip = root.querySelector('.explorer-hud__tip');
  const stick = root.querySelector('.explorer-hud__stick');
  const knob = root.querySelector('.explorer-hud__stick-knob');
  const jumpButton = root.querySelector('.explorer-hud__jump');
  const crosshair = root.querySelector('.explorer-hud__crosshair');
  const fullscreenButton = root.querySelector('.explorer-hud__fullscreen');
  const fullscreenIcon = fullscreenButton.querySelector('.material-icons-outlined');
  const fullscreenLabel = root.querySelector('.explorer-hud__fullscreen-label');

  root.querySelector('.explorer-hud__exit').addEventListener('click', onExit);

  stage.appendChild(root);

  /* --------------------------------------------------------------- */
  /* 조이스틱                                                          */
  /* --------------------------------------------------------------- */

  const STICK_RADIUS = 46;
  let stickPointer = null;
  let stickOrigin = { x: 0, y: 0 };

  stick.addEventListener('pointerdown', (e) => {
    stickPointer = e.pointerId;
    const rect = stick.getBoundingClientRect();
    stickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    stick.setPointerCapture(stickPointer);
    updateStick(e);
    e.preventDefault();
  });

  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickPointer) return;
    updateStick(e);
  });

  const releaseStick = (e) => {
    if (e.pointerId !== stickPointer) return;
    stickPointer = null;
    knob.style.transform = 'translate(0, 0)';
    explorer.setMoveInput(0, 0);
  };
  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);

  function updateStick(e) {
    let dx = e.clientX - stickOrigin.x;
    let dy = e.clientY - stickOrigin.y;
    const length = Math.hypot(dx, dy);
    if (length > STICK_RADIUS) {
      dx = (dx / length) * STICK_RADIUS;
      dy = (dy / length) * STICK_RADIUS;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // 화면 위쪽(-y)이 전진
    explorer.setMoveInput(dx / STICK_RADIUS, -dy / STICK_RADIUS);
  }

  /* --------------------------------------------------------------- */
  /* 점프                                                              */
  /* --------------------------------------------------------------- */

  jumpButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    explorer.jump();
  });

  /* --------------------------------------------------------------- */
  /* 시점 — 드래그 + 포인터 락                                          */
  /* --------------------------------------------------------------- */

  let lookPointer = null;
  let lastLook = { x: 0, y: 0 };
  let lookStart = { x: 0, y: 0 };
  let lookMoved = false;

  function onLookDown(e) {
    if (!explorer.active) return;
    if (e.target.closest('.explorer-hud__controls, .explorer-hud__top')) return;
    lookPointer = e.pointerId;
    lastLook = { x: e.clientX, y: e.clientY };
    lookStart = { x: e.clientX, y: e.clientY };
    lookMoved = false;
    canvas.setPointerCapture?.(lookPointer);
  }

  function onLookMove(e) {
    if (!explorer.active || e.pointerId !== lookPointer) return;
    if (Math.hypot(e.clientX - lookStart.x, e.clientY - lookStart.y) > 10) {
      lookMoved = true;
    }
    explorer.look(
      (e.clientX - lastLook.x) * LOOK_SENSITIVITY,
      (e.clientY - lastLook.y) * LOOK_SENSITIVITY
    );
    lastLook = { x: e.clientX, y: e.clientY };
  }

  function onLookUp(e) {
    if (e.pointerId !== lookPointer) return;
    canvas.releasePointerCapture?.(lookPointer);
    lookPointer = null;

    // 터치에서는 두 번 두드리면 그 지점으로 걸어간다.
    // (마우스는 아래 dblclick 이 맡는다 — 브라우저 기본 판정이 더 정확하다)
    if (e.pointerType === 'touch' && !lookMoved) {
      const now = performance.now();
      const near = Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 32;
      if (now - lastTap.at < 380 && near) {
        lastTap.at = 0;
        walkToPoint(e.clientX, e.clientY);
      } else {
        lastTap = { at: now, x: e.clientX, y: e.clientY };
      }
    }
  }

  /* --- 두 번 두드린 곳으로 이동 -------------------------------------- */

  let lastTap = { at: 0, x: 0, y: 0 };

  /** 화면 좌표를 정규화 좌표로 바꿔 탐험 컨트롤러에 넘긴다 */
  function walkToPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ok = explorer.moveToScreenPoint(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    if (ok) showHint('그곳으로 이동합니다');
  }

  canvas.addEventListener('dblclick', (e) => {
    if (!explorer.active) return;
    e.preventDefault();
    if (document.pointerLockElement === canvas) {
      // 포인터 락 상태에서는 커서가 없으니 화면 한가운데(조준점)를 목적지로 삼는다
      const rect = canvas.getBoundingClientRect();
      walkToPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    } else {
      walkToPoint(e.clientX, e.clientY);
    }
  });

  canvas.addEventListener('pointerdown', onLookDown);
  canvas.addEventListener('pointermove', onLookMove);
  canvas.addEventListener('pointerup', onLookUp);
  canvas.addEventListener('pointercancel', onLookUp);

  // 데스크톱: 캔버스를 클릭하면 포인터 락으로 자연스러운 시점 조작
  function onMouseMove(e) {
    if (!explorer.active || document.pointerLockElement !== canvas) return;
    explorer.look(
      e.movementX * POINTER_LOCK_SENSITIVITY,
      e.movementY * POINTER_LOCK_SENSITIVITY
    );
  }
  document.addEventListener('mousemove', onMouseMove);

  function requestLock() {
    if (!explorer.active) return;
    if (window.matchMedia?.('(hover: none)').matches) return; // 터치 기기는 제외
    canvas.requestPointerLock?.();
  }
  canvas.addEventListener('click', requestLock);

  // 포인터 락에서는 커서가 사라지고 더블클릭 목적지가 화면 한가운데가 되므로,
  // 어디를 겨누는지 보여 주는 조준점이 필요하다.
  function syncCrosshair() {
    crosshair.hidden = !(explorer.active && document.pointerLockElement === canvas);
  }
  document.addEventListener('pointerlockchange', syncCrosshair);

  /* --------------------------------------------------------------- */
  /* 표시 상태                                                         */
  /* --------------------------------------------------------------- */

  let toastTimer = null;

  function showToast(title, body) {
    toastTitle.textContent = title;
    toastBody.textContent = body;
    toast.hidden = false;
    toast.classList.remove('is-in');
    // 재생 중이던 트랜지션을 끊고 다시 시작
    void toast.offsetWidth;
    toast.classList.add('is-in');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-in');
      toastTimer = setTimeout(() => {
        toast.hidden = true;
      }, 260);
    }, 3200);
  }

  /** 토스트보다 가벼운 한 줄 안내 */
  let hintTimer = null;
  function showHint(text) {
    tip.textContent = text;
    tip.classList.add('is-in');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      tip.classList.remove('is-in');
      tip.textContent = baseTip;
    }, 1800);
  }

  /* --------------------------------------------------------------- */
  /* 전체화면 — 몰입감                                                 */
  /* --------------------------------------------------------------- */

  function fullscreenTarget() {
    return stage || canvas;
  }

  function isFullscreen() {
    return (
      document.fullscreenElement === fullscreenTarget() ||
      document.webkitFullscreenElement === fullscreenTarget()
    );
  }

  async function toggleFullscreen() {
    const el = fullscreenTarget();
    try {
      if (isFullscreen()) {
        await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
      } else {
        // iOS 사파리는 요소 전체화면을 지원하지 않는다 — 그런 기기에서는
        // 버튼을 아예 감춰 두므로 여기까지 오지 않는다.
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      /* 사용자가 거부했거나 지원하지 않는 경우 — 조용히 넘어간다 */
    }
  }

  function syncFullscreenButton() {
    const on = isFullscreen();
    fullscreenButton.setAttribute('aria-pressed', String(on));
    fullscreenIcon.textContent = on ? 'fullscreen_exit' : 'fullscreen';
    fullscreenLabel.textContent = on ? '전체화면 끄기' : '전체화면';
    root.classList.toggle('is-fullscreen', on);
  }

  fullscreenButton.addEventListener('click', (e) => {
    e.preventDefault();
    toggleFullscreen();
  });
  document.addEventListener('fullscreenchange', syncFullscreenButton);
  document.addEventListener('webkitfullscreenchange', syncFullscreenButton);

  // 요소 전체화면을 못 쓰는 기기에서는 버튼을 감춘다
  if (!(fullscreenTarget().requestFullscreen || fullscreenTarget().webkitRequestFullscreen)) {
    fullscreenButton.hidden = true;
  }

  const touchDevice = window.matchMedia?.('(hover: none)').matches;
  const baseTip = touchDevice
    ? '조이스틱으로 이동 · 화면을 밀어 시점 · 두 번 두드리면 그곳으로 이동 · 점프로 구조물 위에'
    : 'WASD 이동 · 더블클릭으로 그 지점까지 이동 · Space 점프(연속 입력으로 더 높이) · Shift 달리기 · Esc 나가기';
  tip.textContent = baseTip;

  return {
    element: root,

    show(total) {
      root.hidden = false;
      countText.textContent = `0 / ${total}`;
      tip.textContent = baseTip;
      tip.classList.add('is-in');
      syncFullscreenButton();
      setTimeout(() => tip.classList.remove('is-in'), 6000);
    },

    hide() {
      root.hidden = true;
      crosshair.hidden = true;
      toast.hidden = true;
      clearTimeout(toastTimer);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      if (isFullscreen()) {
        (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.())?.catch?.(() => {});
      }
    },

    setCount(found, total) {
      countText.textContent = `${found} / ${total}`;
    },

    announce(landmark) {
      showToast(landmark.title, landmark.message);
    },

    dispose() {
      canvas.removeEventListener('pointerdown', onLookDown);
      canvas.removeEventListener('pointermove', onLookMove);
      canvas.removeEventListener('pointerup', onLookUp);
      canvas.removeEventListener('pointercancel', onLookUp);
      canvas.removeEventListener('click', requestLock);
      document.removeEventListener('mousemove', onMouseMove);
      root.remove();
    },
  };
}
