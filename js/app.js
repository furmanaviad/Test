import { h, loadTitles, typeLabel } from './dom.js';
import { createGame, place, nextTurn, skipCard, awardToken, availableClues, fallbackClue, titleMatches } from './game.js';
import { renderClue, pauseClue, stopClue, CLUE_LABELS } from './clues.js';
import { viewCard } from './card.js';

const app = document.getElementById('app');
let titles = [];
let settings = { names: ['Player 1', 'Player 2'], target: 5, mode: 'random' };

// ---------- setup ----------

function showSetup() {
  stopClue();
  const names = h('div', { class: 'names' });
  const renderNames = () => names.replaceChildren(...settings.names.map((n, i) =>
    h('input', { value: n, 'aria-label': `Player ${i + 1} name`, oninput: e => { settings.names[i] = e.target.value; } })));
  renderNames();

  const count = h('select', { 'aria-label': 'Players', onchange: e => {
    const n = Number(e.target.value);
    while (settings.names.length < n) settings.names.push(`Player ${settings.names.length + 1}`);
    settings.names.length = n;
    renderNames();
  } }, [2, 3, 4, 5, 6].map(n => h('option', { value: n, selected: n === settings.names.length }, `${n} players`)));

  const target = h('select', { 'aria-label': 'Cards to win', onchange: e => { settings.target = Number(e.target.value); } },
    [3, 5, 7, 10].map(n => h('option', { value: n, selected: n === settings.target }, `First to ${n} cards`)));

  const modes = [['random', 'Random clue each turn'], ['choice', "Player's choice"],
    ...Object.entries(CLUE_LABELS).map(([k, v]) => [k, `Always: ${v}`])];
  const mode = h('select', { 'aria-label': 'Clue mode', onchange: e => { settings.mode = e.target.value; } },
    modes.map(([k, v]) => h('option', { value: k, selected: k === settings.mode }, v)));

  app.replaceChildren(h('section', { class: 'setup' },
    h('h1', {}, 'Movies & TV, in order'),
    h('p', {}, 'Get the clue, then place the title where it belongs on your timeline by release year (first air date for TV).'),
    count, names, target, mode,
    h('button', { class: 'primary', onclick: startGame }, 'Start game'),
    h('p', { class: 'hint' }, `${titles.length} titles loaded.`)));
}

// ---------- play ----------

function startGame() {
  const names = settings.names.map((n, i) => n.trim() || `Player ${i + 1}`);
  const game = createGame({ titles, names, target: settings.target });
  showTurn(game);
}

// Picks a clue type for the card, or null if the player must choose.
function pickType(card) {
  const types = availableClues(card);
  if (settings.mode === 'choice') return null;
  if (settings.mode === 'random') return types[Math.floor(Math.random() * types.length)];
  // A fixed mode falls back to a plot hint if this card lacks that clue.
  return types.includes(settings.mode) ? settings.mode : (types.includes('plot') ? 'plot' : types[0]);
}

function timelineView(game, onPlace) {
  const player = game.players[game.current];
  const row = h('div', { class: 'timeline' });
  const gap = i => h('button', { class: 'gap', 'aria-label': `Place at position ${i + 1}`, onclick: () => onPlace(i) }, '+');
  player.timeline.forEach((c, i) => row.append(gap(i), h('div', { class: 'tcard' },
    h('strong', {}, String(c.year)), h('span', {}, c.title))));
  row.append(gap(player.timeline.length));
  return row;
}

function scoreboard(game) {
  return h('ul', { class: 'scores' }, game.players.map((p, i) =>
    h('li', { class: i === game.current ? 'active' : '' }, `${p.name}: ${p.timeline.length}/${game.target}` + (p.tokens ? ` · ${p.tokens}★` : ''))));
}

function showTurn(game) {
  if (game.winner !== null) return showWinner(game);
  const player = game.players[game.current];
  const clueBox = h('div', { class: 'clue-box' });
  const chooser = h('div', { class: 'chips' });
  const skip = h('button', { class: 'secondary', disabled: player.tokens < 1 || !game.deck.length, onclick: () => { skipCard(game); showTurn(game); } },
    'Skip clue (1★)');

  const failed = new Set();
  const show = (t, notice) => {
    [...chooser.children].forEach(b => b.classList.toggle('on', b.dataset.type === t));
    renderClue(clueBox, game.card, t, { onError: () => {
      failed.add(t);
      const next = fallbackClue(game.card, failed);
      if (next) show(next, "That video isn't available, so here's another clue.");
    } });
    if (notice) clueBox.prepend(h('p', { class: 'hint' }, notice));
  };
  const type = pickType(game.card);
  if (type) show(type);
  else chooser.append(...availableClues(game.card).map(t =>
    h('button', { class: 'chip', 'data-type': t, onclick: () => show(t) }, CLUE_LABELS[t])));

  const guess = h('input', { class: 'guess', type: 'text', placeholder: 'Know the title? Type it here for a ★',
    'aria-label': 'Guess the title', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off',
    spellcheck: 'false', enterkeyhint: 'done' });

  app.replaceChildren(h('section', { class: 'turn' },
    scoreboard(game),
    h('h2', {}, `${player.name}, where does it go?`),
    chooser, clueBox, skip, guess,
    timelineView(game, i => showReveal(game, place(game, i), guess.value.trim()))));
}

function showReveal(game, { correct, card }, guess = '') {
  pauseClue();
  const player = game.players[game.current];
  const named = titleMatches(guess, card);
  if (named) awardToken(game);
  const guessNote = named ? h('p', { class: 'named' }, `You named it! +1★`)
    : guess ? h('p', { class: 'hint' }, `Your guess: “${guess}”`) : null;
  // Spoken guesses (no typing) still count if the others agree.
  const gotToken = named ? null : h('button', { class: 'secondary', onclick: e => { awardToken(game); e.target.disabled = true; e.target.textContent = 'Token awarded ★'; } },
    'They said the title out loud (+1★)');
  app.replaceChildren(h('section', { class: `reveal ${correct ? 'ok' : 'bad'}` },
    h('h2', {}, correct ? 'Correct!' : 'Not quite'),
    h('div', { class: 'answer' },
      h('h3', {}, card.title), h('p', { class: 'year' }, String(card.year)), h('p', { class: 'kind' }, typeLabel(card))),
    h('p', {}, correct ? `${player.name} keeps the card.` : 'The card is discarded.'),
    guessNote,
    gotToken,
    h('button', { class: 'primary', onclick: () => { nextTurn(game); showTurn(game); } },
      game.winner !== null ? 'See result' : 'Next player')));
}

function showWinner(game) {
  stopClue();
  const w = game.players[game.winner];
  app.replaceChildren(h('section', { class: 'winner' },
    h('h1', {}, `${w.name} wins!`), scoreboard(game),
    h('button', { class: 'primary', onclick: startGame }, 'Play again'),
    h('button', { class: 'secondary', onclick: showSetup }, 'Change settings')));
}

// ---------- routing ----------

function route() {
  stopClue();
  const m = location.hash.match(/^#card=(.+)$/);
  if (m) viewCard(app, titles, decodeURIComponent(m[1]));
  else showSetup();
}

addEventListener('hashchange', route);
loadTitles().then(t => { titles = t; route(); })
  .catch(err => app.replaceChildren(h('p', { class: 'error' }, err.message)));
