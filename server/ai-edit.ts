import { createHash } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { aiProposals, pageBlocks, pages, projects, scopeLocks } from "../drizzle/schema";
import { validatePageBlockHierarchy } from "../shared/page-blocks/validator";
import { blockPropsByType, themeSchema } from "../shared/site-engine/schemas";
import {
  applyProposalInputSchema,
  createProposalInputSchema,
  editScopeTypeSchema,
  lockInputSchema,
  proposalIdInputSchema,
  proposalSchema,
  type EditProposal,
  type EditScopeType,
  validateProposalChange,
} from "../shared/site-engine/ai-edit";
import { getAIProvider } from "./ai-provider";
import { getDb } from "./db";
import { assertExpectedRevision, validateDraftBlockSet } from "./site-engine";

export type DraftEditBlock = {
  id: number;
  pageId: number;
  parentBlockId: number | null;
  type: "section" | "text" | "image" | "button";
  sortOrder: number;
  props: unknown;
};

type DraftContext = {
  project: { id: number; ownerId: number; projectDraftRevision: number; theme: unknown };
  pages: Array<{ id: number; projectId: number; name: string; pageSlug: string }>;
  blocks: DraftEditBlock[];
};

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

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export function draftFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

async function loadContext(ownerId: number, projectId: number): Promise<DraftContext> {
  const db = await requiredDb();
  const projectRows = await db.select({ id: projects.id, ownerId: projects.ownerId, projectDraftRevision: projects.projectDraftRevision, theme: projects.theme }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
  const project = projectRows[0] ? { ...projectRows[0], theme: parseJson(projectRows[0].theme) } : projectRows[0];
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  const projectPages = await db.select({ id: pages.id, projectId: pages.projectId, name: pages.name, pageSlug: pages.pageSlug }).from(pages).where(eq(pages.projectId, projectId));
  const blocks = await db.select({ id: pageBlocks.id, pageId: pageBlocks.pageId, parentBlockId: pageBlocks.parentBlockId, type: pageBlocks.type, sortOrder: pageBlocks.sortOrder, props: pageBlocks.props }).from(pageBlocks)
    .where(inArray(pageBlocks.pageId, projectPages.map((page) => page.id).length ? projectPages.map((page) => page.id) : [-1]));
  return { project, pages: projectPages, blocks: blocks.map((block) => ({ ...block, props: parseJson(block.props) })) };
}

function scopeBlocks(context: DraftContext, scopeType: EditScopeType, scopeId: number | null) {
  if (scopeType === "theme") return [];
  if (scopeType === "page") return context.blocks.filter((block) => block.pageId === scopeId);
  if (scopeType === "section") return context.blocks.filter((block) => block.id === scopeId || block.parentBlockId === scopeId);
  return context.blocks.filter((block) => block.id === scopeId);
}

function scopeFingerprint(context: DraftContext, scopeType: EditScopeType, scopeId: number | null) {
  return draftFingerprint({ scopeType, scopeId, blocks: scopeBlocks(context, scopeType, scopeId), theme: scopeType === "theme" ? context.project.theme : undefined });
}

function validateScope(context: DraftContext, scopeType: EditScopeType, scopeId: number | null) {
  if (scopeType === "theme") {
    if (scopeId !== null) throw new TRPCError({ code: "BAD_REQUEST", message: "Theme scopeId must be null" });
    return;
  }
  if (scopeId === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Selected scope is required" });
  if (scopeType === "page") {
    if (!context.pages.some((page) => page.id === scopeId)) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
    return;
  }
  const block = context.blocks.find((item) => item.id === scopeId);
  if (!block) throw new TRPCError({ code: "NOT_FOUND", message: "Block not found" });
  if (scopeType === "section" && block.type !== "section") throw new TRPCError({ code: "BAD_REQUEST", message: "Section scope requires a section" });
}

function parseStrict<T>(parse: () => T): T {
  try { return parse(); } catch (error) {
    if (error instanceof z.ZodError) throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal validation failed" });
    throw error;
  }
}

function validateProposalForContext(proposal: EditProposal, context: DraftContext) {
  parseStrict(() => proposalSchema.parse(proposal));
  if (proposal.baseDraftRevision !== context.project.projectDraftRevision) throw new TRPCError({ code: "CONFLICT", message: "Proposal revision is stale" });
  if (proposal.baseFingerprint !== scopeFingerprint(context, proposal.scopeType, proposal.scopeId)) throw new TRPCError({ code: "CONFLICT", message: "Proposal scope is stale" });
  validateScope(context, proposal.scopeType, proposal.scopeId);
  if (!proposal.changes.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal has no changes" });
  for (const change of proposal.changes) {
    parseStrict(() => validateProposalChange(change));
    if (change.kind === "blockProps") {
      const block = context.blocks.find((item) => item.id === change.blockId);
      if (!block || block.pageId !== change.pageId || block.type !== change.blockType) throw new TRPCError({ code: "CONFLICT", message: "Proposal target is stale" });
      const inScope = scopeBlocks(context, proposal.scopeType, proposal.scopeId).some((item) => item.id === block.id);
      if (!inScope) throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal changes are outside selected scope" });
    }
  }
}

async function assertNoLocks(ownerId: number, proposal: EditProposal, context: DraftContext) {
  const db = await requiredDb();
  const locks = await db.select().from(scopeLocks).where(and(eq(scopeLocks.projectId, context.project.id), eq(scopeLocks.locked, true)));
  const targetBlocks = scopeBlocks(context, proposal.scopeType, proposal.scopeId);
  for (const lock of locks) {
    if (lock.scopeType === "theme" && proposal.changes.some((change) => change.kind === "theme")) throw new TRPCError({ code: "CONFLICT", message: "Theme scope is locked" });
    if (lock.scopeType === "block" && lock.scopeId !== null && targetBlocks.some((block) => block.id === lock.scopeId)) throw new TRPCError({ code: "CONFLICT", message: "Selected block scope is locked" });
    if (lock.scopeType === "section" && lock.scopeId !== null && targetBlocks.some((block) => block.id === lock.scopeId || block.parentBlockId === lock.scopeId)) throw new TRPCError({ code: "CONFLICT", message: "Selected section scope is locked" });
  }
  void ownerId;
}

export async function createProposal(ownerId: number, rawInput: unknown) {
  const input = createProposalInputSchema.parse(rawInput);
  const context = await loadContext(ownerId, input.projectId);
  validateScope(context, input.scopeType, input.scopeId);
  const proposal = await getAIProvider().proposeEdit({ scopeType: input.scopeType, scopeId: input.scopeId, instruction: input.instruction, baseDraftRevision: context.project.projectDraftRevision, baseFingerprint: scopeFingerprint(context, input.scopeType, input.scopeId), context: { blocks: scopeBlocks(context, input.scopeType, input.scopeId).map(({ id, pageId, parentBlockId, type, props }) => ({ id, pageId, parentBlockId, type, props })), theme: context.project.theme } });
  validateProposalForContext(proposal, context);
  const db = await requiredDb();
  const inserted = await db.insert(aiProposals).values({ projectId: input.projectId, baseDraftRevision: proposal.baseDraftRevision, scopeType: proposal.scopeType, scopeId: proposal.scopeId, proposal }).$returningId();
  return { proposalId: Number(inserted[0]?.id), proposal };
}

export async function getAiEditState(ownerId: number, projectId: number) {
  const context = await loadContext(ownerId, projectId);
  const db = await requiredDb();
  const proposals = await db.select({ id: aiProposals.id, projectId: aiProposals.projectId, baseDraftRevision: aiProposals.baseDraftRevision, scopeType: aiProposals.scopeType, scopeId: aiProposals.scopeId, proposal: aiProposals.proposal, status: aiProposals.status, createdAt: aiProposals.createdAt }).from(aiProposals).where(eq(aiProposals.projectId, projectId));
  const locks = await db.select().from(scopeLocks).where(eq(scopeLocks.projectId, projectId));
  return { projectDraftRevision: context.project.projectDraftRevision, proposals: proposals.map((item) => ({ ...item, proposal: parseJson(item.proposal) })), locks };
}

export async function applyProposal(ownerId: number, rawInput: unknown) {
  const input = applyProposalInputSchema.parse(rawInput);
  const db = await requiredDb();
  const context = await loadContext(ownerId, input.projectId);
  assertExpectedRevision(context.project.projectDraftRevision, input.expectedRevision);
  const rows = await db.select().from(aiProposals).where(and(eq(aiProposals.id, input.proposalId), eq(aiProposals.projectId, input.projectId))).limit(1);
  const row = rows[0];
  if (!row || row.status !== "pending") throw new TRPCError({ code: "CONFLICT", message: "Proposal is no longer pending" });
  const proposal = proposalSchema.parse(parseJson(row.proposal));
  validateProposalForContext(proposal, context);
  await assertNoLocks(ownerId, proposal, context);
  const nextBlocks = context.blocks.map((block) => {
    const change = proposal.changes.find((item) => item.kind === "blockProps" && item.blockId === block.id);
    return change && change.kind === "blockProps" ? { ...block, props: change.props } : block;
  });
  validateDraftBlockSet(nextBlocks);
  const nextTheme = proposal.changes.find((change) => change.kind === "theme")?.props ?? context.project.theme;
  parseStrict(() => themeSchema.parse(nextTheme));
  return db.transaction(async (tx: any) => {
    const revisionUpdate = await tx.update(projects).set({ projectDraftRevision: input.expectedRevision + 1, theme: nextTheme as any }).where(and(eq(projects.id, input.projectId), eq(projects.ownerId, ownerId), eq(projects.projectDraftRevision, input.expectedRevision)));
    if (revisionUpdate[0]?.affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "Draft revision is stale" });
    for (const change of proposal.changes) {
      if (change.kind === "blockProps") await tx.update(pageBlocks).set({ props: change.props as any }).where(and(eq(pageBlocks.id, change.blockId), eq(pageBlocks.pageId, change.pageId)));
    }
    await tx.update(aiProposals).set({ status: "applied" }).where(and(eq(aiProposals.id, input.proposalId), eq(aiProposals.projectId, input.projectId), eq(aiProposals.status, "pending")));
    return { revision: input.expectedRevision + 1, proposalId: input.proposalId };
  });
}

export async function rejectProposal(ownerId: number, rawInput: unknown) {
  const input = proposalIdInputSchema.parse(rawInput);
  const context = await loadContext(ownerId, input.projectId);
  const db = await requiredDb();
  const rows = await db.select({ id: aiProposals.id, status: aiProposals.status }).from(aiProposals).where(and(eq(aiProposals.id, input.proposalId), eq(aiProposals.projectId, context.project.id))).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
  if (rows[0].status !== "pending") throw new TRPCError({ code: "CONFLICT", message: "Proposal is no longer pending" });
  await db.update(aiProposals).set({ status: "rejected" }).where(eq(aiProposals.id, input.proposalId));
  return { rejected: true };
}

export async function setScopeLock(ownerId: number, rawInput: unknown) {
  const input = lockInputSchema.parse(rawInput);
  const context = await loadContext(ownerId, input.projectId);
  validateScope(context, input.scopeType === "theme" ? "theme" : input.scopeType, input.scopeType === "theme" ? null : input.scopeId);
  const db = await requiredDb();
  await db.insert(scopeLocks).values({ projectId: input.projectId, scopeType: input.scopeType, scopeId: input.scopeId, locked: input.locked }).onDuplicateKeyUpdate({ set: { locked: input.locked, updatedAt: new Date() } });
  return { locked: input.locked };
}

export { editScopeTypeSchema };
