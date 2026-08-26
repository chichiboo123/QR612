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
import { createDownloadButton } from './ui/downloadButton.js';
import { createExplorerHud } from './ui/explorerHud.js';
import { createFooter } from './ui/footer.js';
import { createCredits } from './ui/credits.js';

/** 처음 들어온 사람이 바로 결과를 볼 수 있도록 하는 예시 주소 */
const DEMO_URL = 'https://litt.ly/chichiboo';

const state = {
  url: '',
  themeId: DEFAULT_THEME_ID,
  qr: null,
  /** 사용자가 직접 생성한 적이 있는지 (예시 상태에서는 주소창을 건드리지 않는다) */
  userGenerated: false,
};

const shared = readShareParams();
if (shared.themeId && THEMES.some((t) => t.id === shared.themeId)) {
  state.themeId = shared.themeId;
}

/* ------------------------------------------------------------------ */
/* DOM 조립                                                            */
/* ------------------------------------------------------------------ */

const app = document.getElementById('app');

const skipLink = document.createElement('a');
skipLink.className = 'skip-link';
skipLink.href = '#main-content';
skipLink.textContent = 'QR 만들기로 바로가기';
app.appendChild(skipLink);
app.appendChild(createHeader());

const main = document.createElement('main');
main.className = 'app-main';
main.id = 'main-content';
main.tabIndex = -1;

// 모바일에서는 "주소 입력 → 3D 씬 → 테마 → 공유" 순으로 흐르고,
// 1024px 이상에서는 좌측 컨트롤 / 우측 스테이지 2단 그리드가 된다.
const stageColumn = document.createElement('div');
stageColumn.className = 'app-main__stage';

app.append(main, createCredits(), createFooter());

/* 3D 스테이지 ------------------------------------------------------- */

const stage = document.createElement('div');
stage.className = 'stage';
stage.dataset.ready = 'false';
stage.innerHTML = `
  <div class="stage__canvas"></div>
  <div class="stage__empty">
    <span class="material-icons-outlined" aria-hidden="true">travel_explore</span>
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
notice.id = 'stage-instructions';

const stageMeta = document.createElement('div');
stageMeta.className = 'stage-meta';
stageMeta.setAttribute('aria-live', 'polite');
stageMeta.innerHTML = `
  <span class="stage-meta__state">
    <span class="stage-meta__dot" aria-hidden="true"></span>
    미리보기 준비 중
  </span>
  <span class="stage-meta__url"></span>
`;
const stageMetaState = stageMeta.querySelector('.stage-meta__state');
const stageMetaUrl = stageMeta.querySelector('.stage-meta__url');

stageColumn.append(stage, stageMeta, notice);

/* 컨트롤 ------------------------------------------------------------ */

const urlInput = createUrlInput({
  initialValue: shared.url,
  onSubmit: (url) => {
    state.userGenerated = true;
    generate(url, state.themeId);
  },
});

const themePicker = createThemePicker({
  themes: THEMES,
  value: state.themeId,
  onChange: (themeId) => {
    state.themeId = themeId;
    if (state.url) {
      applyTheme(themeId);
      if (state.userGenerated) syncAddressBar(state.url, themeId);
    }
  },
});

const actions = document.createElement('section');
actions.className = 'panel';
actions.setAttribute('aria-labelledby', 'actions-title');
actions.innerHTML = `
  <div class="panel__heading">
    <span class="step-badge" aria-hidden="true">3</span>
    <h2 class="panel__title" id="actions-title">
      <span class="material-icons-outlined" aria-hidden="true">share</span>
      보기 &amp; 공유
    </h2>
  </div>
  <p class="panel__description">완성된 QR을 확인하고 링크나 이미지로 나눠 보세요.</p>
  <div class="btn-group"></div>
  <p class="field__message" role="status" aria-live="polite"></p>
