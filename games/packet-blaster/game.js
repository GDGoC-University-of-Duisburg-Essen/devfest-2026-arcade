(() => {
  "use strict";

  /* =====================================================================
   * Tuning: tweak difficulty here
   * ===================================================================== */
  const W = 960, H = 600;             // logical canvas size (scaled to fit)
  const GAME_SECONDS = 90;
  const LIVES = 3;                    // "server uptime" bars
  const PLAYER_Y = 492;
  const GROUND_Y = 530;               // packets past this line reach the cluster
  const MUZZLE_Y = PLAYER_Y - 30;     // shots start here
  const PLAYER_SPEED = 560;           // px/s
  const LEGIT_PENALTY = 100;          // for shooting a real user
  const SLA_BONUS = 250;              // per uptime bar left when the timer ends
  const SWARM_SIZE = [6, 9];          // bots per DDoS swarm
  const PAIR_GAP = 150;               // distance of a payload hiding behind a legit packet
  const LEADERBOARD_SIZE = 10;
  const STORAGE_KEY = "devfest2026.packet-blaster.scores";

  const PHASES = [
    { until: 30, name: "WARM-UP", color: "#3ef0ff",
      spawnEvery: 1.45, speed: [70, 95], mix: { legit: 0.42, injection: 0.58 },
      pairChance: 0, swarmEvery: 0, mult: 1, tempo: 112,
      banner: ["WARM-UP", "Shoot cyan payloads with [1] · let green users pass"] },
    { until: 60, name: "ESCALATION", color: "#ffc94a",
      spawnEvery: 1.1, speed: [90, 125], mix: { legit: 0.36, injection: 0.3, iam: 0.34 },
      pairChance: 0.3, swarmEvery: 0, mult: 1, tempo: 128,
      banner: ["ESCALATION", "Yellow IAM exploits! Switch to [2] ZERO-TRUST"] },
    { until: 90, name: "ZERO-DAY RUSH", color: "#ff3b5c",
      spawnEvery: 1.05, speed: [105, 145], mix: { legit: 0.3, injection: 0.38, iam: 0.32 },
      pairChance: 0.12, swarmEvery: 5, mult: 2, tempo: 152,
      banner: ["ZERO-DAY RUSH ×2", "DDoS swarms! Use [3] RATE-LIMITER"] },
  ];

  const TOOLS = [
    { name: "SANITIZER",  color: "#3ef0ff", cooldown: 0.11 },  // rapid single laser
    { name: "ZERO-TRUST", color: "#ffc94a", cooldown: 0.30 },  // piercing beam
    { name: "RATE-LIMIT", color: "#ff3b5c", cooldown: 0.36 },  // shotgun
  ];
  const TOOL_FOR = { injection: 0, iam: 1, bot: 2 };

  // [label, text shown when blocked]
  const TYPES = {
    legit: { color: "#39ff88", points: 50, labels: [
      ["GET /home"], ["200 OK"], ["GET /api/me"], ["POST /login"], ["GET /cart"], ["GET /logo.png"]] },
    injection: { color: "#3ef0ff", points: 100, labels: [
      ["' OR 1=1 --", "SQLi Blocked!"], ["<script>", "XSS Blocked!"], ["'; DROP TABLE", "SQLi Blocked!"],
      ["${jndi:ldap}", "Log4Shell Blocked!"], ["; rm -rf /", "Cmd Injection Blocked!"],
      ["<img onerror>", "XSS Blocked!"]] },
    iam: { color: "#ffc94a", points: 150, labels: [
      ["*:* Admin", "Least Privilege!"], ["Leaked JWT", "Token Revoked!"], ["root:root", "Default Creds Denied!"],
      ["AKIA**** key", "Key Rotated!"], ["sudo su -", "Escalation Denied!"]] },
    bot: { color: "#ff3b5c", points: 25 },
  };

  const FONT = '"JetBrains Mono", "Fira Code", "DejaVu Sans Mono", ui-monospace, monospace';
  const LABEL_FONT = `bold 13px ${FONT}`;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =====================================================================
   * Helpers
   * ===================================================================== */
  const $ = (s) => document.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pickArr = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function pickWeighted(mix) {
    let r = Math.random() * Object.values(mix).reduce((a, b) => a + b, 0);
    for (const [k, w] of Object.entries(mix)) if ((r -= w) <= 0) return k;
    return Object.keys(mix)[0];
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  /* =====================================================================
   * Sound: tiny Web Audio synth (no audio files)
   * ===================================================================== */
  const Sound = (() => {
    let ac = null, master = null, music = null, noiseBuf = null;
    let muted = false, timer = null, next = 0, step = 0, tempo = 112;
    // A-minor bassline, 8th notes
    const BASS = [55, 55, 65.41, 55, 73.42, 55, 82.41, 98, 55, 55, 65.41, 55, 82.41, 73.42, 65.41, 49];

    function init() {
      if (!ac) {
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
        master = ac.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(ac.destination);
        music = ac.createGain();
        music.gain.value = 0.55;
        music.connect(master);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === "suspended") ac.resume();
    }

    function tone(freq, dur, { type = "square", vol = 0.1, slide = 0, at = 0, out = master } = {}) {
      if (!ac) return;
      const t = at || ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.02);
    }

    function noise(dur, { vol = 0.2, freq = 2000, filter = "lowpass", at = 0, out = master } = {}) {
      if (!ac) return;
      const t = at || ac.currentTime;
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf;
      f.type = filter;
      f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(out);
      s.start(t);
      s.stop(t + dur);
    }

    function tick() {
      const len = 60 / tempo / 2;
      while (next < ac.currentTime + 0.12) {
        const s = step % 16, f = BASS[s];
        tone(f * 2, len * 0.9, { type: "sawtooth", vol: 0.05, at: next, out: music });
        tone(f, len * 0.9, { type: "square", vol: 0.04, at: next, out: music });
        if (s % 4 === 0) tone(140, 0.12, { type: "sine", vol: 0.35, slide: 40, at: next, out: music });
        if (s % 2 === 1) noise(0.04, { vol: 0.05, freq: 8000, filter: "highpass", at: next, out: music });
        next += len;
        step++;
      }
    }

    return {
      init,
      startMusic() {
        if (!ac || timer) return;
        next = ac.currentTime + 0.05;
        step = 0;
        timer = setInterval(tick, 25);
      },
      stopMusic() { clearInterval(timer); timer = null; },
      setTempo(bpm) { tempo = bpm; },
      toggleMute() {
        muted = !muted;
        if (master) master.gain.value = muted ? 0 : 0.5;
        return muted;
      },
      get muted() { return muted; },

      shoot(tool) {
        if (tool === 0) tone(880, 0.06, { vol: 0.04, slide: 1500 });
        else if (tool === 1) tone(300, 0.18, { type: "sawtooth", vol: 0.07, slide: 1400 });
        else { noise(0.12, { vol: 0.16, freq: 2500 }); tone(170, 0.1, { vol: 0.05, slide: 80 }); }
      },
      kill() { noise(0.18, { vol: 0.2, freq: 1800 }); tone(660, 0.12, { type: "triangle", vol: 0.1, slide: 1320 }); },
      bounce() { tone(220, 0.06, { vol: 0.07 }); tone(165, 0.08, { vol: 0.06, at: ac && ac.currentTime + 0.05 }); },
      penalty() { tone(420, 0.35, { type: "sawtooth", vol: 0.12, slide: 90 }); },
      pass() { tone(1047, 0.07, { type: "sine", vol: 0.06 }); tone(1568, 0.1, { type: "sine", vol: 0.05, at: ac && ac.currentTime + 0.06 }); },
      breach() { noise(0.45, { vol: 0.45, freq: 400 }); tone(110, 0.45, { type: "sawtooth", vol: 0.2, slide: 35 }); },
      swap() { tone(1200, 0.04, { type: "sine", vol: 0.06 }); },
      phase() {
        if (!ac) return;
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, { type: "square", vol: 0.06, at: ac.currentTime + i * 0.08 }));
      },
      end(won) {
        if (!ac) return;
        const notes = won ? [523, 659, 784, 1047, 1319] : [392, 330, 262, 196];
        notes.forEach((f, i) => tone(f, 0.22, { type: "square", vol: 0.08, at: ac.currentTime + i * 0.13 }));
      },
    };
  })();

  /* =====================================================================
   * Leaderboard (localStorage, may be unavailable)
   * ===================================================================== */
  const Board = {
    load() {
      try {
        const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(list) ? list : [];
      } catch { return []; }
    },
    qualifies(score) {
      const list = this.load();
      return score > 0 && (list.length < LEADERBOARD_SIZE || score > list[list.length - 1].score);
    },
    add(name, score) {
      const entry = { name, score, at: Date.now() };
      const list = [...this.load(), entry].sort((a, b) => b.score - a.score).slice(0, LEADERBOARD_SIZE);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
      return list.indexOf(entry);
    },
    render(ol, limit, highlight = -1) {
      const list = this.load().slice(0, limit);
      ol.replaceChildren();
      if (!list.length) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "no scores yet, be the first!";
        ol.append(li);
        return;
      }
      list.forEach((e, i) => {
        const li = document.createElement("li");
        if (i === highlight) li.className = "me";
        for (const [cls, txt] of [["r", i + 1], ["n", e.name], ["p", e.score]]) {
          const span = document.createElement("span");
          span.className = cls;
          span.textContent = txt;
          li.append(span);
        }
        ol.append(li);
      });
    },
  };

  /* =====================================================================
   * Canvas sizing
   * ===================================================================== */
  const canvas = $("#game"), ctx = canvas.getContext("2d");
  const stage = $("#stage"), screen = $("#screen");
  let view = 1;

  function resize() {
    const scale = Math.min((stage.clientWidth - 16) / W, (stage.clientHeight - 16) / H);
    const cw = Math.floor(W * scale), ch = Math.floor(H * scale);
    screen.style.width = `${cw}px`;
    screen.style.height = `${ch}px`;
    screen.style.setProperty("--s", scale.toFixed(3));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    view = canvas.width / W;
  }
  addEventListener("resize", resize);
  resize();

  /* =====================================================================
   * Game state
   * ===================================================================== */
  let mode = "title";   // title | playing | over
  let g = null;         // current round
  let time = 0;         // global animation clock
  let overAt = 0;       // when the game-over screen appeared
  const keys = new Set();
  let mouseDown = false;

  function newGame() {
    return {
      t: 0, score: 0, lives: LIVES, tool: 0, x: W / 2, cooldown: 0,
      entities: [], swarms: [], shots: [], debris: [], particles: [], texts: [],
      spawnT: 0.8, swarmT: 1.2, phase: -1, banner: null,
      shake: 0, flash: 0, groundFlash: 0, groundColor: "#39ff88",
      stats: { blocked: 0, passed: 0, dropped: 0, breaches: 0, wrong: 0 },
    };
  }

  /* ---------- spawning ---------- */
  function freeX(w) {
    let x = W / 2;
    for (let i = 0; i < 10; i++) {
      x = rand(w / 2 + 20, W - w / 2 - 20);
      const clash = g.entities.some((e) => e.y < 90 && Math.abs(e.x - x) < (e.w + w) / 2 + 14);
      if (!clash) break;
    }
    return x;
  }

  function makeEntity(type, vy, x) {
    const [raw, hitText] = pickArr(TYPES[type].labels);
    const label = type === "iam" ? `◆ ${raw}` : raw;
    ctx.font = LABEL_FONT;
    const w = Math.ceil(ctx.measureText(label).width) + (type === "iam" ? 40 : 24);
    const e = { type, label, hitText, w, h: 28, vy, y: -20, seed: Math.random() * 10, wobble: 18 };
    e.x = e.baseX = x ?? freeX(w);
    return e;
  }

  function spawnWave(P) {
    const type = pickWeighted(P.mix);
    const vy = rand(...P.speed);
    if (type !== "legit" && Math.random() < P.pairChance) {
      // A malicious payload hiding directly behind a legit packet.
      const front = makeEntity("legit", vy);
      const back = makeEntity(type, vy, front.x);
      back.y = front.y - PAIR_GAP;
      back.wobble = 0;
      g.entities.push(front, back);
    } else {
      g.entities.push(makeEntity(type, vy));
    }
  }

  function spawnSwarm() {
    const sw = { x: 0, y: -50, vy: rand(85, 105), seed: Math.random() * 10, bots: [], breached: false };
    sw.x = sw.baseX = rand(130, W - 130);
    const n = randInt(SWARM_SIZE[0], SWARM_SIZE[1]);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      const bot = { type: "bot", sw, ox: Math.cos(a) * r * 58, oy: Math.sin(a) * r * 30,
                    x: sw.x, y: sw.y, w: 14, h: 14, seed: Math.random() * 10 };
      sw.bots.push(bot);
      g.entities.push(bot);
    }
    g.swarms.push(sw);
  }

  /* ---------- actions ---------- */
  function setTool(i) {
    if (!g || i === g.tool) return;
    g.tool = (i + TOOLS.length) % TOOLS.length;
    Sound.swap();
  }

  function fire() {
    const T = TOOLS[g.tool];
    g.cooldown = T.cooldown;
    const y = MUZZLE_Y;
    const shot = (vx, vy, o) => ({ x: g.x, y, vx, vy, tool: g.tool, hits: new Set(), life: 2, ...o });
    if (g.tool === 0) {
      g.shots.push(shot(0, -950, { len: 16, w: 3, r: 3 }));
    } else if (g.tool === 1) {
      g.shots.push(shot(0, -1100, { len: 46, w: 5, r: 5, pierce: true }));
    } else {
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.17;
        g.shots.push(shot(Math.sin(a) * 780, -Math.cos(a) * 780, { len: 6, w: 6, r: 5, life: 0.4 }));
      }
    }
    Sound.shoot(g.tool);
  }

  function addScore(base) {
    const pts = base > 0 ? base * PHASES[g.phase].mult : base;
    g.score += pts;
    return pts;
  }

  function floatText(x, y, text, color, size = 16) {
    g.texts.push({ x: clamp(x, 110, W - 110), y, text, color, size, life: 1.2 });
  }

  function burst(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(60, 260);
      g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), color, size: rand(2, 4) });
    }
  }

  function hit(s, e) {
    s.hits.add(e);

    if (e.type === "legit") {
      e.dead = true;
      s.dead = true;
      addScore(-LEGIT_PENALTY);
      g.stats.dropped++;
      burst(e.x, e.y, TYPES.legit.color);
      floatText(e.x, e.y, `Legit user blocked! -${LEGIT_PENALTY}`, "#ff3b5c");
      g.shake = Math.max(g.shake, 6);
      Sound.penalty();
      return;
    }

    if (TOOL_FOR[e.type] === s.tool) {
      e.dead = true;
      if (!s.pierce) s.dead = true;
      g.stats.blocked++;
      const pts = addScore(TYPES[e.type].points);
      burst(e.x, e.y, TYPES[e.type].color, e.type === "bot" ? 6 : 16);
      if (e.type === "bot") {
        floatText(e.x, e.y, `+${pts}`, TYPES.bot.color, 13);
        if (e.sw.bots.every((b) => b.dead)) floatText(e.x, e.y - 22, "SYN Flood Mitigated!", TYPES.bot.color);
      } else {
        floatText(e.x, e.y, `${e.hitText} +${pts}`, TYPES[e.type].color);
      }
      Sound.kill();
      return;
    }

    // Wrong tool: the shot bounces off harmlessly.
    s.dead = true;
    g.stats.wrong++;
    g.debris.push({ ...s, vx: rand(-160, 160), vy: rand(140, 240), life: 0.4 });
    if (time - (e.lastWrong ?? -9) > 0.7) {
      e.lastWrong = time;
      const right = TOOL_FOR[e.type];
      floatText(e.x, e.y - 20, `Wrong tool → [${right + 1}]`, TOOLS[right].color, 14);
    }
    Sound.bounce();
  }

  function breach(x, text) {
    g.lives--;
    g.stats.breaches++;
    g.shake = 14;
    g.flash = 0.35;
    g.groundFlash = 0.6;
    g.groundColor = "#ff3b5c";
    floatText(x, GROUND_Y - 30, text, "#ff3b5c", 18);
    Sound.breach();
    if (g.lives <= 0) endGame(false);
  }

  function reachGround(e) {
    e.dead = true;
    if (e.type === "legit") {
      const pts = addScore(TYPES.legit.points);
      g.stats.passed++;
      g.groundFlash = 0.3;
      g.groundColor = "#39ff88";
      floatText(e.x, GROUND_Y - 24, `200 OK +${pts}`, TYPES.legit.color, 14);
      Sound.pass();
    } else if (e.type === "bot") {
      if (!e.sw.breached) {
        e.sw.breached = true;
        e.sw.bots.forEach((b) => { b.dead = true; });
        breach(e.x, "DDoS: SLA Violated!");
      }
    } else {
      breach(e.x, "SLA Violated!");
    }
  }

  /* ---------- round flow ---------- */
  function start() {
    Sound.init();
    g = newGame();
    mode = "playing";
    $("#title").hidden = true;
    $("#over").hidden = true;
    mouseDown = false;
    Sound.startMusic();
  }

  function endGame(survived) {
    if (mode !== "playing") return;
    mode = "over";
    overAt = time;
    keys.clear();
    mouseDown = false;
    const bonus = survived ? g.lives * SLA_BONUS : 0;
    g.score += bonus;
    Sound.stopMusic();
    Sound.end(survived);

    const title = $("#over-title");
    title.textContent = survived ? "UPTIME MAINTAINED" : "CLUSTER DOWN";
    title.className = survived ? "win" : "lose";
    $("#over-score").textContent = g.score;

    const s = g.stats;
    const rows = [
      ["Attacks blocked", s.blocked, "good"],
      ["Real users served", s.passed, "good"],
      ["Real users blocked", s.dropped, s.dropped ? "bad" : ""],
      ["Breaches", s.breaches, s.breaches ? "bad" : ""],
      ["SLA bonus", bonus ? `+${bonus}` : "0", bonus ? "good" : ""],
    ];
    const ul = $("#over-stats");
    ul.replaceChildren(...rows.map(([label, val, cls]) => {
      const li = document.createElement("li");
      li.className = cls;
      li.append(label);
      const b = document.createElement("b");
      b.textContent = val;
      li.append(b);
      return li;
    }));

    const form = $("#name-form");
    form.hidden = !Board.qualifies(g.score);
    Board.render($("#over-board"), LEADERBOARD_SIZE);
    $("#over").hidden = false;
    if (!form.hidden) {
      const input = $("#name");
      input.value = "";
      // Small delay so a held fire key doesn't type into the field.
      setTimeout(() => input.focus(), 400);
    }
  }

  function saveName() {
    const form = $("#name-form");
    if (form.hidden) return;
    const name = $("#name").value.trim().toUpperCase().slice(0, 12) || "ANON";
    const idx = Board.add(name, g.score);
    form.hidden = true;
    Board.render($("#over-board"), LEADERBOARD_SIZE, idx);
    $("#again").focus();
  }

  function skipName() {
    $("#name-form").hidden = true;
    $("#again").focus();
  }

  function showTitle() {
    Board.render($("#title-board"), 5);
  }

  /* =====================================================================
   * Update
   * ===================================================================== */
  function update(dt) {
    g.t += dt;
    if (g.t >= GAME_SECONDS) { endGame(true); return; }

    // Phase changes
    let pi = PHASES.findIndex((p) => g.t < p.until);
    if (pi === -1) pi = PHASES.length - 1;
    if (pi !== g.phase) {
      g.phase = pi;
      const P = PHASES[pi];
      g.banner = { title: P.banner[0], sub: P.banner[1], color: P.color, t: 0 };
      Sound.setTempo(P.tempo);
      Sound.phase();
    }
    const P = PHASES[g.phase];

    // Player
    const dir = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0);
    g.x = clamp(g.x + dir * PLAYER_SPEED * dt, 40, W - 40);
    g.cooldown -= dt;
    if ((keys.has("fire") || mouseDown) && g.cooldown <= 0) fire();

    // Spawning
    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      spawnWave(P);
      g.spawnT = P.spawnEvery * rand(0.75, 1.25);
    }
    if (P.swarmEvery) {
      g.swarmT -= dt;
      if (g.swarmT <= 0) {
        spawnSwarm();
        g.swarmT = P.swarmEvery * rand(0.8, 1.2);
      }
    }

    // Movement
    for (const sw of g.swarms) {
      sw.y += sw.vy * dt;
      sw.x = clamp(sw.baseX + Math.sin(g.t * 1.3 + sw.seed) * 40, 70, W - 70);
    }
    for (const e of g.entities) {
      if (e.dead) continue;
      if (e.type === "bot") {
        e.x = e.sw.x + e.ox + Math.sin(time * 9 + e.seed) * 3;
        e.y = e.sw.y + e.oy + Math.cos(time * 7 + e.seed) * 3;
      } else {
        e.y += e.vy * dt;
        if (e.type === "iam") e.x = e.baseX + Math.sin(g.t * 2.2 + e.seed) * e.wobble;
      }
      if (e.y > GROUND_Y - 4) reachGround(e);
      if (mode !== "playing") return;   // last uptime bar lost
    }

    // Shots
    for (const s of g.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.y < 30 || s.x < 0 || s.x > W) { s.dead = true; continue; }
      for (const e of g.entities) {
        // Packets already below the barrel can't be hit (they're past the filter).
        if (e.dead || s.hits.has(e) || e.y > MUZZLE_Y) continue;
        if (Math.abs(s.x - e.x) <= e.w / 2 + s.r &&
            s.y <= e.y + e.h / 2 && s.y + s.len >= e.y - e.h / 2) {
          hit(s, e);
          if (s.dead) break;
        }
      }
    }

    g.entities = g.entities.filter((e) => !e.dead);
    g.swarms = g.swarms.filter((sw) => sw.bots.some((b) => !b.dead));
    g.shots = g.shots.filter((s) => !s.dead);
    if (g.banner) {
      g.banner.t += dt;
      if (g.banner.t > 2.8) g.banner = null;
    }
  }

  /** Effects keep animating on the game-over screen. */
  function updateFx(dt) {
    for (const d of g.debris) { d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; }
    for (const p of g.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94;
      p.life -= dt;
    }
    for (const t of g.texts) { t.y -= 38 * dt; t.life -= dt; }
    g.debris = g.debris.filter((d) => d.life > 0);
    g.particles = g.particles.filter((p) => p.life > 0);
    g.texts = g.texts.filter((t) => t.life > 0);
    g.shake = Math.max(0, g.shake - dt * 40);
    g.flash = Math.max(0, g.flash - dt);
    g.groundFlash = Math.max(0, g.groundFlash - dt);
  }

  /* =====================================================================
   * Render
   * ===================================================================== */
  function drawBackground() {
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#03070a");
    grd.addColorStop(1, "#071319");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    const speed = g && mode === "playing" ? 30 + g.phase * 30 : 20;
    const off = (time * speed) % 40;
    ctx.strokeStyle = "rgba(62, 240, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 40) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, GROUND_Y); }
    for (let y = off; y < GROUND_Y; y += 40) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();

    if (g && g.phase === 2 && mode === "playing") {
      ctx.fillStyle = `rgba(255, 59, 92, ${0.04 + Math.sin(time * 6) * 0.02})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawGround() {
    const flash = g ? g.groundFlash : 0;
    const color = flash > 0 ? g.groundColor : "#39ff88";
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + flash * 30;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5 + flash;
    ctx.lineWidth = 2 + flash * 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();
    ctx.restore();

    // Server rack row = the cloud cluster
    const breach = flash > 0 && g.groundColor === "#ff3b5c";
    for (let i = 0; i < 16; i++) {
      const x = 8 + i * 59.5;
      ctx.fillStyle = "#0a1419";
      ctx.strokeStyle = "#16323a";
      ctx.fillRect(x, GROUND_Y + 8, 52, 20);
      ctx.strokeRect(x + 0.5, GROUND_Y + 8.5, 51, 19);
      for (let j = 0; j < 3; j++) {
        const on = Math.sin(time * 5 + i * 1.7 + j * 2.3) > 0.2;
        ctx.fillStyle = breach ? "#ff3b5c" : on ? "#39ff88" : "#16323a";
        ctx.fillRect(x + 6 + j * 8, GROUND_Y + 15, 5, 5);
      }
      ctx.fillStyle = "#16323a";
      ctx.fillRect(x + 32, GROUND_Y + 13, 14, 2);
      ctx.fillRect(x + 32, GROUND_Y + 19, 14, 2);
    }
  }

  function drawEntity(e) {
    const c = TYPES[e.type].color;
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = 10;
    ctx.fillStyle = rgba(c, e.type === "bot" ? 1 : 0.14);
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    const x = e.x - e.w / 2, y = e.y - e.h / 2;
    ctx.beginPath();
    if (e.type === "bot") {
      ctx.arc(e.x, e.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (e.type === "legit") ctx.roundRect(x, y, e.w, e.h, 14);
    else if (e.type === "injection") ctx.rect(x, y, e.w, e.h);
    else {
      const p = 14;
      ctx.moveTo(x, e.y);
      ctx.lineTo(x + p, y);
      ctx.lineTo(x + e.w - p, y);
      ctx.lineTo(x + e.w, e.y);
      ctx.lineTo(x + e.w - p, y + e.h);
      ctx.lineTo(x + p, y + e.h);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = c;
    ctx.font = LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e.label, e.x, e.y + 1);
    ctx.restore();
  }

  function drawSwarmLabels() {
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = TYPES.bot.color;
    for (const sw of g.swarms) {
      const alive = sw.bots.filter((b) => !b.dead);
      if (!alive.length) continue;
      const cx = alive.reduce((a, b) => a + b.x, 0) / alive.length;
      const top = Math.min(...alive.map((b) => b.y));
      ctx.fillText("SYN Flood", cx, top - 10);
    }
  }

  function drawShot(s, alpha = 1) {
    const c = TOOLS[s.tool].color;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = c;
    ctx.shadowBlur = 12;
    ctx.fillStyle = c;
    if (s.tool === 2) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(s.x - s.w / 2, s.y, s.w, s.len);
      if (s.tool === 1) {
        ctx.fillStyle = "#fff6d8";
        ctx.fillRect(s.x - 1, s.y + 4, 2, s.len - 8);
      }
    }
    ctx.restore();
  }

  function drawPlayer() {
    const T = TOOLS[g.tool], x = g.x, y = PLAYER_Y;
    ctx.save();
    ctx.shadowColor = T.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = T.color;
    if (g.tool === 0) ctx.fillRect(x - 2, y - 28, 4, 20);
    else if (g.tool === 1) ctx.fillRect(x - 3.5, y - 34, 7, 26);
    else {
      ctx.fillRect(x - 12, y - 22, 4, 14);
      ctx.fillRect(x - 2, y - 26, 4, 18);
      ctx.fillRect(x + 8, y - 22, 4, 14);
    }
    ctx.fillStyle = "#0a1419";
    ctx.strokeStyle = T.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 38, y + 16);
    ctx.lineTo(x - 24, y - 9);
    ctx.lineTo(x + 24, y - 9);
    ctx.lineTo(x + 38, y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = T.color;
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`[${g.tool + 1}]`, x, y + 4);
    ctx.restore();
  }

  function drawEffects() {
    for (const p of g.particles) {
      ctx.globalAlpha = clamp(p.life / 0.5, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const t of g.texts) {
      ctx.globalAlpha = clamp(t.life / 0.6, 0, 1);
      ctx.font = `bold ${t.size}px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(2, 5, 7, 0.85)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    ctx.fillStyle = "#04070a";
    ctx.fillRect(0, 0, W, 38);
    ctx.fillStyle = "#16323a";
    ctx.fillRect(0, 38, W, 1);
    ctx.textBaseline = "middle";

    // Score + multiplier
    ctx.textAlign = "left";
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = "#5f8a78";
    ctx.fillText("SCORE", 14, 20);
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillStyle = g.score < 0 ? "#ff3b5c" : "#3ef0ff";
    ctx.fillText(String(g.score), 62, 20);
    const P = PHASES[Math.max(g.phase, 0)];
    if (P.mult > 1) {
      const sw = ctx.measureText(String(g.score)).width;
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillStyle = Math.sin(time * 10) > 0 ? "#ff3b5c" : "#ffc94a";
      ctx.fillText(`×${P.mult}`, 74 + sw, 20);
    }

    // Timer + phase
    const left = Math.max(0, Math.ceil(GAME_SECONDS - g.t));
    const urgent = left <= 10 && mode === "playing";
    ctx.textAlign = "center";
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillStyle = urgent && Math.sin(time * 12) > 0 ? "#ff3b5c" : "#c9f7d8";
    ctx.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`, W / 2, 20);
    ctx.textAlign = "left";
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = P.color;
    ctx.fillText(P.name, W / 2 + 46, 21);

    // Uptime bars
    ctx.textAlign = "right";
    ctx.fillStyle = "#5f8a78";
    ctx.fillText("UPTIME", W - 112, 20);
    for (let i = 0; i < LIVES; i++) {
      const x = W - 100 + i * 30;
      const on = i < g.lives;
      ctx.fillStyle = on ? "#39ff88" : "rgba(255, 59, 92, 0.25)";
      ctx.fillRect(x, 13, 24, 14);
      if (!on) { ctx.strokeStyle = "#ff3b5c"; ctx.strokeRect(x + 0.5, 13.5, 23, 13); }
    }

    // Tool bar
    const bw = 200, gap = 12, bx = (W - (bw * 3 + gap * 2)) / 2, by = 568;
    ctx.textAlign = "center";
    ctx.font = `bold 13px ${FONT}`;
    TOOLS.forEach((T, i) => {
      const x = bx + i * (bw + gap), active = i === g.tool;
      ctx.save();
      if (active) {
        ctx.shadowColor = T.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = T.color;
        ctx.fillRect(x, by, bw, 26);
      } else {
        ctx.strokeStyle = rgba(T.color, 0.45);
        ctx.strokeRect(x + 0.5, by + 0.5, bw - 1, 25);
      }
      ctx.restore();
      ctx.fillStyle = active ? "#04070a" : rgba(T.color, 0.75);
      ctx.fillText(`[${i + 1}] ${T.name}`, x + bw / 2, by + 14);
    });
    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = "#5f8a78";
    ctx.textAlign = "left";
    ctx.fillText("wheel / right-click", 12, by + 14);
    ctx.textAlign = "right";
    ctx.fillText(`[M] sound ${Sound.muted ? "off" : "on"}`, W - 12, by + 14);
  }

  function drawBanner() {
    const b = g.banner;
    if (!b) return;
    const a = b.t < 0.3 ? b.t / 0.3 : b.t > 2.3 ? (2.8 - b.t) / 0.5 : 1;
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = "rgba(4, 7, 10, 0.7)";
    ctx.fillRect(0, 196, W, 92);
    ctx.fillStyle = b.color;
    ctx.fillRect(0, 196, W, 2);
    ctx.fillRect(0, 286, W, 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 18;
    ctx.font = `bold 36px ${FONT}`;
    ctx.fillStyle = b.color;
    ctx.fillText(b.title, W / 2, 228);
    ctx.shadowBlur = 0;
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = "#c9f7d8";
    ctx.fillText(b.sub, W / 2, 264);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(view, 0, 0, view, 0, 0);
    drawBackground();
    if (!g) { drawGround(); return; }

    ctx.save();
    if (g.shake > 0 && !reducedMotion) ctx.translate(rand(-1, 1) * g.shake, rand(-1, 1) * g.shake);
    drawGround();
    for (const e of g.entities) drawEntity(e);
    drawSwarmLabels();
    for (const s of g.shots) drawShot(s);
    for (const d of g.debris) drawShot(d, clamp(d.life / 0.4, 0, 1));
    drawPlayer();
    drawEffects();
    ctx.restore();

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255, 59, 92, ${g.flash})`;
      ctx.fillRect(0, 0, W, H);
    }
    drawHud();
    if (mode === "playing") drawBanner();
  }

  function frame(now) {
    const dt = Math.min((now - (frame.last ?? now)) / 1000, 1 / 30);
    frame.last = now;
    time += dt;
    if (mode === "playing") update(dt);
    if (g) updateFx(dt);
    render();
    requestAnimationFrame(frame);
  }

  /* =====================================================================
   * Input
   * ===================================================================== */
  const KEYMAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "fire" };

  addEventListener("keydown", (e) => {
    Sound.init();
    if (e.target instanceof HTMLInputElement) {
      if (e.key === "Escape") { e.preventDefault(); skipName(); }
      return; // Enter submits the form natively
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === "KeyM") { Sound.toggleMute(); return; }

    if (mode === "playing") {
      const k = KEYMAP[e.code];
      if (k) { keys.add(k); e.preventDefault(); }
      if (e.key === "1" || e.key === "2" || e.key === "3") setTool(Number(e.key) - 1);
      if (e.code === "KeyQ") setTool(g.tool - 1);
      if (e.code === "KeyE") setTool(g.tool + 1);
      return;
    }

    if (mode === "title" && (e.code === "Space" || e.key === "Enter")) {
      e.preventDefault();
      if (!e.repeat) start();
      return;
    }

    if (mode === "over") {
      if (e.code === "Space") { e.preventDefault(); return; }   // never restart from a held fire key
      if (e.key === "Escape") { window.Kiosk?.exit(); return; }
      if (e.key === "Enter") {
        if (document.activeElement?.id === "exit") return;     // let the button work
        e.preventDefault();
        if (!e.repeat && time - overAt > 0.8) start();
      }
    }
  });

  addEventListener("keyup", (e) => {
    const k = KEYMAP[e.code];
    if (k) keys.delete(k);
  });
  addEventListener("blur", () => { keys.clear(); mouseDown = false; });

  screen.addEventListener("pointerdown", (e) => {
    Sound.init();
    if (mode === "title" && e.button === 0) { start(); return; }
    if (mode !== "playing") return;
    if (e.button === 0) mouseDown = true;
    if (e.button === 2) setTool(g.tool + 1);
  });
  addEventListener("pointerup", (e) => { if (e.button === 0) mouseDown = false; });
  screen.addEventListener("contextmenu", (e) => e.preventDefault());

  let lastWheel = 0;
  screen.addEventListener("wheel", (e) => {
    if (mode !== "playing") return;
    e.preventDefault();
    if (time - lastWheel < 0.15 || e.deltaY === 0) return;
    lastWheel = time;
    setTool(g.tool + Math.sign(e.deltaY));
  }, { passive: false });

  $("#name-form").addEventListener("submit", (e) => { e.preventDefault(); saveName(); });
  $("#again").addEventListener("click", start);
  $("#exit").addEventListener("click", () => window.Kiosk?.exit());

  showTitle();
  requestAnimationFrame(frame);
})();
