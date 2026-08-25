import { asc, eq } from "drizzle-orm";
import { projects } from "../drizzle/schema";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";

export async function listWorkspaceProjects(ownerId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

  return db.select({
    id: projects.id,
    name: projects.name,
    projectSlug: projects.projectSlug,
    projectDraftRevision: projects.projectDraftRevision,
    isPublished: projects.isPublished,
    updatedAt: projects.updatedAt,
  })
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .orderBy(asc(projects.updatedAt));
}
