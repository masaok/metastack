import { expect, test, type Page } from "@playwright/test";

/** Pin the random draw so a card shows one known exercise: 0 slots, 0.25 cues, 0.5 match, 0.75 pick. */
async function pinRandom(page: Page, value: number) {
  await page.addInitScript((v) => {
    Math.random = () => v;
  }, value);
}

test.describe("exercises", () => {
  const card = "/study/card/authn-authz-basics";

  test("recall slots credit each point marked as got", async ({ page }) => {
    await pinRandom(page, 0);
    await page.goto(card);
    await expect(page.getByTitle("How this card is testing you")).toHaveText("recall");
    await expect(page.getByText("Recall the 5 key points, one at a time")).toBeVisible();
    await page.getByLabel("Your answer for point 1").fill("opaque id, server state");
    for (let i = 0; i < 5; i++) {
      await page.getByRole("button", { name: "Show point" }).click();
      if (i === 0) await expect(page.getByText("You wrote: opaque id, server state")).toBeVisible();
      await page.getByRole("button", { name: i < 4 ? "Got it" : "Missed it" }).click();
    }
    await expect(page.getByText("Tick the points you covered")).toBeVisible();
    await expect(page.getByText(/4\/5 covered → suggested Good/)).toBeVisible();
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(4);
  });

  test("cues show the plain-language hints, and space skips the exercise", async ({ page }) => {
    await pinRandom(page, 0.25);
    await page.goto(card);
    await expect(page.getByTitle("How this card is testing you")).toHaveText("hints");
    await expect(page.getByText("Turn each plain-language hint into the key point")).toBeVisible();
    await expect(page.getByText(/A session is a coat check ticket/)).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByText(/0\/5 covered → suggested Again/)).toBeVisible();
  });

  test("match credits the lines matched on the first try", async ({ page }) => {
    await pinRandom(page, 0.5);
    await page.goto(card);
    const exercise = page.locator("[data-exercise]");
    await expect(page.getByTitle("How this card is testing you")).toHaveText("match");
    let matched = 0;
    for (let i = 0; i < 5; i++) {
      await expect(exercise.getByText(`Line ${i + 1} of 5`)).toBeVisible();
      await exercise.locator("ul button").first().click();
      if ((await exercise.getByRole("status").textContent()) === "Matched.") matched += 1;
      await exercise.getByRole("button", { name: i < 4 ? "Next line" : "See key points" }).click();
    }
    expect(matched).toBe(1);
    await expect(page.getByText(/1\/5 covered → suggested Again/)).toBeVisible();
  });

  test("pick cancels a correct point for each distractor picked", async ({ page }) => {
    await pinRandom(page, 0.75);
    await page.goto(card);
    const exercise = page.locator("[data-exercise]");
    await expect(page.getByTitle("How this card is testing you")).toHaveText("pick");
    await expect(exercise.getByRole("checkbox")).toHaveCount(8);
    // The wrong answers are the card's own distractors, not points from other cards.
    await expect(exercise.getByText(/A JWT payload is encrypted by default/)).toBeVisible();
    for (const box of await exercise.getByRole("checkbox").all()) await box.check();
    await exercise.getByRole("button", { name: "Check answers" }).click();
    await expect(exercise.getByText("A common mistake", { exact: true })).toHaveCount(3);
    // Each distractor says why it is wrong.
    await expect(exercise.getByText(/A standard JWT is signed, not encrypted/)).toBeVisible();
    await exercise.getByRole("button", { name: "See key points" }).click();
    await expect(page.getByText(/2\/5 covered → suggested Hard/)).toBeVisible();
  });
});

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

  test("dashboard shows progress from this browser and links to the card table", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
    await expect(page.getByText(/0 of \d+ started/)).toBeVisible();

    await page.goto("/study/estimation");
    await page.getByRole("button", { name: "Quick" }).click();
    await page.keyboard.press("Space");
    await page.keyboard.press("3");
    await expect(page.getByText("2/")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText(/1 of \d+ started/)).toBeVisible();
    await expect(page.getByText("1 review in all")).toBeVisible();
    await page.getByRole("link", { name: "My cards", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/cards$/);
    await expect(page.getByRole("heading", { name: "My cards" })).toBeVisible();
  });

  test("card permalink opens that card and the back button returns", async ({ page }) => {
    await page.goto("/dashboard/cards");
    await page.getByRole("link", { name: "Study url-shortener", exact: true }).click();
    await expect(page).toHaveURL(/\/study\/card\/url-shortener$/);
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toContainText(
      "URL shortener",
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard\/cards$/);

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

  test("theme choice survives a reload and stays local when signed out", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");

    const res = await page.request.get("/api/settings");
    expect(res.status()).toBe(401);
  });

  test("settings export produces a JSON file", async ({ page }) => {
    await page.goto("/settings");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^metastack-progress-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

test.describe("blog", () => {
  test("index lists categories, a category lists its posts, a post links back", async ({
    page,
  }) => {
    await page.goto("/blog");
    const cards = page.getByRole("main").getByRole("link", { name: /, \d+ posts?$/ });
    await expect(cards).not.toHaveCount(0);
    // The index is categories only: no post is linked from it.
    await expect(
      page
        .getByRole("main")
        .locator('a[href^="/blog/"]:not([href^="/blog/category/"]):not([href="/blog/recent"])'),
    ).toHaveCount(0);

    const first = cards.first();
    const label = (await first.getAttribute("aria-label"))!;
    const [name, count] = [label.split(", ")[0]!, Number(/(\d+) posts?$/.exec(label)![1])];
    await first.click();
    await expect(page).toHaveURL(/\/blog\/category\/[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    const posts = page.getByRole("main").getByRole("article");
    await expect(posts).toHaveCount(count);

    await posts.first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/blog\/[a-z0-9-]+$/);
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name }).click();
    await expect(page).toHaveURL(/\/blog\/category\/[a-z0-9-]+$/);
    await page.getByRole("link", { name: "All categories" }).click();
    await expect(page).toHaveURL(/\/blog$/);
  });

  test("an unknown category is not found", async ({ page }) => {
    const response = await page.goto("/blog/category/no-such-category");
    expect(response?.status()).toBe(404);
  });

  test("recent lists posts newest first", async ({ page }) => {
    await page.goto("/blog");
    await page.getByRole("main").getByRole("link", { name: "Recent posts" }).click();
    await expect(page).toHaveURL(/\/blog\/recent$/);
    await expect(page.getByRole("heading", { level: 1, name: "Recent posts" })).toBeVisible();
    const dates = page.getByRole("main").getByRole("article").locator("time");
    const values = await dates.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("datetime") ?? ""),
    );
    expect(values.length).toBeGreaterThan(0);
    const sorted = [...values].sort((a, b) => b.localeCompare(a));
    expect(values).toEqual(sorted);
  });
});
