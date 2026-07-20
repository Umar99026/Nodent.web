import { sql } from "drizzle-orm";

export type AiSafetyEnv = {
  AI_DISABLE_LIVE_CALLS?: string;
  AI_DAILY_USER_REQUEST_LIMIT?: string;
  AI_DAILY_APP_REQUEST_LIMIT?: string;
  AI_SPEND_WARNING_PERCENT?: string;
  OPENAI_DAILY_USER_USD_LIMIT?: string;
  OPENAI_DAILY_APP_USD_LIMIT?: string;
  OPENAI_ENGLISH_MAX_REQUEST_USD?: string;
  AI_REQUEST_TIMEOUT_MS?: string;
};

type Db = { execute: (query: ReturnType<typeof sql>) => Promise<{ rows?: unknown[] }> };

export type AiReservation = {
  id: number;
  requestKey: string;
  warning: boolean;
};

export class AiSafetyError extends Error {
  constructor(
    message: string,
    public readonly code: "ai_disabled" | "ai_duplicate" | "ai_user_limit" | "ai_app_limit",
  ) {
    super(message);
    this.name = "AiSafetyError";
  }
}

const DEFAULT_USER_REQUESTS = 40;
const DEFAULT_APP_REQUESTS = 1000;
const DEFAULT_WARNING_PERCENT = 80;
const DEFAULT_OPENAI_USER_USD = 0.5;
const DEFAULT_OPENAI_APP_USD = 5;
const DEFAULT_OPENAI_ENGLISH_MAX_USD = 0.05;
const DEFAULT_TIMEOUT_MS = 30_000;
let aiSafetyTableReady = false;

function numberEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function flag(raw: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(String(raw ?? "").trim());
}

export function aiLiveCallsDisabled(env: AiSafetyEnv): boolean {
  const nodeEnv = (globalThis as typeof globalThis & {
    process?: { env?: { NODE_ENV?: string } };
  }).process?.env?.NODE_ENV;
  return flag(env.AI_DISABLE_LIVE_CALLS) || String(nodeEnv ?? "").toLowerCase() === "test";
}

export function aiRequestTimeoutMs(env: AiSafetyEnv): number {
  return numberEnv(env.AI_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 90_000);
}

export function openAiEnglishReservationUsd(env: AiSafetyEnv): number {
  return numberEnv(
    env.OPENAI_ENGLISH_MAX_REQUEST_USD,
    DEFAULT_OPENAI_ENGLISH_MAX_USD,
    0.0001,
    10,
  );
}

