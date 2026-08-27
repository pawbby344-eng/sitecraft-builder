import { test, expect } from "@playwright/test";

const stamp = `e2e-${Date.now()}`;

test.describe("SiteCraft pre-migration hardening production flow", () => {
  test.skip(!process.env.E2E_STORAGE_STATE, "Provide E2E_STORAGE_STATE from an authenticated browser session");

  test("Create → Build → AI → Preview → Publish → Re-publish → Unpublish", async ({ page, context }) => {
    const name = `Hardening ${stamp}`;
    const slug = `hardening-${Date.now()}`;
    await page.goto("/");
    await expect(page.getByText("SiteCraft").first()).toBeVisible();
    const createButton = page.getByRole("button", { name: "Создать новый проект" });
    if (await createButton.count()) await createButton.click();
    await page.getByTestId("create-project-name").fill(name);
    await page.getByTestId("create-project-slug").fill(slug);
    await page.getByTestId("create-project-idea").fill("A calm portfolio site for an independent architecture studio.");
    await page.getByTestId("create-project-submit").click();
    await expect(page.getByText("Проверьте Brief")).toBeVisible();
    await page.getByTestId("brief-value").fill("Clear, direct presentation of selected architecture work.");
    await page.getByTestId("confirm-brief").click();
    await expect(page.getByText("Подтвердите SiteSpec")).toBeVisible();
    await page.getByTestId("confirm-sitespec-build").click();
    await expect(page.getByText(name).first()).toBeVisible();

    await page.locator('[data-testid^="canvas-block-"][data-block-type="text"]').first().click();
    await page.getByPlaceholder("Сделайте заголовок точнее").fill("Сделайте заголовок точнее");
    await page.getByRole("button", { name: "Создать предложение AI" }).click();
    await expect(page.getByText("Предложение готово к проверке")).toBeVisible();
    await expect(page.getByRole("button", { name: "Применить" })).toBeVisible();
    await page.getByRole("button", { name: "Применить" }).click();
    await expect(page.getByText("Предложение применено")).toBeVisible();

    await page.getByRole("button", { name: "Предпросмотр" }).click();
    await expect(page.getByText("Предпросмотр черновика")).toBeVisible();
    await page.getByRole("button", { name: "Предпросмотр: Мобильный" }).click();
    await page.getByRole("button", { name: "Редактор" }).click();
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByRole("button", { name: "Опубликовать заново" })).toBeVisible();
    const publicPath = await page.locator('a[href^="/site/"]').getAttribute("href");
    expect(publicPath).toMatch(/^\/site\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
    const republishStatus = page.waitForResponse((response) => response.url().includes("publish.status") && response.status() === 200);
    await page.getByRole("button", { name: "Опубликовать заново" }).click();
    await republishStatus;
    await expect(page.getByRole("button", { name: "Опубликовать заново" })).toBeVisible();
    await page.getByRole("button", { name: "Снять с публикации" }).click();
    await expect(page.getByRole("button", { name: "Опубликовать", exact: true })).toBeVisible();
    expect(publicPath).toBeTruthy();
    const publicResponse = await page.request.get(new URL(publicPath!, page.url()).toString());
    expect(publicResponse.status()).toBe(404);

    await page.reload();
    await expect(page.getByText(name).first()).toBeVisible();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.locator('[data-testid^="canvas-block-"][data-block-type="text"]').first()).toBeVisible();

    const secondTab = await context.newPage();
    await secondTab.goto("/");
    await expect(secondTab.getByText(name).first()).toBeVisible();
    await secondTab.getByRole("button", { name: new RegExp(name) }).click();
    const firstHeading = page.locator('[data-testid^="canvas-block-"][data-block-type="text"]').first();
    await expect(firstHeading).toBeVisible();
    await firstHeading.click();
    await page.getByTestId("property-content").fill("First tab saved content");
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(page.locator("main button").filter({ hasText: "First tab saved content" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Сохранить черновик" })).toBeDisabled();
    const secondHeading = secondTab.locator('[data-testid^="canvas-block-"][data-block-type="text"]').first();
    await expect(secondHeading).toBeVisible();
    await secondHeading.click();
    await secondTab.getByTestId("property-content").fill("Stale second tab content");
    await secondTab.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(secondTab.getByText("Черновик изменён в другом окне. Перезагрузите страницу перед сохранением.")).toBeVisible();

    await expect(secondTab.getByText("Визуальный редактор")).toBeVisible();
    await secondTab.close();
  });
});
