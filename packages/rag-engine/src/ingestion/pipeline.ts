import fs from "node:fs/promises";
import path from "node:path";
import { PDFParser } from "./pdf-parser.js";
import { TextChunker } from "./chunker.js";
import { EmbeddingService } from "../embedding/embedder.js";
import {
  insertDocument,
  insertChunk,
  setChunkEmbedding,
  getDocument,
} from "@myrag/core";
import type { ParsedDocument } from "./pdf-parser.js";
import type { TextChunk } from "./chunker.js";

export interface IngestionResult {
  documentId: string;
  filename: string;
  chunkCount: number;
  totalChars: number;
}

export class IngestionPipeline {
  private pdfParser: PDFParser;
  private chunker: TextChunker;
  private embedder: EmbeddingService;

  constructor(options?: { chunkSize?: number; overlapSize?: number; embeddingModel?: string }) {
    this.pdfParser = new PDFParser();
    this.chunker = new TextChunker({
      maxChunkSize: options?.chunkSize,
      overlapSize: options?.overlapSize,
    });
    this.embedder = new EmbeddingService(options?.embeddingModel);
  }

  async ingestFile(filePath: string): Promise<IngestionResult> {
    const filename = path.basename(filePath);
    const stat = await fs.stat(filePath);

    const parsed = await this.pdfParser.parse(filePath);

    const chunks = this.chunkPdf(parsed);

    const doc = await insertDocument({
      filename,
      path: filePath,
      mimeType: "application/pdf",
      pageCount: parsed.pageCount,
      sizeBytes: stat.size,
    });

    for (const chunk of chunks) {
      const inserted = await insertChunk({
        documentId: doc.id,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        metadata: chunk.metadata,
      });

      const embedding = await this.embedder.embedText(chunk.content);
      await setChunkEmbedding(inserted.id, embedding.embedding);
    }

    return {
      documentId: doc.id,
      filename,
      chunkCount: chunks.length,
      totalChars: parsed.fullText.length,
    };
  }

  async ingestDirectory(dirPath: string): Promise<IngestionResult[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results: IngestionResult[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const result = await this.ingestFile(fullPath);
          results.push(result);
        } catch (err) {
          console.error(`Failed to ingest ${entry.name}:`, err);
        }
      }
    }

    return results;
  }

  private chunkPdf(parsed: ParsedDocument): TextChunk[] {
    const allChunks: TextChunk[] = [];

    for (const page of parsed.pages) {
      const pageChunks = this.chunker.chunk(page.content, {
        pageNumber: page.pageNumber,
      });
      allChunks.push(...pageChunks);
    }

    return allChunks.map((c, i) => ({
      ...c,
      chunkIndex: i,
    }));
  }
}
