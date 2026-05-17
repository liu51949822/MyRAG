# MyRAG — Personal Knowledge + Code Assistant

A CLI-based personal assistant that combines **RAG document retrieval** with **multi-language code analysis**, powered by your own knowledge base.

## Architecture

```
User Input
    │
    ▼
IntentRouter ──→ document? ──→ RAG Engine ──→ PostgreSQL+pgvector
    │                │
    │            code? ──→ Code Engine ──→ tree-sitter + LLM
    │
    └──→ general ──→ LLM direct
```

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL with pgvector extension

### 1. Clone & Install

```bash
git clone https://github.com/liu51949822/MyRAG.git
cd MyRAG
pnpm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/myrag
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
```

### 3. Setup Database

```bash
# Create the database
createdb myrag

# Create schema
pnpm --filter @myrag/core run db:push
```

### 4. Install Language Parsers (for Code Engine)

```bash
pnpm add -w tree-sitter-javascript tree-sitter-typescript tree-sitter-python
```

### 5. Build & Run

```bash
pnpm build
pnpm start
```

## Usage

```
MyRAG - Personal Knowledge + Code Assistant

Commands:
  /ingest <path>   Import PDF document(s)
  /code <path>     Analyze a code project
  /help            Show help
  /quit            Exit

You: What does my research paper about neural networks say?
Assistant: [streams answer from your PDF library with source citations]

You: /code ~/my-project
Assistant: [analyzes project, separates business/tech logic, provides beginner doc]

You: /ingest ~/Documents/papers/
Assistant: Ingested 5 PDF files...
```

## Packages

| Package | Description |
|---------|-------------|
| `@myrag/core` | LLM client, config, PostgreSQL/pgvector, shared types |
| `@myrag/rag-engine` | PDF ingestion, chunking, embedding, retrieval, RAG generation |
| `@myrag/code-engine` | Multi-language AST parsing, business/tech separation, code review, docs |
| `@myrag/router` | Intent classification (document vs code vs general) |
| `@myrag/cli` | Interactive terminal chat interface |

## Key Features

### RAG Engine
- PDF parsing via pdfjs-dist
- Semantic chunking with configurable overlap
- OpenAI embeddings (text-embedding-3-small)
- Hybrid search (dense vector + keyword matching)
- LLM-based reranking
- Streaming answer generation with source citations

### Code Engine
- Multi-language support via tree-sitter (20+ languages)
- Business logic vs technical implementation separation
- Architecture analysis (module dependencies, data flow, entry points)
- Code review (security, performance, readability, bugs)
- Beginner-friendly documentation generation

### Intent Router
- Fast rule-based classification (regex patterns)
- LLM fallback for ambiguous queries
- Automatic routing to RAG or Code engine

## Development

```bash
# Build all packages
pnpm build

# Type check
pnpm lint

# Run tests
pnpm test

# Build a single package
pnpm --filter @myrag/core run build
```

### Database Migrations

```bash
# Generate migration
pnpm --filter @myrag/core run db:generate

# Apply migrations
pnpm --filter @myrag/core run db:push
```

## Tech Stack

- **Language**: TypeScript (Node.js 20+)
- **Monorepo**: pnpm workspaces
- **Database**: PostgreSQL + pgvector (drizzle-orm)
- **LLM**: Claude API (chat) + OpenAI API (embeddings)
- **PDF**: pdfjs-dist
- **AST**: tree-sitter
- **CLI**: @inquirer/prompts

## License

MIT
