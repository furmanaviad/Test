import test from 'node:test';
import assert from 'node:assert/strict';
import { base64url, challengeFor, buildAuthUrl, parseRedirect, searchQueries, pickTrack, randomString } from '../js/spotify.js';

test('PKCE challenge matches the RFC 7636 example', async () => {
  assert.equal(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('base64url is URL safe and unpadded', () => {
  assert.equal(base64url(new Uint8Array([251, 255, 254])), '-__-');
  assert.equal(base64url(new Uint8Array([1])), 'AQ');
});

test('randomString has the requested length and a safe alphabet', () => {
  const s = randomString(64);
  assert.equal(s.length, 64);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(s, randomString(64));
});

test('buildAuthUrl asks for PKCE with the playback scopes', () => {
  const u = new URL(buildAuthUrl({ clientId: 'abc', redirectUri: 'https://x.github.io/Test/', challenge: 'ch', state: 'st' }));
  assert.equal(u.origin + u.pathname, 'https://accounts.spotify.com/authorize');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('client_id'), 'abc');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://x.github.io/Test/');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('code_challenge'), 'ch');
  assert.equal(u.searchParams.get('state'), 'st');
  assert.deepEqual(u.searchParams.get('scope').split(' ').sort(), ['user-modify-playback-state', 'user-read-playback-state']);
});

test('parseRedirect reads a code, an error, or nothing', () => {
  assert.deepEqual(parseRedirect('?code=c1&state=s1'), { code: 'c1', state: 's1' });
  assert.deepEqual(parseRedirect('?error=access_denied&state=s1'), { error: 'access_denied' });
  assert.equal(parseRedirect(''), null);
  assert.equal(parseRedirect('?code=only'), null);
});

test('searchQueries try artist and title first, then a plain query', () => {
  assert.deepEqual(searchQueries({ search: 'Danger Zone', artist: 'Kenny Loggins' }),
    ['track:Danger Zone artist:Kenny Loggins', 'Danger Zone Kenny Loggins']);
  assert.deepEqual(searchQueries({ search: 'Danger Zone' }), ['Danger Zone']);
});

test('pickTrack prefers the named artist over a cover, then the first result', () => {
  const cover = { name: 'Theme', artists: [{ name: 'Cover Band' }] };
  const original = { name: 'Theme', artists: [{ name: 'Kyle Dixon' }, { name: 'Michael Stein' }] };
  assert.equal(pickTrack([cover, original], { artist: 'Kyle Dixon' }), original);
  assert.equal(pickTrack([cover, original], { artist: 'Nobody' }), cover);
  assert.equal(pickTrack([cover], {}), cover);
  assert.equal(pickTrack([], { artist: 'x' }), null);
  assert.equal(pickTrack(undefined, {}), null);
});
