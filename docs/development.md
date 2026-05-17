# MyRAG 开发过程文档

## 项目背景

构建一个个人知识问答系统，结合：
1. **RAG** — 从个人 PDF 文档库中检索并回答
2. **Code Skills** — 代码审查、重构分析、业务/技术分离、小白文档生成

## 技术决策记录 (ADR)

### ADR-1: 选择 TypeScript/Node.js 全栈

**决策**: 使用 TypeScript (Node.js) 作为唯一语言，pnpm monorepo 管理多包。

**理由**:
- 用户偏好 TypeScript/Node.js
- monorepo 便于模块间依赖管理
- pnpm workspace 原生支持

### ADR-2: PostgreSQL + pgvector 作为向量存储

**决策**: 使用 PostgreSQL 的 pgvector 扩展而非专用向量数据库 (Qdrant/Chroma)。

**理由**:
- 用户明确指定 pgvector
- 已有 PostgreSQL 基础设施
- pgvector 支持 HNSW 索引，性能足够
- 与业务数据共库，无需额外维护

### ADR-3: Claude API 为主，OpenAI Embedding

**决策**: 聊天用 Claude，Embedding 用 OpenAI。

**理由**:
- Claude 在代码分析和长上下文表现更好
- OpenAI text-embedding-3-small 性价比高
- 在 LLM Client 层做了抽象，可互换

### ADR-4: tree-sitter 做多语言 AST 解析

**决策**: 使用 tree-sitter 而非 language-specific parser。

**理由**:
- 单 API 覆盖 20+ 语言
- Node.js 原生绑定
- 增量解析，适合大型项目

### ADR-5: 混合意图路由（规则 + LLM）

**决策**: 先用规则快速匹配，不明确时 fallback 到 LLM。

**理由**:
- 规则匹配零延迟、零成本
- LLM 兜底处理模糊查询
- 最大化效率

## 踩坑记录

### 1. drizzle-orm 的 jsonb 类型问题

drizzle 的 `$type<>()` 对 jsonb 列引入严格 TypeScript 类型，与自定义 interface 不兼容。
**解决**: 移除 jsonb 列的 `$type<>()`，在应用层做类型转换。

### 2. pnpm v10 的 approve-builds 机制

pnpm v10 默认阻止依赖的 postinstall 脚本，tree-sitter 需要编译 native addon。
**解决**: 在 package.json 配置 `pnpm.onlyBuiltDependencies: ["tree-sitter"]`。

### 3. tree-sitter 语言包动态加载

每个语言需要单独的 npm 包，不能静态导入所有包。
**解决**: 使用动态 `import()` 按需加载，配合 LANGUAGE_MAP 映射文件扩展名。

## 项目结构演进

```
Phase 0: 空仓库 + 脚手架
Phase 1: core (LLM + config + types)
Phase 2: core (DB schema + CRUD)
Phase 3: rag-engine (ingestion)
Phase 4-5: rag-engine (retrieval + generation)
Phase 6: code-engine (parser + analysis + review + docs)
Phase 7: router (intent classification)
Phase 8: cli (chat interface)
```
