# ogiri-dice v2 東京マップ転換 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v1(一本道盤)を元仕様忠実のv2(東京マップ・手動移動・青赤チャレンジ・桃鉄式目的地・100万円勝利)へ転換する。

**Architecture:** 既存のreducerステートマシン/Evaluator抽象/オーバーレイUI構造を維持したまま、盤面レイヤー(グラフデータ+移動ロジック+描画)と経済ルールを置換する。スペック: `docs/superpowers/specs/2026-07-08-ogiri-dice-v2-tokyo-map-design.md`

**Tech Stack:** 既存と同じ(React+TS+Vite+Vitest、SVG描画)。新規依存なし。

## Global Constraints

- 定数: `ANSWER_TIME_LIMIT_MS=15000`, `INITIAL_MONEY=100000`, `ARRIVAL_PRIZE=300000`, `CHALLENGE_UNIT=30000`, `WIN_MONEY=1000000`, `MAX_ROUNDS=30`, `BEST_ANSWER_MIN_SCORE=5`, `TIME_UP_RESULT={score:1,comment:"時間切れ！"}`
- 赤マス目標値T: 1〜4のランダム整数。スコア<Tなら`(T−スコア)×CHALLENGE_UNIT`減、T以上なら増減なし
- 青マス: `スコア×CHALLENGE_UNIT` 増
- 通常ターンの回答で所持金は変化しない(移動のみ)
- 目的地通過=即到着(残歩数切捨て)、到着者に`ARRIVAL_PRIZE`、次目的地即抽選
- 勝利: ターン終了時に`money>=WIN_MONEY`で即優勝。`MAX_ROUNDS`周で最多金(同額なら到着回数)
- 移動: 1歩ずつ、来た道へ戻れない(行き止まりのみ例外)。人間=方向ボタン/矢印キー、CPU=BFS最短
- マップ: スペックの「マップデータ」節の拠点14+路線を忠実にデータ化
- 各タスク終了時に `npm test`・`npm run build` green 必須。TDD(ロジック層)
- UI文言日本語。tsconfigは`erasableSyntaxOnly`(constructor parameter properties禁止)
- コミット末尾: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## File Structure

```
app/src/
├─ game/
│  ├─ types.ts        [改] MapNode追加、Player.position→string化+arrivals
│  ├─ rules.ts        [改] v2定数・blueGain/redLoss/rankPlayers(タイブレーク)
│  ├─ graph.ts        [新] buildNodeMap/moveOptions/nextStepToward/destinationCandidates
│  ├─ state.ts        [改] v2ステートマシン全面書換
│  ├─ topics.ts       [不変]
│  └─ board.ts        [削除](board.test.tsも)
├─ data/
│  ├─ map.json        [新] 東京マップ(gen-map.mjsで生成)
│  └─ board.json      [削除]
├─ scripts/gen-map.mjs [新] (gen-board.mjs削除)
├─ ai/                [不変]
├─ components/
│  ├─ IsoMapView.tsx  [新] アイソメ盤面(BoardView.tsx削除)
│  ├─ MoveControls.tsx[新] 方向ボタン+矢印キー
│  ├─ ChallengeIntro.tsx [新] 青/赤チャレンジ告知
│  ├─ ArrivalOverlay.tsx [新] 到着演出+次目的地
│  ├─ ResultOverlay.tsx  [改] moneyDelta表示対応
│  ├─ Hud.tsx         [改] 目的地・周回・到着数表示
│  ├─ GameResultScreen.tsx [新] v2勝敗(旧Task10を置換)
│  └─ App.tsx         [改] v2オーケストレーション
└─ index.css          [改] アイソメ盤・矢印・状態ライト色・到着演出
```

---

### Task V1: グラフ基盤 — types拡張・graph.ts・東京マップデータ(非破壊追加)

**Files:**
- Modify: `app/src/game/types.ts`(末尾に追記のみ)
- Create: `app/src/game/graph.ts`, `app/scripts/gen-map.mjs`, 生成物 `app/src/data/map.json`
- Test: `app/src/game/graph.test.ts`, `app/src/game/map.test.ts`

**Interfaces:**
- Consumes: 既存 `types.ts`
- Produces:
  - `types.ts` 追記: `NodeKind = "theater"|"tv"|"station"|"stop"` / `CellKind = "normal"|"blue"|"red"` / `MapNode {id,name,kind,cell,x,y,neighbors: string[]}`
  - `graph.ts`:
    - `buildNodeMap(nodes: MapNode[]): Map<string, MapNode>`(id重複・片方向エッジ・未知idで`throw`)
    - `moveOptions(nodeMap, at: string, cameFrom: string | null): string[]`(cameFrom除外、ただし他に選択肢が無ければcameFromも可)
    - `nextStepToward(nodeMap, from: string, cameFrom: string | null, target: string): string`(BFS最短の次の一歩。第一歩はmoveOptionsの制約に従う)
    - `destinationCandidates(nodes: MapNode[]): MapNode[]`(kindがtheater/tv)
  - `map.json`: `{nodes: MapNode[]}` スペックの拠点14+中間マス21=35ノード

- [ ] **Step 1: types.ts 追記**

```ts
// --- v2: 東京マップ ---
export type NodeKind = "theater" | "tv" | "station" | "stop";
export type CellKind = "normal" | "blue" | "red";

export interface MapNode {
  id: string;
  name: string; // 中間マスは""
  kind: NodeKind;
  cell: CellKind; // 拠点はnormal
  x: number;
  y: number;
  neighbors: string[];
}
```

- [ ] **Step 2: 失敗するテスト** — `app/src/game/graph.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { buildNodeMap, destinationCandidates, moveOptions, nextStepToward } from "./graph";
import type { MapNode } from "./types";

// 直線+分岐のテスト用ミニマップ: a - b - c - d、bから枝 b - e
const n = (id: string, neighbors: string[], kind: MapNode["kind"] = "stop"): MapNode => ({
  id, name: id, kind, cell: "normal", x: 0, y: 0, neighbors,
});
const nodes: MapNode[] = [
  n("a", ["b"], "theater"),
  n("b", ["a", "c", "e"]),
  n("c", ["b", "d"]),
  n("d", ["c"], "tv"),
  n("e", ["b"], "station"),
];

describe("buildNodeMap", () => {
  it("全ノードを引ける", () => {
    const m = buildNodeMap(nodes);
    expect(m.get("c")?.neighbors).toEqual(["b", "d"]);
  });
  it("id重複でthrow", () => {
    expect(() => buildNodeMap([...nodes, n("a", ["b"])])).toThrow();
  });
  it("片方向エッジでthrow", () => {
    expect(() => buildNodeMap([n("x", ["y"]), n("y", [])])).toThrow();
  });
  it("未知の隣接idでthrow", () => {
    expect(() => buildNodeMap([n("x", ["zzz"])])).toThrow();
  });
});

describe("moveOptions", () => {
  const m = buildNodeMap(nodes);
  it("来た道を除外する", () => {
    expect(moveOptions(m, "b", "a").sort()).toEqual(["c", "e"]);
  });
  it("cameFromがnullなら全隣接", () => {
    expect(moveOptions(m, "b", null).sort()).toEqual(["a", "c", "e"]);
  });
  it("行き止まりでは来た道に戻れる", () => {
    expect(moveOptions(m, "e", "b")).toEqual(["b"]);
  });
});

describe("nextStepToward", () => {
  const m = buildNodeMap(nodes);
  it("最短経路の次の一歩を返す", () => {
    expect(nextStepToward(m, "a", null, "d")).toBe("b");
    expect(nextStepToward(m, "b", "a", "d")).toBe("c");
  });
  it("行き止まりからは戻る一歩", () => {
    expect(nextStepToward(m, "e", "b", "d")).toBe("b");
  });
});

describe("destinationCandidates", () => {
  it("theater/tvのみ", () => {
    expect(destinationCandidates(nodes).map((x) => x.id).sort()).toEqual(["a", "d"]);
  });
});
```

