import { test, expect, type Page } from "@playwright/test";

// This file runs under the chromium-no-webgpu project. Without WebGPU the
// embedding model uses the WASM backend, but instant sequence predictions must
// keep working regardless of the embedding backend.
async function dismissOnboarding(page: Page) {
  // Wait for the app to finish booting (terminal mounted) before handling the card.
  await page.locator('[aria-label="Shadow Agent terminal"]').waitFor({ state: "attached", timeout: 15000 });
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /skip/i }).click();
    await dialog.waitFor({ state: "detached" }).catch(() => {});
  }
}

test("sequence predictions work without WebGPU", async ({ page }) => {
  await page.goto("/");
  await dismissOnboarding(page);
  await page.locator('[aria-label="Shadow Agent terminal"]').click();

  for (const cmd of ["git status", "git add .", 'git commit -m "x"', "git status"]) {
    await page.keyboard.type(cmd);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }

  await expect(page.getByRole("option").first()).toContainText("git add", { timeout: 5000 });

  // The backend indicator must never claim GPU acceleration here.
  await expect(page.getByText(/on-device · GPU/i)).toHaveCount(0);
});
