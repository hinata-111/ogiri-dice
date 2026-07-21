import { describe, expect, it } from "vitest";
import handler from "./index";

const env = { GEMINI_API_KEY: "dummy" };

function req(
  method: string,
  path: string,
  body?: string,
  ip = "127.0.0.1",
): Request {
  const headers = new Headers({ "CF-Connecting-IP": ip });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return new Request(`http://localhost${path}`, { method, headers, body });
}

describe("worker index handler", () => {
  it("OPTIONSは204でCORSヘッダー付き", async () => {
    const res = await handler.fetch(req("OPTIONS", "/api/evaluate"), env);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("POST以外は405", async () => {
    const res = await handler.fetch(req("GET", "/api/evaluate"), env);
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ error: "method_not_allowed" });
  });

  it("不正なJSON bodyは400", async () => {
    const res = await handler.fetch(
      req("POST", "/api/evaluate", "not json", "192.0.2.1"),
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
  });

  it("評価APIへ必須項目欠落のbodyを送ると400", async () => {
    const res = await handler.fetch(
      req("POST", "/api/evaluate", JSON.stringify({}), "192.0.2.2"),
      env,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
  });

  it("同一IPから制限(30/分)を超えると429", async () => {
    const ip = "203.0.113.9";
    let last: Response | undefined;
    for (let i = 0; i < 31; i++) {
      last = await handler.fetch(
        req("POST", "/api/evaluate", "not json", ip),
        env,
      );
    }
    expect(last?.status).toBe(429);
    expect(await last?.json()).toEqual({ error: "rate_limited" });
  });
});
