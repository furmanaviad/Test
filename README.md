# Screen Timeline

A Hitster-style party game for movies and TV shows. You get a clue, then place the title in the right spot on your timeline by release year (first air date for TV). It runs as a static site with no build step, either fully on screen or with printed QR cards.

## Run it

```sh
npm start        # serves http://localhost:8000
npm test         # game-rule unit tests
npm run check-data                    # validate data/titles.json
node scripts/check-data.mjs --online  # also check YouTube IDs and Wikipedia posters
```

## Rules

1. Each player starts with one face-up title.
2. On your turn you get a clue. Tap a `+` gap in your timeline to place the title.
3. A correct placement keeps the card; a wrong one discards it. Matching years count as correct.
4. Know the title? Type it into the guess box *before* placing the card. A correct guess earns a ★ automatically (case, a leading "The", punctuation and small typos are ignored; short titles must be exact). Someone who said it out loud can still be given a ★ with the button on the reveal screen. Spend a ★ to skip a clue.
5. First to the chosen number of cards wins. If the deck runs out first, the longest timeline wins.

## Clue types

| Type | Source | Notes |
| --- | --- | --- |
| Quote, Plot hint | `clues.quote`, `clues.plot` | Text only. Every title has at least a plot. |
| Still frame | `clues.still.image`, otherwise the title's `wiki` poster | Starts zoomed in or blurred and slowly reveals. The Wikipedia lookup needs internet access. |
| Trailer | `clues.trailer` | YouTube clip. Bars cover the top and bottom of the video to hide on-screen titles. |
| Theme music | `clues.theme` | A 30-second Apple Music preview found with `{ "search", "artist" }` (no Apple Music app or account needed), or a YouTube clip if `youtubeId` is given. After the reveal the game names the song it played. |

The setup screen lets you use one clue type every turn, a random one, or let the player choose, which is useful for comparing how each feels.

**Theme clues** for 11 titles use Apple previews:

```json
"theme": { "search": "I'll Be There for You", "artist": "The Rembrandts" }
```

The phone looks the song up when the clue opens. The result by the named artist is preferred, so a cover doesn't win; if none matches, the first result with a preview is used, and after the reveal the game shows which song played so bad matches are easy to spot. `node scripts/check-data.mjs --online` prints the match for each title from a machine with internet access.

**Trailer clues have no videos yet.** Add them per title in `data/titles.json`:

```json
"trailer": { "youtubeId": "VIDEO_ID", "start": 30, "end": 60 },
"theme":   { "youtubeId": "VIDEO_ID", "start": 0 }   // alternative to "search"
```

Run `node scripts/check-data.mjs --online` afterwards: it fails on IDs that are removed or have embedding disabled (YouTube's oEmbed answers 401/404 for those). Cards only offer the clue types they have.

On iPhone, Safari only plays media after a tap, so video clues show a **Tap to play** button and never autoplay. If a video can't be played (removed, embedding disabled, or YouTube unreachable), the game shows a notice and switches to another clue the card has, preferring quote, then plot, then still.

## Play on iPhone

The site is deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `claude/screen-timeline-poc`: https://furmanaviad.github.io/Test/

If the first deploy fails at "configure-pages", open the repo's Settings → Pages and set **Source** to **GitHub Actions**, then re-run the workflow.

To install it like an app: open the URL in Safari, tap Share, then **Add to Home Screen**. Things worth checking on the phone:

- Tap to play starts trailer and theme audio; the ringer switch may mute it.
- The trailer's top and bottom bars hide on-screen titles; note any trailer that still gives the title away.
- A scanned QR card opens its clue.
- Layout fits at your phone's width with no sideways scrolling.

## Printable cards

Open `print.html` (linked from the header) and print double-sided, flipping on the long edge. Odd pages are fronts with QR codes; even pages are backs with title and year, with each row mirrored so the sides line up. A QR code opens `index.html#card=<id>`, so the printed deck must be pointed at wherever you host the app. Scanning from the same machine that serves it works for local testing, but a phone needs a reachable URL (for example GitHub Pages).

## Layout

- `data/titles.json`: the curated deck (44 titles)
- `js/game.js`: pure game rules, covered by `tests/game.test.mjs`
- `js/clues.js`: clue renderers
- `js/app.js`, `js/card.js`: game UI and the scanned-card view
- `js/print.js`, `js/vendor/qrcode.mjs`: printable sheets, using the MIT-licensed [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
