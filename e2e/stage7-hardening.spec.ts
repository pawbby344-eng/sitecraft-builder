import { test, expect } from "@playwright/test";

const stamp = `e2e-${Date.now()}`;

test.describe("SiteCraft pre-migration hardening production flow", () => {
  test.skip(!process.env.E2E_STORAGE_STATE, "Provide E2E_STORAGE_STATE from an authenticated browser session");

  test("Create → Build → AI → Preview → Publish → Re-publish → Unpublish", async ({ page, context }) => {
    const name = `Hardening ${stamp}`;
    const slug = `hardening-${Date.now()}`;
    await page.goto("/");
    await expect(page.getByText("SiteCraft").first()).toBeVisible();
    const createButton = page.getByRole("button", { name: "Create new project" });
    if (await createButton.count()) await createButton.click();
    await page.getByTestId("create-project-name").fill(name);
    await page.getByTestId("create-project-slug").fill(slug);
    await page.getByTestId("create-project-idea").fill("A calm portfolio site for an independent architecture studio.");
    await page.getByTestId("create-project-submit").click();
    await expect(page.getByText("Review the Brief")).toBeVisible();
    await page.getByTestId("brief-value").fill("Clear, direct presentation of selected architecture work.");
    await page.getByTestId("confirm-brief").click();
    await expect(page.getByText("Confirm the SiteSpec")).toBeVisible();
    await page.getByTestId("confirm-sitespec-build").click();
    await expect(page.getByText(name).first()).toBeVisible();

    await page.locator("main button").filter({ hasText: "heading" }).first().click();
    await page.getByPlaceholder("Make the headline more direct").fill("Make the headline more direct");
    await page.getByRole("button", { name: "Ask AI" }).click();
    await expect(page.getByText("Proposal ready for review")).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Proposal applied")).toBeVisible();

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Draft Preview")).toBeVisible();
    await page.getByRole("button", { name: "mobile preview" }).click();
    await page.getByRole("button", { name: "Editor" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("button", { name: "Re-publish" })).toBeVisible();
    const publicPath = await page.locator('a[href^="/site/"]').getAttribute("href");
    expect(publicPath).toMatch(/^\/site\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
    const republishStatus = page.waitForResponse((response) => response.url().includes("publish.status") && response.status() === 200);
    await page.getByRole("button", { name: "Re-publish" }).click();
    await republishStatus;
    await expect(page.getByRole("button", { name: "Re-publish" })).toBeVisible();
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeVisible();
    expect(publicPath).toBeTruthy();
    const publicResponse = await page.request.get(new URL(publicPath!, page.url()).toString());
    expect(publicResponse.status()).toBe(404);

    await page.reload();
    await expect(page.getByText(name).first()).toBeVisible();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.locator("main button").filter({ hasText: "heading" }).first()).toBeVisible();

    const secondTab = await context.newPage();
    await secondTab.goto("/");
    await expect(secondTab.getByText(name).first()).toBeVisible();
    await secondTab.getByRole("button", { name: new RegExp(name) }).click();
    const firstHeading = page.locator("main button").filter({ hasText: "heading" }).first();
    await expect(firstHeading).toBeVisible();
    await firstHeading.click();
    await page.getByLabel("Content").fill("First tab saved content");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.locator("main button").filter({ hasText: "First tab saved content" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
    const secondHeading = secondTab.locator("main button").filter({ hasText: "heading" }).first();
    await expect(secondHeading).toBeVisible();
    await secondHeading.click();
    await secondTab.getByLabel("Content").fill("Stale second tab content");
    await secondTab.getByRole("button", { name: "Save draft" }).click();
    await expect(secondTab.getByText("Draft changed elsewhere. Reload before saving.")).toBeVisible();

    await expect(secondTab.getByText("Visual editor")).toBeVisible();
    await secondTab.close();
  });
});
