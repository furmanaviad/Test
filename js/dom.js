export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter(c => c != null && c !== false));
  return node;
}

export async function loadTitles() {
  const res = await fetch(new URL('../data/titles.json', import.meta.url));
  if (!res.ok) throw new Error(`Could not load titles (${res.status})`);
  return res.json();
}

export const typeLabel = card => (card.type === 'tv' ? 'TV show' : 'Movie');
