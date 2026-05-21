import { createLLMClient, type LLMClient } from "@myrag/core";
import type { PostureReport } from "../analysis/posture.js";
import type { BodyTypeReport } from "../analysis/body-type.js";

export interface FullReport {
  posture: PostureReport;
  bodyType: BodyTypeReport;
  recommendations: string[];
  exercisePlan: ExerciseItem[];
  lifestyle: string[];
  rawJson: string;
}

export interface ExerciseItem {
  name: string;
  targets: string[];
  sets: string;
  reps: string;
  description: string;
}

export class ReportGenerator {
  private client: LLMClient | null = null;

  private async getClient(): Promise<LLMClient> {
    if (!this.client) {
      this.client = await createLLMClient();
    }
    return this.client;
  }

  async generate(posture: PostureReport, bodyType: BodyTypeReport): Promise<FullReport> {
    const client = await this.getClient();

    const prompt = `You are a professional posture and body type analyst. Based on the following analysis results, generate a complete report with personalized recommendations.

Posture Analysis:
- Score: ${posture.overallScore}/100
- Deviations: ${posture.deviations.map((d) => `${d.name}: ${d.severity} (${d.angle}°, normal: ${d.normalRange})`).join("; ") || "None"}

Body Type:
- Type: ${bodyType.type} (${bodyType.subtype})
- Shoulder-to-Waist Ratio: ${bodyType.proportions.shoulderToWaistRatio.toFixed(2)}
- Waist-to-Hip Ratio: ${bodyType.proportions.waistToHipRatio.toFixed(2)}
- Head-to-Body Ratio: ${bodyType.proportions.headToBodyRatio.toFixed(1)}
- Leg-to-Torso Ratio: ${bodyType.proportions.legToTorsoRatio.toFixed(2)}

Return JSON:
{
  "recommendations": ["5 specific actionable recommendations for posture improvement"],
  "exercisePlan": [
    { "name": "exercise name", "targets": ["muscles targeted"], "sets": "3", "reps": "12-15", "description": "how to do it" }
  ],
  "lifestyle": ["4-6 lifestyle adjustment suggestions (ergonomics, habits, daily routines)"]
}

Return ONLY JSON, no other text.`;

    const response = await client.chat(
      [{ role: "user", content: prompt }],
      { temperature: 0.4, maxTokens: 2000 },
    );

    let parsed: {
      recommendations: string[];
      exercisePlan: ExerciseItem[];
      lifestyle: string[];
    } = { recommendations: [], exercisePlan: [], lifestyle: [] };

    try {
      const match = response.content.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    } catch {
    }

    return {
      posture,
      bodyType,
      recommendations: parsed.recommendations,
      exercisePlan: parsed.exercisePlan,
      lifestyle: parsed.lifestyle,
      rawJson: response.content,
    };
  }

  formatReport(report: FullReport, sourceType: "photo" | "video"): string {
    const lines: string[] = [];

    lines.push(`# Body Analysis Report (${sourceType === "video" ? "Video" : "Photo"})`);
    lines.push("");

    lines.push("## Posture Analysis");
    lines.push(`**Score**: ${report.posture.overallScore}/100`);
    lines.push("");

    if (report.posture.deviations.length > 0) {
      lines.push("### Deviations Detected");
      for (const d of report.posture.deviations) {
        const icon = d.severity === "severe" ? "🔴" : d.severity === "moderate" ? "🟡" : "🟢";
        lines.push(`- ${icon} **${d.name}** (${d.severity}, ${d.angle}°): ${d.description}`);
        lines.push(`  *Recommendation*: ${d.recommendation}`);
      }
      lines.push("");
    } else {
      lines.push("No significant posture deviations detected.\n");
    }

    lines.push("## Body Type Analysis");
    const typeNames: Record<string, string> = {
      inverted_triangle: "倒三角型 (Inverted Triangle)",
      rectangle: "矩型 (Rectangle)",
      pear: "梨型 (Pear)",
      hourglass: "沙漏型 (Hourglass)",
      apple: "苹果型 (Apple)",
      unknown: "未知",
    };
    lines.push(`**Type**: ${typeNames[report.bodyType.type] ?? report.bodyType.type} (${report.bodyType.subtype})`);
    lines.push("");
    lines.push(`- Shoulder-to-Waist: ${report.bodyType.proportions.shoulderToWaistRatio.toFixed(2)}`);
    lines.push(`- Waist-to-Hip: ${report.bodyType.proportions.waistToHipRatio.toFixed(2)}`);
    lines.push(`- Head-to-Body: ${report.bodyType.proportions.headToBodyRatio.toFixed(1)}`);
    lines.push(`- Leg-to-Torso: ${report.bodyType.proportions.legToTorsoRatio.toFixed(2)}`);
    lines.push("");

    if (report.recommendations.length > 0) {
      lines.push("## Recommendations");
      for (const r of report.recommendations) {
        lines.push(`- ${r}`);
      }
      lines.push("");
    }

    if (report.exercisePlan.length > 0) {
      lines.push("## Exercise Plan");
      for (const ex of report.exercisePlan) {
        lines.push(`### ${ex.name}`);
        lines.push(`- **Targets**: ${ex.targets.join(", ")}`);
        lines.push(`- **Sets × Reps**: ${ex.sets} × ${ex.reps}`);
        lines.push(`- **How to**: ${ex.description}`);
        lines.push("");
      }
    }

    if (report.lifestyle.length > 0) {
      lines.push("## Lifestyle Suggestions");
      for (const l of report.lifestyle) {
        lines.push(`- ${l}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }
}
