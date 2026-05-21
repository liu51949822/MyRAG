import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/*/src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      ANTHROPIC_API_KEY: "sk-ant-test-key",
      OPENAI_API_KEY: "sk-test-key",
      LLM_CHAT_MODEL: "claude-3-5-sonnet-20241022",
      LLM_EMBEDDING_MODEL: "text-embedding-3-small",
      DOCUMENTS_DIR: "./test-docs",
    },
  },
});
