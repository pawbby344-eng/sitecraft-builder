import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { pageBlocks, pages, projects, publishedRevisions } from "../drizzle/schema";
import { projectSlugSchema, themeSchema } from "../shared/site-engine/schemas";
import { publishedSnapshotSchema, publishInputSchema, publicPageInputSchema, supportedPublishedSchemaVersion } from "../shared/site-engine/publish";
import { getDb } from "./db";
import { assertExpectedRevision, validateDraftBlockSet } from "./site-engine";

function requiredDb() {
  return getDb().then((db) => {
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    return db;
  });
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

async function loadOwnedDraft(ownerId: number, projectId: number) {
  const db = await requiredDb();
  const projectRows = await db.select({ id: projects.id, ownerId: projects.ownerId, name: projects.name, projectSlug: projects.projectSlug, projectDraftRevision: projects.projectDraftRevision, theme: projects.theme, publishedRevisionId: projects.publishedRevisionId, isPublished: projects.isPublished }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
  const project = projectRows[0];
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  const projectPages = await db.select({ id: pages.id, projectId: pages.projectId, name: pages.name, pageSlug: pages.pageSlug, purpose: pages.purpose, isHome: pages.isHome }).from(pages).where(eq(pages.projectId, projectId));
  const blocks = projectPages.length ? await db.select({ id: pageBlocks.id, pageId: pageBlocks.pageId, parentBlockId: pageBlocks.parentBlockId, type: pageBlocks.type, sortOrder: pageBlocks.sortOrder, props: pageBlocks.props }).from(pageBlocks).where(eq(pageBlocks.pageId, projectPages[0]!.id)) : [];
  const allBlocks = projectPages.length ? await Promise.all(projectPages.map((page) => db.select({ id: pageBlocks.id, pageId: pageBlocks.pageId, parentBlockId: pageBlocks.parentBlockId, type: pageBlocks.type, sortOrder: pageBlocks.sortOrder, props: pageBlocks.props }).from(pageBlocks).where(eq(pageBlocks.pageId, page.id)))) : [];
  return { db, project, pages: projectPages, blocks: allBlocks.flat().map((block) => ({ ...block, props: parseJson(block.props) })) };
}

function buildSnapshot(draft: Awaited<ReturnType<typeof loadOwnedDraft>>) {
  projectSlugSchema.parse(draft.project.projectSlug);
  const homePages = draft.pages.filter((page) => page.isHome);
  if (homePages.length !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Exactly one home page is required" });
  if (new Set(draft.pages.map((page) => page.pageSlug)).size !== draft.pages.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Page slugs must be unique" });
  const theme = themeSchema.safeParse(parseJson(draft.project.theme));
  if (!theme.success) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid project theme" });
  const blocks = draft.blocks.map((block) => ({ ...block, props: parseJson(block.props) }));
  const validated = validateDraftBlockSet(blocks);
  const normalizedBlocks = validated.normalizedBlocks.map((block) => ({ ...block, props: blocks.find((candidate) => candidate.id === block.id)?.props }));
  const snapshot = publishedSnapshotSchema.parse({
    schemaVersion: supportedPublishedSchemaVersion,
    project: { id: draft.project.id, name: draft.project.name, projectSlug: draft.project.projectSlug },
    theme: theme.data,
    pages: draft.pages.map((page) => ({ id: page.id, name: page.name, pageSlug: page.pageSlug, purpose: page.purpose ?? null, isHome: page.isHome, blocks: normalizedBlocks.filter((block) => block.pageId === page.id).sort((a, b) => a.sortOrder - b.sortOrder) })),
  });
  return snapshot;
}

export async function publishDraft(ownerId: number, rawInput: unknown) {
  const input = publishInputSchema.parse(rawInput);
  const draft = await loadOwnedDraft(ownerId, input.projectId);
  assertExpectedRevision(draft.project.projectDraftRevision, input.expectedRevision);
  const snapshot = buildSnapshot(draft);
  return draft.db.transaction(async (tx: any) => {
    const latest = await tx.select({ id: publishedRevisions.id, revisionNumber: publishedRevisions.revisionNumber }).from(publishedRevisions).where(eq(publishedRevisions.projectId, input.projectId)).orderBy(desc(publishedRevisions.revisionNumber)).limit(1);
    const revisionNumber = (latest[0]?.revisionNumber ?? 0) + 1;
    const inserted = await tx.insert(publishedRevisions).values({ projectId: input.projectId, revisionNumber, schemaVersion: supportedPublishedSchemaVersion, snapshot }).$returningId();
    const revisionId = Number(inserted[0]?.id);
    const updated = await tx.update(projects).set({ publishedRevisionId: revisionId, isPublished: true }).where(and(eq(projects.id, input.projectId), eq(projects.ownerId, ownerId), eq(projects.projectDraftRevision, input.expectedRevision)));
    if (updated[0]?.affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "Draft revision is stale" });
    return { publishedRevisionId: revisionId, revisionNumber, projectSlug: draft.project.projectSlug };
  });
}

export async function unpublishProject(ownerId: number, projectId: number) {
  const db = await requiredDb();
  return db.transaction(async (tx: any) => {
    const updated = await tx.update(projects).set({ publishedRevisionId: null, isPublished: false }).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
    if (updated[0]?.affectedRows !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    return { unpublished: true };
  });
}

export async function getPublishStatus(ownerId: number, projectId: number) {
  const db = await requiredDb();
  const rows = await db.select({ id: projects.id, projectSlug: projects.projectSlug, publishedRevisionId: projects.publishedRevisionId, isPublished: projects.isPublished }).from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  const revision = rows[0].publishedRevisionId ? await db.select({ id: publishedRevisions.id, revisionNumber: publishedRevisions.revisionNumber, publishedAt: publishedRevisions.publishedAt, schemaVersion: publishedRevisions.schemaVersion }).from(publishedRevisions).where(eq(publishedRevisions.id, rows[0].publishedRevisionId)).limit(1) : [];
  return { ...rows[0], revision: revision[0] ?? null };
}

export async function getPublicSnapshot(rawInput: unknown) {
  const input = publicPageInputSchema.parse(rawInput);
  const db = await requiredDb();
  const projectRows = await db.select({ id: projects.id, publishedRevisionId: projects.publishedRevisionId, isPublished: projects.isPublished }).from(projects).where(and(eq(projects.projectSlug, input.projectSlug), eq(projects.isPublished, true))).limit(1);
  const project = projectRows[0];
  if (!project?.publishedRevisionId) throw new TRPCError({ code: "NOT_FOUND", message: "Published site not found" });
  const revisions = await db.select({ schemaVersion: publishedRevisions.schemaVersion, snapshot: publishedRevisions.snapshot }).from(publishedRevisions).where(and(eq(publishedRevisions.id, project.publishedRevisionId), eq(publishedRevisions.projectId, project.id))).limit(1);
  const revision = revisions[0];
  if (!revision || revision.schemaVersion !== supportedPublishedSchemaVersion) throw new TRPCError({ code: "NOT_FOUND", message: "Published schema is unsupported" });
  const snapshot = publishedSnapshotSchema.parse(parseJson(revision.snapshot));
  if (input.pageSlug && !snapshot.pages.some((page) => page.pageSlug === input.pageSlug)) throw new TRPCError({ code: "NOT_FOUND", message: "Published page not found" });
  return snapshot;
}
