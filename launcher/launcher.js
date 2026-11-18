(() => {
  "use strict";

  const IDLE_MS = 60_000;       // show screensaver after 1 min without input
  const BOOT_KEY = "devfest.booted";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (sel) => document.querySelector(sel);
  const games = (window.DEVFEST_GAMES || []).filter((g) => !g.hidden);

  const els = {
    boot: $("#boot"), bootLog: $("#boot-log"), app: $("#app"),
    grid: $("#grid"), filter: $("#filter"), count: $("#count"), empty: $("#empty"),
    clock: $("#clock"), launch: $("#launch"), launchTitle: $("#launch-title"),
    idle: $("#idle"),
  };

  let visible = [];      // games currently shown (after filtering)
  let selected = 0;      // index into `visible`
  let launching = false;

  /* ---------------- storage (may be unavailable) ---------------- */
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  /* ---------------- matrix rain ---------------- */
  function startRain() {
    const canvas = $("#rain");
    const ctx = canvas.getContext("2d");
    const glyphs = "01ABCDEF0123456789<>{}[]$#%&*+=/\\|;:ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ";
    const size = 16;
    let cols = [], w = 0, h = 0;

    function resize() {
      w = canvas.width = innerWidth;
      h = canvas.height = innerHeight;
      cols = Array.from({ length: Math.ceil(w / size) }, () => Math.random() * -h / size);
    }
    function frame() {
      ctx.fillStyle = "rgba(4, 7, 10, 0.12)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${size}px monospace`;
      for (let i = 0; i < cols.length; i++) {
        const y = cols[i] * size;
        ctx.fillStyle = Math.random() < 0.03 ? "#c9f7d8" : "#39ff88";
        ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * size, y);
        cols[i] = y > h && Math.random() > 0.975 ? 0 : cols[i] + 1;
      }
    }
    resize();
    addEventListener("resize", resize);
    if (reducedMotion) { for (let i = 0; i < 80; i++) frame(); return; }
    setInterval(frame, 55);
  }

  /* ---------------- boot sequence ---------------- */
  function boot() {
    if (session.get(BOOT_KEY) || reducedMotion) return Promise.resolve(finishBoot());

    const lines = [
      ["dim", "DEVFEST 2026 BIOS v26.11 — Cyber Security Edition"],
      ["", ""],
      ["", "[ <span class=ok>OK</span> ] Mounting /dev/coffee"],
      ["", "[ <span class=ok>OK</span> ] Loading kernel modules: curiosity, caution"],
      ["", "[ <span class=ok>OK</span> ] Establishing encrypted tunnel"],
      ["", "[<span class=warn>WARN</span>] Password 'hunter2' detected — rotating"],
      ["", `[ <span class=ok>OK</span> ] Indexing payloads: ${games.length} game(s) found`],
      ["", "[ <span class=ok>OK</span> ] Starting arcade.service"],
      ["", ""],
      ["dim", "Welcome, guest. Press any key to skip."],
    ];

    return new Promise((resolve) => {
      let i = 0, timer;
      const skip = () => { clearTimeout(timer); done(); };
      const done = () => {
        removeEventListener("keydown", skip);
        removeEventListener("pointerdown", skip);
        finishBoot();
        resolve();
      };
      const step = () => {
        if (i >= lines.length) { timer = setTimeout(done, 450); return; }
        const [cls, html] = lines[i++];
        els.bootLog.insertAdjacentHTML("beforeend", `<span class="${cls}">${html}</span>\n`);
        timer = setTimeout(step, 90 + Math.random() * 140);
      };
      addEventListener("keydown", skip, { once: true });
      addEventListener("pointerdown", skip, { once: true });
      step();
    });
  }

  function finishBoot() {
    session.set(BOOT_KEY, "1");
    els.boot.hidden = true;
    els.app.hidden = false;
  }

  /* ---------------- rendering ---------------- */
  const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function iconHtml(icon) {
    if (!icon) return "&gt;_";
    return /\.(png|jpe?g|gif|svg|webp)$/i.test(icon)
      ? `<img src="${escapeHtml(icon)}" alt="">`
      : escapeHtml(icon);
  }

  function cardHtml(g, i) {
    const diff = g.difficulty
      ? `<span class="tag diff" title="difficulty">${"■".repeat(g.difficulty)}${"□".repeat(3 - g.difficulty)}</span>`
      : "";
    const time = g.duration ? `<span class="tag time">⏱ ${escapeHtml(g.duration)}</span>` : "";
    return `
      <li class="card" role="option" tabindex="-1" data-i="${i}" aria-selected="false">
        <span class="idx">${String(i + 1).padStart(2, "0")}</span>
        <div class="icon">${iconHtml(g.icon)}</div>
        <h2>${escapeHtml(g.title)}</h2>
        <p>${escapeHtml(g.description)}</p>
        <div class="meta">${diff}${time}</div>
      </li>`;
  }

  function render() {
    const q = els.filter.value.trim().toLowerCase();
    visible = games.filter((g) =>
      !q || [g.title, g.description, g.id, ...(g.tags || [])].join(" ").toLowerCase().includes(q));

    els.grid.innerHTML = visible.map(cardHtml).join("");
    els.empty.hidden = visible.length > 0;
    els.count.textContent = `total ${visible.length}` +
      (visible.length !== games.length ? ` of ${games.length}` : "") +
      ` game${visible.length === 1 ? "" : "s"}`;
    select(Math.min(selected, Math.max(visible.length - 1, 0)));
  }

  function select(i) {
    const cards = els.grid.children;
    if (!cards.length) return;
    selected = (i + cards.length) % cards.length;
    for (const c of cards) {
      const on = Number(c.dataset.i) === selected;
      c.classList.toggle("selected", on);
      c.setAttribute("aria-selected", String(on));
    }
    cards[selected].scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }

  /** Number of cards per row, read from the actual layout. */
  function columns() {
    const cards = [...els.grid.children];
    if (cards.length < 2) return 1;
    const top = cards[0].offsetTop;
    const n = cards.findIndex((c) => c.offsetTop !== top);
    return n === -1 ? cards.length : n;
  }

  function launch(i) {
    const g = visible[i];
    if (!g || launching) return;
    launching = true;
    els.launchTitle.textContent = `> exec ./${g.id}  —  ${g.title}`;
    els.launch.hidden = false;
    setTimeout(() => { location.href = g.path; }, reducedMotion ? 0 : 750);
  }

  /* ---------------- input ---------------- */
  function onKey(e) {
    if (!els.idle.hidden || launching || els.app.hidden) return;
    const typing = document.activeElement === els.filter;
    const cols = columns();

    switch (e.key) {
      case "ArrowRight": select(selected + 1); break;
      case "ArrowLeft":  select(selected - 1); break;
      case "ArrowDown":  select(Math.min(selected + cols, visible.length - 1)); break;
      case "ArrowUp":    select(Math.max(selected - cols, 0)); break;
      case "Enter":      launch(selected); break;
      case "Escape":
        els.filter.value = ""; els.filter.blur(); render(); break;
      case "/":
        if (typing) return;
        els.filter.focus(); break;
      default:
        // Start typing anywhere to filter.
        if (!typing && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          els.filter.focus();
        }
        return;
    }
    // Let the cursor keys move inside the filter text field.
    if (typing && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
    e.preventDefault();
  }

  function bindInput() {
    addEventListener("keydown", onKey);
    els.filter.addEventListener("input", () => { selected = 0; render(); });
    els.grid.addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      if (card) launch(Number(card.dataset.i));
    });
    els.grid.addEventListener("pointermove", (e) => {
      const card = e.target.closest(".card");
      if (card && Number(card.dataset.i) !== selected) select(Number(card.dataset.i));
    });
  }

  /* ---------------- idle screensaver ---------------- */
  function bindIdle() {
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        els.filter.value = "";
        selected = 0;
        render();
        els.filter.blur();
        els.idle.hidden = false;
      }, IDLE_MS);
    };
    const wake = (e) => {
      if (!els.idle.hidden) {
        els.idle.hidden = true;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      arm();
    };
    for (const ev of ["keydown", "pointerdown", "pointermove", "wheel", "touchstart"]) {
      addEventListener(ev, wake, { capture: true, passive: ev !== "keydown" && ev !== "pointerdown" });
    }
    arm();
  }

  /* ---------------- clock ---------------- */
  function startClock() {
    const tick = () => { els.clock.textContent = new Date().toLocaleTimeString([], { hour12: false }); };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------------- go ---------------- */
  // Returning via the browser back button restores the page from bfcache.
  addEventListener("pageshow", (e) => {
    if (e.persisted) { launching = false; els.launch.hidden = true; }
  });

  startRain();
  render();
  bindInput();
  startClock();
  boot().then(bindIdle);
})();
