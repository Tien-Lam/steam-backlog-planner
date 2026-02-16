import { test, expect } from "@playwright/test";

test.describe("Dashboard Page", () => {
  test.describe("with library data", () => {
    test.beforeEach(async ({ request }) => {
      await request.post("/api/test/seed", { data: { scenario: "full" } });
    });

    test("displays welcome header with user name", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("Welcome back, E2E Tester")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Here's your gaming overview")).toBeVisible();
    });

    test("shows stat cards with game counts", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("Total Games")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Backlog")).toBeVisible();
      await expect(page.getByText("Playing")).toBeVisible();
      await expect(page.getByText("Completed")).toBeVisible();

      // All 5 seeded games are in backlog status — "5" should be visible on page
      await expect(page.getByText("5", { exact: true }).first()).toBeVisible();
    });

    test("shows total playtime card", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("Total Playtime")).toBeVisible({ timeout: 10000 });
    });

    test("shows achievement progress card", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("Achievement Progress")).toBeVisible({ timeout: 10000 });
    });

    test("shows empty sessions state when no sessions exist", async ({ page }) => {
      await page.goto("/");
      await expect(
        page.getByText("No upcoming sessions scheduled.")
      ).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Schedule some gaming time")).toBeVisible();
    });

    test("quick action buttons navigate to correct pages", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("View Library")).toBeVisible({ timeout: 10000 });

      await page.getByRole("link", { name: "View Library" }).click();
      await expect(page).toHaveURL(/\/library/);
      await page.goBack();

      await page.getByRole("link", { name: "View Schedule" }).click();
      await expect(page).toHaveURL(/\/schedule/);
      await page.goBack();

      await page.getByRole("link", { name: "View Statistics" }).click();
      await expect(page).toHaveURL(/\/statistics/);
    });

    test.skip(Boolean(process.env.CI), "shows upcoming sessions after auto-generate", async ({ page }) => {
      // First generate some sessions via schedule page
      await page.goto("/schedule");
      await page.getByRole("button", { name: /auto-generate/i }).click();
      await expect(
        page.getByRole("heading", { name: /auto-generate schedule/i })
      ).toBeVisible({ timeout: 5000 });
      await page.locator("#auto-weeks").clear();
      await page.locator("#auto-weeks").fill("1");
      await page.getByRole("button", { name: /generate schedule/i }).click();
      await expect(
        page.getByRole("heading", { name: /auto-generate schedule/i })
      ).not.toBeVisible({ timeout: 15000 });

      // Now go to dashboard and verify upcoming sessions
      await page.goto("/");
      await expect(page.getByText("Upcoming Sessions")).toBeVisible({
        timeout: 10000,
      });
      // Should no longer show the empty state
      await expect(
        page.getByText("No upcoming sessions scheduled.")
      ).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("with empty library", () => {
    test.beforeEach(async ({ request }) => {
      await request.post("/api/test/seed", { data: { scenario: "default" } });
    });

    test("shows empty library CTA", async ({ page }) => {
      await page.goto("/");
      await expect(
        page.getByText("Your library is empty. Sync your Steam games to get started!")
      ).toBeVisible({ timeout: 10000 });
    });

    test("empty library CTA navigates to library page", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("Go to Library")).toBeVisible({ timeout: 10000 });
      await page.getByRole("link", { name: "Go to Library" }).click();
      await expect(page).toHaveURL(/\/library/);
    });
  });
});
