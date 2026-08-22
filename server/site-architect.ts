import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { pageBlocks, pages, projectBriefs, projectIdeas, projects, siteSpecs } from "../drizzle/schema";
import { briefSchema, siteSpecSchema, type Brief, type SiteSpec } from "../shared/site-engine/architect";
import { projectSlugSchema, themeSchema } from "../shared/site-engine/schemas";
import { getDb } from "./db";
import { defaultTheme, getAIProvider } from "./ai-provider";
import { validateDraftBlockSet, assertExpectedRevision } from "./site-engine";

type OwnerProject = { id: number; ownerId: number; name: string; projectSlug: string; projectDraftRevision: number; theme: unknown };

type BuildBlock = {
  id: number;
  pageId: number;
  parentBlockId: number | null;
  type: "section" | "text" | "image" | "button";
  sortOrder: number;
  props: unknown;
};

function dbRequired() {
  return getDb().then((db) => {
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    return db;
  });
}

function requireText(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new TRPCError({ code: "BAD_REQUEST", message: `${field} is required` });
  return normalized;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  return value;
}

export function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

async function ownerProject(projectId: number, ownerId: number, tx?: any): Promise<OwnerProject> {
  const db = tx ?? await dbRequired();
  const rows = await db.select({ id: projects.id, ownerId: projects.ownerId, name: projects.name, projectSlug: projects.projectSlug, projectDraftRevision: projects.projectDraftRevision, theme: projects.theme })
    .from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
  const project = rows[0];
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  return project;
}

async function latestIdea(projectId: number, ownerId: number, tx?: any) {
  const db = tx ?? await dbRequired();
  await ownerProject(projectId, ownerId, db);
  const rows = await db.select().from(projectIdeas).where(eq(projectIdeas.projectId, projectId)).orderBy(desc(projectIdeas.updatedAt)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "IDEA not found" });
  return rows[0];
}

async function latestBrief(projectId: number, ownerId: number, tx?: any) {
  const db = tx ?? await dbRequired();
  await ownerProject(projectId, ownerId, db);
  const rows = await db.select().from(projectBriefs).where(eq(projectBriefs.projectId, projectId)).orderBy(desc(projectBriefs.updatedAt)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Brief not found" });
  return rows[0];
}

async function latestSpec(projectId: number, ownerId: number, tx?: any) {
  const db = tx ?? await dbRequired();
  await ownerProject(projectId, ownerId, db);
  const rows = await db.select().from(siteSpecs).where(eq(siteSpecs.projectId, projectId)).orderBy(desc(siteSpecs.updatedAt)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "SiteSpec not found" });
  return rows[0];
}

export async function createProject(ownerId: number, input: { name: string; projectSlug: string; idea: string }) {
  const name = requireText(input.name, "Project name");
  const idea = requireText(input.idea, "IDEA");
  const projectSlug = projectSlugSchema.parse(input.projectSlug);
  const db = await dbRequired();
  return db.transaction(async (tx: any) => {
    const inserted = await tx.insert(projects).values({ ownerId, name, projectSlug, projectDraftRevision: 1, theme: defaultTheme, isPublished: false });
    const projectId = Number(inserted[0].insertId);
    const ideaInsert = await tx.insert(projectIdeas).values({ projectId, inputText: idea });
    return { projectId, ideaId: Number(ideaInsert[0].insertId), revision: 1 };
  });
}

export async function saveIdea(ownerId: number, input: { projectId: number; idea: string }) {
  const idea = requireText(input.idea, "IDEA");
  const db = await dbRequired();
  await ownerProject(input.projectId, ownerId, db);
  return db.transaction(async (tx: any) => {
    const existing = await tx.select({ id: projectIdeas.id }).from(projectIdeas).where(eq(projectIdeas.projectId, input.projectId)).orderBy(desc(projectIdeas.updatedAt)).limit(1);
    if (existing[0]) {
      await tx.update(projectIdeas).set({ inputText: idea }).where(eq(projectIdeas.id, existing[0].id));
      return { ideaId: existing[0].id };
    }
    const inserted = await tx.insert(projectIdeas).values({ projectId: input.projectId, inputText: idea });
    return { ideaId: Number(inserted[0].insertId) };
  });
}

export async function createBrief(ownerId: number, input: { projectId: number }) {
  const db = await dbRequired();
  const project = await ownerProject(input.projectId, ownerId, db);
  const idea = await latestIdea(input.projectId, ownerId, db);
  const brief = await getAIProvider().generateBrief(idea.inputText, project.name);
  const validated = briefSchema.parse(brief);
  const inserted = await db.insert(projectBriefs).values({ projectId: input.projectId, inputText: idea.inputText, brief: validated, status: "draft" });
  return { briefId: Number(inserted[0].insertId), brief: validated, status: "draft" as const };
}

