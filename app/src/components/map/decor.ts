import type { MapBounds } from "./camera";

export interface DecorPoint {
  x: number;
  y: number;
}

export interface DecorRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  opacity?: number;
  rx?: number;
  rotate?: number;
}

export interface DecorEllipse {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill: string;
  stroke?: string;
  opacity?: number;
}

export const MAP_DECOR_BOUNDS: MapBounds = {
  x: -180,
  y: -40,
  width: 1560,
  height: 900,
};

export const TOKYO_BAY: DecorPoint[] = [
  { x: 330, y: 520 },
  { x: 560, y: 470 },
  { x: 790, y: 560 },
  { x: 940, y: 790 },
  { x: 1180, y: 860 },
  { x: 1380, y: 860 },
  { x: 1380, y: 360 },
  { x: 1040, y: 460 },
  { x: 720, y: 500 },
  { x: 430, y: 610 },
];

export const ODAIBA_ISLAND: DecorPoint[] = [
  { x: 340, y: 474 },
  { x: 470, y: 430 },
  { x: 610, y: 480 },
  { x: 560, y: 570 },
  { x: 410, y: 590 },
  { x: 318, y: 540 },
];

export const SUMIDA_RIVER: DecorPoint[] = [
  { x: 1128, y: 320 },
  { x: 1186, y: 392 },
  { x: 1110, y: 484 },
  { x: 960, y: 540 },
  { x: 878, y: 640 },
  { x: 930, y: 760 },
];

export const PALACE_MOAT: DecorEllipse = {
  id: "palace-moat",
  cx: 615,
  cy: 458,
  rx: 142,
  ry: 58,
  fill: "#9ed8f6",
  stroke: "#6ab6df",
};

export const PALACE_GREEN: DecorEllipse = {
  id: "palace-green",
  cx: 610,
  cy: 452,
  rx: 112,
  ry: 42,
  fill: "#93d282",
  stroke: "#68a85f",
};

export const WAVE_LINES: string[] = [
  "M 760 640 C 810 610, 880 610, 930 640 S 1040 670, 1090 638",
  "M 900 735 C 950 705, 1030 705, 1085 735 S 1195 765, 1250 732",
  "M 1040 535 C 1090 508, 1160 508, 1210 535",
];

export const CITY_BLOCKS: DecorRect[] = [
  { id: "block-west-1", x: 66, y: 284, width: 88, height: 38, fill: "#fff6dc", stroke: "#e0c995", rotate: -29 },
  { id: "block-west-2", x: 152, y: 236, width: 78, height: 34, fill: "#f6f7ef", stroke: "#d8dbc6", rotate: -29 },
  { id: "block-west-3", x: -30, y: 376, width: 90, height: 34, fill: "#fff2c9", stroke: "#e6c98a", rotate: -29 },
  { id: "block-central-1", x: 380, y: 230, width: 78, height: 32, fill: "#fff9e8", stroke: "#dfceaa", rotate: -29 },
  { id: "block-central-2", x: 520, y: 260, width: 92, height: 36, fill: "#eef4f2", stroke: "#cbd9d5", rotate: 29 },
  { id: "block-central-3", x: 690, y: 285, width: 78, height: 34, fill: "#fff5d8", stroke: "#dec68f", rotate: -29 },
  { id: "block-central-4", x: 760, y: 348, width: 96, height: 34, fill: "#f5f7ea", stroke: "#d5d9bf", rotate: 29 },
  { id: "block-east-1", x: 910, y: 310, width: 92, height: 36, fill: "#fff8df", stroke: "#dfca9a", rotate: 29 },
  { id: "block-east-2", x: 1038, y: 374, width: 94, height: 34, fill: "#f3f8f5", stroke: "#cbdcd4", rotate: -29 },
  { id: "block-east-3", x: 1160, y: 452, width: 82, height: 32, fill: "#fff2cf", stroke: "#dfc189", rotate: 29 },
  { id: "block-south-1", x: 230, y: 612, width: 90, height: 34, fill: "#fff8e5", stroke: "#dfc996", rotate: 29 },
  { id: "block-south-2", x: 390, y: 662, width: 94, height: 36, fill: "#f2f5ee", stroke: "#ccd4c4", rotate: -29 },
  { id: "block-south-3", x: 626, y: 612, width: 96, height: 34, fill: "#fff3cf", stroke: "#dfbf82", rotate: -29 },
  { id: "block-south-4", x: 758, y: 706, width: 92, height: 34, fill: "#f7f7ef", stroke: "#d2d3bd", rotate: 29 },
];

export const TREE_CLUSTERS: DecorEllipse[] = [
  { id: "tree-1", cx: 300, cy: 206, rx: 22, ry: 12, fill: "#8fcb74" },
  { id: "tree-2", cx: 332, cy: 190, rx: 18, ry: 10, fill: "#78b865" },
  { id: "tree-3", cx: 1010, cy: 248, rx: 22, ry: 12, fill: "#8fcb74" },
  { id: "tree-4", cx: 1046, cy: 262, rx: 20, ry: 11, fill: "#72b663" },
  { id: "tree-5", cx: 86, cy: 504, rx: 24, ry: 13, fill: "#82c36d" },
  { id: "tree-6", cx: 890, cy: 426, rx: 22, ry: 12, fill: "#7fbd6a" },
];
