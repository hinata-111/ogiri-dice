import { useEffect } from "react";
import type { MapNode } from "../game/types";

interface Props {
  options: string[]; // 移動先候補ノードid
  nodes: Map<string, MapNode>;
  currentId: string;
  remaining: number;
  onStep: (nodeId: string) => void;
}

/** 相対方位から矢印記号を決める */
function arrowFor(dx: number, dy: number): string {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "→" : "←";
  return dy > 0 ? "↓" : "↑";
}

const KEY_TO_DIR: Record<string, [number, number]> = {
  ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1],
};

export function MoveControls({ options, nodes, currentId, remaining, onStep }: Props) {
  const cur = nodes.get(currentId)!;
  const candidates = options.map((id) => {
    const n = nodes.get(id)!;
    return { id, node: n, dx: n.x - cur.x, dy: n.y - cur.y };
  });

  // 矢印キー: 方向ベクトルの内積が最大の候補へ
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      let best: string | null = null;
      let bestDot = 0;
      for (const c of candidates) {
        const len = Math.hypot(c.dx, c.dy) || 1;
        const dot = (c.dx / len) * dir[0] + (c.dy / len) * dir[1];
        if (dot > bestDot) { bestDot = dot; best = c.id; }
      }
      if (best) onStep(best);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [candidates, onStep]);

  return (
    <>
      <div className="move-remaining">あと {remaining} マス</div>
      <div className="move-controls">
        {candidates.map((c) => (
          <button key={c.id} onClick={() => onStep(c.id)}>
            {arrowFor(c.dx, c.dy)} {c.node.name || "すすむ"}
          </button>
        ))}
      </div>
    </>
  );
}
