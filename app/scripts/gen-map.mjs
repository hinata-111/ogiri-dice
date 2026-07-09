// 東京マップ生成: スペック「マップデータ」節の拠点14+路線を map.json に出力
// グリッド座標(col,row)→アイソメ座標: x=(col-row)*72+640, y=(col+row)*40+80
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const iso = (c, r) => ({ x: Math.round((c - r) * 72 + 640), y: Math.round((c + r) * 40 + 80) });

// 拠点: [id, 表示名, kind, col, row]
const hubs = [
  ["koenji", "高円寺", "theater", 0, 0],
  ["nakano", "中野", "theater", 0, 3],
  ["shinjuku", "新宿", "theater", 0, 5],
  ["shibuya", "渋谷", "theater", 0, 7],
  ["shimokita", "下北沢", "theater", 0, 9],
  ["ikebukuro", "池袋", "theater", 4, 0],
  ["jimbocho", "神保町", "theater", 4, 3],
  ["shiodome", "汐留", "tv", 4, 5],
  ["odaiba", "お台場", "tv", 4, 7],
  ["roppongi", "六本木", "tv", 3, 9],
  ["asakusa", "浅草", "theater", 8, 0],
  ["akihabara", "秋葉原", "station", 8, 5],
  ["yurakucho", "有楽町", "theater", 8, 7],
  ["shinagawa", "品川", "station", 6, 10],
];

// 路線: [fromId, toId, [ [cell, col, row], ... ]] cellは R(red)/B(blue)/N(normal)
const routes = [
  ["koenji", "nakano", [["R", 0, 1], ["N", 0, 2]]],
  ["nakano", "shinjuku", [["R", 0, 4]]],
  ["shinjuku", "jimbocho", [["R", 2, 4]]],
  ["shinjuku", "shibuya", [["B", 0, 6]]],
  ["shibuya", "shimokita", [["B", 0, 8]]],
  ["shibuya", "roppongi", [["B", 1, 8], ["R", 2, 9]]],
  ["ikebukuro", "jimbocho", [["B", 4, 1], ["N", 4, 2]]],
  ["jimbocho", "shiodome", [["B", 4, 4]]],
  ["jimbocho", "j1", [["N", 6, 3]]],
  ["j1", "asakusa", [["R", 7, 2], ["N", 8, 1]]],
  ["j1", "akihabara", [["N", 7, 4]]],
  ["shiodome", "akihabara", [["N", 6, 5]]],
  ["shiodome", "odaiba", [["R", 4, 6]]],
  ["odaiba", "roppongi", [["N", 4, 8]]],
  ["roppongi", "shinagawa", [["N", 5, 10]]],
  ["akihabara", "yurakucho", [["B", 8, 6]]],
  ["yurakucho", "shinagawa", [["N", 7, 9]]],
];

const CELL = { R: "red", B: "blue", N: "normal" };
const nodes = new Map();

for (const [id, name, kind, c, r] of hubs) {
  nodes.set(id, { id, name, kind, cell: "normal", ...iso(c, r), neighbors: [] });
}
// j1は無名の分岐点(通常マス)
nodes.set("j1", { id: "j1", name: "", kind: "stop", cell: "normal", ...iso(6, 3), neighbors: [] });

const link = (a, b) => {
  if (!nodes.get(a).neighbors.includes(b)) nodes.get(a).neighbors.push(b);
  if (!nodes.get(b).neighbors.includes(a)) nodes.get(b).neighbors.push(a);
};

for (const [from, to, cells] of routes) {
  let prev = from;
  cells.forEach(([cell, c, r], i) => {
    const id = `${from}-${to}-${i}`;
    nodes.set(id, { id, name: "", kind: "stop", cell: CELL[cell], ...iso(c, r), neighbors: [] });
    link(prev, id);
    prev = id;
  });
  link(prev, to);
}

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "map.json");
writeFileSync(out, JSON.stringify({ nodes: [...nodes.values()] }, null, 2) + "\n");
console.log(`wrote ${out} (${nodes.size} nodes)`);
