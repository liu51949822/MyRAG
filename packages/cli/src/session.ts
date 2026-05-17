import { handleQuery, handleIngest, handleBodyQuery } from "./chat.js";
import { createSession, getMessagesBySession, listSessions } from "@myrag/core";
import type { ChatMessage } from "@myrag/core";

export class SessionManager {
  private sessionId: string;
  private history: ChatMessage[] = [];

  constructor(sessionId?: string) {
    this.sessionId = sessionId ?? "";
  }

  async init(title?: string): Promise<string> {
    if (this.sessionId) {
      const messages = await getMessagesBySession(this.sessionId);
      this.history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      return this.sessionId;
    }

    const session = await createSession(title);
    this.sessionId = session.id;
    return this.sessionId;
  }

  async ask(query: string, onToken?: (token: string) => void): Promise<string> {
    return handleQuery(
      query,
      { sessionId: this.sessionId, history: this.history },
      onToken,
    );
  }

  async ingest(target: string): Promise<string> {
    return handleIngest(target);
  }

  async analyzeBody(target: string): Promise<string> {
    return handleBodyQuery(target);
  }

  getHistory(): ChatMessage[] {
    return [...this.history];
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
