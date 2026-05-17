import { createLLMClient, type LLMClient } from "@myrag/core";
import type { BusinessTechnicalSeparation } from "../analysis/analyzer.js";
import type { ArchitectureReport } from "../analysis/analyzer.js";

export interface BeginnerDoc {
  overview: string;
  businessConcepts: string[];
  howToUse: string;
  techStack: string;
  glossary: Array<{ term: string; explanation: string }>;
  faq: Array<{ question: string; answer: string }>;
}

export class DocGenerator {
  private client: LLMClient | null = null;

  private async getClient(): Promise<LLMClient> {
    if (!this.client) {
      this.client = await createLLMClient();
    }
    return this.client;
  }

  async generateCodeToDoc(
    analysis: BusinessTechnicalSeparation,
    architecture: { modules: Array<{ name: string; language: string }> },
  ): Promise<BeginnerDoc> {
    const client = await this.getClient();

    const businessSummary = analysis.businessLogic
      .slice(0, 10)
      .map((b) => `- ${b.name}: ${b.description}`)
      .join("\n");

    const techStack = [...new Set(architecture.modules.map((m) => m.language))].join(", ");
    const moduleList = architecture.modules.map((m) => m.name).join(", ");

    const prompt = `You are writing documentation for a software project that should be understandable by someone with NO programming knowledge.

Project summary: ${analysis.summary}

Business components:
${businessSummary}

Technical modules: ${moduleList}
Languages used: ${techStack}

Write beginner-friendly documentation in JSON format:
{
  "overview": "2-3 sentences explaining in the simplest possible terms what this software does, like you're explaining to a 12-year-old",
  "businessConcepts": ["3-5 key business concepts this software handles, in plain language"],
  "howToUse": "2-3 sentences on how someone would use this software, from an end-user perspective",
  "techStack": "very brief note on what technologies power this",
  "glossary": [{ "term": "technical term", "explanation": "simple explanation without jargon" }],
  "faq": [{ "question": "simple question about what this does", "answer": "simple answer" }]
}

Return ONLY JSON, no other text.`;

    const response = await client.chat(
      [{ role: "user", content: prompt }],
      { temperature: 0.3, maxTokens: 2000 },
    );

    return this.parseDocResponse(response.content);
  }

  async generateDocToBeginner(
    documentContent: string,
    documentTitle: string,
  ): Promise<BeginnerDoc> {
    const client = await this.getClient();

    const prompt = `Given the following document, create beginner-friendly documentation.
Explain the content in the simplest possible terms, avoiding all technical jargon.

Document title: ${documentTitle}

Document content (excerpt):
${documentContent.slice(0, 4000)}

Write beginner-friendly documentation in JSON format:
{
  "overview": "2-3 sentences explaining what this document is about, like you're explaining to a 12-year-old",
  "businessConcepts": ["3-5 key concepts from the document, in plain language"],
  "howToUse": "2-3 sentences on what someone should do with this information",
  "techStack": "any relevant tools or technologies mentioned",
  "glossary": [{ "term": "complex term from the document", "explanation": "simple explanation" }],
  "faq": [{ "question": "question a beginner might ask about this topic", "answer": "simple answer" }]
}

Return ONLY JSON, no other text.`;

    const response = await client.chat(
      [{ role: "user", content: prompt }],
      { temperature: 0.3, maxTokens: 2000 },
    );

    return this.parseDocResponse(response.content);
  }

  private parseDocResponse(content: string): BeginnerDoc {
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {
    }
    return {
      overview: "Documentation could not be generated.",
      businessConcepts: [],
      howToUse: "",
      techStack: "",
      glossary: [],
      faq: [],
    };
  }
}
