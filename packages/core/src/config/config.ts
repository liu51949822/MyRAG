/**
 * Application configuration loaded from environment variables.
 */
export interface AppConfig {
  /** PostgreSQL connection string */
  databaseUrl: string;
  /** Anthropic API key for Claude */
  anthropicApiKey: string;
  /** OpenAI API key (used for embeddings) */
  openaiApiKey: string;
  /** Primary chat model ID */
  llmChatModel: string;
  /** Embedding model ID */
  llmEmbeddingModel: string;
  /** Directory for document storage */
  documentsDir: string;
}

let cachedConfig: AppConfig | null = null;

/**
 * Load configuration from environment variables.
 * Results are cached after first call.
 */
export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    databaseUrl: requireEnv("DATABASE_URL"),
    anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
    openaiApiKey: requireEnv("OPENAI_API_KEY"),
    llmChatModel: process.env.LLM_CHAT_MODEL || "claude-3-5-sonnet-20241022",
    llmEmbeddingModel: process.env.LLM_EMBEDDING_MODEL || "text-embedding-3-small",
    documentsDir: process.env.DOCUMENTS_DIR || "./documents",
  };

  return cachedConfig;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Copy .env.example to .env and fill in your values.`
    );
  }
  return value;
}

/** Reload config (useful for testing) */
export function reloadConfig(): AppConfig {
  cachedConfig = null;
  return loadConfig();
}
