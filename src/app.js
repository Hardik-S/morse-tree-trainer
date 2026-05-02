"use strict";

const MORSE_MAP = Object.freeze({
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
});

const DECODE_MAP = Object.freeze(
  Object.fromEntries(Object.entries(MORSE_MAP).map(([letter, code]) => [code, letter])),
);

const LETTERS = Object.freeze(Object.keys(MORSE_MAP));
const SVG_NS = "http://www.w3.org/2000/svg";
const STORAGE_KEYS = Object.freeze({
  letterStats: "morseTreeTrainer.letterStats",
  morseStats: "morseTreeTrainer.morseStats",
  muted: "morseTreeTrainer.muted",
  theme: "morseTreeTrainer.theme",
  customTheme: "morseTreeTrainer.customTheme",
});

const THEME_PRESETS = Object.freeze([
  theme("matrix", "Matrix Green", "#090d0a", "#0e1510", "#111a13", "#39ff6e", "#d5f6db"),
  theme("amber", "Amber Terminal", "#100c05", "#1a1307", "#211709", "#ffbd3a", "#ffe8b6"),
  theme("arctic", "Arctic Signal", "#071018", "#0d1c28", "#102739", "#67e8f9", "#e6fbff"),
  theme("violet", "Violet Night", "#10091a", "#1a1028", "#241639", "#c084fc", "#f5edff"),
  theme("solar", "Solar Dawn", "#fbf4df", "#fffaf0", "#f2e4bf", "#c76b14", "#2f2618"),
  theme("rose", "Rose Circuit", "#160811", "#24101d", "#321729", "#fb7185", "#ffe4ea"),
  theme("graphite", "Graphite Pulse", "#0b0d10", "#14181d", "#1d232b", "#a3e635", "#edf7df"),
]);

const state = {
  activeTab: "explore",
  exploreSequence: "",
  letterTarget: "A",
  letterSequence: "",
  letterSubmitted: false,
  morseTargetLetter: "A",
  morseSubmitted: false,
  muted: loadBool(STORAGE_KEYS.muted),
  themeId: loadThemeId(),
  customTheme: loadCustomTheme(),
  isPlaying: false,
  audioContext: null,
};

const tree = buildTree();
const nodeById = new Map();
const nodePositions = new Map();
const edges = [];

const els = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  applyActiveTheme();
  renderThemeOptions();
  syncCustomThemeForm();
  updateCustomPreview();
  renderTree();
  bindTabs();
  bindControls();
  newLetterPrompt();
  newMorsePrompt();
  updateMuteButton();
  updateExplore();
  renderStats("letter");
  renderStats("morse");
}

function theme(id, name, bg, surface, panel, accent, text) {
  return {
    id,
    name,
    colors: { bg, surface, panel, accent, text },
    tokens: buildThemeTokens(bg, surface, panel, accent, text),
  };
}

function buildThemeTokens(bg, surface, panel, accent, text) {
  const accentRgb = hexToRgb(accent);
  return {
    "--bg": bg,
    "--surface": surface,
    "--panel": panel,
    "--panel-strong": mixHex(panel, accent, 0.18),
    "--border": mixHex(surface, accent, 0.36),
    "--border-soft": mixHex(bg, accent, 0.22),
    "--line": mixHex(bg, accent, 0.4),
    "--text": text,
    "--muted": mixHex(text, surface, 0.42),
    "--dim": mixHex(text, surface, 0.64),
    "--green": accent,
    "--green-soft": mixHex(accent, text, 0.22),
    "--green-deep": mixHex(bg, accent, 0.28),
    "--amber": mixHex("#ffbd3a", accent, 0.18),
    "--red": mixHex("#ff4b70", accent, 0.12),
    "--accent-rgb": `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`,
    "--shadow": "0 22px 80px rgba(0, 0, 0, 0.55)",
  };
}

