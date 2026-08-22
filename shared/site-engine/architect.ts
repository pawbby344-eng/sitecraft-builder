import { z } from "zod";
import { buttonPropsSchema, imagePropsSchema, projectSlugSchema, sectionPropsSchema, textPropsSchema, themeSchema } from "./schemas";

export const briefSchema = z.object({
  audience: z.string().min(1).max(500),
  valueProposition: z.string().min(1).max(1000),
  tone: z.enum(["calm", "bold", "editorial", "technical", "warm"]),
  primaryGoal: z.enum(["book", "buy", "contact", "learn", "subscribe"]),
  pages: z.array(z.object({
    name: z.string().min(1).max(120),
    slug: projectSlugSchema,
    purpose: z.string().min(1).max(500),
  }).strict()).min(1).max(8),
}).strict();

export const siteSpecTextSchema = z.object({
  type: z.literal("text"),
  props: textPropsSchema,
}).strict();

export const siteSpecImageSchema = z.object({
  type: z.literal("image"),
  props: imagePropsSchema,
}).strict();

export const siteSpecButtonSchema = z.object({
  type: z.literal("button"),
  props: buttonPropsSchema,
}).strict();

export const siteSpecContentBlockSchema = z.discriminatedUnion("type", [
  siteSpecTextSchema,
  siteSpecImageSchema,
  siteSpecButtonSchema,
]);

export const siteSpecSectionSchema = z.object({
  type: z.literal("section"),
  props: sectionPropsSchema,
  blocks: z.array(siteSpecContentBlockSchema).max(12),
}).strict();

export const siteSpecPageSchema = z.object({
  name: z.string().min(1).max(120),
  slug: projectSlugSchema,
  purpose: z.string().min(1).max(500),
  isHome: z.boolean(),
  sections: z.array(siteSpecSectionSchema).min(1).max(12),
}).strict();

export const siteSpecSchema = z.object({
  schemaVersion: z.literal("1"),
  projectName: z.string().min(1).max(255),
  projectSlug: projectSlugSchema,
  theme: themeSchema,
  pages: z.array(siteSpecPageSchema).min(1).max(8),
  sourceBriefFingerprint: z.string().length(64).regex(/^[a-f0-9]+$/),
}).strict().superRefine((value, ctx) => {
  const slugs = new Set<string>();
  for (const page of value.pages) {
    if (slugs.has(page.slug)) ctx.addIssue({ code: "custom", path: ["pages"], message: `Duplicate page slug: ${page.slug}` });
    slugs.add(page.slug);
  }
  if (value.pages.filter((page) => page.isHome).length !== 1) {
    ctx.addIssue({ code: "custom", path: ["pages"], message: "SiteSpec must contain exactly one home page" });
  }
});

export type Brief = z.infer<typeof briefSchema>;
export type SiteSpec = z.infer<typeof siteSpecSchema>;

export const createProjectStage3Schema = z.object({
  name: z.string().min(1).max(255),
  projectSlug: projectSlugSchema,
  idea: z.string().min(1).max(20000),
}).strict();

export const saveIdeaSchema = z.object({
  projectId: z.number().int().positive(),
  idea: z.string().min(1).max(20000),
}).strict();

export const projectOnlySchema = z.object({ projectId: z.number().int().positive() }).strict();
export const briefIdSchema = z.object({ projectId: z.number().int().positive(), briefId: z.number().int().positive() }).strict();
export const siteSpecIdSchema = z.object({ projectId: z.number().int().positive(), siteSpecId: z.number().int().positive() }).strict();
export const applySiteSpecSchema = siteSpecIdSchema.extend({ expectedRevision: z.number().int().positive() }).strict();
export const updateBriefSchema = briefIdSchema.extend({ brief: briefSchema }).strict();
