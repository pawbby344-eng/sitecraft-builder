import { test, expect } from "@playwright/test";

const publishedSlug = "hardening-1787673283537";

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function assertVisibleTouchTargets(page: import("@playwright/test").Page) {
  const undersized = await page.locator("button:visible, input:visible, select:visible, textarea:visible, a:visible").evaluateAll((elements) => elements
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return { tag: element.tagName, text: (element.textContent || "").trim().slice(0, 40), aria: element.getAttribute("aria-label"), slot: element.getAttribute("data-slot"), width: rect.width, height: rect.height, opacity: Number(style.opacity), visibility: style.visibility };
    })
    .filter(({ width, height, opacity, visibility }) => width > 0 && opacity > 0.01 && visibility !== "hidden" && (width < 44 || height < 44)));
  expect(undersized, JSON.stringify(undersized)).toEqual([]);
}

test.describe("SiteCraft final UI verification", () => {
  test.skip(!process.env.E2E_STORAGE_STATE, "Provide E2E_STORAGE_STATE from an authenticated browser session");

  test("desktop workspace and mobile panes keep controls visible and contained", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("SiteCraft").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Сохранить черновик" })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByTestId("mobile-pane-editor")).toBeVisible();
    await expect(page.getByTestId("mobile-workspace-editor")).toBeVisible();
    await expect(page.getByTestId("editor-content-state")).toHaveAttribute("class", /animate-in/);
    await assertNoHorizontalOverflow(page);
    await assertVisibleTouchTargets(page);

    await page.getByTestId("mobile-pane-projects").click();
    await expect(page.getByTestId("mobile-workspace-projects")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertVisibleTouchTargets(page);

    const populatedProject = page.getByRole("button", { name: /Stage 7 Atelier/ });
    await expect(populatedProject).toBeVisible();
    await populatedProject.click();
    await expect(page.getByTestId("mobile-workspace-editor")).toBeVisible();
    const firstBlock = page.locator('[data-testid^="canvas-block-"][data-block-type="text"]').first();
    await expect(firstBlock).toBeVisible();
    await firstBlock.click();
    await expect(page.getByTestId("mobile-workspace-properties")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertVisibleTouchTargets(page);

    await page.getByTestId("mobile-pane-properties").focus();
    await expect(page.getByTestId("mobile-pane-properties")).toBeFocused();
    await page.getByTestId("mobile-pane-properties").click();
    await expect(page.getByText("Локальное редактирование с AI")).toBeVisible();
    await expect(page.getByRole("button", { name: "Создать предложение AI" })).toHaveAttribute("title", /Создать предложение AI/);
    await expect(page.getByRole("button", { name: /Заблокировать область|Разблокировать область/ })).toHaveAttribute("title", /област/);
    await expect(page.getByRole("button", { name: "Опубликовать", exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertVisibleTouchTargets(page);
  });

  test("published and fallback pages render intentional contained states", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const published = await page.goto(`/site/${publishedSlug}`);
    expect(published?.status()).toBe(200);
    await expect(page.locator('[data-renderer="sitecraft"]')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const missing = await page.goto("/site/sitecraft-ui-missing");
    expect(missing?.status()).toBe(404);
    await expect(page.getByText("Этот сайт недоступен")).toBeVisible();
    await expect(page.getByRole("link", { name: "Вернуться в SiteCraft" })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto("/404");
    await expect(page.getByText("Рабочая область SiteCraft")).toBeVisible();
    await expect(page.getByRole("button", { name: "На главную" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertVisibleTouchTargets(page);
  });
});
