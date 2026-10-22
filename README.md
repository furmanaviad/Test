# Screen Timeline

A party game for movies and TV shows, in the spirit of Hitster and Timeline. You get a clue, then place the title in the right spot on your timeline by release year (first air date for TV). It runs as a static site with no build step, either fully on screen or with printed QR cards.

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
| Theme music | `clues.theme` | A song played in the player's own Spotify app (Premium), found with `{ "search", "artist" }`; or a YouTube clip if `youtubeId` is given. After the reveal the game names the song and links to it on Spotify. |

The setup screen lets you use one clue type every turn, a random one, or let the player choose, which is useful for comparing how each feels.

**Theme clues** for 11 titles are Spotify searches:

```json
"theme": { "search": "I'll Be There for You", "artist": "The Rembrandts", "start": 0, "seconds": 30 }
```

`artist` is required so a cover version doesn't win; `start` and `seconds` (optional, default 0 and 30) pick the snippet. The phone finds the track when the clue opens and a tap starts it in the Spotify app. After the reveal the game shows which song played, so wrong matches are easy to spot. Theme clues are only offered once Spotify is connected.

**Trailer clues have no videos yet.** Add them per title in `data/titles.json`:

```json
"trailer": { "youtubeId": "VIDEO_ID", "start": 30, "end": 60 },
"theme":   { "youtubeId": "VIDEO_ID", "start": 0 }   // or a Spotify "search" as above
```

Run `node scripts/check-data.mjs --online` afterwards: it fails on IDs that are removed or have embedding disabled (YouTube's oEmbed answers 401/404 for those). Cards only offer the clue types they have.

On iPhone, Safari only plays media after a tap, so video clues show a **Tap to play** button and never autoplay. If a video can't be played (removed, embedding disabled, or YouTube unreachable), the game shows a notice and switches to another clue the card has, preferring quote, then plot, then still.

## Spotify theme songs (the Hitster way)

Like Hitster, the game doesn't host any music: it remote-controls the **Spotify app** on the player's phone through Spotify's Web API.

You need: **Spotify Premium** (the playback API refuses free accounts), the Spotify app installed and recently used on the phone, and a free Spotify developer app (one-time):

1. Go to https://developer.spotify.com/dashboard, sign in, and create an app. Choose **Web API**.
2. Add this **Redirect URI** exactly: `https://furmanaviad.github.io/Test/` (the setup screen shows the exact value for wherever you host it).
3. Under **User management**, add the email of every Spotify account that will play. A new app starts in Development Mode, which only allows the users you list, and Spotify has been tightening its limits (reportedly a handful of users, and the developer needs Premium too). This is fine for a family game and not for a public launch.
4. Copy the app's **Client ID**. It is public and needs no secret.
5. In the game's setup screen, open **Theme songs with Spotify**, paste the Client ID, tap **Connect Spotify**, and approve. Do this in a normal Safari tab.

During play: open Spotify once on the phone and start any song so it shows up as a device, then tap **Tap to play** on a theme clue. If it says to open Spotify, do that and tap again. Don't look at the Spotify app during a turn, because it shows the song title.

## Play on iPhone

The site is deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `claude/screen-timeline-poc`: https://furmanaviad.github.io/Test/

If the first deploy fails at "configure-pages", open the repo's Settings → Pages and set **Source** to **GitHub Actions**, then re-run the workflow.

To install it like an app: open the URL in Safari, tap Share, then **Add to Home Screen**. Things worth checking on the phone:

- Tap to play starts the trailer; a theme clue starts the song in the Spotify app.
- Connecting Spotify from the Home Screen app may not work (login happens in a separate browser context); use a Safari tab.
- The trailer's top and bottom bars hide on-screen titles; note any trailer that still gives the title away.
- A scanned QR card opens its clue.
- Layout fits at your phone's width with no sideways scrolling.

## Printable cards

Open `print.html` (linked from the header) and print double-sided, flipping on the long edge. Odd pages are fronts with QR codes; even pages are backs with title and year, with each row mirrored so the sides line up. A QR code opens `index.html#card=<id>`, so the printed deck must be pointed at wherever you host the app. Scanning from the same machine that serves it works for local testing, but a phone needs a reachable URL (for example GitHub Pages).

## Third-party content and licences

- Movie and TV titles, years and facts are facts. Plot hints are written for this game. Quotes are short, well-known lines.
- Music is never stored or served here: songs play in the player's own Spotify app. Spotify's developer policy asks for attribution and a link back, which the reveal screen provides ("Listen on Spotify"). It also restricts commercial use, so ask Spotify before charging for anything.
- Posters for the still-frame clue are loaded from Wikipedia. They are copyrighted, and Wikipedia's fair-use claim covers Wikipedia's own use. That is fine for private testing and not for a public release; swap in licensed images first.
- Trailers play through YouTube's own embedded player. Don't hide or alter the player in a public release; YouTube's developer policies restrict overlays and audio-only playback.
- This is an independent game, not affiliated with any studio, network, Spotify or Hitster. It is not a copy of Hitster's design; the "place it on the timeline by date" idea predates it (Frédéric Henry's *Timeline*).
- `js/vendor/qrcode.mjs` is [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT). "QR Code" is a registered trademark of Denso Wave.

This is a summary for developers, not legal advice.

## Layout

- `data/titles.json`: the curated deck (44 titles)
- `js/game.js`: pure game rules, covered by `tests/game.test.mjs`
- `js/clues.js`: clue renderers
- `js/app.js`, `js/card.js`: game UI and the scanned-card view
- `js/print.js`, `js/vendor/qrcode.mjs`: printable sheets, using the MIT-licensed [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
