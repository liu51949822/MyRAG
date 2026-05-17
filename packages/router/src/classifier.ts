import { createLLMClient, type LLMClient, type RoutingResult } from "@myrag/core";

const CLASSIFICATION_RULES: Array<{
  patterns: RegExp[];
  intent: RoutingResult["intent"];
}> = [
  {
    patterns: [
      /(code|function|class|method|variable|import|export|type|interface|bug|refactor|test|compile|runtime|error|exception|stack trace)/i,
      /(project|repo|repository|module|package|dependency|npm|pip|crate|gem)/i,
      /(review|analyze|inspect|check)\s+(my|this|the)\s+code/i,
      /(what does this (code|function|class) do)/i,
      /(write|generate|create|implement)\s+(a\s+)?(function|class|module|api|endpoint)/i,
      /(architecture|design pattern|dependency|tree-sitter|ast|parse)/i,
      /(beginner|simple|easy|explain.*like.*(five|kid|beginner|12))/i,
      /\.(ts|js|py|java|go|rs|cpp|c|rb|php|swift|kt)$/i,
    ],
    intent: "code",
  },
  {
    patterns: [
      /(document|pdf|paper|article|book|essay|report|note|draft)/i,
      /(read|reading|content|text|paragraph|chapter|section|page)/i,
      /(knowledge|know|learn|understand|explain|teach|summarize)/i,
      /(what is|who is|when|where|why|how does|definition of)/i,
      /(from my (documents|notes|papers|library))/i,
      /(ingest|upload|add|import)\s+(a\s+)?(pdf|document|file)/i,
    ],
    intent: "document",
  },
];

export class IntentRouter {
  private client: LLMClient | null = null;

  private async getClient(): Promise<LLMClient> {
    if (!this.client) {
      this.client = await createLLMClient();
    }
    return this.client;
  }

  async classify(query: string): Promise<RoutingResult> {
    const ruleResult = this.ruleBasedClassify(query);
    if (ruleResult) return ruleResult;

    return this.llmClassify(query);
  }

  private ruleBasedClassify(query: string): RoutingResult | null {
    let codeScore = 0;
    let docScore = 0;

    for (const rule of CLASSIFICATION_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(query)) {
          if (rule.intent === "code") codeScore++;
          else if (rule.intent === "document") docScore++;
        }
      }
    }

    if (codeScore > docScore + 2) {
      return {
        intent: "code",
        confidence: Math.min(0.9, codeScore / (codeScore + docScore + 1)),
        reasoning: `Matched ${codeScore} code-related patterns vs ${docScore} document patterns.`,
        targetProject: this.extractPath(query),
      };
    }

    if (docScore > codeScore + 2) {
      return {
        intent: "document",
        confidence: Math.min(0.9, docScore / (codeScore + docScore + 1)),
        reasoning: `Matched ${docScore} document-related patterns vs ${codeScore} code patterns.`,
        searchKeywords: this.extractKeywords(query),
      };
    }

    return null;
  }

  private async llmClassify(query: string): Promise<RoutingResult> {
    const client = await this.getClient();

    const prompt = `Classify this query as "document" or "code" or "general".

Document: Questions about PDFs, papers, notes, or knowledge stored in a personal library.
Code: Questions about code review, project analysis, architecture, programming, debugging.
General: Casual conversation, chitchat, or unclear questions.

Query: "${query}"

Return JSON: { "intent": "document"|"code"|"general", "confidence": 0-1, "reasoning": "short reason" }
Return ONLY JSON.`;

    const response = await client.chat(
      [{ role: "user", content: prompt }],
      { temperature: 0.1, maxTokens: 300 },
    );

    try {
      const match = response.content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          intent: parsed.intent || "general",
          confidence: parsed.confidence || 0.5,
          reasoning: parsed.reasoning || "LLM classification",
          searchKeywords: parsed.intent === "document" ? this.extractKeywords(query) : undefined,
          targetProject: parsed.intent === "code" ? this.extractPath(query) : undefined,
        };
      }
    } catch {
    }

    return {
      intent: "general",
      confidence: 0.3,
      reasoning: "Unable to classify, defaulting to general.",
    };
  }

  private extractPath(query: string): string | undefined {
    const match = query.match(/([~/][^\s]+)/);
    return match ? match[1] : undefined;
  }

  private extractKeywords(query: string): string[] {
    return query
      .replace(/[?.,!]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);
  }
}
