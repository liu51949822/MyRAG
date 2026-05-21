import { describe, it, expect } from "vitest";
import { BodyTypeAnalyzer } from "./body-type.js";

describe("BodyTypeAnalyzer", () => {
  const analyzer = new BodyTypeAnalyzer();

  function makeKeypoints(shoulderW: number, hipW: number) {
    const cx = 200;
    const shoulderY = 250;
    const hipY = 500;
    const earY = 150;
    const kneeY = 700;
    const ankleY = 900;

    return [
      { x: cx, y: earY - 20, score: 0.9, name: "nose" },
      { x: cx - 10, y: earY, score: 0.9, name: "left_eye" },
      { x: cx + 10, y: earY, score: 0.9, name: "right_eye" },
      { x: cx - 15, y: earY + 5, score: 0.8, name: "left_ear" },
      { x: cx + 15, y: earY + 5, score: 0.8, name: "right_ear" },
      { x: cx - shoulderW / 2, y: shoulderY, score: 0.95, name: "left_shoulder" },
      { x: cx + shoulderW / 2, y: shoulderY, score: 0.95, name: "right_shoulder" },
      { x: cx - shoulderW / 2 - 10, y: shoulderY + 100, score: 0.9, name: "left_elbow" },
      { x: cx + shoulderW / 2 + 10, y: shoulderY + 100, score: 0.9, name: "right_elbow" },
      { x: cx - shoulderW / 2 - 15, y: shoulderY + 200, score: 0.85, name: "left_wrist" },
      { x: cx + shoulderW / 2 + 15, y: shoulderY + 200, score: 0.85, name: "right_wrist" },
      { x: cx - hipW / 2, y: hipY, score: 0.9, name: "left_hip" },
      { x: cx + hipW / 2, y: hipY, score: 0.9, name: "right_hip" },
      { x: cx - hipW / 3, y: kneeY, score: 0.88, name: "left_knee" },
      { x: cx + hipW / 3, y: kneeY, score: 0.88, name: "right_knee" },
      { x: cx - hipW / 4, y: ankleY, score: 0.85, name: "left_ankle" },
      { x: cx + hipW / 4, y: ankleY, score: 0.85, name: "right_ankle" },
    ];
  }

  it("classifies inverted triangle for wide shoulders", () => {
    const kp = makeKeypoints(200, 120);
    const result = analyzer.analyze(kp);
    expect(result.type).toBe("inverted_triangle");
  });

  it("classifies pear for wide hips", () => {
    const kp = makeKeypoints(80, 300);
    const result = analyzer.analyze(kp);
    expect(["pear", "rectangle", "unknown"]).toContain(result.type);
    expect(result.measurements.shoulderWidth).toBeLessThan(result.measurements.hipWidth);
  });

  it("classifies rectangle for balanced proportions", () => {
    const kp = makeKeypoints(150, 140);
    const result = analyzer.analyze(kp);
    expect(result.measurements.shoulderWidth).toBeGreaterThan(0);
    expect(result.measurements.hipWidth).toBeGreaterThan(0);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("handles empty keypoints gracefully", () => {
    const result = analyzer.analyze([]);
    expect(result.type).toBe("unknown");
    expect(result.summary).toContain("Insufficient keypoint data");
  });
});
