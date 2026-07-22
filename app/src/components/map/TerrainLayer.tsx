import {
  CITY_BLOCKS, ODAIBA_ISLAND, PALACE_GREEN, PALACE_MOAT, SUMIDA_RIVER,
  TOKYO_BAY, TREE_CLUSTERS, WAVE_LINES,
} from "./decor";
import type { DecorEllipse, DecorPoint } from "./decor";

interface Props {
  width: number;
  height: number;
}

export function TerrainLayer({ width, height }: Props) {
  return (
    <g className="terrain-layer">
      <rect x={-220} y={-80} width={width + 440} height={height + 180} fill="#f4e7c9" />
      <path d={polygonPath(TOKYO_BAY)} className="terrain-bay" />
      <path d={polygonPath(ODAIBA_ISLAND)} className="terrain-island" />
      <path d={riverPath(SUMIDA_RIVER)} className="terrain-river" />
      <ellipse {...ellipseProps(PALACE_MOAT)} className="terrain-moat" />
      <ellipse {...ellipseProps(PALACE_GREEN)} className="terrain-green" />
      {CITY_BLOCKS.map((block) => (
        <rect
          key={block.id}
          x={block.x}
          y={block.y}
          width={block.width}
          height={block.height}
          rx={block.rx ?? 4}
          fill={block.fill}
          stroke={block.stroke}
          opacity={block.opacity}
          transform={block.rotate ? `rotate(${block.rotate} ${block.x + block.width / 2} ${block.y + block.height / 2})` : undefined}
        />
      ))}
      {TREE_CLUSTERS.map((tree) => (
        <ellipse key={tree.id} {...ellipseProps(tree)} className="terrain-tree" />
      ))}
      {WAVE_LINES.map((wave) => (
        <path key={wave} d={wave} className="terrain-wave" />
      ))}
      <text x={1120} y={690} className="terrain-water-label">東京湾</text>
    </g>
  );
}

function polygonPath(points: DecorPoint[]): string {
  return points.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
  ).join(" ") + " Z";
}

function riverPath(points: DecorPoint[]): string {
  return points.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
  ).join(" ");
}

function ellipseProps(ellipse: DecorEllipse) {
  return {
    cx: ellipse.cx,
    cy: ellipse.cy,
    rx: ellipse.rx,
    ry: ellipse.ry,
    fill: ellipse.fill,
    stroke: ellipse.stroke,
    opacity: ellipse.opacity,
  };
}
