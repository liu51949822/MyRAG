import { describe, it, expect } from "vitest";

describe("Intent Classification Rules", () => {
  const codePatterns = [
    /(code|function|class|method|variable|import|export)/i,
    /(review|analyze|inspect)\s+(my|this|the)\s+code/i,
    /(architecture|design pattern|dependency|ast|parse)/i,
    /\.(ts|js|py|java|go|rs)$/i,
  ];

  const docPatterns = [
    /(document|pdf|paper|article|book|essay|report|note)/i,
    /(what is|who is|when|where|why|how does)/i,
    /(knowledge|know|learn|understand|explain|summarize)/i,
    /(ingest|upload|add)\s+(a\s+)?(pdf|document|file)/i,
  ];

  function matchPatterns(text: string, patterns: RegExp[]): number {
    return patterns.filter((p) => p.test(text)).length;
  }

  it("classifies code review queries as code", () => {
    const queries = [
      "review my code for bugs",
      "analyze this function for performance issues",
      "what does this class do?",
      "check my project at ~/workspace/app.ts",
    ];

    for (const q of queries) {
      const codeScore = matchPatterns(q, codePatterns);
      const docScore = matchPatterns(q, docPatterns);
      expect(codeScore).toBeGreaterThanOrEqual(docScore);
    }
  });

  it("classifies document queries as document", () => {
    const queries = [
      "what does this paper say about neural networks?",
      "summarize the key findings from my PDF",
      "ingest this document into my knowledge base",
      "explain the concept in my notes",
    ];

    for (const q of queries) {
      const docScore = matchPatterns(q, docPatterns);
      expect(docScore).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns zero matches for unrelated queries", () => {
    expect(matchPatterns("hello how are you", codePatterns)).toBe(0);
    expect(matchPatterns("hello how are you", docPatterns)).toBe(0);
  });
});
