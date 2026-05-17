import { createLLMClient, type LLMClient } from "@myrag/core";
import type { ParsedFile, ParsedSymbol } from "../parser/parser.js";

export interface BusinessTechnicalSeparation {
  businessLogic: BusinessItem[];
  technicalImpl: TechnicalItem[];
  summary: string;
}

export interface BusinessItem {
  name: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  description: string;
  code: string;
}

export interface TechnicalItem {
  name: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  category: string;
  description: string;
}

export interface ArchitectureReport {
  modules: ModuleInfo[];
  dependencies: DependencyEdge[];
  dataFlow: string;
  entryPoints: string[];
}

interface ModuleInfo {
  name: string;
  path: string;
  language: string;
  exports: string[];
  imports: string[];
  responsibility: string;
}

interface DependencyEdge {
  from: string;
  to: string;
  type: "import" | "call";
}

export class CodeAnalyzer {
  private client: LLMClient | null = null;

  private async getClient(): Promise<LLMClient> {
    if (!this.client) {
      this.client = await createLLMClient();
    }
    return this.client;
  }

  async analyze(files: ParsedFile[], projectPath: string): Promise<BusinessTechnicalSeparation> {
    const allSymbols = files.flatMap((f) =>
      f.symbols.filter((s) =>
        s.type === "function" || s.type === "method" || s.type === "class" || s.type === "interface"
      )
    );

    const { business, technical } = await this.classifySymbols(allSymbols);

    return {
      businessLogic: business,
      technicalImpl: technical,
      summary: await this.generateSummary(business, files),
    };
  }

  async buildArchitectureReport(files: ParsedFile[]): Promise<ArchitectureReport> {
    const modules = files.map((f) => ({
      name: f.path,
      path: f.path,
      language: f.language,
      exports: f.exports,
      imports: f.imports,
      responsibility: "",
    }));

    const dependencies: DependencyEdge[] = [];
    for (const file of files) {
      for (const imp of file.imports) {
        const target = modules.find(
          (m) => m.path.includes(imp) || m.name.includes(imp)
        );
        if (target && target.path !== file.path) {
          dependencies.push({
            from: file.path,
            to: target.path,
            type: "import",
          });
        }
      }
    }

    const entryPoints = files
      .filter((f) => f.exports.length > 0 && f.imports.length === 0)
      .map((f) => f.path);

    const dataFlow = await this.generateDataFlow(modules, dependencies);

    return { modules, dependencies, dataFlow, entryPoints };
  }

  private async classifySymbols(
    symbols: ParsedSymbol[],
  ): Promise<{ business: BusinessItem[]; technical: TechnicalItem[] }> {
    const client = await this.getClient();
    const business: BusinessItem[] = [];
    const technical: TechnicalItem[] = [];

    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const result = await this.classifyBatch(client, batch);
      business.push(...result.business);
      technical.push(...result.technical);
    }

    return { business, technical };
  }

  private async classifyBatch(
    client: LLMClient,
    symbols: ParsedSymbol[],
  ): Promise<{ business: BusinessItem[]; technical: TechnicalItem[] }> {
    const symbolsText = symbols
      .map(
        (s, i) =>
          `[${i}] Name: ${s.name}\nType: ${s.type}\nFile: ${s.file}\nCode:\n\`\`\`\n${s.code.slice(0, 800)}\n\`\`\``,
      )
      .join("\n\n");

    const prompt = `Classify each code symbol as "business" or "technical".

Business: Code that directly encodes business rules, domain logic, or specific user requirements.
Technical: Infrastructure code (HTTP, DB, caching, auth, logging, serialization, config, utility).

Return JSON: [{ "index": number, "category": "business"|"technical", "description": "what this does in plain language" }]
Return ONLY JSON array, no other text.

Symbols:
${symbolsText}`;

    const response = await client.chat(
      [{ role: "user", content: prompt }],
      { temperature: 0.1, maxTokens: 4000 },
    );

    const classifications = this.parseClassification(response.content);

    const business: BusinessItem[] = [];
    const technical: TechnicalItem[] = [];

    for (const c of classifications) {
      const symbol = symbols[c.index];
      if (!symbol) continue;

      if (c.category === "business") {
        business.push({
          name: symbol.name,
          file: symbol.file,
          lineStart: symbol.lineStart,
          lineEnd: symbol.lineEnd,
          description: c.description,
          code: symbol.code,
        });
      } else {
        technical.push({
          name: symbol.name,
          file: symbol.file,
          lineStart: symbol.lineStart,
          lineEnd: symbol.lineEnd,
          category: this.inferTechnicalCategory(symbol),
          description: c.description,
        });
      }
    }

    return { business, technical };
  }

  private async generateSummary(business: BusinessItem[], files: ParsedFile[]): Promise<string> {
    if (business.length === 0) return "No business logic detected.";

    const client = await this.getClient();
    const businessText = business
      .slice(0, 20)
      .map((b) => `- ${b.name}: ${b.description}`)
      .join("\n");

    const response = await client.chat(
      [
        {
          role: "user",
          content: `Write a 3-5 sentence summary of what this project does from a business/domain perspective. Focus on WHAT the software accomplishes, not HOW.

Key business components:
${businessText}`,
        },
      ],
      { temperature: 0.3, maxTokens: 500 },
    );

    return response.content;
  }

  private async generateDataFlow(
    modules: ModuleInfo[],
    dependencies: DependencyEdge[],
  ): Promise<string> {
    const client = await this.getClient();

    const moduleSummary = modules
      .map((m) => `Module: ${m.path} (${m.language})`)
      .join("\n");

    const depSummary = dependencies
      .slice(0, 30)
      .map((d) => `${d.from} -> ${d.to}`)
      .join("\n");

    const response = await client.chat(
      [
        {
          role: "user",
          content: `Describe the data flow and architecture of this project in 3-5 sentences. How do the modules connect?

Modules:
${moduleSummary}

Dependencies:
${depSummary}`,
        },
      ],
      { temperature: 0.3, maxTokens: 500 },
    );

    return response.content;
  }

  private parseClassification(content: string): Array<{
    index: number;
    category: "business" | "technical";
    description: string;
  }> {
    try {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {
    }
    return [];
  }

  private inferTechnicalCategory(symbol: ParsedSymbol): string {
    const code = symbol.code.toLowerCase();
    if (/select|insert|update|delete|query|findOne|save/.test(code)) return "data-access";
    if (/req\.|res\.|response|request|router|handler/.test(code)) return "http-handler";
    if (/json\.stringify|json\.parse|serialize|deserialize/.test(code)) return "serialization";
    if (/redis|cache|memorize/.test(code)) return "cache";
    if (/console\.|log\.|logger|warn|error/.test(code)) return "logging";
    if (/token|auth|login|password|jwt/.test(code)) return "auth";
    if (/config|env|process\.env/.test(code)) return "config";
    if (/util|helper|format|validate/.test(code)) return "utility";
    return "other";
  }
}
