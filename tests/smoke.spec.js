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
