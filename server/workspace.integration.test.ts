import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { projects, users } from "../drizzle/schema";
import { appRouter } from "./routers";
import { getDb } from "./db";
import type { TrpcContext } from "./_core/context";

type TestUser = NonNullable<TrpcContext["user"]>;

function contextFor(user: TestUser): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe.sequential("Stage 4 workspace and visual editor acceptance", () => {
  let db: any;
  let owner: TestUser;
  let otherOwner: TestUser;
  let projectId: number;
  let userIds: number[] = [];

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("DATABASE_URL is required for Stage 4 acceptance");
    const suffix = randomUUID().slice(0, 8);
    const inserted = await db.insert(users).values([
      { openId: `stage4-owner-${suffix}`, name: "Stage 4 Owner", email: `stage4-owner-${suffix}@example.test`, loginMethod: "integration", role: "user" },
      { openId: `stage4-other-${suffix}`, name: "Stage 4 Other", email: `stage4-other-${suffix}@example.test`, loginMethod: "integration", role: "user" },
    ]);
    userIds = [Number(inserted[0].insertId), Number(inserted[0].insertId) + 1];
    const rows = await db.select().from(users).where(inArray(users.id, userIds));
    owner = rows.find((row: TestUser) => row.id === userIds[0])!;
    otherOwner = rows.find((row: TestUser) => row.id === userIds[1])!;
    const ownerCaller = appRouter.createCaller(contextFor(owner));
    const project = await ownerCaller.architect.createProject({ name: "Stage 4 Atelier", projectSlug: `stage4-${suffix}`, idea: "Редактируемый Draft для workspace acceptance." });
    projectId = project.projectId;
    const brief = await ownerCaller.architect.createBrief({ projectId });
    await ownerCaller.architect.confirmBrief({ projectId, briefId: brief.briefId });
    const spec = await ownerCaller.architect.generateSiteSpec({ projectId, briefId: brief.briefId });
    await ownerCaller.architect.confirmSiteSpec({ projectId, siteSpecId: spec.siteSpecId });
    await ownerCaller.architect.applySiteSpec({ projectId, siteSpecId: spec.siteSpecId, expectedRevision: 1 });
  });

  afterAll(async () => {
    if (!db) return;
    if (projectId) await db.delete(projects).where(inArray(projects.id, [projectId]));
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  });

  it("shows only owner projects and loads pages/canvas through production read paths", async () => {
    const ownerCaller = appRouter.createCaller(contextFor(owner));
    const otherCaller = appRouter.createCaller(contextFor(otherOwner));
    const projectsForOwner = await ownerCaller.workspace.projects();
    const projectsForOther = await otherCaller.workspace.projects();
    expect(projectsForOwner.some((project) => project.id === projectId)).toBe(true);
    expect(projectsForOther.some((project) => project.id === projectId)).toBe(false);
    const state = await ownerCaller.architect.state({ projectId });
    expect(state.pages).toHaveLength(1);
    expect(state.blocks.some((block) => block.type === "section" && block.parentBlockId === null)).toBe(true);
    expect(state.blocks.some((block) => block.parentBlockId !== null)).toBe(true);
  });

  it("saves a selected block through update and reloads the changed prop", async () => {
    const ownerCaller = appRouter.createCaller(contextFor(owner));
    const before = await ownerCaller.architect.state({ projectId });
    const page = before.pages[0]!;
    const textBlock = before.blocks.find((block) => block.type === "text")!;
    const props = { ...(textBlock.props as Record<string, unknown>), content: "Изменение из properties panel" };
    await ownerCaller.siteBlocks.update({ projectId, pageId: page.id, expectedRevision: before.project.projectDraftRevision, blockId: textBlock.id, parentBlockId: textBlock.parentBlockId, type: textBlock.type, sortOrder: textBlock.sortOrder, props });
    const after = await ownerCaller.architect.state({ projectId });
    const reloaded = after.blocks.find((block) => block.id === textBlock.id)!;
    expect(after.project.projectDraftRevision).toBe(before.project.projectDraftRevision + 1);
    expect((reloaded.props as Record<string, unknown>).content).toBe("Изменение из properties panel");
  });

  it("saves section order through reorder and a full Draft through replaceAll", async () => {
    const ownerCaller = appRouter.createCaller(contextFor(owner));
    const before = await ownerCaller.architect.state({ projectId });
    const page = before.pages[0]!;
    const sections = before.blocks.filter((block) => block.type === "section").sort((a, b) => b.sortOrder - a.sortOrder);
    const ordered = before.blocks.map((block) => {
      const sectionIndex = sections.findIndex((section) => section.id === block.id);
      return sectionIndex >= 0 ? { ...block, sortOrder: sectionIndex } : block;
    });
    await ownerCaller.siteBlocks.reorder({ projectId, pageId: page.id, expectedRevision: before.project.projectDraftRevision, blocks: ordered });
    const afterReorder = await ownerCaller.architect.state({ projectId });
    expect(afterReorder.project.projectDraftRevision).toBe(before.project.projectDraftRevision + 1);
    await ownerCaller.siteBlocks.replaceAll({ projectId, pageId: page.id, expectedRevision: afterReorder.project.projectDraftRevision, blocks: afterReorder.blocks });
    const afterReplace = await ownerCaller.architect.state({ projectId });
    expect(afterReplace.project.projectDraftRevision).toBe(afterReorder.project.projectDraftRevision + 1);
    expect(afterReplace.blocks.map((block) => block.id).sort()).toEqual(afterReorder.blocks.map((block) => block.id).sort());
  });

  it("rejects a stale editor save without changing the Draft", async () => {
    const ownerCaller = appRouter.createCaller(contextFor(owner));
    const before = await ownerCaller.architect.state({ projectId });
    const textBlock = before.blocks.find((block) => block.type === "text")!;
    await expect(ownerCaller.siteBlocks.update({ projectId, pageId: before.pages[0]!.id, expectedRevision: before.project.projectDraftRevision - 1, blockId: textBlock.id, parentBlockId: textBlock.parentBlockId, type: textBlock.type, sortOrder: textBlock.sortOrder, props: textBlock.props })).rejects.toMatchObject({ code: "CONFLICT" });
    const after = await ownerCaller.architect.state({ projectId });
    expect(after.project.projectDraftRevision).toBe(before.project.projectDraftRevision);
    expect(after.blocks.map((block) => block.id)).toEqual(before.blocks.map((block) => block.id));
  });
});
