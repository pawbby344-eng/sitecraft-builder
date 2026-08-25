import { z } from "zod";
import { blockPropsByType, themeSchema } from "./schemas";

export const editScopeTypeSchema = z.enum(["block", "section", "page", "theme"]);
export type EditScopeType = z.infer<typeof editScopeTypeSchema>;

const blockTypeSchema = z.enum(["section", "text", "image", "button"]);

export const blockProposalChangeSchema = z.object({
  kind: z.literal("blockProps"),
  pageId: z.number().int().positive(),
  blockId: z.number().int().positive(),
  blockType: blockTypeSchema,
  props: z.unknown(),
}).strict();

export const themeProposalChangeSchema = z.object({
  kind: z.literal("theme"),
  props: themeSchema,
}).strict();

export const proposalChangeSchema = z.discriminatedUnion("kind", [blockProposalChangeSchema, themeProposalChangeSchema]);

export const proposalSchema = z.object({
  schemaVersion: z.literal("1"),
  scopeType: editScopeTypeSchema,
  scopeId: z.number().int().positive().nullable(),
  baseDraftRevision: z.number().int().positive(),
  baseFingerprint: z.string().length(64).regex(/^[a-f0-9]+$/),
  instruction: z.string().min(1).max(2000),
  summary: z.string().min(1).max(500),
  changes: z.array(proposalChangeSchema).min(1).max(20),
}).strict();
export type EditProposal = z.infer<typeof proposalSchema>;

export const createProposalInputSchema = z.object({
  projectId: z.number().int().positive(),
  scopeType: editScopeTypeSchema,
  scopeId: z.number().int().positive().nullable(),
  instruction: z.string().trim().min(1).max(2000),
}).strict();

export const proposalIdInputSchema = z.object({
  projectId: z.number().int().positive(),
  proposalId: z.number().int().positive(),
}).strict();

export const applyProposalInputSchema = proposalIdInputSchema.extend({
  expectedRevision: z.number().int().positive(),
}).strict();

export const lockInputSchema = z.object({
  projectId: z.number().int().positive(),
  scopeType: z.enum(["block", "section", "theme"]),
  scopeId: z.number().int().positive().nullable(),
  locked: z.boolean(),
}).strict();

export function validateProposalChange(change: EditProposal["changes"][number]) {
  if (change.kind === "theme") return themeSchema.parse(change.props);
  return blockPropsByType[change.blockType].parse(change.props);
}