function cacheElements() {
  Object.assign(els, {
    tabs: [...document.querySelectorAll("[role='tab']")],
    panels: [...document.querySelectorAll("[role='tabpanel']")],
    treeWrap: document.querySelector("#tree-wrap"),
    treeSvg: document.querySelector("#tree-svg"),
    muteBtn: document.querySelector("#mute-btn"),
    muteIcon: document.querySelector("#mute-icon"),
    themeToggle: document.querySelector("#theme-toggle"),
    themePanel: document.querySelector("#theme-panel"),
    themeClose: document.querySelector("#theme-close"),
    themePresets: document.querySelector("#theme-presets"),
    customThemeForm: document.querySelector("#custom-theme-form"),
    customThemeName: document.querySelector("#custom-theme-name"),
    customThemeBg: document.querySelector("#custom-theme-bg"),
    customThemeSurface: document.querySelector("#custom-theme-surface"),
    customThemeAccent: document.querySelector("#custom-theme-accent"),
    customThemeText: document.querySelector("#custom-theme-text"),
    customThemePreview: document.querySelector("#custom-theme-preview"),
    exploreSequence: document.querySelector("#explore-sequence"),
    exploreLetter: document.querySelector("#explore-letter"),
    exploreDot: document.querySelector("#explore-dot"),
    exploreDash: document.querySelector("#explore-dash"),
    exploreBack: document.querySelector("#explore-back"),
    exploreReset: document.querySelector("#explore-reset"),
    explorePlay: document.querySelector("#explore-play"),
    letterTarget: document.querySelector("#letter-target"),
    letterSequence: document.querySelector("#letter-sequence"),
    letterDecoded: document.querySelector("#letter-decoded"),
    letterFeedback: document.querySelector("#letter-feedback"),
    letterDot: document.querySelector("#letter-dot"),
    letterDash: document.querySelector("#letter-dash"),
    letterBack: document.querySelector("#letter-back"),
    letterClear: document.querySelector("#letter-clear"),
    letterSubmit: document.querySelector("#letter-submit"),
    letterNew: document.querySelector("#letter-new"),
    letterStats: document.querySelector("#letter-stats"),
    letterResetStats: document.querySelector("#letter-reset-stats"),
    morseTarget: document.querySelector("#morse-target"),
    morseAnswer: document.querySelector("#morse-answer"),
    morseFeedback: document.querySelector("#morse-feedback"),
    morseSubmit: document.querySelector("#morse-submit"),
    morsePlay: document.querySelector("#morse-play"),
    morseNew: document.querySelector("#morse-new"),
    morseStats: document.querySelector("#morse-stats"),
    morseResetStats: document.querySelector("#morse-reset-stats"),
  });
}

function buildTree() {
  const root = { letter: null, dot: null, dash: null };
  for (const [letter, code] of Object.entries(MORSE_MAP)) {
    let current = root;
    for (const symbol of code) {
      const direction = symbol === "." ? "dot" : "dash";
      current[direction] ||= { letter: null, dot: null, dash: null };
      current = current[direction];
    }
    current.letter = letter;
  }
  return root;
}

function renderTree() {
  const svgWidth = 820;
  const svgHeight = 370;
  const levels = collectLevels(tree);
  nodeById.clear();
  nodePositions.clear();
  edges.length = 0;

  levels.forEach((nodes, depth) => {
    const y = 34 + depth * 76;
    const gap = svgWidth / (nodes.length + 1);
    nodes.forEach(({ node, id }, index) => {
      nodeById.set(id, node);
      nodePositions.set(id, { x: gap * (index + 1), y });
      if (node.dot) edges.push({ from: id, to: `${id}.`, type: "dot" });
      if (node.dash) edges.push({ from: id, to: `${id}-`, type: "dash" });
    });
  });

  els.treeSvg.replaceChildren();
  els.treeSvg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

  for (const edge of edges) {
    const from = nodePositions.get(edge.from);
    const to = nodePositions.get(edge.to);
    if (!from || !to) continue;

    const path = document.createElementNS(SVG_NS, "path");
    const midY = (from.y + to.y) / 2;
    path.setAttribute("d", `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`);
    path.setAttribute("class", `tree-edge ${edge.type}`);
    path.dataset.from = edge.from;
    path.dataset.to = edge.to;
    els.treeSvg.append(path);
  }

  for (const [id, position] of nodePositions) {
    const node = nodeById.get(id);
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "tree-node");
    group.setAttribute("transform", `translate(${position.x} ${position.y})`);
    group.dataset.nodeId = id;

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("r", id === "root" ? "17" : "15");
    group.append(circle);

    const text = document.createElementNS(SVG_NS, "text");
    text.textContent = id === "root" ? "START" : node.letter || ".";
    group.append(text);
    els.treeSvg.append(group);
  }
}

