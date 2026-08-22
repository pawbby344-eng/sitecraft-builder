import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import { assertExpectedRevision, validateDraftBlockSet, validateProps } from "./site-engine";
import { projectSlugSchema, themeSchema } from "../shared/site-engine/schemas";
import type { TrpcContext } from "./_core/context";

function unauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Core Engine server invariants", () => {
  it("rejects stale draft revisions with CONFLICT", () => {
    expect(() => assertExpectedRevision(4, 3)).toThrowError(new TRPCError({ code: "CONFLICT", message: "Draft revision is stale" }));
  });

  it("validates block props per block type", () => {
    expect(validateProps("button", { label: "Contact", href: "/contact", variant: "primary", align: "left" })).toMatchObject({ label: "Contact" });
    expect(() => validateProps("button", { label: "Run", href: "javascript:alert(1)", variant: "primary", align: "left" })).toThrowError(/Invalid button props/);
    expect(() => validateProps("text", { content: "ok", variant: "body", align: "left", unexpected: true })).toThrowError(/Invalid text props/);
  });

  it("uses one server validation entrypoint for a valid nested draft", () => {
    expect(validateDraftBlockSet([
      { id: 1, pageId: 10, parentBlockId: null, type: "section", sortOrder: 0, props: { layout: "stack", backgroundToken: "surface", spacingToken: "md", contentWidthToken: "standard", align: "left" } },
      { id: 2, pageId: 10, parentBlockId: 1, type: "text", sortOrder: 4, props: { content: "Hello", variant: "body", align: "left" } },
    ]).normalizedBlocks.map((row) => row.sortOrder)).toEqual([0, 0]);
  });

  it("validates project-level slug and theme contracts", () => {
    expect(projectSlugSchema.safeParse("atelier-studio").success).toBe(true);
    expect(projectSlugSchema.safeParse("Atelier Studio").success).toBe(false);
    expect(themeSchema.safeParse({
      typography: { fontFamily: "Inter", headingSize: 48, bodySize: 16, headingWeight: 700, lineHeight: 1.4 },
      colors: { background: "#ffffff", surface: "#f7f7f5", text: "#121212", muted: "#686868", primary: "#121212", buttonText: "#ffffff" },
      spacing: { unit: 4, sectionGap: 64, blockGap: 16 },
      radius: { small: 8, medium: 16, large: 24 },
      contentWidth: 1200,
    }).success).toBe(true);
  });

  it("protects every block mutation behind OAuth", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.siteBlocks.create({
      projectId: 1,
      pageId: 1,
      expectedRevision: 1,
      parentBlockId: null,
      type: "section",
      sortOrder: 0,
      props: { layout: "stack", backgroundToken: "surface", spacingToken: "md", contentWidthToken: "standard", align: "left" },
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
