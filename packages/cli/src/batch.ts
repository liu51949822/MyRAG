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
      const tag = `[${i + 1}/${entries.length}]`;

      process.stdout.write(`${tag} ${path.basename(entry.file)}... `);

      try {
        let summary = "";
        if (entry.type === "body") {
          summary = await handleBodyQuery(entry.file);
        } else if (entry.type === "ingest") {
          summary = await handleIngest(entry.file);
        }

        const dur = Date.now() - startTime;
        console.log(`✓ (${(dur / 1000).toFixed(1)}s)`);

        result.results.push({
          file: entry.file,
          type: entry.type,
          status: "ok",
          summary: summary.slice(0, 200),
          duration: dur,
        });
        result.succeeded++;
      } catch (err) {
        const dur = Date.now() - startTime;
        console.log(`✗ (${(dur / 1000).toFixed(1)}s)`);
        console.error(`   Error: ${err instanceof Error ? err.message : String(err)}`);

        result.results.push({
          file: entry.file,
          type: entry.type,
          status: "error",
          summary: `Failed: ${err instanceof Error ? err.message : String(err)}`,
          duration: dur,
        });
        result.failed++;
      }
    }

    return result;
  }

  formatResult(result: BatchResult): string {
    const modeLabel = result.results[0]?.type === "body" ? "Body Analysis" : "Ingestion";
    const date = new Date().toISOString().slice(0, 19).replace("T", " ");
    const srcDir = result.results[0]?.file ? path.dirname(result.results[0].file) : "N/A";

    const lines: string[] = [];
    lines.push(`# Batch ${modeLabel} Report`);
    lines.push(`**Date**: ${date}`);
    lines.push(`**Source**: ${srcDir}`);
    lines.push("");
    lines.push(`| Status | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total  | ${result.total} |`);
    lines.push(`| ✅ Succeeded | ${result.succeeded} |`);
    lines.push(`| ❌ Failed | ${result.failed} |`);
    lines.push("");

    if (result.succeeded > 0) {
      lines.push("## Successful");
      for (const r of result.results) {
        if (r.status !== "ok") continue;
        const dur = (r.duration / 1000).toFixed(1);
        lines.push(`- **${path.basename(r.file)}** (${r.type}, ${dur}s)`);
        const firstLine = r.summary.split("\n")[0];
        if (firstLine) lines.push(`  ${firstLine.slice(0, 120)}`);
      }
      lines.push("");
    }

    if (result.failed > 0) {
      lines.push("## Failed");
      for (const r of result.results) {
        if (r.status !== "error") continue;
        lines.push(`- **${path.basename(r.file)}**: ${r.summary}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  async saveResult(result: BatchResult): Promise<string> {
    const report = this.formatResult(result);
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const filename = `batch-report-${ts}.md`;
    const dir = path.join(process.cwd(), "docs");
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, report, "utf-8");
    return filePath;
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
}
