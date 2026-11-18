# AGENTS.md

These are the rules for coding agents (and humans) working in this repo.

## What this is

This repo is an offline game launcher with small cyber security mini games for
the GDG DevFest 2026. Attendees play on shared laptops during the short breaks
between talks, so every game should be learnable in about 10 seconds and
playable in 1 to 5 minutes.

## Hard constraints

- **Plain HTML, CSS and JavaScript only.** No build step, bundler, framework
  CLI, TypeScript or npm install.
- **Everything works from `file://`.** Opening `index.html` by double-click
  has to work. That means:
  - no `fetch()`/XHR for local files (browsers block it on `file://`); put
    data in `.js` files that assign to a global, like `games/games.js` does
  - no ES module `import` across files (also blocked on `file://`); use
    classic `<script>` tags and wrap each file in an IIFE
  - all paths are relative
- **Fully offline.** No CDNs, Google Fonts, analytics or remote APIs. Use the
  system monospace font stack from `shared/theme.css`.
- **Third-party code goes in `vendor/<lib>-<version>/`** together with its
  `LICENSE` file, and gets a line in `vendor/README.md`. Only use
  permissively licensed libraries (MIT, BSD, Apache-2.0, ISC, OFL for fonts).
- **Nothing harmful.** Games teach security concepts with simulations. They
  must not do real scanning, exploitation or network activity, and must not
  collect personal data.

## Adding a game

1. Copy `games/pin-cracker/` to `games/<id>/` as a starting point. Use
   kebab-case for `<id>`.
2. The entry page is `games/<id>/index.html`. It must include:
   ```html
   <link rel="stylesheet" href="../../shared/theme.css">
   <script src="../../shared/kiosk.js" data-idle="120"></script>
   ```
   `kiosk.js` adds the common header bar (◄ launcher button, GDG logo,
   "DevFest 2026"), the shared favicon, and the idle timeout that brings
   the laptop back to the launcher. The header is fixed and 48px tall: the
   body gets `padding-top: var(--kiosk-bar-h)`, so full-height layouts
   should use `calc(100vh - var(--kiosk-bar-h))`. To leave from game code,
   call `Kiosk.exit()`. During long non-interactive phases, call
   `Kiosk.ping()` to reset the idle timer. Only use `data-header="false"`
   for true full-screen games, and then show the logo and "DevFest 2026"
   yourself.
3. Create `games/<id>/icon.svg` (see "Game icons" below).
4. Register the game in `games/games.js`. The field docs are at the top of
   that file. Keep `description` to one short line (about 50 characters),
   because the launcher card only shows the icon, the title and that line.
   Array order is the order the launcher shows.
5. Keep each game inside its own folder. Don't edit `shared/` or `launcher/`
   to make one game work. If something really is shared by several games,
   add it to `shared/` and keep it backwards compatible.

## Game icons

Every game has a hand-written `icon.svg`. `games/pin-cracker/icon.svg` is
the reference. Follow it:

- `viewBox="0 0 128 128"`, a dark rounded tile (`rx="22"`, gradient
  `#0e1f27` → `#04070a`), a faint cyan grid pattern, and a thin green
  border.
- One simple neon symbol for the game in the middle, drawn with the theme
  colours (`#39ff88`, `#3ef0ff`, `#ffc94a`, `#ff3b5c`) and a soft
  `feGaussianBlur` glow. HUD corner brackets are optional.
- Inline SVG only: no external images or fonts, and hardly any text,
  because it is shown at 96px.

The shared favicon is `assets/favicon.svg`.

## Game design guidelines

- **Keyboard and mouse both work.** The launcher can be used with just a
  keyboard, and games should be too, where it makes sense.
- **Always offer a restart.** The end screen offers "Play again" (`Enter`)
  and "Launcher" (`Esc`).
- **End with a one-line lesson** about the real security concept behind the
  game, like PIN Cracker does.
- **No persistent state.** Laptops are shared, so a reload must give a fresh
  game. `sessionStorage`/`localStorage` is fine for things like a high score
  table, but wrap every access in `try/catch`.
- **Assume a 1366×768 laptop screen** or larger, but don't break on smaller
  windows.
- **Look and feel:** a dark terminal look that uses the tokens in
  `shared/theme.css` (`--green`, `--cyan`, `--red`, `--amber`, the GDG
  colours `--g-*`, `.glitch`, `.btn`, `.scanlines`). Respect
  `prefers-reduced-motion`.
- **Keep it in English.**

## Code style

- 2-space indentation, double quotes, semicolons, `"use strict"` inside an IIFE.
- Use `const`/`let`, never `var`. Modern browser APIs are fine (target current
  Chrome and Firefox).
- Escape any text you inject with `innerHTML`, or use `textContent`.
- Keep files small and readable. Comments explain *why*, not *what*.

## Checking your work

There is no test suite. Before finishing:

1. Open `index.html`. Check that the game appears, keyboard selection and
   `Enter` launch it, and the filter finds it.
2. Play a full round, both winning and losing if possible.
3. Check that the "◄ launcher" button returns to the launcher.
4. Check that the browser console shows no errors, both over `file://` and
   over `python3 -m http.server`.
