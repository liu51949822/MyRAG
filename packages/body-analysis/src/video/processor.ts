import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import type { PoseDetector } from "../pose/detector.js";
import type { PostureAnalyzer, PostureReport } from "../analysis/posture.js";
import type { BodyTypeAnalyzer, BodyTypeReport } from "../analysis/body-type.js";

const execFileAsync = promisify(execFile);

export interface VideoFrameResult {
  timestamp: number;
  posture: PostureReport;
  bodyType: BodyTypeReport;
}

export interface VideoAnalysisResult {
  duration: number;
  frameCount: number;
  framesAnalyzed: number;
  frameResults: VideoFrameResult[];
  aggregatePosture: PostureReport;
  aggregateBodyType: BodyTypeReport;
}

export class VideoProcessor {
  private detector: PoseDetector;
  private postureAnalyzer: PostureAnalyzer;
  private bodyTypeAnalyzer: BodyTypeAnalyzer;

  constructor(detector: PoseDetector, postureAnalyzer: PostureAnalyzer, bodyTypeAnalyzer: BodyTypeAnalyzer) {
    this.detector = detector;
    this.postureAnalyzer = postureAnalyzer;
    this.bodyTypeAnalyzer = bodyTypeAnalyzer;
  }

  async analyze(videoPath: string, frameInterval = 2): Promise<VideoAnalysisResult> {
    const tempDir = path.join(os.tmpdir(), `myrag-video-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      const duration = await this.getDuration(videoPath);
      const frames = await this.extractFrames(videoPath, tempDir, frameInterval);

      const frameResults: VideoFrameResult[] = [];

      for (let i = 0; i < frames.length; i++) {
        try {
          const pose = await this.detector.detectFromFile(frames[i]);
          if (!pose) continue;

          const posture = this.postureAnalyzer.analyze(pose.keypoints);
          const bodyType = this.bodyTypeAnalyzer.analyze(pose.keypoints);

          frameResults.push({
            timestamp: (i * frameInterval),
            posture,
            bodyType,
          });
        } catch {
        }
      }

      const aggregatePosture = this.aggregatePosture(frameResults);
      const aggregateBodyType = this.aggregateBodyType(frameResults);

      return {
        duration,
        frameCount: frames.length,
        framesAnalyzed: frameResults.length,
        frameResults,
        aggregatePosture,
        aggregateBodyType,
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  private async getDuration(videoPath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        videoPath,
      ]);
      return parseFloat(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  private async extractFrames(videoPath: string, outputDir: string, interval: number): Promise<string[]> {
    try {
      await execFileAsync("ffmpeg", [
        "-i", videoPath,
        "-vf", `fps=1/${interval}`,
        "-q:v", "2",
        `${outputDir}/frame_%04d.jpg`,
      ]);

      const entries = await fs.readdir(outputDir);
      return entries
        .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
        .sort()
        .map((f) => path.join(outputDir, f));
    } catch {
      return [];
    }
  }

  private aggregatePosture(results: VideoFrameResult[]): PostureReport {
    if (results.length === 0) {
      return {
        overallScore: 0,
        deviations: [],
        angles: { headTilt: 0, shoulderAlignment: 0, hipAlignment: 0, kneeAngle: 0, pelvicTilt: 0, spinalAlignment: 0 },
        summary: "No frames were successfully analyzed.",
      };
    }

    const avgScore = results.reduce((sum, r) => sum + r.posture.overallScore, 0) / results.length;

    const allDeviations = results.flatMap((r) => r.posture.deviations);
    const deviationMap = new Map<string, { totalAngle: number; totalSev: number; count: number; name: string; normalRange: string; description: string; recommendation: string }>();

    for (const d of allDeviations) {
      const existing = deviationMap.get(d.name);
      if (existing) {
        existing.totalAngle += d.angle;
        existing.count++;
        existing.totalSev += d.severity === "severe" ? 3 : d.severity === "moderate" ? 2 : 1;
      } else {
        deviationMap.set(d.name, {
          totalAngle: d.angle,
          count: 1,
          totalSev: d.severity === "severe" ? 3 : d.severity === "moderate" ? 2 : 1,
          name: d.name,
          normalRange: d.normalRange,
          description: d.description,
          recommendation: d.recommendation,
        });
      }
    }

    const aggregatedDeviations = Array.from(deviationMap.values())
      .filter((v) => v.count >= results.length * 0.3)
      .map((v) => {
        const avgSev = v.totalSev / v.count;
        return {
          name: v.name,
          severity: (avgSev > 2.5 ? "severe" : avgSev > 1.5 ? "moderate" : "mild") as "mild" | "moderate" | "severe",
          angle: Math.round(v.totalAngle / v.count),
          normalRange: v.normalRange,
          description: v.description,
          recommendation: v.recommendation,
        };
      });

    const avgAngles = {
      headTilt: this.avg(results, (r) => r.posture.angles.headTilt),
      shoulderAlignment: this.avg(results, (r) => r.posture.angles.shoulderAlignment),
      hipAlignment: this.avg(results, (r) => r.posture.angles.hipAlignment),
      kneeAngle: this.avg(results, (r) => r.posture.angles.kneeAngle),
      pelvicTilt: this.avg(results, (r) => r.posture.angles.pelvicTilt),
      spinalAlignment: this.avg(results, (r) => r.posture.angles.spinalAlignment),
    };

    return {
      overallScore: Math.round(avgScore),
      deviations: aggregatedDeviations,
      angles: avgAngles,
      summary: `Video analysis over ${results.length} frames. Average posture score: ${Math.round(avgScore)}/100. ${aggregatedDeviations.length} consistent deviations found.`,
    };
  }

  private aggregateBodyType(results: VideoFrameResult[]): BodyTypeReport {
    if (results.length === 0) {
      return {
        type: "unknown",
        subtype: "N/A",
        measurements: { shoulderWidth: 0, hipWidth: 0, estimatedWaistWidth: 0, torsoLength: 0, inseam: 0 },
        proportions: { shoulderToWaistRatio: 0, waistToHipRatio: 0, shoulderToHipRatio: 0, headToBodyRatio: 0, armToTorsoRatio: 0, legToTorsoRatio: 0 },
        summary: "No frames analyzed.",
      };
    }

    const typeCounts: Record<string, number> = {};
    for (const r of results) {
      typeCounts[r.bodyType.type] = (typeCounts[r.bodyType.type] ?? 0) + 1;
    }

    const dominantType = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "unknown";

    const avgMeasurements = {
      shoulderWidth: this.avg(results, (r) => r.bodyType.measurements.shoulderWidth),
      hipWidth: this.avg(results, (r) => r.bodyType.measurements.hipWidth),
      estimatedWaistWidth: this.avg(results, (r) => r.bodyType.measurements.estimatedWaistWidth),
      torsoLength: this.avg(results, (r) => r.bodyType.measurements.torsoLength),
      inseam: this.avg(results, (r) => r.bodyType.measurements.inseam),
    };

    const avgProportions = {
      shoulderToWaistRatio: this.avg(results, (r) => r.bodyType.proportions.shoulderToWaistRatio),
      waistToHipRatio: this.avg(results, (r) => r.bodyType.proportions.waistToHipRatio),
      shoulderToHipRatio: this.avg(results, (r) => r.bodyType.proportions.shoulderToHipRatio),
      headToBodyRatio: this.avg(results, (r) => r.bodyType.proportions.headToBodyRatio),
      armToTorsoRatio: this.avg(results, (r) => r.bodyType.proportions.armToTorsoRatio),
      legToTorsoRatio: this.avg(results, (r) => r.bodyType.proportions.legToTorsoRatio),
    };

    return {
      type: dominantType as BodyTypeReport["type"],
      subtype: results[0]?.bodyType.subtype ?? "N/A",
      measurements: avgMeasurements,
      proportions: avgProportions,
      summary: `Video analysis over ${results.length} frames. Dominant body type: ${dominantType}.`,
    };
  }

  private avg<T>(arr: T[], fn: (item: T) => number): number {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, item) => sum + fn(item), 0) / arr.length;
  }
}
