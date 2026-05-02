import { readFile } from "node:fs/promises";

const requiredFiles = ["index.html", "src/styles.css", "src/app.js", "README.md", "netlify.toml"];
const expectedMorse = {
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
};

for (const file of requiredFiles) {
  const text = await readFile(file, "utf8");
  if (!text.trim()) throw new Error(`${file} is empty`);
}

const html = await readFile("index.html", "utf8");
for (const id of ["panel-explore", "panel-letter", "panel-morse", "mute-btn"]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing #${id}`);
}

const js = await readFile("src/app.js", "utf8");
for (const [letter, code] of Object.entries(expectedMorse)) {
  const pattern = new RegExp(`${letter}:\\s*["']${code.replaceAll(".", "\\.")}["']`);
  if (!pattern.test(js)) throw new Error(`Missing Morse mapping ${letter}: ${code}`);
}

if (!js.includes("aria-pressed")) throw new Error("Mute aria-pressed state is not wired");
if (!js.includes("state.isPlaying")) throw new Error("Playback debounce state is not present");

console.log("Static checks passed.");
