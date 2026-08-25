import { describe, expect, it } from "vitest";
import { groupEditorBlocks, moveEditorSection, validateEditorBlockProps, type EditorBlock } from "../shared/site-engine/editor";

const blocks: EditorBlock[] = [
  { id: 1, pageId: 10, parentBlockId: null, type: "section", sortOrder: 0, props: { layout: "stack", backgroundToken: "surface", spacingToken: "section", contentWidthToken: "wide", align: "left" } },
  { id: 2, pageId: 10, parentBlockId: 1, type: "text", sortOrder: 0, props: { content: "Hello", variant: "heading", align: "left" } },
  { id: 3, pageId: 10, parentBlockId: null, type: "section", sortOrder: 1, props: { layout: "centered", backgroundToken: "surface", spacingToken: "section", contentWidthToken: "wide", align: "center" } },
  { id: 4, pageId: 10, parentBlockId: 3, type: "button", sortOrder: 0, props: { label: "Start", href: "#start", variant: "primary", align: "center" } },
];

describe("Stage 4 editor helpers", () => {
  it("groups the existing Draft into ordered sections and children", () => {
    const grouped = groupEditorBlocks([...blocks].reverse());
    expect(grouped.map((item) => item.section.id)).toEqual([1, 3]);
    expect(grouped[0]?.children.map((block) => block.id)).toEqual([2]);
    expect(grouped[1]?.children.map((block) => block.id)).toEqual([4]);
  });

  it("moves only root Sections and preserves child parent relationships", () => {
    const moved = moveEditorSection(blocks, 3, -1);
    expect(moved.find((block) => block.id === 3)?.sortOrder).toBe(0);
    expect(moved.find((block) => block.id === 1)?.sortOrder).toBe(1);
    expect(moved.find((block) => block.id === 4)?.parentBlockId).toBe(3);
  });

  it("accepts the four canonical block prop schemas", () => {
    expect(() => validateEditorBlockProps(blocks)).not.toThrow();
  });

  it("rejects arbitrary props before Save", () => {
    const invalid = [{ ...blocks[0]!, props: { ...blocks[0]!.props, unsupported: true } }];
    expect(() => validateEditorBlockProps(invalid)).toThrow();
  });
});
