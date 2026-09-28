import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HttpError,
  readJsonBody,
  requireSameOrigin,
  validateProductionEnvironment,
} from "../src/lib/http-security";

test("JSON reader rejects chunked oversize bodies before consuming remaining chunks", async () => {
  let reads = 0,
    cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      reads++;
      controller.enqueue(new Uint8Array(1024));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("http://localhost/api", {
    method: "POST",
    body: stream,
    headers: { "Content-Type": "application/json" },
    duplex: "half",
  } as RequestInit);
  await assert.rejects(
    readJsonBody(request, 1500),
    (e: unknown) => e instanceof HttpError && e.status === 413,
  );
  assert.equal(cancelled, true);
  assert.ok(reads <= 3);
});

test("JSON reader measures UTF-8 bytes and validates objects/content types", async () => {
  const req = (body: string, type = "application/json") =>
    new Request("http://localhost/api", {
      method: "POST",
      body,
      headers: { "Content-Type": type },
    });
  await assert.rejects(readJsonBody(req('{"name":"Қазақ"}'), 18), {
    status: 413,
  });
  for (const body of ["null", "[]", "false", "bad json"])
    await assert.rejects(readJsonBody(req(body), 100), { status: 400 });
  await assert.rejects(readJsonBody(req("{}", "text/plain"), 100), {
    status: 415,
  });
  assert.deepEqual(await readJsonBody(req('{"ok":true}'), 100), { ok: true });
});

test("mutations require the exact configured origin, regardless of forwarded headers", () => {
  const url = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  for (const origin of [
    "https://attacker.example",
    "null",
    "",
    url + ".attacker.example",
  ])
    assert.throws(
      () =>
        requireSameOrigin(
          new Request(url, {
            headers: { origin, "x-forwarded-host": new URL(url).host },
          }),
        ),
      { status: 403 },
    );
  assert.doesNotThrow(() =>
    requireSameOrigin(
      new Request(url, { headers: { origin: new URL(url).origin } }),
    ),
  );
  assert.throws(
    () =>
      requireSameOrigin(
        new Request(url, {
          headers: {
            origin: new URL(url).origin,
            "sec-fetch-site": "cross-site",
          },
        }),
      ),
    { status: 403 },
  );
});

test("production rejects missing HTTPS, weak secrets, missing database and demo accounts", () => {
  const safe: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    BETTER_AUTH_URL: "https://talan.example",
    BETTER_AUTH_SECRET: "a".repeat(64),
    DATABASE_URL: "postgresql://db.example/test",
  };
  assert.doesNotThrow(() => validateProductionEnvironment(safe));
  for (const patch of [
    { BETTER_AUTH_URL: "http://localhost:3000" },
    { BETTER_AUTH_URL: "https://talan.example/path" },
    { BETTER_AUTH_SECRET: "short" },
    { DATABASE_URL: "" },
    { DEMO_SEED: "true" },
    {
      BETTER_AUTH_URL: "http://localhost:3000",
      ALLOW_LOCAL_PREVIEW: "true",
      RENDER: "true",
    },
  ])
    assert.throws(() => validateProductionEnvironment({ ...safe, ...patch }));
});
