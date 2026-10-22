// Validates data/titles.json. Pass --online to also check YouTube IDs and Wikipedia pages.
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const titles = JSON.parse(await readFile(new URL('data/titles.json', root), 'utf8'));
const online = process.argv.includes('--online');
const errors = [];
const seen = new Set();

for (const t of titles) {
  const at = `[${t.id ?? t.title ?? '?'}]`;
  if (!t.id || seen.has(t.id)) errors.push(`${at} missing or duplicate id`);
  seen.add(t.id);
  if (!t.title) errors.push(`${at} missing title`);
  if (!['movie', 'tv'].includes(t.type)) errors.push(`${at} type must be movie or tv`);
  if (!Number.isInteger(t.year) || t.year < 1880 || t.year > 2100) errors.push(`${at} bad year`);
  if (t.aliases && !(Array.isArray(t.aliases) && t.aliases.every(a => typeof a === 'string'))) errors.push(`${at} aliases must be an array of strings`);
  const c = t.clues ?? {};
  if (!c.quote && !c.plot && !c.trailer && !c.theme && !c.still && !t.wiki) errors.push(`${at} has no clues`);
  if (c.theme && !c.theme.youtubeId && !c.theme.search) errors.push(`${at} theme needs a Spotify search or a youtubeId`);
  if (c.theme?.search && !c.theme.artist) errors.push(`${at} theme search needs an artist so a cover doesn't win`);
  for (const k of ['trailer', 'theme']) {
    if (c[k] && !c[k].search && !c[k].youtubeId) errors.push(`${at} ${k} needs youtubeId`);
    if (c[k]?.end && c[k].end <= (c[k].start ?? 0)) errors.push(`${at} ${k} end must be after start`);
  }
  if (c.still?.image) await access(new URL(c.still.image, root)).catch(() => errors.push(`${at} missing image ${c.still.image}`));

  if (online) {
    for (const k of ['trailer', 'theme']) {
      if (!c[k]?.youtubeId) continue;
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${c[k].youtubeId}`);
      if (!r.ok) errors.push(`${at} ${k} YouTube id ${c[k].youtubeId} not found (${r.status})`);
    }
    if (t.wiki) {
      const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.wiki)}`);
      const j = r.ok ? await r.json() : null;
      if (!j?.originalimage && !j?.thumbnail) errors.push(`${at} wiki page ${t.wiki} has no image (${r.status})`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`${titles.length} titles OK${online ? ' (online checks included)' : ''}`);
