import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db/client";
import { auth, handleSignup, handleLogin, handleLogout } from "./routes/auth";
import { bootstrap } from "./routes/bootstrap";
import { quiz } from "./routes/quiz";
import { leaderboard } from "./routes/leaderboard";
import { competition } from "./routes/competition";
import { comments } from "./routes/comments";
import { written } from "./routes/written";
import { chat } from "./routes/chat";
import { admin } from "./routes/admin";
import { health } from "./routes/health";
import { friends } from "./routes/friends";
import { dojo } from "./routes/dojo";
import { study } from "./routes/study";
import { authMiddleware } from "./middleware/auth";
import type { Bindings, Variables } from "./types";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS
app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      const allowed = c.env.FRONTEND_URL;
      // Allow requests from the configured frontend URL
      if (origin === allowed) return origin;
      // Allow localhost in development
      if (origin?.startsWith("http://localhost:")) return origin;
      return "";
    },
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 86400,
  })
);

// Inject DB into context for every request
app.use("/api/*", async (c, next) => {
  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  await next();
});

// Mount route groups
app.route("/api/auth", auth);
app.route("/api/bootstrap", bootstrap);
app.route("/api/quiz", quiz);
app.route("/api/leaderboard", leaderboard);
app.route("/api/competition", competition);
app.route("/api/comments", comments);
app.route("/api/written", written);
app.route("/api/chat", chat);
app.route("/api/friends", friends);
app.route("/api/dojo", dojo);
app.route("/api/study", study);
app.route("/api/admin", admin);
app.route("/api/health", health);

// Legacy aliases (same handlers, different paths)
app.post("/api/signup", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  return handleSignup(c);
});
app.post("/api/login", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  return handleLogin(c);
});
app.post("/api/logout", async (c, next) => {
  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  await next();
}, authMiddleware, handleLogout);

export default app;
