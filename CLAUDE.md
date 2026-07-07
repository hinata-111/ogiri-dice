# ogiri-dice

大喜利の回答を Gemini が採点し、スコア分だけ東京マップ(すごろく)を進むブラウザゲーム。
React + TypeScript (Vite) + Cloudflare Workers。旧 Unity 実装(`GameCanvas-Unity-master/`)は参照専用 — 触らない。

## コマンド

```bash
cd app && npm run dev          # ゲーム本体(モック評価器・APIキー不要)
cd app && npm test             # Vitest 全テスト
cd app && npm run build        # tsc + vite build(コミット前に必ず green)
cd worker && npx wrangler dev  # Gemini プロキシ(localhost:8787、.dev.vars にキー)
cd worker && npm test          # Worker 純ロジックのテスト
```

## アーキテクチャの掟

- **状態変更は `app/src/game/state.ts` の reducer のみ**。UI は state を描画してアクションを発行するだけ。不正遷移のアクションは reducer が無視する(この性質に副作用の安全性が依存している)。
- **`app/src/game/` は React 非依存の純 TS**。React を import しない。ロジック変更は必ずテスト先行(TDD)。
- **評価器は `Evaluator` インターフェース経由**(`app/src/ai/`)。Gemini 実装とモックを差し替え可能に保つ。モックで全編プレイできる状態を壊さない。
- ゲーム定数(制限時間・賞金額など)は `app/src/game/rules.ts` に集約。マジックナンバーを散らさない。

## ハマりどころ

- tsconfig は `erasableSyntaxOnly` — TypeScript の constructor parameter properties は使えない(明示フィールド宣言にする)。
- リンターは oxlint(create-vite 既定)。ESLint ではない。
- 回答入力の Enter 送信は `e.nativeEvent.isComposing` チェック必須(日本語 IME の変換確定で誤送信するため)。
- `map.json` / `board` 系データは手編集せず `app/scripts/gen-map.mjs` を修正して再生成。

## 正典ドキュメント

- 最新仕様: `docs/superpowers/specs/2026-07-08-ogiri-dice-v2-tokyo-map-design.md`(v2 = 東京マップ・15秒タイマー・手動移動・青赤チャレンジ・桃鉄式目的地・100万円勝利)
- 技術基盤の仕様: `docs/superpowers/specs/2026-07-07-ogiri-dice-web-redesign-design.md`(Worker/エラー処理/デプロイ)
- 元仕様(忠実再現の源泉): `map.md`, `UI_UX_PLAN.md`, `README.md`
- UI 文言は日本語、コード識別子は英語。

## 秘密情報

- Gemini API キーは `worker/.dev.vars`(ローカル)と `wrangler secret`(本番)のみ。コード・コミット・`app/` 側に置くのは絶対禁止。
