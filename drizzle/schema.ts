import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, uniqueIndex, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  projectSlug: varchar("projectSlug", { length: 160 }).notNull().unique(),
  projectDraftRevision: int("projectDraftRevision").notNull().default(1),
  publishedRevisionId: int("publishedRevisionId"),
  theme: json("theme").notNull(),
  isPublished: boolean("isPublished").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ownerIdx: index("projects_owner_idx").on(table.ownerId),
}));

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export const projectIdeas = mysqlTable("projectIdeas", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  inputText: text("inputText").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectIdx: index("project_ideas_project_idx").on(table.projectId),
}));

export const projectBriefs = mysqlTable("projectBriefs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  inputText: text("inputText").notNull(),
  brief: json("brief").notNull(),
  status: mysqlEnum("status", ["draft", "confirmed"]).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectIdx: index("project_briefs_project_idx").on(table.projectId),
}));

export const siteSpecs = mysqlTable("siteSpecs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  briefId: int("briefId").notNull().references(() => projectBriefs.id, { onDelete: "cascade" }),
  spec: json("spec").notNull(),
  schemaVersion: varchar("schemaVersion", { length: 32 }).notNull().default("1"),
  status: mysqlEnum("status", ["draft", "confirmed"]).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectIdx: index("site_specs_project_idx").on(table.projectId),
}));

export const pages = mysqlTable("pages", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  pageSlug: varchar("pageSlug", { length: 160 }).notNull(),
  purpose: text("purpose"),
  isHome: boolean("isHome").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectPageSlugUnique: uniqueIndex("pages_project_slug_unique").on(table.projectId, table.pageSlug),
  projectIdx: index("pages_project_idx").on(table.projectId),
}));

export const pageBlocks = mysqlTable("pageBlocks", {
  id: int("id").autoincrement().primaryKey(),
  pageId: int("pageId").notNull().references(() => pages.id, { onDelete: "cascade" }),
  parentBlockId: int("parentBlockId").references((): any => pageBlocks.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["section", "text", "image", "button"]).notNull(),
  sortOrder: int("sortOrder").notNull(),
  props: json("props").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  pageOrderIdx: index("page_blocks_page_order_idx").on(table.pageId, table.parentBlockId, table.sortOrder),
  pageIdx: index("page_blocks_page_idx").on(table.pageId),
  parentIdx: index("page_blocks_parent_idx").on(table.parentBlockId),
}));

export const publishedRevisions = mysqlTable("publishedRevisions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  revisionNumber: int("revisionNumber").notNull(),
  schemaVersion: varchar("schemaVersion", { length: 32 }).notNull().default("1"),
  snapshot: json("snapshot").notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
}, (table) => ({
  projectRevisionUnique: uniqueIndex("published_revisions_project_revision_unique").on(table.projectId, table.revisionNumber),
  projectIdx: index("published_revisions_project_idx").on(table.projectId),
}));

export const aiProposals = mysqlTable("aiProposals", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  baseDraftRevision: int("baseDraftRevision").notNull(),
  scopeType: mysqlEnum("scopeType", ["block", "section", "page", "theme"]).notNull(),
  scopeId: int("scopeId"),
  proposal: json("proposal").notNull(),
  status: mysqlEnum("status", ["pending", "applied", "rejected", "expired"]).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectIdx: index("ai_proposals_project_idx").on(table.projectId),
}));

export const scopeLocks = mysqlTable("scopeLocks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  scopeType: mysqlEnum("scopeType", ["block", "section", "theme"]).notNull(),
  scopeId: int("scopeId"),
  locked: boolean("locked").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectScopeIdx: index("scope_locks_project_scope_idx").on(table.projectId, table.scopeType, table.scopeId),
}));

export type ProjectIdea = typeof projectIdeas.$inferSelect;
export type ProjectBrief = typeof projectBriefs.$inferSelect;
export type SiteSpec = typeof siteSpecs.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type PageBlock = typeof pageBlocks.$inferSelect;
export type PublishedRevision = typeof publishedRevisions.$inferSelect;
export type AiProposal = typeof aiProposals.$inferSelect;
export type ScopeLock = typeof scopeLocks.$inferSelect;