import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { pageBlocks, pages, projects, publishedRevisions, users } from "../drizzle/schema";
import { getDb } from "./db";
import { appRouter } from "./routers";
import { getPublicSnapshot } from "./publish";
import { registerPublicRoutes } from "./public";
import { renderSiteHtml } from "../shared/site-engine/renderer";
import type { TrpcContext } from "./_core/context";

 type TestUser = NonNullable<TrpcContext["user"]>;
function caller(user: TestUser) { return appRouter.createCaller({ user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] }); }

describe.sequential("Stage 6 Responsive Preview and Publish", () => {
  let db: any;
  let owner: TestUser;
  let other: TestUser;
  let projectId = 0;
  let pageId = 0;
  let textBlockId = 0;
  let sectionId = 0;
  let userIds: number[] = [];
  let firstRevisionId = 0;
  let publicServer: Server;
  let publicBaseUrl = "";

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("DATABASE_URL is required");
    const suffix = randomUUID().slice(0, 8);
    const inserted = await db.insert(users).values([
      { openId: `stage6-owner-${suffix}`, name: "Stage 6 Owner", email: `stage6-owner-${suffix}@example.test`, loginMethod: "integration", role: "user" },
      { openId: `stage6-other-${suffix}`, name: "Stage 6 Other", email: `stage6-other-${suffix}@example.test`, loginMethod: "integration", role: "user" },
    ]);
    userIds = [Number(inserted[0].insertId), Number(inserted[0].insertId) + 1];
    const rows = await db.select().from(users).where(inArray(users.id, userIds));
    owner = rows.find((row: TestUser) => row.id === userIds[0])!;
    other = rows.find((row: TestUser) => row.id === userIds[1])!;
    const publicApp = express();
    registerPublicRoutes(publicApp);
    publicServer = createServer(publicApp);
    await new Promise<void>((resolve) => publicServer.listen(0, "127.0.0.1", resolve));
    const address = publicServer.address();
    if (!address || typeof address === "string") throw new Error("Public test server did not start");
    publicBaseUrl = `http://127.0.0.1:${address.port}`;
    const c = caller(owner);
    const project = await c.architect.createProject({ name: "Stage 6 Test", projectSlug: `stage6-${suffix}`, idea: "Publish acceptance" });
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
    await db.insert(pages).values({ projectId, name: "About", pageSlug: "about", purpose: "About page", isHome: false });
    const about = (await db.select({ id: pages.id }).from(pages).where(eq(pages.pageSlug, "about"))).at(-1)!;
    await db.insert(pageBlocks).values([
      { pageId: about.id, parentBlockId: null, type: "section", sortOrder: 0, props: { layout: "stack", backgroundToken: "surface", spacingToken: "section", contentWidthToken: "wide", align: "left" } },
    ]);
    const aboutSection = (await db.select({ id: pageBlocks.id }).from(pageBlocks).where(eq(pageBlocks.pageId, about.id))).at(-1)!;
    await db.insert(pageBlocks).values({ pageId: about.id, parentBlockId: aboutSection.id, type: "text", sortOrder: 0, props: { content: "About content", variant: "body", align: "left", typographyToken: "body" } });
    await c.siteBlocks.update({ projectId, pageId, expectedRevision: 2, blockId: textBlockId, parentBlockId: state.blocks.find((block) => block.id === textBlockId)!.parentBlockId, type: "text", sortOrder: state.blocks.find((block) => block.id === textBlockId)!.sortOrder, props: state.blocks.find((block) => block.id === textBlockId)!.props });
  });

  afterAll(async () => {
    if (publicServer) await new Promise<void>((resolve, reject) => publicServer.close((error) => error ? reject(error) : resolve()));
    if (!db) return;
    if (projectId) await db.delete(projects).where(eq(projects.id, projectId));
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  });

  it("renders current Draft in Preview without writes or Published Revision", async () => {
    const c = caller(owner);
    const before = await c.architect.state({ projectId });
    const draftSnapshot = { schemaVersion: "1" as const, project: { id: before.project.id, name: before.project.name, projectSlug: before.project.projectSlug }, theme: before.project.theme, pages: before.pages.map((page) => ({ id: page.id, name: page.name, pageSlug: page.pageSlug, purpose: page.purpose ?? null, isHome: page.isHome, blocks: before.blocks.filter((block) => block.pageId === page.id).map((block) => ({ id: block.id, pageId: block.pageId, parentBlockId: block.parentBlockId, type: block.type, sortOrder: block.sortOrder, props: block.props })) })) };
    for (const viewport of ["desktop", "tablet", "mobile"]) {
      const previewHtml = renderSiteHtml(draftSnapshot, "home");
      expect(previewHtml).toContain('data-renderer="sitecraft"');
      expect(previewHtml).toContain("Publish acceptance");
      expect(viewport).toBeTruthy();
    }
    const afterPreview = await c.architect.state({ projectId });
    expect(afterPreview.project.projectDraftRevision).toBe(before.project.projectDraftRevision);
    expect(afterPreview.blocks.map((block) => block.id)).toEqual(before.blocks.map((block) => block.id));
  });

  it("publishes Preview-compatible Draft and serves home and additional page from snapshot", async () => {
    const c = caller(owner);
    const before = await c.architect.state({ projectId });
    const published = await c.publish.publish({ projectId, expectedRevision: before.project.projectDraftRevision });
    firstRevisionId = published.publishedRevisionId;
    const home = await getPublicSnapshot({ projectSlug: published.projectSlug });
    const about = await getPublicSnapshot({ projectSlug: published.projectSlug, pageSlug: "about" });
    const homeResponse = await fetch(`${publicBaseUrl}/site/${published.projectSlug}`);
    const aboutResponse = await fetch(`${publicBaseUrl}/site/${published.projectSlug}/about`);
    const draftState = await c.architect.state({ projectId });
    const draftSnapshot = { schemaVersion: "1" as const, project: { id: draftState.project.id, name: draftState.project.name, projectSlug: draftState.project.projectSlug }, theme: draftState.project.theme, pages: draftState.pages.map((page) => ({ id: page.id, name: page.name, pageSlug: page.pageSlug, purpose: page.purpose ?? null, isHome: page.isHome, blocks: draftState.blocks.filter((block) => block.pageId === page.id).map((block) => ({ id: block.id, pageId: block.pageId, parentBlockId: block.parentBlockId, type: block.type, sortOrder: block.sortOrder, props: block.props })) })) };
    const draftPreviewHtml = renderSiteHtml(draftSnapshot, "home");
    const publishedHomeHtml = await homeResponse.text();
    expect(publishedHomeHtml).toBe(draftPreviewHtml);
    const missingResponse = await fetch(`${publicBaseUrl}/site/${published.projectSlug}/missing`);
    expect(homeResponse.status).toBe(200);
    expect(aboutResponse.status).toBe(200);
    expect(missingResponse.status).toBe(404);
    expect(publishedHomeHtml).toContain('data-renderer="sitecraft"');
    expect(await aboutResponse.text()).toContain("About content");
    expect(home.schemaVersion).toBe("1");
    expect(home.pages.find((page) => page.isHome)?.pageSlug).toBe("home");
    expect(about.pages.find((page) => page.pageSlug === "about")).toBeTruthy();
    const status = await c.publish.status({ projectId });
    expect(status.isPublished).toBe(true);
    expect(status.publishedRevisionId).toBe(firstRevisionId);
  });

  it("keeps public snapshot isolated after Draft changes and switches on re-publish", async () => {
    const c = caller(owner);
    const published = await getPublicSnapshot({ projectSlug: (await c.publish.status({ projectId })).projectSlug });
    const before = await c.architect.state({ projectId });
    const text = before.blocks.find((block) => block.id === textBlockId)!;
    await c.siteBlocks.update({ projectId, pageId, expectedRevision: before.project.projectDraftRevision, blockId: textBlockId, parentBlockId: text.parentBlockId, type: "text", sortOrder: text.sortOrder, props: { ...(text.props as any), content: "Draft changed after publish" } });
    const unchangedPublic = await getPublicSnapshot({ projectSlug: published.project.projectSlug });
    const unchangedPublicResponse = await fetch(`${publicBaseUrl}/site/${published.project.projectSlug}`);
    expect(unchangedPublicResponse.status).toBe(200);
    const oldContent = (published.pages.flatMap((page) => page.blocks).find((block) => block.id === textBlockId)!.props as any).content;
    const stillPublicContent = (unchangedPublic.pages.flatMap((page) => page.blocks).find((block) => block.id === textBlockId)!.props as any).content;
    expect(stillPublicContent).toBe(oldContent);
    expect(await unchangedPublicResponse.text()).toContain(oldContent);
    const latest = await c.architect.state({ projectId });
    const republished = await c.publish.publish({ projectId, expectedRevision: latest.project.projectDraftRevision });
    expect(republished.publishedRevisionId).not.toBe(firstRevisionId);
    const nextPublic = await getPublicSnapshot({ projectSlug: published.project.projectSlug });
    expect((nextPublic.pages.flatMap((page) => page.blocks).find((block) => block.id === textBlockId)!.props as any).content).toBe("Draft changed after publish");
    const oldRevision = await db.select({ snapshot: publishedRevisions.snapshot }).from(publishedRevisions).where(eq(publishedRevisions.id, firstRevisionId)).limit(1);
    const oldSnapshot = typeof oldRevision[0].snapshot === "string" ? JSON.parse(oldRevision[0].snapshot) : oldRevision[0].snapshot;
    expect((oldSnapshot as any).pages.flatMap((page: any) => page.blocks).find((block: any) => block.id === textBlockId).props.content).toBe(oldContent);
  });

  it("rejects stale Publish, invalid Draft atomically and cross-owner operations", async () => {
    const c = caller(owner);
    const before = await c.architect.state({ projectId });
    await expect(c.publish.publish({ projectId, expectedRevision: before.project.projectDraftRevision - 1 })).rejects.toMatchObject({ code: "CONFLICT" });
    const statusBefore = await c.publish.status({ projectId });
    const broken = await db.select({ props: pageBlocks.props }).from(pageBlocks).where(eq(pageBlocks.id, textBlockId)).limit(1);
    await db.update(pageBlocks).set({ props: { content: "", variant: "body", align: "left" } }).where(eq(pageBlocks.id, textBlockId));
    await expect(c.publish.publish({ projectId, expectedRevision: before.project.projectDraftRevision })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const statusAfter = await c.publish.status({ projectId });
    expect(statusAfter.publishedRevisionId).toBe(statusBefore.publishedRevisionId);
    expect(statusAfter.isPublished).toBe(statusBefore.isPublished);
    await db.update(pageBlocks).set({ props: broken[0].props as any }).where(eq(pageBlocks.id, textBlockId));
    const otherCaller = caller(other);
    await expect(otherCaller.publish.publish({ projectId, expectedRevision: before.project.projectDraftRevision })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(otherCaller.publish.unpublish({ projectId, expectedPublishedRevisionId: statusBefore.publishedRevisionId! })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("guards stale Unpublish from removing a concurrent Re-publish pointer", async () => {
    const c = caller(owner);
    const before = await c.publish.status({ projectId });
    const stalePointer = before.publishedRevisionId!;
    const draft = await c.architect.state({ projectId });
    const [republishResult, staleUnpublishResult] = await Promise.allSettled([
      c.publish.publish({ projectId, expectedRevision: draft.project.projectDraftRevision }),
      c.publish.unpublish({ projectId, expectedPublishedRevisionId: stalePointer }),
    ]);
    expect(republishResult.status).toBe("fulfilled");
    const republishedId = (republishResult as PromiseFulfilledResult<{ publishedRevisionId: number }>).value.publishedRevisionId;
    if (staleUnpublishResult.status === "rejected") expect(staleUnpublishResult.reason).toMatchObject({ code: "CONFLICT" });
    const after = await c.publish.status({ projectId });
    expect(after.isPublished).toBe(true);
    expect(after.publishedRevisionId).toBe(republishedId);
    await expect(c.publish.unpublish({ projectId, expectedPublishedRevisionId: stalePointer })).rejects.toMatchObject({ code: "CONFLICT" });
    const guarded = await c.publish.status({ projectId });
    expect(guarded.publishedRevisionId).toBe(republishedId);
  });

  it("unpublishes to public 404 without changing Draft and guards unsupported schema", async () => {
    const c = caller(owner);
    const before = await c.architect.state({ projectId });
    const publishedStatus = await c.publish.status({ projectId });
    await c.publish.unpublish({ projectId, expectedPublishedRevisionId: publishedStatus.publishedRevisionId! });
    const after = await c.architect.state({ projectId });
    expect(after.project.projectDraftRevision).toBe(before.project.projectDraftRevision);
    await expect(getPublicSnapshot({ projectSlug: (await c.publish.status({ projectId })).projectSlug })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const unpublishedResponse = await fetch(`${publicBaseUrl}/site/${(await c.publish.status({ projectId })).projectSlug}`);
    expect(unpublishedResponse.status).toBe(404);
    const republished = await c.publish.publish({ projectId, expectedRevision: before.project.projectDraftRevision });
    await db.update(publishedRevisions).set({ schemaVersion: "999" }).where(eq(publishedRevisions.id, republished.publishedRevisionId));
    await expect(getPublicSnapshot({ projectSlug: republished.projectSlug })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.update(publishedRevisions).set({ schemaVersion: "1" }).where(eq(publishedRevisions.id, republished.publishedRevisionId));
  });
});
