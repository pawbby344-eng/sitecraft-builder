import { test, expect } from "@playwright/test";

const publishedSlug = "hardening-1787673283537";

async function auditDom(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const visibleControls = Array.from(document.querySelectorAll("button, a, input, textarea, select"))
      .filter(isVisible)
      .map((element) => ({
        tag: element.tagName,
        text: (element.textContent ?? "").trim(),
        aria: element.getAttribute("aria-label"),
        title: element.getAttribute("title"),
        role: element.getAttribute("role"),
      }));
    const unnamedControls = visibleControls.filter(({ tag, text, aria, title }) =>
      ["BUTTON", "A"].includes(tag) && !text && !aria && !title,
    );
    const imagesWithoutAlt = Array.from(document.querySelectorAll("img"))
      .filter(isVisible)
      .filter((image) => !image.hasAttribute("alt"))
      .map((image) => image.getAttribute("src"));
    const ids = Array.from(document.querySelectorAll("[id]"))
      .map((element) => element.id)
      .filter(Boolean);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    const active = document.activeElement;
    const activeRect = active instanceof HTMLElement ? active.getBoundingClientRect() : null;
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      unnamedControls,
      imagesWithoutAlt,
      duplicateIds,
      activeElement: active?.tagName ?? null,
      activeVisible: Boolean(activeRect && activeRect.width > 0 && activeRect.height > 0),
    };
  });
}

test.describe("SiteCraft comprehensive browser audit", () => {
  test.skip(!process.env.E2E_STORAGE_STATE, "Provide E2E_STORAGE_STATE from an authenticated browser session");

  test("desktop/mobile DOM accessibility and runtime surfaces stay clean", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "networkidle" });
      await expect(page.getByText("SiteCraft").first()).toBeVisible();
      const rootAudit = await auditDom(page);
      expect(rootAudit.overflow, `horizontal overflow at ${viewport.width}px`).toBe(false);
      expect(rootAudit.unnamedControls, JSON.stringify(rootAudit.unnamedControls)).toEqual([]);
      expect(rootAudit.imagesWithoutAlt, JSON.stringify(rootAudit.imagesWithoutAlt)).toEqual([]);
      expect(rootAudit.duplicateIds, JSON.stringify(rootAudit.duplicateIds)).toEqual([]);

      await page.keyboard.press("Tab");
      const focusedAudit = await auditDom(page);
      expect(focusedAudit.activeVisible, `first focus is not visible at ${viewport.width}px`).toBe(true);
    }

    const published = await page.goto(`/site/${publishedSlug}`, { waitUntil: "networkidle" });
    expect(published?.status()).toBe(200);
    const publicAudit = await auditDom(page);
    expect(publicAudit.overflow).toBe(false);
    expect(publicAudit.unnamedControls).toEqual([]);
    expect(publicAudit.imagesWithoutAlt).toEqual([]);
    expect(publicAudit.duplicateIds).toEqual([]);

    // The missing public route intentionally returns HTTP 404; Chromium reports that document status in console.
    consoleErrors.length = 0;
    pageErrors.length = 0;
    const missing = await page.goto("/site/sitecraft-ui-missing", { waitUntil: "networkidle" });
    expect(missing?.status()).toBe(404);
    expect((await auditDom(page)).overflow).toBe(false);

    consoleErrors.length = 0;
    pageErrors.length = 0;
    await page.goto("/404", { waitUntil: "networkidle" });
    const notFoundAudit = await auditDom(page);
    expect(notFoundAudit.overflow).toBe(false);
    expect(notFoundAudit.unnamedControls).toEqual([]);
    expect(notFoundAudit.duplicateIds).toEqual([]);
    expect(consoleErrors, JSON.stringify(consoleErrors)).toEqual([]);
    expect(pageErrors, JSON.stringify(pageErrors)).toEqual([]);
  });
});

