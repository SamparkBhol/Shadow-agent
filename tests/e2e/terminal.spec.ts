import { test, expect, type Page } from "@playwright/test";

async function dismissOnboarding(page: Page) {
  // Wait for the app to finish booting (terminal mounted) before handling the card.
  await page.locator('[aria-label="Shadow Agent terminal"]').waitFor({ state: "attached", timeout: 15000 });
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /skip/i }).click();
    await dialog.waitFor({ state: "detached" }).catch(() => {});
  }
}

async function runCommand(page: Page, command: string) {
  await page.keyboard.type(command);
  await page.keyboard.press("Enter");
  // give the store a tick to record and recompute
  await page.waitForTimeout(120);
}

test("learns a command sequence and predicts the next step", async ({ page }) => {
  await page.goto("/");
  await dismissOnboarding(page);

  await page.locator('[aria-label="Shadow Agent terminal"]').click();

  // Teach it one pass of the git loop.
  await runCommand(page, "git status");
  await runCommand(page, "git add .");
  await runCommand(page, 'git commit -m "work"');
  await runCommand(page, "git push");

  // Running status again should make the agent predict the next step.
  await runCommand(page, "git status");

  const topOption = page.getByRole("option").first();
  await expect(topOption).toContainText("git add", { timeout: 5000 });
});

test("remembers learned patterns across a reload", async ({ page }) => {
  await page.goto("/");
  await dismissOnboarding(page);
  await page.locator('[aria-label="Shadow Agent terminal"]').click();

  await runCommand(page, "npm install");
  await runCommand(page, "npm run dev");
  await runCommand(page, "npm install");
  await runCommand(page, "npm run dev");

  // Reload: the learned model is restored from IndexedDB, session history is fresh.
  await page.reload();
  await dismissOnboarding(page);
  await page.locator('[aria-label="Shadow Agent terminal"]').click();

  await runCommand(page, "npm install");
  await expect(page.getByRole("option").first()).toContainText("npm run dev", { timeout: 5000 });
});
