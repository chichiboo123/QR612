/**
 * core/explorer.js — "QR 여행" 1인칭 탐험 컨트롤러
 * ---------------------------------------------------------------------------
 * QR 매트릭스가 그대로 지형이 된다.
 *   dark 모듈 = 높은 블록(벽/건물/사구) · light 모듈 = 낮은 블록(길)
 * 별도의 충돌 메시 없이 이 하이트맵만으로 걷기 · 계단 오르기 · 점프를 처리한다.
 *
 * 조작
 *   데스크톱 — WASD/방향키 이동, Space 점프, Shift 달리기, 마우스 시점(포인터 락)
 *   모바일   — 왼쪽 조이스틱 이동, 점프 버튼, 화면 드래그로 시점
 */

import * as THREE from 'three';

const PLAYER = {
  /**
   * 사람 크기는 QR 모듈보다 작아야 한다.
   * 모듈 한 칸이 통로 폭인데 사람이 그보다 크면 온몸이 벽에 끼어
   * "갇힌 화면" 만 보인다. 키 0.9 = 모듈 한 칸의 90%.
   */
  height: 0.9,
  eyeHeight: 0.72,
  radius: 0.16,
  walkSpeed: 2.6,
  runSpeed: 4.4,
  /**
   * 이 정도 턱은 걸어서 그냥 올라간다.
   * 모든 테마의 light 모듈(길)이 이보다 낮으므로 바깥 바닥에서 QR 안으로
   * 걸어 들어갈 수 있고, dark 모듈(벽)은 전부 이보다 높아 미로가 된다.
   */
  stepHeight: 0.58,
  gravity: 16,
  /**
   * 제자리 점프 높이 ≈ v²/2g ≈ 1.28.
   * 평지에서 dark 블록에 바로는 못 오르지만, light 블록을 한 번 밟고 뛰면
   * 낮은 벽 위에는 올라갈 수 있게 잡은 값이다.
   */
  jumpSpeed: 6.4,
  /** 공중에서의 방향 전환 정도 */
  airControl: 0.35,
  maxPitch: Math.PI / 2 - 0.05,
};

/** 이 거리 안에 들어오면 랜드마크를 발견한 것으로 본다 */
const DISCOVER_RADIUS = 1.4;

export class Explorer {
  /**
   * @param {import('./sceneEngine.js').SceneEngine} engine
   * @param {object} [options]
   * @param {(event: object) => void} [options.onEvent] 발견·진입·종료 알림
   */
  constructor(engine, options = {}) {
    this.engine = engine;
    this.onEvent = options.onEvent;

    this.active = false;
    this.position = new THREE.Vector3();
    this.velocityY = 0;
    this.onGround = true;
    this.yaw = 0;
    this.pitch = -0.05;

    /** 조이스틱/키보드가 합쳐진 이동 입력 (-1 ~ 1) */
    this.moveInput = { x: 0, y: 0 };
    this.running = false;
    this._keys = new Set();
    this._wantJump = false;

    this._prevCamera = null;
    this._bindKeyboard();
  }

  /* --------------------------------------------------------------- */
  /* 진입 · 종료                                                       */
  /* --------------------------------------------------------------- */

  enter() {
    const engine = this.engine;
    if (!engine.qr || !engine.heightmap) return false;

    this._prevCamera = {
      fov: engine.camera.fov,
      near: engine.camera.near,
      far: engine.camera.far,
    };

    // 탐험은 항상 3D 씬 상태에서 시작한다
    engine.transition.jumpTo(0);
    this.active = true;
    engine._needsInstanceUpdate = true;

    this._spawn();
    this._resetLandmarks();

    engine.setPlayerLight(true);
    engine.camera.fov = 74;
    engine.camera.near = 0.05;
    engine.camera.far = 900;
    engine.camera.rotation.order = 'YXZ';
    engine.camera.updateProjectionMatrix();

    this.onEvent?.({ type: 'enter', total: engine.landmarks?.length ?? 0 });
    return true;
  }

