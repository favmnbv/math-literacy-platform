import { createHmac } from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { limit } from "@/lib/rate-limit";
import {
  HttpError,
  readJsonBody,
  requireSameOrigin,
} from "@/lib/http-security";
import { toNextJsHandler } from "better-auth/next-js";
const handlers = toNextJsHandler(auth);
export const runtime = "nodejs";

function error(code: string, status: number) {
  return Response.json(
    { error: code, message: code },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 429 ? { "Retry-After": "300" } : {}),
      },
    },
  );
}

// All account changes go through the permission-checked platform API.
export async function GET() {
  return error("NOT_FOUND", 404);
}

export async function POST(request: Request) {
  try {
    const path = new URL(request.url).pathname;
    if (!["/api/auth/sign-in/username", "/api/auth/sign-out"].includes(path))
      return error("NOT_FOUND", 404);
    requireSameOrigin(request);
    const body = await readJsonBody(request, 4096);
    if (path.endsWith("/sign-in/username")) {
      if (
        typeof body.username !== "string" ||
        !/^[a-zA-Z0-9_.-]{3,40}$/.test(body.username) ||
        typeof body.password !== "string" ||
        body.password.length > 256
      )
        return error("INVALID_CREDENTIALS", 400);
      await limit("auth:global-sign-in", 120);
      const key = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
        .update(body.username.toLowerCase())
        .digest("hex");
      await limit(`auth:account:${key}`, 8, 300);
      await db.apiLimit.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - 86400000) } },
      });
    } else {
      await limit("auth:global-sign-out", 300);
    }
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    const response = await handlers.POST(
      new Request(request.url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (e) {
    if (e instanceof HttpError) return error(e.code, e.status);
    console.error(
      "Auth request failed:",
      e instanceof Error ? e.name : "UnknownError",
    );
    return error("AUTH_FAILED", 500);
  }
}
