import { describe, expect, it } from "vitest";
import { briefSchema, siteSpecSchema } from "../shared/site-engine/architect";
import { defaultTheme, manualAIProvider } from "./ai-provider";
import { fingerprint, validateSiteSpecForBuild } from "./site-architect";

const idea = "Сайт для спокойной студии интерьеров, которая помогает частным клиентам оформить пространство.";

async function makeArtifacts() {
  const brief = await manualAIProvider.generateBrief(idea, "Atelier Studio");
  const confirmedBrief = briefSchema.parse(brief);
  const spec = await manualAIProvider.generateSiteSpec({
    idea,
    brief: confirmedBrief,
    projectName: "Atelier Studio",
    projectSlug: "atelier-studio",
    sourceBriefFingerprint: fingerprint(confirmedBrief),
  });
  return { brief: confirmedBrief, spec: siteSpecSchema.parse(spec) };
}

describe("Stage 3 IDEA → Brief → SiteSpec → Build Core", () => {
  it("manual fallback produces validated artifacts without provider-specific persistence", async () => {
    const { brief, spec } = await makeArtifacts();
    expect(brief.pages).toHaveLength(1);
    expect(spec.schemaVersion).toBe("1");
    expect(spec.theme).toEqual(defaultTheme);
    expect(spec.pages[0]?.sections[0]?.blocks.map((block) => block.type)).toEqual(["text", "text", "button"]);
  });

  it("deterministic Build validation accepts only Page → Section → Content Block", async () => {
    const { spec } = await makeArtifacts();
    const validated = validateSiteSpecForBuild(spec);
    expect(validated.pages[0]?.sections).toHaveLength(2);
    expect(validated.pages[0]?.sections.every((section) => section.type === "section")).toBe(true);
  });

  it("rejects a SiteSpec with duplicate page slugs or multiple home pages", async () => {
    const { spec } = await makeArtifacts();
    const duplicateSlug = { ...spec, pages: [spec.pages[0]!, { ...spec.pages[0]!, name: "Duplicate" }] };
    expect(() => siteSpecSchema.parse(duplicateSlug)).toThrow(/Duplicate page slug/);
    const multipleHome = { ...spec, pages: [{ ...spec.pages[0]!, slug: "second", isHome: true }, spec.pages[0]!] };
    expect(() => siteSpecSchema.parse(multipleHome)).toThrow(/exactly one home page/);
  });

  it("detects stale SiteSpec source after Brief changes", async () => {
    const { brief, spec } = await makeArtifacts();
    const changedBrief = { ...brief, valueProposition: "Изменённое предложение" };
    expect(fingerprint(changedBrief)).not.toBe(spec.sourceBriefFingerprint);
  });
});
