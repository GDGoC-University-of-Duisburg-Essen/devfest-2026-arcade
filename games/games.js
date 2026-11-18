/*
 * Game registry for the launcher.
 *
 * This is a plain JS file (not JSON) on purpose: browsers block fetch() on
 * file:// URLs, and the launcher must work by simply opening index.html.
 *
 * Fields:
 *   id          unique kebab-case id (usually the folder name)          [required]
 *   title       display name                                            [required]
 *   path        entry page, relative to the repo root                   [required]
 *   description ONE short line (~50 chars), shown under the title       [required]
 *   icon        SVG icon path relative to root (games/<id>/icon.svg)    [required]
 *               (an emoji / short text also works as a fallback)
 *   tags        short topic strings, used by the launcher filter        [optional]
 *   duration    rough play time, e.g. "2 min"                           [optional]
 *   difficulty  1 (easy) – 3 (hard)                                     [optional]
 *   hidden      true to keep a game out of the launcher                 [optional]
 *
 * Games appear in the launcher in the order listed here.
 */
window.DEVFEST_GAMES = [
  {
    id: "pin-cracker",
    title: "PIN Cracker",
    path: "games/pin-cracker/index.html",
    description: "Crack a 4-digit PIN from leaked hints.",
    icon: "games/pin-cracker/icon.svg",
    tags: ["brute force", "side channels"],
    duration: "2 min",
    difficulty: 1
  }
];
