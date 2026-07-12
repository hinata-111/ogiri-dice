export type CellType = "normal" | "blue" | "red" | "event";

export interface BoardCell {
  index: number;
  type: CellType;
  amount: number; // 賞金増減額(正の値)。normal/eventは0
  x: number; // SVG viewBox座標
  y: number;
}

export type Difficulty = "Easy" | "Normal" | "Hard";

export interface Topic {
  id: string;
  category: string;
  prompt: string;
  difficulty: Difficulty;
}

export type PlayerKind = "human" | "cpu";
export type CpuPersonality = "safe" | "bold";

export interface PlayerConfig {
  name: string;
  kind: PlayerKind;
  personality?: CpuPersonality;
}

export interface Player {
  id: number;
  name: string;
  kind: PlayerKind;
  personality?: CpuPersonality;
  position: string; // 現在ノードid
  money: number;
  arrivals: number; // 目的地到着回数
}

export interface EvaluationResult {
  score: number; // 1-6
  comment: string;
  fallback?: boolean; // 評価失敗フォールバック値のときtrue
}

export interface BestAnswer {
  playerName: string;
  topicPrompt: string;
  answer: string;
  score: number;
  comment: string;
}

// --- v2: 東京マップ ---
export type NodeKind = "theater" | "tv" | "station" | "stop";
export type CellKind = "normal" | "blue" | "red";

export interface MapNode {
  id: string;
  name: string; // 中間マスは""
  kind: NodeKind;
  cell: CellKind; // 拠点はnormal
  x: number;
  y: number;
  neighbors: string[];
}
