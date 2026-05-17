import { createLLMClient, type LLMClient } from "@myrag/core";
import type { ParsedFile, ParsedSymbol } from "../parser/parser.js";

export interface ReviewResult {
  score: number;
  issues: ReviewIssue[];
  suggestions: string[];
}

export interface ReviewIssue {
  severity: "error" | "warning" | "info";
  file: string;
  line: number;
  message: string;
  category: "security" | "performance" | "readability" | "bug" | "best-practice";
}

export class CodeReviewer {
  private client: LLMClient | null = null;

  private async getClient(): Promise<LLMClient> {
    if (!this.client) {
      this.client = await createLLMClient();
    }
    return this.client;
  }

  async review(files: ParsedFile[]): Promise<ReviewResult> {
    const client = await this.getClient();
    const allIssues: ReviewIssue[] = [];
    const allSuggestions: string[] = [];

    for (const file of files) {
      const functions = file.symbols.filter(
        (s) => s.type === "function" || s.type === "method"
      );

      if (functions.length === 0) continue;

      const codeBlock = functions
        .slice(0, 5)
        .map((f) => f.code.slice(0, 1000))
        .join("\n\n---\n\n");

      const prompt = `Review this code for issues. Focus on:
- Security: injection risks, exposed secrets, missing auth checks
- Performance: N+1 queries, unnecessary allocations, blocking operations
- Readability: confusing variable names, missing error handling
- Bugs: potential null references, race conditions, incorrect logic
- Best practices: missing types, hardcoded values, missing tests

File: ${file.path}
Language: ${file.language}

Code:
\`\`\`
${codeBlock}
\`\`\`

Return JSON:
{
  "issues": [{ "severity": "error"|"warning"|"info", "line": number, "message": "string", "category": "security"|"performance"|"readability"|"bug"|"best-practice" }],
  "suggestions": ["string"]
}
Return ONLY JSON, no other text.`;

      try {
        const response = await client.chat(
          [{ role: "user", content: prompt }],
          { temperature: 0.2, maxTokens: 2000 },
        );

        const review = this.parseReviewResponse(response.content);
        allIssues.push(
          ...review.issues.map((issue): ReviewIssue => ({
            file: file.path,
            line: issue.line || 1,
            severity: (["error", "warning", "info"].includes(issue.severity) ? issue.severity : "info") as ReviewIssue["severity"],
            message: issue.message,
            category: (["security", "performance", "readability", "bug", "best-practice"].includes(issue.category) ? issue.category : "best-practice") as ReviewIssue["category"],
          }))
        );
        allSuggestions.push(...review.suggestions);
      } catch {
      }
    }

    const errorCount = allIssues.filter((i) => i.severity === "error").length;
    const warningCount = allIssues.filter((i) => i.severity === "warning").length;
    const infoCount = allIssues.filter((i) => i.severity === "info").length;

    const score = Math.max(
      0,
      100 - errorCount * 15 - warningCount * 5 - infoCount * 1
    );

    return {
      score,
      issues: allIssues,
      suggestions: [...new Set(allSuggestions)].slice(0, 10),
    };
  }

  private parseReviewResponse(content: string): {
    issues: Array<{
      severity: string;
      line: number;
      message: string;
      category: string;
    }>;
    suggestions: string[];
  } {
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {
    }
    return { issues: [], suggestions: [] };
  }
}
