// Prisma 7 的設定檔：資料庫連線字串不再寫在 schema.prisma，改由這裡提供。
// Prisma CLI 不會自動讀 .env，所以要先載入 dotenv。
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
