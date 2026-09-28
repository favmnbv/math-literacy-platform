import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { compare, hash } from "bcryptjs";
import { db } from "./db";
import { validateProductionEnvironment } from "./http-security";
validateProductionEnvironment();
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 64,
    password: {
      hash: (p) => {
        if (Buffer.byteLength(p, "utf8") > 72)
          throw new Error("Password exceeds bcrypt byte limit");
        return hash(p, 12);
      },
      verify: ({ hash: h, password }) => compare(password, h),
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  plugins: [
    username({
      usernameValidator: (v) => /^[a-z0-9_.-]{3,40}$/.test(v),
      maxUsernameLength: 40,
    }),
  ],
  // The public route enforces atomic account and global database limits,
  // independent of spoofable IP headers and shared school networks.
  rateLimit: { enabled: false },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
          });
          if (!user || user.status !== "ACTIVE") return false;
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "STUDENT", input: false },
      status: { type: "string", defaultValue: "ACTIVE", input: false },
    },
  },
});
