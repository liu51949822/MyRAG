import fs from "node:fs/promises";
import path from "node:path";

export interface PlanStep {
  id: number;
  title: string;
  status: "pending" | "done" | "skipped";
  line: number;
}

export interface PlanDocument {
  title: string;
  steps: PlanStep[];
  raw: string;
}

export class PlanExecutor {
  async load(filePath: string): Promise<PlanDocument> {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");

    const title = this.extractTitle(lines);
    const steps = this.extractSteps(lines);

    console.log(`\n📋 Plan: ${title}`);
    console.log(`   ${steps.length} task(s) found\n`);

    return { title, steps, raw: content };
  }

  async executeOne(step: PlanStep): Promise<void> {
    console.log(`\n▶ Step ${step.id}: ${step.title}`);
  }

  markDone(step: PlanStep): PlanStep {
    return { ...step, status: "done" };
  }

  markSkipped(step: PlanStep): PlanStep {
    return { ...step, status: "skipped" };
  }

  formatProgress(steps: PlanStep[]): string {
    const done = steps.filter((s) => s.status === "done").length;
    const total = steps.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const bar = this.progressBar(pct);

    const lines: string[] = [];
    lines.push(`\nProgress: ${bar} ${done}/${total} (${pct}%)`);

    for (const step of steps) {
      const icon = step.status === "done" ? "✅" : step.status === "skipped" ? "⏭" : "⬜";
      lines.push(`  ${icon} [${step.id}] ${step.title}`);
    }

    return lines.join("\n");
  }

  async save(filePath: string, doc: PlanDocument): Promise<void> {
    let content = doc.raw;
    const lines = content.split("\n");

    for (const step of doc.steps) {
      const lineIndex = step.line - 1;
      const oldLine = lines[lineIndex];

      let newMarker: string;
      switch (step.status) {
        case "done": newMarker = "[x]"; break;
        case "skipped": newMarker = "[-]"; break;
        default: newMarker = "[ ]"; break;
      }

      const newLine = oldLine.replace(/\[[\sx-]\]/, newMarker);
      if (newLine !== oldLine) {
        lines[lineIndex] = newLine;
      }
    }

    await fs.writeFile(filePath, lines.join("\n"), "utf-8");
    console.log(`Plan saved to ${filePath}`);
  }

  private extractTitle(lines: string[]): string {
    for (const line of lines) {
      if (line.startsWith("# ") || line.startsWith("## ")) {
        return line.replace(/^#+ /, "").trim();
      }
    }
    return "Untitled Plan";
  }

  private extractSteps(lines: string[]): PlanStep[] {
    const steps: PlanStep[] = [];
    let id = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^\s*[-*]\s+\[([\sx-])\]\s+(.+)/);
      if (match) {
        id++;
        const marker = match[1];
        steps.push({
          id,
          title: match[2].trim(),
          status: marker === "x" ? "done" : marker === "-" ? "skipped" : "pending",
          line: i + 1,
        });
      }
    }

    return steps;
  }

  private progressBar(pct: number): string {
    const width = 20;
    const filled = Math.round((pct / 100) * width);
    return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
  }
}
