export const CLUE_TYPES = ['trailer', 'theme', 'still', 'quote', 'plot'];

export function shuffle(items, rng = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Clue types a card can offer. A still can come from a local image or a Wikipedia poster. A theme
// given as a Spotify search only counts once Spotify is connected (`features.spotify`).
export function availableClues(card, features = {}) {
  const c = card.clues || {};
  return CLUE_TYPES.filter(t => {
    if (t === 'still') return c.still || card.wiki;
    if (t === 'theme') return c.theme && (c.theme.youtubeId || (c.theme.search && features.spotify));
    return c[t];
  });
}

// Fallback order when a clue can't be shown: text always works, a still needs a network
// fetch, and a video that won't embed is likely to fail again.
const FALLBACK_ORDER = ['quote', 'plot', 'still', 'trailer', 'theme'];

// Next-best clue for `card`, skipping the `failed` ones (a Set), or null if none are left.
export function fallbackClue(card, failed, features) {
  const have = availableClues(card, features).filter(t => !failed.has(t));
  return FALLBACK_ORDER.find(t => have.includes(t)) ?? null;
}

// Lowercase, accent-free, no punctuation, parentheticals or leading article, so "The Office (US)"
// and "office" compare equal.
export function normalize(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\(.*?\)/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
    .replace(/^(the|a|an) /, '').replace(/ /g, '');
}

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

// Does the typed `guess` name this card? Allows a small typo (none for very short titles),
// and any of the card's `aliases`.
export function titleMatches(guess, card) {
  const g = normalize(guess);
  if (!g) return false;
  return [card.title, ...(card.aliases ?? [])].some(name => {
    const n = normalize(name);
    const tolerance = n.length <= 4 ? 0 : n.length <= 9 ? 1 : 2;
    return Math.abs(n.length - g.length) <= tolerance && editDistance(g, n) <= tolerance;
  });
}

// `index` is the gap the card is placed in: 0 = before the first card, n = after the last.
// A year equal to a neighbour's year counts as correct.
export function isCorrectPlacement(timeline, index, year) {
  const before = timeline[index - 1];
  const after = timeline[index];
  return (!before || before.year <= year) && (!after || year <= after.year);
}

export function createGame({ titles, names, target = 5, rng = Math.random }) {
  const deck = shuffle(titles, rng);
  const players = names.map(name => ({ name, timeline: [deck.pop()], tokens: 0 }));
  return { deck, players, current: 0, target, card: deck.pop(), winner: null };
}

export function place(game, index) {
  const player = game.players[game.current];
  const card = game.card;
  const correct = isCorrectPlacement(player.timeline, index, card.year);
  if (correct) {
    player.timeline.splice(index, 0, card);
    if (player.timeline.length >= game.target) game.winner = game.current;
  }
  return { correct, card };
}

export function nextTurn(game) {
  if (game.winner !== null) return;
  game.current = (game.current + 1) % game.players.length;
  drawCard(game);
}

// Spends a token to swap the current card for a fresh one.
export function skipCard(game) {
  const player = game.players[game.current];
  if (player.tokens < 1 || !game.deck.length) return false;
  player.tokens -= 1;
  game.card = game.deck.pop();
  return true;
}

export function awardToken(game) {
  game.players[game.current].tokens += 1;
}

function drawCard(game) {
  game.card = game.deck.pop() ?? null;
  if (game.card) return;
  // Deck ran out: the longest timeline wins.
  const best = Math.max(...game.players.map(p => p.timeline.length));
  game.winner = game.players.findIndex(p => p.timeline.length === best);
}
