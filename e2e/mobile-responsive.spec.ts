import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("SiteCraft mobile responsive workspace", () => {
  test.skip(!process.env.E2E_STORAGE_STATE, "Provide E2E_STORAGE_STATE from an authenticated browser session");

  test("keeps workspace panes usable without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mobile-pane-editor").waitFor();
    await page.waitForFunction(() => {
      const heading = document.querySelector("main h1");
      return Boolean(heading && heading.textContent && heading.textContent !== "Загрузка проекта");
    });

    const widthAtEditor = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(widthAtEditor).toBe(true);
    await expect(page.getByTestId("mobile-workspace-editor")).toBeVisible();

    await page.getByTestId("mobile-pane-projects").click();
    await expect(page.getByTestId("mobile-workspace-projects")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const populatedProject = page.getByRole("button", { name: /Stage 7 Atelier/ });
    if (await populatedProject.count()) {
      await populatedProject.click();
      await expect(page.getByTestId("mobile-workspace-editor")).toBeVisible();
      await page.waitForFunction(() => {
        const heading = document.querySelector("main h1");
        return Boolean(heading && heading.textContent && heading.textContent !== "Загрузка проекта");
      });
      const firstBlock = page.locator("main button").filter({ hasText: /Заголовок|Основной текст|Изображение|Кнопка/ }).first();
      if (await firstBlock.count()) {
        await firstBlock.click();
        await expect(page.getByTestId("mobile-workspace-properties")).toBeVisible();
      }
    }

    await page.getByTestId("mobile-pane-properties").click();
    await expect(page.getByTestId("mobile-workspace-properties")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
