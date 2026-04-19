(() => {
  "use strict";

  const LS_SETTINGS = "tabliczka:settings";
  const LS_HISTORY = "tabliczka:history";
  const HISTORY_LIMIT = 10;
  const FEEDBACK_MS = 900;

  const DEFAULT_SETTINGS = Object.freeze({
    liczbaZadan: 10,
    typ: "mix", // mix | mnozenie | dzielenie
    czynnikMin: 2,
    czynnikMax: 10,
    iloczynMin: 20,
    iloczynMax: 100,
    wykluczTrywialne: true,
  });

  // ---- Pure: filters & generation -------------------------------------------

  // Pair (a, b) valid under settings?
  function isValidPair(a, b, s) {
    if (a < s.czynnikMin || a > s.czynnikMax) return false;
    if (b < s.czynnikMin || b > s.czynnikMax) return false;
    const p = a * b;
    if (p < s.iloczynMin || p > s.iloczynMax) return false;
    if (s.wykluczTrywialne) {
      if (a === 0 || b === 0 || a === 1 || b === 1 || a === 10 || b === 10) return false;
      if (a < 4 && b < 4) return false;
    }
    return true;
  }

  function validPairs(s) {
    const out = [];
    for (let a = s.czynnikMin; a <= s.czynnikMax; a++) {
      for (let b = a; b <= s.czynnikMax; b++) {
        if (isValidPair(a, b, s)) out.push([a, b]);
      }
    }
    return out;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function coin() { return Math.random() < 0.5; }

  // Build one question from a pair. typ = "mnozenie" | "dzielenie".
  function buildQuestion(a, b, kind) {
    // randomize order for multiplication; for division decide which factor is divisor
    const [x, y] = coin() ? [a, b] : [b, a];
    if (kind === "mnozenie") {
      return {
        kind: "mnozenie",
        a: x, b: y,
        text: `${x} × ${y} = ?`,
        answer: x * y,
      };
    }
    // dzielenie: product / one factor = other
    const product = x * y;
    const divisor = coin() ? x : y;
    const result = product / divisor;
    return {
      kind: "dzielenie",
      a: product, b: divisor,
      text: `${product} : ${divisor} = ?`,
      answer: result,
    };
  }

  function generateSession(settings) {
    const pairs = validPairs(settings);
    if (pairs.length === 0) {
      throw new Error("Brak pytan spelniajacych parametry. Poszerz zakres.");
    }
    const n = Math.max(1, Math.floor(settings.liczbaZadan));
    const want = [];
    const seen = new Set();
    const maxAttempts = n * 50;
    let attempts = 0;
    while (want.length < n && attempts < maxAttempts) {
      attempts++;
      const [a, b] = pick(pairs);
      const kind =
        settings.typ === "mnozenie" ? "mnozenie" :
        settings.typ === "dzielenie" ? "dzielenie" :
        (coin() ? "mnozenie" : "dzielenie");
      const q = buildQuestion(a, b, kind);
      const key = `${q.kind}|${q.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      want.push(q);
    }
    // fallback if we couldn't get unique — fill with repeats
    while (want.length < n) {
      const [a, b] = pick(pairs);
      const kind = settings.typ === "mix" ? (coin() ? "mnozenie" : "dzielenie") : settings.typ;
      want.push(buildQuestion(a, b, kind));
    }
    return want;
  }

  // ---- Storage --------------------------------------------------------------

  function loadSettings() {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(s) {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
  }

  function isValidHistoryEntry(h) {
    return h && typeof h === "object"
      && Number.isFinite(h.when)
      && Number.isFinite(h.score)
      && Number.isFinite(h.total)
      && Number.isFinite(h.totalMs)
      && typeof h.typ === "string";
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(LS_HISTORY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidHistoryEntry);
    } catch {
      return [];
    }
  }

  function pushHistory(entry) {
    const arr = loadHistory();
    arr.unshift(entry);
    const trimmed = arr.slice(0, HISTORY_LIMIT);
    localStorage.setItem(LS_HISTORY, JSON.stringify(trimmed));
    return trimmed;
  }

  // ---- State & views --------------------------------------------------------

  const state = {
    settings: loadSettings(),
    session: null,
    sessionId: 0,
    idx: 0,
    answers: [], // { q, given, correct, ms }
    startedAt: 0,
    questionStartedAt: 0,
    timerHandle: null,
    feedbackHandle: null,
    busy: false,
  };

  function clearFeedbackTimer() {
    if (state.feedbackHandle !== null) {
      clearTimeout(state.feedbackHandle);
      state.feedbackHandle = null;
    }
  }

  const $ = (sel) => document.querySelector(sel);

  const views = {
    start: $("#view-start"),
    quiz: $("#view-quiz"),
    results: $("#view-results"),
  };

  function showView(name) {
    for (const [k, el] of Object.entries(views)) el.hidden = (k !== name);
  }

  // ---- Settings form --------------------------------------------------------

  const form = $("#settings-form");

  function fillForm(s) {
    for (const [k, v] of Object.entries(s)) {
      const el = form.elements[k];
      if (!el) continue;
      if (el.type === "checkbox") el.checked = !!v;
      else el.value = v;
    }
  }

  function readForm() {
    const fd = new FormData(form);
    const raw = Object.fromEntries(fd.entries());
    const s = {
      liczbaZadan: parseInt(raw.liczbaZadan, 10),
      typ: raw.typ,
      czynnikMin: parseInt(raw.czynnikMin, 10),
      czynnikMax: parseInt(raw.czynnikMax, 10),
      iloczynMin: parseInt(raw.iloczynMin, 10),
      iloczynMax: parseInt(raw.iloczynMax, 10),
      wykluczTrywialne: form.elements.wykluczTrywialne.checked,
    };
    // basic sanity
    if (s.czynnikMax < s.czynnikMin) s.czynnikMax = s.czynnikMin;
    if (s.iloczynMax < s.iloczynMin) s.iloczynMax = s.iloczynMin;
    return s;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    state.settings = readForm();
    saveSettings(state.settings);
    flashSaved();
  });

  $("#btn-reset-settings").addEventListener("click", () => {
    state.settings = { ...DEFAULT_SETTINGS };
    fillForm(state.settings);
    saveSettings(state.settings);
    flashSaved();
  });

  function flashSaved() {
    const btn = form.querySelector('button[type="submit"]');
    const prev = btn.textContent;
    btn.textContent = "Zapisano ✓";
    setTimeout(() => { btn.textContent = prev; }, 900);
  }

  // ---- History render -------------------------------------------------------

  function renderHistory() {
    const ul = $("#history-list");
    ul.replaceChildren();
    const items = loadHistory();
    for (const h of items) {
      const li = document.createElement("li");
      const when = new Date(h.when);
      const date = when.toLocaleDateString("pl-PL");
      const time = when.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      const strong = document.createElement("strong");
      strong.textContent = `${h.score} / ${h.total}`;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = ` ${date} ${time} · ${(h.totalMs / 1000).toFixed(0)} s · ${h.typ}`;
      li.append(strong, meta);
      ul.appendChild(li);
    }
  }

  // ---- Quiz flow ------------------------------------------------------------

  const elQuestion = $("#question");
  const elAnswer = $("#answer");
  const elFeedback = $("#feedback");
  const elProgress = $("#progress");
  const elTimer = $("#session-timer");

  function startSession() {
    try {
      state.session = generateSession(state.settings);
    } catch (e) {
      alert(e.message);
      return;
    }
    clearFeedbackTimer();
    state.sessionId++;
    state.idx = 0;
    state.answers = [];
    state.startedAt = performance.now();
    showView("quiz");
    startTimerTick();
    renderQuestion();
  }

  function startTimerTick() {
    stopTimerTick();
    state.timerHandle = setInterval(() => {
      const s = (performance.now() - state.startedAt) / 1000;
      elTimer.textContent = `${s.toFixed(1)} s`;
    }, 100);
  }

  function stopTimerTick() {
    if (state.timerHandle) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
    }
  }

  function renderQuestion() {
    const q = state.session[state.idx];
    elQuestion.classList.remove("ok", "bad");
    elQuestion.textContent = q.text;
    elProgress.textContent = `${state.idx + 1} / ${state.session.length}`;
    elFeedback.textContent = "";
    elFeedback.className = "feedback";
    elAnswer.value = "";
    elAnswer.disabled = false;
    elAnswer.focus();
    state.questionStartedAt = performance.now();
    state.busy = false;
  }

  $("#answer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.busy) return;
    const raw = elAnswer.value.trim();
    if (raw === "") return;
    const given = parseInt(raw, 10);
    if (Number.isNaN(given)) return;
    const q = state.session[state.idx];
    const correct = given === q.answer;
    const ms = performance.now() - state.questionStartedAt;
    state.answers.push({ q, given, correct, ms });
    state.busy = true;
    elAnswer.disabled = true;

    if (correct) {
      elQuestion.classList.add("ok");
      elFeedback.textContent = "Dobrze!";
      elFeedback.className = "feedback ok";
    } else {
      elQuestion.classList.add("bad");
      elFeedback.textContent = `Zle. Poprawna: ${q.answer}`;
      elFeedback.className = "feedback bad";
    }

    const mySessionId = state.sessionId;
    clearFeedbackTimer();
    state.feedbackHandle = setTimeout(() => {
      state.feedbackHandle = null;
      if (state.sessionId !== mySessionId) return; // aborted or restarted — drop stale callback
      state.idx++;
      if (state.idx >= state.session.length) {
        finishSession();
      } else {
        renderQuestion();
      }
    }, FEEDBACK_MS);
  });

  $("#btn-abort").addEventListener("click", () => {
    if (!confirm("Przerwac sesje? Wynik nie zostanie zapisany.")) return;
    clearFeedbackTimer();
    state.sessionId++; // invalidate any in-flight timeout callback
    stopTimerTick();
    showView("start");
    renderHistory();
  });

  function finishSession() {
    stopTimerTick();
    const totalMs = performance.now() - state.startedAt;
    const total = state.session.length;
    const score = state.answers.filter(a => a.correct).length;
    const avg = totalMs / total;

    $("#score").textContent = `${score} / ${total}`;
    $("#total-time").textContent = `${(totalMs / 1000).toFixed(0)} s`;
    $("#avg-time").textContent = `${(avg / 1000).toFixed(1)} s`;
    $("#results-headline").textContent =
      score === total ? "Perfekcyjnie!" :
      score >= total * 0.8 ? "Swietnie!" :
      score >= total * 0.5 ? "Dobry wynik" :
      "Jeszcze troche wprawy";

    const mistakes = state.answers.filter(a => !a.correct);
    const mSection = $("#mistakes-section");
    const mList = $("#mistakes");
    mList.replaceChildren();
    if (mistakes.length) {
      mSection.hidden = false;
      for (const m of mistakes) {
        const li = document.createElement("li");
        const q = document.createElement("span");
        q.className = "q";
        q.textContent = m.q.text.replace(" = ?", "");
        const rhs = document.createElement("span");
        const given = document.createElement("span");
        given.className = "given";
        given.textContent = String(m.given);
        const sep = document.createTextNode(" → ");
        const correct = document.createElement("span");
        correct.className = "correct";
        correct.textContent = String(m.q.answer);
        rhs.append(given, sep, correct);
        li.append(q, rhs);
        mList.appendChild(li);
      }
    } else {
      mSection.hidden = true;
    }

    pushHistory({
      when: Date.now(),
      score, total, totalMs,
      typ: state.settings.typ,
    });

    showView("results");
  }

  $("#btn-again").addEventListener("click", () => { startSession(); });
  $("#btn-home").addEventListener("click", () => {
    showView("start");
    renderHistory();
  });

  // ---- Start screen ---------------------------------------------------------

  $("#btn-start").addEventListener("click", () => startSession());
  $("#btn-toggle-settings").addEventListener("click", () => {
    const panel = $("#settings-panel");
    panel.open = !panel.open;
    if (panel.open) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  // ---- Init -----------------------------------------------------------------

  fillForm(state.settings);
  renderHistory();
  showView("start");

  // Expose for DevTools inspection / smoke tests
  window.tabliczka = {
    DEFAULT_SETTINGS,
    isValidPair,
    validPairs,
    generateSession,
    state,
  };
})();
