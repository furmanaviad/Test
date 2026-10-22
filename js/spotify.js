import { normalize } from './game.js';
import { DEFAULT_SPOTIFY_CLIENT_ID } from './config.js';

// Theme songs play in the player's own Spotify app (Premium), remote-controlled through Spotify's Web API,
// the way Hitster does it. Login is Authorization Code + PKCE: no server and no secret.

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const SCOPES = 'user-modify-playback-state user-read-playback-state';
const KEYS = { clientId: 'spotify.clientId', tokens: 'spotify.tokens', pending: 'spotify.pending' };

export class SpotifyError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}

// ---------- pure helpers (unit tested) ----------

export function base64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomString(length = 64) {
  return base64url(crypto.getRandomValues(new Uint8Array(length))).slice(0, length);
}

export async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function buildAuthUrl({ clientId, redirectUri, challenge, state }) {
  const params = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: SCOPES,
    code_challenge_method: 'S256', code_challenge: challenge, state,
  });
  return `${AUTH_URL}?${params}`;
}

// What Spotify appends to the redirect URI: ?code=…&state=… or ?error=…
export function parseRedirect(search) {
  const p = new URLSearchParams(search);
  if (p.get('error')) return { error: p.get('error') };
  if (p.get('code') && p.get('state')) return { code: p.get('code'), state: p.get('state') };
  return null;
}

// Most specific query first, then a plain one.
export function searchQueries(clue) {
  const queries = [];
  if (clue.artist) queries.push(`track:${clue.search} artist:${clue.artist}`);
  queries.push([clue.search, clue.artist].filter(Boolean).join(' '));
  return queries;
}

// Prefer a track by the named artist so a cover doesn't win; otherwise the first result.
export function pickTrack(tracks, clue) {
  const list = tracks ?? [];
  const artist = clue.artist ? normalize(clue.artist) : '';
  const byArtist = artist && list.find(t => (t.artists ?? []).some(a => normalize(a.name).includes(artist)));
  return byArtist || list[0] || null;
}

// ---------- storage ----------

const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* storage blocked */ } },
};

export const clientId = () => store.get(KEYS.clientId) || DEFAULT_SPOTIFY_CLIENT_ID;
export const setClientId = id => store.set(KEYS.clientId, id.trim());
export const isConfigured = () => Boolean(clientId());
export const isConnected = () => Boolean(store.get(KEYS.tokens)?.refresh_token);
export const disconnect = () => store.remove(KEYS.tokens);

// The exact URL to register as the redirect URI in the Spotify dashboard.
export const redirectUri = () => new URL('./', location.href).href;

// ---------- login ----------

export async function connect() {
  const id = clientId();
  if (!id) throw new SpotifyError('no-client-id');
  const verifier = randomString(64);
  const state = randomString(16);
  store.set(KEYS.pending, { verifier, state });
  location.assign(buildAuthUrl({ clientId: id, redirectUri: redirectUri(), challenge: await challengeFor(verifier), state }));
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), ...body }),
  });
  if (!res.ok) throw new SpotifyError('auth', `token request failed (${res.status})`);
  return res.json();
}

function saveTokens(data, previous) {
  store.set(KEYS.tokens, {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? previous?.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  });
}

// Call once at startup: finishes a login if we were just redirected back from Spotify.
export async function completeLogin() {
  const result = parseRedirect(location.search);
  if (!result) return null;
  history.replaceState(null, '', location.pathname + location.hash);
  const pending = store.get(KEYS.pending);
  store.remove(KEYS.pending);
  if (result.error) return { error: result.error === 'access_denied' ? 'Spotify access was declined.' : `Spotify said: ${result.error}` };
  if (!pending || pending.state !== result.state) return { error: 'Spotify login could not be verified. Please try again.' };
  try {
    saveTokens(await tokenRequest({
      grant_type: 'authorization_code', code: result.code, redirect_uri: redirectUri(), code_verifier: pending.verifier,
    }));
    return { connected: true };
  } catch {
    return { error: 'Spotify login failed. Check the Client ID and that this exact redirect URI is registered.' };
  }
}

async function refresh() {
  const tokens = store.get(KEYS.tokens);
  if (!tokens?.refresh_token) throw new SpotifyError('auth', 'not connected');
  try {
    saveTokens(await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }), tokens);
  } catch (err) {
    disconnect();
    throw err;
  }
}

async function accessToken() {
  let tokens = store.get(KEYS.tokens);
  if (!tokens) throw new SpotifyError('auth', 'not connected');
  if (Date.now() > tokens.expires_at - 60000) {
    await refresh();
    tokens = store.get(KEYS.tokens);
  }
  return tokens.access_token;
}

// ---------- Web API ----------

async function call(path, init = {}, retried = false) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...init.headers },
    });
  } catch (err) {
    if (err instanceof SpotifyError) throw err;
    throw new SpotifyError('network');
  }
  if (res.status === 401 && !retried) {
    await refresh();
    return call(path, init, true);
  }
  if (res.status === 401) throw new SpotifyError('auth');
  if (res.status === 429) throw new SpotifyError('rate');
  return res;
}

const put = (path, body) => call(path, { method: 'PUT', body: body && JSON.stringify(body) });

export async function findTrack(clue) {
  for (const q of searchQueries(clue)) {
    const res = await call(`/search?${new URLSearchParams({ q, type: 'track', limit: '5' })}`);
    if (!res.ok) throw new SpotifyError('network', `search failed (${res.status})`);
    const track = pickTrack((await res.json()).tracks?.items, clue);
    if (track) return track;
  }
  throw new SpotifyError('no-track');
}

async function failureFor(res) {
  if (res.status === 404) return new SpotifyError('no-device');
  if (res.status === 403) {
    const reason = (await res.json().catch(() => null))?.error?.reason;
    return new SpotifyError(reason === 'PREMIUM_REQUIRED' ? 'premium' : 'forbidden');
  }
  return new SpotifyError('network', `playback failed (${res.status})`);
}

// Plays `uri` in the player's Spotify app. If the app has no active device yet, wake the first one it lists.
export async function play(uri, positionMs = 0, deviceId) {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
  const res = await put(`/me/player/play${query}`, { uris: [uri], position_ms: Math.max(0, Math.round(positionMs)) });
  if (res.ok) return;
  const failure = await failureFor(res);
  if (failure.code !== 'no-device' || deviceId) throw failure;

  const devices = (await (await call('/me/player/devices')).json().catch(() => null))?.devices ?? [];
  const target = devices.find(d => d.is_active) ?? devices.find(d => !d.is_restricted);
  if (!target) throw failure;
  await put('/me/player', { device_ids: [target.id], play: false });
  return play(uri, positionMs, target.id);
}

export async function pause() {
  await put('/me/player/pause');
}
