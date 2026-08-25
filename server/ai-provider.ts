import { briefSchema, siteSpecSchema, type Brief, type SiteSpec } from "../shared/site-engine/architect";
import { themeSchema, blockPropsByType } from "../shared/site-engine/schemas";
import { proposalSchema, type EditProposal, type EditScopeType } from "../shared/site-engine/ai-edit";

export type AIProvider = {
  generateBrief(inputText: string, projectName: string): Promise<Brief>;
  generateSiteSpec(input: { idea: string; brief: Brief; projectName: string; projectSlug: string; sourceBriefFingerprint: string }): Promise<SiteSpec>;
  proposeEdit(input: { scopeType: EditScopeType; scopeId: number | null; instruction: string; baseDraftRevision: number; baseFingerprint: string; context: { blocks: Array<{ id: number; pageId: number; parentBlockId: number | null; type: "section" | "text" | "image" | "button"; props: unknown }>; theme: unknown } }): Promise<EditProposal>;
};

export const defaultTheme = themeSchema.parse({
  typography: { fontFamily: "Inter", headingSize: 56, bodySize: 18, headingWeight: 700, lineHeight: 1.35 },
  colors: { background: "#f8f7f3", surface: "#ffffff", text: "#171717", muted: "#6f6b63", primary: "#171717", buttonText: "#ffffff" },
  spacing: { unit: 4, sectionGap: 72, blockGap: 20 },
  radius: { small: 8, medium: 16, large: 28 },
  contentWidth: 1120,
});

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 255) || "Untitled Site";
}

/**
 * Provider boundary. The fallback is deterministic and produces validated artifacts,
 * but never writes to projects/pages/pageBlocks/theme itself.
 */
export const manualAIProvider: AIProvider = {
  async generateBrief(inputText, projectName) {
    const idea = inputText.trim();
    const brief = {
      audience: "Люди, которым нужен понятный и выразительный цифровой продукт",
      valueProposition: idea.slice(0, 1000) || `Сайт для ${cleanName(projectName)}`,
      tone: "calm" as const,
      primaryGoal: "contact" as const,
      pages: [{ name: "Главная", slug: "home", purpose: "Познакомить посетителя с предложением и привести к целевому действию" }],
    };
    return briefSchema.parse(brief);
  },

  async proposeEdit({ scopeType, scopeId, instruction, baseDraftRevision, baseFingerprint, context }) {
    const target = scopeId === null ? undefined : context.blocks.find((block) => block.id === scopeId);
    const changes = scopeType === "theme"
      ? [{ kind: "theme" as const, props: { ...defaultTheme, colors: { ...defaultTheme.colors, primary: "#334155" } } }]
      : target
        ? [{ kind: "blockProps" as const, pageId: target.pageId, blockId: target.id, blockType: target.type, props: proposeBlockProps(target.type, target.props, instruction) }]
        : context.blocks.filter((block) => scopeType === "page" || block.parentBlockId === scopeId).slice(0, 1).map((block) => ({ kind: "blockProps" as const, pageId: block.pageId, blockId: block.id, blockType: block.type, props: proposeBlockProps(block.type, block.props, instruction) }));
    return proposalSchema.parse({ schemaVersion: "1", scopeType, scopeId, baseDraftRevision, baseFingerprint, instruction, summary: `Manual proposal for ${scopeType}`, changes });
  },

  async generateSiteSpec({ idea, brief, projectName, projectSlug, sourceBriefFingerprint }) {
    const page = brief.pages[0] ?? { name: "Главная", slug: "home", purpose: "Основная страница" };
    const spec = {
      schemaVersion: "1" as const,
      projectName: cleanName(projectName),
      projectSlug,
      sourceBriefFingerprint,
      theme: defaultTheme,
      pages: [{
        name: page.name,
        slug: page.slug,
        purpose: page.purpose,
        isHome: true,
        sections: [
          {
            type: "section" as const,
            props: { layout: "centered" as const, backgroundToken: "background", spacingToken: "section", contentWidthToken: "wide", align: "center" as const },
            blocks: [
              { type: "text" as const, props: { content: brief.valueProposition || idea, variant: "heading" as const, align: "center" as const, typographyToken: "display" } },
              { type: "text" as const, props: { content: `${brief.audience}. ${page.purpose}.`, variant: "body" as const, align: "center" as const, typographyToken: "body" } },
              { type: "button" as const, props: { label: brief.primaryGoal === "buy" ? "Начать" : "Связаться", href: "#contact", variant: "primary" as const, align: "center" as const } },
            ],
          },
          {
            type: "section" as const,
            props: { layout: "split" as const, backgroundToken: "surface", spacingToken: "section", contentWidthToken: "wide", align: "left" as const },
            blocks: [
              { type: "image" as const, props: { src: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80", alt: `Образ ${cleanName(projectName)}`, fit: "cover" as const, radiusToken: "large" } },
              { type: "text" as const, props: { content: `Структура и сообщение для ${cleanName(projectName)} собраны из подтверждённого Brief.`, variant: "body" as const, align: "left" as const, typographyToken: "body" } },
            ],
          },
        ],
      }],
    };
    return siteSpecSchema.parse(spec);
  },
};

function proposeBlockProps(type: "section" | "text" | "image" | "button", rawProps: unknown, instruction: string) {
  const props = blockPropsByType[type].parse(rawProps) as Record<string, unknown>;
  if (type === "text") return { ...props, content: `${String(props.content)} — ${instruction.slice(0, 80)}` };
  if (type === "button") return { ...props, label: instruction.slice(0, 120) || String(props.label) };
  if (type === "section") return { ...props, align: props.align === "center" ? "left" : "center" };
  return props;
}

export function getAIProvider(): AIProvider {
  return manualAIProvider;
}
