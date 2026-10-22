import test from 'node:test';
import assert from 'node:assert/strict';
import { isCorrectPlacement, createGame, place, nextTurn, skipCard, awardToken, availableClues } from '../js/game.js';

const card = (id, year, extra = {}) => ({ id, title: id, year, clues: { plot: 'p' }, ...extra });
const tl = [card('a', 1970), card('b', 1990), card('c', 2010)];

test('placement before, between and after', () => {
  assert.equal(isCorrectPlacement(tl, 0, 1960), true);
  assert.equal(isCorrectPlacement(tl, 0, 1980), false);
  assert.equal(isCorrectPlacement(tl, 1, 1980), true);
  assert.equal(isCorrectPlacement(tl, 1, 2000), false);
  assert.equal(isCorrectPlacement(tl, 3, 2020), true);
  assert.equal(isCorrectPlacement(tl, 3, 2000), false);
});

test('equal years count as correct', () => {
  assert.equal(isCorrectPlacement(tl, 1, 1970), true);
  assert.equal(isCorrectPlacement(tl, 1, 1990), true);
  assert.equal(isCorrectPlacement(tl, 0, 1970), true);
});

const titles = Array.from({ length: 20 }, (_, i) => card('t' + i, 1950 + i * 3));

test('correct placement keeps the card and a wrong one discards it', () => {
  const g = createGame({ titles, names: ['A', 'B'], target: 3 });
  const p = g.players[0];
  const existing = p.timeline[0].year;
  g.card = card('x', existing + 1);
  assert.equal(place(g, 1).correct, true);
  assert.equal(p.timeline.length, 2);
  g.card = card('y', existing + 5);
  assert.equal(place(g, 0).correct, false);
  assert.equal(p.timeline.length, 2);
});

test('reaching the target wins and stops turns', () => {
  const g = createGame({ titles, names: ['A'], target: 2 });
  g.card = card('x', g.players[0].timeline[0].year);
  place(g, 1);
  assert.equal(g.winner, 0);
  const before = g.card;
  nextTurn(g);
  assert.equal(g.card, before);
});

test('turns rotate and tokens buy a skip', () => {
  const g = createGame({ titles, names: ['A', 'B'] });
  assert.equal(skipCard(g), false);
  awardToken(g);
  const old = g.card;
  assert.equal(skipCard(g), true);
  assert.notEqual(g.card, old);
  assert.equal(g.players[0].tokens, 0);
  nextTurn(g);
  assert.equal(g.current, 1);
});

test('empty deck ends the game for the longest timeline', () => {
  const g = createGame({ titles: titles.slice(0, 3), names: ['A', 'B'], target: 9 });
  g.players[1].timeline.push(card('extra', 2000));
  nextTurn(g);
  assert.equal(g.card, null);
  assert.equal(g.winner, 1);
});

test('availableClues only lists what a card has', () => {
  assert.deepEqual(availableClues({ clues: { quote: 'q', plot: 'p' } }), ['quote', 'plot']);
  assert.deepEqual(availableClues({ clues: {}, wiki: 'Jaws_(film)' }), ['still']);
  assert.deepEqual(availableClues({ clues: { trailer: { youtubeId: 'x' } } }), ['trailer']);
});
