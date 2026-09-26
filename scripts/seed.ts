import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { hash } from "bcryptjs";
import { db, closeDb } from "../src/lib/db";
import courses from "../content/courses.json";
import homeworks from "../content/homeworks.json";
async function main() {
  const demo = process.env.DEMO_SEED === "true";
  if (process.env.NODE_ENV === "production" && demo)
    throw new Error("Demo seeding is disabled in production.");
  for (const c of courses) {
    await db.course.upsert({
      where: { id: c.id },
      create: { id: c.id, title: c.title, language: c.language },
      update: {},
    });
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 7);
    await db.cohort.upsert({
      where: { id: `preview-${c.id}` },
      create: {
        id: `preview-${c.id}`,
        name: `${demo ? "Пробная группа" : "Первый поток"} · ${c.language.toUpperCase()}`,
        courseId: c.id,
        startDate: start,
      },
      update: {},
    });
    for (const l of c.lessons)
      await db.lesson.upsert({
        where: { id: l.id },
        create: {
          ...l,
          courseId: c.id,
          status: l.videoId ? "PUBLISHED" : "DRAFT",
          unlockOffsetDays: Math.floor(((l.order - 1) * 7) / 3),
        },
        update: {},
      });
  }
  for (const h of homeworks) {
    await db.homework.upsert({
      where: { id: h.id },
      create: {
        id: h.id,
        lessonId: h.lessonId,
        status: "PUBLISHED",
        questions: {
          create: h.questions.map((q, i) => ({
            ...q,
            id: `${h.id}-q${i + 1}`,
            order: i + 1,
          })),
        },
      },
      update: {},
    });
  }
  if (demo) {
    const issued = [];
    for (const [username, name, role, langs] of [
      ["admin", "Администратор Талан", "ADMIN", []],
      ["student.ru", "Ученик · пробный доступ", "STUDENT", ["ru"]],
      ["student.kk", "Оқушы · сынақ қолжетімділігі", "STUDENT", ["kk"]],
    ] as const) {
      if (await db.user.findUnique({ where: { username } })) continue;
      const password = randomBytes(12).toString("base64url"),
        id = crypto.randomUUID();
      await db.user.create({
        data: {
          id,
          username,
          displayUsername: username,
          email: `${username}@accounts.talan.invalid`,
          name,
          role,
          mustChangePassword: false,
          accounts: {
            create: {
              id: crypto.randomUUID(),
              accountId: id,
              providerId: "credential",
              password: await hash(password, 12),
            },
          },
        },
      });
      for (const courseId of langs)
        await db.enrollment.create({
          data: { userId: id, courseId, cohortId: `preview-${courseId}` },
        });
      issued.push(`${role}: ${username}\nПароль: ${password}`);
    }
    if (issued.length) {
      const filename = existsSync("credentials.local.txt")
        ? `credentials-${Date.now()}.local.txt`
        : "credentials.local.txt";
      writeFileSync(
        filename,
        `Локальные тестовые аккаунты. Не использовать для реальных учеников.\n\n${issued.join("\n\n")}\n`,
      );
      console.log(`Demo accounts created; credentials saved to ${filename}.`);
    }
  }
  console.log(
    "Seed complete: two independent programs, 64 lessons, 62 video IDs, two homework sets.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