- [ ] **Step 3: RED確認**

Run: `cd app; npx vitest run src/game/graph.test.ts`
Expected: FAIL(graph未定義)

- [ ] **Step 4: graph.ts 実装**

```ts
import type { MapNode } from "./types";

export type NodeMap = Map<string, MapNode>;

/** ノード配列からMapを構築し、整合性(重複id・双方向エッジ)を検証する */
export function buildNodeMap(nodes: MapNode[]): NodeMap {
  const map: NodeMap = new Map();
  for (const node of nodes) {
    if (map.has(node.id)) throw new Error(`duplicate node id: ${node.id}`);
    map.set(node.id, node);
  }
  for (const node of nodes) {
    for (const nb of node.neighbors) {
      const other = map.get(nb);
      if (!other) throw new Error(`unknown neighbor: ${node.id} -> ${nb}`);
      if (!other.neighbors.includes(node.id)) {
        throw new Error(`one-way edge: ${node.id} -> ${nb}`);
      }
    }
  }
  return map;
}

/** 現在地からの移動先候補。来た道は除外(他に無い場合のみ可) */
export function moveOptions(nodeMap: NodeMap, at: string, cameFrom: string | null): string[] {
  const node = nodeMap.get(at);
  if (!node) throw new Error(`unknown node: ${at}`);
  const options = node.neighbors.filter((id) => id !== cameFrom);
  return options.length > 0 ? options : node.neighbors.slice();
}

/** targetへのBFS最短経路の次の一歩(第一歩はmoveOptionsの制約に従う) */
export function nextStepToward(
  nodeMap: NodeMap,
  from: string,
  cameFrom: string | null,
  target: string,
): string {
  const starts = moveOptions(nodeMap, from, cameFrom);
  if (starts.includes(target)) return target;
  let best = starts[0];
  let bestDist = Infinity;
  for (const start of starts) {
    const dist = bfsDistance(nodeMap, start, target, from);
    if (dist < bestDist) {
      bestDist = dist;
      best = start;
    }
  }
  return best;
}

function bfsDistance(nodeMap: NodeMap, from: string, target: string, exclude: string): number {
  if (from === target) return 0;
  const visited = new Set([from, exclude]);
  let frontier = [from];
  let dist = 0;
  while (frontier.length > 0) {
    dist += 1;
    const next: string[] = [];
    for (const id of frontier) {
      for (const nb of nodeMap.get(id)?.neighbors ?? []) {
        if (nb === target) return dist;
        if (!visited.has(nb)) {
          visited.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
  }
  return Infinity;
}

/** 目的地候補(劇場・テレビ局) */
export function destinationCandidates(nodes: MapNode[]): MapNode[] {
  return nodes.filter((n) => n.kind === "theater" || n.kind === "tv");
}
```

注: `nextStepToward` の `bfsDistance` は「fromを経由しない」制約付き(戻り歩きの無限ループ防止)。excludeで開始ノードを封じる。

- [ ] **Step 5: GREEN確認**

Run: `npx vitest run src/game/graph.test.ts`
Expected: PASS(12 tests)

- [ ] **Step 6: gen-map.mjs** — スペックのマップ定義をコード化

```js
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
```

注: `j1` は routes より先に登録済みのため `jimbocho→j1` ルートで参照可能。

Run: `node scripts/gen-map.mjs`
Expected: `wrote ... (35 nodes)`

- [ ] **Step 7: map.json 整合性テスト** — `app/src/game/map.test.ts`

```ts
import { describe, expect, it } from "vitest";
import mapData from "../data/map.json";
import { buildNodeMap, destinationCandidates, nextStepToward } from "./graph";
import type { MapNode } from "./types";

const nodes = (mapData as { nodes: MapNode[] }).nodes;

describe("東京マップデータ", () => {
  it("35ノード・双方向整合(buildNodeMapが通る)", () => {
    const m = buildNodeMap(nodes);
    expect(m.size).toBe(35);
  });
  it("目的地候補は劇場11+テレビ局3の12件", () => {
    // theater: 高円寺/中野/新宿/渋谷/下北沢/池袋/神保町/浅草/有楽町 = 9, tv: 汐留/お台場/六本木 = 3
    expect(destinationCandidates(nodes)).toHaveLength(12);
  });
  it("全拠点間が連結(新宿→浅草に経路がある)", () => {
    const m = buildNodeMap(nodes);
    let at = "shinjuku";
    let cameFrom: string | null = null;
    for (let i = 0; i < 50; i++) {
      if (at === "asakusa") break;
      const next = nextStepToward(m, at, cameFrom, "asakusa");
      cameFrom = at;
      at = next;
    }
    expect(at).toBe("asakusa");
  });
});
```

注: 目的地候補数はhubs定義(theater9+tv3=12)と一致させること。テストが12でなければhubsのkind定義ミス。

- [ ] **Step 8: 全テスト+コミット**

Run: `npx vitest run` → 全PASS。`npm run build` → green。

```powershell
git add app/src/game app/scripts/gen-map.mjs app/src/data/map.json
git commit -m "feat: 東京マップグラフ基盤(graph.ts+map.json)を追加"
```

---

### Task V2: ステートマシンv2・経済ルールv2(全面書換)

**Files:**
- Modify: `app/src/game/types.ts`(Player変更), `app/src/game/rules.ts`(v2定数へ), `app/src/game/state.ts`(全面書換), `app/src/game/rules.test.ts`, `app/src/game/state.test.ts`(全面書換)
- Delete: `app/src/game/board.ts`, `app/src/game/board.test.ts`, `app/src/data/board.json`, `app/scripts/gen-board.mjs`
- 注: このタスク終了時点で `App.tsx`/`BoardView.tsx` がコンパイルエラーになるのは不可 — App.tsx/BoardView.tsxとGameResultScreen等のUIも**最小限の暫定修正**(後続タスクで本実装)でビルドgreenを保つこと。暫定修正の方針はStep 6に記載。

**Interfaces:**
- Consumes: V1の `graph.ts`, `MapNode`
- Produces:
  - `types.ts`: `Player.position: string`(nodeId)、`goalOrder`削除→`arrivals: number` 追加
  - `rules.ts`: Global Constraints の全定数 + `blueGain(score)` / `redLoss(target, score)` / `rankPlayers`(money降順→arrivals降順)。`PRIZE_PER_SCORE`/`GOAL_PRIZES`/`answerPrize`/`goalPrize`は削除
  - `state.ts`:
    - `AnswerContext = {kind:"main"} | {kind:"blue"} | {kind:"red"; target:number}`
    - `Phase = title | setup | turnStart | awaitingAnswer{topic,context} | evaluating{topic,answer,context} | showingResult{topic,answer,result,context,moneyDelta} | moving{remaining,cameFrom} | challengeIntro{cellKind:"blue"|"red"} | arrival{nodeId} | gameResult`
    - `GameState {phase, nodes, players, currentPlayerIndex, destinationId, round, usedTopicIds, bestAnswers, winnerId}`
    - `GameAction = SHOW_SETUP | START_GAME{players,nodes,startId,destinationId} | BEGIN_TURN{topic} | BEGIN_CHALLENGE{topic,target?} | SUBMIT_ANSWER{answer} | TIME_UP | EVALUATED{result} | RE_EVALUATE | PROCEED | STEP_TO{nodeId} | ARRIVAL_DONE{nextDestinationId} | RESTART`
    - `initialState` / `gameReducer` / `currentPlayer`

- [ ] **Step 1: rules.ts v2 に書換**

