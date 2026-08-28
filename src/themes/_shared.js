/**
 * themes/_shared.js
 * ---------------------------------------------------------------------------
 * 테마들이 공통으로 쓰는 로우폴리 프리미티브 헬퍼.
 *
 * 어린왕자 원작 삽화를 재현하지 않고, 기본 도형(박스/원뿔/구/실린더)만
 * 조합한 독자적인 실루엣으로 오브젝트를 만든다.
 */

import * as THREE from 'three';

/** 플랫셰이딩 로우폴리 재질 */
export function flatMaterial(color, options = {}) {
  return new THREE.MeshLambertMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(options.emissive || '#000000'),
    flatShading: options.flatShading !== false,
    transparent: options.transparent || false,
    opacity: options.opacity ?? 1,
    side: options.side || THREE.FrontSide,
    ...(options.extra || {}),
  });
}

/** 조명을 받지 않는 실루엣/발광용 재질 */
export function glowMaterial(color, options = {}) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: options.transparent ?? true,
    opacity: options.opacity ?? 1,
    side: options.side || THREE.FrontSide,
    depthWrite: options.depthWrite ?? true,
    // 하늘의 발광체(별·해·달)는 안개에 먹히지 않아야 한다
    fog: options.fog ?? false,
    toneMapped: false,
  });
}

export function box(w, h, d, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(...position);
  return mesh;
}

export function cone(radius, height, segments, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, segments),
    material
  );
  mesh.position.set(...position);
  return mesh;
}

export function cylinder(
  rTop,
  rBottom,
  height,
  segments,
  material,
  position = [0, 0, 0]
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBottom, height, segments),
    material
  );
  mesh.position.set(...position);
  return mesh;
}

export function blob(radius, detail, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius, detail),
    material
  );
  mesh.position.set(...position);
  return mesh;
}

/**
 * 결정론적 의사난수. 같은 QR 크기에 대해 항상 같은 배치가 나오도록.
 * @param {number} seed
 * @returns {() => number} 0~1 난수 생성기
 */
export function makeRandom(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * QR 그리드 바깥쪽 링 위의 좌표를 구한다.
 * 장식 오브젝트가 QR 모듈을 가리지 않도록 하는 기본 배치 규칙.
 *
 * @param {number} matrixSize
 * @param {number} angleDeg 0도 = +Z 방향
 * @param {number} [ringPadding] 그리드 반경에 더할 여유
 * @returns {[number, number]} [x, z]
 */
export function ringPoint(matrixSize, angleDeg, ringPadding = 5) {
  const radius = matrixSize / 2 + ringPadding;
  const a = (angleDeg * Math.PI) / 180;
  return [radius * Math.sin(a), radius * Math.cos(a)];
}

/**
 * QR 그리드를 감싸는 "정사각 링" 위의 좌표.
 *
 * 스캔 뷰에서 QR 판(정사각형)을 침범하지 않아야 하는 장식은 원형 링이 아니라
 * 정사각 링 위에 놓아야 한다. (원형 링은 대각선 방향에서 판 위로 올라온다.)
 *
 * @param {number} matrixSize
 * @param {number} angleDeg 0도 = +Z 방향
 * @param {number} [pad] QR 판 경계에서 바깥으로 더 밀어낼 거리(모듈 단위)
 * @param {number} [quietZone]
 * @returns {[number, number]} [x, z]
 */
export function squareRingPoint(matrixSize, angleDeg, pad = 2, quietZone = 4) {
  const half = matrixSize / 2 + quietZone + 1.5 + pad;
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dz = Math.cos(a);
  const scale = half / Math.max(Math.abs(dx), Math.abs(dz));
  return [dx * scale, dz * scale];
}

/**
 * 탐험 중 걸어서 닿을 수 있는 자리(= light 모듈)를 서로 떨어뜨려 고른다.
 * 랜드마크를 dark 모듈 위에 놓으면 올라가지 못해 영영 못 찾을 수 있다.
 *
 * @param {number} matrixSize
 * @param {boolean[][]} matrix
 * @param {number} count 필요한 자리 수
 * @param {number} [seed]
 * @returns {{x:number, z:number}[]} 월드 좌표 배열 (요청보다 적을 수 있음)
 */
export function pickWalkableCells(matrixSize, matrix, count, seed = 1) {
  const rand = makeRandom(matrixSize * 911 + seed);
  const candidates = [];

  // 가장자리 2칸은 파인더 패턴 주변이라 제외한다
  for (let row = 2; row < matrixSize - 2; row += 1) {
    for (let col = 2; col < matrixSize - 2; col += 1) {
      if (matrix?.[row]?.[col]) continue;
      candidates.push({
        x: col - (matrixSize - 1) / 2,
        z: row - (matrixSize - 1) / 2,
      });
    }
  }

  const chosen = [];
  const minGap = Math.max(matrixSize / 5, 4);

  while (chosen.length < count && candidates.length) {
    let placed = false;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const candidate = candidates[Math.floor(rand() * candidates.length)];
      if (!candidate) break;
      const tooClose = chosen.some(
        (c) => Math.hypot(c.x - candidate.x, c.z - candidate.z) < minGap
      );
      if (tooClose) continue;
      chosen.push(candidate);
      placed = true;
      break;
    }
    if (!placed) break;
  }

  return chosen;
}

