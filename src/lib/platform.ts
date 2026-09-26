import { db } from "./db";
import { auth } from "./auth";
import { opensAt, grade } from "./grading";
import type { Prisma, User } from "@/generated/prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import Papa from "papaparse";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export async function currentUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new HttpError(401, "SESSION_EXPIRED");
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.status !== "ACTIVE")
    throw new HttpError(403, "ACCOUNT_BLOCKED");
  return user;
}
export function requireAdmin(user: User) {
  if (user.role !== "ADMIN") throw new HttpError(403, "FORBIDDEN");
}
export async function limit(key: string, max: number, seconds = 60) {
  const now = new Date();
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "ApiLimit" ("key","count","expiresAt") VALUES (${key},1,${new Date(now.getTime() + seconds * 1000)}) ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "ApiLimit"."expiresAt" < ${now} THEN 1 ELSE "ApiLimit"."count" + 1 END, "expiresAt" = CASE WHEN "ApiLimit"."expiresAt" < ${now} THEN ${new Date(now.getTime() + seconds * 1000)} ELSE "ApiLimit"."expiresAt" END RETURNING "count"`;
  if (rows[0].count > max) throw new HttpError(429, "TOO_MANY_REQUESTS");
}
const questionSelect = {
  id: true,
  order: true,
  level: true,
  type: true,
  text: true,
  options: true,
  points: true,
};
export async function access(user: User, lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      course: true,
      homework: {
        select: {
          id: true,
          status: true,
          passingScore: true,
          maxAttempts: true,
          revision: true,
        },
      },
    },
  });
  if (!lesson) throw new HttpError(404, "NOT_FOUND");
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: lesson.courseId } },
    include: { cohort: true },
  });
  if (!enrollment || enrollment.status !== "ACTIVE")
    throw new HttpError(403, "NO_ACCESS");
  const opening = opensAt(lesson, enrollment.cohort.startDate);
  if (lesson.status !== "PUBLISHED" || !lesson.videoId)
    throw new HttpError(403, "MATERIAL_PENDING");
  if (!opening || opening > new Date())
    throw new HttpError(403, "LESSON_LOCKED");
  return { lesson, enrollment, opening };
}
export async function catalog(user: User) {
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: {
      cohort: true,
      course: {
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              title: true,
              status: true,
              unlockType: true,
              unlockOffsetDays: true,
              availableFrom: true,
              videoId: true,
              progress: {
                where: { userId: user.id },
                select: { viewedAt: true },
              },
              homework: {
                select: {
                  id: true,
                  status: true,
                  passingScore: true,
                  maxAttempts: true,
                  progress: {
                    where: { userId: user.id },
                    select: {
                      bestScore: true,
                      attemptCount: true,
                      passedAt: true,
                      bonusAttempts: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  return enrollments.map((e) => ({
    id: e.course.id,
    title: e.course.title,
    language: e.course.language,
    group: e.cohort.name,
    timezone: e.course.timezone,
    lessons: e.course.lessons.map((l) => {
      const open = opensAt(l, e.cohort.startDate),
        p = l.homework?.progress[0],
        viewed = !!l.progress[0]?.viewedAt;
      const state =
        l.status !== "PUBLISHED" || !l.videoId
          ? "PENDING"
          : !open || open > new Date()
            ? "LOCKED"
            : viewed && p?.passedAt
              ? "COMPLETED"
              : viewed || p?.attemptCount
                ? "IN_PROGRESS"
                : "AVAILABLE";
      return {
        id: l.id,
        order: l.order,
        title: l.title,
        state,
        opensAt: open,
        viewed,
        hasHomework: l.homework?.status === "PUBLISHED",
        bestScore: p?.bestScore ?? null,
        attempts: p?.attemptCount ?? 0,
      };
    }),
  }));
}
export async function lessonView(user: User, id: string) {
  const { lesson, opening } = await access(user, id);
  const hw = lesson.homework?.status === "PUBLISHED" ? lesson.homework : null;
  const [progress, lessonProgress] = await Promise.all([
    hw
      ? db.homeworkProgress.findUnique({
          where: { userId_homeworkId: { userId: user.id, homeworkId: hw.id } },
        })
      : null,
    db.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId: id } },
    }),
  ]);
  const viewed = !!lessonProgress?.viewedAt;
  const questionCount = hw
    ? await db.question.count({ where: { homeworkId: hw.id } })
    : 0;
  const questions =
    hw && viewed
      ? await db.question.findMany({
          where: { homeworkId: hw.id },
          orderBy: { order: "asc" },
          select: questionSelect,
        })
      : [];
  const submissions =
    hw && viewed
      ? await db.submission.findMany({
          where: { userId: user.id, homeworkId: hw.id },
          orderBy: { attempt: "desc" },
          take: 20,
          select: {
            id: true,
            attempt: true,
            score: true,
            earnedPoints: true,
            maxPoints: true,
            createdAt: true,
            answers: true,
            result: true,
          },
        })
      : [];
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    order: lesson.order,
    courseId: lesson.courseId,
    courseTitle: lesson.course.title,
    language: lesson.course.language,
    opensAt: opening,
    videoUrl: `https://drive.google.com/file/d/${lesson.videoId}/preview`,
    videoExternalUrl: `https://drive.google.com/file/d/${lesson.videoId}/view`,
    viewed,
    homework: hw
      ? {
          ...hw,
          questionCount,
          questions,
          progress: viewed ? progress : null,
          submissions,
        }
      : null,
  };
}
async function homeworkAccess(user: User, lessonId: string) {
  const { lesson } = await access(user, lessonId);
  if (!lesson.homework || lesson.homework.status !== "PUBLISHED")
    throw new HttpError(404, "HOMEWORK_PENDING");
  const watched = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: user.id, lessonId } },
  });
  if (!watched?.viewedAt) throw new HttpError(409, "WATCH_REQUIRED");
  return lesson.homework;
}
export async function saveDraft(
  user: User,
  lessonId: string,
  answers: Record<string, string>,
) {
  const h = await homeworkAccess(user, lessonId);
  const qs = await db.question.findMany({
    where: { homeworkId: h.id },
    select: { id: true },
  });
  if (Object.keys(answers).some((id) => !qs.some((q) => q.id === id)))
    throw new HttpError(400, "INVALID_ANSWER");
  const p = await db.homeworkProgress.upsert({
    where: { userId_homeworkId: { userId: user.id, homeworkId: h.id } },
    create: { userId: user.id, homeworkId: h.id },
    update: {},
  });
  const changed = await db.homeworkProgress.updateMany({
    where: {
      id: p.id,
      passedAt: null,
      attemptCount: { lt: h.maxAttempts + p.bonusAttempts },
    },
    data: { draft: answers },
  });
  if (!changed.count) throw new HttpError(409, "ATTEMPTS_FINISHED");
  return { saved: true };
}
export async function submit(
  user: User,
  lessonId: string,
  answers: Record<string, string>,
  requestId: string,
  revision: number,
) {
  const h = await homeworkAccess(user, lessonId);
  const lookup = { userId: user.id, homeworkId: h.id };
  const existing = await db.submission.findUnique({
    where: { userId_homeworkId_requestId: { ...lookup, requestId } },
    select: {
      id: true,
      score: true,
      attempt: true,
      earnedPoints: true,
      maxPoints: true,
      answers: true,
      result: true,
      createdAt: true,
    },
  });
  if (existing) return existing;
  const watched = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: user.id, lessonId } },
  });
  if (!watched?.viewedAt) throw new HttpError(409, "WATCH_REQUIRED");
  await db.homeworkProgress.upsert({
    where: { userId_homeworkId: lookup },
    create: lookup,
    update: {},
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const current = await tx.homework.findUniqueOrThrow({
            where: { id: h.id },
            include: { questions: { orderBy: { order: "asc" } } },
          });
          if (current.revision !== revision || current.status !== "PUBLISHED")
            throw new HttpError(409, "HOMEWORK_CHANGED");
          if (!current.questions.length)
            throw new HttpError(409, "HOMEWORK_PENDING");
          const p = await tx.homeworkProgress.findUniqueOrThrow({
            where: { userId_homeworkId: lookup },
          });
          if (
            p.passedAt ||
            p.attemptCount >= current.maxAttempts + p.bonusAttempts
          )
            throw new HttpError(409, "ATTEMPTS_FINISHED");
          if (
            Object.keys(answers).length !== current.questions.length ||
            current.questions.some(
              (q) =>
                !answers[q.id]?.trim() ||
                (q.type === "MULTIPLE_CHOICE" &&
                  (!/^[A-E]$/.test(answers[q.id]) ||
                    !Array.isArray(q.options) ||
                    "ABCDE".indexOf(answers[q.id]) >= q.options.length)),
            )
          )
            throw new HttpError(400, "ANSWER_ALL");
          const g = grade(current.questions, answers),
            passed = g.earnedPoints * 100 >= g.maxPoints * current.passingScore;
          const claimed = await tx.homeworkProgress.updateMany({
            where: { id: p.id, attemptCount: p.attemptCount, passedAt: null },
            data: {
              attemptCount: { increment: 1 },
              bestScore: Math.max(p.bestScore, g.score),
              passedAt: passed ? new Date() : null,
              draft: answers,
            },
          });
          if (!claimed.count) throw new HttpError(409, "CONCURRENT_SUBMISSION");
          return tx.submission.create({
            data: {
              ...lookup,
              attempt: p.attemptCount + 1,
              requestId,
              answers,
              result: g.result,
              score: g.score,
              earnedPoints: g.earnedPoints,
              maxPoints: g.maxPoints,
              revision,
            },
            select: {
              id: true,
              score: true,
              attempt: true,
              earnedPoints: true,
              maxPoints: true,
              answers: true,
              result: true,
              createdAt: true,
            },
          });
        },
        { isolationLevel: "Serializable", timeout: 15000 },
      );
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "P2002") {
        const found = await db.submission.findUnique({
          where: { userId_homeworkId_requestId: { ...lookup, requestId } },
          select: {
            id: true,
            score: true,
            attempt: true,
            earnedPoints: true,
            maxPoints: true,
            answers: true,
            result: true,
            createdAt: true,
          },
        });
        if (found) return found;
      }
      if ((code === "P2034" || code === "P2002") && attempt < 2) continue;
      throw e;
    }
  }
  throw new HttpError(409, "CONCURRENT_SUBMISSION");
}
export const questionSchema = z
  .object({
    id: z.string().optional(),
    order: z.number().int().min(1),
    level: z.enum(["A", "B", "C"]),
    type: z.enum([
      "MULTIPLE_CHOICE",
      "NUMBER",
      "DECIMAL",
      "FRACTION",
      "SHORT_TEXT",
    ]),
    text: z.string().min(1).max(10000),
    options: z.array(z.string().max(1000)).max(5),
    correctAnswer: z.string().min(1).max(1000),
    acceptableAnswers: z.array(z.string().max(1000)).default([]),
    tolerance: z
      .string()
      .regex(/^\d+(?:\.\d+)?$/)
      .default("0"),
    points: z.number().int().min(1).max(100).default(1),
    explanation: z.string().max(10000).default(""),
  })
  .superRefine((q, ctx) => {
    if (
      q.type === "MULTIPLE_CHOICE" &&
      (q.options.length < 2 || !q.options["ABCDE".indexOf(q.correctAnswer)])
    )
      ctx.addIssue({ code: "custom", message: "Invalid choices" });
  });