```ts
import type { EvaluationResult, Player } from "./types";

export const ANSWER_TIME_LIMIT_MS = 15000;
export const INITIAL_MONEY = 100000;
export const ARRIVAL_PRIZE = 300000;
export const CHALLENGE_UNIT = 30000;
export const WIN_MONEY = 1000000;
export const MAX_ROUNDS = 30;
export const BEST_ANSWER_MIN_SCORE = 5;

export const TIME_UP_RESULT: EvaluationResult = { score: 1, comment: "時間切れ！" };

/** 青マス: スコアに応じた獲得額 */
export function blueGain(score: number): number {
  return score * CHALLENGE_UNIT;
}

/** 赤マス: 目標値未達分の損失額(達成時0) */
export function redLoss(target: number, score: number): number {
  return Math.max(0, target - score) * CHALLENGE_UNIT;
}

export function applyMoney(money: number, delta: number): number {
  return Math.max(0, money + delta);
}

/** 所持金降順、同額なら到着回数降順 */
export function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.money - a.money || b.arrivals - a.arrivals);
}
```

- [ ] **Step 2: types.ts の Player を v2 に変更**

`Player` を以下に置換(他の型は不変):

```ts
export interface Player {
  id: number;
  name: string;
  kind: PlayerKind;
  personality?: CpuPersonality;
  position: string; // 現在ノードid
  money: number;
  arrivals: number; // 目的地到着回数
}
```

- [ ] **Step 3: state.test.ts v2 に全面書換(RED)**

```ts
import { describe, expect, it } from "vitest";
import { currentPlayer, gameReducer, initialState } from "./state";
import type { GameState } from "./state";
import {
  ARRIVAL_PRIZE, CHALLENGE_UNIT, INITIAL_MONEY, MAX_ROUNDS, TIME_UP_RESULT, WIN_MONEY,
} from "./rules";
import type { MapNode, PlayerConfig, Topic } from "./types";

// テスト用ミニマップ: start - n1(blue) - n2(red) - dest(theater) 、n1から枝 n1 - side(行き止まり)
const n = (
  id: string, neighbors: string[],
  kind: MapNode["kind"] = "stop", cell: MapNode["cell"] = "normal",
): MapNode => ({ id, name: id, kind, cell, x: 0, y: 0, neighbors });

const nodes: MapNode[] = [
  n("start", ["n1"], "station"),
  n("n1", ["start", "n2", "side"], "stop", "blue"),
  n("n2", ["n1", "dest"], "stop", "red"),
  n("dest", ["n2"], "theater"),
  n("side", ["n1"], "stop"),
];

const configs: PlayerConfig[] = [
  { name: "太郎", kind: "human" },
  { name: "ロボ", kind: "cpu", personality: "bold" },
];
const topic: Topic = { id: "t1", category: "c", prompt: "お題", difficulty: "Easy" };

function started(): GameState {
  let s = gameReducer(initialState, { type: "SHOW_SETUP" });
  s = gameReducer(s, {
    type: "START_GAME", players: configs, nodes, startId: "start", destinationId: "dest",
  });
  return s;
}

function toMoving(s: GameState, score: number): GameState {
  s = gameReducer(s, { type: "BEGIN_TURN", topic });
  s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "回答" });
  s = gameReducer(s, { type: "EVALUATED", result: { score, comment: "c" } });
  return gameReducer(s, { type: "PROCEED" });
}

describe("セットアップv2", () => {
  it("初期所持金10万・位置start・目的地dest", () => {
    const s = started();
    expect(s.phase.name).toBe("turnStart");
    expect(s.players[0]).toMatchObject({ position: "start", money: INITIAL_MONEY, arrivals: 0 });
    expect(s.destinationId).toBe("dest");
    expect(s.round).toBe(1);
  });
});

describe("メイン回答→移動", () => {
  it("PROCEEDで所持金変化なし・moving開始(remaining=score)", () => {
    const s = toMoving(started(), 3);
    expect(s.phase).toMatchObject({ name: "moving", remaining: 3, cameFrom: null });
    expect(currentPlayer(s).money).toBe(INITIAL_MONEY);
  });

  it("TIME_UPで時間切れ結果", () => {
    let s = gameReducer(started(), { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "TIME_UP" });
    expect(s.phase).toMatchObject({ name: "showingResult", result: TIME_UP_RESULT });
  });

  it("STEP_TOで1歩進み残数減・cameFrom更新", () => {
    let s = toMoving(started(), 2);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    expect(currentPlayer(s).position).toBe("n1");
    expect(s.phase).toMatchObject({ name: "moving", remaining: 1, cameFrom: "start" });
  });

  it("不正な移動先(隣接していない)は無視", () => {
    const s = toMoving(started(), 2);
    expect(gameReducer(s, { type: "STEP_TO", nodeId: "dest" })).toBe(s);
  });

  it("来た道への移動は無視(行き止まり以外)", () => {
    let s = toMoving(started(), 3);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    expect(gameReducer(s, { type: "STEP_TO", nodeId: "start" })).toBe(s);
  });

  it("行き止まりでは戻れる", () => {
    let s = toMoving(started(), 3);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "side" }); // 行き止まり、残1
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" }); // 戻る、残0 → n1はblue
    expect(s.phase).toMatchObject({ name: "challengeIntro", cellKind: "blue" });
  });
});

describe("停止マス処理", () => {
  it("青マス停止でchallengeIntro(blue)", () => {
    let s = toMoving(started(), 1);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    expect(s.phase).toMatchObject({ name: "challengeIntro", cellKind: "blue" });
  });

  it("通常マス停止で次の手番へ", () => {
    let s = toMoving(started(), 3);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "side" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" }); // blue... 使わない
    // 別ケース: score1でsideに止まる
    let s2 = toMoving(started(), 2);
    s2 = gameReducer(s2, { type: "STEP_TO", nodeId: "n1" });
    s2 = gameReducer(s2, { type: "STEP_TO", nodeId: "side" }); // 残0、side=normal
    expect(s2.phase.name).toBe("turnStart");
    expect(s2.currentPlayerIndex).toBe(1);
  });
});

describe("チャレンジ", () => {
  function toBlueChallenge(): GameState {
    let s = toMoving(started(), 1);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" }); // blue停止
    s = gameReducer(s, { type: "BEGIN_CHALLENGE", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "ボケ" });
    return s;
  }

  it("青: EVALUATEDでmoneyDelta=score×3万、PROCEEDで加算+次手番", () => {
    let s = toBlueChallenge();
    s = gameReducer(s, { type: "EVALUATED", result: { score: 4, comment: "c" } });
    expect(s.phase).toMatchObject({ name: "showingResult", moneyDelta: 4 * CHALLENGE_UNIT });
    s = gameReducer(s, { type: "PROCEED" });
    expect(s.players[0].money).toBe(INITIAL_MONEY + 4 * CHALLENGE_UNIT);
    expect(s.phase.name).toBe("turnStart");
    expect(s.currentPlayerIndex).toBe(1);
  });

  it("赤: 目標未達で(T−score)×3万減", () => {
    let s = toMoving(started(), 2);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n2" }); // red停止
    expect(s.phase).toMatchObject({ name: "challengeIntro", cellKind: "red" });
    s = gameReducer(s, { type: "BEGIN_CHALLENGE", topic, target: 4 });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "ボケ" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 2, comment: "c" } });
    expect(s.phase).toMatchObject({ name: "showingResult", moneyDelta: -2 * CHALLENGE_UNIT });
    s = gameReducer(s, { type: "PROCEED" });
    expect(s.players[0].money).toBe(INITIAL_MONEY - 2 * CHALLENGE_UNIT);
  });

  it("赤: 目標達成なら増減なし", () => {
    let s = toMoving(started(), 2);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n2" });
    s = gameReducer(s, { type: "BEGIN_CHALLENGE", topic, target: 2 });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "ボケ" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 5, comment: "c" } });
    expect(s.phase).toMatchObject({ name: "showingResult", moneyDelta: 0 });
  });
});

describe("到着と目的地", () => {
  it("目的地に踏み込んだ瞬間に到着(残歩数切捨て)+30万+arrival演出", () => {
    let s = toMoving(started(), 6);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n2" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "dest" }); // 残3あるが到着
    expect(s.phase).toMatchObject({ name: "arrival", nodeId: "dest" });
    expect(s.players[0].money).toBe(INITIAL_MONEY + ARRIVAL_PRIZE);
    expect(s.players[0].arrivals).toBe(1);
  });

  it("ARRIVAL_DONEで次目的地設定+次手番", () => {
    let s = toMoving(started(), 3);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n2" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "dest" });
    s = gameReducer(s, { type: "ARRIVAL_DONE", nextDestinationId: "start" });
    expect(s.destinationId).toBe("start");
    expect(s.phase.name).toBe("turnStart");
    expect(s.currentPlayerIndex).toBe(1);
  });
});

describe("勝敗", () => {
  it("ターン終了時に100万以上で即gameResult+winnerId", () => {
    let s = started();
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, money: WIN_MONEY - CHALLENGE_UNIT } : p)) };
    // 青チャレンジで4×3万獲得 → 100万超え
    s = toMoving(s, 1);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "BEGIN_CHALLENGE", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "ボケ" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 4, comment: "c" } });
    s = gameReducer(s, { type: "PROCEED" });
    expect(s.phase.name).toBe("gameResult");
    expect(s.winnerId).toBe(0);
  });

  it("MAX_ROUNDS周終了でgameResult(winnerIdはnull=金額判定)", () => {
    let s = started();
    s = { ...s, round: MAX_ROUNDS, currentPlayerIndex: 1 }; // 最終周の最終手番
    s = toMoving(s, 2);
    s = gameReducer(s, { type: "STEP_TO", nodeId: "n1" });
    s = gameReducer(s, { type: "STEP_TO", nodeId: "side" }); // normal停止→ターン終了
    expect(s.phase.name).toBe("gameResult");
    expect(s.winnerId).toBeNull();
  });

  it("RESTARTでtitleへ", () => {
    let s = started();
    s = { ...s, phase: { name: "gameResult" } };
    s = gameReducer(s, { type: "RESTART" });
    expect(s.phase.name).toBe("title");
  });
});
```