`;

const actionMessage = actions.querySelector('.field__message');

const viewToggle = document.createElement('button');
viewToggle.type = 'button';
viewToggle.className = 'btn btn-secondary btn--block';
viewToggle.disabled = true;
viewToggle.addEventListener('click', () => engine?.toggleView());

const travelButton = document.createElement('button');
travelButton.type = 'button';
travelButton.className = 'btn btn-travel btn--block btn-group__wide';
travelButton.disabled = true;
travelButton.innerHTML = `
  <span class="material-icons-outlined" aria-hidden="true">directions_walk</span>
  QR 여행 — 1인칭으로 걸어 들어가기
`;
travelButton.addEventListener('click', () => {
  if (!engine) return;
  if (engine.isExploring) engine.exitExplorer();
  else engine.enterExplorer();
});

const shareButton = createShareButton({
  getState: () => (state.url ? { url: state.url, themeId: state.themeId } : null),
  onMessage: setActionMessage,
});

const downloadButton = createDownloadButton({
  getState: () => (engine && state.qr ? { engine, themeId: state.themeId } : null),
  onMessage: setActionMessage,
});

viewToggle.classList.add('btn-group__wide');
actions
  .querySelector('.btn-group')
  .append(travelButton, viewToggle, shareButton.element, downloadButton.element);

urlInput.element.classList.add('panel--url');
themePicker.element.classList.add('panel--theme');
actions.classList.add('panel--actions');

main.append(urlInput.element, stageColumn, themePicker.element, actions);

/* ------------------------------------------------------------------ */
/* 엔진                                                                */
/* ------------------------------------------------------------------ */

let engine = null;
let explorerHud = null;

try {
  engine = new SceneEngine(canvasHost, {
    onViewChange: updateViewLabels,
    onExplorerEvent: handleExplorerEvent,
  });
  engine.renderer.domElement.setAttribute('aria-describedby', 'stage-instructions');
  engine.start();

  explorerHud = createExplorerHud({
    stage,
    canvas: engine.renderer.domElement,
    explorer: engine.explorer,
    onExit: () => engine.exitExplorer(),
  });
} catch (error) {
  console.error('[QR612] WebGL 초기화 실패', error);
  stage.querySelector('.stage__empty').innerHTML = `
    <span class="material-icons-outlined" aria-hidden="true">error_outline</span>
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
  if (engine.isExploring) engine.exitExplorer();

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
    travelButton.disabled = false;
    shareButton.setEnabled(true);
    downloadButton.setEnabled(true);

    updateViewLabels(0);

    const summary = `QR 버전 ${qr.version} · ${qr.size}×${qr.size} 모듈 · 에러 정정 ${qr.errorCorrectionLevel}`;
    stageMetaState.innerHTML = `
      <span class="stage-meta__dot" aria-hidden="true"></span>
      QR 생성 완료
    `;
    stageMetaUrl.textContent = url;
    stageMetaUrl.title = url;
    if (qr.version >= 12) {
      // 모듈이 촘촘해질수록 작은 화면에서 스캔이 어려워진다
      urlInput.setMessage(
        `${summary} — 주소가 길어 모듈이 촘촘합니다. 짧은 주소를 쓰면 더 잘 읽힙니다.`,
        'warning'
      );
    } else {
      urlInput.setMessage(summary, 'success');
    }

    setActionMessage('');
    if (state.userGenerated) syncAddressBar(url, themeId);
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
  // 테마를 바꾸면 지형 자체가 바뀌므로 탐험을 끝내고 다시 들어가게 한다
  if (engine.isExploring) engine.exitExplorer();
  engine.setTheme(getTheme(themeId));
}

