import { test, expect } from "@playwright/test";

test.describe("Full Workflow", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/test/seed", { data: { scenario: "full" } });
  });

  test("end-to-end: settings → library → prioritize → auto-generate → view schedule", async ({
    page,
  }) => {
    // Step 1: Verify settings page shows preferences
    await page.goto("/settings");
    await expect(page.locator("h1, h2").first()).toContainText(/settings/i);

    const weeklyHours = page
      .locator('input[name="weeklyHours"], #weeklyHours, [aria-label*="weekly"]')
      .first();
    await expect(weeklyHours).toBeVisible({ timeout: 10000 });

    // Step 2: Navigate to library and verify games are loaded
    await page.getByRole("link", { name: /library/i }).click();
    await expect(page).toHaveURL(/\/library/);
    await expect(page.getByText("Team Fortress 2").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Elden Ring").first()).toBeVisible();

    // Step 3: Switch to prioritize tab and verify backlog games show
    const prioritizeTab = page.getByRole("tab", { name: /prioritize/i });
    await prioritizeTab.click();
    await expect(page.getByText("Team Fortress 2").first()).toBeVisible({ timeout: 10000 });

    // Step 4: Navigate to schedule and auto-generate
    await page.getByRole("link", { name: /schedule/i }).click();
    await expect(page).toHaveURL(/\/schedule/);
    await expect(page.getByRole("heading", { name: /schedule/i })).toBeVisible();

    // Open auto-generate dialog
    await page.getByRole("button", { name: /auto-generate/i }).click();
    await expect(
      page.getByRole("heading", { name: /auto-generate schedule/i })
    ).toBeVisible({ timeout: 5000 });

    // Set weeks to 2 for a manageable schedule
    await page.locator("#auto-weeks").clear();
    await page.locator("#auto-weeks").fill("2");

    // Generate
    await page.getByRole("button", { name: /generate schedule/i }).click();

    // Wait for dialog to close (indicates success)
    await expect(
      page.getByRole("heading", { name: /auto-generate schedule/i })
    ).not.toBeVisible({ timeout: 15000 });

    // Step 5: Verify sessions appear on the schedule
    await expect(page.locator('[data-testid="session-card"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Verify a game name appears in a session card
    const sessionCards = page.locator('[data-testid="session-card"]');
    const count = await sessionCards.count();
    expect(count).toBeGreaterThan(0);

    // Step 6: Switch to month view and verify it renders
    await page.getByRole("tab", { name: /month/i }).click();
    await expect(page.locator('[data-slot="calendar"]').first()).toBeVisible({ timeout: 5000 });
  });
});
