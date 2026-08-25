/**
 * ui/credits.js — 아이디어를 얻은 작업에 대한 크레딧
 *
 * QR 매트릭스를 3D 오브젝트의 배치·높이로 인코딩하고 카메라 전환으로
 * 2D 스캔 뷰를 드러낸다는 구조적 아이디어는 아래 작업들에서 얻었다.
 * 코드와 에셋은 모두 독자적으로 구현했다.
 *
 * 화면에 늘 떠 있지 않도록 버튼 뒤에 한 단계 접어 둔다.
 */

const SOURCES = [
  {
    label: 'tree.icqr.com',
    href: 'https://tree.icqr.com/',
    note: 'URL을 3D 나무와 QR코드로 바꾸는 서비스',
  },
  { label: '@logotypercom', href: 'https://x.com/logotypercom', note: '' },
  { label: '@reactiive_', href: 'https://x.com/reactiive_', note: '' },
];

export function createCredits() {
  const section = document.createElement('aside');
  section.className = 'app-credits';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'app-credits__toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = `
    <span class="material-icons-outlined" aria-hidden="true">lightbulb</span>
    이 프로젝트가 빚진 것들
  `;

  const panel = document.createElement('div');
  panel.className = 'app-credits__panel';
  panel.hidden = true;

  const intro = document.createElement('p');
  intro.className = 'app-credits__intro';
  intro.textContent =
    'QR 매트릭스를 3D 오브젝트의 배치와 높이로 인코딩하고, 카메라 전환으로 스캔 뷰를 드러낸다는 구조적 아이디어는 아래 작업들에서 얻었습니다. 코드와 에셋은 모두 독자적으로 구현했습니다.';

  const list = document.createElement('ul');
  list.className = 'app-credits__list';
  for (const source of SOURCES) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = source.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = source.label;
    item.append(link);
    if (source.note) item.append(` — ${source.note}`);
    list.appendChild(item);
  }

  panel.append(intro, list);

  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  });

  section.append(toggle, panel);
  return section;
}
