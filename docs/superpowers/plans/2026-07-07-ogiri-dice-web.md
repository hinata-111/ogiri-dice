# ogiri-dice Web版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 大喜利回答をGeminiが採点し、スコア分だけすごろく盤を進むブラウザゲーム(React+TS)を、モック評価器でオフライン動作可能な形で構築し、Cloudflare Worker経由でGemini連携する。

**Architecture:** モノレポ2パッケージ(`app/`=Vite+React+TS、`worker/`=Cloudflare Worker)。ゲームロジックはReact非依存の純TS(`app/src/game/`)にreducerステートマシンとして隔離し、評価器は`Evaluator`インターフェースでGemini実装/モック実装を差替可能にする。UIは全画面SVG盤面の上にHUD/カード/入力欄をオーバーレイする。

**Tech Stack:** React 18+ / TypeScript / Vite / Vitest / @testing-library/react / Cloudflare Workers (wrangler) / Gemini API (gemini-2.5-flash, Structured Output)

## Global Constraints

- 設計書: `docs/superpowers/specs/2026-07-07-ogiri-dice-web-redesign-design.md`
- Node.js 20以上を使用。パッケージマネージャは npm。
- Geminiモデルは `gemini-2.5-flash` 固定。Structured Output(`responseSchema`)必須。
- APIキーはWorkerのSecret(`GEMINI_API_KEY`)のみ。クライアントコード・リポジトリに絶対に置かない。
- スコアは1〜6の整数。**スコア=進むマス数**。
- 賞金定数: スコア1点あたり2万円、ゴール賞金は到達順に[30万,20万,10万,5万]、青マス+3万、赤マス-2万。所持金の下限は0。
- 回答制限時間60秒。時間切れは `score=1 / comment="時間切れ！"`。
- 評価失敗時フォールバック: `score=3 / comment="電波の関係で審査員が聞き取れなかったらしい…"` + 「もう一度審査」ボタン。
- UI文言は日本語。コードの識別子は英語。
- 既存の `GameCanvas-Unity-master/` と旧ドキュメントには触らない(残置)。
- コミットメッセージ末尾: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## File Structure

```
ogiri-dice/
├─ app/                          Vite React-TS アプリ
│  ├─ vite.config.ts             Vitest設定 + /api devプロキシ
│  ├─ scripts/gen-board.mjs      board.json 生成スクリプト
│  └─ src/
│     ├─ game/                   純ロジック層(React非依存)
│     │  ├─ types.ts             全共有型
│     │  ├─ rules.ts             賞金・勝敗・定数
│     │  ├─ board.ts             移動・ゴール・マス効果
│     │  ├─ topics.ts            お題ランダム選択
│     │  └─ state.ts             GameState + reducer(状態遷移の全て)
│     ├─ ai/                     評価層
│     │  ├─ evaluator.ts         Evaluatorインターフェース + フォールバック定数
│     │  ├─ mock.ts              MockEvaluator(オフライン用)
│     │  ├─ api.ts               ApiEvaluator(Worker経由、タイムアウト/リトライ)
│     │  └─ index.ts             createEvaluator(環境変数で切替)
│     ├─ components/             表示層
│     │  ├─ App.tsx              useReducer + フェーズ進行オーケストレーション
│     │  ├─ BoardView.tsx        全画面SVG盤面 + カメラ追従 + コマ
│     │  ├─ TitleScreen.tsx      タイトルパネル
│     │  ├─ SetupScreen.tsx      プレイヤー設定パネル
│     │  ├─ TopicCard.tsx        お題カード + 採点中演出
│     │  ├─ AnswerInput.tsx      回答入力欄 + タイマーバー
│     │  ├─ ResultOverlay.tsx    スコア発表 + ツッコミ吹き出し
│     │  ├─ CellEffectPopup.tsx  マス効果ポップアップ
│     │  ├─ Hud.tsx              所持金・手番表示
│     │  └─ GameResultScreen.tsx 順位 + ベスト回答集
│     ├─ hooks/useCountdown.ts   カウントダウンフック
│     ├─ data/topics.json        お題(既存data/topics.jsonのコピー)
│     ├─ data/board.json         盤面31マス定義(生成)
│     ├─ ui/constants.ts         アニメ時間などUI定数
│     ├─ index.css               全スタイル
│     └─ main.tsx
└─ worker/                       Cloudflare Worker
   ├─ wrangler.toml
   └─ src/
      ├─ index.ts                fetchハンドラ(ルーティング/検証/CORS)
      ├─ prompts.ts              プロンプト構築(純関数)
      ├─ gemini.ts               Gemini呼び出し + レスポンス抽出
      └─ rateLimiter.ts          IP毎レート制限(純クラス)
```

---

### Task 1: app/ スキャフォールド(Vite + React + TS + Vitest)

**Files:**
- Create: `app/`(Vite生成一式)
- Modify: `app/vite.config.ts`, `app/package.json`
- Create: `.gitignore`(ルート、node_modules等追記)

**Interfaces:**
- Produces: `npm run dev` / `npm test` が動く app パッケージ。以降の全タスクの土台。

- [ ] **Step 1: Node確認とVite生成**

```powershell
node -v   # v20以上を確認。無ければ https://nodejs.org からLTSをインストール
cd C:\Users\yos57\home\myApp\ogiri-dice
npm create vite@latest app -- --template react-ts
cd app
npm install
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: vite.config.ts をVitest+プロキシ対応に置換**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:8787" },
  },
  test: {
    environment: "jsdom",
  },
});
```

- [ ] **Step 3: package.json に test スクリプト追加**

`app/package.json` の scripts に追記:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: ルート .gitignore 作成**

ルート `C:\Users\yos57\home\myApp\ogiri-dice\.gitignore` に作成(既存があれば追記):

```
node_modules/
dist/
.env
.dev.vars
*.local
```

- [ ] **Step 5: 動作確認**

```powershell
npm run build
```

Expected: `vite build` が成功し `dist/` 生成。

```powershell
npm test
```

Expected: "No test files found" 系メッセージで終了(テスト0件、エラーでないこと)。※vitestはテスト0件で exit code 1 を返す設定がデフォルトの場合あり → その場合は正常。Task 2 以降でテストが入る。

- [ ] **Step 6: Commit**

```powershell
cd C:\Users\yos57\home\myApp\ogiri-dice
git add app .gitignore
git commit -m "feat: Vite+React+TS+Vitest で app パッケージを作成"
```

---

### Task 2: 共有型・お題データ・お題選択ロジック

**Files:**
- Create: `app/src/game/types.ts`
- Create: `app/src/game/topics.ts`
- Create: `app/src/data/topics.json`(既存 `data/topics.json` をコピー)
- Test: `app/src/game/topics.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `CellType`, `BoardCell {index,type,amount,x,y}`, `Topic {id,category,prompt,difficulty}`, `PlayerKind`, `CpuPersonality ("safe"|"bold")`, `PlayerConfig {name,kind,personality?}`, `Player {id,name,kind,personality?,position,money,goalOrder}`, `EvaluationResult {score,comment,fallback?}`, `BestAnswer {playerName,topicPrompt,answer,score,comment}`
  - `topics.ts`: `pickRandomTopic(topics: Topic[], usedIds: string[], random?: () => number): Topic`

- [ ] **Step 1: types.ts 作成**

```ts
export type CellType = "normal" | "blue" | "red" | "event";

export interface BoardCell {
  index: number;
  type: CellType;
  amount: number; // 賞金増減額(正の値)。normal/eventは0
  x: number; // SVG viewBox座標
  y: number;
}

export type Difficulty = "Easy" | "Normal" | "Hard";

export interface Topic {
  id: string;
  category: string;
  prompt: string;
  difficulty: Difficulty;
}

export type PlayerKind = "human" | "cpu";
export type CpuPersonality = "safe" | "bold";

export interface PlayerConfig {
  name: string;
  kind: PlayerKind;
  personality?: CpuPersonality;
}

export interface Player {
  id: number;
  name: string;
  kind: PlayerKind;
  personality?: CpuPersonality;
  position: number; // 現在マスindex
  money: number;
  goalOrder: number | null; // ゴール到達順(0始まり)。未到達はnull
}

export interface EvaluationResult {
  score: number; // 1-6
  comment: string;
  fallback?: boolean; // 評価失敗フォールバック値のときtrue
}

export interface BestAnswer {
  playerName: string;
  topicPrompt: string;
  answer: string;
  score: number;
  comment: string;
}
```

- [ ] **Step 2: お題データコピー**

```powershell
Copy-Item C:\Users\yos57\home\myApp\ogiri-dice\data\topics.json C:\Users\yos57\home\myApp\ogiri-dice\app\src\data\topics.json
```

(`app/src/data/` ディレクトリは先に作成。形式は `{"topics": [{id, category, prompt, difficulty}]}`、80題。)

- [ ] **Step 3: 失敗するテストを書く** — `app/src/game/topics.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { pickRandomTopic } from "./topics";
import type { Topic } from "./types";

const topics: Topic[] = [
  { id: "a", category: "c", prompt: "p1", difficulty: "Easy" },
  { id: "b", category: "c", prompt: "p2", difficulty: "Normal" },
  { id: "c", category: "c", prompt: "p3", difficulty: "Hard" },
];

describe("pickRandomTopic", () => {
  it("未使用のお題から選ぶ", () => {
    const t = pickRandomTopic(topics, ["a", "b"], () => 0);
    expect(t.id).toBe("c");
  });

  it("全て使用済みなら全体から選び直す", () => {
    const t = pickRandomTopic(topics, ["a", "b", "c"], () => 0);
    expect(t.id).toBe("a");
  });

  it("randomの値で選択が変わる", () => {
    const t = pickRandomTopic(topics, [], () => 0.99);
    expect(t.id).toBe("c");
  });
});
```

- [ ] **Step 4: テスト失敗確認**

Run: `cd app; npx vitest run src/game/topics.test.ts`
Expected: FAIL (`Cannot find module './topics'`)

- [ ] **Step 5: topics.ts 実装**

```ts
import type { Topic } from "./types";

export function pickRandomTopic(
  topics: Topic[],
  usedIds: string[],
  random: () => number = Math.random,
): Topic {
  const unused = topics.filter((t) => !usedIds.includes(t.id));
  const pool = unused.length > 0 ? unused : topics;
  return pool[Math.floor(random() * pool.length)];
}
```

- [ ] **Step 6: テスト成功確認**

Run: `npx vitest run src/game/topics.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```powershell
git add app/src/game app/src/data/topics.json
git commit -m "feat: 共有型定義とお題選択ロジックを追加"
```

---

### Task 3: 盤面生成・移動・賞金ルール

**Files:**
- Create: `app/src/game/board.ts`, `app/src/game/rules.ts`
- Create: `app/scripts/gen-board.mjs`, 生成物 `app/src/data/board.json`
- Test: `app/src/game/board.test.ts`, `app/src/game/rules.test.ts`

**Interfaces:**
- Consumes: `types.ts` の `BoardCell`, `EvaluationResult`, `Player`
- Produces:
  - `board.ts`: `moveTo(position, steps, boardSize): number` / `isGoal(position, boardSize): boolean` / `cellEffectDelta(cell): number`
  - `rules.ts`: 定数 `PRIZE_PER_SCORE=20000`, `GOAL_PRIZES=[300000,200000,100000,50000]`, `ANSWER_TIME_LIMIT_MS=60000`, `BEST_ANSWER_MIN_SCORE=5`, `TIME_UP_RESULT` / 関数 `answerPrize(score)`, `goalPrize(goalOrder)`, `applyMoney(money, delta)`, `rankPlayers(players)`
  - `board.json`: `{ "cells": BoardCell[31] }`(index 0=スタート、30=ゴール、蛇行座標付き)

