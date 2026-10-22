import { normalize } from './game.js';

// 30-second song previews from Apple's public iTunes Search API (no key, no Apple Music app).
// A theme clue opts in with { "search": "I'll Be There for You", "artist": "The Rembrandts" }.

export function searchUrl(clue, callback) {
  const params = new URLSearchParams({
    term: [clue.artist, clue.search].filter(Boolean).join(' '),
    media: 'music',
    entity: 'song',
    limit: '10',
  });
  if (callback) params.set('callback', callback);
  return `https://itunes.apple.com/search?${params}`;
}

// The result to play: one that has a preview, preferring the named artist so a cover or remix
// doesn't beat the original; with no artist match, the first result that has a preview.
export function pickPreview(results, clue) {
  const playable = (results ?? []).filter(r => r.previewUrl);
  const artist = clue.artist ? normalize(clue.artist) : '';
  return (artist && playable.find(r => normalize(r.artistName ?? '').includes(artist))) || playable[0] || null;
}

// JSONP, so it works without the service sending CORS headers.
let callbackCount = 0;
export function lookupPreview(clue, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const name = `__itunesPreview${++callbackCount}`;
    const script = document.createElement('script');
    const finish = (settle, value) => {
      clearTimeout(timer);
      window[name] = () => {}; // a late response must not throw
      script.remove();
      settle(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('timeout')), timeoutMs);
    window[name] = data => {
      const hit = pickPreview(data?.results, clue);
      if (hit) finish(resolve, hit);
      else finish(reject, new Error('no preview'));
    };
    script.onerror = () => finish(reject, new Error('network'));
    script.src = searchUrl(clue, name);
    document.head.append(script);
  });
}
