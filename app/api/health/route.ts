import { NextResponse } from "next/server";

import { db } from "@/lib/db";

// 每次請求都要反映即時狀態，不走任何快取
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 3_000;

type HealthResponse = {
  status: "ok" | "degraded";
  database: "ok" | "error";
  timestamp: string;
};

async function isDatabaseReachable(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("database health check timed out")), DB_TIMEOUT_MS);
  });

  try {
    await Promise.race([db.$queryRaw`SELECT 1`, timeout]);
    return true;
  } catch (error) {
    // 只記錄到伺服器端，回應裡不帶任何錯誤細節
    console.error(
      "[health] database check failed:",
      error instanceof Error ? error.message : error,
    );
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const databaseOk = await isDatabaseReachable();

  const body: HealthResponse = {
    status: databaseOk ? "ok" : "degraded",
    database: databaseOk ? "ok" : "error",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: databaseOk ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
