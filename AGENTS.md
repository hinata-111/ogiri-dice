# ogiri-dice

大喜利の回答を Gemini が採点し、スコア分だけ東京マップ(すごろく)を進むブラウザゲーム。
現フェーズ: v2(東京マップ・15秒タイマー・手動移動・青赤チャレンジ・桃鉄式目的地・100万円勝利)を
feature/web-rewrite で実装中。設計思想: 状態遷移の正しさは reducer + テストで担保し、UI は描画に徹する。
旧 Unity 実装(`GameCanvas-Unity-master/`)は参照専用 — 触らない。

## 技術スタックと制約

- React 19 + TypeScript ~6.0 + Vite 8 / テスト: Vitest / リンター: oxlint(ESLint ではない)
- Gemini プロキシ: Cloudflare Workers 予定(`worker/` は未作成。作る際は web-redesign 仕様書に従う)
- tsconfig は `erasableSyntaxOnly` — constructor parameter properties 不可(明示フィールド宣言にする)
- UI 文言は日本語、コード識別子は英語

## コマンド

```bash
cd app && npm run dev          # ゲーム本体(モック評価器・APIキー不要)
cd app && npm test             # Vitest 全テスト
cd app && npm run build        # tsc + vite build(コミット前に必ず green)
cd worker && npx wrangler dev  # Gemini プロキシ(localhost:8787、.dev.vars にキー)※worker/ 作成後
cd worker && npm test          # Worker 純ロジックのテスト ※同上
```

## アーキテクチャの掟

- **状態変更は `app/src/game/state.ts` の reducer のみ**。UI は state を描画してアクションを発行するだけ。不正遷移のアクションは reducer が無視する(この性質に副作用の安全性が依存)。
- **`app/src/game/` は React 非依存の純 TS**。React を import しない。ロジック変更は必ずテスト先行(TDD)。
- **評価器は `Evaluator` インターフェース経由**(`app/src/ai/`)。Gemini 実装とモックを差し替え可能に保つ。モックで全編プレイできる状態を壊さない。
- ゲーム定数(制限時間・賞金額など)は `app/src/game/rules.ts` に集約。マジックナンバーを散らさない。

## このプロジェクトで使うエージェント

(組み込みエージェントのみ。カスタムエージェント未導入)

| エージェント | 起動場面 |
|---|---|
| Explore | 旧 Unity 実装・仕様書・reducer の横断調査(「元仕様ではどうだったか」の確認) |
| Plan | 状態遷移(state.ts)の変更設計、worker/ 導入などアーキテクチャ判断を伴う計画 |
| general-purpose | 複数ファイル横断の検索+修正が絡む多段タスク |

典型ワークフロー:
1. 新機能: superpowers:brainstorming → writing-plans → TDD 実装(game/ はテスト先行)→ verify
2. バグ修正: superpowers:systematic-debugging → Explore で該当遷移を特定 → 回帰テスト追加 → 修正
3. 仕様確認: Explore で `docs/superpowers/specs/` と元仕様(map.md 等)を突き合わせてから着手

## Skills との役割分担

- 実行手順は Skills が正。エージェントは調査・設計の視点提供に限定。
- 常用 Skills: superpowers:test-driven-development(`game/` 変更で必須)、
  superpowers:brainstorming(機能追加前)、superpowers:writing-plans / executing-plans
  (`docs/superpowers/` に spec・plan を置く運用)、verify(コミット前の実挙動確認)

## ハマりどころ

- 回答入力の Enter 送信は `e.nativeEvent.isComposing` チェック必須(日本語 IME の変換確定で誤送信)。
- `map.json` / `board` 系データは手編集せず `app/scripts/gen-map.mjs` を修正して再生成。

## 正典ドキュメント

- 最新仕様: `docs/superpowers/specs/2026-07-08-ogiri-dice-v2-tokyo-map-design.md`
- 技術基盤: `docs/superpowers/specs/2026-07-07-ogiri-dice-web-redesign-design.md`(Worker/エラー処理/デプロイ)
- 元仕様(忠実再現の源泉): `map.md`, `UI_UX_PLAN.md`, `README.md`

## 触ってはいけないもの

- `GameCanvas-Unity-master/` 全体(参照専用)
- Gemini API キーは `worker/.dev.vars`(ローカル)と `wrangler secret`(本番)のみ。コード・コミット・`app/` 側に置くのは絶対禁止。
