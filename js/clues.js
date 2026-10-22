import * as spotify from './spotify.js';

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

// ---------- theme music, played in the player's own Spotify app ----------

const DEFAULT_SNIPPET_SECONDS = 30;

// Spotify's app does the playing; this page finds the track up front and remote-controls it on a tap.
function spotifyClue(card, { onError } = {}) {
  const clue = card.clues.theme;
  const startMs = (clue.start ?? 0) * 1000;
  const snippetMs = (clue.seconds ?? DEFAULT_SNIPPET_SECONDS) * 1000;
  const box = el('div', 'clue clue-theme');
  const button = el('button', 'play big', 'Finding the song…');
  button.disabled = true;
  const note = el('div', 'credit', '♪ Plays in your Spotify app');
  box.append(el('div', 'cover cover-full'), button, note);

  let dead = false;
  let track = null;
  let playing = false;
  let finished = false;
  let playedMs = 0;
  let startedAt = 0;
  let timer = null;

  const setButton = text => {
    button.className = `play ${playing ? 'mini' : 'big'}`;
    button.textContent = text ?? (playing ? '❚❚' : finished ? '↻ Replay' : '▶ Tap to play');
  };
  const stopTimer = () => { clearTimeout(timer); timer = null; };
  const settle = () => {
    if (playing) playedMs += performance.now() - startedAt;
    playing = false;
    stopTimer();
  };
  const fail = reason => {
    if (dead) return;
    settle();
    button.disabled = true;
    button.className = 'play big';
    button.textContent = 'Song unavailable';
    onError?.(reason);
  };

  const start = async () => {
    if (finished) { playedMs = 0; finished = false; }
    button.disabled = true;
    try {
      await spotify.play(track.uri, startMs + playedMs);
    } catch (err) {
      if (dead) return;
      button.disabled = false;
      if (err.code === 'no-device') {
        setButton('Open Spotify, play any song, then tap here');
        note.replaceChildren(el('a', '', 'Open Spotify'));
        note.firstChild.href = 'https://open.spotify.com/';
        return;
      }
      fail(err.code);
      return;
    }
    if (dead) { spotify.pause().catch(() => {}); return; }
    playing = true;
    startedAt = performance.now();
    button.disabled = false;
    setButton();
    timer = setTimeout(() => {
      settle();
      finished = true;
      playedMs = 0;
      spotify.pause().catch(() => {});
      setButton();
    }, Math.max(0, snippetMs - playedMs));
  };

  button.addEventListener('click', () => {
    if (!track) return;
    if (playing) {
      settle();
      setButton();
      spotify.pause().catch(() => {});
    } else {
      start();
    }
  });

  spotify.findTrack(clue).then(found => {
    if (dead) return;
    track = found;
    button.disabled = false;
    setButton();
  }).catch(err => fail(err.code ?? 'network'));

  return {
    node: box,
    pause() { if (playing) { settle(); setButton(); spotify.pause().catch(() => {}); } },
    // Shown after the reveal, so the song can be named without giving the answer away.
    info: () => track && {
      text: `${track.name} – ${(track.artists ?? []).map(a => a.name).join(', ')}`,
      url: track.external_urls?.spotify,
      linkText: 'Listen on Spotify',
    },
    destroy() {
      dead = true;
      const wasPlaying = playing;
      settle();
      if (wasPlaying) spotify.pause().catch(() => {});
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
  theme: (card, opts) => (card.clues.theme.youtubeId ? videoClue(card, 'theme', opts) : spotifyClue(card, opts)),
  still: card => stillClue(card),
  quote: card => textClue(`“${card.clues.quote}”`, 'blockquote'),
  plot: card => textClue(card.clues.plot, 'p'),
};

// ---------- public API ----------

// Why a clue was swapped for another one, shown above the replacement.
export function failureNotice(reason) {
  switch (reason) {
    case 'premium': return "Spotify Premium is needed to play theme songs, so here's another clue.";
    case 'auth': return "Spotify needs reconnecting (on the setup screen), so here's another clue.";
    case 'no-track': return "That song wasn't found on Spotify, so here's another clue.";
    case 'rate': return "Spotify is busy right now, so here's another clue.";
    default: return "That video isn't available, so here's another clue.";
  }
}

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
