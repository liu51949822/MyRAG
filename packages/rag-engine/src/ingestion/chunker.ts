export interface TextChunk {
  content: string;
  chunkIndex: number;
  metadata: {
    pageNumber?: number;
    sectionTitle?: string;
    charCount: number;
    tokenCount: number;
  };
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  separators?: RegExp[];
}

const DEFAULT_SEPARATORS: RegExp[] = [
  /\n\n\n+/,
  /\n\n/,
  /\n/,
  /[.。!?！？]\s+/,
  /\s+/,
];

export class TextChunker {
  private maxChunkSize: number;
  private overlapSize: number;
  private separators: RegExp[];

  constructor(options: ChunkingOptions = {}) {
    this.maxChunkSize = options.maxChunkSize ?? 1200;
    this.overlapSize = options.overlapSize ?? 150;
    this.separators = options.separators ?? DEFAULT_SEPARATORS;
  }

  chunk(text: string, pageMetadata?: { pageNumber?: number; sectionTitle?: string }): TextChunk[] {
    const rawChunks = this.recursiveSplit(text);
    const chunks: TextChunk[] = [];

    for (let i = 0; i < rawChunks.length; i++) {
      const content = rawChunks[i];
      let finalContent = content;

      if (i > 0 && this.overlapSize > 0) {
        const prev = rawChunks[i - 1];
        const overlap = prev.length > this.overlapSize
          ? prev.slice(-this.overlapSize)
          : prev;
        finalContent = overlap + " " + content;
      }

      chunks.push({
        content: finalContent,
        chunkIndex: i,
        metadata: {
          ...pageMetadata,
          charCount: finalContent.length,
          tokenCount: this.estimateTokens(finalContent),
        },
      });
    }

    return chunks;
  }

  private recursiveSplit(text: string): string[] {
    if (text.length <= this.maxChunkSize) {
      return text.trim() ? [text.trim()] : [];
    }

    for (const separator of this.separators) {
      const parts = text.split(separator);
      if (parts.length > 1) {
        const merged = this.mergeSplit(parts);
        if (merged.length > 1) {
          const result: string[] = [];
          for (const m of merged) {
            result.push(...this.recursiveSplit(m));
          }
          return result;
        }
      }
    }

    return this.forceChunk(text);
  }

  private mergeSplit(splits: string[]): string[] {
    const result: string[] = [];
    let buffer = "";

    for (const split of splits) {
      const s = split.trim();
      if (!s) continue;

      if (buffer.length + s.length <= this.maxChunkSize) {
        buffer = buffer ? buffer + "\n" + s : s;
      } else {
        if (buffer) {
          result.push(buffer);
        }
        buffer = s;
      }
    }

    if (buffer) {
      result.push(buffer);
    }

    return result;
  }

  private forceChunk(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.maxChunkSize, text.length);
      let boundary = end;

      if (end < text.length) {
        for (let i = end; i > start + this.maxChunkSize / 2; i--) {
          if (/[.。!?！？\n]/.test(text[i])) {
            boundary = i + 1;
            break;
          }
        }
      }

      chunks.push(text.slice(start, boundary).trim());
      start = boundary;
    }

    return chunks;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
