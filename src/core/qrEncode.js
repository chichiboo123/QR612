/**
 * core/qrEncode.js
 * ---------------------------------------------------------------------------
 * URL(또는 임의의 문자열)을 표준 QR 매트릭스(boolean 2차원 배열)로 변환한다.
 * 이 모듈은 Three.js / 테마와 완전히 독립적이며, 순수 데이터만 다룬다.
 *
 * 모든 처리는 브라우저 안에서 끝나며 어떤 서버로도 URL을 전송하지 않는다.
 */

import QRCode from 'qrcode';

/** 스캔 안정성을 위해 기본값은 Q(약 25% 복원). 최소 허용은 M. */
export const DEFAULT_ERROR_CORRECTION = 'Q';
const ALLOWED_ERROR_CORRECTION = ['M', 'Q', 'H'];

/** QR 규격상 필수인 여백(quiet zone) 모듈 수. */
export const QUIET_ZONE = 4;

/**
 * 사용자가 입력한 문자열을 URL 형태로 정규화한다.
 * - 앞뒤 공백 제거
 * - 스킴이 없으면 https:// 를 붙임
 * - 잘못된 형식이면 null 반환
 *
 * @param {string} input
 * @returns {string|null}
 */
export function normalizeUrl(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (!url.hostname && !/^(mailto|tel|sms):/i.test(withScheme)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * 문자열을 QR 매트릭스로 인코딩한다.
 *
 * @param {string} text 인코딩할 원본 문자열(보통 URL)
 * @param {object} [options]
 * @param {'M'|'Q'|'H'} [options.errorCorrectionLevel] 에러 정정 레벨(M 이상만 허용)
 * @returns {{
 *   size: number,
 *   matrix: boolean[][],
 *   version: number,
 *   errorCorrectionLevel: string,
 *   quietZone: number,
 *   text: string
 * }}
 */
export function encodeToMatrix(text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('인코딩할 문자열이 비어 있습니다.');
  }

  const level = String(
    options.errorCorrectionLevel || DEFAULT_ERROR_CORRECTION
  ).toUpperCase();

  if (!ALLOWED_ERROR_CORRECTION.includes(level)) {
    throw new Error(
      `에러 정정 레벨은 ${ALLOWED_ERROR_CORRECTION.join('/')} 중 하나여야 합니다. (요청값: ${level})`
    );
  }

  const qr = QRCode.create(text, { errorCorrectionLevel: level });
  const { size, data } = qr.modules;

  const matrix = [];
  for (let row = 0; row < size; row += 1) {
    const line = new Array(size);
    for (let col = 0; col < size; col += 1) {
      // data[row * size + col] === 1 이면 dark 모듈
      line[col] = data[row * size + col] === 1;
    }
    matrix.push(line);
  }

  return {
    size,
    matrix,
    version: qr.version,
    errorCorrectionLevel: level,
    quietZone: QUIET_ZONE,
    text,
  };
}

/**
 * 파인더 패턴/얼라인먼트 패턴처럼 "훼손되면 곤란한" 영역을 반환한다.
 * 테마가 장식 오브젝트를 배치할 때 이 영역을 피하도록 하기 위한 힌트.
 *
 * @param {number} size 매트릭스 한 변의 모듈 수
 * @returns {{row: number, col: number, width: number, height: number}[]}
 */
export function getReservedRegions(size) {
  const finder = 7;
  const pad = 1; // separator 포함
  const span = finder + pad;
  return [
    { row: 0, col: 0, width: span, height: span },
    { row: 0, col: size - span, width: span, height: span },
    { row: size - span, col: 0, width: span, height: span },
  ];
}

/**
 * 좌표가 예약 영역(파인더 패턴 등) 안에 있는지 검사한다.
 *
 * @param {number} row
 * @param {number} col
 * @param {number} size
 * @returns {boolean}
 */
export function isReservedModule(row, col, size) {
  return getReservedRegions(size).some(
    (r) =>
      row >= r.row &&
      row < r.row + r.height &&
      col >= r.col &&
      col < r.col + r.width
  );
}

/**
 * 콘솔 디버깅용 ASCII 출력. (dark = ██, light = 공백 2칸)
 *
 * @param {boolean[][]} matrix
 * @param {number} [quietZone]
 * @returns {string}
 */
export function matrixToAscii(matrix, quietZone = 2) {
  const size = matrix.length;
  const blank = '  '.repeat(size + quietZone * 2);
  const lines = [];

  for (let i = 0; i < quietZone; i += 1) lines.push(blank);
  for (let row = 0; row < size; row += 1) {
    let line = '  '.repeat(quietZone);
    for (let col = 0; col < size; col += 1) {
      line += matrix[row][col] ? '██' : '  ';
    }
    line += '  '.repeat(quietZone);
    lines.push(line);
  }
  for (let i = 0; i < quietZone; i += 1) lines.push(blank);

  return lines.join('\n');
}

/**
 * 매트릭스의 dark 모듈 비율(0~1). 씬 밀도 튜닝용.
 * @param {boolean[][]} matrix
 * @returns {number}
 */
export function getDarkRatio(matrix) {
  let dark = 0;
  for (const row of matrix) for (const cell of row) if (cell) dark += 1;
  return dark / (matrix.length * matrix.length);
}
