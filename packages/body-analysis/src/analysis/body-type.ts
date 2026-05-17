import type { Keypoint } from "../pose/detector.js";

export interface BodyTypeReport {
  type: BodyType;
  subtype: string;
  measurements: BodyMeasurements;
  proportions: BodyProportions;
  summary: string;
}

export type BodyType = "inverted_triangle" | "rectangle" | "pear" | "hourglass" | "apple" | "unknown";

export interface BodyMeasurements {
  shoulderWidth: number;
  hipWidth: number;
  estimatedWaistWidth: number;
  torsoLength: number;
  inseam: number;
}

export interface BodyProportions {
  shoulderToWaistRatio: number;
  waistToHipRatio: number;
  shoulderToHipRatio: number;
  headToBodyRatio: number;
  armToTorsoRatio: number;
  legToTorsoRatio: number;
}

export class BodyTypeAnalyzer {
  analyze(keypoints: Keypoint[]): BodyTypeReport {
    const kp = this.normalize(keypoints);
    if (!kp) {
      return {
        type: "unknown",
        subtype: "N/A",
        measurements: this.emptyMeasurements(),
        proportions: this.emptyProportions(),
        summary: "Insufficient keypoint data for body type analysis. Full body front view needed.",
      };
    }

    const measurements = this.calculateMeasurements(kp);
    const proportions = this.calculateProportions(measurements, kp);
    const { type, subtype } = this.classifyBodyType(proportions);

    return {
      type,
      subtype,
      measurements,
      proportions,
      summary: this.generateSummary(type, subtype, proportions),
    };
  }

  private normalize(keypoints: Keypoint[]): Record<string, Keypoint> | null {
    const map: Record<string, Keypoint> = {};
    for (const kp of keypoints) {
      map[kp.name] = kp;
    }

    if (!map.left_shoulder || !map.right_shoulder || !map.left_hip || !map.right_hip) return null;
    if (map.left_shoulder.score < 0.3 || map.right_shoulder.score < 0.3) return null;

    return map;
  }

  private calculateMeasurements(kp: Record<string, Keypoint>): BodyMeasurements {
    const shoulderWidth = Math.abs(kp.left_shoulder.x - kp.right_shoulder.x);
    const hipWidth = Math.abs(kp.left_hip.x - kp.right_hip.x);

    const waistX = (kp.left_hip.x + kp.right_hip.x) / 2;
    const waistY = (kp.left_shoulder.y + kp.right_shoulder.y + kp.left_hip.y + kp.right_hip.y) / 4;
    const estimatedWaistWidth = hipWidth * 0.82;

    const shoulderMidY = (kp.left_shoulder.y + kp.right_shoulder.y) / 2;
    const hipMidY = (kp.left_hip.y + kp.right_hip.y) / 2;
    const torsoLength = Math.abs(hipMidY - shoulderMidY);

    let inseam = 0;
    if (kp.left_knee && kp.right_knee && kp.left_ankle && kp.right_ankle) {
      const kneeMidY = (kp.left_knee.y + kp.right_knee.y) / 2;
      const ankleMidY = (kp.left_ankle.y + kp.right_ankle.y) / 2;
      inseam = Math.abs(ankleMidY - kneeMidY) * 2;
    }

    return { shoulderWidth, hipWidth, estimatedWaistWidth, torsoLength, inseam };
  }

  private calculateProportions(m: BodyMeasurements, kp: Record<string, Keypoint>): BodyProportions {
    const shoulderToWaistRatio = m.shoulderWidth / Math.max(m.estimatedWaistWidth, 1);
    const waistToHipRatio = m.estimatedWaistWidth / Math.max(m.hipWidth, 1);
    const shoulderToHipRatio = m.shoulderWidth / Math.max(m.hipWidth, 1);

    let headToBodyRatio = 7.5;
    if (kp.nose && kp.left_ankle && kp.right_ankle) {
      const headTopY = kp.nose.y - (kp.left_ear?.y ?? kp.nose.y - 30);
      const ankleY = (kp.left_ankle.y + kp.right_ankle.y) / 2;
      const bodyHeight = Math.abs(ankleY - headTopY);
      const headSize = Math.abs(kp.nose.y - headTopY) * 2;
      if (headSize > 0 && bodyHeight > 0) {
        headToBodyRatio = bodyHeight / headSize;
      }
    }

    let armToTorsoRatio = 0.8;
    if (kp.left_shoulder && kp.left_elbow && kp.left_wrist) {
      const upperArm = this.distance(kp.left_shoulder, kp.left_elbow);
      const forearm = this.distance(kp.left_elbow, kp.left_wrist);
      const armLength = upperArm + forearm;
      if (m.torsoLength > 0) armToTorsoRatio = armLength / m.torsoLength;
    }

    let legToTorsoRatio = 1.2;
    if (m.torsoLength > 0 && m.inseam > 0) {
      legToTorsoRatio = m.inseam / m.torsoLength;
    }

    return { shoulderToWaistRatio, waistToHipRatio, shoulderToHipRatio, headToBodyRatio, armToTorsoRatio, legToTorsoRatio };
  }

  private distance(a: Keypoint, b: Keypoint): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  private classifyBodyType(p: BodyProportions): { type: BodyType; subtype: string } {
    const shw = p.shoulderToWaistRatio;
    const whr = p.waistToHipRatio;
    const srh = p.shoulderToHipRatio;

    if (shw > 1.15 && srh > 1.05) {
      return { type: "inverted_triangle", subtype: "Athletic" };
    }

    if (shw < 0.95 && whr > 0.95) {
      return { type: "pear", subtype: "Bottom-heavy" };
    }

    if (shw > 1.05 && whr < 0.9) {
      return { type: "hourglass", subtype: "Balanced curves" };
    }

    if (Math.abs(shw - 1) < 0.1 && Math.abs(srh - 1) < 0.1) {
      return { type: "rectangle", subtype: "Straight/athletic" };
    }

    if (whr > 0.95 && shw < 1.05) {
      return { type: "apple", subtype: "Central" };
    }

    return { type: "rectangle", subtype: "Average proportions" };
  }

  private generateSummary(type: BodyType, subtype: string, p: BodyProportions): string {
    const typeNames: Record<BodyType, string> = {
      inverted_triangle: "倒三角型",
      rectangle: "矩型",
      pear: "梨型",
      hourglass: "沙漏型",
      apple: "苹果型",
      unknown: "未知",
    };

    const parts: string[] = [];
    parts.push(`Body Type: ${typeNames[type]} (${subtype}).`);

    if (p.shoulderToWaistRatio > 1.15) parts.push("Shoulders are notably wider than waist.");
    if (p.waistToHipRatio > 0.92) parts.push("Waist-to-hip ratio is above average.");
    if (p.headToBodyRatio < 7) parts.push("Slightly larger head-to-body proportion.");
    if (p.headToBodyRatio > 8) parts.push("Taller-than-average head-to-body proportion.");

    if (p.legToTorsoRatio > 1.3) parts.push("Longer legs relative to torso.");
    if (p.legToTorsoRatio < 1.05) parts.push("Shorter legs relative to torso.");

    return parts.join(" ");
  }

  private emptyMeasurements(): BodyMeasurements {
    return { shoulderWidth: 0, hipWidth: 0, estimatedWaistWidth: 0, torsoLength: 0, inseam: 0 };
  }

  private emptyProportions(): BodyProportions {
    return { shoulderToWaistRatio: 0, waistToHipRatio: 0, shoulderToHipRatio: 0, headToBodyRatio: 0, armToTorsoRatio: 0, legToTorsoRatio: 0 };
  }
}