  exit() {
    if (!this.active) return;
    this.active = false;

    const { camera } = this.engine;
    if (this._prevCamera) {
      camera.fov = this._prevCamera.fov;
      camera.near = this._prevCamera.near;
      camera.far = this._prevCamera.far;
      camera.updateProjectionMatrix();
    }
    camera.up.set(0, 1, 0);
    this.engine.setPlayerLight(false);

    this.moveInput.x = 0;
    this.moveInput.y = 0;
    this._keys.clear();
    this.engine._needsInstanceUpdate = true;

    this.onEvent?.({ type: 'exit' });
  }

  /**
   * 그리드 남쪽 바깥에서 QR 안쪽을 바라보며 시작한다.
   *
   * 아무 데서나 시작하면 바로 앞이 벽(dark 모듈)이라 들어가지도 못한다.
   * 남쪽 가장자리에서 light 모듈이 가장 깊게 이어지는 열을 찾아 그 앞에 세운다.
   */
  _spawn() {
    const size = this.engine.qr.size;
    const x = this._findEntranceColumn(size);

    this.position.set(x, 0, size / 2 + 2.5);
    this.position.y = this.engine.getHeightAt(this.position.x, this.position.z);
    this.velocityY = 0;
    this.onGround = true;
    this.yaw = 0; // yaw 0 = -Z 방향, 즉 그리드 중심을 본다
    this.pitch = -0.06;
  }

  /** 남쪽 가장자리에서 안쪽으로 가장 깊게 뚫린 열의 월드 x 좌표 */
  _findEntranceColumn(size) {
    const matrix = this.engine.matrix;
    if (!matrix) return 0;

    let bestCol = Math.floor(size / 2);
    let bestDepth = -1;

    for (let col = 0; col < size; col += 1) {
      let depth = 0;
      for (let row = size - 1; row >= 0; row -= 1) {
        if (matrix[row][col]) break;
        depth += 1;
      }
      // 같은 깊이라면 가운데에 가까운 열을 고른다
      const better =
        depth > bestDepth ||
        (depth === bestDepth &&
          Math.abs(col - size / 2) < Math.abs(bestCol - size / 2));
      if (better) {
        bestDepth = depth;
        bestCol = col;
      }
    }

    return bestCol - (size - 1) / 2;
  }

  _resetLandmarks() {
    for (const landmark of this.engine.landmarks || []) {
      landmark.found = false;
      landmark.beacon.visible = true;
    }
  }

  /* --------------------------------------------------------------- */
  /* 입력                                                              */
  /* --------------------------------------------------------------- */

