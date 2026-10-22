import test from 'node:test';
import assert from 'node:assert/strict';
import { pickPreview, searchUrl } from '../js/itunes.js';

const r = (trackName, artistName, previewUrl = `https://x/${trackName}.m4a`) => ({ trackName, artistName, previewUrl });

test('pickPreview prefers the named artist over a cover', () => {
  const results = [r('Theme', 'Some Cover Band'), r('Theme', 'The Rembrandts')];
  assert.equal(pickPreview(results, { artist: 'The Rembrandts' }).artistName, 'The Rembrandts');
});

test('pickPreview matches the artist loosely and ignores results with no preview', () => {
  const results = [r('A', 'Kyle Dixon & Michael Stein', undefined), r('B', 'Kyle Dixon & Michael Stein')];
  results[0].previewUrl = undefined;
  assert.equal(pickPreview(results, { artist: 'Kyle Dixon' }).trackName, 'B');
});

test('pickPreview falls back to the first playable result, or null', () => {
  assert.equal(pickPreview([r('A', 'Someone'), r('B', 'Other')], { artist: 'Nobody' }).trackName, 'A');
  assert.equal(pickPreview([r('A', 'Someone')], {}).trackName, 'A');
  assert.equal(pickPreview([{ trackName: 'A', artistName: 'x' }], {}), null);
  assert.equal(pickPreview([], {}), null);
  assert.equal(pickPreview(undefined, {}), null);
});

test('searchUrl searches songs by artist and title, with an optional JSONP callback', () => {
  const u = new URL(searchUrl({ search: "I'll Be There for You", artist: 'The Rembrandts' }, 'cb1'));
  assert.equal(u.origin + u.pathname, 'https://itunes.apple.com/search');
  assert.equal(u.searchParams.get('term'), "The Rembrandts I'll Be There for You");
  assert.equal(u.searchParams.get('entity'), 'song');
  assert.equal(u.searchParams.get('callback'), 'cb1');
  assert.equal(new URL(searchUrl({ search: 'x' })).searchParams.has('callback'), false);
});
