# Dev Branch — 体态体型分析系统

## 概述

基于 MyRAG 架构的计算机视觉分析分支。通过照片/视频分析人体体态和体型。

## 技术架构

```
照片 / 视频
    │
    ▼
┌──────────────────────┐
│  Pose Detector       │  TensorFlow.js + MoveNet
│  → 17 关键点提取      │  (鼻/肩/肘/腕/髋/膝/踝...)
└────────┬─────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌─────────┐
│ Posture│ │Body Type│
│Analysis│ │Analysis │
│体态偏差 │ │体型分类  │
└───┬────┘ └────┬────┘
    │           │
    └─────┬─────┘
          ▼
┌──────────────────────┐
│  Report Generator    │
│  → 结构化分析报告      │
└──────────┬───────────┘
           │
           ▼
    PostgreSQL (body_analyses)
```

## 分析项目

### 体态分析 (Posture)
| 项目 | 检测方法 |
|------|----------|
| 头前倾 (Forward Head) | 耳-肩垂线夹角 |
| 圆肩 (Rounded Shoulders) | 肩峰相对位置 |
| 骨盆前倾 (Anterior Pelvic Tilt) | 髋-肩垂线偏差 |
| 脊柱侧弯 (Scoliosis) | 肩/髋水平差 |
| O/X 型腿 | 膝-踝连线角度 |
| 高低肩 | 左右肩高度差 |

### 体型分析 (Body Type)
| 项目 | 检测方法 |
|------|----------|
| 肩腰比 | 肩宽 / 腰宽 |
| 腰臀比 | 腰宽 / 臀宽 |
| 体型分类 | 倒三角 / 矩形 / 梨形 / 沙漏 |
| 身高比例 | 头身比估算 |
| 四肢比例 | 臂/腿相对长度 |

## 技术栈

| 层 | 选型 |
|----|------|
| 关键点检测 | @tensorflow/tfjs-node + @tensorflow-models/pose-detection (MoveNet) |
| 图像处理 | sharp |
| 视频处理 | ffmpeg (子进程调用) |
| 存储 | PostgreSQL (复用现有连接) |
| 报告生成 | LLM (复用现有 client) |
