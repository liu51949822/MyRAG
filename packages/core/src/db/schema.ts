import { pgTable, uuid, varchar, integer, jsonb, timestamp, text, real, customType, index } from "drizzle-orm/pg-core";

/**
 * Custom pgvector column type for drizzle-orm.
 * Stores OpenAI/Claude embeddings as float32 arrays.
 * Handled as number[] in TypeScript, stored as vector(N) in PostgreSQL.
 */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value as number[];
  },
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  filename: varchar("filename", { length: 500 }).notNull(),
  path: varchar("path", { length: 1000 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  pageCount: integer("page_count").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  ingestedAt: timestamp("ingested_at").defaultNow().notNull(),
}, (table) => ({
  filenameIdx: index("idx_documents_filename").on(table.filename),
}));

export const chunks = pgTable("chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  embedding: vector("embedding"),
  metadata: jsonb("metadata").notNull(),
}, (table) => ({
  docIdx: index("idx_chunks_document_id").on(table.documentId),
  embeddingIdx: index("idx_chunks_embedding")
    .using("hnsw", table.embedding.op("vector_cosine_ops"))
    .with({ m: 16, ef_construction: 64 }),
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 500 }).default("New Session").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().$type<"user" | "assistant" | "system">(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("idx_messages_session_id").on(table.sessionId),
}));

export const codeAnalyses = pgTable("code_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectPath: varchar("project_path", { length: 1000 }).notNull(),
  language: varchar("language", { length: 50 }).notNull(),
  summary: text("summary").notNull(),
  businessLogic: jsonb("business_logic").notNull(),
  technicalImpl: jsonb("technical_impl").notNull(),
  architecture: jsonb("architecture").notNull(),
  beginnerDoc: text("beginner_doc").notNull(),
  reviewResult: jsonb("review_result"),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("idx_code_analyses_project").on(table.projectPath),
}));