/** 그룹 헬퍼 */
export function group(...children) {
  const g = new THREE.Group();
  for (const child of children) if (child) g.add(child);
  return g;
}

/**
 * 걸어서 닿을 수 있는 칸만 모은다. 각 칸의 "차수"(상하좌우로 이어지는 길의 수)도 함께 준다.
 *
 * pickWalkableCells() 는 light 모듈인지만 보고 연결성은 보지 않는다. 그래서 사방이
 * 막힌 골목 주머니가 뽑히고, 그 자리의 랜드마크는 영영 발견할 수 없다.
 * (실측: 25×25 에서 6곳 중 3곳이 고립된 자리였다)
 *
 * 걷기 규칙은 Explorer 와 같다.
 *   - dark 모듈은 stepHeight 를 훨씬 넘으므로 언제나 벽으로 본다(보수적 판정).
 *   - light 모듈은 언제나 걸어 오를 수 있다.
 *   - _groundAt 이 플레이어 사각형 네 모서리의 최댓값을 쓰므로 대각선으로 모서리를
 *     빠져나갈 수 없다. 따라서 상하좌우 4방향 연결만 센다.
 *
 * @param {number} matrixSize
 * @param {boolean[][]} matrix
 * @returns {{x:number, z:number, col:number, row:number, degree:number}[]}
 */
export function collectConnectedCells(matrixSize, matrix) {
  if (!matrix) return [];

  const N = matrixSize;
  const at = (row, col) => row * N + col;
  const reached = new Uint8Array(N * N);
  const queue = [];

  // 그리드 바깥 바닥(높이 0)에서 걸어 들어올 수 있는 테두리 길이 출발점이다
  for (let i = 0; i < N; i += 1) {
    for (const [row, col] of [[0, i], [N - 1, i], [i, 0], [i, N - 1]]) {
      if (matrix[row][col] || reached[at(row, col)]) continue;
      reached[at(row, col)] = 1;
      queue.push(row, col);
    }
  }

  const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length) {
    const col = queue.pop();
    const row = queue.pop();
    for (const [dr, dc] of STEPS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
      if (matrix[nr][nc] || reached[at(nr, nc)]) continue;
      reached[at(nr, nc)] = 1;
      queue.push(nr, nc);
    }
  }

  // 가장자리 2칸은 파인더 패턴 주변이라 배치에서 제외한다 (pickWalkableCells 와 동일)
  const cells = [];
  for (let row = 2; row < N - 2; row += 1) {
    for (let col = 2; col < N - 2; col += 1) {
      if (matrix[row][col] || !reached[at(row, col)]) continue;
      let degree = 0;
      for (const [dr, dc] of STEPS) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
        if (!matrix[nr][nc]) degree += 1;
      }
      cells.push({
        x: col - (N - 1) / 2,
        z: row - (N - 1) / 2,
        col,
        row,
        degree,
      });
    }
  }
  return cells;
}

/**
 * 실제로 걸어서 닿는 칸 중에서 서로 떨어진 자리를 고른다.
 * pickWalkableCells() 의 연결성 보장 버전.
 *
 * @param {number} matrixSize
 * @param {boolean[][]} matrix
 * @param {number} count
 * @param {number} [seed]
 * @param {object} [options]
 * @param {number} [options.minDegree] 이 수 이상의 길이 갈라지는 칸만 (3 이상 = 교차로)
 * @param {{x:number,z:number}[]} [options.exclude] 이미 쓴 자리(가까이 두지 않는다)
 * @returns {{x:number, z:number, degree:number}[]}
 */
export function pickConnectedCells(
  matrixSize,
  matrix,
  count,
  seed = 1,
  options = {}
) {
  const { minDegree = 0, exclude = [] } = options;

  let candidates = collectConnectedCells(matrixSize, matrix);
  if (minDegree > 0) {
    const junctions = candidates.filter((c) => c.degree >= minDegree);
    // 교차로가 모자라면 조건을 낮춰서라도 자리를 채운다
    if (junctions.length >= count) candidates = junctions;
  }
  if (!candidates.length) return [];

  const rand = makeRandom(matrixSize * 911 + seed);
  const chosen = [];
  let minGap = Math.max(matrixSize / 5, 4);

  // 자리가 모자라면 간격을 좁혀 가며 반드시 count 개를 채운다
  while (chosen.length < count && minGap >= 1) {
    let placed = false;
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const candidate = candidates[Math.floor(rand() * candidates.length)];
      if (!candidate) break;
      const tooClose = [...chosen, ...exclude].some(
        (c) => Math.hypot(c.x - candidate.x, c.z - candidate.z) < minGap
      );
      if (tooClose) continue;
      chosen.push(candidate);
      placed = true;
      break;
    }
    if (!placed) minGap -= 1;
  }

  return chosen;
}
