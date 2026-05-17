import { createLLMClient, type LLMClient, type EmbeddingResult } from "@myrag/core";

export class EmbeddingService {
  private client: LLMClient | null = null;
  private model: string;

  constructor(model = "text-embedding-3-small") {
    this.model = model;
  }

  private async getClient(): Promise<LLMClient> {
    if (!this.client) {
      this.client = await createLLMClient();
    }
    return this.client;
  }

  async embedText(text: string): Promise<EmbeddingResult> {
    const client = await this.getClient();
    return client.embed(text, { model: this.model });
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const client = await this.getClient();

    const results: EmbeddingResult[] = [];
    const batchSize = 20;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await client.embedBatch(batch, { model: this.model });
      results.push(...batchResults);
    }

    return results;
  }
}
