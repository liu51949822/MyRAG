import fs from "node:fs/promises";
import { input } from "@inquirer/prompts";

export interface PlanStep {
  id: number;
  title: string;
  status: "pending" | "done" | "skipped";
  line: number;
}

export interface PlanDocument {
  filePath: string;
  title: string;
  steps: PlanStep[];
  raw: string;
}

export class PlanExecutor {
  private activePlan: PlanDocument | null = null;

  async load(filePath: string): Promise<PlanDocument> {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const title = this.extractTitle(lines);
    const steps = this.extractSteps(lines);

    this.activePlan = { filePath, title, steps, raw: content };
    return this.activePlan;
  }

  async interactiveLoop(): Promise<void> {
    const plan = this.activePlan;
    if (!plan) {
      console.log("No plan loaded. Use /plan <file.md> first.");
      return;
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`  📋 ${plan.title}`);
    console.log(`  ${this.progressBar(this.pct(plan.steps))} ${plan.steps.filter(s => s.status === "done").length}/${plan.steps.length}`);
    console.log(`═══════════════════════════════════════\n`);

    for (const step of plan.steps) {
      if (step.status === "done") {
        console.log(`  ✅ [${step.id}] ${step.title}`);
        continue;
      }
      if (step.status === "skipped") {
        console.log(`  ⏭ [${step.id}] ${step.title} (skipped)`);
        continue;
      }

      console.log(`\n  ▶ [${step.id}] ${step.title}`);
      console.log(`  ${"─".repeat(50)}`);

      const action = await input({
        message: "Action (enter=done, s=skip, q=quit)",
      });

      switch (action.toLowerCase()) {
        case "s":
        case "skip": {
          step.status = "skipped";
          console.log(`  ⏭ Skipped\n`);
          break;
        }
        case "q":
        case "quit": {
          console.log("\n  Plan execution paused.");
          await this.save();
          return;
        }
        default: {
          step.status = "done";
          await this.save();
          console.log(`  ✅ Marked done — plan auto-saved\n`);
          break;
        }
      }
    }

    const done = plan.steps.filter(s => s.status === "done").length;
    const skipped = plan.steps.filter(s => s.status === "skipped").length;
    console.log(`\n═══════════════════════════════════════`);
    console.log(`  Plan Complete: ✅ ${done} done | ⏭ ${skipped} skipped | ⬜ ${plan.steps.length - done - skipped} remaining`);
    console.log(`  ${this.progressBar(this.pct(plan.steps))}`);
    console.log(`═══════════════════════════════════════`);
    await this.save();
  }

  async runAll(): Promise<void> {
    const plan = this.activePlan;
    if (!plan) return;

    const pending = plan.steps.filter(s => s.status === "pending");
    if (pending.length === 0) {
      console.log("All tasks already completed.");
      return;
    }

    for (const step of pending) {
      console.log(`\n▶ [${step.id}] ${step.title}`);
      console.log("  Executing...");
      step.status = "done";
      await this.save();
    }

    console.log(`\n✅ ${pending.length} task(s) executed.`);
  }

  formatProgress(steps: PlanStep[]): string {
    const done = steps.filter(s => s.status === "done").length;
    const total = steps.length;
    const p = this.pct(steps);
    const bar = this.progressBar(p);

    const lines: string[] = [];
    lines.push(`\n${bar} ${done}/${total} (${p}%)\n`);

    for (const step of steps) {
      const icon = step.status === "done" ? "✅" : step.status === "skipped" ? "⏭" : "⬜";
      lines.push(`  ${icon} [${step.id}] ${step.title}`);
    }

    return lines.join("\n");
  }

  async save(): Promise<void> {
    const plan = this.activePlan;
    if (!plan) return;

    let content = plan.raw;
    const lines = content.split("\n");

    for (const step of plan.steps) {
      const idx = step.line - 1;
      const old = lines[idx];
      const marker = step.status === "done" ? "x" : step.status === "skipped" ? "-" : " ";
      const updated = old.replace(/\[[\sx-]\]/, `[${marker}]`);
      if (updated !== old) lines[idx] = updated;
    }

    const output = lines.join("\n");
    await fs.writeFile(plan.filePath, output, "utf-8");
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
      const m = lines[i].match(/^\s*[-*]\s+\[([\sx-])\]\s+(.+)/);
      if (m) {
        id++;
        steps.push({
          id,
          title: m[2].trim(),
          status: m[1] === "x" ? "done" : m[1] === "-" ? "skipped" : "pending",
          line: i + 1,
        });
      }
    }
    return steps;
  }

  private pct(steps: PlanStep[]): number {
    const done = steps.filter(s => s.status === "done").length;
    return steps.length > 0 ? Math.round((done / steps.length) * 100) : 0;
  }

  private progressBar(pct: number): string {
    const w = 20;
    const filled = Math.round((pct / 100) * w);
    return "[" + "█".repeat(filled) + "░".repeat(w - filled) + "]";
  }
}
