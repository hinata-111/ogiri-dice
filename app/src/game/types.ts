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
  position: number; // 現在マスindex
  money: number;
  goalOrder: number | null; // ゴール到達順(0始まり)。未到達はnull
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
