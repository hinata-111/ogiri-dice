import { useEffect, useMemo, useState } from "react";
import { buildNodeMap } from "../../game/graph";
import type { MapNode, Player } from "../../game/types";
import { computeCamera, type CameraMode, type MapBounds } from "./camera";
import { MAP_DECOR_BOUNDS } from "./decor";
import { TerrainLayer } from "./TerrainLayer";
import { RoadLayer } from "./RoadLayer";
import { TileLayer } from "./TileLayer";
import { BuildingLayer } from "./BuildingLayer";

const VIEW_W = 1280;
const VIEW_H = 960;
const VIEW_SIZE = { width: VIEW_W, height: VIEW_H };
const PIECE_COLORS = ["#ffcf3f", "#ff5d8f", "#4dabf7", "#69db7c"];

interface Props {
  nodes: MapNode[];
  players: Player[];
  currentPlayerIndex: number;
  destinationId: string | null;
  cameraMode: CameraMode;
  focusNodeId: string | null;
  canToggleOverview: boolean;
}

export function IsoMapView({
  nodes,
  players,
  currentPlayerIndex,
  destinationId,
  cameraMode,
  focusNodeId,
  canToggleOverview,
}: Props) {
  const [overview, setOverview] = useState(false);
  const nodeMap = useMemo(() => buildNodeMap(nodes), [nodes]);
  const mapBounds = useMemo(() => computeMapBounds(nodes), [nodes]);
  const current = players[currentPlayerIndex] ?? null;

  useEffect(() => {
    if (!canToggleOverview) setOverview(false);
  }, [canToggleOverview]);

  if (nodes.length === 0 || !current) return <svg className="board-svg" />;

  const currentNode = nodeMap.get(current.position);
  const focusNode = focusNodeId ? nodeMap.get(focusNodeId) : null;
  const focus = focusNode ?? currentNode;
  if (!focus) return <svg className="board-svg" />;

  const effectiveMode: CameraMode = overview ? "overview" : cameraMode;
  const camera = computeCamera(effectiveMode, focus, VIEW_SIZE, mapBounds);

  return (
    <>
      <svg className="board-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice">
        <g
          className={`board-camera camera-${effectiveMode}`}
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}
        >
          <TerrainLayer width={VIEW_W} height={VIEW_H} />
          <RoadLayer nodes={nodes} nodeMap={nodeMap} />
          <TileLayer nodes={nodes} destinationId={destinationId} />
          <BuildingLayer nodes={nodes} destinationId={destinationId} />
          <PlayerPieces players={players} nodeMap={nodeMap} />
        </g>
      </svg>
      {canToggleOverview && (
        <button
          type="button"
          className={`map-overview-toggle${overview ? " active" : ""}`}
          aria-pressed={overview}
          onClick={() => setOverview((value) => !value)}
        >
          🗾 全体
        </button>
      )}
    </>
  );
}

function PlayerPieces({ players, nodeMap }: { players: Player[]; nodeMap: Map<string, MapNode> }) {
  return (
    <g className="piece-layer">
      {players.map((player, index) => {
        const node = nodeMap.get(player.position);
        if (!node) return null;
        const dx = (index - (players.length - 1) / 2) * 18;

        return (
          <g
            key={player.id}
            className="piece"
            style={{ transform: `translate(${node.x + dx}px, ${node.y - 42}px)` }}
          >
            <ellipse cx={0} cy={18} rx={15} ry={6} fill="rgba(46, 30, 8, 0.28)" />
            <circle r={14} fill={PIECE_COLORS[index % PIECE_COLORS.length]} stroke="#fff" strokeWidth={2.5} />
            <circle cx={-5} cy={-5} r={3} fill="rgba(255,255,255,0.75)" />
            <text y={5} textAnchor="middle" fontSize={12} fill="#2c240c" fontWeight={800}>
              {player.name.slice(0, 1)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function computeMapBounds(nodes: MapNode[]): MapBounds {
  if (nodes.length === 0) return MAP_DECOR_BOUNDS;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x - 110);
    minY = Math.min(minY, node.y - 120);
    maxX = Math.max(maxX, node.x + 110);
    maxY = Math.max(maxY, node.y + 110);
  }

  return mergeBounds({
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }, MAP_DECOR_BOUNDS);
}

function mergeBounds(a: MapBounds, b: MapBounds): MapBounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: maxX - x, height: maxY - y };
}
