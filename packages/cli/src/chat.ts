import { IngestionPipeline } from "@myrag/rag-engine";
import { RAGGenerator } from "@myrag/rag-engine";
import { TreeSitterParser } from "@myrag/code-engine";
import { CodeAnalyzer } from "@myrag/code-engine";
import { CodeReviewer } from "@myrag/code-engine";
import { DocGenerator } from "@myrag/code-engine";
import { IntentRouter } from "@myrag/router";
import { loadConfig } from "@myrag/core";
import {
  insertMessage,
  insertCodeAnalysis,
  insertBodyAnalysis,
} from "@myrag/core";
import type { ChatMessage } from "@myrag/core";

loadConfig();

const ingestion = new IngestionPipeline();
const ragGenerator = new RAGGenerator();
const parser = new TreeSitterParser();
const analyzer = new CodeAnalyzer();
const reviewer = new CodeReviewer();
const docGen = new DocGenerator();
const router = new IntentRouter();

export interface ChatContext {
  sessionId: string;
  history: ChatMessage[];
}

export async function handleQuery(
  query: string,
  context: ChatContext,
  onToken?: (token: string) => void,
): Promise<string> {
  const classification = await router.classify(query);

  await insertMessage({
    sessionId: context.sessionId,
    role: "user",
    content: query,
  });

  let response: string;

  switch (classification.intent) {
    case "document": {
      const result = await ragGenerator.generateAnswerStream(
        query,
        context.history,
      );
      response = await collectStream(result.stream, onToken);
      break;
    }
    case "code": {
      const projectPath = classification.targetProject;
      if (!projectPath) {
        response = "Please specify a project path for code analysis. Example: `~/my-project`";
      } else {
        response = await handleCodeQuery(query, projectPath);
      }
      break;
    }
    default: {
      response = await handleGeneralQuery(query, context.history);
      break;
    }
  }

  await insertMessage({
    sessionId: context.sessionId,
    role: "assistant",
    content: response,
  });

  return response;
}

