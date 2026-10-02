import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 預設不再內建 Rust 查詢引擎，必須透過 driver adapter 連線；
// 這裡用 node-postgres（pg）。連線字串由 adapter 讀取，Prisma Client 本身不碰 .env。
function createPrismaClient() {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL 未設定，請先複製 .env.example 為 .env");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// 開發模式下 Next.js 熱更新會重複執行模組，把實例掛在 globalThis 避免連線數爆炸。
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
