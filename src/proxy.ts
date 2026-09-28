import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (
    /^\/(?:\.|credentials[^/]*\.txt(?:$|\/)|content\/|prisma\/|node_modules\/|scripts\/)/i.test(
      request.nextUrl.pathname,
    )
  )
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const nonce = randomBytes(24).toString("base64");
  const dev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Radix, Framer Motion and KaTeX use inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "frame-src https://drive.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("content-security-policy", csp);
  headers.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|talan-logo.png|favicon.ico).*)"],
};
