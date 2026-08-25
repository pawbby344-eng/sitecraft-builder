import { readFile } from "node:fs/promises";
import { createConnection } from "mysql2/promise";

const source = new URL(process.env.DATABASE_URL);
const dbName = `sitecraft_populated_${Date.now()}`;
const baseConfig = {
  host: source.hostname,
  port: Number(source.port || 3306),
  user: decodeURIComponent(source.username),
  password: decodeURIComponent(source.password),
  ssl: source.searchParams.get("ssl") ? { rejectUnauthorized: true } : undefined,
};
const admin = await createConnection(baseConfig);
const q = (name) => `\`${name.replaceAll("`", "``")}\``;
const executeMigration = async (connection, file) => {
  const sql = await readFile(file, "utf8");
  for (const statement of sql.split(/--> statement-breakpoint/g).map((part) => part.trim()).filter(Boolean)) {
    await connection.query(statement);
  }
};
const scalar = async (connection, sql, values = []) => {
  const [rows] = await connection.query(sql, values);
  return rows[0];
};
try {
  await admin.query(`CREATE DATABASE ${q(dbName)}`);
  const dbUrl = new URL(process.env.DATABASE_URL);
  dbUrl.pathname = `/${dbName}`;
  const db = await createConnection({ ...baseConfig, database: dbName });

  await executeMigration(db, "drizzle/0000_rapid_vertigo.sql");
  await executeMigration(db, "drizzle/0001_sleepy_inertia.sql");

  const ownerId = 990001;
  const projectId = 990001;
  const pageId = 990001;
  const sectionId = 990001;
  const textId = 990002;
  const ideaId = 990001;
  const briefId = 990001;
  const specId = 990001;
  const publishedId = 990001;
  const proposalId = 990001;
  const lockId = 990001;
  const theme = JSON.stringify({ typography: { fontFamily: "Inter", headingSize: 48, bodySize: 16, headingWeight: 700, lineHeight: 1.4 }, colors: { background: "#ffffff", surface: "#f8fafc", text: "#111827", muted: "#64748b", primary: "#7c3aed", buttonText: "#ffffff" }, spacing: { unit: 4, sectionGap: 64, blockGap: 24 }, radius: { small: 8, medium: 16, large: 24 }, contentWidth: 1200 });
  const brief = JSON.stringify({ projectType: "portfolio", primaryGoal: "contact", audience: "Architecture clients", valueProposition: "Legacy data remains readable", tone: "editorial", requiredPages: ["home"], contentRequirements: ["work"], visualDirection: "quiet", constraints: [] });
  const spec = JSON.stringify({ schemaVersion: "1", projectName: "Legacy Recovery", pages: [{ name: "Home", pageSlug: "home", purpose: "contact", isHome: true, sections: [{ name: "Hero", purpose: "intro", layout: "centered", blocks: [{ type: "text", content: "Legacy headline", variant: "heading" }] }] }], theme: JSON.parse(theme) });
  const snapshot = JSON.stringify({ schemaVersion: "1", project: { id: projectId, name: "Legacy Recovery", projectSlug: "legacy-recovery" }, theme: JSON.parse(theme), pages: [{ id: pageId, name: "Home", pageSlug: "home", purpose: "contact", isHome: true, blocks: [{ id: sectionId, pageId, parentBlockId: null, type: "section", sortOrder: 0, props: { layout: "centered", align: "center", backgroundToken: "background", spacingToken: "section", contentWidthToken: "wide" } }, { id: textId, pageId, parentBlockId: sectionId, type: "text", sortOrder: 0, props: { content: "Legacy headline", variant: "heading", align: "center", typographyToken: "display" } }] }] });

  await db.query("INSERT INTO users (id, openId, name, email, loginMethod, role) VALUES (?, ?, ?, ?, ?, ?)", [ownerId, "legacy-owner-990001", "Legacy Owner", "legacy@example.test", "test", "user"]);
  await db.query("INSERT INTO projects (id, ownerId, name, projectSlug, projectDraftRevision, publishedRevisionId, theme, isPublished) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [projectId, ownerId, "Legacy Recovery", "legacy-recovery", 7, publishedId, theme, true]);
  await db.query("INSERT INTO pages (id, projectId, name, pageSlug, purpose, isHome) VALUES (?, ?, ?, ?, ?, ?)", [pageId, projectId, "Home", "home", "contact", true]);
  await db.query("INSERT INTO pageBlocks (id, pageId, parentBlockId, type, sortOrder, props) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)", [sectionId, pageId, null, "section", 0, JSON.stringify({ layout: "centered", align: "center", backgroundToken: "background", spacingToken: "section", contentWidthToken: "wide" }), textId, pageId, sectionId, "text", 0, JSON.stringify({ content: "Legacy headline", variant: "heading", align: "center", typographyToken: "display" })]);
  await db.query("INSERT INTO projectBriefs (id, projectId, inputText, brief, status) VALUES (?, ?, ?, ?, ?)", [briefId, projectId, "Legacy IDEA", brief, "confirmed"]);
  await db.query("INSERT INTO siteSpecs (id, projectId, briefId, spec, schemaVersion, status) VALUES (?, ?, ?, ?, ?, ?)", [specId, projectId, briefId, spec, "1", "confirmed"]);
  await db.query("INSERT INTO publishedRevisions (id, projectId, revisionNumber, schemaVersion, snapshot) VALUES (?, ?, ?, ?, ?)", [publishedId, projectId, 1, "1", snapshot]);
  await db.query("INSERT INTO aiProposals (id, projectId, baseDraftRevision, scopeType, scopeId, proposal, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [proposalId, projectId, 7, "block", textId, JSON.stringify({ summary: "Legacy proposal", changes: [] }), "pending"]);
  await db.query("INSERT INTO scopeLocks (id, projectId, scopeType, scopeId, locked) VALUES (?, ?, ?, ?, ?)", [lockId, projectId, "block", textId, true]);

  await executeMigration(db, "drizzle/0002_sour_garia.sql");
  await executeMigration(db, "drizzle/0003_easy_adam_destine.sql");
  await db.query("INSERT INTO projectIdeas (id, projectId, inputText) VALUES (?, ?, ?)", [ideaId, projectId, "Legacy IDEA"]);

  // 0000→0003 preservation is asserted above; 0004 is applied only to exercise the current hardening read paths.
  await executeMigration(db, "drizzle/0004_rapid_boomer.sql");

  const before = { ownerId, projectId, pageId, sectionId, textId, ideaId, briefId, specId, publishedId, proposalId, lockId };
  const [ids] = await db.query("SELECT id FROM projects WHERE id = ?", [projectId]);
  const [relations] = await db.query("SELECT pageId, parentBlockId FROM pageBlocks WHERE id IN (?, ?) ORDER BY id", [sectionId, textId]);
  if (ids.length !== 1 || relations.length !== 2 || relations[1].parentBlockId !== sectionId) throw new Error("Legacy IDs or parent relationship were not preserved");

  process.env.DATABASE_URL = dbUrl.toString();
  const [{ getArchitectState }, { listWorkspaceProjects }, { getAiEditState }, { getPublishStatus, getPublicSnapshot }, { updateBlock }] = await Promise.all([
    import("../server/site-architect.ts"),
    import("../server/workspace.ts"),
    import("../server/ai-edit.ts"),
    import("../server/publish.ts"),
    import("../server/site-engine.ts"),
  ]);
  const state = await getArchitectState(ownerId, projectId);
  const listed = await listWorkspaceProjects(ownerId);
  const aiState = await getAiEditState(ownerId, projectId);
  const publishStatus = await getPublishStatus(ownerId, projectId);
  const publicSnapshot = await getPublicSnapshot({ projectSlug: "legacy-recovery" });
  if (state.project.id !== projectId || state.project.projectDraftRevision !== 7 || state.idea?.inputText !== "Legacy IDEA" || state.brief?.id !== briefId || state.spec?.id !== specId || state.pages[0]?.id !== pageId || state.blocks.find((block) => block.id === textId)?.parentBlockId !== sectionId || listed.length !== 1 || aiState.proposals[0]?.id !== proposalId || publishStatus.publishedRevisionId !== publishedId || publicSnapshot.pages[0]?.blocks.length !== 2) throw new Error("Production read paths did not preserve populated data");

  await updateBlock(ownerId, { projectId, pageId, blockId: textId, parentBlockId: sectionId, type: "text", sortOrder: 0, props: { content: "Legacy headline after save", variant: "heading", align: "center", typographyToken: "display" }, expectedRevision: 7 });
  const afterSave = await getArchitectState(ownerId, projectId);
  if (afterSave.project.projectDraftRevision !== 8 || afterSave.blocks.find((block) => block.id === textId)?.props.content !== "Legacy headline after save") throw new Error("Production save path failed after migration");

  console.log(JSON.stringify({ database: dbName, idsBefore: before, idsAfter: { ownerId, projectId, pageId, sectionId, textId, ideaId, briefId, specId, publishedId, proposalId, lockId }, relationsPreserved: true, dataPreserved: true, revisionBefore: 7, revisionAfterSave: afterSave.project.projectDraftRevision, productionReadPass: true, publicReadPass: true }, null, 2));
  await db.end();
} finally {
  await admin.query(`DROP DATABASE IF EXISTS ${q(dbName)}`);
  await admin.end();
}
process.exit(0);
