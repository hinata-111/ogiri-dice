import { useMemo } from "react";
import { buildNodeMap } from "../game/graph";
import type { MapNode, Player } from "../game/types";

const VIEW_W = 1280;
const VIEW_H = 960;
const PIECE_COLORS = ["#ffcb3d", "#ff5d8f", "#4dabf7", "#69db7c"];
const TILE_FILL: Record<MapNode["cell"], string> = {
  normal: "rgba(255,255,255,0.18)",
  blue: "#2b6cb0",
  red: "#c0392b",
};
const KIND_EMOJI: Record<MapNode["kind"], string> = {
  theater: "🎭", tv: "📺", station: "🚉", stop: "",
};

interface Props {
  nodes: MapNode[];
  players: Player[];
  currentPlayerIndex: number;
  destinationId: string | null;
}

/** アイソメ菱形タイルのpath */
function tilePath(x: number, y: number, r: number): string {
  return `M ${x} ${y - r * 0.55} L ${x + r} ${y} L ${x} ${y + r * 0.55} L ${x - r} ${y} Z`;
}

export function IsoMapView({ nodes, players, currentPlayerIndex, destinationId }: Props) {
  const nodeMap = useMemo(() => buildNodeMap(nodes), [nodes]);
  const current = players[currentPlayerIndex];
  if (nodes.length === 0 || !current) return <svg className="board-svg" />;

  const focus = nodeMap.get(current.position)!;
  const camX = VIEW_W / 2 - focus.x;
  const camY = VIEW_H / 2 - focus.y;

  // エッジ重複排除(id辞書順で片側のみ)
  const edges: [MapNode, MapNode][] = [];
  for (const n of nodes) {
    for (const nb of n.neighbors) {
      if (n.id < nb) edges.push([n, nodeMap.get(nb)!]);
    }
  }

  return (
    <svg className="board-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice">
      <g className="board-camera" style={{ transform: `translate(${camX}px, ${camY}px)` }}>
        {edges.map(([a, b]) => (
          <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="rgba(255,255,255,0.28)" strokeWidth={12} strokeLinecap="round" />
        ))}
        {nodes.map((n) => (
          <g key={n.id}>
            {n.kind === "stop" ? (
              <path className="iso-tile" d={tilePath(n.x, n.y, 26)} fill={TILE_FILL[n.cell]} />
            ) : (
              <>
                {/* 拠点: アイソメボックス(建物風) */}
                <path className="iso-tile" d={tilePath(n.x, n.y, 34)} fill="rgba(255,255,255,0.25)" />
                <rect x={n.x - 18} y={n.y - 44} width={36} height={34} rx={4}
                  fill="#6c5ce7" stroke="rgba(255,255,255,0.5)" />
                <text x={n.x} y={n.y - 20} textAnchor="middle" fontSize={20}>
                  {KIND_EMOJI[n.kind]}
                </text>
                <text className="iso-node-label" x={n.x} y={n.y + 24}>{n.name}</text>
              </>
            )}
            {n.id === destinationId && (
              <text className="destination-flag" x={n.x + 20} y={n.y - 46} fontSize={26}>🚩</text>
            )}
          </g>
        ))}
        {players.map((p, i) => {
          const node = nodeMap.get(p.position)!;
          const dx = (i - (players.length - 1) / 2) * 18;
          return (
            <g key={p.id} className="piece"
              style={{ transform: `translate(${node.x + dx}px, ${node.y - 40}px)` }}>
              <circle r={13} fill={PIECE_COLORS[i % PIECE_COLORS.length]} stroke="#fff" strokeWidth={2} />
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
