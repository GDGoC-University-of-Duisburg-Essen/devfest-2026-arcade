/*
 * Kiosk helper for games. Include it in every game page:
 *
 *   <script src="../../shared/kiosk.js" data-idle="120"></script>
 *
 * It adds:
 *   - a common header bar: "◄ launcher" button, GDG logo, "DevFest 2026"
 *     (fixed at the top; the body gets padding-top = var(--kiosk-bar-h))
 *   - the shared favicon, if the page doesn't declare one
 *   - an idle timeout that returns to the launcher when nobody touched the
 *     laptop for `data-idle` seconds (default 120; "0" disables it)
 *   - window.Kiosk.exit()  — go back to the launcher from game code
 *   - window.Kiosk.ping()  — reset the idle timer (e.g. during a cut-scene)
 *
 * Optional attributes on the script tag:
 *   data-idle="120"        seconds of inactivity before returning
 *   data-header="false"    no header bar (full-screen games); then show the
 *                          event branding yourself and call Kiosk.exit()
 */
(() => {
  "use strict";
  const script = document.currentScript;
  const root = new URL("../", script.src);
  const launcherUrl = new URL("index.html", root).href;
  const logoUrl = new URL("assets/gdg_logo.png", root).href;
  const faviconUrl = new URL("assets/favicon.svg", root).href;
  const idleSeconds = Number(script.dataset.idle ?? 120);
  const showHeader = script.dataset.header !== "false";

  const exit = () => { location.href = launcherUrl; };

  let timer;
  const ping = () => {
    if (!(idleSeconds > 0)) return;
    clearTimeout(timer);
    timer = setTimeout(exit, idleSeconds * 1000);
  };

  for (const ev of ["keydown", "pointerdown", "pointermove", "wheel", "touchstart"]) {
    addEventListener(ev, ping, { capture: true, passive: true });
  }
  ping();

  const CSS = `
    :root { --kiosk-bar-h: ${showHeader ? 48 : 0}px; }
    body { padding-top: var(--kiosk-bar-h); }
    .kiosk-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      height: var(--kiosk-bar-h);
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 0 12px;
      background: rgba(4, 7, 10, 0.9);
      border-bottom: 1px solid #16323a;
      backdrop-filter: blur(4px);
      font: 13px/1.4 "JetBrains Mono", "Fira Code", "DejaVu Sans Mono", ui-monospace, monospace;
    }
    .kiosk-back {
      padding: 4px 10px;
      color: #39ff88; text-decoration: none; letter-spacing: 0.05em;
      border: 1px solid #16323a; border-radius: 4px;
      transition: border-color .15s, background .15s;
    }
    .kiosk-back:hover, .kiosk-back:focus-visible { border-color: #39ff88; background: rgba(57,255,136,.08); outline: none; }
    .kiosk-brand { display: flex; align-items: center; gap: 12px; color: #5f8a78; }
    .kiosk-brand img { height: 34px; width: auto; }
    .kiosk-brand b { color: #39ff88; font-weight: normal; letter-spacing: 0.12em;
                     text-shadow: 0 0 6px rgba(57,255,136,.5); }
    @media (max-width: 560px) { .kiosk-brand img { display: none; } }`;

  function mount() {
    if (!document.querySelector('link[rel~="icon"]')) {
      const icon = document.createElement("link");
      icon.rel = "icon";
      icon.type = "image/svg+xml";
      icon.href = faviconUrl;
      document.head.append(icon);
    }
    if (!showHeader) return;

    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.append(style);

    const bar = document.createElement("header");
    bar.className = "kiosk-bar";
    bar.innerHTML = `
      <a class="kiosk-back" href="${launcherUrl}" title="Back to the game launcher">◄ launcher</a>
      <div class="kiosk-brand">
        <img src="${logoUrl}" alt="Google Developer Groups – University of Duisburg-Essen">
        <b>DevFest 2026</b>
      </div>`;
    document.body.prepend(bar);
  }
  document.body ? mount() : addEventListener("DOMContentLoaded", mount);

  window.Kiosk = { exit, ping, launcherUrl };
})();
