import type { Keypoint } from "../pose/detector.js";

export interface PostureReport {
  overallScore: number;
  deviations: PostureDeviation[];
  angles: PostureAngles;
  summary: string;
}

export interface PostureDeviation {
  name: string;
  severity: "mild" | "moderate" | "severe";
  angle: number;
  normalRange: string;
  description: string;
  recommendation: string;
}

export interface PostureAngles {
  headTilt: number;
  shoulderAlignment: number;
  hipAlignment: number;
  kneeAngle: number;
  pelvicTilt: number;
  spinalAlignment: number;
}

export class PostureAnalyzer {
  analyze(keypoints: Keypoint[]): PostureReport {
    const kp = this.normalize(keypoints);
    if (!kp) {
      return {
        overallScore: 0,
        deviations: [],
        angles: { headTilt: 0, shoulderAlignment: 0, hipAlignment: 0, kneeAngle: 0, pelvicTilt: 0, spinalAlignment: 0 },
        summary: "Unable to detect keypoints. Make sure the full body is visible in the image.",
      };
    }

    const angles = this.calculateAngles(kp);
    const deviations = this.assessDeviations(angles, kp);
    const overallScore = this.calculateOverallScore(deviations);

    return {
      overallScore,
      deviations,
      angles,
      summary: this.generateSummary(deviations, overallScore),
    };
  }

  private normalize(keypoints: Keypoint[]): Record<string, Keypoint> | null {
    const map: Record<string, Keypoint> = {};
    for (const kp of keypoints) {
      map[kp.name] = kp;
    }

    const required = ["left_shoulder", "right_shoulder", "left_hip", "right_hip"];
    for (const name of required) {
      if (!map[name] || map[name].score < 0.3) return null;
    }

    return map;
  }

  private calculateAngles(kp: Record<string, Keypoint>): PostureAngles {
    return {
      headTilt: this.angleBetween(
        kp.left_ear, kp.right_ear,
        kp.left_shoulder, kp.right_shoulder,
      ),
      shoulderAlignment: this.horizontalDifference(kp.left_shoulder, kp.right_shoulder),
      hipAlignment: this.horizontalDifference(kp.left_hip, kp.right_hip),
      kneeAngle: this.computeKneeAlignment(kp),
      pelvicTilt: this.computePelvicTilt(kp),
      spinalAlignment: this.computeSpinalAlignment(kp),
    };
  }

  private angleBetween(a: Keypoint, b: Keypoint, c: Keypoint, d: Keypoint): number {
    const line1Angle = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
    const line2Angle = Math.atan2(d.y - c.y, d.x - c.x) * (180 / Math.PI);
    return Math.abs(line1Angle - line2Angle);
  }

  private horizontalDifference(left: Keypoint, right: Keypoint): number {
    return Math.abs(left.y - right.y);
  }

  private computeKneeAlignment(kp: Record<string, Keypoint>): number {
    if (!kp.left_knee || !kp.right_knee || !kp.left_ankle || !kp.right_ankle) return 0;

    const leftAngle = this.angleBetween(
      kp.left_hip, kp.left_knee,
      kp.left_knee, kp.left_ankle,
    );
    const rightAngle = this.angleBetween(
      kp.right_hip, kp.right_knee,
      kp.right_knee, kp.right_ankle,
    );

    return Math.abs(leftAngle - rightAngle);
  }

  private computePelvicTilt(kp: Record<string, Keypoint>): number {
    if (!kp.left_shoulder || !kp.left_hip) return 0;

    const dx = kp.left_hip.x - kp.left_shoulder.x;
    const dy = kp.left_hip.y - kp.left_shoulder.y;
    return Math.atan2(dx, dy) * (180 / Math.PI);
  }

  private computeSpinalAlignment(kp: Record<string, Keypoint>): number {
    const shoulderMidX = (kp.left_shoulder.x + kp.right_shoulder.x) / 2;
    const hipMidX = (kp.left_hip.x + kp.right_hip.x) / 2;

    const shoulderMidY = (kp.left_shoulder.y + kp.right_shoulder.y) / 2;
    const hipMidY = (kp.left_hip.y + kp.right_hip.y) / 2;

    const dx = hipMidX - shoulderMidX;
    const dy = hipMidY - shoulderMidY;
    return Math.abs(Math.atan2(dx, dy) * (180 / Math.PI));
  }

