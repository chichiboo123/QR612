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

export function cylinder(rTop, rBottom, height, segments, material, position = [0, 0, 0]) {
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

/** 그룹 헬퍼 */
export function group(...children) {
  const g = new THREE.Group();
  for (const child of children) if (child) g.add(child);
  return g;
}
