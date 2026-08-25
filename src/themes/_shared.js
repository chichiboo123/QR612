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
