import { describe, expect, it } from "vitest";
import { imageSourceSchema, sectionPropsSchema, textPropsSchema, themeSchema } from "../shared/site-engine/schemas";
import { renderSiteHtml } from "../shared/site-engine/renderer";

const theme = {
  typography: { fontFamily: "Inter", headingSize: 56, bodySize: 18, headingWeight: 700, lineHeight: 1.2 },
  colors: { background: "#f8f7f3", surface: "#ffffff", text: "#171717", muted: "#6f6b63", primary: "#171717", buttonText: "#ffffff" },
  spacing: { unit: 8, sectionGap: 48, blockGap: 20 },
  radius: { small: 8, medium: 16, large: 24 },
  contentWidth: 1120,
} as const;

const validImage = { src: "https://cdn.example.test/hero.webp", alt: "Hero", fit: "cover", radiusToken: "medium" };

function snapshotWith(blockProps: unknown, type: "image" | "text" = "image") {
  return {
    schemaVersion: "1",
    project: { id: 1, name: "Secure Site", projectSlug: "secure-site" },
    theme,
    pages: [{ id: 1, name: "Home", pageSlug: "home", purpose: null, isHome: true, blocks: [
      { id: 1, pageId: 1, parentBlockId: null, type: "section", sortOrder: 0, props: { layout: "stack", backgroundToken: "background", spacingToken: "section", contentWidthToken: "wide", align: "left" } },
      { id: 2, pageId: 1, parentBlockId: 1, type, sortOrder: 0, props: blockProps },
    ] }],
  };
}

describe("Pre-Migration hardening: URL and CSS contexts", () => {
  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
    "vbscript:msgbox(1)",
    "not a url",
    "https://",
    "<svg><script>alert(1)</script></svg>",
    "https://cdn.example.test/payload.svg",
  ])("rejects unsupported or malformed image source: %s", (src) => {
    expect(imageSourceSchema.safeParse(src).success).toBe(false);
    expect(() => renderSiteHtml(snapshotWith({ ...validImage, src }))).toThrow();
  });

  it.each(["https://cdn.example.test/hero.webp", "http://images.example.test/hero.jpg"])("accepts supported image source: %s", (src) => {
    expect(imageSourceSchema.safeParse(src).success).toBe(true);
    expect(() => renderSiteHtml(snapshotWith({ ...validImage, src }))).not.toThrow();
  });

  it.each([
    "Inter; color:red",
    "Arial\\\";background:url(javascript:alert(1))",
    "</style><script>alert(1)</script>",
  ])("rejects font/CSS injection payload: %s", (payload) => {
    expect(themeSchema.safeParse({ ...theme, typography: { ...theme.typography, fontFamily: payload } }).success).toBe(false);
  });

  it.each(["#fff; color:red", "red", "url(javascript:alert(1))", "</style><script>alert(1)</script>"])("rejects unsafe color override: %s", (payload) => {
    expect(sectionPropsSchema.safeParse({ layout: "stack", backgroundToken: "background", spacingToken: "section", contentWidthToken: "wide", align: "left", backgroundOverride: payload }).success).toBe(false);
    expect(textPropsSchema.safeParse({ content: "Safe", variant: "body", align: "left", colorOverride: payload }).success).toBe(false);
  });

  it("renders only tokenized font CSS and never interpolates the attacker font string", () => {
    const html = renderSiteHtml(snapshotWith({ content: "Safe", variant: "body", align: "left" }, "text"));
    expect(html).toContain("--sc-font:Inter");
    expect(html).toContain("font-family:var(--sc-font),system-ui,sans-serif");
    expect(html).not.toContain("javascript:");
  });
});
