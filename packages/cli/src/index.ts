import { input } from "@inquirer/prompts";
import { SessionManager } from "./session.js";
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
      console.log("  /ingest <path>  Import PDF document(s)");
      console.log("  /code <path>     Analyze a code project");
      console.log("  /body <path>     Analyze body posture/type from photo or video");
      console.log("  /quit            Exit\n");
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
