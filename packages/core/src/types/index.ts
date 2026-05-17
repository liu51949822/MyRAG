// ─── Core type definitions shared across all packages ───

/** Intent classification for routing queries */
export type IntentType = "document" | "code" | "mixed" | "general";

/** A chat message */
export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

/** A document stored in the knowledge base */
export interface Document {
  id: string;
  filename: string;
  path: string;
  mimeType: string;
  pageCount: number;
  sizeBytes: number;
  ingestedAt: Date;
}

/** A text chunk from a document */
export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  /** Overlap tokens for context continuity */
  overlap: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  pageNumber?: number;
  sectionTitle?: string;
  charCount: number;
  tokenCount: number;
}

/** A code analysis result */
export interface CodeAnalysis {
  id: string;
  projectPath: string;
  language: string;
  summary: string;
  businessLogic: BusinessLogicItem[];
  technicalImpl: TechnicalImplItem[];
  architecture: ArchitectureReport;
  beginnerDoc: string;
  reviewResult: ReviewResult | null;
  analyzedAt: Date;
}

export interface BusinessLogicItem {
  name: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  description: string;
  /** The raw code snippet */
  code: string;
}

export interface TechnicalImplItem {
  name: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  category: TechnicalCategory;
  description: string;
}

export type TechnicalCategory =
  | "data-access"
  | "http-handler"
  | "serialization"
  | "cache"
  | "logging"
  | "auth"
  | "config"
  | "utility"
  | "other";

export interface ArchitectureReport {
  modules: ModuleInfo[];
  dependencies: DependencyEdge[];
  dataFlow: string;
  entryPoints: string[];
}

export interface ModuleInfo {
  name: string;
  path: string;
  language: string;
  exports: string[];
  imports: string[];
  responsibility: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: "import" | "call" | "extends" | "implements";
}

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

/** Routing result from intent classifier */
export interface RoutingResult {
  intent: IntentType;
  confidence: number;
  reasoning: string;
  /** If document query, the search keywords */
  searchKeywords?: string[];
  /** If code query, the target project path */
  targetProject?: string;
}
