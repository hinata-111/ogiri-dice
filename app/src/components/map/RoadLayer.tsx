import type { MapNode } from "../../game/types";

interface Props {
  nodes: MapNode[];
  nodeMap: Map<string, MapNode>;
}

const ROAD_WIDTH = 28;

export function RoadLayer({ nodes, nodeMap }: Props) {
  const edges: [MapNode, MapNode][] = [];
  for (const node of nodes) {
    for (const neighborId of node.neighbors) {
      if (node.id < neighborId) {
        const neighbor = nodeMap.get(neighborId);
        if (neighbor) edges.push([node, neighbor]);
      }
    }
  }

  return (
    <g className="road-layer">
      {edges.map(([from, to]) => (
        <g key={`${from.id}-${to.id}`}>
          <path d={roadPath(from, to, ROAD_WIDTH + 8)} className="road-shadow" />
          <path d={roadPath(from, to, ROAD_WIDTH)} className="road-band" />
          <path d={roadPath(from, to, ROAD_WIDTH - 10)} className="road-highlight" />
        </g>
      ))}
    </g>
  );
}

function roadPath(from: MapNode, to: MapNode, width: number): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ox = (-dy / length) * (width / 2);
  const oy = (dx / length) * (width / 2);

  return [
    `M ${from.x + ox} ${from.y + oy}`,
    `L ${to.x + ox} ${to.y + oy}`,
    `L ${to.x - ox} ${to.y - oy}`,
    `L ${from.x - ox} ${from.y - oy}`,
    "Z",
  ].join(" ");
}
