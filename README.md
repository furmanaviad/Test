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
4. If a player also names the title, give them a ★. Spend one to skip a clue.
5. First to the chosen number of cards wins. If the deck runs out first, the longest timeline wins.

## Clue types

| Type | Source | Notes |
| --- | --- | --- |
| Quote, Plot hint | `clues.quote`, `clues.plot` | Text only. Every title has at least a plot. |
| Still frame | `clues.still.image`, otherwise the title's `wiki` poster | Starts zoomed in or blurred and slowly reveals. The Wikipedia lookup needs internet access. |
| Trailer | `clues.trailer` | YouTube clip. Bars cover the top and bottom of the video to hide on-screen titles. |
| Theme music | `clues.theme` | YouTube audio with the video fully covered. |

The setup screen lets you use one clue type every turn, a random one, or let the player choose, which is useful for comparing how each feels.

**Trailer and theme clues are not filled in yet.** Add them per title in `data/titles.json`:

```json
"trailer": { "youtubeId": "VIDEO_ID", "start": 30, "end": 60 },
"theme":   { "youtubeId": "VIDEO_ID", "start": 0 }
```

Run `node scripts/check-data.mjs --online` afterwards to confirm the IDs exist. Cards only offer the clue types they have.

## Printable cards

Open `print.html` (linked from the header) and print double-sided, flipping on the long edge. Odd pages are fronts with QR codes; even pages are backs with title and year, with each row mirrored so the sides line up. A QR code opens `index.html#card=<id>`, so the printed deck must be pointed at wherever you host the app. Scanning from the same machine that serves it works for local testing, but a phone needs a reachable URL (for example GitHub Pages).

## Layout

- `data/titles.json`: the curated deck (44 titles)
- `js/game.js`: pure game rules, covered by `tests/game.test.mjs`
- `js/clues.js`: clue renderers
- `js/app.js`, `js/card.js`: game UI and the scanned-card view
- `js/print.js`, `js/vendor/qrcode.mjs`: printable sheets, using the MIT-licensed [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