- [ ] **Step 1: 失敗するテストを書く** — `app/src/game/board.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { cellEffectDelta, isGoal, moveTo } from "./board";
import type { BoardCell } from "./types";

const cell = (type: BoardCell["type"], amount = 0): BoardCell => ({
  index: 1, type, amount, x: 0, y: 0,
});

describe("moveTo", () => {
  it("スコア分進む", () => expect(moveTo(3, 4, 31)).toBe(7));
  it("ゴールを超えない(最後のマスで止まる)", () => expect(moveTo(28, 6, 31)).toBe(30));
});

describe("isGoal", () => {
  it("最終マスがゴール", () => expect(isGoal(30, 31)).toBe(true));
  it("途中はゴールでない", () => expect(isGoal(29, 31)).toBe(false));
});

describe("cellEffectDelta", () => {
  it("青マスはプラス", () => expect(cellEffectDelta(cell("blue", 30000))).toBe(30000));
  it("赤マスはマイナス", () => expect(cellEffectDelta(cell("red", 20000))).toBe(-20000));
  it("通常マスはゼロ", () => expect(cellEffectDelta(cell("normal"))).toBe(0));
  it("イベントマスもゼロ(v1では効果なし)", () => expect(cellEffectDelta(cell("event"))).toBe(0));
});
```

`app/src/game/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { answerPrize, applyMoney, goalPrize, rankPlayers } from "./rules";
import type { Player } from "./types";

const p = (id: number, money: number): Player => ({
  id, name: `P${id}`, kind: "human", position: 0, money, goalOrder: null,
});

describe("answerPrize", () => {
  it("スコア×2万円", () => expect(answerPrize(4)).toBe(80000));
});

describe("goalPrize", () => {
  it("1着30万", () => expect(goalPrize(0)).toBe(300000));
  it("4着5万", () => expect(goalPrize(3)).toBe(50000));
  it("5着以降も5万", () => expect(goalPrize(4)).toBe(50000));
});

describe("applyMoney", () => {
  it("加算", () => expect(applyMoney(10000, 30000)).toBe(40000));
  it("0未満にならない", () => expect(applyMoney(10000, -20000)).toBe(0));
});

describe("rankPlayers", () => {
  it("所持金降順", () => {
    const ranked = rankPlayers([p(1, 100), p(2, 300), p(3, 200)]);
    expect(ranked.map((x) => x.id)).toEqual([2, 3, 1]);
  });
  it("元配列を破壊しない", () => {
    const arr = [p(1, 100), p(2, 300)];
    rankPlayers(arr);
    expect(arr[0].id).toBe(1);
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/game`
Expected: FAIL(board / rules モジュール未定義)

- [ ] **Step 3: board.ts 実装**

```ts
import type { BoardCell } from "./types";

export function moveTo(position: number, steps: number, boardSize: number): number {
  return Math.min(position + steps, boardSize - 1);
}

export function isGoal(position: number, boardSize: number): boolean {
  return position === boardSize - 1;
}

export function cellEffectDelta(cell: BoardCell): number {
  if (cell.type === "blue") return cell.amount;
  if (cell.type === "red") return -cell.amount;
  return 0;
}
```

- [ ] **Step 4: rules.ts 実装**

```ts
import type { EvaluationResult, Player } from "./types";

export const PRIZE_PER_SCORE = 20000;
export const GOAL_PRIZES = [300000, 200000, 100000, 50000];
export const ANSWER_TIME_LIMIT_MS = 60000;
export const BEST_ANSWER_MIN_SCORE = 5;

export const TIME_UP_RESULT: EvaluationResult = { score: 1, comment: "時間切れ！" };

export function answerPrize(score: number): number {
  return score * PRIZE_PER_SCORE;
}

export function goalPrize(goalOrder: number): number {
  return GOAL_PRIZES[goalOrder] ?? GOAL_PRIZES[GOAL_PRIZES.length - 1];
}

export function applyMoney(money: number, delta: number): number {
  return Math.max(0, money + delta);
}

export function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.money - a.money);
}
```

- [ ] **Step 5: テスト成功確認**

Run: `npx vitest run src/game`
Expected: PASS(topics含め全テスト)

- [ ] **Step 6: 盤面生成スクリプト** — `app/scripts/gen-board.mjs`

```js
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
```

Run: `node scripts/gen-board.mjs`
Expected: `wrote ... (31 cells)`、`app/src/data/board.json` 生成。

- [ ] **Step 7: Commit**

```powershell
git add app/src/game app/scripts app/src/data/board.json
git commit -m "feat: 盤面ルール・賞金計算と盤面データ生成を追加"
```

---

### Task 4: ステートマシン前半(セットアップ〜採点結果)

**Files:**
- Create: `app/src/game/state.ts`
- Test: `app/src/game/state.test.ts`

**Interfaces:**
- Consumes: `types.ts` 全型、`rules.ts` の `TIME_UP_RESULT`
- Produces:
  - `Phase` 判別共用体: `title | setup | turnStart | awaitingAnswer{topic} | evaluating{topic,answer} | showingResult{topic,answer,result} | moving{from,to} | cellEffect{cell,delta} | gameResult`
  - `GameState {phase, board, players, currentPlayerIndex, usedTopicIds, bestAnswers, goalCount}`
  - `GameAction`: `SHOW_SETUP | START_GAME{players,board} | BEGIN_TURN{topic} | SUBMIT_ANSWER{answer} | TIME_UP | EVALUATED{result} | RE_EVALUATE | PROCEED | MOVE_DONE | EFFECT_DONE | RESTART`
  - `initialState: GameState` / `gameReducer(state, action): GameState` / `currentPlayer(state): Player`

- [ ] **Step 1: 失敗するテストを書く** — `app/src/game/state.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { gameReducer, initialState, currentPlayer } from "./state";
import type { GameState } from "./state";
import { TIME_UP_RESULT } from "./rules";
import type { BoardCell, PlayerConfig, Topic } from "./types";

const board: BoardCell[] = Array.from({ length: 31 }, (_, i) => ({
  index: i,
  type: i === 2 ? "blue" : i === 4 ? "red" : "normal",
  amount: i === 2 ? 30000 : i === 4 ? 20000 : 0,
  x: 0, y: 0,
}));

const configs: PlayerConfig[] = [
  { name: "太郎", kind: "human" },
  { name: "ロボ", kind: "cpu", personality: "bold" },
];

const topic: Topic = { id: "t1", category: "c", prompt: "こんな劇場は嫌だ", difficulty: "Easy" };

function started(): GameState {
  let s = gameReducer(initialState, { type: "SHOW_SETUP" });
  s = gameReducer(s, { type: "START_GAME", players: configs, board });
  return s;
}

describe("セットアップ", () => {
  it("title→setup→turnStart と遷移しプレイヤーが初期化される", () => {
    const s = started();
    expect(s.phase.name).toBe("turnStart");
    expect(s.players).toHaveLength(2);
    expect(s.players[0]).toMatchObject({ name: "太郎", position: 0, money: 0, goalOrder: null });
    expect(currentPlayer(s).name).toBe("太郎");
  });
});

describe("出題〜採点", () => {
  it("BEGIN_TURNでawaitingAnswerになりお題が使用済みになる", () => {
    const s = gameReducer(started(), { type: "BEGIN_TURN", topic });
    expect(s.phase).toMatchObject({ name: "awaitingAnswer", topic });
    expect(s.usedTopicIds).toContain("t1");
  });

  it("SUBMIT_ANSWERでevaluatingへ", () => {
    let s = gameReducer(started(), { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "客席が全部トイレ" });
    expect(s.phase).toMatchObject({ name: "evaluating", answer: "客席が全部トイレ" });
  });

  it("TIME_UPで時間切れ結果のshowingResultへ", () => {
    let s = gameReducer(started(), { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "TIME_UP" });
    expect(s.phase).toMatchObject({ name: "showingResult", answer: "", result: TIME_UP_RESULT });
  });

  it("EVALUATEDでshowingResultへ(この時点で所持金は変わらない)", () => {
    let s = gameReducer(started(), { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "a" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 5, comment: "やるな" } });
    expect(s.phase).toMatchObject({ name: "showingResult", result: { score: 5 } });
    expect(currentPlayer(s).money).toBe(0);
  });

  it("RE_EVALUATEで同じ回答のままevaluatingへ戻る", () => {
    let s = gameReducer(started(), { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "a" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 3, comment: "…", fallback: true } });
    s = gameReducer(s, { type: "RE_EVALUATE" });
    expect(s.phase).toMatchObject({ name: "evaluating", answer: "a" });
  });

  it("不正な遷移のアクションは無視される", () => {
    const s = started();
    expect(gameReducer(s, { type: "SUBMIT_ANSWER", answer: "x" })).toBe(s);
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/game/state.test.ts`
Expected: FAIL (`Cannot find module './state'`)

- [ ] **Step 3: state.ts 実装(前半+後半の骨格)**

