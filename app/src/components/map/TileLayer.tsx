import type { CellKind, MapNode } from "../../game/types";

interface Props {
  nodes: MapNode[];
  destinationId: string | null;
}

const TILE_RADIUS = 28;
const TILE_DEPTH = 10;

const TILE_COLORS: Record<CellKind, { top: string; left: string; right: string; stroke: string }> = {
  normal: { top: "#ffffff", left: "#ddd6c4", right: "#cfc4aa", stroke: "#ffffff" },
  blue: { top: "#2f7de1", left: "#1f5ead", right: "#174a8d", stroke: "#e7f3ff" },
  red: { top: "#e14b4b", left: "#aa3030", right: "#842323", stroke: "#ffe8e8" },
};

export function TileLayer({ nodes, destinationId }: Props) {
  return (
    <g className="tile-layer">
      {nodes.filter((node) => node.kind === "stop").map((node) => (
        <Tile key={node.id} node={node} destinationId={destinationId} />
      ))}
    </g>
  );
}

function Tile({ node, destinationId }: { node: MapNode; destinationId: string | null }) {
  const colors = TILE_COLORS[node.cell];
  const top = diamondPoints(node.x, node.y, TILE_RADIUS);
  const bottom = diamondPoints(node.x, node.y + TILE_DEPTH, TILE_RADIUS);
  const isDestination = node.id === destinationId;

  return (
    <g className="map-tile">
      <ellipse cx={node.x} cy={node.y + 16} rx={34} ry={13} className="tile-shadow" />
      <path d={sidePath(top.left, top.bottom, bottom.bottom, bottom.left)} fill={colors.left} />
      <path d={sidePath(top.right, top.bottom, bottom.bottom, bottom.right)} fill={colors.right} />
      <path
        d={diamondPath(top)}
        fill={colors.top}
        stroke={isDestination ? "#ffd700" : colors.stroke}
        strokeWidth={isDestination ? 4 : 1.5}
        className={node.cell === "normal" ? "tile-top tile-normal" : "tile-top"}
      />
      {isDestination && (
        <text className="destination-flag" x={node.x + 18} y={node.y - 40} fontSize={26}>🚩</text>
      )}
    </g>
  );
}

export function BaseDiamond({ x, y, radius = 34 }: { x: number; y: number; radius?: number }) {
  const top = diamondPoints(x, y, radius);
  const bottom = diamondPoints(x, y + TILE_DEPTH, radius);

  return (
    <g className="map-tile base-diamond">
      <ellipse cx={x} cy={y + 17} rx={radius + 10} ry={15} className="tile-shadow" />
      <path d={sidePath(top.left, top.bottom, bottom.bottom, bottom.left)} fill="#ded4bc" />
      <path d={sidePath(top.right, top.bottom, bottom.bottom, bottom.right)} fill="#cfc0a1" />
      <path d={diamondPath(top)} fill="#fffdf4" stroke="#ffffff" strokeWidth={1.5} />
    </g>
  );
}

interface DiamondPoints {
  top: { x: number; y: number };
  right: { x: number; y: number };
  bottom: { x: number; y: number };
  left: { x: number; y: number };
}

function diamondPoints(x: number, y: number, radius: number): DiamondPoints {
  return {
    top: { x, y: y - radius * 0.55 },
    right: { x: x + radius, y },
    bottom: { x, y: y + radius * 0.55 },
    left: { x: x - radius, y },
  };
}

function diamondPath(points: DiamondPoints): string {
  return [
    `M ${points.top.x} ${points.top.y}`,
    `L ${points.right.x} ${points.right.y}`,
    `L ${points.bottom.x} ${points.bottom.y}`,
    `L ${points.left.x} ${points.left.y}`,
    "Z",
  ].join(" ");
}

function sidePath(...points: { x: number; y: number }[]): string {
  return points.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
  ).join(" ") + " Z";
}
