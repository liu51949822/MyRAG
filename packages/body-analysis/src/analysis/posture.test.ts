import { describe, it, expect } from "vitest";
import { PostureAnalyzer } from "./posture.js";

describe("PostureAnalyzer", () => {
  const analyzer = new PostureAnalyzer();

  it("returns a valid PostureReport", () => {
    const keypoints = [
      { x: 100, y: 100, score: 0.9, name: "nose" },
      { x: 95, y: 90, score: 0.9, name: "left_eye" },
      { x: 105, y: 90, score: 0.9, name: "right_eye" },
      { x: 90, y: 95, score: 0.8, name: "left_ear" },
      { x: 110, y: 95, score: 0.8, name: "right_ear" },
      { x: 80, y: 200, score: 0.95, name: "left_shoulder" },
      { x: 120, y: 200, score: 0.95, name: "right_shoulder" },
      { x: 70, y: 300, score: 0.9, name: "left_elbow" },
      { x: 130, y: 300, score: 0.9, name: "right_elbow" },
      { x: 65, y: 380, score: 0.85, name: "left_wrist" },
      { x: 135, y: 380, score: 0.85, name: "right_wrist" },
      { x: 85, y: 400, score: 0.9, name: "left_hip" },
      { x: 115, y: 400, score: 0.9, name: "right_hip" },
      { x: 80, y: 550, score: 0.88, name: "left_knee" },
      { x: 120, y: 550, score: 0.88, name: "right_knee" },
      { x: 78, y: 700, score: 0.85, name: "left_ankle" },
      { x: 122, y: 700, score: 0.85, name: "right_ankle" },
    ];

    const report = analyzer.analyze(keypoints);

    expect(report).toBeDefined();
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.deviations).toBeDefined();
    expect(report.angles).toBeDefined();
    expect(report.summary.length).toBeGreaterThan(0);
  });

  it("detects forward head posture", () => {
    const keypoints = [
      { x: 100, y: 100, score: 0.9, name: "nose" },
      { x: 95, y: 90, score: 0.9, name: "left_eye" },
      { x: 105, y: 90, score: 0.9, name: "right_eye" },
      { x: 60, y: 95, score: 0.9, name: "left_ear" },
      { x: 140, y: 95, score: 0.9, name: "right_ear" },
      { x: 100, y: 200, score: 0.95, name: "left_shoulder" },
      { x: 100, y: 200, score: 0.95, name: "right_shoulder" },
      { x: 90, y: 300, score: 0.9, name: "left_elbow" },
      { x: 110, y: 300, score: 0.9, name: "right_elbow" },
      { x: 85, y: 380, score: 0.85, name: "left_wrist" },
      { x: 115, y: 380, score: 0.85, name: "right_wrist" },
      { x: 100, y: 400, score: 0.9, name: "left_hip" },
      { x: 100, y: 400, score: 0.9, name: "right_hip" },
      { x: 100, y: 550, score: 0.88, name: "left_knee" },
      { x: 100, y: 550, score: 0.88, name: "right_knee" },
      { x: 100, y: 700, score: 0.85, name: "left_ankle" },
      { x: 100, y: 700, score: 0.85, name: "right_ankle" },
    ];

    const report = analyzer.analyze(keypoints);
    const forwardHead = report.deviations.find(d => d.name.includes("Forward Head"));
    // With ear at x=60 (shoulders at x=100), the difference is > 30px threshold
    expect(forwardHead).toBeDefined();
    expect(forwardHead!.severity).toMatch(/mild|moderate|severe/);
  });

  it("returns low score for very poor posture", () => {
    // Very misaligned posture - head far forward, shoulders uneven, hips uneven
    const keypoints = [
      { x: 50, y: 100, score: 0.9, name: "nose" },
      { x: 45, y: 90, score: 0.9, name: "left_eye" },
      { x: 55, y: 90, score: 0.9, name: "right_eye" },
      { x: 20, y: 95, score: 0.9, name: "left_ear" },
      { x: 80, y: 95, score: 0.9, name: "right_ear" },
      { x: 100, y: 220, score: 0.95, name: "left_shoulder" },
      { x: 140, y: 180, score: 0.95, name: "right_shoulder" },
      { x: 70, y: 300, score: 0.9, name: "left_elbow" },
      { x: 130, y: 300, score: 0.9, name: "right_elbow" },
      { x: 65, y: 380, score: 0.85, name: "left_wrist" },
      { x: 135, y: 380, score: 0.85, name: "right_wrist" },
      { x: 80, y: 430, score: 0.9, name: "left_hip" },
      { x: 120, y: 410, score: 0.9, name: "right_hip" },
      { x: 80, y: 550, score: 0.88, name: "left_knee" },
      { x: 120, y: 550, score: 0.88, name: "right_knee" },
      { x: 78, y: 700, score: 0.85, name: "left_ankle" },
      { x: 122, y: 700, score: 0.85, name: "right_ankle" },
    ];

    const report = analyzer.analyze(keypoints);
    expect(report.overallScore).toBeLessThan(60);
    expect(report.deviations.length).toBeGreaterThanOrEqual(2);
  });

  it("returns high score for well-aligned posture", () => {
    const keypoints = [
      { x: 100, y: 100, score: 0.9, name: "nose" },
      { x: 96, y: 93, score: 0.9, name: "left_eye" },
      { x: 104, y: 93, score: 0.9, name: "right_eye" },
      { x: 93, y: 97, score: 0.8, name: "left_ear" },
      { x: 107, y: 97, score: 0.8, name: "right_ear" },
      { x: 90, y: 200, score: 0.95, name: "left_shoulder" },
      { x: 110, y: 200, score: 0.95, name: "right_shoulder" },
      { x: 82, y: 300, score: 0.9, name: "left_elbow" },
      { x: 118, y: 300, score: 0.9, name: "right_elbow" },
      { x: 80, y: 380, score: 0.85, name: "left_wrist" },
      { x: 120, y: 380, score: 0.85, name: "right_wrist" },
      { x: 92, y: 400, score: 0.9, name: "left_hip" },
      { x: 108, y: 400, score: 0.9, name: "right_hip" },
      { x: 92, y: 550, score: 0.88, name: "left_knee" },
      { x: 108, y: 550, score: 0.88, name: "right_knee" },
      { x: 92, y: 700, score: 0.85, name: "left_ankle" },
      { x: 108, y: 700, score: 0.85, name: "right_ankle" },
    ];

    const report = analyzer.analyze(keypoints);
    expect(report.overallScore).toBeGreaterThanOrEqual(80);
    expect(report.deviations.length).toBeLessThanOrEqual(1);
  });

  it("handles missing keypoints gracefully", () => {
    const result = analyzer.analyze([]);
    expect(result.overallScore).toBe(0);
    expect(result.deviations.length).toBe(0);
    expect(result.summary).toContain("Unable to detect");
  });
});