async function handleCodeQuery(_query: string, projectPath: string): Promise<string> {
  try {
    const { files, language } = await parser.parseProject(projectPath);

    if (files.length === 0) {
      return `No code files found in ${projectPath}. Make sure the path is correct.`;
    }

    const analysis = await analyzer.analyze(files);
    const architecture = await analyzer.buildArchitectureReport(files);
    const review = await reviewer.review(files);
    const beginnerDoc = await docGen.generateCodeToDoc(analysis, architecture);

    await insertCodeAnalysis({
      projectPath,
      language,
      summary: analysis.summary,
      businessLogic: analysis.businessLogic,
      technicalImpl: analysis.technicalImpl,
      architecture,
      beginnerDoc: JSON.stringify(beginnerDoc),
      reviewResult: review,
    });

    return formatCodeAnalysis(analysis, architecture, review, beginnerDoc);
  } catch (err) {
    return `Error analyzing project: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function handleGeneralQuery(
  query: string,
  history: ChatMessage[],
): Promise<string> {
  const { createLLMClient } = await import("@myrag/core");
  const client = await createLLMClient();

  const response = await client.chat(
    [
      {
        role: "system",
        content:
          "You are a helpful assistant with access to a personal knowledge base (documents) and code analysis tools. Ask the user if they want to search their documents or analyze code.",
      },
      ...history,
      { role: "user", content: query },
    ],
    { temperature: 0.7 },
  );

  return response.content;
}

async function collectStream(
  stream: AsyncIterable<string>,
  onToken?: (token: string) => void,
): Promise<string> {
  let result = "";
  for await (const token of stream) {
    result += token;
    onToken?.(token);
  }
  return result;
}

function formatCodeAnalysis(
  analysis: Awaited<ReturnType<typeof analyzer.analyze>>,
  _architecture: Awaited<ReturnType<typeof analyzer.buildArchitectureReport>>,
  review: Awaited<ReturnType<typeof reviewer.review>>,
  beginnerDoc: Awaited<ReturnType<typeof docGen.generateCodeToDoc>>,
): string {
  const lines: string[] = [];

  lines.push(`## Project Analysis\n`);
  lines.push(`${analysis.summary}\n`);

  lines.push(`### Business Logic (${analysis.businessLogic.length} components)`);
  for (const b of analysis.businessLogic.slice(0, 10)) {
    lines.push(`- **${b.name}** (${b.file}) — ${b.description}`);
  }
  lines.push("");

  lines.push(`### Technical Implementation (${analysis.technicalImpl.length} components)`);
  for (const t of analysis.technicalImpl.slice(0, 10)) {
    lines.push(`- **${t.name}** (${t.file}) [${t.category}] — ${t.description}`);
  }
  lines.push("");

  if (review.issues.length > 0) {
    lines.push(`### Code Review (Score: ${review.score}/100, ${review.issues.length} issues)`);
    for (const issue of review.issues.slice(0, 10)) {
      const icon = issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️";
      lines.push(`- ${icon} [${issue.category}] ${issue.file}:${issue.line} — ${issue.message}`);
    }
    lines.push("");
  }

  lines.push(`### Beginner's Guide`);
  lines.push(`${beginnerDoc.overview}\n`);
  for (const concept of beginnerDoc.businessConcepts) {
    lines.push(`- ${concept}`);
  }
  lines.push("");

  return lines.join("\n");
}

export async function handleIngest(target: string): Promise<string> {
  const stat = await import("node:fs/promises").then((m) => m.stat(target));

  if (stat.isDirectory()) {
    const results = await ingestion.ingestDirectory(target);
    return `Ingested ${results.length} PDF files:\n${results
      .map((r: { filename: string; chunkCount: number; totalChars: number }) => `  - ${r.filename} (${r.chunkCount} chunks, ${r.totalChars} chars)`)
      .join("\n")}`;
  }

  if (target.toLowerCase().endsWith(".pdf")) {
    const result = await ingestion.ingestFile(target);
    return `Ingested ${result.filename}: ${result.chunkCount} chunks, ${result.totalChars} characters.`;
  }

  return `Unsupported file format. Only PDF files are supported.`;
}

export async function handleBodyQuery(sourcePath: string): Promise<string> {
  const { PoseDetector } = await import("@myrag/body-analysis");
  const { PostureAnalyzer } = await import("@myrag/body-analysis");
  const { BodyTypeAnalyzer } = await import("@myrag/body-analysis");
  const { VideoProcessor } = await import("@myrag/body-analysis");
  const { ReportGenerator } = await import("@myrag/body-analysis");

  const detector = new PoseDetector();
  const postureAnalyzer = new PostureAnalyzer();
  const bodyTypeAnalyzer = new BodyTypeAnalyzer();
  const reportGen = new ReportGenerator();

  try {
    const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(sourcePath);

    if (isVideo) {
      const videoProcessor = new VideoProcessor(detector, postureAnalyzer, bodyTypeAnalyzer);
      const result = await videoProcessor.analyze(sourcePath);

      const report = await reportGen.generate(result.aggregatePosture, result.aggregateBodyType);
      const formatted = reportGen.formatReport(report, "video");

      await insertBodyAnalysis({
        sourceType: "video",
        sourcePath,
        postureScore: result.aggregatePosture.overallScore,
        postureDeviations: result.aggregatePosture.deviations,
        postureAngles: result.aggregatePosture.angles,
        bodyType: result.aggregateBodyType.type,
        bodyTypeSubtype: result.aggregateBodyType.subtype,
        bodyMeasurements: result.aggregateBodyType.measurements,
        bodyProportions: result.aggregateBodyType.proportions,
        recommendations: report.recommendations,
        exercisePlan: report.exercisePlan,
        lifestyle: report.lifestyle,
        fullReport: formatted,
      });

      await detector.dispose();
      return formatted;
    }

    const pose = await detector.detectFromFile(sourcePath);
    if (!pose) {
      await detector.dispose();
      return "Could not detect a person in the image. Please ensure the full body is visible in good lighting.";
    }

    const posture = postureAnalyzer.analyze(pose.keypoints);
    const bodyType = bodyTypeAnalyzer.analyze(pose.keypoints);

    const report = await reportGen.generate(posture, bodyType);
    const formatted = reportGen.formatReport(report, "photo");

    await insertBodyAnalysis({
      sourceType: "photo",
      sourcePath,
      postureScore: posture.overallScore,
      postureDeviations: posture.deviations,
      postureAngles: posture.angles,
      bodyType: bodyType.type,
      bodyTypeSubtype: bodyType.subtype,
      bodyMeasurements: bodyType.measurements,
      bodyProportions: bodyType.proportions,
      recommendations: report.recommendations,
      exercisePlan: report.exercisePlan,
      lifestyle: report.lifestyle,
      fullReport: formatted,
    });

    await detector.dispose();
    return formatted;
  } catch (err) {
    await detector.dispose().catch(() => {});
    return `Body analysis failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}
