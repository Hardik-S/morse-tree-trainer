import { test, expect } from "@playwright/test";
import path from "node:path";

const url = `file:///${path.resolve("index.html").replace(/\\/g, "/")}`;

for (const viewport of [
  { width: 1366, height: 900 },
  { width: 768, height: 900 },
  { width: 390, height: 900 },
  { width: 320, height: 900 },
]) {
  test(`core flows at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Morse Tree Trainer" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Explore" })).toHaveAttribute("aria-selected", "true");

    const mapSize = await page.evaluate(() => Object.keys(window.MorseTreeTrainer.MORSE_MAP).length);
    expect(mapSize).toBe(26);

    await page.getByRole("button", { name: "Dot" }).first().click();
    await expect(page.locator("#explore-sequence")).toContainText("·");
    await expect(page.locator("#explore-letter")).toContainText("E");

    await page.getByRole("tab", { name: "Letter -> Morse" }).click();
    await expect(page.locator("#panel-letter")).toBeVisible();
    await page.keyboard.press(".");
    await expect(page.locator("#letter-sequence")).toContainText("·");

    await page.getByRole("tab", { name: "Morse -> Letter" }).click();
    await expect(page.locator("#panel-morse")).toBeVisible();
    await page.locator("#morse-answer").fill("e");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.locator("#morse-stats")).toContainText("Attempts");
  });
}

test("tab arrow navigation does not enter quiz symbols", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(url);
  await page.getByRole("tab", { name: "Explore" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Letter -> Morse" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#letter-sequence")).toHaveText("-");
});

test("theme panel offers seven presets and persists a selected preset", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Open theme settings" }).click();
  await expect(page.getByRole("dialog", { name: "Theme settings" })).toBeVisible();
  await expect(page.locator("[data-theme-preset]")).toHaveCount(7);

  await page.getByRole("button", { name: "Amber Terminal theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "amber");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "amber");
});

test("custom theme editor saves user colors", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Open theme settings" }).click();
  await page.getByLabel("Custom theme name").fill("Night Lab");
  await page.getByLabel("Background color").fill("#101322");
  await page.getByLabel("Surface color").fill("#182033");
  await page.getByLabel("Accent color").fill("#7dd3fc");
  await page.getByLabel("Text color").fill("#eff6ff");
  await page.getByRole("button", { name: "Save custom theme" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
  await expect(page.getByRole("button", { name: "Custom: Night Lab theme" })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
  await page.getByRole("button", { name: "Open theme settings" }).click();
  await expect(page.getByRole("button", { name: "Custom: Night Lab theme" })).toBeVisible();
});

test("corrupt stored preferences and stats fall back cleanly", async ({ page }) => {
  await page.goto(url);
  await page.evaluate(() => {
    localStorage.setItem("morseTreeTrainer.theme", "missing-theme");
    localStorage.setItem("morseTreeTrainer.customTheme", "{not-json");
    localStorage.setItem("morseTreeTrainer.letterStats", "{not-json");
    localStorage.setItem("morseTreeTrainer.morseStats", JSON.stringify({ attempts: "many", correct: null }));
  });

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "matrix");
  await expect(page.locator("#letter-stats")).toContainText("Attempts 0");
  await expect(page.locator("#morse-stats")).toContainText("Accuracy 0%");
  await page.getByRole("button", { name: "Open theme settings" }).click();
  await expect(page.getByRole("button", { name: "Matrix Green theme" })).toHaveAttribute("aria-pressed", "true");
});
