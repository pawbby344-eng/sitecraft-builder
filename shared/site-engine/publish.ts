import { z } from "zod";
import { projectSlugSchema, themeSchema } from "./schemas";

export const supportedPublishedSchemaVersion = "1" as const;

export const publishInputSchema = z.object({
  projectId: z.number().int().positive(),
  expectedRevision: z.number().int().positive(),
}).strict();

export const publicPageInputSchema = z.object({
  projectSlug: projectSlugSchema,
  pageSlug: z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
}).strict();

export const publishedBlockSchema = z.object({
  id: z.number().int().positive(),
  pageId: z.number().int().positive(),
  parentBlockId: z.number().int().positive().nullable(),
  type: z.enum(["section", "text", "image", "button"]),
  sortOrder: z.number().int().nonnegative(),
  props: z.unknown(),
}).strict();

export const publishedPageSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  pageSlug: z.string().min(1),
  purpose: z.string().nullable(),
  isHome: z.boolean(),
  blocks: z.array(publishedBlockSchema),
}).strict();

export const publishedSnapshotSchema = z.object({
  schemaVersion: z.literal(supportedPublishedSchemaVersion),
  project: z.object({ id: z.number().int().positive(), name: z.string().min(1), projectSlug: projectSlugSchema }).strict(),
  theme: themeSchema,
  pages: z.array(publishedPageSchema).min(1),
}).strict();
export type PublishedSnapshot = z.infer<typeof publishedSnapshotSchema>;
