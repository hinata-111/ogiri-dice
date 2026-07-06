import type { EvaluationResult, Player } from "./types";

export const PRIZE_PER_SCORE = 20000;
export const GOAL_PRIZES = [300000, 200000, 100000, 50000];
export const ANSWER_TIME_LIMIT_MS = 60000;
export const BEST_ANSWER_MIN_SCORE = 5;

export const TIME_UP_RESULT: EvaluationResult = { score: 1, comment: "時間切れ！" };

export function answerPrize(score: number): number {
  return score * PRIZE_PER_SCORE;
}

export function goalPrize(goalOrder: number): number {
  return GOAL_PRIZES[goalOrder] ?? GOAL_PRIZES[GOAL_PRIZES.length - 1];
}

export function applyMoney(money: number, delta: number): number {
  return Math.max(0, money + delta);
}

export function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.money - a.money);
}
