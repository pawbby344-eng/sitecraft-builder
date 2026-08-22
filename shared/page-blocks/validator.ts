import { z } from "zod";

export const pageBlockTypeSchema = z.enum(["section", "text", "image", "button"]);
export type PageBlockType = z.infer<typeof pageBlockTypeSchema>;

export type HierarchyBlock = {
  id: number;
  pageId: number;
  parentBlockId: number | null;
  type: PageBlockType;
  sortOrder: number;
};

export type ValidatedHierarchy = {
  blocks: HierarchyBlock[];
  normalizedBlocks: HierarchyBlock[];
};

export class PageBlockHierarchyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageBlockHierarchyError";
  }
}

function parentKey(parentBlockId: number | null): string {
  return parentBlockId === null ? "root" : `parent:${parentBlockId}`;
}

/**
 * Validates the only supported MVP tree shape:
 * Page → Section → Content Block.
 * It is deliberately independent from UI, persistence, and AI layers.
 */
export function validatePageBlockHierarchy(blocks: HierarchyBlock[]): ValidatedHierarchy {
  const byId = new Map<number, HierarchyBlock>();
  for (const block of blocks) {
    if (byId.has(block.id)) {
      throw new PageBlockHierarchyError(`Duplicate block id: ${block.id}`);
    }
    if (!Number.isInteger(block.sortOrder) || block.sortOrder < 0) {
      throw new PageBlockHierarchyError(`Invalid sortOrder for block ${block.id}`);
    }
    byId.set(block.id, block);
  }

  for (const block of blocks) {
    if (block.parentBlockId === null) {
      if (block.type !== "section") {
        throw new PageBlockHierarchyError(`Root block ${block.id} must be a section`);
      }
      continue;
    }

    if (block.parentBlockId === block.id) {
      throw new PageBlockHierarchyError(`Block ${block.id} cannot be its own parent`);
    }

    const parent = byId.get(block.parentBlockId);
    if (!parent) {
      throw new PageBlockHierarchyError(`Parent block ${block.parentBlockId} does not exist`);
    }
    if (parent.pageId !== block.pageId) {
      throw new PageBlockHierarchyError(`Parent block ${parent.id} must be on the same page`);
    }
    if (parent.type !== "section") {
      throw new PageBlockHierarchyError(`Parent block ${parent.id} must be a section`);
    }
    if (parent.parentBlockId !== null) {
      throw new PageBlockHierarchyError(`Block ${block.id} would create a third nesting level`);
    }
    if (block.type === "section") {
      throw new PageBlockHierarchyError(`Section ${block.id} cannot have a parent`);
    }
  }

  const parentIds = new Set(blocks.map((block) => block.parentBlockId).filter((id): id is number => id !== null));
  for (const parentId of Array.from(parentIds)) {
    const parent = byId.get(parentId);
    if (parent && parent.type !== "section") {
      throw new PageBlockHierarchyError(`Content block ${parent.id} cannot have children`);
    }
  }

  const normalizedBlocks = normalizePageBlockOrder(blocks);
  return { blocks, normalizedBlocks };
}

/**
 * Produces deterministic contiguous sortOrder values within each parent scope.
 * Existing order is preserved by sortOrder, then id as a stable tie-breaker.
 */
export function normalizePageBlockOrder(blocks: HierarchyBlock[]): HierarchyBlock[] {
  const grouped = new Map<string, HierarchyBlock[]>();
  for (const block of blocks) {
    const key = parentKey(block.parentBlockId);
    const group = grouped.get(key) ?? [];
    group.push(block);
    grouped.set(key, group);
  }

  const normalized: HierarchyBlock[] = [];
  for (const group of Array.from(grouped.values())) {
    group
      .slice()
      .sort((left: HierarchyBlock, right: HierarchyBlock) => left.sortOrder - right.sortOrder || left.id - right.id)
      .forEach((block: HierarchyBlock, index: number) => normalized.push({ ...block, sortOrder: index }));
  }

  return normalized.sort((left: HierarchyBlock, right: HierarchyBlock) => left.pageId - right.pageId || (left.parentBlockId ?? -1) - (right.parentBlockId ?? -1) || left.sortOrder - right.sortOrder || left.id - right.id);
}

export const hierarchyBlockInputSchema = z.object({
  id: z.number().int().positive(),
  pageId: z.number().int().positive(),
  parentBlockId: z.number().int().positive().nullable(),
  type: pageBlockTypeSchema,
  sortOrder: z.number().int().nonnegative(),
}).strict();

export const hierarchyBlocksInputSchema = z.array(hierarchyBlockInputSchema);