  _bindKeyboard() {
    this._onKeyDown = (e) => {
      if (!this.active) return;
      if (e.code === 'Escape') {
        this.exit();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this._wantJump = true;
      }
      this._keys.add(e.code);
      if (MOVE_KEYS.has(e.code)) e.preventDefault();
      this.running = e.shiftKey;
    };

    this._onKeyUp = (e) => {
      if (!this.active) return;
      this._keys.delete(e.code);
      this.running = e.shiftKey;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  /** 조이스틱 입력. x = 좌우, y = 앞뒤(+1 이 전진) */
  setMoveInput(x, y) {
    this.moveInput.x = clampAxis(x);
    this.moveInput.y = clampAxis(y);
  }

  /** 시점 회전 (라디안) */
  look(deltaYaw, deltaPitch) {
    this.yaw -= deltaYaw;
    this.pitch = clamp(this.pitch - deltaPitch, -PLAYER.maxPitch, PLAYER.maxPitch);
  }

  jump() {
    this._wantJump = true;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  /* --------------------------------------------------------------- */
  /* 물리 · 충돌                                                       */
  /* --------------------------------------------------------------- */

  update(dt) {
    if (!this.active) return;

    const step = Math.min(dt, 0.05);
    const { x: inputX, y: inputY } = this._combinedInput();

    const speed = this.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const control = this.onGround ? 1 : PLAYER.airControl;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // yaw 0 이 -Z 를 보도록 맞춘다
    const forwardX = -sin;
    const forwardZ = -cos;
    const rightX = cos;
    const rightZ = -sin;

    let moveX = (forwardX * inputY + rightX * inputX) * speed * control * step;
    let moveZ = (forwardZ * inputY + rightZ * inputX) * speed * control * step;

    this._moveAxis('x', moveX);
    this._moveAxis('z', moveZ);

    // 중력 · 점프
    if (this._wantJump && this.onGround) {
      this.velocityY = PLAYER.jumpSpeed;
      this.onGround = false;
    }
    this._wantJump = false;

    this.velocityY -= PLAYER.gravity * step;
    this.position.y += this.velocityY * step;

    const ground = this._groundAt(this.position.x, this.position.z);
    if (this.position.y <= ground) {
      this.position.y = ground;
      this.velocityY = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // 그리드 바깥으로 너무 멀리 못 나가게 (풍경 밖으로 나가면 갈 곳이 없다)
    const limit = this.engine.qr.size / 2 + 12;
    this.position.x = clamp(this.position.x, -limit, limit);
    this.position.z = clamp(this.position.z, -limit, limit);

    this._checkLandmarks();
    this._applyCamera();
  }

  _combinedInput() {
    let x = this.moveInput.x;
    let y = this.moveInput.y;

    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) y += 1;
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) y -= 1;
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) x += 1;
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) x -= 1;

    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  /**
   * 한 축씩 밀어보고, 발밑보다 stepHeight 넘게 솟은 곳이면 막는다.
   * (축을 나눠 처리해야 벽을 스치며 미끄러지듯 걸을 수 있다)
   */
  _moveAxis(axis, delta) {
    if (delta === 0) return;

    const next = this.position.clone();
    next[axis] += delta;

    const ground = this._groundAt(next.x, next.z);
    const feet = this.position.y;

    if (ground - feet <= PLAYER.stepHeight) {
      this.position[axis] = next[axis];
      if (this.onGround && ground > feet) this.position.y = ground;
    }
  }

  /** 플레이어 몸통(사각형) 네 모서리 중 가장 높은 지면 */
  _groundAt(x, z) {
    const r = PLAYER.radius;
    const engine = this.engine;
    return Math.max(
      engine.getHeightAt(x - r, z - r),
      engine.getHeightAt(x + r, z - r),
      engine.getHeightAt(x - r, z + r),
      engine.getHeightAt(x + r, z + r)
    );
  }

  /* --------------------------------------------------------------- */
  /* 랜드마크 발견                                                     */
  /* --------------------------------------------------------------- */

  _checkLandmarks() {
    const landmarks = this.engine.landmarks;
    if (!landmarks?.length) return;

    for (const landmark of landmarks) {
      if (landmark.found) continue;
      const dx = landmark.x - this.position.x;
      const dz = landmark.z - this.position.z;
      if (dx * dx + dz * dz > DISCOVER_RADIUS * DISCOVER_RADIUS) continue;

      landmark.found = true;
      landmark.beacon.visible = false;
      this.onEvent?.({
        type: 'discover',
        landmark,
        found: landmarks.filter((l) => l.found).length,
        total: landmarks.length,
      });
    }
  }

  /* --------------------------------------------------------------- */
  /* 카메라                                                            */
  /* --------------------------------------------------------------- */

  _applyCamera() {
    const camera = this.engine.camera;
    camera.up.set(0, 1, 0);
    camera.position.set(
      this.position.x,
      this.position.y + PLAYER.eyeHeight,
      this.position.z
    );
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.engine.movePlayerLight(camera.position);
  }
}

/* ------------------------------------------------------------------ */

const MOVE_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function clampAxis(v) {
  return clamp(Number.isFinite(v) ? v : 0, -1, 1);
}
