import { VectorRetriever, type RetrievedChunk } from "./vector-retriever.js";
import { EmbeddingService } from "../embedding/embedder.js";

export interface HybridSearchResult {
  chunks: RetrievedChunk[];
  fusedScores: Map<string, number>;
}

export class HybridRetriever {
  private vectorRetriever: VectorRetriever;
  private embedder: EmbeddingService;
  private vectorWeight: number;

  constructor(options?: { limit?: number; threshold?: number; vectorWeight?: number }) {
    this.vectorRetriever = new VectorRetriever({
      limit: options?.limit,
      threshold: options?.threshold,
    });
    this.embedder = new EmbeddingService();
    this.vectorWeight = options?.vectorWeight ?? 0.8;
  }

  async retrieve(query: string): Promise<HybridSearchResult> {
    const embedding = await this.embedder.embedText(query);

    const vectorResults = await this.vectorRetriever.retrieve(embedding.embedding);

    const fusedScores = new Map<string, number>();

    for (const chunk of vectorResults) {
      const keywordBonus = this.computeKeywordScore(query, chunk.content);
      const fusedScore = this.vectorWeight * chunk.similarity + (1 - this.vectorWeight) * keywordBonus;
      fusedScores.set(chunk.id, fusedScore);
    }

    const sorted = vectorResults
      .filter((c) => (fusedScores.get(c.id) ?? 0) > 0.3)
      .sort((a, b) => (fusedScores.get(b.id) ?? 0) - (fusedScores.get(a.id) ?? 0));

    return {
      chunks: sorted,
      fusedScores,
    };
  }

  private computeKeywordScore(query: string, content: string): number {
    const queryTokens = new Set(query.toLowerCase().split(/\s+/));
    const contentLower = content.toLowerCase();

    let matches = 0;
    for (const token of queryTokens) {
      if (token.length >= 2 && contentLower.includes(token)) {
        matches++;
      }
    }

    return queryTokens.size > 0 ? matches / queryTokens.size : 0;
  }
}