function collectLevels(root) {
  const levels = [];
  const queue = [{ node: root, id: "root", depth: 0 }];
  while (queue.length) {
    const item = queue.shift();
    levels[item.depth] ||= [];
    levels[item.depth].push(item);
    if (item.node.dot) queue.push({ node: item.node.dot, id: `${item.id}.`, depth: item.depth + 1 });
    if (item.node.dash) queue.push({ node: item.node.dash, id: `${item.id}-`, depth: item.depth + 1 });
  }
  return levels;
}

function bindTabs() {
  for (const tab of els.tabs) {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab, true));
    tab.addEventListener("keydown", onTabKeydown);
  }
}

function onTabKeydown(event) {
  const currentIndex = els.tabs.indexOf(event.currentTarget);
  let nextIndex = currentIndex;

  if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % els.tabs.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + els.tabs.length) % els.tabs.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = els.tabs.length - 1;
  else return;

  event.preventDefault();
  event.stopPropagation();
  activateTab(els.tabs[nextIndex].dataset.tab, true);
  els.tabs[nextIndex].focus();
}

function activateTab(tabName, focusPanel = false) {
  state.activeTab = tabName;
  for (const tab of els.tabs) {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const panel of els.panels) {
    const active = panel.dataset.panel === tabName;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  }
  if (tabName === "morse") els.morseAnswer.focus();
  else if (focusPanel) document.querySelector(`[data-panel="${tabName}"]`)?.focus?.();
}

function bindControls() {
  els.muteBtn.addEventListener("click", toggleMute);
  els.themeToggle.addEventListener("click", toggleThemePanel);
  els.themeClose.addEventListener("click", closeThemePanel);
  els.customThemeForm.addEventListener("submit", saveCustomThemeFromForm);
  for (const input of [els.customThemeBg, els.customThemeSurface, els.customThemeAccent, els.customThemeText]) {
    input.addEventListener("input", updateCustomPreview);
  }

  els.exploreDot.addEventListener("click", () => addExploreSymbol("."));
  els.exploreDash.addEventListener("click", () => addExploreSymbol("-"));
  els.exploreBack.addEventListener("click", backExplore);
  els.exploreReset.addEventListener("click", resetExplore);
  els.explorePlay.addEventListener("click", () => playMorse(state.exploreSequence));

  els.letterDot.addEventListener("click", () => addLetterSymbol("."));
  els.letterDash.addEventListener("click", () => addLetterSymbol("-"));
  els.letterBack.addEventListener("click", backLetter);
  els.letterClear.addEventListener("click", clearLetterEntry);
  els.letterSubmit.addEventListener("click", submitLetterEntry);
  els.letterNew.addEventListener("click", newLetterPrompt);
  els.letterResetStats.addEventListener("click", () => resetStats("letter"));

  els.morseSubmit.addEventListener("click", submitMorseEntry);
  els.morsePlay.addEventListener("click", () => playMorse(MORSE_MAP[state.morseTargetLetter]));
  els.morseNew.addEventListener("click", newMorsePrompt);
  els.morseResetStats.addEventListener("click", () => resetStats("morse"));
  els.morseAnswer.addEventListener("input", () => {
    els.morseAnswer.value = els.morseAnswer.value.toUpperCase().replace(/[^A-Z]/g, "");
  });
  els.morseAnswer.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitMorseEntry();
    }
  });

  document.addEventListener("keydown", onGlobalKeydown);
}

