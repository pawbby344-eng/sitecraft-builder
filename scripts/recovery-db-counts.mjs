import { createConnection } from "mysql2/promise";

const tables = ["projects", "projectIdeas", "projectBriefs", "siteSpecs", "pages", "pageBlocks", "aiProposals", "scopeLocks", "publishedRevisions"];
const db = await createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 15000, enableKeepAlive: false });
const result = {};
for (const table of tables) {
  const [[countRow]] = await db.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
  const [ids] = await db.query(`SELECT id FROM \`${table}\` ORDER BY id`);
  result[table] = { count: Number(countRow.count), ids: ids.map((row) => Number(row.id)) };
}
console.log(JSON.stringify(result, null, 2));
await db.end();
