import { lookupPreview } from './itunes.js';

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

// ---------- YouTube ----------

let apiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const script = el('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { apiPromise = null; reject(new Error('YouTube API failed to load')); };
    document.head.append(script);
  });
  return apiPromise;
}

const READY_TIMEOUT_MS = 10000;

// iOS Safari only plays media from a tap, so the player is created and cued up front and
// the tap calls playVideo() directly inside the gesture. Without a tap nothing plays.
function videoClue(card, type, { onError } = {}) {
  const clue = card.clues[type];
  const start = clue.start ?? 0;
  const box = el('div', `clue ${type === 'trailer' ? 'clue-video' : 'clue-theme'}`);
  const mount = el('div');
  // Trailers hide the top and bottom bars where title cards often appear; themes hide the whole video.
  const covers = type === 'trailer'
    ? [el('div', 'cover cover-top'), el('div', 'cover cover-bottom')]
    : [el('div', 'cover cover-full')];
  const button = el('button', 'play big', 'Loading…');
  button.disabled = true;
  box.append(mount, ...covers, button);

  let player;
  let dead = false;
  let playing = false;
  let ended = false;

  const fail = code => {
    if (dead) return;
    clearTimeout(timer);
    button.disabled = true;
    button.className = 'play big';
    button.textContent = 'Video unavailable';
    onError?.(code);
  };
  const timer = setTimeout(() => fail('timeout'), READY_TIMEOUT_MS);

  const setButton = () => {
    button.className = `play ${playing ? 'mini' : 'big'}`;
    button.textContent = playing ? '❚❚' : ended ? '↻ Replay' : '▶ Tap to play';
  };

  button.addEventListener('click', () => {
    if (!player) return;
    if (playing) player.pauseVideo();
    else {
      if (ended) player.seekTo(start, true);
      player.playVideo();
    }
  });

  loadYouTubeApi().then(YT => {
    if (dead) return;
    player = new YT.Player(mount, {
      videoId: clue.youtubeId,
      width: '100%',
      height: '100%',
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        controls: 0, playsinline: 1, rel: 0, modestbranding: 1, fs: 0, disablekb: 1,
        iv_load_policy: 3, start, ...(clue.end ? { end: clue.end } : {}),
      },
      events: {
        onReady: () => {
          if (dead) return;
          clearTimeout(timer);
          button.disabled = false;
          setButton();
        },
        onStateChange: e => {
          playing = e.data === YT.PlayerState.PLAYING;
          ended = e.data === YT.PlayerState.ENDED;
          setButton();
        },
        onError: e => fail(e.data),
      },
    });
  }).catch(() => fail('api'));

  return {
    node: box,
    pause() { try { player?.pauseVideo(); } catch { /* player not ready */ } },
    destroy() {
      dead = true;
      clearTimeout(timer);
      try { player?.destroy(); } catch { /* player not ready */ }
    },
  };
}

// ---------- theme music from an Apple Music preview ----------

// Same tap-to-play contract as video: the lookup runs up front and the tap calls play() directly.
function audioClue(card, { onError } = {}) {
  const clue = card.clues.theme;
  const box = el('div', 'clue clue-theme');
  const button = el('button', 'play big', 'Loading…');
  button.disabled = true;
  const credit = el('div', 'credit', '♪ Apple Music preview');
  box.append(el('div', 'cover cover-full'), button, credit);

  const audio = new Audio();
  audio.preload = 'auto';
  let dead = false;
  let playing = false;
  let ended = false;
  let hit = null;

  const fail = reason => {
    if (dead) return;
    button.disabled = true;
    button.className = 'play big';
    button.textContent = 'Preview unavailable';
    onError?.(reason);
  };
  const setButton = () => {
    button.className = `play ${playing ? 'mini' : 'big'}`;
    button.textContent = playing ? '❚❚' : ended ? '↻ Replay' : '▶ Tap to play';
  };

  button.addEventListener('click', () => {
    if (playing) { audio.pause(); return; }
    if (ended) audio.currentTime = 0;
    audio.play().catch(() => fail('play'));
  });
  audio.addEventListener('play', () => { playing = true; ended = false; setButton(); });
  audio.addEventListener('pause', () => { playing = false; setButton(); });
  audio.addEventListener('ended', () => { playing = false; ended = true; setButton(); });
  audio.addEventListener('error', () => fail('audio'));

  lookupPreview(clue).then(result => {
    if (dead) return;
    hit = result;
    audio.src = result.previewUrl;
    // Apple asks for previews to sit next to a link back to the store.
    if (result.trackViewUrl) {
      const link = el('a', '', '♪ Apple Music preview');
      link.href = result.trackViewUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      credit.replaceChildren(link);
    }
    button.disabled = false;
    setButton();
  }).catch(() => fail('lookup'));

  return {
    node: box,
    pause() { audio.pause(); },
    // Shown after the reveal, so it can name the song without giving the answer away.
    info: () => hit && { text: `${hit.trackName} – ${hit.artistName}`, url: hit.trackViewUrl },
    destroy() {
      dead = true;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    },
  };
}

// ---------- other clue types ----------

const wikiCache = new Map();
async function wikiPoster(page) {
  if (!wikiCache.has(page)) {
    wikiCache.set(page, fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(j => j.originalimage?.source || j.thumbnail?.source));
  }
  return wikiCache.get(page);
}

let stillCount = 0;
function stillClue(card) {
  const box = el('div', 'clue clue-still');
  const img = el('div', 'still');
  const mode = card.clues.still?.crop || (stillCount++ % 2 ? 'blur' : 'zoom');
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
  return { node: box };
}

function textClue(text, tag) {
  const box = el('div', 'clue clue-text');
  box.append(el(tag, '', text));
  return { node: box };
}

const RENDERERS = {
  trailer: (card, opts) => videoClue(card, 'trailer', opts),
  theme: (card, opts) => (card.clues.theme.youtubeId ? videoClue(card, 'theme', opts) : audioClue(card, opts)),
  still: card => stillClue(card),
  quote: card => textClue(`“${card.clues.quote}”`, 'blockquote'),
  plot: card => textClue(card.clues.plot, 'p'),
};

// ---------- public API ----------

let current = null;

// Renders one clue into `container`, replacing (and silencing) the previous one.
// `onError` fires if a video can't be played, so the caller can offer another clue.
export function renderClue(container, card, type, opts) {
  stopClue();
  current = RENDERERS[type](card, opts);
  container.replaceChildren(current.node);
}

export function pauseClue() {
  current?.pause?.();
}

// What the current clue was, e.g. the song a theme preview came from. Only call after the reveal.
export function clueInfo() {
  return current?.info?.() ?? null;
}

export function stopClue() {
  current?.destroy?.();
  current = null;
}
