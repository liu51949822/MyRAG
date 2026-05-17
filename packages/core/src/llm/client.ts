import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AppConfig } from "../config/config.js";

async function getConfig() {
  const { loadConfig } = await import("../config/config.js");
  return loadConfig();
}
export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  /** If true, return a stream of text deltas */
  stream?: boolean;
}

export interface EmbeddingOptions {
  model?: string;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

/** Unified LLM client interface */
export interface LLMClient {
  /** Send a chat completion request */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  /** Stream a chat completion */
  chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string>;
  /** Generate embeddings for text */
  embed(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult>;
  /** Generate embeddings for multiple texts in batch */
  embedBatch(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]>;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}
type LLMProvider = "anthropic" | "openai";

/**
 * Create an LLM client.
 * Auto-detects provider from config.
 */
export async function createLLMClient(): Promise<LLMClient> {
  const config = await getConfig();
  const provider: LLMProvider = config.anthropicApiKey ? "anthropic" : "openai";
  return provider === "anthropic"
    ? new AnthropicClient(config.anthropicApiKey, config.llmChatModel, config.openaiApiKey, config.llmEmbeddingModel)
    : new OpenAIClient(config.openaiApiKey, config.llmChatModel, config.llmEmbeddingModel);
}
class AnthropicClient implements LLMClient {
  private chatClient: Anthropic;
  private embedClient: OpenAI;
  private chatModel: string;
  private embeddingModel: string;

  constructor(
    anthropicKey: string,
    chatModel: string,
    openaiKey: string,
    embeddingModel: string,
  ) {
    this.chatClient = new Anthropic({ apiKey: anthropicKey });
    this.embedClient = new OpenAI({ apiKey: openaiKey });
    this.chatModel = chatModel;
    this.embeddingModel = embeddingModel;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const systemMsg = messages.filter(m => m.role === "system").map(m => m.content).join("\n");
    const nonSystem = messages.filter(m => m.role !== "system");

    const resp = await this.chatClient.messages.create({
      model: options.model || this.chatModel,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.3,
      system: systemMsg || options.systemPrompt || undefined,
      messages: nonSystem.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const textBlock = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return {
      content: textBlock?.text ?? "",
      model: resp.model,
      usage: {
        inputTokens: resp.usage.input_tokens,
        outputTokens: resp.usage.output_tokens,
      },
    };
  }

  async *chatStream(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<string> {
    const systemMsg = messages.filter(m => m.role === "system").map(m => m.content).join("\n");
    const nonSystem = messages.filter(m => m.role !== "system");

    const stream = await this.chatClient.messages.create({
      model: options.model || this.chatModel,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.3,
      system: systemMsg || options.systemPrompt || undefined,
      messages: nonSystem.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }

  async embed(text: string, options: EmbeddingOptions = {}): Promise<EmbeddingResult> {
    const resp = await this.embedClient.embeddings.create({
      model: options.model || this.embeddingModel,
      input: text,
    });
    return {
      embedding: resp.data[0].embedding,
      tokenCount: resp.usage.total_tokens,
    };
  }

  async embedBatch(texts: string[], options: EmbeddingOptions = {}): Promise<EmbeddingResult[]> {
    const resp = await this.embedClient.embeddings.create({
      model: options.model || this.embeddingModel,
      input: texts,
    });
    return resp.data.map((d, i) => ({
      embedding: d.embedding,
      tokenCount: Math.ceil(resp.usage.total_tokens / texts.length),
    }));
  }
}
class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private chatModel: string;
  private embeddingModel: string;

  constructor(apiKey: string, chatModel: string, embeddingModel: string) {
    this.client = new OpenAI({ apiKey });
    this.chatModel = chatModel;
    this.embeddingModel = embeddingModel;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const resp = await this.client.chat.completions.create({
      model: options.model || this.chatModel,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.3,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    return {
      content: resp.choices[0]?.message?.content ?? "",
      model: resp.model,
      usage: {
        inputTokens: resp.usage?.prompt_tokens ?? 0,
        outputTokens: resp.usage?.completion_tokens ?? 0,
      },
    };
  }

  async *chatStream(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: options.model || this.chatModel,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.3,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  async embed(text: string, options: EmbeddingOptions = {}): Promise<EmbeddingResult> {
    const resp = await this.client.embeddings.create({
      model: options.model || this.embeddingModel,
      input: text,
    });
    return {
      embedding: resp.data[0].embedding,
      tokenCount: resp.usage.total_tokens,
    };
  }

  async embedBatch(texts: string[], options: EmbeddingOptions = {}): Promise<EmbeddingResult[]> {
    const resp = await this.client.embeddings.create({
      model: options.model || this.embeddingModel,
      input: texts,
    });
    return resp.data.map((d, i) => ({
      embedding: d.embedding,
      tokenCount: Math.ceil(resp.usage.total_tokens / texts.length),
    }));
  }
}
