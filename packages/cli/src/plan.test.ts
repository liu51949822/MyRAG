import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PlanExecutor } from "./plan.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("PlanExecutor", () => {
  let tmpFile: string;

  beforeAll(async () => {
    tmpFile = path.join(os.tmpdir(), `test-plan-${Date.now()}.md`);
    await fs.writeFile(tmpFile, `# Test Plan

- [ ] Step 1: Set up project
- [x] Step 2: Already done
- [-] Step 3: Skipped item
- [ ] Step 4: Final step
`);
  });

  afterAll(async () => {
    await fs.unlink(tmpFile).catch(() => {});
  });

  it("loads plan from markdown file", async () => {
    const executor = new PlanExecutor();
    const plan = await executor.load(tmpFile);
    expect(plan.title).toBe("Test Plan");
    expect(plan.steps.length).toBe(4);
    expect(plan.steps[0].title).toContain("Set up project");
    expect(plan.steps[1].status).toBe("done");
    expect(plan.steps[2].status).toBe("skipped");
    expect(plan.steps[3].status).toBe("pending");
  });

  it("formats progress with bar and counts", () => {
    const executor = new PlanExecutor();
    const steps = [
      { id: 1, title: "A", status: "done" as const, line: 1 },
      { id: 2, title: "B", status: "done" as const, line: 2 },
      { id: 3, title: "C", status: "pending" as const, line: 3 },
      { id: 4, title: "D", status: "pending" as const, line: 4 },
    ];
    const formatted = executor.formatProgress(steps);
    expect(formatted).toContain("2/4");
    expect(formatted).toContain("50%");
    expect(formatted).toContain("A");
    expect(formatted).toContain("D");
  });

  it("marks steps as done and saves changes", async () => {
    const executor = new PlanExecutor();
    const plan = await executor.load(tmpFile);

    plan.steps[0].status = "done";
    await executor.save();

    const reloaded = await fs.readFile(tmpFile, "utf-8");
    expect(reloaded).toContain("[x] Step 1");
    expect(reloaded).toContain("[x] Step 2");
  });

  it("restores marker after save", async () => {
    await fs.writeFile(tmpFile, `# Test Plan

- [ ] Step 1: Set up project
- [x] Step 2: Already done
- [-] Step 3: Skipped item
- [ ] Step 4: Final step
`);
    const executor = new PlanExecutor();
    const plan = await executor.load(tmpFile);
    expect(plan.steps[0].status).toBe("pending");
  });
});
