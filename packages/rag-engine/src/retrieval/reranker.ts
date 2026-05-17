import { createLLMClient, type LLMClient } from "@myrag/core";
import type { RetrievedChunk } from "./vector-retriever.js";

export interface RerankedResult {
  chunk: RetrievedChunk;
  relevanceScore: number;
  relevanceReason: string;
}

export class Reranker {
  private client: LLMClient | null = null;

  private async getClient(): Promise<LLMClient> {
    if (!this.client) {
      this.client = await createLLMClient();
    }
    return this.client;
  }

  async rerank(
    query: string,
    chunks: RetrievedChunk[],
    topK = 5,
  ): Promise<RerankedResult[]> {
    if (chunks.length <= topK) {
      return chunks.map((c) => ({
        chunk: c,
        relevanceScore: c.similarity,
        relevanceReason: "Initial retrieval",
      }));
    }

    const client = await this.getClient();

    const chunkTexts = chunks
      .map((c, i) => `[${i}] ${c.content.slice(0, 500)}`)
      .join("\n\n");

    const prompt = `Given the query: "${query}"

Review the following document chunks and rate each one's relevance to the query on a scale of 0-10.

${chunkTexts}

Return a JSON array of objects with fields: { index: number, score: number, reason: string }
Only include chunks that are relevant (score > 3). Sort by score descending.
Return ONLY the JSON array, no other text.`;

    const response = await client.chat(
      [{ role: "user", content: prompt }],
      { temperature: 0.1, maxTokens: 2000 },
    );

    const scored = this.parseRerankResponse(response.content);

    const scoreMap = new Map(scored.map((s) => [s.index, s]));

    return chunks
      .map((chunk, i) => {
        const score = scoreMap.get(i);
        return {
          chunk,
          relevanceScore: score?.score ?? chunk.similarity,
          relevanceReason: score?.reason ?? "Fallback similarity score",
        };
      })
      .filter((r) => r.relevanceScore > 3)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topK);
  }

  private parseRerankResponse(content: string): Array<{ index: number; score: number; reason: string }> {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
    }
    return [];
  }
}
