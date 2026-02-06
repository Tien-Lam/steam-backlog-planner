import { test, expect } from "@playwright/test";

test.describe("Settings Page", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/test/seed", { data: { scenario: "full" } });
  });

  test("displays current preferences", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h1, h2").first()).toContainText(/settings/i);

    const weeklyHours = page.locator('input[name="weeklyHours"], #weeklyHours, [aria-label*="weekly"]').first();
    await expect(weeklyHours).toBeVisible();
  });

  test("updates weekly hours", async ({ page }) => {
    await page.goto("/settings");

    const weeklyHours = page.locator('input[name="weeklyHours"], #weeklyHours, [aria-label*="weekly"]').first();
    await weeklyHours.clear();
    await weeklyHours.fill("15");

    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();

    await expect(page.getByText(/saved|success|updated/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows validation feedback for invalid weekly hours", async ({ page }) => {
    await page.goto("/settings");

    const weeklyHours = page.locator('input[name="weeklyHours"], #weeklyHours, [aria-label*="weekly"]').first();
    await weeklyHours.clear();
    await weeklyHours.fill("200");

    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();

    await expect(page.getByText(/error|invalid|must be/i)).toBeVisible({ timeout: 5000 });
  });

  test("timezone select is available", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/timezone/i).first()).toBeVisible();
  });
});
