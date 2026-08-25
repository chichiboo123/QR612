/**
 * ui/themePicker.js — 4개 테마 썸네일 카드 선택기
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
  section.innerHTML = `
    <h2 class="panel__title">
      <span class="material-icons-outlined">palette</span>
      테마 선택
    </h2>
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
    card.dataset.themeId = theme.id;

    const [a, b, c] = theme.swatch;
    card.innerHTML = `
      <span class="theme-card__thumb" style="background:
        linear-gradient(160deg, ${b} 0%, ${b} 46%, ${a} 46%, ${a} 100%);"></span>
      <span class="theme-card__name">${theme.label}</span>
      <span class="theme-card__caption">${theme.caption}</span>
      <span class="theme-card__check"><span class="material-icons-outlined">check</span></span>
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

  function select(themeId) {
    for (const [id, card] of cards) {
      card.setAttribute('aria-checked', String(id === themeId));
    }
    onChange(themeId);
  }

  // 좌우 방향키로 테마 이동 (라디오 그룹 접근성)
  list.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
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
    setValue(themeId) {
      for (const [id, card] of cards) {
        card.setAttribute('aria-checked', String(id === themeId));
      }
    },
  };
}