```ts
import { cellEffectDelta, isGoal, moveTo } from "./board";
import {
  answerPrize, applyMoney, BEST_ANSWER_MIN_SCORE, goalPrize, TIME_UP_RESULT,
} from "./rules";
import type {
  BestAnswer, BoardCell, EvaluationResult, Player, PlayerConfig, Topic,
} from "./types";

export type Phase =
  | { name: "title" }
  | { name: "setup" }
  | { name: "turnStart" }
  | { name: "awaitingAnswer"; topic: Topic }
  | { name: "evaluating"; topic: Topic; answer: string }
  | { name: "showingResult"; topic: Topic; answer: string; result: EvaluationResult }
  | { name: "moving"; from: number; to: number }
  | { name: "cellEffect"; cell: BoardCell; delta: number }
  | { name: "gameResult" };

export interface GameState {
  phase: Phase;
  board: BoardCell[];
  players: Player[];
  currentPlayerIndex: number;
  usedTopicIds: string[];
  bestAnswers: BestAnswer[];
  goalCount: number;
}

export type GameAction =
  | { type: "SHOW_SETUP" }
  | { type: "START_GAME"; players: PlayerConfig[]; board: BoardCell[] }
  | { type: "BEGIN_TURN"; topic: Topic }
  | { type: "SUBMIT_ANSWER"; answer: string }
  | { type: "TIME_UP" }
  | { type: "EVALUATED"; result: EvaluationResult }
  | { type: "RE_EVALUATE" }
  | { type: "PROCEED" }
  | { type: "MOVE_DONE" }
  | { type: "EFFECT_DONE" }
  | { type: "RESTART" };

export const initialState: GameState = {
  phase: { name: "title" },
  board: [],
  players: [],
  currentPlayerIndex: 0,
  usedTopicIds: [],
  bestAnswers: [],
  goalCount: 0,
};

export function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function updateCurrentPlayer(state: GameState, patch: Partial<Player>): Player[] {
  return state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, ...patch } : p,
  );
}

/** 次の未ゴールプレイヤーへ手番を回す。全員ゴール済みならgameResultへ。 */
function advanceTurn(state: GameState): GameState {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.currentPlayerIndex + i) % n;
    if (state.players[idx].goalOrder === null) {
      return { ...state, currentPlayerIndex: idx, phase: { name: "turnStart" } };
    }
  }
  return { ...state, phase: { name: "gameResult" } };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const phase = state.phase;

  switch (action.type) {
    case "SHOW_SETUP":
      if (phase.name !== "title") return state;
      return { ...state, phase: { name: "setup" } };

    case "START_GAME": {
      if (phase.name !== "setup") return state;
      const players: Player[] = action.players.map((c, i) => ({
        id: i,
        name: c.name,
        kind: c.kind,
        personality: c.personality,
        position: 0,
        money: 0,
        goalOrder: null,
      }));
      return {
        ...initialState,
        board: action.board,
        players,
        phase: { name: "turnStart" },
      };
    }

    case "BEGIN_TURN":
      if (phase.name !== "turnStart") return state;
      return {
        ...state,
        usedTopicIds: [...state.usedTopicIds, action.topic.id],
        phase: { name: "awaitingAnswer", topic: action.topic },
      };

    case "SUBMIT_ANSWER":
      if (phase.name !== "awaitingAnswer") return state;
      return { ...state, phase: { name: "evaluating", topic: phase.topic, answer: action.answer } };

    case "TIME_UP":
      if (phase.name !== "awaitingAnswer") return state;
      return {
        ...state,
        phase: { name: "showingResult", topic: phase.topic, answer: "", result: TIME_UP_RESULT },
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
        },
      };

    case "RE_EVALUATE":
      if (phase.name !== "showingResult") return state;
      return { ...state, phase: { name: "evaluating", topic: phase.topic, answer: phase.answer } };

    case "PROCEED": {
      if (phase.name !== "showingResult") return state;
      const player = currentPlayer(state);
      const from = player.position;
      const to = moveTo(from, phase.result.score, state.board.length);
      const bestAnswers =
        phase.result.score >= BEST_ANSWER_MIN_SCORE && phase.answer !== ""
          ? [
              ...state.bestAnswers,
              {
                playerName: player.name,
                topicPrompt: phase.topic.prompt,
                answer: phase.answer,
                score: phase.result.score,
                comment: phase.result.comment,
              },
            ]
          : state.bestAnswers;
      return {
        ...state,
        players: updateCurrentPlayer(state, {
          position: to,
          money: applyMoney(player.money, answerPrize(phase.result.score)),
        }),
        bestAnswers,
        phase: { name: "moving", from, to },
      };
    }

    case "MOVE_DONE": {
      if (phase.name !== "moving") return state;
      const player = currentPlayer(state);
      if (isGoal(player.position, state.board.length)) {
        const order = state.goalCount;
        const withGoal: GameState = {
          ...state,
          goalCount: order + 1,
          players: updateCurrentPlayer(state, {
            goalOrder: order,
            money: applyMoney(player.money, goalPrize(order)),
          }),
        };
        return advanceTurn(withGoal);
      }
      const cell = state.board[player.position];
      const delta = cellEffectDelta(cell);
      if (delta !== 0) {
        return {
          ...state,
          players: updateCurrentPlayer(state, { money: applyMoney(player.money, delta) }),
          phase: { name: "cellEffect", cell, delta },
        };
      }
      return advanceTurn(state);
    }

    case "EFFECT_DONE":
      if (phase.name !== "cellEffect") return state;
      return advanceTurn(state);

    case "RESTART":
      if (phase.name !== "gameResult") return state;
      return initialState;

    default:
      return state;
  }
}
```

- [ ] **Step 4: テスト成功確認**

Run: `npx vitest run src/game/state.test.ts`
Expected: PASS(7 tests)

- [ ] **Step 5: Commit**

```powershell
git add app/src/game/state.ts app/src/game/state.test.ts
git commit -m "feat: ゲームステートマシン(セットアップ〜採点)を実装"
```

---

### Task 5: ステートマシン後半(移動・マス効果・ゴール・勝敗)のテスト

**Files:**
- Modify: `app/src/game/state.test.ts`(テスト追記。実装はTask 4で済み — 後半遷移の仕様をテストで固定する)

**Interfaces:**
- Consumes: Task 4 の `gameReducer` ほか全API

- [ ] **Step 1: 後半のテストを追記** — `state.test.ts` 末尾に追加

```ts
import { GOAL_PRIZES, PRIZE_PER_SCORE } from "./rules";

function toShowingResult(score: number): GameState {
  let s = gameReducer(started(), { type: "BEGIN_TURN", topic });
  s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "回答" });
  s = gameReducer(s, { type: "EVALUATED", result: { score, comment: "コメント" } });
  return s;
}

describe("移動とマス効果", () => {
  it("PROCEEDで賞金加算+位置更新+movingへ", () => {
    const s = gameReducer(toShowingResult(4), { type: "PROCEED" });
    expect(s.phase).toMatchObject({ name: "moving", from: 0, to: 4 });
    expect(s.players[0].position).toBe(4);
    expect(s.players[0].money).toBe(4 * PRIZE_PER_SCORE);
  });

  it("スコア5以上はベスト回答に記録される", () => {
    const s = gameReducer(toShowingResult(5), { type: "PROCEED" });
    expect(s.bestAnswers).toHaveLength(1);
    expect(s.bestAnswers[0]).toMatchObject({ playerName: "太郎", score: 5 });
  });

  it("スコア4以下は記録されない", () => {
    const s = gameReducer(toShowingResult(4), { type: "PROCEED" });
    expect(s.bestAnswers).toHaveLength(0);
  });

  it("青マス到着でcellEffect(+3万)", () => {
    let s = gameReducer(toShowingResult(2), { type: "PROCEED" }); // index2=blue
    const moneyBefore = s.players[0].money;
    s = gameReducer(s, { type: "MOVE_DONE" });
    expect(s.phase).toMatchObject({ name: "cellEffect", delta: 30000 });
    expect(s.players[0].money).toBe(moneyBefore + 30000);
  });

  it("赤マス到着でcellEffect(-2万)", () => {
    let s = gameReducer(toShowingResult(4), { type: "PROCEED" }); // index4=red
    const moneyBefore = s.players[0].money;
    s = gameReducer(s, { type: "MOVE_DONE" });
    expect(s.phase).toMatchObject({ name: "cellEffect", delta: -20000 });
    expect(s.players[0].money).toBe(moneyBefore - 20000);
  });

  it("通常マスなら即次の手番(turnStart)へ", () => {
    let s = gameReducer(toShowingResult(3), { type: "PROCEED" }); // index3=normal
    s = gameReducer(s, { type: "MOVE_DONE" });
    expect(s.phase.name).toBe("turnStart");
    expect(s.currentPlayerIndex).toBe(1);
  });

  it("EFFECT_DONEで次の手番へ", () => {
    let s = gameReducer(toShowingResult(2), { type: "PROCEED" });
    s = gameReducer(s, { type: "MOVE_DONE" });
    s = gameReducer(s, { type: "EFFECT_DONE" });
    expect(s.phase.name).toBe("turnStart");
    expect(s.currentPlayerIndex).toBe(1);
  });
});

describe("ゴールと勝敗", () => {
  function goalPlayer(s: GameState): GameState {
    // 現在手番のプレイヤーを位置29に置き、スコア6でゴールさせる
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === s.currentPlayerIndex ? { ...p, position: 29 } : p,
      ),
    };
    s = gameReducer(s, { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "ゴール回答" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 6, comment: "神" } });
    s = gameReducer(s, { type: "PROCEED" });
    return gameReducer(s, { type: "MOVE_DONE" });
  }

  it("ゴールで1着賞金が加算されgoalOrderが付く", () => {
    const s = goalPlayer(started());
    expect(s.players[0].goalOrder).toBe(0);
    expect(s.players[0].money).toBe(6 * PRIZE_PER_SCORE + GOAL_PRIZES[0]);
    expect(s.phase.name).toBe("turnStart");
    expect(s.currentPlayerIndex).toBe(1);
  });

  it("ゴール済みプレイヤーは手番スキップされる", () => {
    let s = goalPlayer(started()); // P0ゴール、手番P1
    // P1が通常マスに止まって手番が一周 → 再びP1(P0スキップ)
    s = gameReducer(s, { type: "BEGIN_TURN", topic });
    s = gameReducer(s, { type: "SUBMIT_ANSWER", answer: "a" });
    s = gameReducer(s, { type: "EVALUATED", result: { score: 3, comment: "c" } });
    s = gameReducer(s, { type: "PROCEED" });
    s = gameReducer(s, { type: "MOVE_DONE" });
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.phase.name).toBe("turnStart");
  });

  it("全員ゴールでgameResultへ、RESTARTでtitleへ", () => {
    let s = goalPlayer(started()); // P0ゴール
    s = goalPlayer(s); // P1ゴール
    expect(s.phase.name).toBe("gameResult");
    expect(s.players[1].goalOrder).toBe(1);
    s = gameReducer(s, { type: "RESTART" });
    expect(s.phase.name).toBe("title");
  });
});
```

- [ ] **Step 2: テスト実行**

Run: `npx vitest run src/game/state.test.ts`
Expected: PASS(全17 tests)。Task 4 の実装で通るはず。失敗したら実装のバグ — テストではなく `state.ts` を直す。

- [ ] **Step 3: Commit**

```powershell
git add app/src/game/state.test.ts
git commit -m "test: 移動・マス効果・ゴール・勝敗の状態遷移テストを追加"
```

---

### Task 6: 評価層 — Evaluatorインターフェースとモック

**Files:**
- Create: `app/src/ai/evaluator.ts`, `app/src/ai/mock.ts`
- Test: `app/src/ai/mock.test.ts`

**Interfaces:**
- Consumes: `game/types.ts` の `CpuPersonality`, `EvaluationResult`
- Produces:
  - `evaluator.ts`: `interface Evaluator { evaluate(topicPrompt: string, answer: string): Promise<EvaluationResult>; cpuAnswer(topicPrompt: string, personality: CpuPersonality): Promise<string>; }` / `FALLBACK_EVALUATION: EvaluationResult` / `FALLBACK_CPU_ANSWERS: string[]`
  - `mock.ts`: `class MockEvaluator implements Evaluator`(コンストラクタ `(delayMs?: number, random?: () => number)`)

- [ ] **Step 1: evaluator.ts 作成**

```ts
import type { CpuPersonality, EvaluationResult } from "../game/types";

export interface Evaluator {
  evaluate(topicPrompt: string, answer: string): Promise<EvaluationResult>;
  cpuAnswer(topicPrompt: string, personality: CpuPersonality): Promise<string>;
}

export const FALLBACK_EVALUATION: EvaluationResult = {
  score: 3,
  comment: "電波の関係で審査員が聞き取れなかったらしい…",
  fallback: true,
};

export const FALLBACK_CPU_ANSWERS = [
  "考えすぎて頭が真っ白になりました",
  "ノーコメントでお願いします",
  "それは来世でお答えします",
];
```

- [ ] **Step 2: 失敗するテストを書く** — `app/src/ai/mock.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { MockEvaluator } from "./mock";

describe("MockEvaluator", () => {
  it("1〜6のスコアとコメントを返す", async () => {
    const e = new MockEvaluator(0, () => 0.99);
    const r = await e.evaluate("お題", "回答");
    expect(r.score).toBe(6);
    expect(r.comment.length).toBeGreaterThan(0);
  });

  it("random=0でスコア1", async () => {
    const e = new MockEvaluator(0, () => 0);
    const r = await e.evaluate("お題", "回答");
    expect(r.score).toBe(1);
  });

  it("CPU回答を返す", async () => {
    const e = new MockEvaluator(0, () => 0);
    const a = await e.cpuAnswer("お題", "bold");
    expect(a.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: テスト失敗確認**

Run: `npx vitest run src/ai`
Expected: FAIL (`Cannot find module './mock'`)

- [ ] **Step 4: mock.ts 実装**

```ts
import type { CpuPersonality, EvaluationResult } from "../game/types";
import type { Evaluator } from "./evaluator";

