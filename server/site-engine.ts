import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { pageBlocks, pages, projects } from "../drizzle/schema";
import {
  blockPropsByType,
  reorderSchema,
  replaceAllSchema,
} from "../shared/site-engine/schemas";
import { validatePageBlockHierarchy, type HierarchyBlock } from "../shared/page-blocks/validator";
import { getDb } from "./db";

type BlockMutation = {
  projectId: number;
  pageId: number;
  expectedRevision: number;
  parentBlockId: number | null;
  type: "section" | "text" | "image" | "button";
  sortOrder: number;
  props: unknown;
};

type BlockUpdate = BlockMutation & { blockId: number };

type BlockRow = {
  id: number;
  pageId: number;
  parentBlockId: number | null;
  type: "section" | "text" | "image" | "button";
  sortOrder: number;
  props: unknown;
};

function databaseRequired() {
  return getDb().then((db) => {
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    return db;
  });
}

export async function assertProjectOwnership(projectId: number, ownerId: number) {
  const db = await databaseRequired();
  const rows = await db.select({ id: projects.id, draftRevision: projects.projectDraftRevision }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
  const project = rows[0];
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  return project;
}

export async function assertPageOwnership(pageId: number, projectId: number, ownerId: number) {
  const db = await databaseRequired();
  const rows = await db.select({ id: pages.id, projectId: pages.projectId }).from(pages)
    .innerJoin(projects, eq(projects.id, pages.projectId))
    .where(and(eq(pages.id, pageId), eq(pages.projectId, projectId), eq(projects.ownerId, ownerId))).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
  return rows[0];
}

export async function assertBlockOwnership(blockId: number, pageId: number, projectId: number, ownerId: number) {
  const db = await databaseRequired();
  const rows = await db.select({ id: pageBlocks.id, pageId: pageBlocks.pageId }).from(pageBlocks)
    .innerJoin(pages, eq(pages.id, pageBlocks.pageId))
    .innerJoin(projects, eq(projects.id, pages.projectId))
    .where(and(eq(pageBlocks.id, blockId), eq(pageBlocks.pageId, pageId), eq(pages.projectId, projectId), eq(projects.ownerId, ownerId))).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Block not found" });
  return rows[0];
}

export function validateProps(type: BlockMutation["type"], props: unknown) {
  const parsed = blockPropsByType[type].safeParse(props);
  if (!parsed.success) throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid ${type} props` });
  return parsed.data;
}

export function assertExpectedRevision(actual: number, expected: number) {
  if (actual !== expected) throw new TRPCError({ code: "CONFLICT", message: "Draft revision is stale" });
}

function hierarchyRows(rows: BlockRow[]): HierarchyBlock[] {
  return rows.map(({ id, pageId, parentBlockId, type, sortOrder }) => ({ id, pageId, parentBlockId, type, sortOrder }));
}

export function validateDraftBlockSet(rows: BlockRow[]) {
  rows.forEach((row) => validateProps(row.type, row.props));
  return validatePageBlockHierarchy(hierarchyRows(rows));
}

async function readPageBlocks(db: Awaited<ReturnType<typeof databaseRequired>>, pageId: number): Promise<BlockRow[]> {
  return db.select({ id: pageBlocks.id, pageId: pageBlocks.pageId, parentBlockId: pageBlocks.parentBlockId, type: pageBlocks.type, sortOrder: pageBlocks.sortOrder, props: pageBlocks.props })
    .from(pageBlocks).where(eq(pageBlocks.pageId, pageId));
}

async function bumpRevision(tx: any, projectId: number, expectedRevision: number) {
  const updated = await tx.update(projects).set({ projectDraftRevision: expectedRevision + 1 })
    .where(and(eq(projects.id, projectId), eq(projects.projectDraftRevision, expectedRevision)));
  if (updated[0]?.affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "Draft revision is stale" });
  return expectedRevision + 1;
}

export async function createBlock(ownerId: number, input: BlockMutation) {
  validateProps(input.type, input.props);
  const db = await databaseRequired();
  await assertPageOwnership(input.pageId, input.projectId, ownerId);
  const result = await db.transaction(async (tx: any) => {
    const projectRows = await tx.select({ draftRevision: projects.projectDraftRevision }).from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.ownerId, ownerId))).limit(1);
    const project = projectRows[0];
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    assertExpectedRevision(project.draftRevision, input.expectedRevision);
    const existing = await tx.select({ id: pageBlocks.id, pageId: pageBlocks.pageId, parentBlockId: pageBlocks.parentBlockId, type: pageBlocks.type, sortOrder: pageBlocks.sortOrder, props: pageBlocks.props }).from(pageBlocks).where(eq(pageBlocks.pageId, input.pageId));
    const candidate = { id: -1, pageId: input.pageId, parentBlockId: input.parentBlockId, type: input.type, sortOrder: input.sortOrder, props: input.props } as BlockRow;
    validateDraftBlockSet([...existing, candidate]);
    await tx.insert(pageBlocks).values({ pageId: input.pageId, parentBlockId: input.parentBlockId, type: input.type, sortOrder: input.sortOrder, props: input.props as any });
    return { revision: await bumpRevision(tx, input.projectId, input.expectedRevision) };
  });
  return result;
}

export async function updateBlock(ownerId: number, input: BlockUpdate) {
  validateProps(input.type, input.props);
  const db = await databaseRequired();
  await assertBlockOwnership(input.blockId, input.pageId, input.projectId, ownerId);
  return db.transaction(async (tx: any) => {
    const projectRows = await tx.select({ draftRevision: projects.projectDraftRevision }).from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.ownerId, ownerId))).limit(1);
    const project = projectRows[0];
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    assertExpectedRevision(project.draftRevision, input.expectedRevision);
    const existing = await tx.select({ id: pageBlocks.id, pageId: pageBlocks.pageId, parentBlockId: pageBlocks.parentBlockId, type: pageBlocks.type, sortOrder: pageBlocks.sortOrder, props: pageBlocks.props }).from(pageBlocks).where(eq(pageBlocks.pageId, input.pageId));
    const next = existing.map((row: BlockRow) => row.id === input.blockId ? { ...row, parentBlockId: input.parentBlockId, type: input.type, sortOrder: input.sortOrder, props: input.props } : row);
    validateDraftBlockSet(next);
    await tx.update(pageBlocks).set({ parentBlockId: input.parentBlockId, type: input.type, sortOrder: input.sortOrder, props: input.props as any })
      .where(and(eq(pageBlocks.id, input.blockId), eq(pageBlocks.pageId, input.pageId)));
    return { revision: await bumpRevision(tx, input.projectId, input.expectedRevision) };
  });
}

async function replaceRows(tx: any, pageId: number, rows: BlockRow[]) {
  const current = (await tx.select({ id: pageBlocks.id }).from(pageBlocks).where(eq(pageBlocks.pageId, pageId))) as Array<{ id: number }>;
  const currentIds = new Set<number>(current.map((row) => row.id));
  const nextIds = new Set(rows.map((row) => row.id));
  if (rows.some((row) => !currentIds.has(row.id))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "replaceAll cannot introduce unknown block ids" });
  }

  // Update existing rows first so children can be safely reparented before stale parents are deleted.
  for (const row of rows) {
    await tx.update(pageBlocks).set({ parentBlockId: row.parentBlockId, type: row.type, sortOrder: row.sortOrder, props: row.props as any })
      .where(and(eq(pageBlocks.id, row.id), eq(pageBlocks.pageId, pageId)));
  }

  const staleIds: number[] = Array.from(currentIds).filter((id) => !nextIds.has(id));
  if (staleIds.length) {
    await tx.delete(pageBlocks).where(and(eq(pageBlocks.pageId, pageId), inArray(pageBlocks.id, staleIds)));
  }
}

export async function reorderBlocks(ownerId: number, input: z.infer<typeof reorderSchema>) {
  const db = await databaseRequired();
  await assertPageOwnership(input.pageId, input.projectId, ownerId);
  return db.transaction(async (tx: any) => {
    const projectRows = await tx.select({ draftRevision: projects.projectDraftRevision }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.ownerId, ownerId))).limit(1);
    const project = projectRows[0];
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    assertExpectedRevision(project.draftRevision, input.expectedRevision);
    const current = await tx.select({ id: pageBlocks.id, pageId: pageBlocks.pageId, parentBlockId: pageBlocks.parentBlockId, type: pageBlocks.type, sortOrder: pageBlocks.sortOrder, props: pageBlocks.props }).from(pageBlocks).where(eq(pageBlocks.pageId, input.pageId));
    const ids = new Set(current.map((row: BlockRow) => row.id));
    if (input.blocks.length !== current.length || input.blocks.some((row) => !ids.has(row.id))) throw new TRPCError({ code: "BAD_REQUEST", message: "Reorder must include exactly this page's blocks" });
    const validated = validateDraftBlockSet(input.blocks as BlockRow[]);
    const normalized = validated.normalizedBlocks.map((row) => ({ ...row, props: input.blocks.find((candidate: z.infer<typeof reorderSchema>["blocks"][number]) => candidate.id === row.id)?.props }));
    await replaceRows(tx, input.pageId, normalized as BlockRow[]);
    return { revision: await bumpRevision(tx, input.projectId, input.expectedRevision) };
  });
}

export async function replaceAllBlocks(ownerId: number, input: z.infer<typeof replaceAllSchema>) {
  const db = await databaseRequired();
  await assertPageOwnership(input.pageId, input.projectId, ownerId);
  return db.transaction(async (tx: any) => {
    const projectRows = await tx.select({ draftRevision: projects.projectDraftRevision }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.ownerId, ownerId))).limit(1);
    const project = projectRows[0];
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    assertExpectedRevision(project.draftRevision, input.expectedRevision);
    const validated = validateDraftBlockSet(input.blocks as BlockRow[]);
    const normalized = validated.normalizedBlocks.map((row) => ({ ...row, props: input.blocks.find((candidate: z.infer<typeof reorderSchema>["blocks"][number]) => candidate.id === row.id)?.props }));
    await replaceRows(tx, input.pageId, normalized as BlockRow[]);
    return { revision: await bumpRevision(tx, input.projectId, input.expectedRevision) };
  });
}
