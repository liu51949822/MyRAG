import * as poseDetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs-node";
import sharp from "sharp";
import fs from "node:fs/promises";

export interface Keypoint {
  x: number;
  y: number;
  score: number;
  name: string;
}

export interface PoseResult {
  keypoints: Keypoint[];
  score: number;
  imageWidth: number;
  imageHeight: number;
}

const KEYPOINT_NAMES: Record<number, string> = {
  0: "nose",
  1: "left_eye",
  2: "right_eye",
  3: "left_ear",
  4: "right_ear",
  5: "left_shoulder",
  6: "right_shoulder",
  7: "left_elbow",
  8: "right_elbow",
  9: "left_wrist",
  10: "right_wrist",
  11: "left_hip",
  12: "right_hip",
  13: "left_knee",
  14: "right_knee",
  15: "left_ankle",
  16: "right_ankle",
};

export class PoseDetector {
  private detector: poseDetection.PoseDetector | null = null;
  private modelType: poseDetection.SupportedModels;

  constructor(modelType: poseDetection.SupportedModels = poseDetection.SupportedModels.MoveNet) {
    this.modelType = modelType;
  }

  async initialize(): Promise<void> {
    if (this.detector) return;

    await tf.ready();

    this.detector = await poseDetection.createDetector(this.modelType, {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    } as poseDetection.MoveNetModelConfig);
  }

  async detectFromFile(imagePath: string): Promise<PoseResult | null> {
    await this.initialize();

    const buffer = await fs.readFile(imagePath);
    const metadata = await sharp(buffer).metadata();

    const rgbBuffer = await sharp(buffer)
      .ensureAlpha()
      .removeAlpha()
      .raw()
      .toBuffer();

    const height = metadata.height ?? 480;
    const width = metadata.width ?? 640;

    const tensor = tf.tensor3d(rgbBuffer, [height, width, 3], "int32");

    const imageInput = tensor as unknown as tf.Tensor3D;
    const poses = await this.detector!.estimatePoses(imageInput);
    tensor.dispose();

    if (poses.length === 0) return null;

    const pose = poses[0];
    const keypoints: Keypoint[] = pose.keypoints.map((kp: { x: number; y: number; score?: number }, i: number) => ({
      x: kp.x,
      y: kp.y,
      score: kp.score ?? 0,
      name: KEYPOINT_NAMES[i] ?? `kp_${i}`,
    }));

    return {
      keypoints,
      score: pose.score ?? 0,
      imageWidth: width,
      imageHeight: height,
    };
  }

  async detectFromBuffer(buffer: Buffer): Promise<PoseResult | null> {
    await this.initialize();

    const metadata = await sharp(buffer).metadata();
    const rgbBuffer = await sharp(buffer)
      .ensureAlpha()
      .removeAlpha()
      .raw()
      .toBuffer();

    const height = metadata.height ?? 480;
    const width = metadata.width ?? 640;

    const tensor = tf.tensor3d(rgbBuffer, [height, width, 3], "int32");
    const imageInput = tensor as unknown as tf.Tensor3D;
    const poses = await this.detector!.estimatePoses(imageInput);
    tensor.dispose();

    if (poses.length === 0) return null;

    const pose = poses[0];
    const keypoints: Keypoint[] = pose.keypoints.map((kp: { x: number; y: number; score?: number }, i: number) => ({
      x: kp.x,
      y: kp.y,
      score: kp.score ?? 0,
      name: KEYPOINT_NAMES[i] ?? `kp_${i}`,
    }));

    return {
      keypoints,
      score: pose.score ?? 0,
      imageWidth: width,
      imageHeight: height,
    };
  }

  async dispose(): Promise<void> {
    this.detector?.dispose();
    this.detector = null;
  }
}
