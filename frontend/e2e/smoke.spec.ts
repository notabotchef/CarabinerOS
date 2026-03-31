import { test, expect } from "@playwright/test";

/**
 * Smoke tests — verify the main layout renders correctly at app startup.
 *
 * These tests assume the full stack is running at http://localhost:8080.
 * They DO NOT test functionality — only that key structural elements are
 * present and visible.
 */
test.describe("App smoke tests", () => {
  test("loads the app and renders the main layout", async ({ page }) => {
    await page.goto("/");

    // The page should respond with 200 — if nginx/next is broken this fails
    const response = await page.waitForResponse((resp) => resp.url().includes("/") && resp.status() === 200);
    expect(response.status()).toBe(200);
  });

  test("renders the sidebar navigation", async ({ page }) => {
    await page.goto("/");

    // Wait for the sidebar to appear — it's a landmark nav element
    // The app-sidebar component renders an aside or nav element
    await expect(page.locator("aside, nav").first()).toBeVisible({ timeout: 15000 });
  });

  test("renders the top bar", async ({ page }) => {
    await page.goto("/");

    // The top-bar.tsx renders a header element with connection status and controls
    await expect(page.locator("header").first()).toBeVisible({ timeout: 15000 });
  });

  test("page title is set", async ({ page }) => {
    await page.goto("/");
    // Wait for page to fully load
    await page.waitForLoadState("networkidle");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
