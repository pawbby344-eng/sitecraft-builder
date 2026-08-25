import { blockPropsByType } from "./schemas";

export type EditorBlockType = "section" | "text" | "image" | "button";

export type EditorBlock = {
  id: number;
  pageId: number;
  parentBlockId: number | null;
  type: EditorBlockType;
  sortOrder: number;
  props: Record<string, unknown>;
};

export function sortEditorBlocks(blocks: EditorBlock[]) {
  return [...blocks].sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
}

export function groupEditorBlocks(blocks: EditorBlock[]) {
  const ordered = sortEditorBlocks(blocks);
  const sections = ordered.filter((block) => block.type === "section" && block.parentBlockId === null);
  return sections.map((section) => ({
    section,
    children: ordered.filter((block) => block.parentBlockId === section.id),
  }));
}

export function moveEditorSection(blocks: EditorBlock[], sectionId: number, direction: -1 | 1) {
  const sections = sortEditorBlocks(blocks).filter((block) => block.type === "section" && block.parentBlockId === null);
  const index = sections.findIndex((section) => section.id === sectionId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sections.length) return blocks;
  const next = [...sections];
  [next[index], next[target]] = [next[target], next[index]];
  const order = new Map(next.map((section, position) => [section.id, position]));
  return blocks.map((block) => order.has(block.id) ? { ...block, sortOrder: order.get(block.id)! } : block);
}

export function validateEditorBlockProps(blocks: EditorBlock[]) {
  blocks.forEach((block) => blockPropsByType[block.type].parse(block.props));
  return blocks;
}
