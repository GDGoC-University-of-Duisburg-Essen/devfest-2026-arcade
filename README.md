# CySec Arcade: DevFest 2026 mini games

A hacker-style game launcher with small cyber security themed games, made for
the breaks at the GDG University of Duisburg-Essen DevFest 2026. Each laptop on a
table runs the launcher, and attendees pick a game from the list.

It's plain HTML, CSS and JavaScript. There's no build step, no server and no
internet connection needed.

## Running it

Open `index.html` in a browser (double-click it, or use `file:///path/to/index.html`).

For the event laptops, run the browser in kiosk or fullscreen mode, for example:

```sh
chromium --kiosk --incognito "file://$PWD/index.html"
# or
firefox --kiosk "file://$PWD/index.html"
```

If you'd rather use a local server:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Controls

| Where    | Input                         | Action                       |
| -------- | ----------------------------- | ---------------------------- |
| Launcher | Arrow keys / mouse            | Select a game                |
| Launcher | `Enter` / click               | Launch it                    |
| Launcher | `/` or start typing           | Filter games                 |
| Launcher | `Esc`                         | Clear the filter             |
| Game     | `◄ launcher` button (top bar) | Go back to the launcher      |

- If nobody touches the laptop, the **launcher** shows a screensaver after 60 s.
- A **game** goes back to the launcher by itself after 120 s with no input
  (you can change this per game).

## Project layout

```
index.html            launcher page
launcher/             launcher styles and logic
shared/theme.css      shared colours, fonts, glitch effect, .btn
shared/kiosk.js       common game header (logo, DevFest 2026, back button), favicon, idle timeout
games/games.js        game registry (what the launcher lists)
games/<id>/           one folder per game
assets/               GDG logo, favicon
vendor/               third-party libraries and their licenses
```

## Adding a game

1. Copy `games/pin-cracker/` to `games/<your-id>/` and build your game there.
2. Draw a cyber-style `icon.svg` for it (see AGENTS.md).
3. Add an entry to `games/games.js`.
4. Open `index.html` and check that the game shows up, starts, and can get
   back to the launcher.

[AGENTS.md](AGENTS.md) has the full conventions.

## Third-party code

Any open source library goes into `vendor/`, along with its license. The
launcher and PIN Cracker don't use any libraries at the moment.
