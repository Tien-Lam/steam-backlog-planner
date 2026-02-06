import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ seedScenario: string }>({
  seedScenario: ["full", { option: true }],
});

export { expect };

export const TEST_USER_ID = "e2e-test-user";
