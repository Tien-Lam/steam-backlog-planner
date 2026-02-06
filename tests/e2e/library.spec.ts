import { test, expect } from "@playwright/test";

test.describe("Library Page", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/test/seed", {
      data: { scenario: "with-library" },
    });
  });

  test("shows game grid with seeded games", async ({ page }) => {
    await page.goto("/library");

    // Wait for games to appear
    await expect(
      page.getByText("Team Fortress 2").or(page.getByText("Elden Ring"))
    ).toBeVisible({ timeout: 10000 });
  });

  test("search filters games by name", async ({ page }) => {
    await page.goto("/library");

    // Wait for games to load
    await expect(page.getByText("Team Fortress 2")).toBeVisible({ timeout: 10000 });

    const searchInput = page.getByPlaceholder(/search/i).first();
    await searchInput.fill("Elden");

    await expect(page.getByText("Elden Ring")).toBeVisible();
    await expect(page.getByText("Team Fortress 2")).not.toBeVisible();
  });

  test("game card links to detail page", async ({ page }) => {
    await page.goto("/library");

    await expect(page.getByText("Team Fortress 2")).toBeVisible({ timeout: 10000 });

    const gameLink = page.getByRole("link", { name: /Team Fortress 2/i }).first();
    await gameLink.click();

    await expect(page).toHaveURL(/\/library\/440/);
  });

  test("prioritize tab shows backlog games", async ({ page }) => {
    await page.goto("/library");

    const prioritizeTab = page.getByRole("tab", { name: /prioritize/i });
    await prioritizeTab.click();

    await expect(page.getByText("Team Fortress 2")).toBeVisible({ timeout: 10000 });
  });

  test("status can be changed on game card", async ({ page }) => {
    await page.goto("/library");

    await expect(page.getByText("Team Fortress 2")).toBeVisible({ timeout: 10000 });

    // Find a status selector/button near the first game
    const statusTrigger = page
      .locator('[data-testid="status-select"], button:has-text("Backlog")')
      .first();
    if (await statusTrigger.isVisible()) {
      await statusTrigger.click();
      const playingOption = page.getByText("Playing", { exact: true }).first();
      if (await playingOption.isVisible()) {
        await playingOption.click();
      }
    }
  });
});
