import { h, typeLabel } from './dom.js';
import { availableClues, fallbackClue } from './game.js';
import { renderClue, pauseClue, CLUE_LABELS } from './clues.js';

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
  const types = availableClues(card);
  const buttons = types.map(t => h('button', { class: 'chip', onclick: () => show(t) }, CLUE_LABELS[t]));
  const failed = new Set();
  const show = (t, notice) => {
    buttons.forEach((b, i) => b.classList.toggle('on', types[i] === t));
    renderClue(clueBox, card, t, { onError: () => {
      failed.add(t);
      const next = fallbackClue(card, failed);
      if (next) show(next, "That video isn't available, so here's another clue.");
    } });
    if (notice) clueBox.prepend(h('p', { class: 'hint' }, notice));
  };
  const reveal = h('button', { class: 'primary', onclick: () => { pauseClue(); answer.hidden = false; reveal.hidden = true; } }, 'Reveal answer');
  app.replaceChildren(h('section', { class: 'card-view' },
    h('p', { class: 'hint' }, 'Pick a clue, then place the card on your timeline.'),
    h('div', { class: 'chips' }, buttons),
    clueBox, reveal, answer));
  if (types.length) show(types[0]);
}