/** 3D/2D 상태에 맞춰 버튼·배지·안내 문구를 갱신한다. */
function updateViewLabels(target) {
  const scanView = target > 0.5;
  const theme = getTheme(state.themeId);

  stage.dataset.view = scanView ? 'scan' : 'scene';

  badge.innerHTML = scanView
    ? '<span class="material-icons-outlined" aria-hidden="true">qr_code_2</span> 스캔 뷰'
    : `<span class="material-icons-outlined" aria-hidden="true">deblur</span> ${theme.label}`;

  hint.innerHTML = scanView
    ? '<span class="material-icons-outlined" aria-hidden="true">3d_rotation</span> 탭하여 3D 장면으로 돌아가기'
    : '<span class="material-icons-outlined" aria-hidden="true">qr_code_scanner</span> 탭하여 QR코드 보기';

  viewToggle.innerHTML = scanView
    ? '<span class="material-icons-outlined" aria-hidden="true">3d_rotation</span> 3D 장면 보기'
    : '<span class="material-icons-outlined" aria-hidden="true">qr_code_scanner</span> QR코드 보기';

  notice.dataset.tone = scanView ? 'scan' : 'scene';
  notice.innerHTML = scanView
    ? `<span class="material-icons-outlined" aria-hidden="true">photo_camera</span>
       <span>스마트폰 카메라로 <strong>바로 스캔</strong>해 보세요. 화면을 다시 탭하면 3D 장면으로 돌아갑니다.</span>`
    : `<span class="material-icons-outlined" aria-hidden="true">touch_app</span>
       <span>3D 장면을 드래그하면 시점을 돌릴 수 있고, <strong>탭하면 스캔 가능한 QR코드</strong>로 전환됩니다.</span>`;
}

/**
 * 1인칭 탐험 상태 변화를 UI 에 반영한다.
 * @param {{type: string, total?: number, found?: number, landmark?: object}} event
 */
function handleExplorerEvent(event) {
  if (event.type === 'enter') {
    stage.dataset.mode = 'travel';
    explorerHud?.show(event.total);
    travelButton.innerHTML = `
      <span class="material-icons-outlined" aria-hidden="true">logout</span>
      여행 끝내기
    `;
    viewToggle.disabled = true;
    setActionMessage(
      event.total > 0
        ? `QR 속을 걷는 중입니다. 빛나는 지점 ${event.total}곳을 찾아보세요.`
        : 'QR 속을 걷는 중입니다.'
    );
    return;
  }

  if (event.type === 'exit') {
    stage.dataset.mode = 'view';
    explorerHud?.hide();
    travelButton.innerHTML = `
      <span class="material-icons-outlined" aria-hidden="true">directions_walk</span>
      QR 여행 — 1인칭으로 걸어 들어가기
    `;
    viewToggle.disabled = false;
    setActionMessage('');
    return;
  }

  if (event.type === 'discover') {
    explorerHud?.setCount(event.found, event.total);
    explorerHud?.announce(event.landmark);
    if (event.found === event.total) {
      setActionMessage('이 QR 안의 모든 지점을 찾았습니다.', 'success');
    }
  }
}

function setActionMessage(text, tone = 'info') {
  actionMessage.textContent = '';
  actionMessage.dataset.tone = tone;
  if (!text) return;

  const icon = document.createElement('span');
  icon.className = 'material-icons-outlined';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent =
    tone === 'error'
      ? 'error_outline'
      : tone === 'success'
        ? 'check_circle'
        : 'info';
  actionMessage.append(icon, document.createTextNode(text));
}

function createHeader() {
  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <div class="app-header__inner">
      <div class="app-header__brand">
        <span class="app-header__mark"><span class="material-icons-outlined" aria-hidden="true">rocket_launch</span></span>
        <div>
          <p class="app-header__eyebrow">YOUR LINK, A LITTLE PLANET</p>
          <h1 class="app-header__title">QR612</h1>
        </div>
      </div>
      <div class="app-header__intro">
        <p class="app-header__subtitle">링크 하나로 만드는 나만의 작은 행성</p>
        <p class="app-header__description">주소를 입력하고 테마를 고르면, 스캔할 수 있는 3D QR 장면이 완성됩니다.</p>
      </div>
      <span class="privacy-badge">
        <span class="material-icons-outlined" aria-hidden="true">verified_user</span>
        브라우저에서만 처리
      </span>
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
  state.userGenerated = true;
  urlInput.setValue(shared.url);
  urlInput.submit();
} else {
  // 빈 화면 대신 예시 장면을 먼저 보여준다.
  // 테마를 바로 눌러볼 수 있고, 주소를 바꿔 넣으면 그대로 대체된다.
  urlInput.setValue(DEMO_URL);
  generate(DEMO_URL, state.themeId);
  urlInput.setMessage(
    '예시 주소로 만든 장면입니다. 주소를 바꿔 넣고 생성하기를 눌러 보세요.'
  );
}
