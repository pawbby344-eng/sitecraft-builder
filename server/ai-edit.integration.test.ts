import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { aiProposals, pageBlocks, projects, scopeLocks, users } from "../drizzle/schema";
import { appRouter } from "./routers";
import { getDb } from "./db";
import type { TrpcContext } from "./_core/context";

 type TestUser = NonNullable<TrpcContext["user"]>;
function caller(user: TestUser) { return appRouter.createCaller({ user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] }); }

describe.sequential("Stage 5 AI Local Edit and Locks", () => {
  let db: any;
  let owner: TestUser;
  let other: TestUser;
  let projectId = 0;
  let pageId = 0;
  let textBlockId = 0;
  let sectionId = 0;
  let userIds: number[] = [];

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("DATABASE_URL is required");
    const suffix = randomUUID().slice(0, 8);
    const inserted = await db.insert(users).values([
      { openId: `stage5-owner-${suffix}`, name: "Stage 5 Owner", email: `stage5-owner-${suffix}@example.test`, loginMethod: "integration", role: "user" },
      { openId: `stage5-other-${suffix}`, name: "Stage 5 Other", email: `stage5-other-${suffix}@example.test`, loginMethod: "integration", role: "user" },
    ]);
    userIds = [Number(inserted[0].insertId), Number(inserted[0].insertId) + 1];
    const rows = await db.select().from(users).where(inArray(users.id, userIds));
    owner = rows.find((row: TestUser) => row.id === userIds[0])!;
    other = rows.find((row: TestUser) => row.id === userIds[1])!;
    const c = caller(owner);
    const project = await c.architect.createProject({ name: "Stage 5 Test", projectSlug: `stage5-${suffix}`, idea: "Proposal acceptance" });
    projectId = project.projectId;
    const brief = await c.architect.createBrief({ projectId });
    await c.architect.confirmBrief({ projectId, briefId: brief.briefId });
    const spec = await c.architect.generateSiteSpec({ projectId, briefId: brief.briefId });
    await c.architect.confirmSiteSpec({ projectId, siteSpecId: spec.siteSpecId });
    await c.architect.applySiteSpec({ projectId, siteSpecId: spec.siteSpecId, expectedRevision: 1 });
    const state = await c.architect.state({ projectId });
    pageId = state.pages[0]!.id;
    textBlockId = state.blocks.find((block) => block.type === "text")!.id;
    sectionId = state.blocks.find((block) => block.type === "section")!.id;
  });

  afterAll(async () => {
    if (!db) return;
    if (projectId) await db.delete(projects).where(eq(projects.id, projectId));
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  });

  it("creates a proposal without changing Draft, then applies it and reloads it", async () => {
    const c = caller(owner);
    const before = await c.architect.state({ projectId });
    const made = await c.aiEdit.createProposal({ projectId, scopeType: "block", scopeId: textBlockId, instruction: "Make this headline sharper" });
    expect(made.proposalId).toBeGreaterThan(0);
    const beforeApply = await c.architect.state({ projectId });
    expect(beforeApply.project.projectDraftRevision).toBe(before.project.projectDraftRevision);
    expect((beforeApply.blocks.find((block) => block.id === textBlockId)!.props as any).content).toBe((before.blocks.find((block) => block.id === textBlockId)!.props as any).content);
    await c.aiEdit.applyProposal({ projectId, proposalId: made.proposalId, expectedRevision: before.project.projectDraftRevision });
    const after = await c.architect.state({ projectId });
    expect(after.project.projectDraftRevision).toBe(before.project.projectDraftRevision + 1);
    expect((after.blocks.find((block) => block.id === textBlockId)!.props as any).content).toContain("Make this headline sharper");
    await expect(c.aiEdit.applyProposal({ projectId, proposalId: made.proposalId, expectedRevision: before.project.projectDraftRevision })).rejects.toMatchObject({ code: "CONFLICT" });
    const afterRepeated = await c.architect.state({ projectId });
    expect(afterRepeated.project.projectDraftRevision).toBe(after.project.projectDraftRevision);
    expect(afterRepeated.blocks.map((block) => block.id).sort((a, b) => a - b)).toEqual(after.blocks.map((block) => block.id).sort((a, b) => a - b));
    expect(new Set(afterRepeated.blocks.map((block) => block.id)).size).toBe(afterRepeated.blocks.length);
    const persistedBlocks = await db.select({ id: pageBlocks.id }).from(pageBlocks).where(eq(pageBlocks.pageId, pageId));
    expect(persistedBlocks.map((block: { id: number }) => block.id).sort((a: number, b: number) => a - b)).toEqual(after.blocks.map((block) => block.id).sort((a, b) => a - b));
    const editState = await c.aiEdit.state({ projectId });
    expect(editState.proposals.find((proposal) => proposal.id === made.proposalId)?.status).toBe("applied");
  });

  it("rejects a proposal without changing Draft and protects repeated Apply", async () => {
    const c = caller(owner);
    const before = await c.architect.state({ projectId });
    const made = await c.aiEdit.createProposal({ projectId, scopeType: "block", scopeId: textBlockId, instruction: "Try a rejected edit" });
    await c.aiEdit.rejectProposal({ projectId, proposalId: made.proposalId });
    const rejected = await c.architect.state({ projectId });
    expect(rejected.project.projectDraftRevision).toBe(before.project.projectDraftRevision);
    await expect(c.aiEdit.applyProposal({ projectId, proposalId: made.proposalId, expectedRevision: before.project.projectDraftRevision })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("returns CONFLICT for stale revision and after manual Draft change", async () => {
    const c = caller(owner);
    const before = await c.architect.state({ projectId });
    const made = await c.aiEdit.createProposal({ projectId, scopeType: "block", scopeId: textBlockId, instruction: "Stale edit" });
    await expect(c.aiEdit.applyProposal({ projectId, proposalId: made.proposalId, expectedRevision: before.project.projectDraftRevision - 1 })).rejects.toMatchObject({ code: "CONFLICT" });
    const unchanged = await c.architect.state({ projectId });
    expect(unchanged.project.projectDraftRevision).toBe(before.project.projectDraftRevision);
    const block = unchanged.blocks.find((item) => item.id === textBlockId)!;
    await c.siteBlocks.update({ projectId, pageId, expectedRevision: before.project.projectDraftRevision, blockId: textBlockId, parentBlockId: block.parentBlockId, type: block.type, sortOrder: block.sortOrder, props: { ...(block.props as any), content: "Manual change" } });
    await expect(c.aiEdit.applyProposal({ projectId, proposalId: made.proposalId, expectedRevision: before.project.projectDraftRevision + 1 })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects cross-owner proposal creation and Apply without changing Draft", async () => {
    const ownerCaller = caller(owner);
    const otherCaller = caller(other);
    const made = await ownerCaller.aiEdit.createProposal({ projectId, scopeType: "block", scopeId: textBlockId, instruction: "Cross owner" });
    await expect(otherCaller.aiEdit.createProposal({ projectId, scopeType: "block", scopeId: textBlockId, instruction: "Cross owner" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const before = await ownerCaller.architect.state({ projectId });
    await expect(otherCaller.aiEdit.applyProposal({ projectId, proposalId: made.proposalId, expectedRevision: before.project.projectDraftRevision })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const after = await ownerCaller.architect.state({ projectId });
    expect(after.project.projectDraftRevision).toBe(before.project.projectDraftRevision);
    expect(after.blocks.map((block) => block.id)).toEqual(before.blocks.map((block) => block.id));
  });

  it("enforces block, section and broader page-scope locks", async () => {
    const c = caller(owner);
    let current = await c.architect.state({ projectId });
    const blockProposal = await c.aiEdit.createProposal({ projectId, scopeType: "block", scopeId: textBlockId, instruction: "Locked block" });
    await c.aiEdit.setLock({ projectId, scopeType: "block", scopeId: textBlockId, locked: true });
    await expect(c.aiEdit.applyProposal({ projectId, proposalId: blockProposal.proposalId, expectedRevision: current.project.projectDraftRevision })).rejects.toMatchObject({ code: "CONFLICT" });
    await c.aiEdit.setLock({ projectId, scopeType: "block", scopeId: textBlockId, locked: false });
    current = await c.architect.state({ projectId });
    const sectionProposal = await c.aiEdit.createProposal({ projectId, scopeType: "section", scopeId: sectionId, instruction: "Locked section" });
    await c.aiEdit.setLock({ projectId, scopeType: "section", scopeId: sectionId, locked: true });
    await expect(c.aiEdit.applyProposal({ projectId, proposalId: sectionProposal.proposalId, expectedRevision: current.project.projectDraftRevision })).rejects.toMatchObject({ code: "CONFLICT" });
    await c.aiEdit.setLock({ projectId, scopeType: "section", scopeId: sectionId, locked: false });
    current = await c.architect.state({ projectId });
    const pageProposal = await c.aiEdit.createProposal({ projectId, scopeType: "page", scopeId: pageId, instruction: "Broader locked edit" });
    await c.aiEdit.setLock({ projectId, scopeType: "section", scopeId: sectionId, locked: true });
    await expect(c.aiEdit.applyProposal({ projectId, proposalId: pageProposal.proposalId, expectedRevision: current.project.projectDraftRevision })).rejects.toMatchObject({ code: "CONFLICT" });
    await c.aiEdit.setLock({ projectId, scopeType: "section", scopeId: sectionId, locked: false });
  });

  it("enforces theme lock and atomically rejects invalid proposal", async () => {
    const c = caller(owner);
    let current = await c.architect.state({ projectId });
    const themeProposal = await c.aiEdit.createProposal({ projectId, scopeType: "theme", scopeId: null, instruction: "Refine theme" });
    await c.aiEdit.setLock({ projectId, scopeType: "theme", scopeId: null, locked: true });
    await expect(c.aiEdit.applyProposal({ projectId, proposalId: themeProposal.proposalId, expectedRevision: current.project.projectDraftRevision })).rejects.toMatchObject({ code: "CONFLICT" });
    await c.aiEdit.setLock({ projectId, scopeType: "theme", scopeId: null, locked: false });
    current = await c.architect.state({ projectId });
    const valid = await c.aiEdit.createProposal({ projectId, scopeType: "block", scopeId: textBlockId, instruction: "Prepare invalid props" });
    const stored = await db.select({ proposal: aiProposals.proposal }).from(aiProposals).where(eq(aiProposals.id, valid.proposalId)).limit(1);
    const storedProposal = typeof stored[0].proposal === "string" ? JSON.parse(stored[0].proposal) : stored[0].proposal;
    const invalidProposal = { ...(storedProposal as any), changes: [{ ...(storedProposal as any).changes[0], props: { content: "", variant: "body", align: "left" } }] };
    await db.update(aiProposals).set({ proposal: invalidProposal }).where(eq(aiProposals.id, valid.proposalId));
    await expect(c.aiEdit.applyProposal({ projectId, proposalId: valid.proposalId, expectedRevision: current.project.projectDraftRevision })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const after = await c.architect.state({ projectId });
    expect(after.project.projectDraftRevision).toBe(current.project.projectDraftRevision);
  });
});
