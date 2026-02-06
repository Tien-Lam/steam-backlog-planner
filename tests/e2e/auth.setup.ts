import { test as setup, expect } from "@playwright/test";

const TEST_USER_ID = "e2e-test-user";

setup("seed test user and authenticate", async ({ request }) => {
  // Seed test user via API
  const seedRes = await request.post("/api/test/seed", {
    data: { scenario: "full" },
  });
  expect(seedRes.ok()).toBeTruthy();

  // Login via test-only credentials provider
  const csrfRes = await request.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();

  const loginRes = await request.post("/api/auth/callback/test-login", {
    form: {
      csrfToken,
      userId: TEST_USER_ID,
    },
  });
  expect(loginRes.ok() || loginRes.status() === 302).toBeTruthy();

  // Save auth state
  await request.storageState({ path: "tests/e2e/.auth/user.json" });
});
