import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { closeSync, openSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hash } from "bcryptjs";
import { db, closeDb } from "../src/lib/db";

// Run once from a trusted local terminal with the production database URL.
// No public bootstrap endpoint and no password in process arguments or logs.
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("An explicit DATABASE_URL is required.");
  if (process.env.DEMO_SEED === "true")
    throw new Error("Disable DEMO_SEED for production bootstrap.");
  const username = process.argv[2] || "talan.owner";
  if (!/^[a-z0-9_.-]{3,40}$/.test(username))
    throw new Error("Invalid username.");
  const output = resolve(`credentials-production-${Date.now()}.local.txt`);
  const password = randomBytes(24).toString("base64url");
  const passwordHash = await hash(password, 12);
  // Reserve a private file before changing the database. Existing credentials
  // can never be overwritten, and a filesystem failure cannot strand an account.
  const fd = openSync(output, "wx", 0o600);
  try {
    const created = await db.$transaction(
      async (tx) => {
        if (
          await tx.user.count({
            where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
          })
        )
          return false;
        const id = randomUUID();
        await tx.user.create({
          data: {
            id,
            username,
            displayUsername: username,
            email: `${username}@accounts.talan.invalid`,
            name: "Администратор Талан",
            role: "SUPER_ADMIN",
            mustChangePassword: true,
            accounts: {
              create: {
                id: randomUUID(),
                accountId: id,
                providerId: "credential",
                password: passwordHash,
              },
            },
          },
        });
        await tx.auditLog.create({
          data: { adminId: id, action: "BOOTSTRAP_SUPER_ADMIN", entityId: id },
        });
        writeFileSync(
          fd,
          `Production TALAN\nЛогин: ${username}\nПароль: ${password}\n\nСмените временный пароль при первом входе. Не отправляйте этот файл в Git.\n`,
          "utf8",
        );
        return true;
      },
      { isolationLevel: "Serializable" },
    );
    if (created)
      console.log(
        `Superadmin created. Temporary credentials saved to ${output}`,
      );
    else
      console.log(
        "An administrator already exists. No account or password changed.",
      );
  } finally {
    closeSync(fd);
  }
}
main()
  .catch((e) => {
    console.error(
      "Bootstrap failed:",
      e instanceof Error ? e.message : "Unknown error",
    );
    process.exitCode = 1;
  })
  .finally(closeDb);
