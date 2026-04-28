import { Hono } from "hono";
import { eq, or, sql } from "drizzle-orm";
import { users, sessions } from "../db/schema";
import { hashPassword, verifyPassword } from "../lib/password";
import { createToken, sessionExpiry } from "../lib/token";
import { cleanText, nowIso } from "../lib/utils";
import { authMiddleware } from "../middleware/auth";
import type { Bindings, Variables } from "../types";

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Signup
async function handleSignup(c: any) {
  const body = await c.req.json();
  const db = c.get("db");

  const username = cleanText(body.username, 40);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();

  if (username.length < 2) {
    return c.json({ error: "Username must be at least 2 characters." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Please enter a valid email address." }, 400);
  }
  if (password.length < 4) {
    return c.json({ error: "Password must be at least 4 characters." }, 400);
  }

  const existingEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingEmail.length > 0) {
    return c.json(
      { error: "An account with this email already exists." },
      400
    );
  }

  const existingUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.username}) = LOWER(${username})`)
    .limit(1);
  if (existingUsername.length > 0) {
    return c.json({ error: "That username is already taken." }, 400);
  }

  const { salt, hash } = await hashPassword(password);
  const createdAt = nowIso();

  const result = await db
    .insert(users)
    .values({
      username,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      hashAlgorithm: "pbkdf2",
      createdAt,
    })
    .returning({ id: users.id });

  const userId = result[0].id;
  const token = createToken();
  const expiresAt = sessionExpiry();

  await db.insert(sessions).values({
    token,
    userId,
    createdAt,
    expiresAt,
  });

  return c.json({ token, user: { id: userId, username, email } });
}

// Login
async function handleLogin(c: any) {
  const body = await c.req.json();
  const db = c.get("db");

  const loginValue = String(body.email || body.username || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "").trim();

  if (!loginValue || !password) {
    return c.json(
      { error: "Please enter your email or username and password." },
      400
    );
  }

  const result = await db
    .select()
    .from(users)
    .where(
      or(
        sql`LOWER(${users.email}) = ${loginValue}`,
        sql`LOWER(${users.username}) = ${loginValue}`
      )
    )
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Invalid login details." }, 400);
  }

  const user = result[0];

  if (!user.passwordSalt || !user.passwordHash) {
    return c.json(
      { error: "This account is missing password data. Please sign up again." },
      400
    );
  }

  if (user.hashAlgorithm === "scrypt") {
    return c.json(
      {
        error:
          "Your account needs a password reset due to a security upgrade. Please sign up again with the same email.",
      },
      400
    );
  }

  const valid = await verifyPassword(
    password,
    user.passwordSalt,
    user.passwordHash
  );
  if (!valid) {
    return c.json({ error: "Invalid login details." }, 400);
  }

  const token = createToken();
  const expiresAt = sessionExpiry();

  await db.insert(sessions).values({
    token,
    userId: user.id,
    createdAt: nowIso(),
    expiresAt,
  });

  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username || user.email,
      email: user.email,
    },
  });
}

// Logout
async function handleLogout(c: any) {
  const user = c.get("user");
  const db = c.get("db");
  await db.delete(sessions).where(eq(sessions.token, user.token));
  return c.json({ ok: true });
}

async function handleUpdateAccount(c: any) {
  const authUser = c.get("user");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));

  const hasUsername = Object.prototype.hasOwnProperty.call(body, "username");
  const hasCurrentPassword = Object.prototype.hasOwnProperty.call(body, "currentPassword");
  const hasNewPassword = Object.prototype.hasOwnProperty.call(body, "newPassword");

  const username = hasUsername ? cleanText(body.username, 40) : undefined;
  const currentPassword = hasCurrentPassword ? String(body.currentPassword || "").trim() : "";
  const newPassword = hasNewPassword ? String(body.newPassword || "").trim() : "";

  const rows = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);
  if (rows.length === 0) {
    return c.json({ error: "User not found." }, 404);
  }

  const user = rows[0];
  const updates: Partial<typeof users.$inferInsert> = {};

  if (hasUsername) {
    if (!username || username.length < 2) {
      return c.json({ error: "Username must be at least 2 characters." }, 400);
    }

    const existingUsername = await db
      .select({ id: users.id })
      .from(users)
      .where(
        sql`LOWER(${users.username}) = LOWER(${username}) AND ${users.id} <> ${authUser.id}`
      )
      .limit(1);

    if (existingUsername.length > 0) {
      return c.json({ error: "That username is already taken." }, 400);
    }

    updates.username = username;
  }

  if (hasCurrentPassword || hasNewPassword) {
    if (!currentPassword || !newPassword) {
      return c.json(
        { error: "Enter your current password and a new password." },
        400
      );
    }

    if (newPassword.length < 4) {
      return c.json({ error: "Password must be at least 4 characters." }, 400);
    }

    const valid = await verifyPassword(
      currentPassword,
      user.passwordSalt,
      user.passwordHash
    );
    if (!valid) {
      return c.json({ error: "Current password is incorrect." }, 400);
    }

    const { salt, hash } = await hashPassword(newPassword);
    updates.passwordSalt = salt;
    updates.passwordHash = hash;
    updates.hashAlgorithm = "pbkdf2";
  }

  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, authUser.id));
  }

  const nextUsername = updates.username ?? user.username;
  return c.json({
    user: {
      id: user.id,
      username: nextUsername,
      email: user.email,
    },
  });
}

// Mount routes
auth.post("/signup", handleSignup);
auth.post("/login", handleLogin);
auth.post("/logout", authMiddleware, handleLogout);
auth.patch("/account", authMiddleware, handleUpdateAccount);

export { auth, handleSignup, handleLogin, handleLogout, handleUpdateAccount };
