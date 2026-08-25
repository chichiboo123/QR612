/**
 * main.js — QR612 앱 조립
 * ---------------------------------------------------------------------------
 * URL → QR 매트릭스 → 테마 3D 씬 → 탭하면 탑다운 스캔 뷰.
 * 모든 처리는 브라우저 안에서 끝나며 URL 은 어떤 서버로도 전송되지 않는다.
 */

import './styles/main.css';

import { encodeToMatrix } from './core/qrEncode.js';
import { SceneEngine } from './core/sceneEngine.js';
import { THEMES, DEFAULT_THEME_ID, getTheme } from './themes/index.js';
import { createUrlInput } from './ui/urlInput.js';
import { createThemePicker } from './ui/themePicker.js';
import {
  createShareButton,
  readShareParams,
  syncAddressBar,
} from './ui/shareButton.js';
import { createFooter } from './ui/footer.js';

const state = {
  url: '',
  themeId: DEFAULT_THEME_ID,
  qr: null,
};

const shared = readShareParams();
if (shared.themeId && THEMES.some((t) => t.id === shared.themeId)) {
  state.themeId = shared.themeId;
}

/* ------------------------------------------------------------------ */
/* DOM 조립                                                            */
/* ------------------------------------------------------------------ */

const app = document.getElementById('app');

app.appendChild(createHeader());

const main = document.createElement('main');
main.className = 'app-main';

// 모바일에서는 "주소 입력 → 3D 씬 → 테마 → 공유" 순으로 흐르고,
// 1024px 이상에서는 좌측 컨트롤 / 우측 스테이지 2단 그리드가 된다.
const stageColumn = document.createElement('div');
stageColumn.className = 'app-main__stage';

app.append(main, createFooter());

/* 3D 스테이지 ------------------------------------------------------- */

const stage = document.createElement('div');
stage.className = 'stage';
stage.dataset.ready = 'false';
stage.innerHTML = `
  <div class="stage__canvas"></div>
  <div class="stage__empty">
    <span class="material-icons-outlined">travel_explore</span>
    <p>주소를 입력하고 <strong>생성하기</strong>를 누르면<br />어린왕자의 장면이 나타납니다.</p>
  </div>
  <span class="stage__badge" hidden></span>
  <span class="stage__hint" hidden></span>
`;

const canvasHost = stage.querySelector('.stage__canvas');
const badge = stage.querySelector('.stage__badge');
const hint = stage.querySelector('.stage__hint');

const notice = document.createElement('p');
notice.className = 'notice';

stageColumn.append(stage, notice);

/* 컨트롤 ------------------------------------------------------------ */

const urlInput = createUrlInput({
  initialValue: shared.url,
  onSubmit: (url) => generate(url, state.themeId),
});

const themePicker = createThemePicker({
  themes: THEMES,
  value: state.themeId,
  onChange: (themeId) => {
    state.themeId = themeId;
    if (state.url) {
      applyTheme(themeId);
      syncAddressBar(state.url, themeId);
    }
  },
});

const actions = document.createElement('section');
actions.className = 'panel';
actions.innerHTML = `
  <h2 class="panel__title">
    <span class="material-icons-outlined">share</span>
    보기 &amp; 공유
  </h2>
  <div class="btn-group"></div>
  <p class="field__message" role="status" aria-live="polite"></p>
`;

const actionMessage = actions.querySelector('.field__message');

const viewToggle = document.createElement('button');
viewToggle.type = 'button';
viewToggle.className = 'btn btn-secondary btn--block';
viewToggle.disabled = true;
viewToggle.addEventListener('click', () => engine?.toggleView());

const shareButton = createShareButton({
  getState: () => (state.url ? { url: state.url, themeId: state.themeId } : null),
  onMessage: setActionMessage,
});

actions.querySelector('.btn-group').append(viewToggle, shareButton.element);

urlInput.element.classList.add('panel--url');
themePicker.element.classList.add('panel--theme');
actions.classList.add('panel--actions');

main.append(urlInput.element, stageColumn, themePicker.element, actions);

/* ------------------------------------------------------------------ */
/* 엔진                                                                */
/* ------------------------------------------------------------------ */

let engine = null;

try {
  engine = new SceneEngine(canvasHost, { onViewChange: updateViewLabels });
  engine.start();
} catch (error) {
  console.error('[QR612] WebGL 초기화 실패', error);
  stage.querySelector('.stage__empty').innerHTML = `
    <span class="material-icons-outlined">error_outline</span>
    <p>이 브라우저에서는 3D 장면을 표시할 수 없습니다.<br />WebGL 지원 브라우저에서 다시 열어 주세요.</p>
  `;
}