const studentSchema = z.object({
  name: z.string().trim().min(2).max(150),
  username: z
    .string()
    .regex(/^[a-z0-9_.-]{3,40}$/)
    .optional(),
  cohortId: z.string().min(1),
});
export async function createStudent(admin: User, raw: unknown) {
  requireAdmin(admin);
  const data = studentSchema.parse(raw);
  const cohort = await db.cohort.findUnique({ where: { id: data.cohortId } });
  if (!cohort) throw new HttpError(400, "INVALID_GROUP");
  const username = data.username || `talan-${randomBytes(5).toString("hex")}`,
    password = randomBytes(12).toString("base64url"),
    id = randomUUID();
  await db.user.create({
    data: {
      id,
      name: data.name,
      username,
      displayUsername: username,
      email: `${username}@accounts.talan.invalid`,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password: await hash(password, 12),
        },
      },
      enrollments: {
        create: { courseId: cohort.courseId, cohortId: cohort.id },
      },
    },
  });
  await audit(admin, "CREATE_STUDENT", id);
  return { id, name: data.name, username, password };
}
export async function audit(admin: User, action: string, entityId: string) {
  await db.auditLog.create({ data: { adminId: admin.id, action, entityId } });
}
export async function importPreview(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().replace(/^\uFEFF/, ""),
  });
  if (
    parsed.errors.length ||
    !parsed.meta.fields?.includes("name") ||
    !parsed.meta.fields?.includes("cohortId")
  )
    throw new HttpError(400, "INVALID_CSV");
  if (parsed.data.length > 100) throw new HttpError(400, "IMPORT_BATCH_LIMIT");
  if (parsed.meta.fields.some((h) => /iin|иин|жсн/i.test(h)))
    throw new HttpError(400, "IIN_NOT_REQUIRED");
  const groups = await db.cohort.findMany({ select: { id: true } }),
    seen = new Set<string>();
  const rows = [];
  for (let index = 0; index < parsed.data.length; index++) {
    const row = parsed.data[index];
    const value = {
      name: row.name,
      cohortId: row.cohortId,
      username: row.username?.trim() || undefined,
    };
    let error = studentSchema.safeParse(value).success ? "" : "INVALID_ROW";
    if (!groups.some((g) => g.id === value.cohortId)) error = "INVALID_GROUP";
    if (
      value.username &&
      (seen.has(value.username) ||
        (await db.user.findUnique({ where: { username: value.username } })))
    )
      error = "DUPLICATE_USERNAME";
    if (value.username) seen.add(value.username);
    rows.push({ row: index + 2, ...value, error });
  }
  return rows;
}
export async function adminOverview(user: User) {
  requireAdmin(user);
  const [
    students,
    active,
    submissions,
    passed,
    score,
    cohorts,
    courses,
    lessons,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({
      where: {
        role: "STUDENT",
        lastActivityAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
    }),
    db.submission.count(),
    db.homeworkProgress.count({ where: { passedAt: { not: null } } }),
    db.submission.aggregate({ _avg: { score: true } }),
    db.cohort.findMany({
      include: { _count: { select: { enrollments: true } } },
      orderBy: { name: "asc" },
    }),
    db.course.findMany(),
    db.lesson.findMany({
      orderBy: [{ courseId: "asc" }, { order: "asc" }],
      include: {
        homework: {
          select: {
            id: true,
            status: true,
            _count: { select: { questions: true, submissions: true } },
          },
        },
      },
    }),
  ]);
  return {
    students,
    active,
    submissions,
    passed,
    averageScore: score._avg.score,
    cohorts,
    courses,
    lessons,
  };
}
export async function adminStudents(user: User, search: string, page: number) {
  requireAdmin(user);
  const where: Prisma.UserWhereInput = {
    role: "STUDENT",
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      skip: (page - 1) * 20,
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        username: true,
        status: true,
        createdAt: true,
        lastActivityAt: true,
        enrollments: {
          select: {
            id: true,
            status: true,
            courseId: true,
            cohort: { select: { name: true } },
          },
        },
        _count: {
          select: { homeworkProgress: { where: { passedAt: { not: null } } } },
        },
      },
    }),
  ]);
  return { total, rows, page };
}
