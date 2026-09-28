import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// Local PGlite has its own ledger. External PostgreSQL uses prisma migrate deploy.
export async function migrateLocal(database, directory) {
  await database.exec(
    'CREATE TABLE IF NOT EXISTS "LocalMigration" ("name" TEXT PRIMARY KEY, "appliedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  );
  const { rows: existing } = await database.query(
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='User') AS exists",
  );
  if (existing[0].exists)
    await database.query(
      'INSERT INTO "LocalMigration" ("name") VALUES ($1) ON CONFLICT DO NOTHING',
      ["0001_init"],
    );
  const { rows } = await database.query('SELECT "name" FROM "LocalMigration"');
  const applied = new Set(rows.map((row) => row.name));
  for (const entry of readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    if (applied.has(entry.name)) continue;
    const sql = readFileSync(
      resolve(directory, entry.name, "migration.sql"),
      "utf8",
    );
    await database.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('INSERT INTO "LocalMigration" ("name") VALUES ($1)', [
        entry.name,
      ]);
    });
  }
}
