// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: queryRaw },
}));

import { GET } from "./route";

const FAKE_DATABASE_URL = "postgresql://secret-user:secret-pass@db.internal:5432/nearbite";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", FAKE_DATABASE_URL);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
    queryRaw.mockReset();
  });

  it("資料庫正常時回 200 ok", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({ status: "ok", database: "ok" });
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });

  it("查詢拋錯時回 503 degraded，且不洩漏連線資訊", async () => {
    queryRaw.mockRejectedValue(
      new Error(`connect ECONNREFUSED db.internal:5432 ${FAKE_DATABASE_URL}`),
    );

    const res = await GET();
    const text = await res.text();

    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.parse(text)).toMatchObject({ status: "degraded", database: "error" });
    expect(text).not.toContain("secret-pass");
    expect(text).not.toContain("db.internal");
    expect(text).not.toContain("ECONNREFUSED");
  });

  it("查詢超過 3 秒沒回應時回 503 degraded", async () => {
    vi.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => undefined));

    const pending = GET();
    await vi.advanceTimersByTimeAsync(3_000);
    const res = await pending;
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({ status: "degraded", database: "error" });
  });
});