  private assessDeviations(angles: PostureAngles, kp: Record<string, Keypoint>): PostureDeviation[] {
    const deviations: PostureDeviation[] = [];

    if (angles.headTilt > 5) {
      deviations.push({
        name: "Head Tilt (头颈倾斜)",
        severity: angles.headTilt > 15 ? "severe" : angles.headTilt > 10 ? "moderate" : "mild",
        angle: Math.round(angles.headTilt),
        normalRange: "0-5°",
        description: "Head is tilted relative to shoulders, indicating potential neck muscle imbalance.",
        recommendation: "Practice chin tucks, neck stretches. Consider ergonomic adjustments to screen height.",
      });
    }

    if (angles.shoulderAlignment > 10) {
      deviations.push({
        name: "Uneven Shoulders (高低肩)",
        severity: angles.shoulderAlignment > 30 ? "severe" : angles.shoulderAlignment > 20 ? "moderate" : "mild",
        angle: Math.round(angles.shoulderAlignment),
        normalRange: "0-10px",
        description: "One shoulder is higher than the other, suggesting muscle imbalance or scoliosis.",
        recommendation: "Shoulder shrugs, lateral raises, and posture awareness training.",
      });
    }

    if (angles.hipAlignment > 10) {
      deviations.push({
        name: "Uneven Hips (骨盆倾斜)",
        severity: angles.hipAlignment > 30 ? "severe" : angles.hipAlignment > 20 ? "moderate" : "mild",
        angle: Math.round(angles.hipAlignment),
        normalRange: "0-10px",
        description: "One hip is higher than the other, potentially indicating leg length discrepancy or scoliosis.",
        recommendation: "Core strengthening exercises, hip mobility work. Consult a physical therapist if persistent.",
      });
    }

    if (angles.pelvicTilt > 10) {
      deviations.push({
        name: "Anterior Pelvic Tilt (骨盆前倾)",
        severity: angles.pelvicTilt > 20 ? "severe" : angles.pelvicTilt > 15 ? "moderate" : "mild",
        angle: Math.round(angles.pelvicTilt),
        normalRange: "0-10°",
        description: "Pelvis is tilted forward, causing increased lumbar curve. Often from prolonged sitting.",
        recommendation: "Hip flexor stretches, glute bridges, plank exercises. Strengthen core and glutes.",
      });
    }

    if (angles.pelvicTilt < -10) {
      deviations.push({
        name: "Posterior Pelvic Tilt (骨盆后倾)",
        severity: angles.pelvicTilt < -20 ? "severe" : angles.pelvicTilt < -15 ? "moderate" : "mild",
        angle: Math.round(Math.abs(angles.pelvicTilt)),
        normalRange: "-10 to 10°",
        description: "Pelvis is tilted backward, flattening the lumbar spine. Often from slouching.",
        recommendation: "Lower back stretches, hamstring stretches, and thoracic spine mobility exercises.",
      });
    }

    if (angles.spinalAlignment > 5) {
      deviations.push({
        name: "Spinal Deviation (脊柱侧弯迹象)",
        severity: angles.spinalAlignment > 15 ? "severe" : angles.spinalAlignment > 10 ? "moderate" : "mild",
        angle: Math.round(angles.spinalAlignment),
        normalRange: "0-5°",
        description: "Shoulder-hip midline shows lateral deviation, warranting scoliosis screening.",
        recommendation: "Consult a medical professional for proper scoliosis assessment. Core strengthening exercises.",
      });
    }

    if (angles.kneeAngle > 10) {
      deviations.push({
        name: "Knee Misalignment (膝关节不对齐)",
        severity: angles.kneeAngle > 25 ? "severe" : angles.kneeAngle > 15 ? "moderate" : "mild",
        angle: Math.round(angles.kneeAngle),
        normalRange: "0-10°",
        description: "Knee angles are asymmetrical, possibly indicating valgus or varus alignment.",
        recommendation: "Quad and hamstring strengthening, proper footwear assessment, gait analysis if persistent.",
      });
    }

    const leftShoulder = kp.left_shoulder;
    const leftEar = kp.left_ear;
    if (leftShoulder && leftEar && leftEar.score > 0.3) {
      const forwardHead = leftEar.x - leftShoulder.x;
      if (Math.abs(forwardHead) > 30) {
        deviations.push({
          name: "Forward Head Posture (头前倾)",
          severity: Math.abs(forwardHead) > 60 ? "severe" : Math.abs(forwardHead) > 45 ? "moderate" : "mild",
          angle: Math.round(Math.abs(forwardHead)),
          normalRange: "0-30px",
          description: "Head positioned forward of shoulders, common from prolonged screen use.",
          recommendation: "Chin tucks, upper back strengthening, monitor/screen height adjustment.",
        });
      }
    }

    return deviations;
  }

  private calculateOverallScore(deviations: PostureDeviation[]): number {
    if (deviations.length === 0) return 95;

    let deductions = 0;
    for (const d of deviations) {
      deductions += d.severity === "severe" ? 20 : d.severity === "moderate" ? 12 : 6;
    }

    return Math.max(5, 100 - deductions);
  }

  private generateSummary(deviations: PostureDeviation[], score: number): string {
    if (deviations.length === 0) {
      return "Posture appears well-aligned with no significant deviations detected.";
    }

    const severe = deviations.filter((d) => d.severity === "severe");
    const moderate = deviations.filter((d) => d.severity === "moderate");
    const mild = deviations.filter((d) => d.severity === "mild");

    const parts: string[] = [];
    parts.push(`Overall Posture Score: ${score}/100.`);

    if (severe.length > 0) {
      parts.push(`${severe.length} severe deviation(s) detected: ${severe.map((d) => d.name).join(", ")}.`);
    }
    if (moderate.length > 0) {
      parts.push(`${moderate.length} moderate deviation(s): ${moderate.map((d) => d.name).join(", ")}.`);
    }
    if (mild.length > 0) {
      parts.push(`${mild.length} mild deviation(s): ${mild.map((d) => d.name).join(", ")}.`);
    }

    if (score < 60) {
      parts.push("Professional physical therapy consultation is recommended.");
    } else if (score < 80) {
      parts.push("Targeted corrective exercises are recommended to address the deviations above.");
    }

    return parts.join(" ");
  }
}
