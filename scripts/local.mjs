import { config } from "dotenv";
import {
  existsSync,
  writeFileSync,
  mkdirSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { migrateLocal } from "./migrate-local.mjs";

const mode = process.argv[2] || "dev";
if (!existsSync(".env"))
  writeFileSync(
    ".env",
    `BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nBETTER_AUTH_URL=http://localhost:3000\nLOCAL_DATABASE_PATH=.data/postgres\nDEMO_SEED=true\n`,
  );
config({ quiet: true });
let database,
  server,
  lockFd,
  child,
  stopping = false;
const dataPath = resolve(process.env.LOCAL_DATABASE_PATH || ".data/postgres"),
  lockPath = `${dataPath}.lock`;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  if (child && !child.killed) child.kill();
  if (server) await server.stop();
  if (database) await database.close();
  if (lockFd !== undefined) {
    closeSync(lockFd);
    unlinkSync(lockPath);
  }
  process.exit(code);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
process.stdin.on("data", (data) => {
  if (data.toString().trim() === "stop") void shutdown();
});
try {
  if (!process.env.DATABASE_URL) {
    mkdirSync(resolve(dataPath, ".."), { recursive: true });
    try {
      lockFd = openSync(lockPath, "wx");
      writeFileSync(lockFd, String(process.pid));
    } catch {
      throw new Error(
        `Local database is locked. Stop the other local server before opening ${dataPath}. Do not remove a live lock.`,
      );
    }
    database = await PGlite.create(dataPath);
    await migrateLocal(database, resolve("prisma/migrations"));
    if (mode === "setup") {
      console.log("Local database and .env ready.");
      await shutdown();
    }
    server = new PGLiteSocketServer({
      db: database,
      host: "127.0.0.1",
      port: 54329,
      maxConnections: 10,
    });
    await server.start();
    console.log("Local database: 127.0.0.1:54329 (single database process).");
  } else if (mode === "setup")
    throw new Error("External PostgreSQL configured. Use pnpm db:deploy.");
  if (mode === "db") {
    console.log("Database ready. Type stop to close gracefully.");
  } else {
    const args =
      mode === "seed"
        ? ["--import", "tsx", "scripts/seed.ts"]
        : [
            "node_modules/next/dist/bin/next",
            mode === "start" ? "start" : "dev",
            ...(mode === "start" ? [] : ["--webpack"]),
            "-H",
            "127.0.0.1",
          ];
    child = spawn(process.execPath, args, {
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        ...(!process.env.DATABASE_URL ? { ALLOW_LOCAL_PREVIEW: "true" } : {}),
      },
    });
    child.on("exit", (code) => void shutdown(code ?? 1));
    child.on("error", (e) => {
      console.error(e.message);
      void shutdown(1);
    });
  }
} catch (e) {
  console.error(e.message);
  await shutdown(1);
}
