import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { reloadConfig } from "./config.js";
const ORIGINAL_ENV = { ...process.env };

describe("Config", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    process.env.OPENAI_API_KEY = "sk-test-key";
  });

  afterAll(() => {
    // Restore original env without deleting extra keys
    for (const key of Object.keys(process.env)) {
      if (!(key in ORIGINAL_ENV)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("loads config from environment variables", () => {
    const config = reloadConfig();
    expect(config.databaseUrl).toBe("postgresql://test:test@localhost:5432/test");
    expect(config.anthropicApiKey).toBe("sk-ant-test-key");
    expect(config.openaiApiKey).toBe("sk-test-key");
  });

  it("uses defaults for optional values", () => {
    const config = reloadConfig();
    expect(config.llmChatModel).toBe("claude-3-5-sonnet-20241022");
    expect(config.llmEmbeddingModel).toBe("text-embedding-3-small");
    expect(config.documentsDir).toBe("./documents");
  });

  it("throws on missing required env vars", () => {
    // Backup actual env keys so we can delete them cleanly
    const dbUrl = process.env.DATABASE_URL;
    const antKey = process.env.ANTHROPIC_API_KEY;
    const oaiKey = process.env.OPENAI_API_KEY;

    delete process.env.DATABASE_URL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(() => reloadConfig()).toThrow(/DATABASE_URL/);

    // Restore
    process.env.DATABASE_URL = dbUrl;
    process.env.ANTHROPIC_API_KEY = antKey;
    process.env.OPENAI_API_KEY = oaiKey;
  });
});
