import fs from "node:fs/promises";
import path from "node:path";
import {
  handleBodyQuery,
  handleIngest,
} from "./chat.js";

export interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    file: string;
    type: "body" | "ingest" | "code";
    status: "ok" | "error";
    summary: string;
    duration: number;
  }>;
}

const SUPPORTED_EXTS = {
  body: [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".avi", ".mkv"],
  ingest: [".pdf"],
  code: [],
};

export class BatchProcessor {
  async run(
    dirPath: string,
    mode: "body" | "ingest" | "auto" = "auto",
  ): Promise<BatchResult> {
    const entries = await this.collectFiles(dirPath, mode);
    const result: BatchResult = {
      total: entries.length,
      succeeded: 0,
      failed: 0,
      results: [],
    };

    if (entries.length === 0) {
      return result;
    }

    console.log(`\nBatch processing ${entries.length} file(s)...\n`);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const startTime = Date.now();
      const progress = `[${i + 1}/${entries.length}]`;

      process.stdout.write(`${progress} ${path.basename(entry.file)}... `);

      try {
        let summary = "";

        if (entry.type === "body") {
          summary = await handleBodyQuery(entry.file);
        } else if (entry.type === "ingest") {
          summary = await handleIngest(entry.file);
        }

        const duration = Date.now() - startTime;
        console.log(`✓ (${(duration / 1000).toFixed(1)}s)`);

        result.results.push({
          file: entry.file,
          type: entry.type,
          status: "ok",
          summary: summary.slice(0, 200),
          duration,
        });
        result.succeeded++;
      } catch (err) {
        const duration = Date.now() - startTime;
        console.log(`✗ (${(duration / 1000).toFixed(1)}s)`);
        console.error(`   Error: ${err instanceof Error ? err.message : String(err)}`);

        result.results.push({
          file: entry.file,
          type: entry.type,
          status: "error",
          summary: `Failed: ${err instanceof Error ? err.message : String(err)}`,
          duration,
        });
        result.failed++;
      }
    }

    return result;
  }

  private async collectFiles(
    dirPath: string,
    mode: "body" | "ingest" | "auto",
  ): Promise<Array<{ file: string; type: "body" | "ingest" }>> {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) {
      throw new Error(`${dirPath} is not a directory`);
    }

    const entries: Array<{ file: string; type: "body" | "ingest" }> = [];
    await this.walkDir(dirPath, entries, mode);
    return entries;
  }

  private async walkDir(
    currentPath: string,
    results: Array<{ file: string; type: "body" | "ingest" }>,
    mode: "body" | "ingest" | "auto",
  ): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await this.walkDir(fullPath, results, mode);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();

      if (mode === "body" || mode === "auto") {
        if (SUPPORTED_EXTS.body.includes(ext)) {
          results.push({ file: fullPath, type: "body" });
          if (mode === "body") continue;
        }
      }

      if (mode === "ingest" || mode === "auto") {
        if (SUPPORTED_EXTS.ingest.includes(ext)) {
          results.push({ file: fullPath, type: "ingest" });
        }
      }
    }
  }

  formatResult(result: BatchResult): string {
    const lines: string[] = [];
    lines.push(`## Batch Processing Report`);
    lines.push("");
    lines.push(`- **Total**: ${result.total}`);
    lines.push(`- **Succeeded**: ${result.succeeded}`);
    lines.push(`- **Failed**: ${result.failed}`);
    lines.push("");

    if (result.succeeded > 0) {
      lines.push("### Successful");
      for (const r of result.results) {
        if (r.status === "ok") {
          const dur = (r.duration / 1000).toFixed(1);
          lines.push(`- **${path.basename(r.file)}** (${r.type}, ${dur}s)`);
          const firstLine = r.summary.split("\n")[0];
          if (firstLine) lines.push(`  ${firstLine.slice(0, 120)}`);
        }
      }
      lines.push("");
    }

    if (result.failed > 0) {
      lines.push("### Failed");
      for (const r of result.results) {
        if (r.status === "error") {
          lines.push(`- **${path.basename(r.file)}**: ${r.summary}`);
        }
      }
      lines.push("");
    }

    return lines.join("\n");
  }
}