- [ ] **Step 4: RED確認**

Run: `npx vitest run src/game/state.test.ts`
Expected: FAIL(型・アクション不一致で多数)

- [ ] **Step 5: state.ts v2 実装**

```ts
import { buildNodeMap, moveOptions } from "./graph";
import {
  applyMoney, ARRIVAL_PRIZE, BEST_ANSWER_MIN_SCORE, blueGain, INITIAL_MONEY,
  MAX_ROUNDS, redLoss, TIME_UP_RESULT, WIN_MONEY,
} from "./rules";
import type {
  BestAnswer, EvaluationResult, MapNode, Player, PlayerConfig, Topic,
} from "./types";

export type AnswerContext =
  | { kind: "main" }
  | { kind: "blue" }
  | { kind: "red"; target: number };

export type Phase =
  | { name: "title" }
  | { name: "setup" }
  | { name: "turnStart" }
  | { name: "awaitingAnswer"; topic: Topic; context: AnswerContext }
  | { name: "evaluating"; topic: Topic; answer: string; context: AnswerContext }
  | {
      name: "showingResult";
      topic: Topic;
      answer: string;
      result: EvaluationResult;
      context: AnswerContext;
      moneyDelta: number; // チャレンジの増減額(mainは0)。PROCEEDで適用
    }
  | { name: "moving"; remaining: number; cameFrom: string | null }
  | { name: "challengeIntro"; cellKind: "blue" | "red" }
  | { name: "arrival"; nodeId: string }
  | { name: "gameResult" };

export interface GameState {
  phase: Phase;
  nodes: MapNode[];
  players: Player[];
  currentPlayerIndex: number;
  destinationId: string | null;
  round: number; // 1始まり。全員が1手番終えると+1
  usedTopicIds: string[];
  bestAnswers: BestAnswer[];
  winnerId: number | null; // 100万達成者。round切れ終了時はnull
}

export type GameAction =
  | { type: "SHOW_SETUP" }
  | {
      type: "START_GAME";
      players: PlayerConfig[];
      nodes: MapNode[];
      startId: string;
      destinationId: string;
    }
  | { type: "BEGIN_TURN"; topic: Topic }
  | { type: "BEGIN_CHALLENGE"; topic: Topic; target?: number }
  | { type: "SUBMIT_ANSWER"; answer: string }
  | { type: "TIME_UP" }
  | { type: "EVALUATED"; result: EvaluationResult }
  | { type: "RE_EVALUATE" }
  | { type: "PROCEED" }
  | { type: "STEP_TO"; nodeId: string }
  | { type: "ARRIVAL_DONE"; nextDestinationId: string }
  | { type: "RESTART" };

export const initialState: GameState = {
  phase: { name: "title" },
  nodes: [],
  players: [],
  currentPlayerIndex: 0,
  destinationId: null,
  round: 1,
  usedTopicIds: [],
  bestAnswers: [],
  winnerId: null,
};

export function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function updateCurrentPlayer(state: GameState, patch: Partial<Player>): Player[] {
  return state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, ...patch } : p,
  );
}

function findNode(state: GameState, id: string): MapNode {
  const node = state.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`unknown node: ${id}`);
  return node;
}

/** ターン終了処理: 勝利判定→周回判定→次手番 */
function endTurn(state: GameState): GameState {
  const player = currentPlayer(state);
  if (player.money >= WIN_MONEY) {
    return { ...state, winnerId: player.id, phase: { name: "gameResult" } };
  }
  const isLastPlayer = state.currentPlayerIndex === state.players.length - 1;
  if (isLastPlayer && state.round >= MAX_ROUNDS) {
    return { ...state, phase: { name: "gameResult" } };
  }
  return {
    ...state,
    currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
    round: isLastPlayer ? state.round + 1 : state.round,
    phase: { name: "turnStart" },
  };
}

/** 記録対象ならベスト回答に追加 */
function recordBest(
  state: GameState, topic: Topic, answer: string, result: EvaluationResult,
): BestAnswer[] {
  if (result.score < BEST_ANSWER_MIN_SCORE || answer === "") return state.bestAnswers;
  const player = currentPlayer(state);
  return [
    ...state.bestAnswers,
    {
      playerName: player.name,
      topicPrompt: topic.prompt,
      answer,
      score: result.score,
      comment: result.comment,
    },
  ];
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const phase = state.phase;

  switch (action.type) {
    case "SHOW_SETUP":
      if (phase.name !== "title") return state;
      return { ...state, phase: { name: "setup" } };

    case "START_GAME": {
      if (phase.name !== "setup") return state;
      buildNodeMap(action.nodes); // 整合性検証(不正ならthrow)
      const players: Player[] = action.players.map((c, i) => ({
        id: i,
        name: c.name,
        kind: c.kind,
        personality: c.personality,
        position: action.startId,
        money: INITIAL_MONEY,
        arrivals: 0,
      }));
      return {
        ...initialState,
        nodes: action.nodes,
        players,
        destinationId: action.destinationId,
        phase: { name: "turnStart" },
      };
    }

    case "BEGIN_TURN":
      if (phase.name !== "turnStart") return state;
      return {
        ...state,
        usedTopicIds: [...state.usedTopicIds, action.topic.id],
        phase: { name: "awaitingAnswer", topic: action.topic, context: { kind: "main" } },
      };

    case "BEGIN_CHALLENGE": {
      if (phase.name !== "challengeIntro") return state;
      const context: AnswerContext =
        phase.cellKind === "red"
          ? { kind: "red", target: action.target ?? 1 }
          : { kind: "blue" };
      return {
        ...state,
        usedTopicIds: [...state.usedTopicIds, action.topic.id],
        phase: { name: "awaitingAnswer", topic: action.topic, context },
      };
    }

    case "SUBMIT_ANSWER":
      if (phase.name !== "awaitingAnswer") return state;
      return {
        ...state,
        phase: {
          name: "evaluating", topic: phase.topic, answer: action.answer, context: phase.context,
        },
      };

    case "TIME_UP":
      if (phase.name !== "awaitingAnswer") return state;
      return {
        ...state,
        phase: {
          name: "showingResult",
          topic: phase.topic,
          answer: "",
          result: TIME_UP_RESULT,
          context: phase.context,
          moneyDelta: challengeDelta(phase.context, TIME_UP_RESULT.score),
        },
      };

    case "EVALUATED":
      if (phase.name !== "evaluating") return state;
      return {
        ...state,
        phase: {
          name: "showingResult",
          topic: phase.topic,
          answer: phase.answer,
          result: action.result,
          context: phase.context,
          moneyDelta: challengeDelta(phase.context, action.result.score),
        },
      };

    case "RE_EVALUATE":
      if (phase.name !== "showingResult") return state;
      return {
        ...state,
        phase: {
          name: "evaluating", topic: phase.topic, answer: phase.answer, context: phase.context,
        },
      };

    case "PROCEED": {
      if (phase.name !== "showingResult") return state;
      const bestAnswers = recordBest(state, phase.topic, phase.answer, phase.result);
      if (phase.context.kind === "main") {
        return {
          ...state,
          bestAnswers,
          phase: { name: "moving", remaining: phase.result.score, cameFrom: null },
        };
      }
      // チャレンジ: 金銭適用してターン終了
      const player = currentPlayer(state);
      const withMoney: GameState = {
        ...state,
        bestAnswers,
        players: updateCurrentPlayer(state, {
          money: applyMoney(player.money, phase.moneyDelta),
        }),
      };
      return endTurn(withMoney);
    }

    case "STEP_TO": {
      if (phase.name !== "moving") return state;
      const player = currentPlayer(state);
      const nodeMap = buildNodeMap(state.nodes);
      const options = moveOptions(nodeMap, player.position, phase.cameFrom);
      if (!options.includes(action.nodeId)) return state;

      const moved: GameState = {
        ...state,
        players: updateCurrentPlayer(state, { position: action.nodeId }),
      };

      // 目的地通過=即到着(残歩数切捨て)
      if (action.nodeId === state.destinationId) {
        return {
          ...moved,
          players: moved.players.map((p, i) =>
            i === state.currentPlayerIndex
              ? { ...p, money: applyMoney(p.money, ARRIVAL_PRIZE), arrivals: p.arrivals + 1 }
              : p,
          ),
          phase: { name: "arrival", nodeId: action.nodeId },
        };
      }

      const remaining = phase.remaining - 1;
      if (remaining > 0) {
        return {
          ...moved,
          phase: { name: "moving", remaining, cameFrom: player.position },
        };
      }

      // 停止: マス効果判定
      const cell = findNode(state, action.nodeId).cell;
      if (cell === "blue" || cell === "red") {
        return { ...moved, phase: { name: "challengeIntro", cellKind: cell } };
      }
      return endTurn(moved);
    }

    case "ARRIVAL_DONE":
      if (phase.name !== "arrival") return state;
      return endTurn({ ...state, destinationId: action.nextDestinationId });

    case "RESTART":
      if (phase.name !== "gameResult") return state;
      return initialState;

    default:
      return state;
  }
}

/** チャレンジ文脈での金銭増減(mainは0) */
function challengeDelta(context: AnswerContext, score: number): number {
  if (context.kind === "blue") return blueGain(score);
  if (context.kind === "red") return -redLoss(context.target, score);
  return 0;
}
```

