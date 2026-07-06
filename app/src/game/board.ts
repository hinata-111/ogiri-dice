import type { BoardCell } from "./types";

export function moveTo(position: number, steps: number, boardSize: number): number {
  return Math.min(position + steps, boardSize - 1);
}

export function isGoal(position: number, boardSize: number): boolean {
  return position === boardSize - 1;
}

export function cellEffectDelta(cell: BoardCell): number {
  if (cell.type === "blue") return cell.amount;
  if (cell.type === "red") return -cell.amount;
  return 0;
}