/* ------------------------------------------------------------------ */
/* 동작                                                                */
/* ------------------------------------------------------------------ */

/**
 * URL 을 QR 매트릭스로 인코딩하고 현재 테마로 씬을 만든다.
 * @param {string} url 정규화된 URL
 * @param {string} themeId
 */
function generate(url, themeId) {
  if (!engine) return;

  try {
    const qr = encodeToMatrix(url, { errorCorrectionLevel: 'Q' });

    state.url = url;
    state.qr = qr;
    state.themeId = themeId;

    engine.setTheme(getTheme(themeId));
    engine.setMatrix(qr);
    engine.setProgress(0, { animate: false });

    stage.dataset.ready = 'true';
    badge.hidden = false;
    hint.hidden = false;
    viewToggle.disabled = false;
    shareButton.setEnabled(true);

    updateViewLabels(0);
    urlInput.setMessage(
      `QR 버전 ${qr.version} · ${qr.size}×${qr.size} 모듈 · 에러 정정 ${qr.errorCorrectionLevel}`,
      'success'
    );
    setActionMessage('');
    syncAddressBar(url, themeId);
  } catch (error) {
    console.error('[QR612] QR 생성 실패', error);
    urlInput.setMessage(
      'QR코드를 만들지 못했습니다. 주소가 너무 길지 않은지 확인해 주세요.',
      'error'
    );
  }
}

/** 테마만 교체하고 씬을 리빌드한다. (progress 는 유지) */
function applyTheme(themeId) {
  if (!engine || !state.qr) return;
  engine.setTheme(getTheme(themeId));
}

/** 3D/2D 상태에 맞춰 버튼·배지·안내 문구를 갱신한다. */
function updateViewLabels(target) {
  const scanView = target > 0.5;
  const theme = getTheme(state.themeId);

  stage.dataset.view = scanView ? 'scan' : 'scene';

  badge.innerHTML = scanView
    ? '<span class="material-icons-outlined">qr_code_2</span> 스캔 뷰'
    : `<span class="material-icons-outlined">deblur</span> ${theme.label}`;

  hint.innerHTML = scanView
    ? '<span class="material-icons-outlined">3d_rotation</span> 탭하여 3D 장면으로 돌아가기'
    : '<span class="material-icons-outlined">qr_code_scanner</span> 탭하여 QR코드 보기';

  viewToggle.innerHTML = scanView
    ? '<span class="material-icons-outlined">3d_rotation</span> 3D 장면 보기'
    : '<span class="material-icons-outlined">qr_code_scanner</span> QR코드 보기';

  notice.dataset.tone = scanView ? 'scan' : 'scene';
  notice.innerHTML = scanView
    ? `<span class="material-icons-outlined">photo_camera</span>
       <span>스마트폰 카메라로 <strong>바로 스캔</strong>해 보세요. 화면을 다시 탭하면 3D 장면으로 돌아갑니다.</span>`
    : `<span class="material-icons-outlined">touch_app</span>
       <span>3D 장면을 드래그하면 시점을 돌릴 수 있고, <strong>탭하면 스캔 가능한 QR코드</strong>로 전환됩니다.</span>`;
}

function setActionMessage(text, tone = 'info') {
  actionMessage.textContent = '';
  actionMessage.dataset.tone = tone;
  if (!text) return;

  const icon = document.createElement('span');
  icon.className = 'material-icons-outlined';
  icon.textContent =
    tone === 'error' ? 'error_outline' : tone === 'success' ? 'check_circle' : 'info';
  actionMessage.append(icon, document.createTextNode(text));
}

function createHeader() {
  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <div class="app-header__inner">
      <span class="app-header__mark"><span class="material-icons-outlined">rocket_launch</span></span>
      <h1 class="app-header__title">QR612</h1>
      <p class="app-header__subtitle">어린왕자의 장면이 되는 QR코드 — 탭하면 스캔 가능한 QR로 바뀝니다.</p>
    </div>
  `;
  return header;
}

/* ------------------------------------------------------------------ */
/* 공유 링크로 들어온 경우 자동 생성                                     */
/* ------------------------------------------------------------------ */

themePicker.setValue(state.themeId);
updateViewLabels(0);

/**
 * 디버깅 · 자동화 테스트용 핸들.
 * (URL 을 외부로 보내지 않으며, 브라우저 안에서만 존재한다.)
 */
window.QR612 = { state, engine, themes: THEMES };

if (shared.url) {
  urlInput.setValue(shared.url);
  urlInput.submit();
}
