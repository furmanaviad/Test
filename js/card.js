import { h, typeLabel, infoLine } from './dom.js';
import { availableClues, fallbackClue, titleMatches } from './game.js';
import { renderClue, pauseClue, clueInfo, failureNotice, CLUE_LABELS } from './clues.js';
import * as spotify from './spotify.js';

// Opened by scanning a printed card's QR code. The timeline lives on the physical cards.
export function viewCard(app, titles, id) {
  const card = titles.find(t => t.id === id);
  if (!card) {
    app.replaceChildren(h('p', { class: 'error' }, `Unknown card “${id}”.`));
    return;
  }
  const clueBox = h('div', { class: 'clue-box' });
  const answer = h('div', { class: 'answer', hidden: true },
    h('h2', {}, card.title),
    h('p', { class: 'year' }, String(card.year)),
    h('p', { class: 'kind' }, typeLabel(card)));
  const features = { spotify: spotify.isConnected() };
  const types = availableClues(card, features);
  const buttons = types.map(t => h('button', { class: 'chip', onclick: () => show(t) }, CLUE_LABELS[t]));
  const failed = new Set();
  const show = (t, notice) => {
    buttons.forEach((b, i) => b.classList.toggle('on', types[i] === t));
    renderClue(clueBox, card, t, { onError: reason => {
      failed.add(t);
      const next = fallbackClue(card, failed, features);
      if (next) show(next, failureNotice(reason));
    } });
    if (notice) clueBox.prepend(h('p', { class: 'hint' }, notice));
  };
  const guess = h('input', { class: 'guess', type: 'text', placeholder: 'Know the title? Type it here',
    'aria-label': 'Guess the title', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off',
    spellcheck: 'false', enterkeyhint: 'done' });
  const result = h('p', { class: 'hint', hidden: true });
  const reveal = h('button', { class: 'primary', onclick: () => {
    pauseClue();
    const info = clueInfo();
    if (info) answer.append(infoLine(info));
    const typed = guess.value.trim();
    if (typed) {
      result.hidden = false;
      result.className = titleMatches(typed, card) ? 'named' : 'hint';
      result.textContent = titleMatches(typed, card) ? 'You named it!' : `Your guess: “${typed}”`;
    }
    answer.hidden = false;
    reveal.hidden = true;
  } }, 'Reveal answer');
  app.replaceChildren(h('section', { class: 'card-view' },
    h('p', { class: 'hint' }, 'Pick a clue, then place the card on your timeline.'),
    card.clues?.theme?.search && !features.spotify
      ? h('p', { class: 'hint' }, 'This card has a theme song. ', h('a', { href: './' }, 'Connect Spotify'), ' to hear it.') : null,
    h('div', { class: 'chips' }, buttons),
    clueBox, guess, reveal, result, answer));
  if (types.length) show(types[0]);
}
