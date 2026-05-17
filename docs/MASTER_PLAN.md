# MyRAG — 个人知识 + 代码助手 实施计划

## 项目概述

一个 CLI 聊天式个人助手系统，结合 **RAG 知识检索** 和 **代码分析能力**：

| 能力 | 描述 |
|------|------|
| 📄 RAG 引擎 | PDF 文档解析 → 分块 → 向量化 → 混合检索 → 问答 |
| 💻 Code 引擎 | 多语言 AST 解析 → 业务/技术分离 → 代码审查 → 小白文档生成 |
| 🧭 路由层 | 判断查询意图，分发到 RAG 或 Code 引擎 |

## 技术栈

| 层 | 选型 |
|----|------|
| 语言 | TypeScript (Node.js) |
| 包管理 | pnpm monorepo |
| RAG 框架 | LangChain.js |
| 向量存储 | PostgreSQL + pgvector |
| PDF 解析 | pdfjs-dist |
| AST 解析 | tree-sitter (40+ 语言) |
| LLM | Claude API (主) + OpenAI API (embedding) |
| CLI | @inquirer/prompts (交互式) |
| 数据库迁移 | drizzle-orm + drizzle-kit |
| 测试 | vitest |

## 项目结构

```
MyRAG/
├── docs/                        # 开发过程文档
│   ├── MASTER_PLAN.md           # 本文件
│   └── decisions/               # 架构决策记录 (ADR)
├── packages/
│   ├── core/                    # 共享核心
│   │   ├── src/
│   │   │   ├── llm/             # LLM 客户端抽象 (Claude/GPT)
│   │   │   ├── config/          # 配置加载
│   │   │   ├── types/           # 共享类型定义
│   │   │   └── db/              # 数据库连接 + Schema
│   │   └── package.json
│   ├── rag-engine/              # RAG 引擎
│   │   ├── src/
│   │   │   ├── ingestion/       # PDF 解析、分块
│   │   │   ├── embedding/       # 向量化
│   │   │   ├── retrieval/       # 检索 + 重排
│   │   │   └── generation/      # RAG prompt + 生成
│   │   └── package.json
│   ├── code-engine/             # 代码分析引擎
│   │   ├── src/
│   │   │   ├── parser/          # tree-sitter 多语言解析
│   │   │   ├── analysis/        # 业务/技术分离
│   │   │   ├── review/          # 代码审查
│   │   │   └── docs/            # 小白文档生成
│   │   └── package.json
│   ├── router/                  # 意图路由
│   │   ├── src/
│   │   │   └── classifier.ts    # 查询分类器
│   │   └── package.json
│   └── cli/                     # CLI 聊天入口
│       ├── src/
│       │   ├── chat.ts          # 交互式聊天循环
│       │   ├── commands.ts      # 命令处理
│       │   └── session.ts       # 会话管理
│       └── package.json
├── package.json                 # 根 workspace
├── pnpm-workspace.yaml
├── tsconfig.json
└── .gitignore
```

---

## 实施阶段

### Phase 0: 项目脚手架 (预计 1 步)

**目标**: 搭好 monorepo 骨架，能跑 `pnpm build` 不报错。

- [ ] 0.1 根配置：pnpm-workspace、tsconfig、eslint、prettier、.gitignore
- [ ] 0.2 创建 5 个 packages 骨架 (core, rag-engine, code-engine, router, cli)
- [ ] 0.3 验证：`pnpm install && pnpm build` 通过

### Phase 1: Core 基础设施 (预计 3 步)

**目标**: 所有 package 共享的核心能力就绪。

- [ ] 1.1 配置系统：从环境变量/.env 加载 LLM key、DB 连接等
- [ ] 1.2 LLM 客户端：统一的 Claude/GPT 调用接口（chat + embedding）
- [ ] 1.3 类型定义：Message, Document, Chunk, CodeAnalysis 等核心类型

### Phase 2: 数据库 (预计 3 步)

**目标**: PostgreSQL + pgvector 建表，连接可用。

- [ ] 2.1 PostgreSQL 连接池（pg + pgvector 扩展）
- [ ] 2.2 Schema 设计 + drizzle 迁移
  - `documents` — 文档元信息
  - `chunks` — 文本块 + 向量 (pgvector)
  - `code_analyses` — 代码分析结果缓存
  - `sessions` — 聊天会话
  - `messages` — 聊天历史
- [ ] 2.3 数据库 CRUD 工具函数

### Phase 3: RAG 引擎 — Ingestion (预计 4 步)

**目标**: PDF 扔进去，自动分块、向量化、入库。

- [ ] 3.1 PDF 解析器 (pdfjs-dist → 提取文本 + 结构)
- [ ] 3.2 分块策略（语义分块：按段落/标题边界 + 滑动窗口重叠）
- [ ] 3.3 Embedding 生成（调 OpenAI text-embedding-3-small）
- [ ] 3.4 完整 ingestion pipeline：PDF → parse → chunk → embed → store

### Phase 4: RAG 引擎 — Retrieval (预计 3 步)

**目标**: 用户问问题，从知识库检索相关片段。

- [ ] 4.1 向量相似度检索（pgvector `<=>` 操作符）
- [ ] 4.2 混合检索（dense vector + PostgreSQL full-text search / ts_vector）
- [ ] 4.3 Reranker（用 LLM 对召回结果重排）

### Phase 5: RAG 引擎 — Generation (预计 2 步)

**目标**: 检索结果 + 用户问题 → LLM 生成答案。

- [ ] 5.1 RAG prompt 模板（带引用标注）
- [ ] 5.2 生成 + 流式输出

### Phase 6: Code 引擎 (预计 5 步)

**目标**: 指向本地项目 → 全面分析 → 输出结构化报告。

- [ ] 6.1 tree-sitter 集成：多语言解析器加载、文件扫描
- [ ] 6.2 AST 遍历：提取函数/类/接口/依赖关系
- [ ] 6.3 业务 vs 技术逻辑分类（LLM 分类每个函数/类）
- [ ] 6.4 架构分析：调用图 + 模块依赖 + 数据流
- [ ] 6.5 小白文档生成：业务逻辑 → 通俗语言重写

### Phase 7: 意图路由 (预计 2 步)

**目标**: 判断用户问题是"文档类"还是"代码类"。

- [ ] 7.1 分类器：用便宜 LLM 做快速意图分类
- [ ] 7.2 混合查询处理：同时召回文档 + 代码，融合结果

### Phase 8: CLI 聊天界面 (预计 3 步)

**目标**: 终端里聊天式交互。

- [ ] 8.1 交互式聊天循环（readline / @inquirer/prompts）
- [ ] 8.2 命令系统：`/rag` 知识库问答、`/code` 代码分析、`/ingest` 导入文档
- [ ] 8.3 会话管理：持久化聊天历史、恢复会话

### Phase 9: 集成测试 & 文档 (预计 2 步)

- [ ] 9.1 端到端集成测试
- [ ] 9.2 README + 使用文档

---

## 开发原则

1. **Plan first, code second** — 每个 Phase 写清子任务再动手
2. **过程留档** — 架构决策、踩坑记录放 `docs/decisions/`
3. **小步提交** — 每完成一个子任务就 git commit
4. **类型安全** — 禁止 `as any`、`@ts-ignore`
5. **可测试** — 核心逻辑要有单元测试