export async function sha256Key(parts: unknown[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureAiSafetyTable(db: Db): Promise<void> {
  if (aiSafetyTableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_request_events (
      id bigserial PRIMARY KEY,
      request_key text NOT NULL UNIQUE,
      user_id integer NOT NULL,
      route text NOT NULL,
      feature text NOT NULL,
      provider text NOT NULL,
      model text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      reserved_cost_usd double precision NOT NULL DEFAULT 0,
      actual_cost_usd double precision NOT NULL DEFAULT 0,
      input_tokens integer NOT NULL DEFAULT 0,
      cached_input_tokens integer NOT NULL DEFAULT 0,
      output_tokens integer NOT NULL DEFAULT 0,
      total_tokens integer NOT NULL DEFAULT 0,
      latency_ms integer NOT NULL DEFAULT 0,
      success integer NOT NULL DEFAULT 0,
      result_json text,
      error_code text,
      created_at text NOT NULL,
      completed_at text
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ai_request_events_daily_user_idx
    ON ai_request_events (user_id, created_at)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ai_request_events_daily_provider_idx
    ON ai_request_events (provider, created_at)
  `);
  aiSafetyTableReady = true;
}

export async function beginAiRequest(input: {
  db: Db;
  env: AiSafetyEnv;
  requestKey: string;
  userId: number;
  route: string;
  feature: string;
  provider: string;
  model: string;
  reservedCostUsd?: number;
}): Promise<AiReservation> {
  const { db, env } = input;
  if (aiLiveCallsDisabled(env)) {
    throw new AiSafetyError("AI calls are disabled in this environment.", "ai_disabled");
  }
  await ensureAiSafetyTable(db);
  // A deliberate user retry may replace a completed failed attempt; successful and pending
  // requests remain immutable deduplication records. A worker that was terminated before its
  // finally block must not leave the feature locked forever.
  const stalePendingBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await db.execute(sql`
    DELETE FROM ai_request_events
    WHERE request_key = ${input.requestKey}
      AND (status = 'failed' OR (status = 'pending' AND created_at < ${stalePendingBefore}))
  `);

  const userLimit = Math.round(
    numberEnv(env.AI_DAILY_USER_REQUEST_LIMIT, DEFAULT_USER_REQUESTS, 1, 100_000),
  );
  const appLimit = Math.round(
    numberEnv(env.AI_DAILY_APP_REQUEST_LIMIT, DEFAULT_APP_REQUESTS, 1, 1_000_000),
  );
  const warningPercent = numberEnv(
    env.AI_SPEND_WARNING_PERCENT,
    DEFAULT_WARNING_PERCENT,
    1,
    100,
  );
  const userUsdLimit = numberEnv(
    env.OPENAI_DAILY_USER_USD_LIMIT,
    DEFAULT_OPENAI_USER_USD,
    0.001,
    10_000,
  );
  const appUsdLimit = numberEnv(
    env.OPENAI_DAILY_APP_USD_LIMIT,
    DEFAULT_OPENAI_APP_USD,
    0.001,
    1_000_000,
  );
  const reservedCost = Math.max(0, Number(input.reservedCostUsd ?? 0));
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const now = new Date().toISOString();

  // The advisory lock serialises the check+insert statement across edge instances.
  const inserted = await db.execute(sql`
    WITH budget_lock AS (
      SELECT pg_advisory_xact_lock(hashtext(${`nodent-ai-budget:${sinceIso}`}))
    ), totals AS (
      SELECT
        COUNT(*) FILTER (WHERE user_id = ${input.userId})::int AS user_requests,
        COUNT(*)::int AS app_requests,
        COALESCE(SUM(CASE WHEN user_id = ${input.userId} AND provider = 'openai'
          THEN GREATEST(reserved_cost_usd, actual_cost_usd) ELSE 0 END), 0)::float AS user_openai_usd,
        COALESCE(SUM(CASE WHEN provider = 'openai'
          THEN GREATEST(reserved_cost_usd, actual_cost_usd) ELSE 0 END), 0)::float AS app_openai_usd
      FROM ai_request_events, budget_lock
      WHERE created_at >= ${sinceIso}
    )
    INSERT INTO ai_request_events (
      request_key, user_id, route, feature, provider, model,
      reserved_cost_usd, created_at
    )
    SELECT ${input.requestKey}, ${input.userId}, ${input.route}, ${input.feature},
           ${input.provider}, ${input.model}, ${reservedCost}, ${now}
    FROM totals
    WHERE user_requests < ${userLimit}
      AND app_requests < ${appLimit}
      AND (${input.provider} <> 'openai' OR user_openai_usd + ${reservedCost} <= ${userUsdLimit})
      AND (${input.provider} <> 'openai' OR app_openai_usd + ${reservedCost} <= ${appUsdLimit})
    ON CONFLICT (request_key) DO NOTHING
    RETURNING id
  `);
  const id = Number((inserted.rows as { id?: number }[] | undefined)?.[0]?.id ?? 0);
  if (!id) {
    const existing = await db.execute(sql`
      SELECT id, status FROM ai_request_events WHERE request_key = ${input.requestKey} LIMIT 1
    `);
    if ((existing.rows as unknown[] | undefined)?.length) {
      throw new AiSafetyError("This AI request is already being processed.", "ai_duplicate");
    }
    const totals = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE user_id = ${input.userId})::int AS user_requests,
        COUNT(*)::int AS app_requests,
        COALESCE(SUM(CASE WHEN user_id = ${input.userId} AND provider = 'openai'
          THEN GREATEST(reserved_cost_usd, actual_cost_usd) ELSE 0 END), 0)::float AS user_openai_usd,
        COALESCE(SUM(CASE WHEN provider = 'openai'
          THEN GREATEST(reserved_cost_usd, actual_cost_usd) ELSE 0 END), 0)::float AS app_openai_usd
      FROM ai_request_events WHERE created_at >= ${sinceIso}
    `);
    const row = (totals.rows as Record<string, unknown>[] | undefined)?.[0] ?? {};
    const userBlocked = Number(row.user_requests ?? 0) >= userLimit ||
      (input.provider === "openai" && Number(row.user_openai_usd ?? 0) + reservedCost > userUsdLimit);
    throw new AiSafetyError(
      userBlocked
        ? "Your daily AI safety limit has been reached. Try again after the daily reset."
        : "The app-wide daily AI safety limit has been reached. Please try again tomorrow.",
      userBlocked ? "ai_user_limit" : "ai_app_limit",
    );
  }

  const afterInsert = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE user_id = ${input.userId})::int AS user_requests,
      COUNT(*)::int AS app_requests,
      COALESCE(SUM(CASE WHEN user_id = ${input.userId} AND provider = 'openai'
        THEN GREATEST(reserved_cost_usd, actual_cost_usd) ELSE 0 END), 0)::float AS user_openai_usd,
      COALESCE(SUM(CASE WHEN provider = 'openai'
        THEN GREATEST(reserved_cost_usd, actual_cost_usd) ELSE 0 END), 0)::float AS app_openai_usd
    FROM ai_request_events WHERE created_at >= ${sinceIso}
  `);
  const after = (afterInsert.rows as Record<string, unknown>[] | undefined)?.[0] ?? {};
  const warning =
    Number(after.user_requests ?? 0) >= userLimit * (warningPercent / 100) ||
    Number(after.app_requests ?? 0) >= appLimit * (warningPercent / 100) ||
    (input.provider === "openai" && (
      Number(after.user_openai_usd ?? 0) >= userUsdLimit * (warningPercent / 100) ||
      Number(after.app_openai_usd ?? 0) >= appUsdLimit * (warningPercent / 100)
    ));
  if (warning) {
    console.warn(JSON.stringify({
      event: "ai_spend_warning",
      timestamp: now,
      route: input.route,
      feature: input.feature,
      userId: input.userId,
      provider: input.provider,
      model: input.model,
    }));
  }
  return { id, requestKey: input.requestKey, warning };
}

export async function finishAiRequest(input: {
  db: Db;
  reservation: AiReservation;
  success: boolean;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  actualCostUsd?: number;
  result?: unknown;
  errorCode?: string;
}): Promise<void> {
  const completedAt = new Date().toISOString();
  const resultJson = input.result == null ? null : JSON.stringify(input.result).slice(0, 50_000);
  await input.db.execute(sql`
    UPDATE ai_request_events
    SET status = ${input.success ? "complete" : "failed"},
        success = ${input.success ? 1 : 0},
        input_tokens = ${Math.max(0, Math.round(input.inputTokens ?? 0))},
        cached_input_tokens = ${Math.max(0, Math.round(input.cachedInputTokens ?? 0))},
        output_tokens = ${Math.max(0, Math.round(input.outputTokens ?? 0))},
        total_tokens = ${Math.max(0, Math.round(input.totalTokens ?? 0))},
        latency_ms = ${Math.max(0, Math.round(input.latencyMs ?? 0))},
        actual_cost_usd = ${Math.max(0, Number(input.actualCostUsd ?? 0))},
        reserved_cost_usd = ${Math.max(0, Number(input.actualCostUsd ?? 0))},
        result_json = ${resultJson},
        error_code = ${input.errorCode ?? null},
        completed_at = ${completedAt}
    WHERE id = ${input.reservation.id}
  `);
}

export async function readCachedAiResult<T>(db: Db, requestKey: string): Promise<T | null> {
  await ensureAiSafetyTable(db);
  const rows = await db.execute(sql`
    SELECT result_json FROM ai_request_events
    WHERE request_key = ${requestKey} AND status = 'complete' AND success = 1
    LIMIT 1
  `);
  const raw = (rows.rows as { result_json?: string | null }[] | undefined)?.[0]?.result_json;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function aiSafetyStatus(error: unknown): number {
  if (!(error instanceof AiSafetyError)) return 500;
  return error.code === "ai_duplicate" ? 409 : error.code === "ai_disabled" ? 503 : 429;
}
