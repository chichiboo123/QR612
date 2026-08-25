/**
 * ui/credits.js — 아이디어를 얻은 작업에 대한 크레딧
 *
 * QR 매트릭스를 3D 오브젝트의 배치·높이로 인코딩하고 카메라 전환으로
 * 2D 스캔 뷰를 드러낸다는 구조적 아이디어는 아래 작업들에서 얻었다.
 * 코드와 에셋은 모두 독자적으로 구현했다.
 */

const SOURCES = [
  { label: 'tree.icqr.com', href: 'https://tree.icqr.com/' },
  { label: '@logotypercom', href: 'https://x.com/logotypercom' },
  { label: '@reactiive_', href: 'https://x.com/reactiive_' },
];

export function createCredits() {
  const section = document.createElement('aside');
  section.className = 'app-credits';

  const icon = document.createElement('span');
  icon.className = 'material-icons-outlined';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = 'lightbulb';

  const text = document.createElement('span');
  text.className = 'app-credits__text';
  text.append('아이디어를 얻은 곳 — ');

  SOURCES.forEach((source, index) => {
    if (index > 0) text.append(' · ');
    const link = document.createElement('a');
    link.href = source.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = source.label;
    text.append(link);
  });

  section.append(icon, text);
  return section;
}
