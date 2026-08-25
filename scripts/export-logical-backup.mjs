import { writeFile } from "node:fs/promises";
import { createConnection } from "mysql2/promise";

const connection = await createConnection(process.env.DATABASE_URL);
const [tableRows] = await connection.query("SHOW TABLES");
const tableKey = Object.keys(tableRows[0] ?? {})[0];
const lines = ["-- SiteCraft logical backup generated from current DATABASE_URL", "SET FOREIGN_KEY_CHECKS=0;", ""];
for (const row of tableRows) {
  const table = row[tableKey];
  const [[createRow]] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
  const createSql = createRow[Object.keys(createRow).find((key) => key.toLowerCase().includes("create table"))];
  lines.push(`DROP TABLE IF EXISTS \`${table}\`;`, `${createSql};`, "");
  const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
  for (const record of rows) {
    const columns = Object.keys(record).map((column) => `\`${column}\``).join(", ");
    const values = Object.values(record).map((value) => connection.escape(value)).join(", ");
    lines.push(`INSERT INTO \`${table}\` (${columns}) VALUES (${values});`);
  }
  lines.push("");
}
lines.push("SET FOREIGN_KEY_CHECKS=1;", "");
await writeFile(process.argv[2], lines.join("\n"));
await connection.end();
