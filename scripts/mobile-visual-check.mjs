import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.E2E_CHROMIUM_PATH ?? "/usr/bin/chromium",
});
const context = await browser.newContext({
  storageState: process.env.E2E_STORAGE_STATE,
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
await page.goto(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000/");
await page.getByTestId("mobile-pane-editor").waitFor();
await page.waitForFunction(() => {
  const heading = document.querySelector("main h1");
  return Boolean(heading && heading.textContent && heading.textContent !== "Loading project");
});
await page.screenshot({ path: "/tmp/sitecraft-mobile-editor.png", fullPage: true });
await page.getByTestId("mobile-pane-projects").click();
await page.getByTestId("mobile-workspace-projects").waitFor();
await page.screenshot({ path: "/tmp/sitecraft-mobile-projects.png", fullPage: true });
const populatedProject = page.getByRole("button", { name: /Stage 7 Atelier/ });
if (await populatedProject.count()) {
  await populatedProject.click();
  await page.getByTestId("mobile-pane-editor").click();
  await page.waitForFunction(() => {
    const heading = document.querySelector("main h1");
    return Boolean(heading && heading.textContent && heading.textContent !== "Loading project");
  });
  await page.screenshot({ path: "/tmp/sitecraft-mobile-populated-editor.png", fullPage: true });
  const firstBlock = page.locator("main button").filter({ hasText: /heading|body|Image|Button/ }).first();
  if (await firstBlock.count()) {
    await firstBlock.click();
    await page.getByTestId("mobile-workspace-properties").waitFor();
    await page.screenshot({ path: "/tmp/sitecraft-mobile-populated-properties.png", fullPage: true });
  }
}
await page.getByTestId("mobile-pane-properties").click();
await page.getByTestId("mobile-workspace-properties").waitFor();
await page.screenshot({ path: "/tmp/sitecraft-mobile-properties.png", fullPage: true });
console.log(JSON.stringify({
  editor: await page.getByTestId("mobile-workspace-editor").isVisible(),
  projects: await page.getByTestId("mobile-workspace-projects").isVisible(),
  properties: await page.getByTestId("mobile-workspace-properties").isVisible(),
}));
await browser.close();
