import { db } from "./db";
import { HttpError } from "./http-security";

export async function limit(key: string, max: number, seconds = 60) {
  const now = new Date();
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "ApiLimit" ("key","count","expiresAt")
    VALUES (${key},1,${new Date(now.getTime() + seconds * 1000)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "ApiLimit"."expiresAt" < ${now} THEN 1 ELSE "ApiLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "ApiLimit"."expiresAt" < ${now} THEN ${new Date(now.getTime() + seconds * 1000)} ELSE "ApiLimit"."expiresAt" END
    RETURNING "count"`;
  if (rows[0].count > max) throw new HttpError(429, "TOO_MANY_REQUESTS");
}