function toggleThemePanel() {
  const willOpen = els.themePanel.hidden;
  els.themePanel.hidden = !willOpen;
  els.themeToggle.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) els.themePanel.querySelector("button")?.focus();
}

function closeThemePanel() {
  els.themePanel.hidden = true;
  els.themeToggle.setAttribute("aria-expanded", "false");
  els.themeToggle.focus();
}

function renderThemeOptions() {
  const presetButtons = THEME_PRESETS.map((preset) => themeButton(preset, "data-theme-preset")).join("");
  const customButton = state.customTheme ? themeButton(customThemeOption(), "data-custom-theme") : "";
  els.themePresets.innerHTML = presetButtons + customButton;

  els.themePresets.querySelectorAll("[data-theme-preset]").forEach((button) => {
    button.addEventListener("click", () => selectTheme(button.dataset.themeId));
  });
  els.themePresets.querySelector("[data-custom-theme]")?.addEventListener("click", () => selectTheme("custom"));
}

function themeButton(option, marker) {
  const selected = state.themeId === option.id;
  const label = `${option.name} theme`;
  return `
    <button
      class="theme-swatch"
      type="button"
      ${marker}
      data-theme-id="${escapeHtml(option.id)}"
      aria-label="${escapeHtml(label)}"
      aria-pressed="${selected}"
    >
      <span class="swatch-dots" aria-hidden="true">
        <i style="background:${option.colors.bg}"></i>
        <i style="background:${option.colors.surface}"></i>
        <i style="background:${option.colors.accent}"></i>
        <i style="background:${option.colors.text}"></i>
      </span>
      <span>${escapeHtml(option.name)}</span>
    </button>
  `;
}

function customThemeOption() {
  const name = state.customTheme?.name?.trim() || "My Theme";
  const colors = state.customTheme?.colors || defaultCustomColors();
  return {
    id: "custom",
    name: `Custom: ${name}`,
    colors,
    tokens: buildThemeTokens(colors.bg, colors.surface, colors.panel, colors.accent, colors.text),
  };
}

function selectTheme(themeId) {
  if (themeId === "custom" && !state.customTheme) return;
  state.themeId = themeId;
  try {
    localStorage.setItem(STORAGE_KEYS.theme, themeId);
  } catch {
    // Non-critical preference.
  }
  applyActiveTheme();
  renderThemeOptions();
}

function applyActiveTheme() {
  const option = getThemeOption(state.themeId) || THEME_PRESETS[0];
  state.themeId = option.id;
  document.documentElement.dataset.theme = option.id;
  for (const [name, value] of Object.entries(option.tokens)) {
    document.documentElement.style.setProperty(name, value);
  }
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", option.colors.bg);
}

function getThemeOption(themeId) {
  if (themeId === "custom") return state.customTheme ? customThemeOption() : null;
  return THEME_PRESETS.find((preset) => preset.id === themeId) || THEME_PRESETS[0];
}

function syncCustomThemeForm() {
  const custom = state.customTheme || { name: "", colors: defaultCustomColors() };
  els.customThemeName.value = custom.name || "";
  els.customThemeBg.value = custom.colors.bg;
  els.customThemeSurface.value = custom.colors.surface;
  els.customThemeAccent.value = custom.colors.accent;
  els.customThemeText.value = custom.colors.text;
}

function saveCustomThemeFromForm(event) {
  event.preventDefault();
  const colors = {
    bg: els.customThemeBg.value,
    surface: els.customThemeSurface.value,
    panel: mixHex(els.customThemeSurface.value, els.customThemeBg.value, 0.35),
    accent: els.customThemeAccent.value,
    text: els.customThemeText.value,
  };
  state.customTheme = {
    name: els.customThemeName.value.trim() || "My Theme",
    colors,
  };
  state.themeId = "custom";
  try {
    localStorage.setItem(STORAGE_KEYS.customTheme, JSON.stringify(state.customTheme));
    localStorage.setItem(STORAGE_KEYS.theme, state.themeId);
  } catch {
    // Theme still applies for the current session.
  }
  applyActiveTheme();
  renderThemeOptions();
  updateCustomPreview();
}