- [ ] **Step 6: rules.test.ts v2 書換 + 旧board系削除 + UI暫定修正**

`rules.test.ts` を書換:

```ts
import { describe, expect, it } from "vitest";
import { applyMoney, blueGain, CHALLENGE_UNIT, rankPlayers, redLoss } from "./rules";
import type { Player } from "./types";

const p = (id: number, money: number, arrivals = 0): Player => ({
  id, name: `P${id}`, kind: "human", position: "start", money, arrivals,
});

describe("blueGain", () => {
  it("スコア×3万", () => expect(blueGain(4)).toBe(4 * CHALLENGE_UNIT));
});

describe("redLoss", () => {
  it("未達分×3万", () => expect(redLoss(4, 1)).toBe(3 * CHALLENGE_UNIT));
  it("達成なら0", () => expect(redLoss(2, 5)).toBe(0));
});

describe("applyMoney", () => {
  it("加算", () => expect(applyMoney(10000, 30000)).toBe(40000));
  it("0未満にならない", () => expect(applyMoney(10000, -20000)).toBe(0));
});

describe("rankPlayers", () => {
  it("所持金降順・同額は到着数降順", () => {
    const ranked = rankPlayers([p(1, 100, 0), p(2, 300), p(3, 300, 2)]);
    expect(ranked.map((x) => x.id)).toEqual([3, 2, 1]);
  });
});
```

削除: `board.ts` / `board.test.ts` / `board.json` / `gen-board.mjs`

UI暫定修正(このタスクではビルドgreen維持が目的、本実装はV3/V4):
- `App.tsx`: 全面を暫定シェルに置換 — title/setupのみ動作、`startGame` は `map.json` から `nodes` を読み、`startId: "shinjuku"`、`destinationId` は `destinationCandidates` から `pickDestination(nodes, ["shinjuku"])` で選出(下記ヘルパー)。turnStart以降は「v2実装中」パネル表示。旧BoardView/Hud/TopicCard等のimportは一旦外す
- `BoardView.tsx`, `GameResultScreen.tsx`, `ResultOverlay.tsx`, `CellEffectPopup.tsx` は削除(V3/V4で新規作成)。`TopicCard.tsx`/`AnswerInput.tsx`/`TitleScreen.tsx`/`SetupScreen.tsx`/`Hud.tsx` は残す(Hudは一時的にimportされなくてよい — 未使用ファイルはビルドを壊さない)
- `game/destination.ts` を新規作成(小ヘルパー、テスト付き):

```ts
import { destinationCandidates } from "./graph";
import type { MapNode } from "./types";

/** 除外id(現目的地や現在地)以外からランダムに目的地を選ぶ */
export function pickDestination(
  nodes: MapNode[], excludeIds: string[], random: () => number = Math.random,
): string {
  const pool = destinationCandidates(nodes).filter((n) => !excludeIds.includes(n.id));
  const list = pool.length > 0 ? pool : destinationCandidates(nodes);
  return list[Math.floor(random() * list.length)].id;
}
```

`game/destination.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickDestination } from "./destination";
import type { MapNode } from "./types";

const n = (id: string, kind: MapNode["kind"]): MapNode => ({
  id, name: id, kind, cell: "normal", x: 0, y: 0, neighbors: [],
});
const nodes = [n("a", "theater"), n("b", "tv"), n("c", "station")];

describe("pickDestination", () => {
  it("除外idを避けて選ぶ", () => {
    expect(pickDestination(nodes, ["a"], () => 0)).toBe("b");
  });
  it("stationは選ばれない", () => {
    expect(pickDestination(nodes, [], () => 0.99)).toBe("b");
  });
  it("全除外なら全候補から", () => {
    expect(pickDestination(nodes, ["a", "b"], () => 0)).toBe("a");
  });
});
```

- [ ] **Step 7: GREEN確認 + コミット**

Run: `npx vitest run`(全PASS、旧board/古いstateテストが消えていること) + `npm run build`

```powershell
git add -A app
git commit -m "feat: ステートマシンv2(手動移動・チャレンジ・目的地・100万勝利)へ全面書換"
```

