# Security and deployment notes

## Application controls

- All platform API operations load a current database-backed session and reject blocked users. Temporary passwords must be changed before course or administrative access.
- Student data queries are scoped to the logged-in student; curator queries and mutations require an explicit assignment. Only superadmins can manage staff and assignments.
- The public authentication surface is limited to username sign-in and sign-out. Profile and password changes go through the protected platform API; public registration is disabled.
- Authentication attempts have atomic PostgreSQL limits: eight attempts per normalized username per five minutes, and 120 sign-in attempts per minute across the service. Spoofing forwarding headers cannot reset these limits. This deliberately permits bounded denial of sign-in when an account or the service is attacked; the window expires automatically.
- Platform reads and writes have per-account limits. Mutations require an exact Origin and JSON; body byte limits are enforced while reading the stream.
- Passwords use bcrypt with random initial passwords, compulsory changes for provisioned accounts, and the 72-byte bcrypt limit. Blocking, resetting passwords and staff role changes revoke sessions.
- Grading, answer keys, attempt counts, access dates and enrollment checks run on the server. Serializable transactions and unique constraints protect submission counts and request idempotency.
- Production HTML uses a fresh script nonce and CSP without `unsafe-inline` or `unsafe-eval` for scripts. Inline styles remain necessary for Radix, Framer Motion and KaTeX. Responses include anti-framing and MIME-sniffing protection; HTTPS deployments receive HSTS. Sensitive API responses are not cached.

## Validation performed before deployment

2026-09-29, on an isolated local database and the production Next.js build:

- Dependency audit initially reported 51 advisories in eight transitive packages. Patched versions are pinned in `pnpm-workspace.yaml`; repeat `pnpm audit` before each release.
- Unit tests cover grading, streaming byte limits, malformed JSON, content types, Origin spoofing and production configuration.
- Browser/API tests cover authentication cookies, hidden files, parser-inserted XSS blocked by CSP, sign-in throttling with changing spoofed IPs, temporary-password enforcement, role injection, blocked accounts, and concurrent submissions.
- Existing student and administration flows are tested in both curricula. The separate permissions suite verifies two curators, direct-ID requests, assignment revocation, staff management and session invalidation.
- Tracked files and Git history were checked against the existing local credentials and environment secrets; no matches were found. The GitHub repository was verified private.

Additional validation on 2026-09-29:

- All three security browser/API tests passed against an isolated Neon PostgreSQL branch with a ten-connection pool. Five concurrent homework submissions accepted exactly three attempts; grading, temporary passwords, session revocation and throttling checks passed.
- All three migrations, content seeding and administrator bootstrap were verified on that branch before applying them to production. Repeating bootstrap left the existing administrator unchanged.
- Production contains two courses, 64 lessons, two homework sets and one initial superadmin with compulsory password change. No demo accounts were installed. Runtime uses a pooled Neon connection; migrations use the direct connection, both with explicit certificate verification.
- Render uses the free plan, a frozen-lockfile build, a `/login` health check, a unique production authentication secret and HTTPS origin. Local `.env` and existing credentials were preserved; production credentials and cloud environment files remain Git-ignored.
- Live HTTPS checks verified rotating script nonces, HSTS, Secure/HttpOnly/SameSite cookies, blocked private files, anonymous API restrictions, disabled registration, CSRF rejection and forced password change. Browser hydration and the first-login screen were inspected separately.

This is a source review and automated application test pass, not a certification or a guarantee of immunity. No destructive testing or flood testing is performed on the public service. A 15-user load test and playback checks from students' networks remain separate acceptance tests.

## Release requirements

1. Keep the repository private: seed content and README contain homework keys. `.env`, `.env.neon`, `.neon` and `credentials*.local.txt` must stay out of commits.
2. Set a unique random `BETTER_AUTH_SECRET` (at least 32 characters), the exact HTTPS `BETTER_AUTH_URL`, and the Neon pooled `DATABASE_URL` in Render. Set `DEMO_SEED=false`. Do not enable `ALLOW_LOCAL_PREVIEW` on a hosting service. Never reuse the local demo passwords for public accounts.
3. Use the pinned Node.js/pnpm versions and frozen lockfile. Build with `pnpm build`. Apply reviewed migrations with `pnpm db:deploy`; the new expiry index does not alter user data. `pnpm start` listens on `0.0.0.0` and respects Render's `PORT`.
4. Provision the first real superadmin separately, require a password change, and confirm the absence of demo accounts. The empty `neon.ts` provisions no application tables or users by itself.
5. Before inviting testers, verify HTTPS, Secure/HttpOnly/SameSite cookies, login/logout, session revocation, curator boundaries, video playback and homework submission on the actual site. Check Render logs and migration status.
6. Enable MFA on GitHub, Render and Neon accounts, restrict collaborators, and establish database backup/restore procedures. Application-level MFA and automated alerting are not implemented.

## Limits

- Free hosting and an application limiter do not guarantee availability under DDoS. The global sign-in limit is a deliberate resource-protection tradeoff, not a replacement for an edge WAF.
- Google Drive links can be shared outside the platform. Viewing is self-confirmed by design; the application does not verify video playback duration.
- Administrators and curators can modify shared course content and group schedules as requested. A compromised staff account can act within those permissions; use unique strong passwords.
- Only two homework sets are loaded. Missing educational content is not replaced with demo material.
- Use synthetic/minimal test identities until the centre has settled requirements for real student data storage, access and retention.

## Running the checks

```sh
pnpm typecheck
pnpm test
pnpm audit
```

Run Playwright only against an explicitly isolated database. Set `E2E_BASE_URL`, `E2E_CREDENTIALS`, and `E2E_PRODUCTION=1` for a built server. Set `E2E_SECURITY_TESTS=1` for `tests/browser/security.spec.ts` and `E2E_PERMISSIONS_TESTS=1` for `tests/browser/permissions.spec.ts`. Use a fresh database for each suite: the permissions suite depends on an untouched fixture. For PGlite with an explicit local `DATABASE_URL`, set `DATABASE_POOL_SIZE=1`; real PostgreSQL defaults to ten connections.