export async function updateBrief(ownerId: number, input: { projectId: number; briefId: number; brief: Brief }) {
  const validated = briefSchema.parse(input.brief);
  const db = await dbRequired();
  const project = await ownerProject(input.projectId, ownerId, db);
  const idea = await latestIdea(input.projectId, ownerId, db);
  const updated = await db.update(projectBriefs).set({ inputText: idea.inputText, brief: validated, status: "draft" })
    .where(and(eq(projectBriefs.id, input.briefId), eq(projectBriefs.projectId, project.id)));
  if (updated[0]?.affectedRows !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Brief not found" });
  return { briefId: input.briefId, status: "draft" as const, brief: validated };
}

export async function confirmBrief(ownerId: number, input: { projectId: number; briefId: number }) {
  const db = await dbRequired();
  await ownerProject(input.projectId, ownerId, db);
  const row = await db.select().from(projectBriefs).where(and(eq(projectBriefs.id, input.briefId), eq(projectBriefs.projectId, input.projectId))).limit(1);
  if (!row[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Brief not found" });
  const validated = briefSchema.parse(row[0].brief);
  await db.update(projectBriefs).set({ brief: validated, status: "confirmed" }).where(eq(projectBriefs.id, input.briefId));
  return { briefId: input.briefId, status: "confirmed" as const, fingerprint: fingerprint(validated) };
}

export async function generateSiteSpec(ownerId: number, input: { projectId: number; briefId: number }) {
  const db = await dbRequired();
  const project = await ownerProject(input.projectId, ownerId, db);
  const idea = await latestIdea(input.projectId, ownerId, db);
  const briefRow = await db.select().from(projectBriefs).where(and(eq(projectBriefs.id, input.briefId), eq(projectBriefs.projectId, input.projectId))).limit(1);
  const brief = briefRow[0];
  if (!brief) throw new TRPCError({ code: "NOT_FOUND", message: "Brief not found" });
  if (brief.status !== "confirmed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Brief must be confirmed before SiteSpec" });
  const validatedBrief = briefSchema.parse(brief.brief);
  const spec = await getAIProvider().generateSiteSpec({ idea: idea.inputText, brief: validatedBrief, projectName: project.name, projectSlug: project.projectSlug, sourceBriefFingerprint: fingerprint(validatedBrief) });
  const validatedSpec = siteSpecSchema.parse(spec);
  const inserted = await db.insert(siteSpecs).values({ projectId: input.projectId, briefId: input.briefId, spec: validatedSpec, schemaVersion: "1", status: "draft" });
  return { siteSpecId: Number(inserted[0].insertId), spec: validatedSpec, status: "draft" as const };
}

export async function confirmSiteSpec(ownerId: number, input: { projectId: number; siteSpecId: number }) {
  const db = await dbRequired();
  await ownerProject(input.projectId, ownerId, db);
  const rows = await db.select().from(siteSpecs).where(and(eq(siteSpecs.id, input.siteSpecId), eq(siteSpecs.projectId, input.projectId))).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "SiteSpec not found" });
  const spec = siteSpecSchema.parse(rows[0].spec);
  const brief = await latestBrief(input.projectId, ownerId, db);
  if (fingerprint(briefSchema.parse(brief.brief)) !== spec.sourceBriefFingerprint) throw new TRPCError({ code: "CONFLICT", message: "SiteSpec source Brief is stale" });
  await db.update(siteSpecs).set({ spec, status: "confirmed" }).where(eq(siteSpecs.id, input.siteSpecId));
  return { siteSpecId: input.siteSpecId, status: "confirmed" as const };
}

export function validateSiteSpecForBuild(input: unknown): SiteSpec {
  const spec = siteSpecSchema.parse(input);
  const buildRows: BuildBlock[] = [];
  let tempBlockId = -1;
  for (let pageIndex = 0; pageIndex < spec.pages.length; pageIndex += 1) {
    const pageSpec = spec.pages[pageIndex];
    const tempPageId = -(pageIndex + 1);
    for (let sectionIndex = 0; sectionIndex < pageSpec.sections.length; sectionIndex += 1) {
      const section = pageSpec.sections[sectionIndex];
      const sectionId = tempBlockId--;
      buildRows.push({ id: sectionId, pageId: tempPageId, parentBlockId: null, type: "section", sortOrder: sectionIndex, props: section.props });
      for (let contentIndex = 0; contentIndex < section.blocks.length; contentIndex += 1) {
        const content = section.blocks[contentIndex];
        buildRows.push({ id: tempBlockId--, pageId: tempPageId, parentBlockId: sectionId, type: content.type, sortOrder: contentIndex, props: content.props });
      }
    }
    validateDraftBlockSet(buildRows.filter((row) => row.pageId === tempPageId));
  }
  return spec;
}

