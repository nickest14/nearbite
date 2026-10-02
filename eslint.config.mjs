import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // typescript-eslint strict：比 eslint-config-next 內建的 recommended 更嚴格
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [tseslint.configs.strict],
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "generated/**", "next-env.d.ts"]),
]);

export default eslintConfig;
