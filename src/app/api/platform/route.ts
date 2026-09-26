import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import {
  HttpError,
  currentUser,
  requireAdmin,
  catalog,
  lessonView,
  access,
  limit,
  saveDraft,
  submit,
  adminOverview,
  adminStudents,
  createStudent,
  importPreview,
  audit,
  questionSchema,
} from "@/lib/platform";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const answersSchema = z
  .record(z.string().max(100), z.string().max(1000))
  .refine((v) => Object.keys(v).length <= 200);
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function failure(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.code }, e.status);
  if (e instanceof z.ZodError) return json({ error: "INVALID_INPUT" }, 400);
  if ((e as { code?: string }).code === "P2002")
    return json({ error: "DUPLICATE_RECORD" }, 409);
  if ((e as { code?: string }).code === "P2025")
    return json({ error: "NOT_FOUND" }, 404);
  console.error(
    "Platform request failed:",
    e instanceof Error ? e.name : "UnknownError",
  );
  return json({ error: "SERVER_ERROR" }, 500);
}
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser(request.headers),
      params = request.nextUrl.searchParams,
      action = params.get("action") || "me";
    if (action === "me")
      return json({
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      });
    if (user.mustChangePassword)
      throw new HttpError(403, "PASSWORD_CHANGE_REQUIRED");
    await db.user.updateMany({
      where: {
        id: user.id,
        OR: [
          { lastActivityAt: null },
          { lastActivityAt: { lt: new Date(Date.now() - 300000) } },
        ],
      },
      data: { lastActivityAt: new Date() },
    });
    if (action === "catalog") return json(await catalog(user));
    if (action === "lesson")
      return json(
        await lessonView(user, z.string().min(1).parse(params.get("id"))),
      );
    if (action === "admin") return json(await adminOverview(user));
    if (action === "students")
      return json(
        await adminStudents(
          user,
          (params.get("q") || "").slice(0, 100),
          z.coerce
            .number()
            .int()
            .min(1)
            .max(10000)
            .parse(params.get("page") || 1),
        ),
      );
    if (action === "student") {
      requireAdmin(user);
      const student = await db.user.findUnique({
        where: { id: params.get("id") || "" },
        select: {
          id: true,
          name: true,
          username: true,
          status: true,
          role: true,
        },
      });
      if (!student || student.role !== "STUDENT")
        throw new HttpError(404, "NOT_FOUND");
      return json({
        student,
        submissions: await db.submission.findMany({
          where: { userId: student.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            attempt: true,
            score: true,
            createdAt: true,
            homework: { select: { lesson: { select: { title: true } } } },
          },
        }),
      });
    }
    if (action === "editor") {
      requireAdmin(user);
      return json(
        await db.lesson.findUnique({
          where: { id: params.get("id") || "" },
          include: {
            homework: { include: { questions: { orderBy: { order: "asc" } } } },
          },
        }),
      );
    }
    throw new HttpError(404, "NOT_FOUND");
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    if (
      request.headers.get("origin") !==
      new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000").origin
    )
      throw new HttpError(403, "INVALID_ORIGIN");
    const user = await currentUser(request.headers);
    if (Number(request.headers.get("content-length") || 0) > 500000)
      throw new HttpError(413, "TOO_LARGE");
    const raw = await request.text();
    if (raw.length > 500000) throw new HttpError(413, "TOO_LARGE");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "INVALID_INPUT");
    }
    const action = z
      .enum([
        "password",
        "viewed",
        "draft",
        "submit",
        "createStudent",
        "importPreview",
        "importCommit",
        "studentStatus",
        "enrollment",
        "resetPassword",
        "cohort",
        "lesson",
        "homework",
        "bonusAttempt",
      ])
      .parse(body.action);
    await limit(
      `${user.id}:${action}`,
      action === "submit" ? 10 : action === "draft" ? 120 : 40,
    );
    if (action === "password") {
      const value = z
        .object({
          currentPassword: z.string(),
          newPassword: z.string().min(12).max(64),
        })
        .parse(body);
      let changed: Response;
      try {
        changed = await auth.api.changePassword({
          headers: request.headers,
          body: { ...value, revokeOtherSessions: true },
          asResponse: true,
        });
      } catch {
        throw new HttpError(400, "PASSWORD_CHANGE_FAILED");
      }
      if (!changed.ok) throw new HttpError(400, "PASSWORD_CHANGE_FAILED");
      await db.user.update({
        where: { id: user.id },
        data: { mustChangePassword: false },
      });
      const response = json({ ok: true });
      for (const cookie of changed.headers.getSetCookie())
        response.headers.append("set-cookie", cookie);
      return response;
    }
    if (user.mustChangePassword)
      throw new HttpError(403, "PASSWORD_CHANGE_REQUIRED");
    if (action === "viewed") {
      const id = z.string().parse(body.lessonId);
      await access(user, id);
      await db.lessonProgress.upsert({
        where: { userId_lessonId: { userId: user.id, lessonId: id } },
        create: { userId: user.id, lessonId: id, viewedAt: new Date() },
        update: { viewedAt: new Date(), lastAccessedAt: new Date() },
      });
      return json({ ok: true });
    }
    if (action === "draft")
      return json(
        await saveDraft(
          user,
          z.string().parse(body.lessonId),
          answersSchema.parse(body.answers),
        ),
      );
    if (action === "submit")
      return json(
        await submit(
          user,
          z.string().parse(body.lessonId),
          answersSchema.parse(body.answers),
          z.uuid().parse(body.requestId),
          z.number().int().parse(body.revision),
        ),
      );
    requireAdmin(user);
    if (action === "createStudent")
      return json(await createStudent(user, body));
    if (action === "importPreview" || action === "importCommit") {
      const rows = await importPreview(z.string().max(100000).parse(body.csv));
      if (action === "importPreview") return json(rows);
      if (rows.some((r) => r.error)) throw new HttpError(400, "IMPORT_ERRORS");
      // Each row is a bounded transaction; return partial results explicitly so a retry cannot hide duplicates.
      const created = [],
        failed = [];
      for (const row of rows) {
        try {
          created.push(await createStudent(user, row));
        } catch {
          failed.push({ row: row.row, name: row.name, error: "CREATE_FAILED" });
        }
      }
      return json({ created, failed });
    }
    if (action === "studentStatus") {
      const v = z
        .object({ id: z.string(), status: z.enum(["ACTIVE", "BLOCKED"]) })
        .parse(body);
      const student = await db.user.findUnique({ where: { id: v.id } });
      if (student?.role !== "STUDENT") throw new HttpError(403, "FORBIDDEN");
      await db.$transaction([
        db.user.update({ where: { id: v.id }, data: { status: v.status } }),
        db.session.deleteMany({ where: { userId: v.id } }),
      ]);
      await audit(user, "STUDENT_" + v.status, v.id);
      return json({ ok: true });
    }
    if (action === "enrollment") {
      const v = z
        .object({ id: z.string(), status: z.enum(["ACTIVE", "REVOKED"]) })
        .parse(body);
      await db.enrollment.update({
        where: { id: v.id },
        data: { status: v.status },
      });
      await audit(user, "ACCESS_" + v.status, v.id);
      return json({ ok: true });
    }
    if (action === "resetPassword") {
      const id = z.string().parse(body.id);
      const student = await db.user.findUnique({ where: { id } });
      if (student?.role !== "STUDENT") throw new HttpError(403, "FORBIDDEN");
      const password = randomBytes(12).toString("base64url");
      await db.$transaction([
        db.account.updateMany({
          where: { userId: id, providerId: "credential" },
          data: { password: await hash(password, 12) },
        }),
        db.user.update({ where: { id }, data: { mustChangePassword: true } }),
        db.session.deleteMany({ where: { userId: id } }),
      ]);
      await audit(user, "RESET_PASSWORD", id);
      return json({ username: student.username, password });
    }
    if (action === "cohort") {
      const v = z
        .object({
          id: z.string().optional(),
          name: z.string().min(2).max(100),
          courseId: z.enum(["ru", "kk"]),
          startDate: z.iso.datetime(),
        })
        .parse(body);
      if (v.id) {
        const old = await db.cohort.findUniqueOrThrow({ where: { id: v.id } });
        if (old.courseId !== v.courseId)
          throw new HttpError(400, "INVALID_GROUP");
      }
      const data = {
        name: v.name,
        courseId: v.courseId,
        startDate: new Date(v.startDate),
      };
      const group = v.id
        ? await db.cohort.update({ where: { id: v.id }, data })
        : await db.cohort.create({ data });
      await audit(user, "SAVE_GROUP", group.id);
      return json(group);
    }
    if (action === "lesson") {
      const v = z
        .object({
          id: z.string(),
          title: z.string().min(1).max(200),
          description: z.string().max(10000),
          videoId: z
            .string()
            .regex(/^[a-zA-Z0-9_-]{10,100}$/)
            .nullable(),
          status: z.enum(["PUBLISHED", "DRAFT"]),
          unlockType: z.enum(["ABSOLUTE_DATE", "RELATIVE_TO_COHORT_START"]),
          availableFrom: z.iso.datetime().nullable(),
          unlockOffsetDays: z.number().int().min(0).max(3650),
        })
        .parse(body);
      if (
        v.status === "PUBLISHED" &&
        (!v.videoId || (v.unlockType === "ABSOLUTE_DATE" && !v.availableFrom))
      )
        throw new HttpError(400, "INCOMPLETE_LESSON");
      const { id, ...data } = v;
      await db.lesson.update({
        where: { id },
        data: {
          ...data,
          availableFrom: v.availableFrom ? new Date(v.availableFrom) : null,
        },
      });
      await audit(user, "SAVE_LESSON", id);
      return json({ ok: true });
    }
    if (action === "homework") {
      const v = z
        .object({
          lessonId: z.string(),
          questions: z.array(questionSchema).min(1).max(100),
          status: z.enum(["PUBLISHED", "DRAFT"]),
        })
        .parse(body);
      await db.$transaction(
        async (tx) => {
          const h = await tx.homework.findUnique({
            where: { lessonId: v.lessonId },
          });
          if (h && (await tx.submission.count({ where: { homeworkId: h.id } })))
            throw new HttpError(409, "HOMEWORK_HAS_SUBMISSIONS");
          const id = h?.id || `${v.lessonId}-hw`;
          if (h) {
            await tx.question.deleteMany({ where: { homeworkId: id } });
            await tx.homeworkProgress.deleteMany({ where: { homeworkId: id } });
          }
          await tx.homework.upsert({
            where: { id },
            create: { id, lessonId: v.lessonId, status: v.status },
            update: { status: v.status, revision: { increment: 1 } },
          });
          await tx.question.createMany({
            data: v.questions.map((q, i) => ({
              ...q,
              id: crypto.randomUUID(),
              order: i + 1,
              homeworkId: id,
            })),
          });
        },
        { isolationLevel: "Serializable" },
      );
      await audit(user, "SAVE_HOMEWORK", v.lessonId);
      return json({ ok: true });
    }
    if (action === "bonusAttempt") {
      const v = z
        .object({ userId: z.string(), homeworkId: z.string() })
        .parse(body);
      await db.homeworkProgress.update({
        where: { userId_homeworkId: v },
        data: { bonusAttempts: { increment: 1 } },
      });
      await audit(user, "BONUS_ATTEMPT", `${v.userId}:${v.homeworkId}`);
      return json({ ok: true });
    }
    throw new HttpError(404, "NOT_FOUND");
  } catch (e) {
    return failure(e);
  }
}
