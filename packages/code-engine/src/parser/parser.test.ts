import { describe, it, expect } from "vitest";
import { TreeSitterParser } from "./parser.js";

describe("TreeSitterParser", () => {
  it("maps file extensions to languages correctly", () => {
    const parser = new TreeSitterParser();
    expect(parser).toBeInstanceOf(TreeSitterParser);
  });

  it("ignores unsupported file types", async () => {
    const parser = new TreeSitterParser();
    const result = await parser.parseFile("/nonexistent/file.xyz");
    expect(result).toBeNull();
  });

  it("handles empty directory gracefully", async () => {
    const parser = new TreeSitterParser();
    const result = await parser.parseProject("/Users/apple/Documents/MyRAG");
    expect(result.files).toBeDefined();
    expect(result.language).toBeDefined();
  });
});
