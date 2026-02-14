import { test, expect } from "@playwright/test";

test.describe("Navigation - Responsive", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/test/seed", { data: { scenario: "with-library" } });
  });

  test.describe("desktop viewport", () => {
    test("shows desktop nav bar with all links", async ({ page }) => {
      await page.goto("/");

      const desktopNav = page.locator('[data-testid="desktop-nav"]');
      await expect(desktopNav).toBeVisible({ timeout: 10000 });

      await expect(desktopNav.getByText("SBP")).toBeVisible();
      await expect(desktopNav.getByText("Dashboard")).toBeVisible();
      await expect(desktopNav.getByText("Library")).toBeVisible();
      await expect(desktopNav.getByText("Schedule")).toBeVisible();
      await expect(desktopNav.getByText("Statistics")).toBeVisible();
      await expect(desktopNav.getByText("Settings")).toBeVisible();
    });

    test("hides mobile bottom nav on desktop", async ({ page }) => {
      await page.goto("/");
      // Wait for page to fully render
      await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible({
        timeout: 10000,
      });

      const mobileNav = page.locator('[data-testid="mobile-bottom-nav"]');
      await expect(mobileNav).not.toBeVisible();
    });

    test("desktop nav links navigate correctly", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator('[data-testid="desktop-nav"]')).toBeVisible({
        timeout: 10000,
      });

      await page.locator('[data-testid="desktop-nav"]').getByText("Library").click();
      await expect(page).toHaveURL(/\/library/);

      await page.locator('[data-testid="desktop-nav"]').getByText("Schedule").click();
      await expect(page).toHaveURL(/\/schedule/);

      await page.locator('[data-testid="desktop-nav"]').getByText("Dashboard").click();
      await expect(page).toHaveURL("/");
    });
  });

  test.describe("mobile viewport", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("shows mobile bottom nav and top bar", async ({ page }) => {
      await page.goto("/");

      const mobileTopBar = page.locator('[data-testid="mobile-top-bar"]');
      await expect(mobileTopBar).toBeVisible({ timeout: 10000 });
      await expect(mobileTopBar.getByText("SBP")).toBeVisible();

      const mobileNav = page.locator('[data-testid="mobile-bottom-nav"]');
      await expect(mobileNav).toBeVisible();
      await expect(mobileNav.getByText("Dashboard")).toBeVisible();
      await expect(mobileNav.getByText("Library")).toBeVisible();
      await expect(mobileNav.getByText("Schedule")).toBeVisible();
      await expect(mobileNav.getByText("Statistics")).toBeVisible();
      await expect(mobileNav.getByText("Settings")).toBeVisible();
    });

    test("hides desktop nav on mobile", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator('[data-testid="mobile-top-bar"]')).toBeVisible({
        timeout: 10000,
      });

      const desktopNav = page.locator('[data-testid="desktop-nav"]');
      await expect(desktopNav).not.toBeVisible();
    });

    test("mobile bottom nav links navigate correctly", async ({ page }) => {
      await page.goto("/");
      const mobileNav = page.locator('[data-testid="mobile-bottom-nav"]');
      await expect(mobileNav).toBeVisible({ timeout: 10000 });

      await mobileNav.getByText("Library").click();
      await expect(page).toHaveURL(/\/library/);

      await mobileNav.getByText("Schedule").click();
      await expect(page).toHaveURL(/\/schedule/);

      await mobileNav.getByText("Statistics").click();
      await expect(page).toHaveURL(/\/statistics/);

      await mobileNav.getByText("Settings").click();
      await expect(page).toHaveURL(/\/settings/);

      // Navigate back to dashboard via the link href directly
      // (Next.js dev overlay can intercept bottom-positioned clicks)
      const dashboardLink = mobileNav.locator('a[href="/"]');
      await dashboardLink.evaluate((el) => (el as HTMLAnchorElement).click());
      await expect(page).toHaveURL("/");
    });

    test("content is not hidden behind bottom nav", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator('[data-testid="mobile-bottom-nav"]')).toBeVisible({
        timeout: 10000,
      });

      // Quick action buttons at the bottom of dashboard should be scrollable into view
      const viewLibrary = page.getByRole("link", { name: "View Library" });
      await viewLibrary.scrollIntoViewIfNeeded();
      await expect(viewLibrary).toBeVisible();
    });
  });
});
