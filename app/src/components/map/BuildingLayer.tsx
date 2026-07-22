import type { MapNode } from "../../game/types";
import { BaseDiamond } from "./TileLayer";

interface Props {
  nodes: MapNode[];
  destinationId: string | null;
}

export function BuildingLayer({ nodes, destinationId }: Props) {
  return (
    <g className="building-layer">
      {nodes.filter((node) => node.kind !== "stop").map((node) => (
        <g key={node.id} className="map-building">
          <BaseDiamond x={node.x} y={node.y} />
          {renderBuilding(node)}
          <NamePlate node={node} />
          {node.id === destinationId && (
            <text className="destination-flag" x={node.x + 28} y={node.y - 72} fontSize={28}>🚩</text>
          )}
        </g>
      ))}
    </g>
  );
}

function renderBuilding(node: MapNode) {
  if (node.kind === "theater") return <TheaterBuilding x={node.x} y={node.y} />;
  if (node.kind === "tv") return <TvBuilding x={node.x} y={node.y} odaiba={node.id === "odaiba"} />;
  return <StationBuilding x={node.x} y={node.y} />;
}

function TheaterBuilding({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y - 12})`} className="building-theater">
      <path d="M -36 -24 L 0 -52 L 36 -24 Z" fill="#b53636" stroke="#7c2323" strokeWidth={2} />
      <rect x={-32} y={-28} width={64} height={44} rx={4} fill="#fff8e8" stroke="#8e4c2e" strokeWidth={2} />
      <path d="M -28 -25 C -14 -12, -14 4, -28 16 L -8 16 C -2 4, -2 -12, -8 -25 Z" fill="#d8333f" />
      <path d="M 28 -25 C 14 -12, 14 4, 28 16 L 8 16 C 2 4, 2 -12, 8 -25 Z" fill="#d8333f" />
      <rect x={-18} y={-16} width={36} height={28} rx={3} fill="#ffe7a3" stroke="#8e4c2e" />
      {[-24, -12, 0, 12, 24].map((dot) => (
        <circle key={dot} cx={dot} cy={-33} r={3} fill="#ffd84d" stroke="#a36b00" strokeWidth={0.8} />
      ))}
    </g>
  );
}

function TvBuilding({ x, y, odaiba }: { x: number; y: number; odaiba: boolean }) {
  return (
    <g transform={`translate(${x} ${y - 10})`} className="building-tv">
      <rect x={-34} y={-42} width={68} height={56} rx={5} fill="#d9e0e5" stroke="#6b7b88" strokeWidth={2} />
      <rect x={-24} y={-32} width={20} height={14} rx={2} fill="#87c7ec" />
      <rect x={4} y={-32} width={20} height={14} rx={2} fill="#87c7ec" />
      <rect x={-24} y={-10} width={20} height={18} rx={2} fill="#87c7ec" />
      <rect x={4} y={-10} width={20} height={18} rx={2} fill="#87c7ec" />
      <path d="M -8 -42 L 0 -66 L 8 -42" fill="none" stroke="#46545d" strokeWidth={3} strokeLinecap="round" />
      <line x1={0} y1={-65} x2={0} y2={-78} stroke="#46545d" strokeWidth={2} />
      {odaiba && <circle cx={0} cy={-46} r={13} fill="#f7f2dc" stroke="#7d8a91" strokeWidth={2} />}
    </g>
  );
}

function StationBuilding({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y - 10})`} className="building-station">
      <path d="M -38 -30 L 0 -50 L 38 -30 L 32 -20 L 0 -36 L -32 -20 Z" fill="#45a05a" stroke="#216c35" strokeWidth={2} />
      <rect x={-34} y={-24} width={68} height={40} rx={4} fill="#fff8e5" stroke="#806f4a" strokeWidth={2} />
      <rect x={-24} y={-8} width={18} height={22} rx={2} fill="#7fc4e8" />
      <rect x={6} y={-8} width={18} height={22} rx={2} fill="#7fc4e8" />
      <circle cx={0} cy={-20} r={7} fill="#ffffff" stroke="#45515a" strokeWidth={2} />
      <line x1={0} y1={-20} x2={0} y2={-25} stroke="#45515a" strokeWidth={1.5} />
      <line x1={0} y1={-20} x2={4} y2={-18} stroke="#45515a" strokeWidth={1.5} />
      <path d="M -44 17 L 44 17 L 32 26 L -32 26 Z" fill="#b7c7cf" stroke="#6d7c83" strokeWidth={1.5} />
    </g>
  );
}

function NamePlate({ node }: { node: MapNode }) {
  const width = Math.max(66, node.name.length * 16 + 24);
  return (
    <g className="name-plate" transform={`translate(${node.x} ${node.y + 38})`}>
      <rect x={-width / 2} y={-15} width={width} height={28} rx={8} />
      <text y={5}>{node.name}</text>
    </g>
  );
}
