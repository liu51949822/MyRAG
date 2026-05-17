import { searchChunksByVector } from "@myrag/core";

export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  similarity: number;
}

export class VectorRetriever {
  private limit: number;
  private threshold: number;

  constructor(options?: { limit?: number; threshold?: number }) {
    this.limit = options?.limit ?? 10;
    this.threshold = options?.threshold ?? 0.5;
  }

  async retrieve(queryEmbedding: number[]): Promise<RetrievedChunk[]> {
    const rows = await searchChunksByVector(
      queryEmbedding,
      this.limit,
      this.threshold,
    );

    return rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      chunkIndex: row.chunk_index,
      metadata: row.metadata,
      similarity: row.similarity,
    }));
  }
}
