import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { talanDb?: PrismaClient };
function createDb() {
  const poolSize = Number(
    process.env.DATABASE_POOL_SIZE || (process.env.DATABASE_URL ? 10 : 1),
  );
  if (!Number.isInteger(poolSize) || poolSize < 1 || poolSize > 20)
    throw new Error("DATABASE_POOL_SIZE must be an integer from 1 to 20.");
  if (
    !process.env.DATABASE_URL &&
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LOCAL_PREVIEW !== "true"
  )
    throw new Error(
      "Production requires DATABASE_URL. Local preview: ALLOW_LOCAL_PREVIEW=true.",
    );
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@127.0.0.1:54329/postgres",
      max: poolSize,
      idleTimeoutMillis: 1000,
    }),
  });
}
// Do not open local database files while Next.js evaluates routes during its parallel build.
export const db = new Proxy({} as PrismaClient, {
  get(_target, key) {
    const client = (globalDb.talanDb ??= createDb());
    const value = Reflect.get(client, key);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
export async function closeDb() {
  await globalDb.talanDb?.$disconnect();
}
