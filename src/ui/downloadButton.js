/**
 * ui/downloadButton.js — 탑다운 스캔 뷰를 PNG 이미지로 저장
 *
 * 인쇄물·슬라이드에 붙이려면 화면 캡처보다 정사각형 원본이 낫다.
 * 엔진이 현재 테마의 스캔 뷰를 정사각형으로 다시 렌더링해 준다.
 */

/**
 * @param {object} options
 * @param {() => ({engine: object, themeId: string}|null)} options.getState
 * @param {(text: string, tone?: string) => void} [options.onMessage]
 */
export function createDownloadButton({ getState, onMessage }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-secondary btn--block';
  button.disabled = true;
  button.innerHTML = `
    <span class="material-icons-outlined" aria-hidden="true">download</span>
    이미지 저장
  `;

  button.addEventListener('click', () => {
    const state = getState();
    if (!state?.engine) return;

    const dataUrl = state.engine.captureScanImage(1240);
    if (!dataUrl) {
      onMessage?.('이미지를 만들지 못했습니다.', 'error');
      return;
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `qr612-${state.themeId}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    onMessage?.('QR 이미지를 저장했습니다.', 'success');
  });

  return {
    element: button,
    setEnabled(enabled) {
      button.disabled = !enabled;
    },
  };
}