---

### Task V3: アイソメ盤面(IsoMapView)+移動UI+App v2オーケストレーション

**Files:**
- Create: `app/src/components/IsoMapView.tsx`, `app/src/components/MoveControls.tsx`
- Modify: `app/src/components/App.tsx`(v2本実装), `app/src/components/Hud.tsx`, `app/src/index.css`(追記)
- Modify: `app/src/ui/constants.ts`(追記)

**Interfaces:**
- Consumes: V1/V2 の全ゲームAPI、既存 TopicCard/AnswerInput/TitleScreen/SetupScreen/useCountdown/evaluator
- Produces:
  - `IsoMapView({nodes, players, currentPlayerIndex, destinationId})` — 全画面SVG。アイソメ配置は map.json の座標をそのまま使用(viewBox 0 0 1280 960)。道=エッジ線、マス=菱形タイル(blue/red色)、拠点=アイソメボックス+名前ラベル+kind絵文字(theater🎭/tv📺/station🚉)、目的地=旗🚩バウンド、コマ=色丸(v1同様)。カメラ追従(v1方式のtranslate+transition)
  - `MoveControls({options, nodes, currentId, onStep, remaining})` — 画面下部に方向ボタン群(移動先ノードの相対方位を矢印+ラベルで表示)。矢印キー(ArrowUp/Down/Left/Right)は相対方位が最も近い候補にマップ。残り歩数バッジ表示
  - `ui/constants.ts` 追記: `ARRIVAL_MS = 2200`, `CHALLENGE_INTRO_MS = 1800`
  - App v2: フェーズ副作用 — turnStart→BEGIN_TURN / awaitingAnswer(CPU)→cpuAnswer→SUBMIT / evaluating→evaluate→EVALUATED / moving(CPU)→`nextStepToward` を MOVE_STEP_MS*1.5 間隔でSTEP_TO / challengeIntro→CHALLENGE_INTRO_MS後に(redなら`1+floor(random*4)`のtarget付きで)BEGIN_CHALLENGE / arrival→ARRIVAL_MS後に`pickDestination(nodes, [到着nodeId])`でARRIVAL_DONE / タイマーは人間のawaitingAnswerのみ

- [ ] **Step 1: constants追記 / index.css追記(アイソメ盤・矢印ボタン・旗バウンド)**

CSS追記(既存に加える):

```css
/* --- v2: アイソメ盤 --- */
.iso-node-label { font-size: 15px; font-weight: 700; fill: #fff; text-anchor: middle;
  paint-order: stroke; stroke: rgba(0,0,0,0.6); stroke-width: 3px; }
.iso-tile { stroke: rgba(255,255,255,0.35); stroke-width: 1.5; }
.destination-flag { animation: flag-bounce 1s ease-in-out infinite; }
@keyframes flag-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

/* --- 移動UI --- */
.move-controls { position: absolute; bottom: 14px; left: 0; right: 0;
  display: flex; justify-content: center; gap: 10px; z-index: 20; flex-wrap: wrap; }
.move-controls button { padding: 12px 18px; font-size: 15px; font-weight: 700;
  border: 2px solid var(--accent); border-radius: var(--radius);
  background: var(--panel); color: var(--text); cursor: pointer; }
.move-remaining { position: absolute; bottom: 70px; left: 50%; transform: translateX(-50%);
  background: var(--accent); color: #241c00; font-weight: 900; padding: 4px 16px;
  border-radius: 999px; z-index: 20; }

/* --- 状態ライト(SCENE_STRUCTURE準拠) --- */
.stage { transition: background 0.6s ease; background: var(--bg); }
.stage.state-evaluating { background: #3a2a08; }
.stage.state-result { animation: result-flash 0.6s ease; }
@keyframes result-flash { 0% { background: #5a4a10; } 100% { background: var(--bg); } }
```

- [ ] **Step 2: IsoMapView.tsx**

```tsx
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
```

- [ ] **Step 3: MoveControls.tsx**

```tsx
import { useEffect } from "react";
import type { MapNode } from "../game/types";

interface Props {
  options: string[]; // 移動先候補ノードid
  nodes: Map<string, MapNode>;
  currentId: string;
  remaining: number;
  onStep: (nodeId: string) => void;
}

/** 相対方位から矢印記号を決める */
function arrowFor(dx: number, dy: number): string {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "→" : "←";
  return dy > 0 ? "↓" : "↑";
}

const KEY_TO_DIR: Record<string, [number, number]> = {
  ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1],
};

export function MoveControls({ options, nodes, currentId, remaining, onStep }: Props) {
  const cur = nodes.get(currentId)!;
  const candidates = options.map((id) => {
    const n = nodes.get(id)!;
    return { id, node: n, dx: n.x - cur.x, dy: n.y - cur.y };
  });

  // 矢印キー: 方向ベクトルの内積が最大の候補へ
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      let best: string | null = null;
      let bestDot = 0;
      for (const c of candidates) {
        const len = Math.hypot(c.dx, c.dy) || 1;
        const dot = (c.dx / len) * dir[0] + (c.dy / len) * dir[1];
        if (dot > bestDot) { bestDot = dot; best = c.id; }
      }
      if (best) onStep(best);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [candidates, onStep]);

  return (
    <>
      <div className="move-remaining">あと {remaining} マス</div>
      <div className="move-controls">
        {candidates.map((c) => (
          <button key={c.id} onClick={() => onStep(c.id)}>
            {arrowFor(c.dx, c.dy)} {c.node.name || "すすむ"}
          </button>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Hud.tsx v2 書換**

```tsx
import type { MapNode, Player } from "../game/types";

interface Props {
  players: Player[];
  currentPlayerIndex: number;
  destination: MapNode | null;
  round: number;
  maxRounds: number;
}

const fmt = (n: number) => `${Math.round(n / 10000)}万円`;

export function Hud({ players, currentPlayerIndex, destination, round, maxRounds }: Props) {
  return (
    <div className="hud">
      {players.map((p, i) => (
        <span key={p.id} className={`hud-player${i === currentPlayerIndex ? " current" : ""}`}>
          {p.kind === "cpu" ? "🤖" : "😀"} {p.name}: {fmt(p.money)}
          {p.arrivals > 0 && ` 🏁×${p.arrivals}`}
        </span>
      ))}
      <span className="hud-player" style={{ marginLeft: "auto" }}>
        🚩 {destination?.name ?? "?"} ／ {round}/{maxRounds}周
      </span>
    </div>
  );
}
```

- [ ] **Step 5: App.tsx v2 本実装**

```tsx
import { useEffect, useMemo, useReducer, useState } from "react";
import { currentPlayer, gameReducer, initialState } from "./game/state";
import { pickRandomTopic } from "./game/topics";
import { pickDestination } from "./game/destination";
import { buildNodeMap, moveOptions, nextStepToward } from "./game/graph";
import { ANSWER_TIME_LIMIT_MS, MAX_ROUNDS, WIN_MONEY } from "./game/rules";
import mapData from "./data/map.json";
import topicsData from "./data/topics.json";
import type { MapNode, PlayerConfig, Topic } from "./game/types";
import { createEvaluator } from "./ai";
import { useCountdown } from "./hooks/useCountdown";
import {
  ARRIVAL_MS, CAMERA_SETTLE_MS, CHALLENGE_INTRO_MS, CPU_SUBMIT_DELAY_MS, MOVE_STEP_MS,
} from "./ui/constants";
import { TitleScreen } from "./components/TitleScreen";
import { SetupScreen } from "./components/SetupScreen";
import { IsoMapView } from "./components/IsoMapView";
import { Hud } from "./components/Hud";
import { TopicCard } from "./components/TopicCard";
import { AnswerInput } from "./components/AnswerInput";
import { MoveControls } from "./components/MoveControls";
import { ResultOverlay } from "./components/ResultOverlay";
import { ChallengeIntro } from "./components/ChallengeIntro";
import { ArrivalOverlay } from "./components/ArrivalOverlay";
import { GameResultScreen } from "./components/GameResultScreen";

