import { createLLMClient, type LLMClient, type ChatMessage } from "@myrag/core";
import { HybridRetriever } from "../retrieval/hybrid-retriever.js";
import { Reranker } from "../retrieval/reranker.js";

export interface RAGContext {
  chunks: Array<{
    content: string;
    source: string;
    similarity: number;
  }>;
}

export interface RAGResponse {
  answer: string;
  sources: string[];
  contextUsed: number;
}

export class RAGGenerator {
  private hybridRetriever: HybridRetriever;
  private reranker: Reranker;
  private client: LLMClient | null = null;

  constructor() {
    this.hybridRetriever = new HybridRetriever();
    this.reranker = new Reranker();
  }

  private async getClient(): Promise<LLMClient> {
    if (!this.client) {
      this.client = await createLLMClient();
    }
    return this.client;
  }

  async generateAnswer(
    query: string,
    conversationHistory: ChatMessage[] = [],
    topK = 5,
  ): Promise<RAGResponse> {
    const searchResult = await this.hybridRetriever.retrieve(query);

    const reranked = await this.reranker.rerank(query, searchResult.chunks, topK);

    const context: RAGContext = {
      chunks: reranked.map((r) => ({
        content: r.chunk.content,
        source: r.chunk.documentId,
        similarity: r.relevanceScore,
      })),
    };

    const answer = await this.generateWithContext(query, context, conversationHistory);

    return {
      answer,
      sources: [...new Set(reranked.map((r) => r.chunk.documentId))],
      contextUsed: reranked.length,
    };
  }

  async generateAnswerStream(
    query: string,
    conversationHistory: ChatMessage[] = [],
    topK = 5,
  ): Promise<{
    stream: AsyncIterable<string>;
    sources: string[];
    contextUsed: number;
  }> {
    const searchResult = await this.hybridRetriever.retrieve(query);
    const reranked = await this.reranker.rerank(query, searchResult.chunks, topK);

    const context: RAGContext = {
      chunks: reranked.map((r) => ({
        content: r.chunk.content,
        source: r.chunk.documentId,
        similarity: r.relevanceScore,
      })),
    };

    const client = await this.getClient();

    const contextText = context.chunks
      .map((c, i) => `[Source ${i + 1}] ${c.content}`)
      .join("\n\n");

    const systemPrompt = `You are a knowledgeable assistant with access to a personal document library.
Answer questions based on the provided context. If the context doesn't contain enough information,
say so honestly. Always cite sources using [Source N] notation.`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      {
        role: "user",
        content: `Context from documents:\n${contextText}\n\nQuestion: ${query}\n\nAnswer based on the context above:`,
      },
    ];

    return {
      stream: client.chatStream(messages, { temperature: 0.3 }),
      sources: [...new Set(reranked.map((r) => r.chunk.documentId))],
      contextUsed: reranked.length,
    };
  }

  private async generateWithContext(
    query: string,
    context: RAGContext,
    history: ChatMessage[],
  ): Promise<string> {
    const client = await this.getClient();

    const contextText = context.chunks
      .map((c, i) => `[Source ${i + 1}] ${c.content}`)
      .join("\n\n");

    const systemPrompt = `You are a knowledgeable assistant with access to a personal document library.
Answer questions based on the provided context. If the context doesn't contain enough information,
say so honestly. Always cite sources using [Source N] notation.`;

    const response = await client.chat(
      [
        { role: "system", content: systemPrompt },
        ...history,
        {
          role: "user",
          content: `Context from documents:\n${contextText}\n\nQuestion: ${query}\n\nAnswer based on the context above:`,
        },
      ],
      { temperature: 0.3 },
    );

    return response.content;
  }
}
