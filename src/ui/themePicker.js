/**
 * ui/themePicker.js — 테마 썸네일 카드 선택기
 * 선택이 바뀌면 onChange 로 알리고, main.js 가 씬을 리빌드한다.
 */

/**
 * @param {object} options
 * @param {Array} options.themes 테마 모듈 배열
 * @param {string} options.value 현재 선택된 테마 id
 * @param {(themeId: string) => void} options.onChange
 */
export function createThemePicker({ themes, value, onChange }) {
  const section = document.createElement('section');
  section.className = 'panel';
  section.setAttribute('aria-labelledby', 'theme-picker-title');
  section.innerHTML = `
    <div class="panel__heading">
      <span class="step-badge" aria-hidden="true">2</span>
      <h2 class="panel__title" id="theme-picker-title">
        <span class="material-icons-outlined" aria-hidden="true">palette</span>
        테마 선택
      </h2>
    </div>
    <p class="panel__description">장면의 분위기를 골라 보세요. QR 내용은 그대로 유지됩니다.</p>
    <div class="theme-picker" role="radiogroup" aria-label="QR코드 테마"></div>
  `;

  const list = section.querySelector('.theme-picker');
  const cards = new Map();

  for (const theme of themes) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', String(theme.id === value));
    // roving tabindex — 라디오 그룹은 탭 정지점이 하나여야 한다
    card.tabIndex = theme.id === value ? 0 : -1;
    card.dataset.themeId = theme.id;

    const [a, b, c] = theme.swatch;
    card.innerHTML = `
      <span class="theme-card__thumb" style="background:
        linear-gradient(160deg, ${b} 0%, ${b} 46%, ${a} 46%, ${a} 100%);"></span>
      <span class="theme-card__name">${theme.label}</span>
      <span class="theme-card__caption">${theme.caption}</span>
      <span class="theme-card__check"><span class="material-icons-outlined" aria-hidden="true">check</span></span>
    `;

    const thumb = card.querySelector('.theme-card__thumb');
    const accent = document.createElement('span');
    accent.setAttribute(
      'style',
      `position:absolute; right:14%; top:16%; width:22%; aspect-ratio:1;
       border-radius:50%; background:${c}; opacity:.9;`
    );
    thumb.appendChild(accent);

    card.addEventListener('click', () => select(theme.id));
    cards.set(theme.id, card);
    list.appendChild(card);
  }

  function markSelected(themeId) {
    for (const [id, card] of cards) {
      const selected = id === themeId;
      card.setAttribute('aria-checked', String(selected));
      card.tabIndex = selected ? 0 : -1;
    }
  }

  function select(themeId) {
    markSelected(themeId);
    onChange(themeId);
  }

  // 좌우 방향키로 테마 이동 (라디오 그룹 접근성)
  list.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key))
      return;
    e.preventDefault();

    const ids = [...cards.keys()];
    const current = ids.findIndex(
      (id) => cards.get(id).getAttribute('aria-checked') === 'true'
    );
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = ids[(current + delta + ids.length) % ids.length];

    select(next);
    cards.get(next).focus();
  });

  return {
    element: section,
    setValue: markSelected,
  };
}
