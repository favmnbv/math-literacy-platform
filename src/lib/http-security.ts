export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export function authOrigin() {
  return new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000").origin;
}

export function requireSameOrigin(request: Request) {
  if (
    request.headers.get("origin") !== authOrigin() ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(403, "INVALID_ORIGIN");
}

// Limit bytes during streaming, before buffering an untrusted chunked body.
export async function readJsonBody(request: Request, maxBytes: number) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    throw new HttpError(415, "JSON_REQUIRED");
  if (Number(request.headers.get("content-length") || 0) > maxBytes)
    throw new HttpError(413, "TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "INVALID_INPUT");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Expected object");
    return body as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "INVALID_INPUT");
  }
}

export function validateProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env.NODE_ENV !== "production") return;
  const url = new URL(env.BETTER_AUTH_URL || "http://localhost");
  if (
    env.ALLOW_LOCAL_PREVIEW === "true" &&
    !env.RENDER &&
    !env.VERCEL &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    return;
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Production requires BETTER_AUTH_URL set to the HTTPS site origin.",
    );
  if (
    !env.BETTER_AUTH_SECRET ||
    env.BETTER_AUTH_SECRET.length < 32 ||
    /replace|example|changeme/i.test(env.BETTER_AUTH_SECRET)
  )
    throw new Error(
      "Production requires a random BETTER_AUTH_SECRET of at least 32 characters.",
    );
  if (!env.DATABASE_URL) throw new Error("Production requires DATABASE_URL.");
  if (env.DEMO_SEED === "true")
    throw new Error("DEMO_SEED must be disabled in production.");
}
