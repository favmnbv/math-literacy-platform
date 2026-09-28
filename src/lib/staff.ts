import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "./db";
import type { User } from "@/generated/prisma/client";
import { HttpError, requireSuperAdmin } from "./platform";
import { isAdmin } from "./roles";

export async function staffList(user: User) {
  requireSuperAdmin(user);
  return db.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    orderBy: [{ role: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      status: true,
      _count: { select: { assignedStudents: true } },
    },
  });
}

export async function assignmentList(
  user: User,
  curatorId: string,
  q: string,
  page: number,
) {
  requireSuperAdmin(user);
  const curator = await db.user.findUnique({ where: { id: curatorId } });
  if (curator?.role !== "ADMIN") throw new HttpError(400, "INVALID_CURATOR");
  const where = {
    role: "STUDENT",
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { username: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 20,
      skip: (page - 1) * 20,
      select: {
        id: true,
        name: true,
        username: true,
        assignedCurators: { where: { curatorId }, select: { curatorId: true } },
      },
    }),
  ]);
  return {
    total,
    rows: rows.map(({ assignedCurators, ...student }) => ({
      ...student,
      assigned: assignedCurators.length > 0,
    })),
  };
}

export async function createStaff(user: User, raw: unknown) {
  requireSuperAdmin(user);
  const data = z
    .object({
      name: z.string().trim().min(2).max(150),
      username: z.string().regex(/^[a-z0-9_.-]{3,40}$/),
      role: z.enum(["ADMIN", "SUPER_ADMIN"]),
    })
    .parse(raw);
  const id = randomUUID(),
    password = randomBytes(12).toString("base64url");
  const passwordHash = await hash(password, 12);
  await db.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        ...data,
        id,
        displayUsername: data.username,
        email: `${data.username}@accounts.talan.invalid`,
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
      data: { adminId: user.id, action: "CREATE_STAFF", entityId: id },
    });
  });
  return { id, name: data.name, username: data.username, password };
}

export async function assignStudent(user: User, raw: unknown) {
  requireSuperAdmin(user);
  const v = z
    .object({
      curatorId: z.string(),
      studentId: z.string(),
      assigned: z.boolean(),
    })
    .parse(raw);
  await db.$transaction(
    async (tx) => {
      const curator = await tx.user.findUnique({ where: { id: v.curatorId } });
      const student = await tx.user.findUnique({ where: { id: v.studentId } });
      if (curator?.role !== "ADMIN" || student?.role !== "STUDENT")
        throw new HttpError(400, "INVALID_CURATOR");
      const key = { curatorId: v.curatorId, studentId: v.studentId };
      if (v.assigned)
        await tx.curatorStudent.upsert({
          where: { curatorId_studentId: key },
          create: key,
          update: {},
        });
      else await tx.curatorStudent.deleteMany({ where: key });
      await tx.auditLog.create({
        data: {
          adminId: user.id,
          action: v.assigned ? "ASSIGN_STUDENT" : "UNASSIGN_STUDENT",
          entityId: `${v.curatorId}:${v.studentId}`,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
  return { ok: true };
}

export async function updateStaff(user: User, action: string, raw: unknown) {
  requireSuperAdmin(user);
  const v = z
    .object({
      id: z.string(),
      role: z.enum(["ADMIN", "SUPER_ADMIN"]).optional(),
      status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
    })
    .parse(raw);
  if (v.id === user.id) throw new HttpError(400, "OWN_ADMIN_ACCOUNT");
  if (
    (action === "staffRole" && !v.role) ||
    (action === "staffStatus" && !v.status)
  )
    throw new HttpError(400, "INVALID_INPUT");
  const password =
    action === "staffPassword" ? randomBytes(12).toString("base64url") : null;
  const passwordHash = password ? await hash(password, 12) : null;
  const target = await db.$transaction(
    async (tx) => {
      const actor = await tx.user.findUnique({ where: { id: user.id } });
      if (actor?.role !== "SUPER_ADMIN" || actor.status !== "ACTIVE")
        throw new HttpError(403, "FORBIDDEN");
      const target = await tx.user.findUnique({ where: { id: v.id } });
      if (!target || !isAdmin(target.role))
        throw new HttpError(404, "NOT_FOUND");
      await tx.user.update({
        where: { id: v.id },
        data:
          action === "staffRole"
            ? { role: v.role }
            : action === "staffStatus"
              ? { status: v.status }
              : { mustChangePassword: true },
      });
      if (passwordHash)
        await tx.account.updateMany({
          where: { userId: v.id, providerId: "credential" },
          data: { password: passwordHash },
        });
      await tx.session.deleteMany({ where: { userId: v.id } });
      await tx.auditLog.create({
        data: { adminId: user.id, action, entityId: v.id },
      });
      return target;
    },
    { isolationLevel: "Serializable" },
  );
  return password
    ? { name: target.name, username: target.username, password }
    : { ok: true };
}
