import Parser from "tree-sitter";
import fs from "node:fs/promises";
import path from "node:path";

export interface ParsedSymbol {
  name: string;
  type: "function" | "class" | "method" | "variable" | "interface" | "type" | "import" | "export";
  file: string;
  lineStart: number;
  lineEnd: number;
  code: string;
  parent?: string;
}

export interface ParsedFile {
  path: string;
  language: string;
  symbols: ParsedSymbol[];
  imports: string[];
  exports: string[];
  dependencies: string[];
}

interface LanguageConfig {
  extensions: string[];
  getParser: () => Parser | null;
}

const LANGUAGE_MAP: Record<string, { extensions: string[]; moduleName: string }> = {
  javascript: { extensions: [".js", ".mjs", ".cjs"], moduleName: "tree-sitter-javascript" },
  typescript: { extensions: [".ts"], moduleName: "tree-sitter-typescript" },
  tsx: { extensions: [".tsx"], moduleName: "tree-sitter-tsx" },
  python: { extensions: [".py", ".pyw"], moduleName: "tree-sitter-python" },
  java: { extensions: [".java"], moduleName: "tree-sitter-java" },
  go: { extensions: [".go"], moduleName: "tree-sitter-go" },
  rust: { extensions: [".rs"], moduleName: "tree-sitter-rust" },
  c: { extensions: [".c", ".h"], moduleName: "tree-sitter-c" },
  cpp: { extensions: [".cpp", ".cc", ".cxx", ".hpp"], moduleName: "tree-sitter-cpp" },
  ruby: { extensions: [".rb"], moduleName: "tree-sitter-ruby" },
  php: { extensions: [".php"], moduleName: "tree-sitter-php" },
  swift: { extensions: [".swift"], moduleName: "tree-sitter-swift" },
  kotlin: { extensions: [".kt", ".kts"], moduleName: "tree-sitter-kotlin" },
  scala: { extensions: [".scala"], moduleName: "tree-sitter-scala" },
  csharp: { extensions: [".cs"], moduleName: "tree-sitter-c-sharp" },
  bash: { extensions: [".sh", ".bash"], moduleName: "tree-sitter-bash" },
  yaml: { extensions: [".yml", ".yaml"], moduleName: "tree-sitter-yaml" },
  json: { extensions: [".json"], moduleName: "tree-sitter-json" },
  markdown: { extensions: [".md"], moduleName: "tree-sitter-markdown" },
  css: { extensions: [".css", ".scss", ".less"], moduleName: "tree-sitter-css" },
  html: { extensions: [".html", ".htm"], moduleName: "tree-sitter-html" },
  sql: { extensions: [".sql"], moduleName: "tree-sitter-sql" },
};

const EXTENSION_MAP: Record<string, string> = {};
for (const [lang, config] of Object.entries(LANGUAGE_MAP)) {
  for (const ext of config.extensions) {
    EXTENSION_MAP[ext] = lang;
  }
}

export class TreeSitterParser {
  private parsers: Map<string, Parser> = new Map();

  async parseProject(projectPath: string): Promise<{ files: ParsedFile[]; language: string }> {
    const codeFiles = await this.findCodeFiles(projectPath);
    const files: ParsedFile[] = [];

    const languageCounts: Record<string, number> = {};

    for (const filePath of codeFiles) {
      try {
        const parsed = await this.parseFile(filePath);
        if (parsed) {
          files.push(parsed);
          languageCounts[parsed.language] = (languageCounts[parsed.language] ?? 0) + 1;
        }
      } catch {
      }
    }

    const primaryLanguage = Object.entries(languageCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? "unknown";

    return { files, language: primaryLanguage };
  }

  async parseFile(filePath: string): Promise<ParsedFile | null> {
    const ext = path.extname(filePath);
    const language = EXTENSION_MAP[ext];
    if (!language) return null;

    const parser = await this.getParser(language);
    if (!parser) return null;

    const source = await fs.readFile(filePath, "utf-8");
    const tree = parser.parse(source);

    const symbols = this.extractSymbols(tree.rootNode, source, filePath, language);
    const imports = symbols.filter((s) => s.type === "import").map((s) => s.name);
    const exports = symbols.filter((s) => s.type === "export").map((s) => s.name);
    const dependencies = symbols
      .filter((s) => s.type === "import")
      .map((s) => s.name);

    return {
      path: filePath,
      language,
      symbols,
      imports,
      exports,
      dependencies,
    };
  }

  private extractSymbols(node: Parser.SyntaxNode, source: string, file: string, language: string): ParsedSymbol[] {
    const symbols: ParsedSymbol[] = [];

    if (node.type === "function_declaration" || node.type === "function_definition" ||
        node.type === "method_definition" || node.type === "arrow_function") {
      const nameNode = node.childForFieldName?.("name") ?? node.namedChildren[0];
      if (nameNode) {
        symbols.push({
          name: nameNode.text,
          type: "function",
          file,
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          code: source.slice(node.startIndex, node.endIndex),
        });
      }
    }

    if (node.type === "class_declaration" || node.type === "class_definition") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        symbols.push({
          name: nameNode.text,
          type: "class",
          file,
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          code: source.slice(node.startIndex, node.endIndex),
        });
      }
    }

    if (node.type === "interface_declaration" || node.type === "type_alias_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        symbols.push({
          name: nameNode.text,
          type: "interface",
          file,
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          code: source.slice(node.startIndex, node.endIndex),
        });
      }
    }

    if (node.type === "import_statement" || node.type === "import_declaration" ||
        node.type === "import_from_statement") {
      const sourceNode = node.childForFieldName?.("source") ??
        node.descendantsOfType("string").find((n) => n.text.startsWith('"') || n.text.startsWith("'"));
      if (sourceNode) {
        symbols.push({
          name: sourceNode.text.replace(/['"]/g, ""),
          type: "import",
          file,
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          code: source.slice(node.startIndex, node.endIndex),
        });
      }
    }

    if (node.type === "export_statement" || node.type === "export_default_declaration") {
      const nameChild = node.namedChildren[0];
      if (nameChild) {
        symbols.push({
          name: nameChild.text,
          type: "export",
          file,
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          code: source.slice(node.startIndex, node.endIndex),
        });
      }
    }

    for (const child of node.namedChildren) {
      symbols.push(...this.extractSymbols(child, source, file, language));
    }

    return symbols;
  }

  private async getParser(language: string): Promise<Parser | null> {
    const cached = this.parsers.get(language);
    if (cached) return cached;

    const config = LANGUAGE_MAP[language];
    if (!config) return null;

    try {
      const langModule = await import(config.moduleName);
      const parser = new Parser();
      parser.setLanguage(langModule.default ?? langModule);
      this.parsers.set(language, parser);
      return parser;
    } catch {
      return null;
    }
  }

  private async findCodeFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    await this.walkDir(projectPath, projectPath, files);
    return files.filter((f) => {
      const ext = path.extname(f);
      return EXTENSION_MAP[ext] !== undefined;
    });
  }

  private async walkDir(basePath: string, currentPath: string, results: string[]): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") continue;
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await this.walkDir(basePath, fullPath, results);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
}
