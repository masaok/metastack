import { expect, test } from "@playwright/test";

test.describe("drill flow", () => {
  test("home → study, rate three cards, progress survives a reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Drill system design");

    await page.getByRole("link", { name: "Start drilling" }).first().click();
    await expect(page.getByRole("button", { name: "Reveal key points" })).toBeVisible();
    await expect(page).toHaveURL(/\/study\/card\/[a-z0-9-]+$/);

    for (let i = 0; i < 3; i++) {
      await expect(page.getByRole("button", { name: "Reveal key points" })).toBeVisible();
      await page.keyboard.press("Space");
      await expect(page.getByText("Tick the points you covered")).toBeVisible();
      // tick everything → suggested Easy
      const boxes = page.getByRole("checkbox");
      const n = await boxes.count();
      for (let j = 0; j < n; j++) await boxes.nth(j).check();
      await expect(page.getByText(/suggested Easy/)).toBeVisible();
      await page.keyboard.press("Enter");
      // The counter only advances after the review is persisted.
      await expect(page.getByText(new RegExp(`^${i + 2}/\\d+`))).toBeVisible();
    }

    // Three cards were introduced, so the deck page shows them as learned.
    await page.goto("/decks");
    const learned = page.locator("dd", { hasText: /^\d+$/ });
    await expect
      .poll(async () => {
        const texts = await learned.allTextContents();
        // every third dd is "learned" (due, new, learned per deck)
        return texts.filter((_, i) => i % 3 === 2).reduce((a, b) => a + Number(b), 0);
      })
      .toBe(3);

    await page.reload();
    await expect
      .poll(async () => {
        const texts = await learned.allTextContents();
        return texts.filter((_, i) => i % 3 === 2).reduce((a, b) => a + Number(b), 0);
      })
      .toBe(3);
  });

  test("card permalink opens that card and the back button returns", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Study url-shortener", exact: true }).click();
    await expect(page).toHaveURL(/\/study\/card\/url-shortener$/);
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toContainText(
      "URL shortener",
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/study/estimation");
    await expect(page).toHaveURL(/\/study\/card\/[a-z0-9-]+$/);
    const first = page.url();
    await page.getByRole("button", { name: "Quick" }).click();
    await page.keyboard.press("Space");
    await page.keyboard.press("3");
    await expect(page).not.toHaveURL(first);
    await expect(page).toHaveURL(/\/study\/card\/[a-z0-9-]+$/);
    await page.goBack();
    await expect(page).toHaveURL(first);
    await expect(page.getByRole("button", { name: "Reveal key points" })).toBeVisible();
  });

  test("skip forward and back without rating", async ({ page }) => {
    await page.goto("/study/fundamentals");
    await expect(page.getByText(/^1\/\d+/)).toBeVisible();
    const first = page.url();
    await expect(page.getByRole("button", { name: "Previous card" })).toBeDisabled();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByText(/^2\/\d+/)).toBeVisible();
    await expect(page).not.toHaveURL(first);

    await page.getByRole("button", { name: "Previous card" }).click();
    await expect(page.getByText(/^1\/\d+/)).toBeVisible();
    await expect(page).toHaveURL(first);
    // Nothing was rated, so the card is still new.
    await expect(page.getByText("new", { exact: true })).toBeVisible();

    // A card opened by its own URL walks the deck in content order.
    await page.goto("/study/card/read-replicas-and-lag");
    await expect(page.getByText(/^1\/1/)).toBeVisible();
    await page.getByRole("button", { name: "Next card" }).click();
    await expect(page).toHaveURL(/\/study\/card\/(?!read-replicas-and-lag)[a-z0-9-]+$/);
  });

  test("quick mode rates with number keys", async ({ page }) => {
    await page.goto("/study/estimation");
    await page.getByRole("button", { name: "Quick" }).click();
    await page.keyboard.press("Space");
    await expect(page.getByText("Rate with")).toBeVisible();
    await page.keyboard.press("3");
    await expect(page.getByText(/^2\/\d+/)).toBeVisible();
  });

  test("card browser filters and deep links", async ({ page }) => {
    await page.goto("/cards");
    await page.getByPlaceholder("Search prompts and tags").fill("write-through");
    await expect(page.getByText(/^1 of \d+ cards$/)).toBeVisible();
    await page.getByRole("link", { name: /write-through/ }).click();
    await expect(page).toHaveURL(/\/cards\/caching-write-strategies$/);
    await expect(page.getByRole("heading", { name: "Key points" })).toBeVisible();
  });

  test("settings export produces a JSON file", async ({ page }) => {
    await page.goto("/settings");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^metastack-progress-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
