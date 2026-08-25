import { blockPropsByType } from "./schemas";
import { publishedSnapshotSchema, type PublishedSnapshot } from "./publish";

type RenderBlock = PublishedSnapshot["pages"][number]["blocks"][number];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

const fontStacks = {
  Inter: "Inter",
  system: "system-ui",
  sans: "ui-sans-serif",
  serif: "ui-serif",
  mono: "ui-monospace",
} as const;

function cssColor(value: unknown, fallback: string) { return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback; }
function cssFontStack(token: keyof typeof fontStacks) { return fontStacks[token]; }

export function renderSiteHtml(input: unknown, pageSlug?: string) {
  const snapshot = publishedSnapshotSchema.parse(input);
  const page = snapshot.pages.find((candidate) => candidate.pageSlug === pageSlug) ?? snapshot.pages.find((candidate) => candidate.isHome);
  if (!page) return "";
  const theme = snapshot.theme;
  const vars = `--sc-bg:${cssColor(theme.colors.background, "#f8f7f3")};--sc-surface:${cssColor(theme.colors.surface, "#fff")};--sc-text:${cssColor(theme.colors.text, "#171717")};--sc-muted:${cssColor(theme.colors.muted, "#6f6b63")};--sc-primary:${cssColor(theme.colors.primary, "#171717")};--sc-button-text:${cssColor(theme.colors.buttonText, "#fff")};--sc-content:${theme.contentWidth}px;--sc-section-gap:${theme.spacing.sectionGap}px;--sc-block-gap:${theme.spacing.blockGap}px;--sc-radius-small:${theme.radius.small}px;--sc-radius-medium:${theme.radius.medium}px;--sc-radius-large:${theme.radius.large}px;--sc-font:${cssFontStack(theme.typography.fontFamily)};`;
  const css = `.sc-site{box-sizing:border-box;min-height:100%;background:var(--sc-bg);color:var(--sc-text);font-family:var(--sc-font),system-ui,sans-serif}.sc-site *{box-sizing:border-box}.sc-page{max-width:var(--sc-content);margin:0 auto;padding:28px 20px 80px}.sc-section{margin-bottom:var(--sc-section-gap);padding:clamp(28px,6vw,72px) clamp(22px,5vw,64px);border-radius:var(--sc-radius-large);background:var(--sc-surface)}.sc-section[data-layout=split]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(24px,5vw,64px);align-items:center}.sc-section[data-align=center]{text-align:center}.sc-section[data-align=right]{text-align:right}.sc-block{margin-bottom:var(--sc-block-gap)}.sc-text[data-variant=heading]{font-size:clamp(32px,6vw,${theme.typography.headingSize}px);font-weight:${theme.typography.headingWeight};line-height:${theme.typography.lineHeight};letter-spacing:-.04em}.sc-text[data-variant=body]{font-size:${theme.typography.bodySize}px;line-height:1.65;color:var(--sc-muted)}.sc-text[data-variant=eyebrow]{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--sc-muted)}.sc-image{display:block;width:100%;max-height:520px;object-fit:cover;border-radius:var(--sc-radius-medium)}.sc-button{display:inline-flex;align-items:center;justify-content:center;padding:13px 20px;border-radius:999px;background:var(--sc-primary);color:var(--sc-button-text);font-size:14px;font-weight:700;text-decoration:none;transition:transform .16s ease,opacity .16s ease}.sc-button:hover{opacity:.88;transform:translateY(-1px)}.sc-button[data-variant=secondary]{background:var(--sc-surface);color:var(--sc-primary);box-shadow:inset 0 0 0 1px var(--sc-primary)}.sc-button[data-variant=ghost]{background:transparent;color:var(--sc-primary)}@media(max-width:720px){.sc-section[data-layout=split]{grid-template-columns:1fr}.sc-page{padding-inline:14px}.sc-section{margin-bottom:36px}}
`;
  return `<style>${css}</style><div class="sc-site" data-renderer="sitecraft" style="${vars}"><main class="sc-page" data-page-slug="${escapeHtml(page.pageSlug)}"><h1 class="sr-only">${escapeHtml(page.name)}</h1>${renderPage(page.blocks)}</main></div>`;
}

function renderPage(blocks: RenderBlock[]) {
  return blocks.filter((block) => block.parentBlockId === null && block.type === "section").sort((a, b) => a.sortOrder - b.sortOrder).map((section) => {
    const sectionProps = blockPropsByType.section.parse(section.props) as Record<string, unknown>;
    const children = blocks.filter((block) => block.parentBlockId === section.id).sort((a, b) => a.sortOrder - b.sortOrder);
    return `<section class="sc-section" data-layout="${escapeHtml(String(sectionProps.layout))}" data-align="${escapeHtml(String(sectionProps.align))}" style="background:${cssColor(sectionProps.backgroundOverride, "var(--sc-surface)")}">${children.map(renderContentBlock).join("")}</section>`;
  }).join("");
}

function renderContentBlock(block: RenderBlock) {
  const props = blockPropsByType[block.type].parse(block.props) as Record<string, unknown>;
  if (block.type === "text") return `<div class="sc-block sc-text" data-variant="${escapeHtml(String(props.variant))}" style="text-align:${escapeHtml(String(props.align))};color:${cssColor(props.colorOverride, "inherit")}">${escapeHtml(String(props.content))}</div>`;
  if (block.type === "image") return `<div class="sc-block"><img class="sc-image" src="${escapeHtml(String(props.src))}" alt="${escapeHtml(String(props.alt))}" style="object-fit:${escapeHtml(String(props.fit))}" /></div>`;
  if (block.type === "button") return `<div class="sc-block" style="text-align:${escapeHtml(String(props.align))}"><a class="sc-button" data-variant="${escapeHtml(String(props.variant))}" href="${escapeHtml(String(props.href))}">${escapeHtml(String(props.label))}</a></div>`;
  return "";
}
