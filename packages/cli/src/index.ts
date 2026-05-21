import { input } from "@inquirer/prompts";
import { SessionManager } from "./session.js";
import { BatchProcessor } from "./batch.js";
import { PlanExecutor } from "./plan.js";
import { loadConfig } from "@myrag/core";
import "dotenv/config";

loadConfig();

async function main() {
  console.log("MyRAG - Personal Knowledge + Code Assistant\n");

  const session = new SessionManager();
  await session.init();

  while (true) {
    const query = await input({ message: "You" });

    if (!query.trim()) continue;

    if (query === "/quit" || query === "/exit") {
      console.log("Goodbye!");
      break;
    }

    if (query === "/help") {
      console.log("\nCommands:");
      console.log("  /ingest <path>              Import PDF document(s)");
      console.log("  /code <path>                Analyze a code project");
      console.log("  /body <path>                Analyze body from photo/video");
      console.log("  /batch [mode] <dir>         Batch loop: body|ingest|auto");
      console.log("  /plan <file.md>             Show plan progress");
      console.log("  /plan interactive <file>    Step through each task");
      console.log("  /plan run <file>            Auto-execute all pending");
      console.log("  /help                       Show this help");
      console.log("  /quit                       Exit\n");
      continue;
    }

    if (query.startsWith("/batch")) {
      const parts = query.split(/\s+/);
      const mode = parts.length >= 3 ? parts[1] : "auto";
      const target = parts.length >= 3 ? parts.slice(2).join(" ") : parts.slice(1).join(" ");

      if (!target) {
        console.log("Usage: /batch [mode] <directory>");
        console.log("  mode: body, ingest, auto (default)");
        continue;
      }

      const batch = new BatchProcessor();
      let modeStr: "body" | "ingest" | "auto" = "auto";
      if (mode === "body" || mode === "ingest") modeStr = mode;

      const result = await batch.run(target, modeStr);
      console.log("\n" + batch.formatResult(result));

      if (result.total > 0) {
        const savedPath = await batch.saveResult(result);
        console.log(`Report saved to ${savedPath}\n`);
      }
      continue;
    }

    if (query.startsWith("/plan")) {
      const parts = query.split(/\s+/).filter(Boolean);
      const cmd = parts[1] || "";
      const rest = parts.slice(2).join(" ");

      if (cmd === "interactive" || cmd === "i") {
        if (!rest) {
          console.log("Usage: /plan interactive <file.md>");
          continue;
        }
        const executor = new PlanExecutor();
        await executor.load(rest);
        await executor.interactiveLoop();
        continue;
      }

      if (cmd === "run" || cmd === "r") {
        if (!rest) {
          console.log("Usage: /plan run <file.md>");
          continue;
        }
        const executor = new PlanExecutor();
        await executor.load(rest);
        const plan = await executor.load(rest);
        console.log(executor.formatProgress(plan.steps));
        await executor.runAll();
        console.log("\n" + executor.formatProgress(plan.steps) + "\n");
        continue;
      }

      const filePath = parts[1] || "";
      if (!filePath) {
        console.log("Usage:");
        console.log("  /plan <file.md>               Show progress");
        console.log("  /plan interactive <file.md>   Step through each task");
        console.log("  /plan run <file.md>           Auto-execute all pending tasks");
        continue;
      }

      const executor = new PlanExecutor();
      const plan = await executor.load(filePath);
      console.log(executor.formatProgress(plan.steps) + "\n");
      continue;
    }

    if (query.startsWith("/body")) {
      const target = query.slice("/body".length).trim();
      if (!target) {
        console.log("Usage: /body <path-to-photo-or-video>");
        continue;
      }
      console.log(`Analyzing body posture and type from ${target}...`);
      const result = await session.analyzeBody(target);
      console.log("\n" + result + "\n");
      continue;
    }

    if (query.startsWith("/ingest")) {
      const target = query.slice("/ingest".length).trim();
      if (!target) {
        console.log("Usage: /ingest <path-to-pdf>");
        continue;
      }
      console.log(`Ingesting ${target}...`);
      const result = await session.ingest(target);
      console.log(result + "\n");
      continue;
    }

    if (query.startsWith("/code")) {
      const target = query.slice("/code".length).trim();
      if (!target) {
        console.log("Usage: /code <path-to-project>");
        continue;
      }
      console.log("Analyzing...");
      const result = await session.ask(`Analyze project at ${target}`);
      console.log("\n" + result + "\n");
      continue;
    }

    process.stdout.write("Assistant: ");
    const response = await session.ask(query, (token) => {
      process.stdout.write(token);
    });
    console.log("\n");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