function updateCustomPreview() {
  const bg = els.customThemeBg.value;
  const surface = els.customThemeSurface.value;
  const accent = els.customThemeAccent.value;
  const text = els.customThemeText.value;
  els.customThemePreview.style.background = `linear-gradient(135deg, ${surface}, ${bg})`;
  els.customThemePreview.style.borderColor = accent;
  els.customThemePreview.querySelector("span").style.background = text;
  els.customThemePreview.querySelector("i").style.background = accent;
}

function onGlobalKeydown(event) {
  if (event.target instanceof HTMLInputElement) return;

  if (state.activeTab === "explore") {
    if (event.key === "." || event.key === "ArrowLeft") {
      event.preventDefault();
      addExploreSymbol(".");
    } else if (event.key === "-" || event.key === "ArrowRight") {
      event.preventDefault();
      addExploreSymbol("-");
    } else if (event.key === "Backspace") {
      event.preventDefault();
      backExplore();
    } else if (event.key === "Escape") {
      event.preventDefault();
      resetExplore();
    } else if (event.key === "Enter" && state.exploreSequence) {
      event.preventDefault();
      playMorse(state.exploreSequence);
    }
  }

  if (state.activeTab === "letter") {
    if (event.key === "." || event.key === "ArrowLeft") {
      event.preventDefault();
      addLetterSymbol(".");
    } else if (event.key === "-" || event.key === "ArrowRight") {
      event.preventDefault();
      addLetterSymbol("-");
    } else if (event.key === "Backspace") {
      event.preventDefault();
      backLetter();
    } else if (event.key === "Escape") {
      event.preventDefault();
      clearLetterEntry();
    } else if (event.key === "Enter") {
      event.preventDefault();
      submitLetterEntry();
    }
  }
}

function addExploreSymbol(symbol) {
  const next = state.exploreSequence + symbol;
  if (!isValidPath(next)) return;
  state.exploreSequence = next;
  updateExplore();
  beep(symbol);
}

function backExplore() {
  state.exploreSequence = state.exploreSequence.slice(0, -1);
  updateExplore();
}

function resetExplore() {
  state.exploreSequence = "";
  updateExplore();
}

function updateExplore() {
  els.exploreSequence.textContent = displayMorse(state.exploreSequence);
  els.exploreLetter.textContent = state.exploreSequence ? DECODE_MAP[state.exploreSequence] || "?" : "?";
  els.explorePlay.disabled = !state.exploreSequence || state.isPlaying;
  highlightPath(state.exploreSequence);
}

function addLetterSymbol(symbol) {
  if (state.letterSubmitted) return;
  const next = state.letterSequence + symbol;
  if (!isValidPath(next)) return;
  state.letterSequence = next;
  updateLetterEntry();
  beep(symbol);
}

function backLetter() {
  if (state.letterSubmitted) return;
  state.letterSequence = state.letterSequence.slice(0, -1);
  updateLetterEntry();
}

function clearLetterEntry() {
  state.letterSequence = "";
  state.letterSubmitted = false;
  els.letterFeedback.textContent = "";
  els.letterFeedback.className = "feedback";
  updateLetterEntry();
}

function newLetterPrompt() {
  state.letterTarget = randomLetter(state.letterTarget);
  state.letterSequence = "";
  state.letterSubmitted = false;
  els.letterTarget.textContent = state.letterTarget;
  els.letterFeedback.textContent = "";
  els.letterFeedback.className = "feedback";
  updateLetterEntry();
}

function updateLetterEntry() {
  els.letterSequence.textContent = displayMorse(state.letterSequence);
  els.letterDecoded.textContent = state.letterSequence ? DECODE_MAP[state.letterSequence] || "?" : "?";
}

