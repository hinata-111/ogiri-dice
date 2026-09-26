import { buildCpuPrompt, buildEvaluatePrompt } from "./prompts";
import { callGemini } from "./gemini";
import { RateLimiter } from "./rateLimiter";
import { roomRoute, reply, type RoomEnv } from './room';
export { GameRoom } from './room';

interface Env {
  GEMINI_API_KEY: string;
  ROOMS?: DurableObjectNamespace;
  USE_MOCK?: string;
}

// ホットシートプレイでは人間+CPU複数人が同一IPから連続リクエストするため、
// 10/分では枯渇しやすい。30/分に緩和。
const limiter = new RateLimiter(30, 60_000);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const EVAL_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER", description: "1〜6の整数" },
    comment: { type: "STRING", description: "短いツッコミ" },
  },
  required: ["score", "comment"],
};

const CPU_SCHEMA = {
  type: "OBJECT",
  properties: { answer: { type: "STRING" } },
  required: ["answer"],
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (new URL(request.url).pathname.startsWith('/api/rooms')) {
      if (!env.ROOMS) return reply({ error: 'オンライン対戦の設定がありません' }, 503);
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (!limiter.allow(`room:${ip}`)) return reply({ error: '少し待ってからお試しください' }, 429);
      try { return await roomRoute(request, env as RoomEnv); }
      catch { return reply({ error: '入力をご確認ください' }, 400); }
    }
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (!limiter.allow(ip)) return json({ error: "rate_limited" }, 429);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad_request" }, 400);
    }

    const path = new URL(request.url).pathname;

    if (path === "/api/evaluate") {
      const { topic, answer } = body as { topic?: unknown; answer?: unknown };
      if (
        typeof topic !== "string" || typeof answer !== "string" ||
        topic.length === 0 || topic.length > 200 ||
        answer.length === 0 || answer.length > 120
      ) {
        return json({ error: "bad_request" }, 400);
      }
      try {
        const raw = (await callGemini(
          env.GEMINI_API_KEY,
          buildEvaluatePrompt(topic, answer),
          EVAL_SCHEMA,
        )) as { score?: unknown; comment?: unknown };
        if (typeof raw.score !== "number" || typeof raw.comment !== "string") {
          return json({ error: "gemini_failed" }, 502);
        }
        return json({ score: clamp(raw.score, 1, 6), comment: raw.comment });
      } catch (e) {
        console.error("evaluate failed:", e);
        return json({ error: "gemini_failed" }, 502);
      }
    }

    if (path === "/api/cpu-answer") {
      const { topic, personality } = body as { topic?: unknown; personality?: unknown };
      if (
        typeof topic !== "string" || topic.length === 0 || topic.length > 200 ||
        (personality !== "safe" && personality !== "bold")
      ) {
        return json({ error: "bad_request" }, 400);
      }
      try {
        const raw = (await callGemini(
          env.GEMINI_API_KEY,
          buildCpuPrompt(topic, personality),
          CPU_SCHEMA,
        )) as { answer?: unknown };
        if (typeof raw.answer !== "string" || raw.answer.length === 0) {
          return json({ error: "gemini_failed" }, 502);
        }
        return json({ answer: raw.answer.slice(0, 100) });
      } catch (e) {
        console.error("cpu-answer failed:", e);
        return json({ error: "gemini_failed" }, 502);
      }
    }

    return json({ error: "not_found" }, 404);
  },
};
