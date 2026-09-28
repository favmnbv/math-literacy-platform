import "dotenv/config";
import { db, closeDb } from "../src/lib/db";

async function main() {
  const username = process.argv[2];
  if (!username)
    throw new Error(
      "Usage: node --import tsx scripts/promote-superadmin.ts <username>",
    );
  const user = await db.user.findUnique({ where: { username } });
  if (
    !user ||
    !["ADMIN", "SUPER_ADMIN"].includes(user.role) ||
    user.status !== "ACTIVE"
  )
    throw new Error("An existing active administrator is required.");
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { role: "SUPER_ADMIN" } }),
    db.auditLog.create({
      data: {
        adminId: user.id,
        action: "BOOTSTRAP_SUPER_ADMIN",
        entityId: user.id,
      },
    }),
  ]);
  console.log(
    `Superadministrator enabled for ${username}. Existing password preserved.`,
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(closeDb);