function submitLetterEntry() {
  if (!state.letterSequence || state.letterSubmitted) return;
  state.letterSubmitted = true;
  const expected = MORSE_MAP[state.letterTarget];
  const correct = state.letterSequence === expected;
  recordAttempt("letter", correct);
  if (correct) {
    setFeedback(els.letterFeedback, "Correct.", "correct");
    beep(".");
  } else {
    setFeedback(
      els.letterFeedback,
      `Not quite. ${state.letterTarget} is ${displayMorse(expected)}.`,
      "wrong",
    );
  }
}

function newMorsePrompt() {
  state.morseTargetLetter = randomLetter(state.morseTargetLetter);
  state.morseSubmitted = false;
  els.morseTarget.textContent = displayMorse(MORSE_MAP[state.morseTargetLetter]);
  els.morseAnswer.value = "";
  els.morseFeedback.textContent = "";
  els.morseFeedback.className = "feedback";
  if (state.activeTab === "morse") els.morseAnswer.focus();
}

function submitMorseEntry() {
  if (state.morseSubmitted) return;
  const answer = els.morseAnswer.value.trim().toUpperCase();
  if (!answer) return;
  state.morseSubmitted = true;
  const correct = answer === state.morseTargetLetter;
  recordAttempt("morse", correct);
  if (correct) {
    setFeedback(els.morseFeedback, "Correct.", "correct");
    beep(".");
  } else {
    setFeedback(els.morseFeedback, `Not quite. The answer is ${state.morseTargetLetter}.`, "wrong");
  }
}

function isValidPath(sequence) {
  let node = tree;
  for (const symbol of sequence) {
    node = symbol === "." ? node.dot : node.dash;
    if (!node) return false;
  }
  return true;
}

function highlightPath(sequence) {
  document.querySelectorAll(".tree-node, .tree-edge").forEach((el) => el.classList.remove("on-path", "active"));

  const ids = ["root"];
  let id = "root";
  for (const symbol of sequence) {
    id += symbol;
    ids.push(id);
  }

  ids.forEach((nodeId, index) => {
    const node = document.querySelector(`.tree-node[data-node-id="${CSS.escape(nodeId)}"]`);
    if (!node) return;
    node.classList.add(index === ids.length - 1 && sequence ? "active" : "on-path");
  });

  for (let i = 0; i < ids.length - 1; i += 1) {
    document
      .querySelector(`.tree-edge[data-from="${CSS.escape(ids[i])}"][data-to="${CSS.escape(ids[i + 1])}"]`)
      ?.classList.add("on-path");
  }

  const activeId = ids.at(-1);
  const activePosition = nodePositions.get(activeId);
  if (activePosition) {
    window.requestAnimationFrame(() => {
      els.treeWrap.scrollTo({
        left: Math.max(0, activePosition.x - els.treeWrap.clientWidth / 2),
        behavior: sequence && !prefersReducedMotion() ? "smooth" : "auto",
      });
    });
  }
}

async function playMorse(sequence) {
  if (!sequence || state.muted || state.isPlaying) return;
  state.isPlaying = true;
  setPlaybackDisabled(true);
  try {
    for (const symbol of sequence) {
      await tone(symbol === "." ? 90 : 250, 650);
      await wait(90);
    }
  } finally {
    state.isPlaying = false;
    setPlaybackDisabled(false);
    updateExplore();
  }
}

function beep(symbol) {
  if (state.muted || state.isPlaying) return;
  const duration = symbol === "." ? 70 : 150;
  void tone(duration, symbol === "." ? 780 : 560);
}

function tone(duration, frequency) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return Promise.resolve();
  state.audioContext ||= new AudioContext();
  const context = state.audioContext;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = "sine";
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration / 1000);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration / 1000 + 0.025);
  return wait(duration + 30);
}

function setPlaybackDisabled(disabled) {
  els.explorePlay.disabled = disabled || !state.exploreSequence;
  els.morsePlay.disabled = disabled;
}

