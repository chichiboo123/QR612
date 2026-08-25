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
      <button type="button" class="explorer-hud__exit">
        <span class="material-icons-outlined" aria-hidden="true">close</span>
        여행 끝내기
      </button>
    </div>

    <div class="explorer-hud__toast" role="status" aria-live="polite" hidden>
      <span class="explorer-hud__toast-title"></span>
      <span class="explorer-hud__toast-body"></span>
    </div>

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

  function onLookDown(e) {
    if (!explorer.active) return;
    if (e.target.closest('.explorer-hud__controls, .explorer-hud__top')) return;
    lookPointer = e.pointerId;
    lastLook = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(lookPointer);
  }

  function onLookMove(e) {
    if (!explorer.active || e.pointerId !== lookPointer) return;
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
  }

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

  const touchDevice = window.matchMedia?.('(hover: none)').matches;
  tip.textContent = touchDevice
    ? '왼쪽 조이스틱으로 이동 · 화면을 밀어 시점 · 점프로 블록 위에 올라가 보세요'
    : 'WASD 이동 · Space 점프 · Shift 달리기 · 마우스로 시점 · Esc 로 나가기';

  return {
    element: root,

    show(total) {
      root.hidden = false;
      countText.textContent = `0 / ${total}`;
      tip.classList.add('is-in');
      setTimeout(() => tip.classList.remove('is-in'), 6000);
    },

    hide() {
      root.hidden = true;
      toast.hidden = true;
      clearTimeout(toastTimer);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
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
