import * as pdfjsLib from "pdfjs-dist";
import fs from "node:fs/promises";

pdfjsLib.GlobalWorkerOptions.workerSrc = "";

export interface ParsedPage {
  pageNumber: number;
  content: string;
  charCount: number;
}

export interface ParsedDocument {
  pageCount: number;
  pages: ParsedPage[];
  fullText: string;
}

export class PDFParser {
  async parse(filePath: string): Promise<ParsedDocument> {
    const data = await fs.readFile(filePath);
    return this.parseBuffer(data);
  }

  async parseBuffer(data: Uint8Array): Promise<ParsedDocument> {
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;

    const pages: ParsedPage[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) => {
          if ("str" in item) {
            return item.str;
          }
          return "";
        })
        .join(" ");

      pages.push({
        pageNumber: i,
        content: pageText,
        charCount: pageText.length,
      });
    }

    const fullText = pages.map((p) => p.content).join("\n\n");

    return {
      pageCount: pdf.numPages,
      pages,
      fullText,
    };
  }
}
