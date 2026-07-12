import type { EvaluationResult, Player } from "./types";

export const ANSWER_TIME_LIMIT_MS = 15000;
export const INITIAL_MONEY = 100000;
export const ARRIVAL_PRIZE = 300000;
export const CHALLENGE_UNIT = 30000;
export const WIN_MONEY = 1000000;
export const MAX_ROUNDS = 30;
export const BEST_ANSWER_MIN_SCORE = 5;

export const TIME_UP_RESULT: EvaluationResult = { score: 1, comment: "時間切れ！" };

/** 青マス: スコアに応じた獲得額 */
export function blueGain(score: number): number {
  return score * CHALLENGE_UNIT;
}

/** 赤マス: 目標値未達分の損失額(達成時0) */
export function redLoss(target: number, score: number): number {
  return Math.max(0, target - score) * CHALLENGE_UNIT;
}

export function applyMoney(money: number, delta: number): number {
  return Math.max(0, money + delta);
}

/** 所持金降順、同額なら到着回数降順 */
export function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.money - a.money || b.arrivals - a.arrivals);
}
