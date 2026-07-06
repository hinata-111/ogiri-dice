// 31マスの蛇行盤面を生成して src/data/board.json に書き出す
// 7列×5行の蛇行パス。i%5===2 → 青(+3万)、それ以外で i%7===4 → 赤(-2万)。
// index 0(スタート)と30(ゴール)は常にnormal。
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const COLS = 7;
const SIZE = 31;
const cells = [];
for (let i = 0; i < SIZE; i++) {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  const x = 80 + (row % 2 === 0 ? col : COLS - 1 - col) * 120;
  const y = 100 + row * 130;
  let type = "normal";
  let amount = 0;
  if (i > 0 && i < SIZE - 1) {
    if (i % 5 === 2) { type = "blue"; amount = 30000; }
    else if (i % 7 === 4) { type = "red"; amount = 20000; }
  }
  cells.push({ index: i, type, amount, x, y });
}
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "board.json");
writeFileSync(out, JSON.stringify({ cells }, null, 2) + "\n");
console.log(`wrote ${out} (${cells.length} cells)`);
