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
});

const state = {
  activeTab: "explore",
  exploreSequence: "",
  letterTarget: "A",
  letterSequence: "",
  letterSubmitted: false,
  morseTargetLetter: "A",
  morseSubmitted: false,
  muted: loadBool(STORAGE_KEYS.muted),
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

function cacheElements() {
  Object.assign(els, {
    tabs: [...document.querySelectorAll("[role='tab']")],
    panels: [...document.querySelectorAll("[role='tabpanel']")],
    treeWrap: document.querySelector("#tree-wrap"),
    treeSvg: document.querySelector("#tree-svg"),
    muteBtn: document.querySelector("#mute-btn"),
    muteIcon: document.querySelector("#mute-icon"),
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

window.MorseTreeTrainer = Object.freeze({ MORSE_MAP, DECODE_MAP });
