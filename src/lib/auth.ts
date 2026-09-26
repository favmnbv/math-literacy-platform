import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { compare, hash } from "bcryptjs";
import { db } from "./db";
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
      hash: (p) => hash(p, 12),
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
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/username": { window: 60, max: 5 },
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "STUDENT", input: false },
      status: { type: "string", defaultValue: "ACTIVE", input: false },
    },
  },
});
