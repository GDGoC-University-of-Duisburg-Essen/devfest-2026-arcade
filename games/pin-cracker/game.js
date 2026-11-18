(() => {
  "use strict";

  const LENGTH = 4;
  const ATTEMPTS = 8;
  const RANK = { miss: 0, near: 1, hit: 2 };

  const $ = (sel) => document.querySelector(sel);
  const board = $("#board"), keypad = $("#keypad"), msg = $("#msg");
  const result = $("#result");

  let secret, row, guess, over;

  /* ---------------- setup ---------------- */
  function newGame() {
    secret = Array.from({ length: LENGTH }, () => String((Math.random() * 10) | 0));
    row = 0; guess = ""; over = false;

    board.innerHTML = Array.from({ length: ATTEMPTS }, (_, r) =>
      `<div class="row" data-r="${r}"><span class="n">${r + 1}</span>` +
      `${'<span class="cell"></span>'.repeat(LENGTH)}</div>`).join("");

    keypad.innerHTML =
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<button class="key" data-k="${d}">${d}</button>`).join("") +
      `<button class="key wide" data-k="Backspace">DEL</button>` +
      `<button class="key wide enter" data-k="Enter">ENTER</button>`;

    result.hidden = true;
    setMsg("> type digits, press Enter to submit_");
    paint();
  }

  /* ---------------- logic ---------------- */
  /** Wordle-style scoring that handles repeated digits correctly. */
  function score(g) {
    const out = Array(LENGTH).fill("miss");
    const left = {};
    for (let i = 0; i < LENGTH; i++) {
      if (g[i] === secret[i]) out[i] = "hit";
      else left[secret[i]] = (left[secret[i]] || 0) + 1;
    }
    for (let i = 0; i < LENGTH; i++) {
      if (out[i] !== "hit" && left[g[i]] > 0) { out[i] = "near"; left[g[i]]--; }
    }
    return out;
  }

  function submit() {
    if (guess.length < LENGTH) {
      setMsg(`> need ${LENGTH} digits`, true);
      shake();
      return;
    }
    const res = score(guess);
    const cells = board.children[row].querySelectorAll(".cell");
    res.forEach((cls, i) => {
      cells[i].classList.add(cls, "reveal");
      cells[i].style.animationDelay = `${i * 80}ms`;
      const key = keypad.querySelector(`[data-k="${guess[i]}"]`);
      const prev = ["hit", "near", "miss"].find((c) => key.classList.contains(c));
      if (!prev || RANK[cls] > RANK[prev]) { key.classList.remove("hit", "near", "miss"); key.classList.add(cls); }
    });

    const won = res.every((c) => c === "hit");
    row++;
    guess = "";
    if (won || row === ATTEMPTS) {
      over = true;
      setTimeout(() => finish(won), 550);
    } else {
      setMsg(`> ${ATTEMPTS - row} attempt${ATTEMPTS - row === 1 ? "" : "s"} left`);
    }
    paint();
  }

  function finish(won) {
    const title = $("#result-title");
    title.textContent = won ? "ACCESS GRANTED" : "LOCKED OUT";
    title.className = won ? "win" : "lose";
    $("#result-text").textContent = won
      ? `PIN ${secret.join("")} cracked in ${row} attempt${row === 1 ? "" : "s"}.`
      : `The PIN was ${secret.join("")}.`;
    $("#lesson").textContent =
      "Lesson: a 4-digit PIN has only 10,000 combinations — but leaking even partial feedback " +
      "lets an attacker find it in a handful of tries. Real systems reveal nothing about wrong " +
      "guesses and lock out after a few failures.";
    result.hidden = false;
    $("#again").focus();
  }

  /* ---------------- view ---------------- */
  function paint() {
    [...board.children].forEach((r, i) => r.classList.toggle("current", i === row && !over));
    if (row >= ATTEMPTS || over) return;
    const cells = board.children[row].querySelectorAll(".cell");
    cells.forEach((c, i) => {
      c.textContent = guess[i] ?? "";
      c.classList.toggle("filled", i < guess.length);
    });
  }

  function setMsg(text, err = false) {
    msg.textContent = text;
    msg.classList.toggle("err", err);
  }

  function shake() {
    const r = board.children[row];
    r.classList.remove("shake");
    void r.offsetWidth; // restart animation
    r.classList.add("shake");
  }

  /* ---------------- input ---------------- */
  function press(k) {
    if (!result.hidden) {
      if (k === "Enter") newGame();
      if (k === "Escape") window.Kiosk?.exit();
      return;
    }
    if (over) return;
    if (/^[0-9]$/.test(k) && guess.length < LENGTH) guess += k;
    else if (k === "Backspace") guess = guess.slice(0, -1);
    else if (k === "Enter") return submit();
    else return;
    setMsg("> type digits, press Enter to submit_");
    paint();
  }

  addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key) || ["Backspace", "Enter", "Escape"].includes(e.key)) {
      e.preventDefault();
      press(e.key);
    }
  });
  keypad.addEventListener("click", (e) => {
    const k = e.target.closest(".key")?.dataset.k;
    if (k) press(k);
  });
  $("#again").addEventListener("click", newGame);
  $("#exit").addEventListener("click", () => window.Kiosk?.exit());

  newGame();
})();
