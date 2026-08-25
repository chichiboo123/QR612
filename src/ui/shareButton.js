/**
 * ui/shareButton.js — 현재 URL + 테마를 쿼리 파라미터로 담은 공유 링크 생성
 *
 *   {origin}{pathname}?url={encodeURIComponent(URL)}&theme={themeId}
 *
 * 공유받은 사람이 이 링크로 접속하면 같은 씬이 그대로 재생성된다.
 */

/**
 * 공유 링크를 만든다.
 * @param {string} url QR 대상 URL
 * @param {string} themeId 테마 id
 * @returns {string}
 */
export function buildShareLink(url, themeId) {
  const base = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams();
  params.set('url', url);
  params.set('theme', themeId);
  return `${base}?${params.toString()}`;
}

/** 현재 주소의 쿼리 파라미터를 읽는다. */
export function readShareParams(search = window.location.search) {
  const params = new URLSearchParams(search);
  return {
    url: params.get('url') || '',
    themeId: params.get('theme') || '',
  };
}

/** 주소창을 현재 상태로 갱신한다(뒤로가기 히스토리를 더럽히지 않도록 replace). */
export function syncAddressBar(url, themeId) {
  if (!url) return;
  window.history.replaceState(null, '', buildShareLink(url, themeId));
}

/**
 * @param {object} options
 * @param {() => ({url: string, themeId: string}|null)} options.getState
 * @param {(text: string, tone?: string) => void} [options.onMessage]
 */
export function createShareButton({ getState, onMessage }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-secondary btn--block';
  button.disabled = true;
  button.innerHTML = `
    <span class="material-icons-outlined" aria-hidden="true">ios_share</span>
    공유 링크 복사
  `;

  button.addEventListener('click', async () => {
    const state = getState();
    if (!state?.url) return;

    const link = buildShareLink(state.url, state.themeId);

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'QR612',
          text: 'QR612로 만든 QR코드',
          url: link,
        });
        return;
      }
      await navigator.clipboard.writeText(link);
      onMessage?.('공유 링크를 복사했습니다.', 'success');
    } catch (error) {
      if (error?.name === 'AbortError') return; // 사용자가 공유 시트를 닫음
      fallbackCopy(link, onMessage);
    }
  });

  return {
    element: button,
    setEnabled(enabled) {
      button.disabled = !enabled;
    },
  };
}

function fallbackCopy(text, onMessage) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(area);

  onMessage?.(
    ok ? '공유 링크를 복사했습니다.' : `복사에 실패했습니다. 링크: ${text}`,
    ok ? 'success' : 'error'
  );
}
