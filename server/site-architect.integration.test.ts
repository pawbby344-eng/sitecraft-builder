import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { projects, users } from "../drizzle/schema";
import { appRouter } from "./routers";
import { getDb } from "./db";
import type { TrpcContext } from "./_core/context";
import { fingerprint } from "./site-architect";

function contextFor(user: NonNullable<TrpcContext["user"]>): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe.sequential("Stage 3 real DB integration", () => {
  let db: any;
  let owner: NonNullable<TrpcContext["user"]>;
  let otherOwner: NonNullable<TrpcContext["user"]>;
  const cleanupProjectIds: number[] = [];
  const cleanupUserIds: number[] = [];

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("DATABASE_URL is required for Stage 3 integration test");
    const suffix = randomUUID().slice(0, 8);
    const inserted = await db.insert(users).values([
      { openId: `stage3-owner-${suffix}`, name: "Stage 3 Owner", email: `stage3-owner-${suffix}@example.test`, loginMethod: "integration", role: "user" },
      { openId: `stage3-other-${suffix}`, name: "Stage 3 Other", email: `stage3-other-${suffix}@example.test`, loginMethod: "integration", role: "user" },
    ]);
    const rows = await db.select().from(users).where(inArray(users.id, [Number(inserted[0].insertId), Number(inserted[0].insertId) + 1]));
    owner = rows.find((row: typeof rows[number]) => row.email?.includes("owner"))!;
    otherOwner = rows.find((row: typeof rows[number]) => row.email?.includes("other"))!;
    cleanupUserIds.push(owner.id, otherOwner.id);
  });

  afterAll(async () => {
    if (!db) return;
    if (cleanupProjectIds.length) await db.delete(projects).where(inArray(projects.id, cleanupProjectIds));
    if (cleanupUserIds.length) await db.delete(users).where(inArray(users.id, cleanupUserIds));
  });

  it("persists IDEA → Brief → SiteSpec → Draft and reloads through architect.state", async () => {
    const ownerCaller = appRouter.createCaller(contextFor(owner));
    const project = await ownerCaller.architect.createProject({
      name: "Integration Atelier",
      projectSlug: `integration-atelier-${randomUUID().slice(0, 8)}`,
      idea: "Сайт студии интерьеров для спокойного и понятного первого контакта.",
    });
    cleanupProjectIds.push(project.projectId);

    const generatedBrief = await ownerCaller.architect.createBrief({ projectId: project.projectId });
    const editedBrief = { ...generatedBrief.brief, valueProposition: "Помогаем оформить пространство с ясным планом и спокойной подачей." };
    await ownerCaller.architect.updateBrief({ projectId: project.projectId, briefId: generatedBrief.briefId, brief: editedBrief });
    await ownerCaller.architect.confirmBrief({ projectId: project.projectId, briefId: generatedBrief.briefId });
    const generatedSpec = await ownerCaller.architect.generateSiteSpec({ projectId: project.projectId, briefId: generatedBrief.briefId });
    await ownerCaller.architect.confirmSiteSpec({ projectId: project.projectId, siteSpecId: generatedSpec.siteSpecId });
    await ownerCaller.architect.applySiteSpec({ projectId: project.projectId, siteSpecId: generatedSpec.siteSpecId, expectedRevision: 1 });

    const reloaded = await ownerCaller.architect.state({ projectId: project.projectId });
    expect(reloaded.idea.inputText).toContain("Сайт студии интерьеров");
    expect(reloaded.brief?.id).toBe(generatedBrief.briefId);
    expect(reloaded.brief?.status).toBe("confirmed");
    expect((reloaded.brief?.brief as { valueProposition: string }).valueProposition).toContain("ясным планом");
    expect(reloaded.spec?.id).toBe(generatedSpec.siteSpecId);
    expect(reloaded.spec?.briefId).toBe(generatedBrief.briefId);
    expect(fingerprint(reloaded.brief?.brief)).toBe((reloaded.spec?.spec as { sourceBriefFingerprint: string }).sourceBriefFingerprint);
    expect(reloaded.project.theme).toEqual((reloaded.spec?.spec as { theme: unknown }).theme);
    expect(reloaded.pages).toHaveLength(1);
    expect(reloaded.pages[0]?.isHome).toBe(true);
    expect(reloaded.blocks.some((block) => block.type === "section" && block.parentBlockId === null)).toBe(true);
    expect(reloaded.blocks.some((block) => block.type === "text" && block.parentBlockId !== null)).toBe(true);
    expect(reloaded.blocks.some((block) => block.type === "image" && block.parentBlockId !== null)).toBe(true);
    expect(reloaded.blocks.some((block) => block.type === "button" && block.parentBlockId !== null)).toBe(true);
    expect(reloaded.project.projectDraftRevision).toBe(2);
  });

  it("rejects stale revision atomically and protects repeated Apply", async () => {
    const ownerCaller = appRouter.createCaller(contextFor(owner));
    const projectId = cleanupProjectIds[0]!;
    const before = await ownerCaller.architect.state({ projectId });
    await expect(ownerCaller.architect.applySiteSpec({ projectId, siteSpecId: before.spec!.id, expectedRevision: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
    const after = await ownerCaller.architect.state({ projectId });
    expect(after.project.projectDraftRevision).toBe(before.project.projectDraftRevision);
    expect(after.pages.map((page) => page.id)).toEqual(before.pages.map((page) => page.id));
    expect(after.blocks.map((block) => block.id)).toEqual(before.blocks.map((block) => block.id));
  });

  it("rejects an old SiteSpec after Brief changes without mutating the Draft", async () => {
    const ownerCaller = appRouter.createCaller(contextFor(owner));
    const projectId = cleanupProjectIds[0]!;
    const before = await ownerCaller.architect.state({ projectId });
    const changedBrief = { ...(before.brief!.brief as Record<string, unknown>), valueProposition: "Новое предложение после создания SiteSpec" };
    await ownerCaller.architect.updateBrief({ projectId, briefId: before.brief!.id, brief: changedBrief as never });
    await expect(ownerCaller.architect.confirmSiteSpec({ projectId, siteSpecId: before.spec!.id })).rejects.toMatchObject({ code: "CONFLICT" });
    const after = await ownerCaller.architect.state({ projectId });
    expect(after.project.projectDraftRevision).toBe(before.project.projectDraftRevision);
    expect(after.pages.map((page) => page.id)).toEqual(before.pages.map((page) => page.id));
    expect(after.blocks.map((block) => block.id)).toEqual(before.blocks.map((block) => block.id));
  });

  it("rejects operations from another owner without changing state", async () => {
    const ownerCaller = appRouter.createCaller(contextFor(owner));
    const otherCaller = appRouter.createCaller(contextFor(otherOwner));
    const projectId = cleanupProjectIds[0]!;
    const before = await ownerCaller.architect.state({ projectId });
    await expect(otherCaller.architect.state({ projectId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(otherCaller.architect.confirmBrief({ projectId, briefId: before.brief!.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(otherCaller.architect.applySiteSpec({ projectId, siteSpecId: before.spec!.id, expectedRevision: before.project.projectDraftRevision })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const after = await ownerCaller.architect.state({ projectId });
    expect(after.project.projectDraftRevision).toBe(before.project.projectDraftRevision);
    expect(after.pages.map((page) => page.id)).toEqual(before.pages.map((page) => page.id));
    expect(after.blocks.map((block) => block.id)).toEqual(before.blocks.map((block) => block.id));
  });
});
