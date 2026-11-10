import { moveOptions, type NodeMap } from '../../game/graph';

/** Display-only preview. Use the same per-step constraints as the reducer. */
export function reachableCells(graph: NodeMap, from: string, cameFrom: string | null, remaining: number, destination: string | null) {
  const cells = new Set<string>();
  const visited = new Set<string>();
  const walk = (at: string, previous: string | null, steps: number) => {
    if (steps <= 0) return;
    const key = JSON.stringify([at, previous, steps]);
    if (visited.has(key)) return;
    visited.add(key);
    for (const next of moveOptions(graph, at, previous)) {
      cells.add(next);
      if (next !== destination) walk(next, at, steps - 1);
    }
  };
  walk(from, cameFrom, remaining);
  return cells;
}
