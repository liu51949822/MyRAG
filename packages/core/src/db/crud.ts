import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "./connection.js";
import { documents, chunks, sessions, messages, codeAnalyses } from "./schema.js";

export async function insertDocument(doc: {
  filename: string;
  path: string;
  mimeType: string;
  pageCount: number;
  sizeBytes: number;
}): Promise<typeof documents.$inferSelect> {
  const db = await getDb();
  const [row] = await db.insert(documents).values(doc).returning();
  return row;
}

export async function listDocuments(): Promise<Array<typeof documents.$inferSelect>> {
  const db = await getDb();
  return db.select().from(documents).orderBy(desc(documents.ingestedAt));
}

export async function getDocument(id: string): Promise<typeof documents.$inferSelect | null> {
  const db = await getDb();
  const [row] = await db.select().from(documents).where(eq(documents.id, id));
  return row ?? null;
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(documents).where(eq(documents.id, id));
}

export async function insertChunk(chunk: {
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: { pageNumber?: number; sectionTitle?: string; charCount: number; tokenCount: number };
}): Promise<typeof chunks.$inferSelect> {
  const db = await getDb();
  const [row] = await db.insert(chunks).values(chunk).returning();
  return row;
}

export async function setChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  const db = await getDb();
  await db.execute(sql`
    UPDATE chunks SET embedding = ${JSON.stringify(embedding)}::vector
    WHERE id = ${chunkId}
  `);
}

export async function getChunksByDocument(documentId: string): Promise<Array<typeof chunks.$inferSelect>> {
  const db = await getDb();
  return db.select().from(chunks)
    .where(eq(chunks.documentId, documentId))
    .orderBy(chunks.chunkIndex);
}

interface VectorSearchRow {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
  similarity: number;
  [key: string]: unknown;
}

export async function searchChunksByVector(
  embedding: number[],
  limit = 10,
  threshold = 0.5,
): Promise<VectorSearchRow[]> {
  const db = await getDb();
  const result = await db.execute<VectorSearchRow>(sql`
    SELECT
      c.id, c.document_id, c.content, c.chunk_index, c.metadata,
      1 - (c.embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
    FROM chunks c
    WHERE c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> ${JSON.stringify(embedding)}::vector) > ${threshold}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `);

  return result.rows;
}

export async function createSession(title = "New Session"): Promise<typeof sessions.$inferSelect> {
  const db = await getDb();
  const [row] = await db.insert(sessions).values({ title }).returning();
  return row;
}

export async function listSessions(): Promise<Array<typeof sessions.$inferSelect>> {
  const db = await getDb();
  return db.select().from(sessions).orderBy(desc(sessions.updatedAt));
}

export async function updateSession(id: string, title: string): Promise<void> {
  const db = await getDb();
  await db.update(sessions).set({ title, updatedAt: new Date() }).where(eq(sessions.id, id));
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function insertMessage(msg: {
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
}): Promise<typeof messages.$inferSelect> {
  const db = await getDb();
  const [row] = await db.insert(messages).values(msg).returning();
  return row;
}

export async function getMessagesBySession(sessionId: string, limit = 50): Promise<Array<typeof messages.$inferSelect>> {
  const db = await getDb();
  return db.select().from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt)
    .limit(limit);
}

export async function insertCodeAnalysis(analysis: {
  projectPath: string;
  language: string;
  summary: string;
  businessLogic: unknown;
  technicalImpl: unknown;
  architecture: unknown;
  beginnerDoc: string;
  reviewResult?: unknown;
}): Promise<typeof codeAnalyses.$inferSelect> {
  const db = await getDb();
  const [row] = await db.insert(codeAnalyses).values(analysis).returning();
  return row;
}

export async function getCodeAnalysisByProject(
  projectPath: string,
): Promise<typeof codeAnalyses.$inferSelect | null> {
  const db = await getDb();
  const [row] = await db.select().from(codeAnalyses)
    .where(eq(codeAnalyses.projectPath, projectPath))
    .orderBy(desc(codeAnalyses.analyzedAt))
    .limit(1);
  return row ?? null;
}
