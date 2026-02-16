import { test, expect } from "@playwright/test";

test.describe("Schedule Page", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/test/seed", { data: { scenario: "full" } });
  });

  test("displays schedule heading and action buttons", async ({ page }) => {
    await page.goto("/schedule");

    await expect(page.getByRole("heading", { name: /schedule/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /auto-generate/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /new session/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /export ical/i })).toBeVisible();
  });

  test("week and month tabs are functional", async ({ page }) => {
    await page.goto("/schedule");

    const weekTab = page.getByRole("tab", { name: /week/i });
    const monthTab = page.getByRole("tab", { name: /month/i });
    await expect(weekTab).toBeVisible();
    await expect(monthTab).toBeVisible();

    // Switch to month view — calendar renders with data-slot="calendar"
    await monthTab.click();
    await expect(page.locator('[data-slot="calendar"]').first()).toBeVisible({ timeout: 5000 });

    // Switch back to week view
    await weekTab.click();
    await expect(page.getByRole("button", { name: "← Prev" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next →" })).toBeVisible();
  });

  test("week navigation changes date range", async ({ page }) => {
    await page.goto("/schedule");

    // The date range is between Prev and Next buttons
    const prevBtn = page.getByRole("button", { name: "← Prev" });
    const nextBtn = page.getByRole("button", { name: "Next →" });
    await expect(prevBtn).toBeVisible();

    // Capture page content snapshot
    const initialContent = await page.textContent("body");

    // Click next to advance one week
    await nextBtn.click();
    await page.waitForTimeout(500);
    const nextContent = await page.textContent("body");
    expect(nextContent).not.toBe(initialContent);

    // Click prev twice to go back before initial
    await prevBtn.click();
    await prevBtn.click();
    await page.waitForTimeout(500);
    const prevContent = await page.textContent("body");
    expect(prevContent).not.toBe(nextContent);
  });

  test("opens and submits auto-generate dialog", async ({ page }) => {
    await page.goto("/schedule");

    await page.getByRole("button", { name: /auto-generate/i }).click();

    // Dialog should open
    await expect(page.getByRole("heading", { name: /auto-generate schedule/i })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("#auto-start-date")).toBeVisible();
    await expect(page.locator("#auto-weeks")).toBeVisible();

    // Set weeks to 2 for faster generation
    await page.locator("#auto-weeks").clear();
    await page.locator("#auto-weeks").fill("2");

    // Submit
    await page.getByRole("button", { name: /generate schedule/i }).click();

    // Dialog should close after success
    await expect(page.getByRole("heading", { name: /auto-generate schedule/i })).not.toBeVisible({
      timeout: 15000,
    });

    // Session cards should now be visible
    await expect(page.locator('[data-testid="session-card"]').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("opens new session dialog with game select", async ({ page }) => {
    await page.goto("/schedule");

    await page.getByRole("button", { name: /new session/i }).click();

    // Dialog heading (not the button)
    await expect(page.getByRole("heading", { name: /new session/i })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Select a game")).toBeVisible();
    await expect(page.locator("#session-date")).toBeVisible();
    await expect(page.locator("#session-start")).toBeVisible();
    await expect(page.locator("#session-end")).toBeVisible();
  });

  test("creates a manual session", async ({ page }) => {
    await page.goto("/schedule");

    await page.getByRole("button", { name: /new session/i }).click();
    await expect(page.getByRole("heading", { name: /new session/i })).toBeVisible({
      timeout: 5000,
    });

    // Select a game from the dropdown
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: /team fortress 2/i }).click();

    // Set a date (today)
    const today = new Date().toISOString().split("T")[0];
    await page.locator("#session-date").fill(today);
    await page.locator("#session-start").fill("19:00");
    await page.locator("#session-end").fill("20:00");

    // Add notes
    await page.locator("#session-notes").fill("Test session");

    // Submit
    await page.getByRole("button", { name: /create/i }).click();

    // Dialog should close
    await expect(page.getByRole("heading", { name: /new session/i })).not.toBeVisible({
      timeout: 10000,
    });
  });

  test("iCal export link points to correct endpoint", async ({ page }) => {
    await page.goto("/schedule");

    const exportLink = page.getByRole("link", { name: /export ical/i });
    await expect(exportLink).toHaveAttribute("href", "/api/calendar/export.ics");
    await expect(exportLink).toHaveAttribute("download", "");
  });

  test.skip(Boolean(process.env.CI), "session card shows edit and delete buttons after auto-generate", async ({ page }) => {
    await page.goto("/schedule");

    // Auto-generate sessions
    await page.getByRole("button", { name: /auto-generate/i }).click();
    await expect(page.getByRole("heading", { name: /auto-generate schedule/i })).toBeVisible({
      timeout: 5000,
    });

    await page.locator("#auto-weeks").clear();
    await page.locator("#auto-weeks").fill("2");

    await page.getByRole("button", { name: /generate schedule/i }).click();

    // Wait for session cards to appear as proof of successful generation
    const sessionCard = page.locator('[data-testid="session-card"]').first();
    await expect(sessionCard).toBeVisible({ timeout: 15000 });

    // Dialog should have closed by now
    await expect(page.getByRole("heading", { name: /auto-generate schedule/i })).not.toBeVisible();

    // Session card should have action buttons
    await expect(sessionCard.getByRole("button", { name: /complete/i })).toBeVisible();
    await expect(sessionCard.getByRole("button", { name: /edit/i })).toBeVisible();
    await expect(sessionCard.getByRole("button", { name: /delete/i })).toBeVisible();
  });
});
