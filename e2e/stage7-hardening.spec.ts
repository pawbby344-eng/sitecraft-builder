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
    await expect(page.getByText("Published revision updated")).toBeVisible();
    await page.getByRole("button", { name: "Re-publish" }).click();
    await expect(page.getByText("Published revision updated")).toBeVisible();
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText("Public site unpublished")).toBeVisible();

    await page.reload();
    await expect(page.getByText(name).first()).toBeVisible();

    const secondTab = await context.newPage();
    await secondTab.goto("/");
    await expect(secondTab.getByText(name).first()).toBeVisible();
    await page.locator("main button").filter({ hasText: "heading" }).first().click();
    const firstEditor = page.locator("textarea").first();
    await firstEditor.fill("First tab saved content");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved")).toBeVisible();
    await secondTab.locator("main button").filter({ hasText: "heading" }).first().click();
    await secondTab.locator("textarea").first().fill("Stale second tab content");
    await secondTab.getByRole("button", { name: "Save draft" }).click();
    await expect(secondTab.getByText("Draft changed elsewhere. Reload before saving.")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await secondTab.close();
  });
});
