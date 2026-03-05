/**
 * Shared navigation bar — injected into all pages.
 */

const NAV_LINKS = [
  { href: './', label: 'Story' },
  { href: './formal.html', label: 'Formal Structure' },
  { href: './sim.html', label: 'Simulation' },
  { href: './nash.html', label: 'Nash Analysis' },
  { href: './psuu.html', label: 'PSUU' },
];

export function initNav() {
  const nav = document.createElement('nav');
  nav.id = 'site-nav';
  nav.innerHTML = NAV_LINKS.map(link => {
    const current = isCurrentPage(link.href);
    return `<a href="${link.href}" class="nav-link${current ? ' active' : ''}">${link.label}</a>`;
  }).join('<span class="nav-sep">|</span>');

  document.body.insertBefore(nav, document.body.firstChild);
}

function isCurrentPage(href) {
  const path = window.location.pathname;
  if (href === './') {
    return path.endsWith('/') || path.endsWith('/index.html');
  }
  const page = href.replace('./', '');
  return path.endsWith('/' + page) || path.endsWith(page);
}
