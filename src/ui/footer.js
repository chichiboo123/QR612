/**
 * ui/footer.js — 치치부 표준 푸터 (모든 페이지 최하단 필수)
 */

export function createFooter() {
  const footer = document.createElement('footer');
  footer.className = 'chichiboo-footer';
  footer.innerHTML = `
    <a href="https://litt.ly/chichiboo" target="_blank" rel="noopener noreferrer">
      <span class="material-icons-outlined">auto_stories</span>
      Created by. 교육뮤지컬 꿈꾸는 치수쌤
    </a>
  `;
  return footer;
}