function toggleMute() {
  state.muted = !state.muted;
  saveBool(STORAGE_KEYS.muted, state.muted);
  updateMuteButton();
}

function updateMuteButton() {
  els.muteBtn.setAttribute("aria-pressed", String(state.muted));
  els.muteBtn.setAttribute("aria-label", state.muted ? "Unmute audio" : "Mute audio");
  els.muteIcon.textContent = state.muted ? "Muted" : "Sound";
}

function getStats(mode) {
  const key = mode === "letter" ? STORAGE_KEYS.letterStats : STORAGE_KEYS.morseStats;
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    if (Number.isFinite(parsed?.attempts) && Number.isFinite(parsed?.correct)) return parsed;
  } catch {
    // Ignore corrupt or unavailable localStorage.
  }
  return { attempts: 0, correct: 0 };
}

function saveStats(mode, stats) {
  const key = mode === "letter" ? STORAGE_KEYS.letterStats : STORAGE_KEYS.morseStats;
  try {
    localStorage.setItem(key, JSON.stringify(stats));
  } catch {
    // Private-mode storage failures should not block practice.
  }
}

function recordAttempt(mode, correct) {
  const stats = getStats(mode);
  stats.attempts += 1;
  if (correct) stats.correct += 1;
  saveStats(mode, stats);
  renderStats(mode);
}

function resetStats(mode) {
  const key = mode === "letter" ? STORAGE_KEYS.letterStats : STORAGE_KEYS.morseStats;
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing else to do.
  }
  renderStats(mode);
}

function renderStats(mode) {
  const stats = getStats(mode);
  const target = mode === "letter" ? els.letterStats : els.morseStats;
  const accuracy = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;
  target.innerHTML = `
    <span>Attempts <strong>${stats.attempts}</strong></span>
    <span>Correct <strong>${stats.correct}</strong></span>
    <span>Accuracy <strong>${accuracy}%</strong></span>
  `;
}

function randomLetter(previous) {
  if (LETTERS.length < 2) return LETTERS[0];
  let next = previous;
  while (next === previous) {
    next = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  return next;
}

function setFeedback(element, message, type) {
  element.textContent = message;
  element.className = `feedback ${type}`;
}

function displayMorse(sequence) {
  return sequence ? sequence.replaceAll(".", "·").replaceAll("-", "—") : "-";
}

function loadThemeId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.theme) || "matrix";
  } catch {
    return "matrix";
  }
}

function loadCustomTheme() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.customTheme));
    if (parsed?.colors?.bg && parsed?.colors?.surface && parsed?.colors?.accent && parsed?.colors?.text) {
      return {
        name: String(parsed.name || "My Theme").slice(0, 24),
        colors: {
          bg: normalizeHex(parsed.colors.bg, "#101322"),
          surface: normalizeHex(parsed.colors.surface, "#182033"),
          panel: normalizeHex(parsed.colors.panel, mixHex(parsed.colors.surface, parsed.colors.bg, 0.35)),
          accent: normalizeHex(parsed.colors.accent, "#7dd3fc"),
          text: normalizeHex(parsed.colors.text, "#eff6ff"),
        },
      };
    }
  } catch {
    // Ignore corrupt theme settings.
  }
  return null;
}

function defaultCustomColors() {
  return {
    bg: "#101322",
    surface: "#182033",
    panel: "#151a29",
    accent: "#7dd3fc",
    text: "#eff6ff",
  };
}

function loadBool(key) {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function saveBool(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Non-critical preference.
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function normalizeHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : fallback;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex, "#39ff6e").slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(first, second, weight) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const clamped = Math.max(0, Math.min(1, weight));
  return rgbToHex({
    r: Math.round(a.r * (1 - clamped) + b.r * clamped),
    g: Math.round(a.g * (1 - clamped) + b.g * clamped),
    b: Math.round(a.b * (1 - clamped) + b.b * clamped),
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

window.MorseTreeTrainer = Object.freeze({ MORSE_MAP, DECODE_MAP });
