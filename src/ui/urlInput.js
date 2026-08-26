/**
 * ui/urlInput.js — URL 입력창 + "생성하기" 버튼
 */

import { normalizeUrl } from '../core/qrEncode.js';

const MESSAGE_ICONS = {
  info: 'info',
  success: 'check_circle',
  warning: 'warning_amber',
  error: 'error_outline',
};

/**
 * @param {object} options
 * @param {string} [options.initialValue]
 * @param {(url: string) => void} options.onSubmit 정규화된 URL 을 전달
 * @returns {{ element: HTMLElement, setValue: Function, setMessage: Function, submit: Function }}
 */
export function createUrlInput({ initialValue = '', onSubmit }) {
  const section = document.createElement('section');
  section.className = 'panel';
  section.setAttribute('aria-labelledby', 'url-input-title');
  section.innerHTML = `
    <div class="panel__heading">
      <span class="step-badge" aria-hidden="true">1</span>
      <h2 class="panel__title" id="url-input-title">
        <span class="material-icons-outlined" aria-hidden="true">link</span>
        QR로 만들 주소
      </h2>
    </div>
    <p class="panel__description">공유할 웹페이지 주소를 붙여 넣어 주세요.</p>
    <form class="field" novalidate>
      <div class="field__row">
        <label class="sr-only" for="qr612-url">QR코드로 만들 URL</label>
        <input
          class="input"
          id="qr612-url"
          name="url"
          type="text"
          inputmode="url"
          autocomplete="url"
          aria-describedby="url-input-message"
          spellcheck="false"
          placeholder="https://litt.ly/chichiboo"
        />
        <button class="btn btn-primary" type="submit">
          <span class="material-icons-outlined" aria-hidden="true">auto_awesome</span>
          생성하기
        </button>
      </div>
      <p class="field__message" id="url-input-message" role="status" aria-live="polite"></p>
    </form>
  `;

  const form = section.querySelector('form');
  const input = section.querySelector('input');
  const message = section.querySelector('.field__message');

  input.value = initialValue;

  function setMessage(text, tone = 'info') {
    message.textContent = '';
    message.dataset.tone = tone;
    if (!text) return;

    const icon = document.createElement('span');
    icon.className = 'material-icons-outlined';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = MESSAGE_ICONS[tone] || MESSAGE_ICONS.info;
    message.append(icon, document.createTextNode(text));
  }

  function submit() {
    const url = normalizeUrl(input.value);
    if (!url) {
      input.setAttribute('aria-invalid', 'true');
      setMessage('올바른 주소를 입력해 주세요. 예) litt.ly/chichiboo', 'error');
      input.focus();
      return null;
    }

    input.removeAttribute('aria-invalid');
    input.value = url;
    onSubmit(url);
    return url;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });

  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    setMessage('');
  });

  setMessage('입력한 주소는 브라우저 안에서만 처리되며 서버로 전송되지 않습니다.');

  return {
    element: section,
    setValue(value) {
      input.value = value;
    },
    getValue() {
      return input.value;
    },
    setMessage,
    submit,
  };
}