const MOCK_COMMENTS: Record<number, string> = {
  1: "出直してこい！",
  2: "うーん、あと一声！",
  3: "悪くないけど普通！",
  4: "お、ちょっと面白いじゃん",
  5: "やるな〜、会場ウケてるぞ",
  6: "天才か！座布団全部持ってけ！",
};

const MOCK_CPU_ANSWERS = [
  "全部の席がリクライニングしすぎて客が寝る",
  "入場料が出世払い",
  "舞台より客席のほうが明るい",
  "アンコールが義務",
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockEvaluator implements Evaluator {
  constructor(
    private delayMs = 1200,
    private random: () => number = Math.random,
  ) {}

  async evaluate(_topicPrompt: string, _answer: string): Promise<EvaluationResult> {
    await delay(this.delayMs);
    const score = 1 + Math.floor(this.random() * 6);
    return { score, comment: MOCK_COMMENTS[score] };
  }

  async cpuAnswer(_topicPrompt: string, _personality: CpuPersonality): Promise<string> {
    await delay(this.delayMs);
    return MOCK_CPU_ANSWERS[Math.floor(this.random() * MOCK_CPU_ANSWERS.length)];
  }
}
```

- [ ] **Step 5: テスト成功確認**

Run: `npx vitest run src/ai`
Expected: PASS(3 tests)

- [ ] **Step 6: Commit**

```powershell
git add app/src/ai
git commit -m "feat: Evaluatorインターフェースとモック評価器を追加"
```

---

### Task 7: UI基盤 — 定数・カウントダウン・スタイル・タイトル/設定画面

**Files:**
- Create: `app/src/ui/constants.ts`, `app/src/hooks/useCountdown.ts`
- Create: `app/src/components/TitleScreen.tsx`, `app/src/components/SetupScreen.tsx`
- Replace: `app/src/index.css`, `app/src/App.tsx`(仮シェル), `app/src/main.tsx`
- Delete: `app/src/App.css`, `app/src/assets/`(Viteテンプレート残骸)
- Test: `app/src/hooks/useCountdown.test.ts`

**Interfaces:**
- Consumes: `game/types.ts` の `PlayerConfig`
- Produces:
  - `ui/constants.ts`: `MOVE_STEP_MS=280`, `CAMERA_SETTLE_MS=800`, `RESULT_REVEAL_MS=600`, `CELL_EFFECT_MS=1600`, `CPU_SUBMIT_DELAY_MS=1000`
  - `useCountdown(active: boolean, totalMs: number, onExpire: () => void): number`(残りms。activeがfalse→trueでリセット)
  - `TitleScreen({ onStart: () => void })`
  - `SetupScreen({ onSubmit: (players: PlayerConfig[]) => void })` — 1〜4人、各行で 名前/人間・CPU/CPU性格 を設定

- [ ] **Step 1: constants.ts 作成**

```ts
export const MOVE_STEP_MS = 280; // コマ1マス移動の時間
export const CAMERA_SETTLE_MS = 800; // ターン開始時のカメラ移動待ち
export const RESULT_REVEAL_MS = 600; // スコア発表のドラムロール時間
export const CELL_EFFECT_MS = 1600; // マス効果ポップアップ表示時間
export const CPU_SUBMIT_DELAY_MS = 1000; // CPU回答表示→自動送信までの間
```

- [ ] **Step 2: useCountdown の失敗するテスト** — `app/src/hooks/useCountdown.test.ts`

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "./useCountdown";

describe("useCountdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("残り時間が減っていく", () => {
    const { result } = renderHook(() => useCountdown(true, 10000, () => {}));
    expect(result.current).toBe(10000);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBeLessThanOrEqual(7000);
  });

  it("時間切れでonExpireが1回だけ呼ばれる", () => {
    const onExpire = vi.fn();
    renderHook(() => useCountdown(true, 1000, onExpire));
    act(() => vi.advanceTimersByTime(2000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("activeがfalseなら動かない", () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useCountdown(false, 1000, onExpire));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current).toBe(1000);
    expect(onExpire).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: テスト失敗確認**

Run: `npx vitest run src/hooks`
Expected: FAIL (`Cannot find module './useCountdown'`)

- [ ] **Step 4: useCountdown.ts 実装**

```ts
import { useEffect, useRef, useState } from "react";

/** activeの間、totalMsからカウントダウンし、0でonExpireを1回呼ぶ。残りmsを返す。 */
export function useCountdown(active: boolean, totalMs: number, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(totalMs);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!active) {
      setRemaining(totalMs);
      expiredRef.current = false;
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const left = Math.max(0, totalMs - (Date.now() - startedAt));
      setRemaining(left);
      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(timer);
        onExpireRef.current();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [active, totalMs]);

  return remaining;
}
```

Run: `npx vitest run src/hooks`
Expected: PASS(3 tests)

- [ ] **Step 5: index.css 全置換**

```css
:root {
  --bg: #1a1633;
  --panel: rgba(20, 16, 48, 0.92);
  --panel-light: rgba(255, 255, 255, 0.08);
  --accent: #ffcb3d;
  --accent2: #ff5d8f;
  --text: #f5f2ff;
  --blue: #4dabf7;
  --red: #ff6b6b;
  --radius: 14px;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root { height: 100%; }

body {
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
}

.stage { position: relative; width: 100%; height: 100%; }

/* --- 盤面 --- */
.board-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.board-camera { transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
.cell-label { font-size: 20px; fill: rgba(255,255,255,0.85); text-anchor: middle; }
.piece { transition: transform 0.26s ease-in-out; }

/* --- オーバーレイ共通 --- */
.overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 16px; padding: 16px;
  background: rgba(10, 8, 28, 0.55);
  backdrop-filter: blur(3px);
  z-index: 10;
}
.overlay.transparent { background: transparent; backdrop-filter: none; pointer-events: none; }
.overlay.transparent > * { pointer-events: auto; }

.panel {
  background: var(--panel);
  border: 1px solid var(--panel-light);
  border-radius: var(--radius);
  padding: 24px;
  max-width: 520px; width: 92%;
  box-shadow: 0 12px 48px rgba(0,0,0,0.5);
}

/* --- HUD --- */
.hud {
  position: absolute; top: 0; left: 0; right: 0;
  display: flex; gap: 8px; align-items: center;
  padding: 10px 14px;
  background: linear-gradient(rgba(10,8,28,0.85), transparent);
  z-index: 20; flex-wrap: wrap;
}
.hud-player {
  padding: 4px 12px; border-radius: 999px;
  background: var(--panel-light); font-size: 14px;
}
.hud-player.current { background: var(--accent); color: #241c00; font-weight: 700; }

/* --- お題カード --- */
.topic-card {
  background: linear-gradient(135deg, #fffbe8, #ffe9a8);
  color: #3a2c00;
  border-radius: var(--radius);
  padding: 20px 24px;
  max-width: 560px; width: 92%;
  text-align: center;
  box-shadow: 0 8px 40px rgba(255, 203, 61, 0.25);
}
.topic-card .category { font-size: 12px; opacity: 0.7; margin-bottom: 6px; }
.topic-card .prompt { font-size: 20px; font-weight: 700; line-height: 1.5; }
.topic-card.judging { animation: judging-pulse 1.2s ease-in-out infinite; }
@keyframes judging-pulse {
  0%, 100% { box-shadow: 0 0 30px rgba(255, 93, 143, 0.4); }
  50% { box-shadow: 0 0 70px rgba(255, 93, 143, 0.9); }
}

/* --- 入力欄 --- */
.answer-form {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; gap: 8px; padding: 14px;
  background: linear-gradient(transparent, rgba(10,8,28,0.9));
  z-index: 20;
}
.answer-form input {
  flex: 1; padding: 14px; font-size: 16px;
  border-radius: var(--radius); border: 2px solid var(--accent);
  background: #fff; color: #222;
}
.answer-form button { white-space: nowrap; }

/* --- ボタン --- */
button.primary {
  padding: 12px 28px; font-size: 16px; font-weight: 700;
  border: none; border-radius: var(--radius);
  background: var(--accent); color: #241c00; cursor: pointer;
}
button.primary:disabled { opacity: 0.4; cursor: default; }
button.ghost {
  padding: 10px 20px; font-size: 14px;
  border: 1px solid var(--panel-light); border-radius: var(--radius);
  background: transparent; color: var(--text); cursor: pointer;
}

/* --- タイマー --- */
.timer-bar { position: absolute; bottom: 76px; left: 14px; right: 14px; height: 8px;
  border-radius: 4px; background: var(--panel-light); overflow: hidden; z-index: 20; }
.timer-bar .fill { height: 100%; background: var(--accent2); transition: width 0.25s linear; }

/* --- 結果 --- */
.score-big { font-size: 72px; font-weight: 900; color: var(--accent);
  text-shadow: 0 0 30px rgba(255,203,61,0.6); animation: pop-in 0.5s ease; }
.comment-bubble {
  background: #fff; color: #222; border-radius: 18px;
  padding: 14px 22px; font-size: 18px; font-weight: 600; position: relative;
  max-width: 480px;
}
.comment-bubble::before {
  content: ""; position: absolute; top: -10px; left: 50%;
  border: 10px solid transparent; border-bottom-color: #fff; border-top: 0;
  transform: translateX(-50%);
}
@keyframes pop-in { from { transform: scale(0); } to { transform: scale(1); } }

/* --- マス効果 --- */
.effect-popup {
  font-size: 40px; font-weight: 900; animation: pop-in 0.4s ease;
  padding: 20px 36px; border-radius: var(--radius);
}
.effect-popup.gain { background: var(--blue); }
.effect-popup.loss { background: var(--red); }

/* --- セットアップ --- */
.setup-row { display: flex; gap: 8px; margin-bottom: 10px; align-items: center; }
.setup-row input[type="text"] { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid #666; }
.setup-row select { padding: 8px; border-radius: 8px; }

/* --- リザルト --- */
.rank-list { list-style: none; margin: 12px 0; }
.rank-list li { display: flex; justify-content: space-between; padding: 8px 4px;
  border-bottom: 1px solid var(--panel-light); font-size: 18px; }
.best-answers { margin-top: 16px; max-height: 30vh; overflow-y: auto; }
.best-answers .item { background: var(--panel-light); border-radius: 8px;
  padding: 10px; margin-bottom: 8px; font-size: 13px; }

h1.logo { font-size: 44px; color: var(--accent); text-shadow: 0 4px 0 var(--accent2); }
```

- [ ] **Step 6: TitleScreen.tsx**

```tsx
interface Props {
  onStart: () => void;
}

export function TitleScreen({ onStart }: Props) {
  return (
    <div className="overlay">
      <div className="panel" style={{ textAlign: "center" }}>
        <h1 className="logo">大喜利ダイス</h1>
        <p style={{ margin: "12px 0 20px", opacity: 0.85 }}>
          ボケた分だけ進める。面白さがサイコロだ！
        </p>
        <button className="primary" onClick={onStart}>
          はじめる
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: SetupScreen.tsx**

```tsx
import { useState } from "react";
import type { CpuPersonality, PlayerConfig, PlayerKind } from "../game/types";

interface Props {
  onSubmit: (players: PlayerConfig[]) => void;
}

interface Row {
  name: string;
  kind: PlayerKind;
  personality: CpuPersonality;
}

const defaultRows: Row[] = [
  { name: "プレイヤー1", kind: "human", personality: "safe" },
  { name: "ロボ作家", kind: "cpu", personality: "bold" },
];

export function SetupScreen({ onSubmit }: Props) {
  const [rows, setRows] = useState<Row[]>(defaultRows);

  const update = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows([...rows, { name: `プレイヤー${rows.length + 1}`, kind: "human", personality: "safe" }]);

  const removeRow = (i: number) => setRows(rows.filter((_, j) => j !== i));

  const submit = () =>
    onSubmit(
      rows.map((r) => ({
        name: r.name.trim() || "名無し",
        kind: r.kind,
        personality: r.kind === "cpu" ? r.personality : undefined,
      })),
    );

  return (
    <div className="overlay">
      <div className="panel">
        <h2 style={{ marginBottom: 14 }}>プレイヤー設定(1〜4人)</h2>
        {rows.map((r, i) => (
          <div className="setup-row" key={i}>
            <input
              type="text"
              value={r.name}
              maxLength={10}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <select
              value={r.kind}
              onChange={(e) => update(i, { kind: e.target.value as PlayerKind })}
            >
              <option value="human">人間</option>
              <option value="cpu">CPU</option>
            </select>
            {r.kind === "cpu" && (
              <select
                value={r.personality}
                onChange={(e) => update(i, { personality: e.target.value as CpuPersonality })}
              >
                <option value="safe">無難</option>
                <option value="bold">攻める</option>
              </select>
            )}
            {rows.length > 1 && (
              <button className="ghost" onClick={() => removeRow(i)}>
                ✕
              </button>
            )}
          </div>
        ))}
        {rows.length < 4 && (
          <button className="ghost" onClick={addRow} style={{ marginBottom: 14 }}>
            ＋ プレイヤー追加
          </button>
        )}
        <div>
          <button className="primary" onClick={submit}>
            ゲーム開始！
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: App.tsx を仮シェルに置換、main.tsx整理、テンプレ残骸削除**

`app/src/App.tsx`(この時点ではタイトル→設定→console出力まで。Task 9で全面書き換え):

```tsx
import { useReducer } from "react";
import { gameReducer, initialState } from "./game/state";
import boardData from "./data/board.json";
import type { BoardCell, PlayerConfig } from "./game/types";
import { TitleScreen } from "./components/TitleScreen";
import { SetupScreen } from "./components/SetupScreen";

const board = (boardData as { cells: BoardCell[] }).cells;

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const startGame = (players: PlayerConfig[]) =>
    dispatch({ type: "START_GAME", players, board });

  return (
    <div className="stage">
      {state.phase.name === "title" && (
        <TitleScreen onStart={() => dispatch({ type: "SHOW_SETUP" })} />
      )}
      {state.phase.name === "setup" && <SetupScreen onSubmit={startGame} />}
      {state.phase.name === "turnStart" && (
        <div className="overlay">
          <div className="panel">ゲーム開始(盤面はTask 8で実装)</div>
        </div>
      )}
    </div>
  );
}
```

`app/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

削除: `app/src/App.css`, `app/src/assets/react.svg`, `app/public/vite.svg` への参照(index.htmlのfavicon参照はそのままで可)。`index.html` の `<title>` を `大喜利ダイス` に変更。

- [ ] **Step 9: 手動確認**

```powershell
npm run dev
```

ブラウザで http://localhost:5173 を開き確認:
- タイトル「大喜利ダイス」表示 → はじめる → プレイヤー設定 → 追加/削除/CPU切替が動く → ゲーム開始で「盤面はTask 8で実装」パネル表示。

```powershell
npm test
```

Expected: 全テストPASS。

- [ ] **Step 10: Commit**

```powershell
git add -A app
git commit -m "feat: UI基盤(スタイル・タイマー・タイトル/設定画面)を追加"
```

---

### Task 8: 全画面盤面(BoardView) + カメラ追従 + HUD

**Files:**
- Create: `app/src/components/BoardView.tsx`, `app/src/components/Hud.tsx`
- Modify: `app/src/App.tsx`(BoardView/Hudを常時描画に組み込み)

**Interfaces:**
- Consumes: `BoardCell`, `Player`, `Phase`(moving判定), `ui/constants.ts` の `MOVE_STEP_MS`
- Produces:
  - `BoardView({ board, players, currentPlayerIndex, movingFrom }: { board: BoardCell[]; players: Player[]; currentPlayerIndex: number; movingFrom: number | null })` — 全画面SVG。カメラは手番プレイヤーのコマ中心。movingFrom非nullなら from→現position へ1マスずつアニメ表示
  - `Hud({ players, currentPlayerIndex })` — 名前と所持金、手番ハイライト

- [ ] **Step 1: BoardView.tsx 実装**

```tsx
import { useEffect, useState } from "react";
import type { BoardCell, Player } from "../game/types";
import { MOVE_STEP_MS } from "../ui/constants";

const VIEW_W = 880;
const VIEW_H = 700;
const CELL_R = 34;
const PIECE_COLORS = ["#ffcb3d", "#ff5d8f", "#4dabf7", "#69db7c"];
const CELL_FILL: Record<BoardCell["type"], string> = {
  normal: "rgba(255,255,255,0.16)",
  blue: "#2b6cb0",
  red: "#c0392b",
  event: "#8e44ad",
};

interface Props {
  board: BoardCell[];
  players: Player[];
  currentPlayerIndex: number;
  movingFrom: number | null; // movingフェーズ中は移動元index、それ以外null
}

/** movingFromが与えられたら1マスずつtargetへ進む表示上の位置を返す */
function useAnimatedPosition(target: number, movingFrom: number | null): number {
  const [display, setDisplay] = useState(target);
  useEffect(() => {
    if (movingFrom === null) {
      setDisplay(target);
      return;
    }
    setDisplay(movingFrom);
    let pos = movingFrom;
    const timer = setInterval(() => {
      pos += 1;
      setDisplay(pos);
      if (pos >= target) clearInterval(timer);
    }, MOVE_STEP_MS);
    return () => clearInterval(timer);
  }, [target, movingFrom]);
  return display;
}

export function BoardView({ board, players, currentPlayerIndex, movingFrom }: Props) {
  const current = players[currentPlayerIndex];
  const animatedPos = useAnimatedPosition(current?.position ?? 0, movingFrom);

  if (board.length === 0 || !current) return <svg className="board-svg" />;

  const focus = board[Math.min(animatedPos, board.length - 1)];
  const camX = VIEW_W / 2 - focus.x;
  const camY = VIEW_H / 2 - focus.y;

  return (
    <svg className="board-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice">
      <g className="board-camera" style={{ transform: `translate(${camX}px, ${camY}px)` }}>
        {/* マスをつなぐ道 */}
        <polyline
          points={board.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={14}
          strokeLinejoin="round"
        />
        {/* マス */}
        {board.map((cell) => (
          <g key={cell.index}>
            <circle cx={cell.x} cy={cell.y} r={CELL_R} fill={CELL_FILL[cell.type]}
              stroke="rgba(255,255,255,0.4)" strokeWidth={2} />
            <text className="cell-label" x={cell.x} y={cell.y + 7}>
              {cell.index === 0 ? "🏠" : cell.index === board.length - 1 ? "🎭" : cell.index}
            </text>
          </g>
        ))}
        {/* コマ(同マス重なりは横にずらす) */}
        {players.map((p, i) => {
          const pos = i === currentPlayerIndex ? animatedPos : p.position;
          const cell = board[Math.min(pos, board.length - 1)];
          const dx = (i - (players.length - 1) / 2) * 18;
          return (
            <g key={p.id} className="piece"
              style={{ transform: `translate(${cell.x + dx}px, ${cell.y - CELL_R - 12}px)` }}>
              <circle r={13} fill={PIECE_COLORS[i % PIECE_COLORS.length]}
                stroke="#fff" strokeWidth={2} />
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

- [ ] **Step 2: Hud.tsx 実装**

```tsx
import type { Player } from "../game/types";

interface Props {
  players: Player[];
  currentPlayerIndex: number;
}

const fmt = (n: number) => `${(n / 10000).toLocaleString()}万円`;

export function Hud({ players, currentPlayerIndex }: Props) {
  return (
    <div className="hud">
      {players.map((p, i) => (
        <span key={p.id} className={`hud-player${i === currentPlayerIndex ? " current" : ""}`}>
          {p.kind === "cpu" ? "🤖" : "😀"} {p.name}: {fmt(p.money)}
          {p.goalOrder !== null && " 🏁"}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: App.tsx に組み込み**

`App.tsx` の return を差し替え(ゲーム中は常時盤面+HUDを敷く):

```tsx
  const inGame = !["title", "setup"].includes(state.phase.name);
  const movingFrom = state.phase.name === "moving" ? state.phase.from : null;

  return (
    <div className="stage">
      {inGame && (
        <>
          <BoardView
            board={state.board}
            players={state.players}
            currentPlayerIndex={state.currentPlayerIndex}
            movingFrom={movingFrom}
          />
          <Hud players={state.players} currentPlayerIndex={state.currentPlayerIndex} />
        </>
      )}
      {state.phase.name === "title" && (
        <TitleScreen onStart={() => dispatch({ type: "SHOW_SETUP" })} />
      )}
      {state.phase.name === "setup" && <SetupScreen onSubmit={startGame} />}
    </div>
  );
```

import追加: `import { BoardView } from "./components/BoardView";` / `import { Hud } from "./components/Hud";`

- [ ] **Step 4: 手動確認**

`npm run dev` → タイトル→設定→開始。確認事項:
- 全画面に盤面(蛇行パス、青/赤マス色分け、🏠と🎭)が表示される
- コマ2つがスタートに並ぶ、HUDに全員の所持金0万円と手番ハイライト
- ウィンドウ縮小(スマホ幅)でも盤面が画面を覆う

- [ ] **Step 5: Commit**

```powershell
git add app/src/components app/src/App.tsx
git commit -m "feat: 全画面SVG盤面とカメラ追従・HUDを実装"
```

---

### Task 9: ターンループUI一式(お題・入力・採点・結果・移動・マス効果)

**Files:**
- Create: `app/src/components/TopicCard.tsx`, `AnswerInput.tsx`, `ResultOverlay.tsx`, `CellEffectPopup.tsx`
- Create: `app/src/ai/index.ts`
- Modify: `app/src/App.tsx`(全フェーズのオーケストレーション実装)
- Create: `app/.env.development`(モック切替)

**Interfaces:**
- Consumes: Task 4-8 の全API、`MockEvaluator`
- Produces:
  - `TopicCard({ topic, judging }: { topic: Topic; judging: boolean })`
  - `AnswerInput({ disabled, cpuAnswer, onSubmit }: { disabled: boolean; cpuAnswer: string | null; onSubmit: (answer: string) => void })` — cpuAnswer非nullならその文字列を表示のみ(入力不可)
  - `ResultOverlay({ result, answer, playerName, onProceed, onRetry }: { result: EvaluationResult; answer: string; playerName: string; onProceed: () => void; onRetry: () => void })` — `result.fallback` 時のみ「もう一度審査」表示
  - `CellEffectPopup({ delta }: { delta: number })`
  - `ai/index.ts`: `createEvaluator(): Evaluator` — `import.meta.env.VITE_USE_MOCK === "1"` ならMock、それ以外はApiEvaluator(Task 13まではMockのみ存在するため一時的にMock固定でよい — Task 13で差し替え)

- [ ] **Step 1: ai/index.ts(暫定版)**

```ts
import type { Evaluator } from "./evaluator";
import { MockEvaluator } from "./mock";

// Task 13でApiEvaluatorに切り替える。それまでは常にモック。
export function createEvaluator(): Evaluator {
  return new MockEvaluator();
}
```

`app/.env.development` 作成:

```
VITE_USE_MOCK=1
```

- [ ] **Step 2: TopicCard.tsx**

```tsx
import type { Topic } from "../game/types";

interface Props {
  topic: Topic;
  judging: boolean;
}

export function TopicCard({ topic, judging }: Props) {
  return (
    <div className={`topic-card${judging ? " judging" : ""}`}>
      <div className="category">{topic.category}</div>
      <div className="prompt">{judging ? "審査中…！" : topic.prompt}</div>
    </div>
  );
}
```

- [ ] **Step 3: AnswerInput.tsx**

```tsx
import { useEffect, useState } from "react";

interface Props {
  disabled: boolean;
  cpuAnswer: string | null; // CPU手番のとき表示する回答(編集不可)
  onSubmit: (answer: string) => void;
}

export function AnswerInput({ disabled, cpuAnswer, onSubmit }: Props) {
  const [text, setText] = useState("");
  useEffect(() => setText(""), [disabled]); // 手番が変わったらクリア

  if (cpuAnswer !== null) {
    return (
      <div className="answer-form">
        <input type="text" value={cpuAnswer} readOnly />
        <button className="primary" disabled>🤖考え中</button>
      </div>
    );
  }

  const submit = () => {
    const answer = text.trim();
    if (answer) onSubmit(answer);
  };

  return (
    <div className="answer-form">
      <input
        type="text"
        placeholder="ボケを入力…(100文字まで)"
        value={text}
        maxLength={100}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // 日本語IME変換確定のEnterでは送信しない
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
      />
      <button className="primary" disabled={disabled || !text.trim()} onClick={submit}>
        送信！
      </button>
    </div>
  );
}
```

- [ ] **Step 4: ResultOverlay.tsx**

```tsx
import { useEffect, useState } from "react";
import type { EvaluationResult } from "../game/types";
import { RESULT_REVEAL_MS } from "../ui/constants";

interface Props {
  result: EvaluationResult;
  answer: string;
  playerName: string;
  onProceed: () => void;
  onRetry: () => void;
}

export function ResultOverlay({ result, answer, playerName, onProceed, onRetry }: Props) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), RESULT_REVEAL_MS);
    return () => clearTimeout(t);
  }, []);

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
          <div style={{ display: "flex", gap: 12 }}>
            <button className="primary" onClick={onProceed}>
              {result.score}マス進む！
            </button>
            {result.fallback && (
              <button className="ghost" onClick={onRetry}>
                もう一度審査
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: CellEffectPopup.tsx**

```tsx
interface Props {
  delta: number;
}

export function CellEffectPopup({ delta }: Props) {
  const gain = delta > 0;
  return (
    <div className="overlay transparent">
      <div className={`effect-popup ${gain ? "gain" : "loss"}`}>
        {gain ? "🎉 +" : "💸 -"}{Math.abs(delta) / 10000}万円！
      </div>
    </div>
  );
}
```

- [ ] **Step 6: App.tsx 全面書き換え(オーケストレーション)**

```tsx
import { useEffect, useMemo, useReducer, useState } from "react";
import { currentPlayer, gameReducer, initialState } from "./game/state";
import { pickRandomTopic } from "./game/topics";
import { ANSWER_TIME_LIMIT_MS } from "./game/rules";
import boardData from "./data/board.json";
import topicsData from "./data/topics.json";
import type { BoardCell, PlayerConfig, Topic } from "./game/types";
import { createEvaluator } from "./ai";
import { useCountdown } from "./hooks/useCountdown";
import {
  CAMERA_SETTLE_MS, CELL_EFFECT_MS, CPU_SUBMIT_DELAY_MS, MOVE_STEP_MS,
} from "./ui/constants";
import { TitleScreen } from "./components/TitleScreen";
import { SetupScreen } from "./components/SetupScreen";
import { BoardView } from "./components/BoardView";
import { Hud } from "./components/Hud";
import { TopicCard } from "./components/TopicCard";
import { AnswerInput } from "./components/AnswerInput";
import { ResultOverlay } from "./components/ResultOverlay";
import { CellEffectPopup } from "./components/CellEffectPopup";

const board = (boardData as { cells: BoardCell[] }).cells;
const topics = (topicsData as { topics: Topic[] }).topics;

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const evaluator = useMemo(() => createEvaluator(), []);
  const [cpuAnswer, setCpuAnswer] = useState<string | null>(null);
  const phase = state.phase;
  const player = state.players.length > 0 ? currentPlayer(state) : null;
  const isCpuTurn = player?.kind === "cpu";

  // 注: 各フェーズ副作用は素のuseEffect+クリーンアップで書く。
  // reducerが不正遷移のアクションを無視するため、StrictModeの二重実行や
  // 遅延タイマーの余剰発火があっても状態は壊れない。

  // turnStart: カメラ移動を待ってお題を引く
  useEffect(() => {
    if (phase.name !== "turnStart") return;
    const t = setTimeout(() => {
      dispatch({ type: "BEGIN_TURN", topic: pickRandomTopic(topics, state.usedTopicIds) });
    }, CAMERA_SETTLE_MS);
    return () => clearTimeout(t);
  }, [phase, state.usedTopicIds]);

  // awaitingAnswer(CPU): 回答生成→表示→自動送信
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
    return () => {
      cancelled = true;
      if (t) clearTimeout(t);
    };
  }, [phase, isCpuTurn, player, evaluator]);

  // evaluating: 採点実行
  useEffect(() => {
    if (phase.name !== "evaluating") return;
    let cancelled = false;
    evaluator.evaluate(phase.topic.prompt, phase.answer).then((result) => {
      if (!cancelled) dispatch({ type: "EVALUATED", result });
    });
    return () => { cancelled = true; };
  }, [phase, evaluator]);

  // moving: 歩数分の時間の後にMOVE_DONE
  useEffect(() => {
    if (phase.name !== "moving") return;
    const steps = phase.to - phase.from;
    const t = setTimeout(
      () => dispatch({ type: "MOVE_DONE" }),
      steps * MOVE_STEP_MS + 400,
    );
    return () => clearTimeout(t);
  }, [phase]);

  // cellEffect: ポップアップ表示後EFFECT_DONE
  useEffect(() => {
    if (phase.name !== "cellEffect") return;
    const t = setTimeout(() => dispatch({ type: "EFFECT_DONE" }), CELL_EFFECT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // 人間の手番のみタイマー作動
  const timerActive = phase.name === "awaitingAnswer" && !isCpuTurn;
  const remaining = useCountdown(timerActive, ANSWER_TIME_LIMIT_MS, () =>
    dispatch({ type: "TIME_UP" }),
  );

  const startGame = (players: PlayerConfig[]) =>
    dispatch({ type: "START_GAME", players, board });

  const inGame = !["title", "setup"].includes(phase.name);
  const movingFrom = phase.name === "moving" ? phase.from : null;

  return (
    <div className="stage">
      {inGame && (
        <>
          <BoardView
            board={state.board}
            players={state.players}
            currentPlayerIndex={state.currentPlayerIndex}
            movingFrom={movingFrom}
          />
          <Hud players={state.players} currentPlayerIndex={state.currentPlayerIndex} />
        </>
      )}

      {phase.name === "title" && (
        <TitleScreen onStart={() => dispatch({ type: "SHOW_SETUP" })} />
      )}
      {phase.name === "setup" && <SetupScreen onSubmit={startGame} />}

      {(phase.name === "awaitingAnswer" || phase.name === "evaluating") && (
        <>
          <div className="overlay transparent" style={{ justifyContent: "flex-start", paddingTop: "18vh" }}>
            <TopicCard topic={phase.topic} judging={phase.name === "evaluating"} />
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

      {phase.name === "showingResult" && player && (
        <ResultOverlay
          result={phase.result}
          answer={phase.answer}
          playerName={player.name}
          onProceed={() => dispatch({ type: "PROCEED" })}
          onRetry={() => dispatch({ type: "RE_EVALUATE" })}
        />
      )}

      {phase.name === "cellEffect" && <CellEffectPopup delta={phase.delta} />}

      {phase.name === "gameResult" && (
        <div className="overlay">
          <div className="panel">全員ゴール！(リザルトはTask 10で実装)</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: 手動確認(モックで1ゲーム通しプレイ)**

`npm run dev` で確認:
1. 人間1+CPU1で開始 → お題カード表示、タイマーバー減少
2. 回答入力(日本語)→送信 → カード「審査中…！」点滅 → 🥁 → スコアと ツッコミ表示 → 「Nマス進む！」
3. コマが1マスずつ進みカメラが追従
4. 青/赤マスで「+3万円！/-2万円！」ポップアップ
5. CPU手番: 「🤖考え中」→回答表示→自動で審査へ
6. 回答せず60秒待つ → 「時間切れ！ 1点」
7. 両者ゴールまで進めると「全員ゴール！」パネル

`npm test` Expected: 全PASS。

- [ ] **Step 8: Commit**

```powershell
git add -A app
git commit -m "feat: ターンループUI一式を実装しモック評価で全編プレイ可能に"
```

---

### Task 10: リザルト画面とリスタート

**Files:**
- Create: `app/src/components/GameResultScreen.tsx`
- Modify: `app/src/App.tsx`(gameResultの仮パネルを差し替え)

**Interfaces:**
- Consumes: `rankPlayers`, `BestAnswer`, `Player`
- Produces: `GameResultScreen({ players, bestAnswers, onRestart }: { players: Player[]; bestAnswers: BestAnswer[]; onRestart: () => void })`

- [ ] **Step 1: GameResultScreen.tsx**

```tsx
import { rankPlayers } from "../game/rules";
import type { BestAnswer, Player } from "../game/types";

interface Props {
  players: Player[];
  bestAnswers: BestAnswer[];
  onRestart: () => void;
}

const fmt = (n: number) => `${(n / 10000).toLocaleString()}万円`;
const MEDALS = ["🥇", "🥈", "🥉", "4位"];

export function GameResultScreen({ players, bestAnswers, onRestart }: Props) {
  const ranked = rankPlayers(players);
  return (
    <div className="overlay">
      <div className="panel">
        <h2>🎭 結果発表</h2>
        <ol className="rank-list">
          {ranked.map((p, i) => (
            <li key={p.id}>
              <span>{MEDALS[i] ?? `${i + 1}位`} {p.name}</span>
              <span>{fmt(p.money)}</span>
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
          <button className="primary" onClick={onRestart}>
            タイトルへ戻る
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: App.tsx の gameResult 差し替え**

```tsx
      {phase.name === "gameResult" && (
        <GameResultScreen
          players={state.players}
          bestAnswers={state.bestAnswers}
          onRestart={() => dispatch({ type: "RESTART" })}
        />
      )}
```

import追加: `import { GameResultScreen } from "./components/GameResultScreen";`

- [ ] **Step 3: 手動確認**

1ゲーム通して全員ゴール → 順位(💰降順)・ベスト回答(5点以上のみ)表示 → タイトルへ戻る → 再度プレイ開始できる。

- [ ] **Step 4: Commit**

```powershell
git add app/src/components/GameResultScreen.tsx app/src/App.tsx
git commit -m "feat: リザルト画面とリスタートを実装"
```

---

### Task 11: Worker純ロジック(プロンプト・レート制限・レスポンス抽出)

**Files:**
- Create: `worker/package.json`, `worker/tsconfig.json`
- Create: `worker/src/prompts.ts`, `worker/src/rateLimiter.ts`, `worker/src/gemini.ts`
- Test: `worker/src/prompts.test.ts`, `worker/src/rateLimiter.test.ts`, `worker/src/gemini.test.ts`

**Interfaces:**
- Produces:
  - `prompts.ts`: `buildEvaluatePrompt(topic: string, answer: string): string` / `buildCpuPrompt(topic: string, personality: string): string`
  - `rateLimiter.ts`: `class RateLimiter { constructor(limit: number, windowMs: number); allow(key: string, now?: number): boolean }`
  - `gemini.ts`: `extractJson(data: unknown): unknown`(candidates[0].content.parts[0].text をJSON.parse) / `callGemini(apiKey: string, prompt: string, schema: object): Promise<unknown>`(fetchは後続タスクでハンドラから使用)

- [ ] **Step 1: worker パッケージ初期化**

```powershell
cd C:\Users\yos57\home\myApp\ogiri-dice
mkdir worker\src
cd worker
npm init -y
npm install -D typescript vitest wrangler @cloudflare/workers-types
```

`worker/package.json` の scripts を置換:

```json
"scripts": {
  "dev": "wrangler dev",
  "deploy": "wrangler deploy",
  "test": "vitest run"
}
```

`worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "types": ["@cloudflare/workers-types"],
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: 失敗するテストを書く** — `worker/src/prompts.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { buildCpuPrompt, buildEvaluatePrompt } from "./prompts";

describe("buildEvaluatePrompt", () => {
  it("お題と回答を含む放送作家プロンプトを組み立てる", () => {
    const p = buildEvaluatePrompt("こんな劇場は嫌だ", "客席が回る");
    expect(p).toContain("放送作家");
    expect(p).toContain("こんな劇場は嫌だ");
    expect(p).toContain("客席が回る");
    expect(p).toContain("1〜6");
  });
});

describe("buildCpuPrompt", () => {
  it("boldなら攻めた回答を指示する", () => {
    expect(buildCpuPrompt("お題", "bold")).toContain("攻め");
  });
  it("safeなら無難な回答を指示する", () => {
    expect(buildCpuPrompt("お題", "safe")).toContain("無難");
  });
});
```

`worker/src/rateLimiter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rateLimiter";

describe("RateLimiter", () => {
  it("上限までは許可、超えたら拒否", () => {
    const rl = new RateLimiter(3, 60000);
    expect(rl.allow("ip1", 0)).toBe(true);
    expect(rl.allow("ip1", 1)).toBe(true);
    expect(rl.allow("ip1", 2)).toBe(true);
    expect(rl.allow("ip1", 3)).toBe(false);
  });

  it("ウィンドウが過ぎたら再び許可", () => {
    const rl = new RateLimiter(1, 60000);
    expect(rl.allow("ip1", 0)).toBe(true);
    expect(rl.allow("ip1", 1000)).toBe(false);
    expect(rl.allow("ip1", 61000)).toBe(true);
  });

  it("キーごとに独立", () => {
    const rl = new RateLimiter(1, 60000);
    expect(rl.allow("ip1", 0)).toBe(true);
    expect(rl.allow("ip2", 0)).toBe(true);
  });
});
```

`worker/src/gemini.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractJson } from "./gemini";

describe("extractJson", () => {
  it("candidates[0].content.parts[0].text をJSONとして取り出す", () => {
    const data = {
      candidates: [
        { content: { parts: [{ text: '{"score": 5, "comment": "やるな"}' }] } },
      ],
    };
    expect(extractJson(data)).toEqual({ score: 5, comment: "やるな" });
  });

  it("構造が想定外なら例外", () => {
    expect(() => extractJson({})).toThrow();
  });

  it("textがJSONでなければ例外", () => {
    const data = { candidates: [{ content: { parts: [{ text: "not json" }] } }] };
    expect(() => extractJson(data)).toThrow();
  });
});
```

- [ ] **Step 3: テスト失敗確認**

Run: `cd worker; npx vitest run`
Expected: FAIL(3ファイルともモジュール未定義)

- [ ] **Step 4: 実装**

`worker/src/prompts.ts`:

```ts
export function buildEvaluatePrompt(topic: string, answer: string): string {
  return `あなたは辛口の放送作家です。大喜利のお題に対する回答の面白さを審査します。
【お題】${topic}
【回答】${answer}
面白さを1〜6の整数で採点し、短いツッコミコメントを日本語で付けてください。
6=天才的、5=会場が沸く、4=なかなか、3=普通、2=弱い、1=スベった。`;
}

export function buildCpuPrompt(topic: string, personality: string): string {
  const style =
    personality === "bold"
      ? "意表を突く攻めた回答"
      : "誰にでも伝わる無難で面白い回答";
  return `あなたは大喜利プレイヤーです。次のお題に${style}を1つだけ、30文字以内の日本語で答えてください。
【お題】${topic}`;
}
```

`worker/src/rateLimiter.ts`:

```ts
/** 固定ウィンドウのシンプルなIP毎レート制限(Workerインスタンス内メモリ) */
export class RateLimiter {
  private windows = new Map<string, { start: number; count: number }>();

  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  allow(key: string, now: number = Date.now()): boolean {
    const w = this.windows.get(key);
    if (!w || now - w.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      return true;
    }
    if (w.count >= this.limit) return false;
    w.count += 1;
    return true;
  }
}
```

`worker/src/gemini.ts`:

```ts
const MODEL = "gemini-2.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** Geminiレスポンスから candidates[0].content.parts[0].text を取り出しJSONとしてパースする */
export function extractJson(data: unknown): unknown {
  const text = (data as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  })?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Gemini response has no text");
  }
  return JSON.parse(text);
}

export async function callGemini(
  apiKey: string,
  prompt: string,
  schema: object,
): Promise<unknown> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return extractJson(await res.json());
}
```

- [ ] **Step 5: テスト成功確認**

Run: `npx vitest run`
Expected: PASS(9 tests)

- [ ] **Step 6: Commit**

```powershell
cd C:\Users\yos57\home\myApp\ogiri-dice
git add worker
git commit -m "feat: Worker純ロジック(プロンプト・レート制限・Gemini抽出)を実装"
```

---

### Task 12: Workerハンドラ + wrangler設定 + ローカル疎通

**Files:**
- Create: `worker/src/index.ts`, `worker/wrangler.toml`, `worker/.dev.vars`(gitignore対象)

**Interfaces:**
- Consumes: Task 11 の `buildEvaluatePrompt`, `buildCpuPrompt`, `callGemini`, `RateLimiter`
- Produces:
  - `POST /api/evaluate` body `{topic: string, answer: string}` → 200 `{score: number(1-6), comment: string}` / 400 `{error:"bad_request"}` / 429 `{error:"rate_limited"}` / 502 `{error:"gemini_failed"}`
  - `POST /api/cpu-answer` body `{topic: string, personality: "safe"|"bold"}` → 200 `{answer: string}` / 同上のエラー
  - CORS: 全レスポンスに `Access-Control-Allow-Origin: *`、OPTIONSは204

- [ ] **Step 1: wrangler.toml**

```toml
name = "ogiri-dice-api"
main = "src/index.ts"
compatibility_date = "2026-07-01"
```

- [ ] **Step 2: index.ts 実装**

```ts
import { buildCpuPrompt, buildEvaluatePrompt } from "./prompts";
import { callGemini } from "./gemini";
import { RateLimiter } from "./rateLimiter";

interface Env {
  GEMINI_API_KEY: string;
}

const limiter = new RateLimiter(10, 60_000);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const EVAL_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER", description: "1〜6の整数" },
    comment: { type: "STRING", description: "短いツッコミ" },
  },
  required: ["score", "comment"],
};

const CPU_SCHEMA = {
  type: "OBJECT",
  properties: { answer: { type: "STRING" } },
  required: ["answer"],
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (!limiter.allow(ip)) return json({ error: "rate_limited" }, 429);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad_request" }, 400);
    }

    const path = new URL(request.url).pathname;

    if (path === "/api/evaluate") {
      const { topic, answer } = body as { topic?: unknown; answer?: unknown };
      if (
        typeof topic !== "string" || typeof answer !== "string" ||
        topic.length === 0 || topic.length > 200 ||
        answer.length === 0 || answer.length > 120
      ) {
        return json({ error: "bad_request" }, 400);
      }
      try {
        const raw = (await callGemini(
          env.GEMINI_API_KEY,
          buildEvaluatePrompt(topic, answer),
          EVAL_SCHEMA,
        )) as { score?: unknown; comment?: unknown };
        if (typeof raw.score !== "number" || typeof raw.comment !== "string") {
          return json({ error: "gemini_failed" }, 502);
        }
        return json({ score: clamp(raw.score, 1, 6), comment: raw.comment });
      } catch (e) {
        console.error("evaluate failed:", e);
        return json({ error: "gemini_failed" }, 502);
      }
    }

    if (path === "/api/cpu-answer") {
      const { topic, personality } = body as { topic?: unknown; personality?: unknown };
      if (
        typeof topic !== "string" || topic.length === 0 || topic.length > 200 ||
        (personality !== "safe" && personality !== "bold")
      ) {
        return json({ error: "bad_request" }, 400);
      }
      try {
        const raw = (await callGemini(
          env.GEMINI_API_KEY,
          buildCpuPrompt(topic, personality),
          CPU_SCHEMA,
        )) as { answer?: unknown };
        if (typeof raw.answer !== "string" || raw.answer.length === 0) {
          return json({ error: "gemini_failed" }, 502);
        }
        return json({ answer: raw.answer.slice(0, 100) });
      } catch (e) {
        console.error("cpu-answer failed:", e);
        return json({ error: "gemini_failed" }, 502);
      }
    }

    return json({ error: "not_found" }, 404);
  },
};
```

- [ ] **Step 3: ローカルキー設定**

`worker/.dev.vars` を作成(**gitに入れない** — ルート.gitignoreの`.dev.vars`で除外済みを確認):

```
GEMINI_API_KEY=ここに実際のキー
```

キーは Google AI Studio (https://aistudio.google.com/apikey) で取得。**このステップはユーザーにキーの用意を依頼する。**

- [ ] **Step 4: ローカル疎通確認**

```powershell
cd worker
npx wrangler dev
```

別ターミナルで:

```powershell
curl.exe -s -X POST http://localhost:8787/api/evaluate -H "Content-Type: application/json" -d '{\"topic\":\"こんな劇場は嫌だ。どんなの?\",\"answer\":\"客席が全部トイレ\"}'
```

Expected: `{"score":<1-6の整数>,"comment":"<ツッコミ>"}`

```powershell
curl.exe -s -X POST http://localhost:8787/api/cpu-answer -H "Content-Type: application/json" -d '{\"topic\":\"こんな劇場は嫌だ。どんなの?\",\"personality\":\"bold\"}'
```

Expected: `{"answer":"<大喜利回答>"}`

バリデーション確認:

```powershell
curl.exe -s -X POST http://localhost:8787/api/evaluate -H "Content-Type: application/json" -d '{}'
```

Expected: `{"error":"bad_request"}`

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\yos57\home\myApp\ogiri-dice
git add worker/src/index.ts worker/wrangler.toml
git commit -m "feat: Gemini中継Workerハンドラとwrangler設定を追加"
```

---

### Task 13: ApiEvaluator(タイムアウト/リトライ/フォールバック)と本番切替

**Files:**
- Create: `app/src/ai/api.ts`
- Modify: `app/src/ai/index.ts`(環境変数による切替を実装)
- Test: `app/src/ai/api.test.ts`

**Interfaces:**
- Consumes: `Evaluator`, `FALLBACK_EVALUATION`, `FALLBACK_CPU_ANSWERS`
- Produces:
  - `class ApiEvaluator implements Evaluator`(コンストラクタ `(fetchFn?: typeof fetch, timeoutMs?: number)`、既定 fetch/10000ms)
    - `evaluate`: `POST {API_BASE}/api/evaluate`。失敗・タイムアウト時は1回リトライ、それでも失敗なら `FALLBACK_EVALUATION`
    - `cpuAnswer`: `POST {API_BASE}/api/cpu-answer`。全失敗時は `FALLBACK_CPU_ANSWERS` からランダム
  - `createEvaluator()`: `VITE_USE_MOCK==="1"` → Mock、それ以外 → ApiEvaluator。`API_BASE = import.meta.env.VITE_API_BASE ?? ""`

- [ ] **Step 1: 失敗するテストを書く** — `app/src/ai/api.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { ApiEvaluator } from "./api";
import { FALLBACK_CPU_ANSWERS, FALLBACK_EVALUATION } from "./evaluator";

const okResponse = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200 });

describe("ApiEvaluator.evaluate", () => {
  it("成功レスポンスをEvaluationResultとして返す", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse({ score: 5, comment: "やるな" }));
    const e = new ApiEvaluator(fetchFn, 1000);
    const r = await e.evaluate("お題", "回答");
    expect(r).toEqual({ score: 5, comment: "やるな" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("1回目失敗→2回目成功ならリトライで成功", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("err", { status: 502 }))
      .mockResolvedValueOnce(okResponse({ score: 2, comment: "うーん" }));
    const e = new ApiEvaluator(fetchFn, 1000);
    const r = await e.evaluate("お題", "回答");
    expect(r.score).toBe(2);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("2回とも失敗ならフォールバック値", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));
    const e = new ApiEvaluator(fetchFn, 1000);
    const r = await e.evaluate("お題", "回答");
    expect(r).toEqual(FALLBACK_EVALUATION);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("スコアが範囲外ならフォールバック値", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse({ score: 99, comment: "x" }));
    const e = new ApiEvaluator(fetchFn, 1000);
    const r = await e.evaluate("お題", "回答");
    expect(r).toEqual(FALLBACK_EVALUATION);
  });
});

describe("ApiEvaluator.cpuAnswer", () => {
  it("成功なら回答文字列", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse({ answer: "入場料が出世払い" }));
    const e = new ApiEvaluator(fetchFn, 1000);
    expect(await e.cpuAnswer("お題", "bold")).toBe("入場料が出世払い");
  });

  it("全失敗なら定型回答リストから返す", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));
    const e = new ApiEvaluator(fetchFn, 1000);
    expect(FALLBACK_CPU_ANSWERS).toContain(await e.cpuAnswer("お題", "safe"));
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `cd app; npx vitest run src/ai/api.test.ts`
Expected: FAIL (`Cannot find module './api'`)

- [ ] **Step 3: api.ts 実装**

```ts
import type { CpuPersonality, EvaluationResult } from "../game/types";
import { FALLBACK_CPU_ANSWERS, FALLBACK_EVALUATION, type Evaluator } from "./evaluator";

const API_BASE: string = import.meta.env.VITE_API_BASE ?? "";
const DEFAULT_TIMEOUT_MS = 10_000;
const ATTEMPTS = 2; // 初回 + リトライ1回

export class ApiEvaluator implements Evaluator {
  constructor(
    private fetchFn: typeof fetch = (...args) => fetch(...args),
    private timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  private async post(path: string, body: object): Promise<unknown | null> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      try {
        const res = await this.fetchFn(`${API_BASE}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!res.ok) continue;
        return await res.json();
      } catch {
        // タイムアウト・ネットワークエラー → リトライへ
      }
    }
    return null;
  }

  async evaluate(topicPrompt: string, answer: string): Promise<EvaluationResult> {
    const data = (await this.post("/api/evaluate", {
      topic: topicPrompt,
      answer,
    })) as { score?: unknown; comment?: unknown } | null;
    if (
      data &&
      typeof data.score === "number" &&
      data.score >= 1 && data.score <= 6 &&
      typeof data.comment === "string"
    ) {
      return { score: data.score, comment: data.comment };
    }
    return FALLBACK_EVALUATION;
  }

  async cpuAnswer(topicPrompt: string, personality: CpuPersonality): Promise<string> {
    const data = (await this.post("/api/cpu-answer", {
      topic: topicPrompt,
      personality,
    })) as { answer?: unknown } | null;
    if (data && typeof data.answer === "string" && data.answer.length > 0) {
      return data.answer;
    }
    return FALLBACK_CPU_ANSWERS[Math.floor(Math.random() * FALLBACK_CPU_ANSWERS.length)];
  }
}
```

- [ ] **Step 4: ai/index.ts を切替対応に更新**

```ts
import { ApiEvaluator } from "./api";
import type { Evaluator } from "./evaluator";
import { MockEvaluator } from "./mock";

/** VITE_USE_MOCK=1 ならモック評価器、それ以外は Worker 経由の本番評価器 */
export function createEvaluator(): Evaluator {
  if (import.meta.env.VITE_USE_MOCK === "1") return new MockEvaluator();
  return new ApiEvaluator();
}
```

- [ ] **Step 5: テスト成功確認**

Run: `npx vitest run`
Expected: 全PASS

- [ ] **Step 6: 実機E2E確認(Gemini本番)**

ターミナル1: `cd worker; npx wrangler dev`(8787で起動)
ターミナル2: `cd app` で `.env.development` を一時的に `VITE_USE_MOCK=0` にして `npm run dev`

ブラウザでプレイし確認:
- 人間の回答が実際にGeminiに採点される(点数とツッコミが回答内容に応じて変わる)
- CPUの回答がお題に沿った内容になる
- Workerを停止した状態でプレイ → 10秒×2回の後「3点/電波の関係で…」+「もう一度審査」ボタンが出る → Worker再起動して「もう一度審査」→ 正常採点

確認後 `.env.development` を `VITE_USE_MOCK=1` に戻す(日常開発はモック)。

- [ ] **Step 7: Commit**

```powershell
git add app/src/ai
git commit -m "feat: Worker経由の本番評価器(タイムアウト・リトライ・フォールバック)を実装"
```

---

### Task 14: デプロイとREADME刷新

**Files:**
- Create: `app/.env.production`
- Modify: `README.md`(全面刷新)

**Interfaces:**
- Consumes: 完成した app / worker
- Produces: 公開URL(Cloudflare Pages + Workers)、新README

- [ ] **Step 1: Cloudflareログインと Worker デプロイ**

```powershell
cd worker
npx wrangler login   # ブラウザで認証(ユーザー操作が必要)
npx wrangler deploy
```

Expected: `https://ogiri-dice-api.<subdomain>.workers.dev` が表示される。

シークレット登録:

```powershell
npx wrangler secret put GEMINI_API_KEY
# プロンプトにキーを貼り付け
```

再度疎通:

```powershell
curl.exe -s -X POST https://ogiri-dice-api.<subdomain>.workers.dev/api/evaluate -H "Content-Type: application/json" -d '{\"topic\":\"test\",\"answer\":\"test\"}'
```

Expected: `{"score":...,"comment":"..."}`

- [ ] **Step 2: app の本番環境変数**

`app/.env.production` を作成(Worker URLは Step 1 の実際の値):

```
VITE_USE_MOCK=0
VITE_API_BASE=https://ogiri-dice-api.<subdomain>.workers.dev
```

- [ ] **Step 3: Pages デプロイ**

```powershell
cd app
npm run build
npx wrangler pages deploy dist --project-name ogiri-dice
```

Expected: `https://ogiri-dice.pages.dev` 系のURLが表示される。

- [ ] **Step 4: 公開URLで通しプレイ確認**

スマホまたはPCブラウザで公開URLを開き、1ゲーム通しプレイ:
- Gemini採点が動く
- スマホ縦持ちで盤面・入力欄が崩れない
- 日本語入力(IME)で回答でき、変換確定Enterで誤送信しない

- [ ] **Step 5: README.md 全面刷新**

旧Unity前提の内容を置き換え:

```markdown
# 大喜利ダイス (ogiri-dice)

大喜利の回答を Gemini が採点し、**スコアの分だけすごろく盤を進む**ブラウザゲーム。
ボケた分だけ進める。面白さがサイコロだ！

公開URL: https://ogiri-dice.pages.dev (デプロイ後に実URLへ更新)

## 遊び方

1. プレイヤー(1〜4人、人間/CPU混在可)を設定してスタート
2. お題に60秒以内にボケる → 放送作家AIが1〜6点で採点+ツッコミ
3. スコアのマス数だけ前進。青マスで賞金GET、赤マスで没収
4. ゴール(劇場)到達で到達順ボーナス。全員ゴール時に所持金最多が優勝

## 技術構成

- `app/` — React + TypeScript + Vite。ゲームロジックは `src/game/`(React非依存の reducer ステートマシン)
- `worker/` — Cloudflare Worker。Gemini API (gemini-2.5-flash) の中継とAPIキー秘匿、レート制限
- 設計書: `docs/superpowers/specs/2026-07-07-ogiri-dice-web-redesign-design.md`

## 開発

```bash
# ゲーム本体(モック評価器・APIキー不要)
cd app && npm install && npm run dev

# テスト
cd app && npm test
cd worker && npm test

# Gemini実連携で動かす場合
# 1. worker/.dev.vars に GEMINI_API_KEY=<キー> を書く
# 2. cd worker && npx wrangler dev   (localhost:8787)
# 3. app/.env.development の VITE_USE_MOCK を 0 にして npm run dev
```

## デプロイ

```bash
cd worker && npx wrangler deploy && npx wrangler secret put GEMINI_API_KEY
cd app && npm run build && npx wrangler pages deploy dist --project-name ogiri-dice
```

## 旧Unity版について

`GameCanvas-Unity-master/` は旧Unity実装(開発停止)。参照用に残置。
```

- [ ] **Step 6: Commit**

```powershell
cd C:\Users\yos57\home\myApp\ogiri-dice
git add README.md app/.env.production
git commit -m "docs: Web版デプロイ手順とREADMEを刷新"
```

---

## 実装後の任意フォローアップ(本計画スコープ外)

- 演出強化(frontend-designスキルで盤面テーマ・紙吹雪・効果音)
- イベントマスの特殊お題(縛りお題)
- お題のカテゴリ/難易度フィルタ
- 旧Unity資産・旧ドキュメントの削除整理
