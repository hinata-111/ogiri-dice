import { useEffect, useState } from "react";
import type { BoardCell, Player } from "../game/types";
import { MOVE_STEP_MS } from "../ui/constants";

const VIEW_W = 880;
const VIEW_H = 700;
const CELL_R = 34;
const PIECE_COLORS = ["#ffcb3d", "#ff5d8f", "#4dabf7", "#69db7c"];
const CELL_FILL: Record<BoardCell["type"], string> = {
  normal: "rgba(255,255,255,0.16)",
  blue: "#2b6cb0",
  red: "#c0392b",
  event: "#8e44ad",
};

interface Props {
  board: BoardCell[];
  players: Player[];
  currentPlayerIndex: number;
  movingFrom: number | null; // movingフェーズ中は移動元index、それ以外null
}

/** movingFromが与えられたら1マスずつtargetへ進む表示上の位置を返す */
function useAnimatedPosition(target: number, movingFrom: number | null): number {
  const [display, setDisplay] = useState(target);
  useEffect(() => {
    if (movingFrom === null) {
      setDisplay(target);
      return;
    }
    setDisplay(movingFrom);
    let pos = movingFrom;
    const timer = setInterval(() => {
      pos += 1;
      setDisplay(pos);
      if (pos >= target) clearInterval(timer);
    }, MOVE_STEP_MS);
    return () => clearInterval(timer);
  }, [target, movingFrom]);
  return display;
}

export function BoardView({ board, players, currentPlayerIndex, movingFrom }: Props) {
  const current = players[currentPlayerIndex];
  const animatedPos = useAnimatedPosition(current?.position ?? 0, movingFrom);

  if (board.length === 0 || !current) return <svg className="board-svg" />;

  const focus = board[Math.min(animatedPos, board.length - 1)];
  const camX = VIEW_W / 2 - focus.x;
  const camY = VIEW_H / 2 - focus.y;

  return (
    <svg className="board-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice">
      <g className="board-camera" style={{ transform: `translate(${camX}px, ${camY}px)` }}>
        {/* マスをつなぐ道 */}
        <polyline
          points={board.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={14}
          strokeLinejoin="round"
        />
        {/* マス */}
        {board.map((cell) => (
          <g key={cell.index}>
            <circle cx={cell.x} cy={cell.y} r={CELL_R} fill={CELL_FILL[cell.type]}
              stroke="rgba(255,255,255,0.4)" strokeWidth={2} />
            <text className="cell-label" x={cell.x} y={cell.y + 7}>
              {cell.index === 0 ? "🏠" : cell.index === board.length - 1 ? "🎭" : cell.index}
            </text>
          </g>
        ))}
        {/* コマ(同マス重なりは横にずらす) */}
        {players.map((p, i) => {
          const pos = i === currentPlayerIndex ? animatedPos : p.position;
          const cell = board[Math.min(pos, board.length - 1)];
          const dx = (i - (players.length - 1) / 2) * 18;
          return (
            <g key={p.id} className="piece"
              style={{ transform: `translate(${cell.x + dx}px, ${cell.y - CELL_R - 12}px)` }}>
              <circle r={13} fill={PIECE_COLORS[i % PIECE_COLORS.length]}
                stroke="#fff" strokeWidth={2} />
              <text y={5} textAnchor="middle" fontSize={12} fill="#222" fontWeight={700}>
                {p.name.slice(0, 1)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
