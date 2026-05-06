import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code workspace: skill scripts and isolated worktrees aren't part
    // of the app and pull in unrelated lint errors when scanned by `next lint`.
    ".claude/**",
    // Supabase Edge Functions are Deno code, not Node/Next.js. Lint them with
    // Deno's tooling rather than next lint's TypeScript ESLint stack.
    "supabase/**",
  ]),
]);

export default eslintConfig;
