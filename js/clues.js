export const CLUE_LABELS = {
  trailer: 'Trailer',
  theme: 'Theme music',
  still: 'Still frame',
  quote: 'Quote',
  plot: 'Plot hint',
};

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};

function youtubeSrc({ youtubeId, start = 0, end }) {
  const p = new URLSearchParams({ autoplay: 1, controls: 0, modestbranding: 1, rel: 0, playsinline: 1, start });
  if (end) p.set('end', end);
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?${p}`;
}

function frame(clue) {
  const iframe = el('iframe', 'yt');
  iframe.src = youtubeSrc(clue);
  iframe.allow = 'autoplay; encrypted-media';
  iframe.title = 'Clue';
  return iframe;
}

const wikiCache = new Map();
async function wikiPoster(page) {
  if (!wikiCache.has(page)) {
    wikiCache.set(page, fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(j => j.originalimage?.source || j.thumbnail?.source));
  }
  return wikiCache.get(page);
}

const RENDERERS = {
  // The cover bars hide the title card text that trailers often show at the top and bottom.
  trailer(card) {
    const box = el('div', 'clue clue-video');
    box.append(frame(card.clues.trailer), el('div', 'cover cover-top'), el('div', 'cover cover-bottom'));
    return box;
  },

  // The video is fully covered so only the audio is left.
  theme(card) {
    const box = el('div', 'clue clue-theme');
    box.append(frame(card.clues.theme), el('div', 'cover cover-full'), el('div', 'note', '♪ Listen…'));
    return box;
  },

  still(card, index) {
    const box = el('div', 'clue clue-still');
    const img = el('div', 'still');
    const mode = card.clues.still?.crop || (index % 2 ? 'blur' : 'zoom');
    img.dataset.mode = mode;
    box.append(img, el('div', 'note', 'Loading…'));
    const url = card.clues.still?.image ? Promise.resolve(card.clues.still.image) : wikiPoster(card.wiki);
    url.then(src => {
      if (!src) throw new Error('no image');
      img.style.backgroundImage = `url("${src}")`;
      img.style.backgroundPosition = `${20 + Math.random() * 60}% ${20 + Math.random() * 60}%`;
      box.querySelector('.note').textContent = '';
      requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('go')));
    }).catch(() => { box.querySelector('.note').textContent = 'No image for this one'; });
    return box;
  },

  quote(card) {
    const box = el('div', 'clue clue-text');
    box.append(el('blockquote', '', `“${card.clues.quote}”`));
    return box;
  },

  plot(card) {
    const box = el('div', 'clue clue-text');
    box.append(el('p', '', card.clues.plot));
    return box;
  },
};

let stillCount = 0;
export function renderClue(container, card, type) {
  container.replaceChildren(RENDERERS[type](card, stillCount++));
}
