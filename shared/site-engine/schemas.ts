import { z } from "zod";

const safeColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value");
const tokenName = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/);

export const projectSlugSchema = z.string().min(3).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

export const themeSchema = z.object({
  typography: z.object({
    fontFamily: z.string().min(1).max(120),
    headingSize: z.number().int().positive().max(128),
    bodySize: z.number().int().positive().max(48),
    headingWeight: z.number().int().min(100).max(900),
    lineHeight: z.number().positive().max(3),
  }).strict(),
  colors: z.object({
    background: safeColor,
    surface: safeColor,
    text: safeColor,
    muted: safeColor,
    primary: safeColor,
    buttonText: safeColor,
  }).strict(),
  spacing: z.object({
    unit: z.number().int().positive().max(64),
    sectionGap: z.number().int().positive().max(256),
    blockGap: z.number().int().positive().max(128),
  }).strict(),
  radius: z.object({
    small: z.number().int().nonnegative().max(64),
    medium: z.number().int().nonnegative().max(96),
    large: z.number().int().nonnegative().max(128),
  }).strict(),
  contentWidth: z.number().int().positive().max(2400),
}).strict();

export const sectionPropsSchema = z.object({
  layout: z.enum(["stack", "split", "centered"]),
  backgroundToken: tokenName,
  spacingToken: tokenName,
  contentWidthToken: tokenName,
  align: z.enum(["left", "center", "right"]),
  backgroundOverride: safeColor.optional(),
}).strict();

export const textPropsSchema = z.object({
  content: z.string().min(1).max(20000),
  variant: z.enum(["heading", "body", "eyebrow"]),
  align: z.enum(["left", "center", "right"]),
  typographyToken: tokenName.optional(),
  colorOverride: safeColor.optional(),
}).strict();

export const imagePropsSchema = z.object({
  src: z.string().url().max(2048),
  alt: z.string().min(1).max(500),
  fit: z.enum(["cover", "contain"]),
  radiusToken: tokenName,
}).strict();

const safeHref = z.string().refine((value) => {
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}, "Unsupported or unsafe href scheme");

export const buttonPropsSchema = z.object({
  label: z.string().min(1).max(120),
  href: safeHref,
  variant: z.enum(["primary", "secondary", "ghost"]),
  align: z.enum(["left", "center", "right"]),
}).strict();

export const blockPropsByType = {
  section: sectionPropsSchema,
  text: textPropsSchema,
  image: imagePropsSchema,
  button: buttonPropsSchema,
} as const;

export const blockMutationSchema = z.object({
  projectId: z.number().int().positive(),
  pageId: z.number().int().positive(),
  expectedRevision: z.number().int().positive(),
  parentBlockId: z.number().int().positive().nullable(),
  type: z.enum(["section", "text", "image", "button"]),
  sortOrder: z.number().int().nonnegative(),
  props: z.unknown(),
}).strict();

export const blockUpdateSchema = blockMutationSchema.extend({
  blockId: z.number().int().positive(),
}).strict();

export const blockListItemSchema = z.object({
  id: z.number().int().positive(),
  pageId: z.number().int().positive(),
  parentBlockId: z.number().int().positive().nullable(),
  type: z.enum(["section", "text", "image", "button"]),
  sortOrder: z.number().int().nonnegative(),
  props: z.unknown(),
}).strict();

export const reorderSchema = z.object({
  projectId: z.number().int().positive(),
  pageId: z.number().int().positive(),
  expectedRevision: z.number().int().positive(),
  blocks: z.array(blockListItemSchema),
}).strict();

export const replaceAllSchema = reorderSchema;