const nodes = (mapData as { nodes: MapNode[] }).nodes;
const topics = (topicsData as { topics: Topic[] }).topics;
const START_ID = "shinjuku";

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const evaluator = useMemo(() => createEvaluator(), []);
  const nodeMap = useMemo(() => buildNodeMap(nodes), []);
  const [cpuAnswer, setCpuAnswer] = useState<string | null>(null);
  const phase = state.phase;
  const player = state.players.length > 0 ? currentPlayer(state) : null;
  const isCpuTurn = player?.kind === "cpu";

  // turnStart: カメラ移動を待ってお題
  useEffect(() => {
    if (phase.name !== "turnStart") return;
    const t = setTimeout(() => {
      dispatch({ type: "BEGIN_TURN", topic: pickRandomTopic(topics, state.usedTopicIds) });
    }, CAMERA_SETTLE_MS);
    return () => clearTimeout(t);
  }, [phase, state.usedTopicIds]);

  // challengeIntro: 告知後にチャレンジお題(赤は目標値1〜4)
  useEffect(() => {
    if (phase.name !== "challengeIntro") return;
    const t = setTimeout(() => {
      dispatch({
        type: "BEGIN_CHALLENGE",
        topic: pickRandomTopic(topics, state.usedTopicIds),
        target: phase.cellKind === "red" ? 1 + Math.floor(Math.random() * 4) : undefined,
      });
    }, CHALLENGE_INTRO_MS);
    return () => clearTimeout(t);
  }, [phase, state.usedTopicIds]);

  // CPU回答(メイン/チャレンジ共通)
  useEffect(() => {
    if (phase.name !== "awaitingAnswer" || !isCpuTurn || !player) return;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const answer = await evaluator.cpuAnswer(phase.topic.prompt, player.personality ?? "safe");
      if (cancelled) return;
      setCpuAnswer(answer);
      t = setTimeout(() => {
        setCpuAnswer(null);
        dispatch({ type: "SUBMIT_ANSWER", answer });
      }, CPU_SUBMIT_DELAY_MS);
    })();
    return () => { cancelled = true; if (t) clearTimeout(t); };
  }, [phase, isCpuTurn, player, evaluator]);

  // 採点
  useEffect(() => {
    if (phase.name !== "evaluating") return;
    let cancelled = false;
    evaluator.evaluate(phase.topic.prompt, phase.answer).then((result) => {
      if (!cancelled) dispatch({ type: "EVALUATED", result });
    });
    return () => { cancelled = true; };
  }, [phase, evaluator]);

  // CPU自動移動
  useEffect(() => {
    if (phase.name !== "moving" || !isCpuTurn || !player || !state.destinationId) return;
    const t = setTimeout(() => {
      dispatch({
        type: "STEP_TO",
        nodeId: nextStepToward(nodeMap, player.position, phase.cameFrom, state.destinationId!),
      });
    }, MOVE_STEP_MS * 1.5);
    return () => clearTimeout(t);
  }, [phase, isCpuTurn, player, state.destinationId, nodeMap]);

  // 到着演出→次目的地
  useEffect(() => {
    if (phase.name !== "arrival") return;
    const t = setTimeout(() => {
      dispatch({
        type: "ARRIVAL_DONE",
        nextDestinationId: pickDestination(nodes, [phase.nodeId]),
      });
    }, ARRIVAL_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const timerActive = phase.name === "awaitingAnswer" && !isCpuTurn;
  const remaining = useCountdown(timerActive, ANSWER_TIME_LIMIT_MS, () =>
    dispatch({ type: "TIME_UP" }),
  );

  const startGame = (players: PlayerConfig[]) =>
    dispatch({
      type: "START_GAME",
      players,
      nodes,
      startId: START_ID,
      destinationId: pickDestination(nodes, [START_ID]),
    });

  const inGame = !["title", "setup"].includes(phase.name);
  const destination = state.destinationId ? (nodeMap.get(state.destinationId) ?? null) : null;

  const stateClass =
    phase.name === "evaluating" ? " state-evaluating"
    : phase.name === "showingResult" ? " state-result"
    : "";

  return (
    <div className={`stage${stateClass}`}>
      {inGame && (
        <>
          <IsoMapView
            nodes={state.nodes}
            players={state.players}
            currentPlayerIndex={state.currentPlayerIndex}
            destinationId={state.destinationId}
          />
          <Hud
            players={state.players}
            currentPlayerIndex={state.currentPlayerIndex}
            destination={destination}
            round={state.round}
            maxRounds={MAX_ROUNDS}
          />
        </>
      )}

      {phase.name === "title" && (
        <TitleScreen onStart={() => dispatch({ type: "SHOW_SETUP" })} />
      )}
      {phase.name === "setup" && <SetupScreen onSubmit={startGame} />}

      {(phase.name === "awaitingAnswer" || phase.name === "evaluating") && (
        <>
          <div className="overlay transparent" style={{ justifyContent: "flex-start", paddingTop: "16vh" }}>
            <TopicCard
              topic={phase.topic}
              judging={phase.name === "evaluating"}
              context={phase.context}
            />
          </div>
          {timerActive && (
            <div className="timer-bar">
              <div className="fill" style={{ width: `${(remaining / ANSWER_TIME_LIMIT_MS) * 100}%` }} />
            </div>
          )}
          <AnswerInput
            disabled={phase.name === "evaluating"}
            cpuAnswer={phase.name === "awaitingAnswer" && isCpuTurn ? (cpuAnswer ?? "…") : null}
            onSubmit={(answer) => dispatch({ type: "SUBMIT_ANSWER", answer })}
          />
        </>
      )}

      {phase.name === "moving" && player && !isCpuTurn && (
        <MoveControls
          options={moveOptions(nodeMap, player.position, phase.cameFrom)}
          nodes={nodeMap}
          currentId={player.position}
          remaining={phase.remaining}
          onStep={(nodeId) => dispatch({ type: "STEP_TO", nodeId })}
        />
      )}

      {phase.name === "challengeIntro" && <ChallengeIntro cellKind={phase.cellKind} />}

      {phase.name === "showingResult" && player && (
        <ResultOverlay
          result={phase.result}
          answer={phase.answer}
          playerName={player.name}
          context={phase.context}
          moneyDelta={phase.moneyDelta}
          onProceed={() => dispatch({ type: "PROCEED" })}
          onRetry={() => dispatch({ type: "RE_EVALUATE" })}
        />
      )}

      {phase.name === "arrival" && destination && (
        <ArrivalOverlay name={nodeMap.get(phase.nodeId)?.name ?? ""} />
      )}

      {phase.name === "gameResult" && (
        <GameResultScreen
          players={state.players}
          bestAnswers={state.bestAnswers}
          winnerId={state.winnerId}
          winMoney={WIN_MONEY}
          onRestart={() => dispatch({ type: "RESTART" })}
        />
      )}
    </div>
  );
}
```

注: `ChallengeIntro`/`ArrivalOverlay`/`ResultOverlay`(v2 props)/`GameResultScreen` はV4で実装。このタスクではコンパイルを通すために**V4のコンポーネントも最小スタブではなく本実装まで一気に行うか、V3/V4を1コミットに統合してよい**(コントローラ判断: V3とV4は同一実装者が連続で行う)。

- [ ] **Step 6: TopicCard に context プロップ追加(小改修)**

```tsx
import type { AnswerContext } from "../game/state";
import type { Topic } from "../game/types";

interface Props {
  topic: Topic;
  judging: boolean;
  context: AnswerContext;
}

export function TopicCard({ topic, judging, context }: Props) {
  const banner =
    context.kind === "blue" ? "🟦 チャンス大喜利！ スコア×3万円ゲット"
    : context.kind === "red" ? `🟥 ピンチ大喜利！ 目標 ${context.target} 点未満で罰金`
    : null;
  return (
    <div className={`topic-card${judging ? " judging" : ""}`}>
      {banner && <div className="category" style={{ fontWeight: 700 }}>{banner}</div>}
      <div className="category">{topic.category}</div>
      <div className="prompt">{judging ? "審査中…！" : topic.prompt}</div>
    </div>
  );
}
```

- [ ] **Step 7: テスト+ビルド+コミット**(V4と統合コミット可)

---

### Task V4: チャレンジ告知・到着演出・結果オーバーレイv2・リザルトv2

**Files:**
- Create: `app/src/components/ChallengeIntro.tsx`, `app/src/components/ArrivalOverlay.tsx`, `app/src/components/ResultOverlay.tsx`, `app/src/components/GameResultScreen.tsx`

**Interfaces:**
- Consumes: V2の型(`AnswerContext`)、rules(`rankPlayers`)
- Produces: App v2(V3)が参照する4コンポーネント

- [ ] **Step 1: ChallengeIntro.tsx**

```tsx
interface Props {
  cellKind: "blue" | "red";
}

export function ChallengeIntro({ cellKind }: Props) {
  const blue = cellKind === "blue";
  return (
    <div className="overlay transparent">
      <div className={`effect-popup ${blue ? "gain" : "loss"}`}>
        {blue ? "🟦 チャンスマス！" : "🟥 ピンチマス！"}
        <div style={{ fontSize: 18, marginTop: 8 }}>
          {blue ? "追加お題でボーナスを狙え！" : "追加お題！スベると罰金…"}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ArrivalOverlay.tsx**

```tsx
import { ARRIVAL_PRIZE } from "../game/rules";

interface Props {
  name: string; // 到着した拠点名
}

export function ArrivalOverlay({ name }: Props) {
  return (
    <div className="overlay">
      <div className="score-big">🎉 {name} 到着！</div>
      <div className="comment-bubble">到着ボーナス +{ARRIVAL_PRIZE / 10000}万円！</div>
      <div style={{ opacity: 0.85 }}>次の目的地を抽選中…</div>
    </div>
  );
}
```

- [ ] **Step 3: ResultOverlay.tsx(v2)**

```tsx
import { useEffect, useState } from "react";
import type { AnswerContext } from "../game/state";
import type { EvaluationResult } from "../game/types";
import { RESULT_REVEAL_MS } from "../ui/constants";

interface Props {
  result: EvaluationResult;
  answer: string;
  playerName: string;
  context: AnswerContext;
  moneyDelta: number;
  onProceed: () => void;
  onRetry: () => void;
}

export function ResultOverlay({
  result, answer, playerName, context, moneyDelta, onProceed, onRetry,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), RESULT_REVEAL_MS);
    return () => clearTimeout(t);
  }, []);

  const proceedLabel =
    context.kind === "main" ? `${result.score}マス進む！` : "OK";
  const deltaText =
    context.kind === "main" ? null
    : moneyDelta > 0 ? `💰 +${moneyDelta / 10000}万円！`
    : moneyDelta < 0 ? `💸 ${moneyDelta / 10000}万円…`
    : "セーフ！増減なし";

  return (
    <div className="overlay">
      <div style={{ opacity: 0.8 }}>{playerName} の回答</div>
      {answer !== "" && <div className="comment-bubble">{answer}</div>}
      {!revealed ? (
        <div className="score-big">🥁</div>
      ) : (
        <>
          <div className="score-big">{result.score}点</div>
          <div className="comment-bubble">{result.comment}</div>
          {deltaText && <div className="score-big" style={{ fontSize: 32 }}>{deltaText}</div>}
          <div style={{ display: "flex", gap: 12 }}>
            <button className="primary" onClick={onProceed}>{proceedLabel}</button>
            {result.fallback && (
              <button className="ghost" onClick={onRetry}>もう一度審査</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: GameResultScreen.tsx(v2)**

```tsx
import { rankPlayers } from "../game/rules";
import type { BestAnswer, Player } from "../game/types";

interface Props {
  players: Player[];
  bestAnswers: BestAnswer[];
  winnerId: number | null;
  winMoney: number;
  onRestart: () => void;
}

const fmt = (n: number) => `${Math.round(n / 10000)}万円`;
const MEDALS = ["🥇", "🥈", "🥉", "4位"];

export function GameResultScreen({ players, bestAnswers, winnerId, winMoney, onRestart }: Props) {
  const ranked = rankPlayers(players);
  const winner = winnerId !== null ? players.find((p) => p.id === winnerId) : ranked[0];
  return (
    <div className="overlay">
      <div className="panel">
        <h2>🎭 結果発表</h2>
        <p style={{ margin: "8px 0" }}>
          {winnerId !== null
            ? `${winner?.name} が${winMoney / 10000}万円達成で優勝！`
            : `規定周回終了！ 最多所持金の ${winner?.name} が優勝！`}
        </p>
        <ol className="rank-list">
          {ranked.map((p, i) => (
            <li key={p.id}>
              <span>{MEDALS[i] ?? `${i + 1}位`} {p.name}</span>
              <span>{fmt(p.money)} ／ 🏁×{p.arrivals}</span>
            </li>
          ))}
        </ol>
        {bestAnswers.length > 0 && (
          <div className="best-answers">
            <h3 style={{ marginBottom: 8 }}>✨ 今日のベスト回答</h3>
            {bestAnswers.map((b, i) => (
              <div className="item" key={i}>
                <div style={{ opacity: 0.7 }}>{b.topicPrompt}</div>
                <div style={{ fontWeight: 700, margin: "4px 0" }}>
                  {b.playerName}「{b.answer}」({b.score}点)
                </div>
                <div style={{ opacity: 0.8 }}>{b.comment}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button className="primary" onClick={onRestart}>タイトルへ戻る</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 全テスト+ビルド+手動確認+コミット**

Run: `npm test` 全PASS + `npm run build` green。
手動確認(コントローラが最終実施するが実装者もdev serverでベストエフォート):
1. 開始→新宿スタート、目的地旗表示
2. 回答→採点→「Nマス進む！」→方向ボタンで手動移動、残り歩数表示
3. 青マス停止→チャンス告知→追加お題→+金額表示
4. 赤マス停止→目標値表示→未達で減額
5. 目的地到達→到着演出→次目的地
6. CPUが自動移動する
7. 15秒タイマー・時間切れ

```powershell
git add -A app
git commit -m "feat: アイソメ盤面・手動移動・チャレンジ・到着演出のv2 UIを実装"
```

(V3とV4は同一実装者が1〜2コミットで実施してよい)

---

### Task V5〜V8: Worker連携とデプロイ(v1計画の流用)

旧計画 `docs/superpowers/plans/2026-07-07-ogiri-dice-web.md` の以下タスクをそのまま実行する(v2で変更不要 — Evaluatorインターフェース・Workerは盤面に依存しない):

- **V5** = 旧Task 11: Worker純ロジック(prompts/rateLimiter/gemini抽出)
- **V6** = 旧Task 12: Workerハンドラ+wrangler設定+ローカル疎通(ユーザーのAPIキーが必要)
- **V7** = 旧Task 13: ApiEvaluator+本番切替
- **V8** = 旧Task 14: デプロイ+README刷新。ただしREADMEのルール説明はv2仕様(15秒・手動移動・青赤チャレンジ・目的地・100万円)に書き換えること

---

## 実装後の任意フォローアップ(本計画スコープ外)

- アイソメ盤のビジュアル強化(建物イラスト・道の立体化・効果音)
- イベントマス(スペックの将来拡張)
- 移動アニメーションの滑らかな補間