async function buildFromSpec(tx: any, project: OwnerProject, spec: SiteSpec, expectedRevision: number) {
  spec = validateSiteSpecForBuild(spec);
  const currentBrief = await tx.select().from(projectBriefs).where(eq(projectBriefs.projectId, project.id)).orderBy(desc(projectBriefs.updatedAt)).limit(1);
  if (!currentBrief[0] || currentBrief[0].status !== "confirmed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirmed Brief is required" });
  if (fingerprint(briefSchema.parse(currentBrief[0].brief)) !== spec.sourceBriefFingerprint) throw new TRPCError({ code: "CONFLICT", message: "SiteSpec source Brief is stale" });
  if (project.projectSlug !== spec.projectSlug) throw new TRPCError({ code: "BAD_REQUEST", message: "SiteSpec projectSlug cannot change during Build" });
  themeSchema.parse(spec.theme);

  const oldPages = await tx.select({ id: pages.id }).from(pages).where(eq(pages.projectId, project.id));
  const oldPageIds = oldPages.map((row: { id: number }) => row.id);
  if (oldPageIds.length) await tx.delete(pageBlocks).where(inArray(pageBlocks.pageId, oldPageIds));
  await tx.delete(pages).where(eq(pages.projectId, project.id));

  const actualRows: BuildBlock[] = [];
  for (let pageIndex = 0; pageIndex < spec.pages.length; pageIndex += 1) {
    const pageSpec = spec.pages[pageIndex];
    const pageInsert = await tx.insert(pages).values({ projectId: project.id, name: pageSpec.name, pageSlug: pageSpec.slug, purpose: pageSpec.purpose, isHome: pageSpec.isHome });
    const pageId = Number(pageInsert[0].insertId);
    for (let sectionIndex = 0; sectionIndex < pageSpec.sections.length; sectionIndex += 1) {
      const section = pageSpec.sections[sectionIndex];
      const sectionInsert = await tx.insert(pageBlocks).values({ pageId, parentBlockId: null, type: "section", sortOrder: sectionIndex, props: section.props });
      const sectionId = Number(sectionInsert[0].insertId);
      actualRows.push({ id: sectionId, pageId, parentBlockId: null, type: "section", sortOrder: sectionIndex, props: section.props });
      for (let contentIndex = 0; contentIndex < section.blocks.length; contentIndex += 1) {
        const content = section.blocks[contentIndex];
        const contentInsert = await tx.insert(pageBlocks).values({ pageId, parentBlockId: sectionId, type: content.type, sortOrder: contentIndex, props: content.props });
        actualRows.push({ id: Number(contentInsert[0].insertId), pageId, parentBlockId: sectionId, type: content.type, sortOrder: contentIndex, props: content.props });
      }
    }
    validateDraftBlockSet(actualRows.filter((row) => row.pageId === pageId));
  }

  const updated = await tx.update(projects).set({ name: spec.projectName, theme: spec.theme, projectDraftRevision: expectedRevision + 1 })
    .where(and(eq(projects.id, project.id), eq(projects.ownerId, project.ownerId), eq(projects.projectDraftRevision, expectedRevision)));
  if (updated[0]?.affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "Draft revision is stale" });
  return { revision: expectedRevision + 1, pageCount: spec.pages.length, blockCount: actualRows.length };
}

export async function applySiteSpec(ownerId: number, input: { projectId: number; siteSpecId: number; expectedRevision: number }) {
  const db = await dbRequired();
  return db.transaction(async (tx: any) => {
    const project = await ownerProject(input.projectId, ownerId, tx);
    assertExpectedRevision(project.projectDraftRevision, input.expectedRevision);
    const rows = await tx.select().from(siteSpecs).where(and(eq(siteSpecs.id, input.siteSpecId), eq(siteSpecs.projectId, input.projectId))).limit(1);
    const stored = rows[0];
    if (!stored) throw new TRPCError({ code: "NOT_FOUND", message: "SiteSpec not found" });
    if (stored.status !== "confirmed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "SiteSpec must be confirmed before Apply" });
    const spec = siteSpecSchema.parse(stored.spec);
    const result = await buildFromSpec(tx, project, spec, input.expectedRevision);
    return { siteSpecId: input.siteSpecId, applied: true as const, ...result };
  });
}

export async function getArchitectState(ownerId: number, projectId: number) {
  const idea = await latestIdea(projectId, ownerId);
  const brief = await latestBrief(projectId, ownerId).catch(() => null);
  const spec = await latestSpec(projectId, ownerId).catch(() => null);
  const project = await ownerProject(projectId, ownerId);
  return { project, idea, brief, spec };
}
