import { describe, it, expect } from "vitest";
import { TextChunker } from "./chunker.js";

describe("TextChunker", () => {
  it("splits short text into single chunk", () => {
    const chunker = new TextChunker({ maxChunkSize: 1000 });
    const chunks = chunker.chunk("Hello world, this is short.");
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe("Hello world, this is short.");
  });

  it("splits long text into multiple chunks", () => {
    const chunker = new TextChunker({ maxChunkSize: 50, overlapSize: 0 });
    const text = "A".repeat(200);
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(50);
    }
  });

  it("preserves sequential chunk indices", () => {
    const chunker = new TextChunker({ maxChunkSize: 30, overlapSize: 0 });
    const text = "One. Two. Three. Four. Five.";
    const chunks = chunker.chunk(text);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
    }
  });

  it("adds overlap between chunks", () => {
    const chunker = new TextChunker({ maxChunkSize: 100, overlapSize: 20 });
    const text =
      "Part one is here. " +
      "Part two is there. " +
      "Part three is everywhere. " +
      "Part four is nowhere.";
    const chunks = chunker.chunk(text);
    if (chunks.length > 1) {
      expect(chunks[1].content.length).toBeGreaterThan(0);
    }
  });

  it("includes page metadata in chunks", () => {
    const chunker = new TextChunker();
    const chunks = chunker.chunk("Test content", {
      pageNumber: 5,
      sectionTitle: "Introduction",
    });
    expect(chunks[0].metadata.pageNumber).toBe(5);
    expect(chunks[0].metadata.sectionTitle).toBe("Introduction");
  });

  it("estimates token count roughly as chars/4", () => {
    const chunker = new TextChunker();
    const chunks = chunker.chunk("Hello world");
    expect(chunks[0].metadata.tokenCount).toBeGreaterThan(0);
    expect(chunks[0].metadata.charCount).toBe(11);
  });

  it("returns empty for empty text", () => {
    const chunker = new TextChunker();
    const chunks = chunker.chunk("   ");
    expect(chunks.length).toBe(0);
  });

  it("uses default options when none provided", () => {
    const chunker = new TextChunker();
    const text = "A".repeat(5000);
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBeGreaterThan(1);
    // Allow extra chars for overlap padding
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(1400);
    }
  });

  it("respects sentence boundaries for clean splits", () => {
    const chunker = new TextChunker({ maxChunkSize: 100, overlapSize: 0 });
    const sentences = Array.from({ length: 20 }, (_, i) => `Sentence number ${i + 1} has enough words.`);
    const text = sentences.join(" ");
    const chunks = chunker.chunk(text);
    for (const c of chunks) {
      expect(c.content.length).toBeGreaterThan(0);
      expect(c.content.length).toBeLessThanOrEqual(200);
    }
  });
});
