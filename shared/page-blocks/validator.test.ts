import { describe, expect, it } from "vitest";
import {
  PageBlockHierarchyError,
  normalizePageBlockOrder,
  validatePageBlockHierarchy,
  type HierarchyBlock,
} from "./validator";

const block = (overrides: Partial<HierarchyBlock>): HierarchyBlock => ({
  id: 1,
  pageId: 10,
  parentBlockId: null,
  type: "section",
  sortOrder: 0,
  ...overrides,
});

describe("validatePageBlockHierarchy", () => {
  it("accepts Page → Section → Text/Image/Button", () => {
    const result = validatePageBlockHierarchy([
      block({ id: 1, type: "section", sortOrder: 4 }),
      block({ id: 2, parentBlockId: 1, type: "text", sortOrder: 2 }),
      block({ id: 3, parentBlockId: 1, type: "image", sortOrder: 0 }),
      block({ id: 4, parentBlockId: 1, type: "button", sortOrder: 1 }),
    ]);

    expect(result.normalizedBlocks.map((item) => item.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it.each([
    ["Text without Section", [block({ id: 2, type: "text" })]],
    ["Section inside Section", [block({ id: 1 }), block({ id: 2, parentBlockId: 1, type: "section" })]],
    ["Text inside Text", [block({ id: 1, type: "section" }), block({ id: 2, parentBlockId: 1, type: "text" }), block({ id: 3, parentBlockId: 2, type: "button" })]],
    ["parent on another page", [block({ id: 1, pageId: 10 }), block({ id: 2, pageId: 11, parentBlockId: 1, type: "text" })]],
    ["self-parent", [block({ id: 1, parentBlockId: 1 })]],
    ["missing parent", [block({ id: 2, parentBlockId: 99, type: "text" })]],
    ["third nesting level", [block({ id: 1 }), block({ id: 2, parentBlockId: 1, type: "text" }), block({ id: 3, parentBlockId: 2, type: "button" })]],
  ])("rejects %s", (_name, blocks) => {
    expect(() => validatePageBlockHierarchy(blocks)).toThrow(PageBlockHierarchyError);
  });

  it("normalizes sortOrder independently for each parent", () => {
    const normalized = normalizePageBlockOrder([
      block({ id: 1, sortOrder: 8 }),
      block({ id: 2, parentBlockId: 1, type: "text", sortOrder: 9 }),
      block({ id: 3, parentBlockId: 1, type: "button", sortOrder: 1 }),
      block({ id: 4, parentBlockId: 1, type: "image", sortOrder: 1 }),
    ]);

    expect(normalized.filter((item) => item.parentBlockId === 1).map((item) => [item.id, item.sortOrder])).toEqual([
      [3, 0],
      [4, 1],
      [2, 2],
    ]);
  });
});
