# Manual Round Start Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 最初にルールを説明し、各共通ラウンドは開始ボタン後に出題する。

**Architecture:** 既存のturnStartとBEGIN_ROUNDを利用し、UIは描画とアクション発行だけを担当する。オンラインの開始操作はWorkerで検証し、接続中の開始担当者の選択はprotocolの共通関数にまとめる。

**Tech Stack:** React 19、TypeScript、Vitest、Cloudflare Workers / Durable Objects。

---

### Task 1: 回帰テストを先に追加

- `app/src/App.test.tsx`: 初回ルール、長時間待機、開始後30秒、各周の再待機、全CPUの開始待ち。
- `app/src/game/sharedRound.test.ts`: 開始前に回答・締切が受理されないことと二重開始の無視。
- `worker/src/roomModel.test.ts`: 手動開始、期限null、権限・代行・切断・古い操作、保存済み期限の正規化、次周で待機。
- `app/src/online/OnlineGame.start.test.tsx`: 開始コマンド、非担当者・送信待ち・接続切断時の無効化、代行。
- 対象Vitestを実行して、未実装の挙動により失敗することを確認。

### Task 2: ローカルとオンラインの実装

- `app/src/components/GameView.tsx`: 初回ルールと毎周の開始ボタンを描画。初回説明をスクロールでき、開始操作へフォーカスする。
- `app/src/presentation/presentation.css`: 説明欄のスクロールと開始ボタンの固定。
- `app/src/App.tsx`: 全CPUを含めturnStartで自動出題しない。
- `app/src/online/protocol.ts`: beginRoundコマンドと接続中の開始担当者選択。
- `app/src/online/OnlineGame.tsx`: 開始待ちだけ担当者の操作を許可し、BEGIN_ROUNDをbeginRoundコマンドへ変換。
- `worker/src/roomModel.ts`: 手動開始検証、turnStartの期限・自動出題除去、保存済み期限の正規化。
- 対象テストを再実行して成功を確認。

### Task 3: 統合と検証記録

- `worker/tests/rooms.integration.mjs` の4か所を明示開始へ変更し、実WebSocketでも開始待ちを検証。
- app全テスト・lint・build、worker全テスト・typecheck・test:integrationを実行。
- モックのローカルブラウザでルール表示と開始操作を確認。
- HEAD/tree、変更内容のハッシュ、実行環境と成功コマンドを検証記録へ追記。本番公開はしない。

## 実施結果（2026-11-10）

- 全タスクを実装。既存の `turnStart` / reducerを利用し、ゲームのphase追加・状態遷移の書き換えは不要だった。
- テスト先行で、説明欄の未実装・開始操作の未対応・自動出題期限の残留による失敗を確認後、修正して成功を確認。
- 最終app: `npm test -- --maxWorkers=2` 154件、`npm run lint`、`npm run build` 成功。
- Worker: `npm test` 73件、`npm run typecheck` 成功。`npm run test:integration` はdry-runとローカルworkerdの8件成功。実Gemini・本番公開は使用していない。
- 最初の全検証の同時実行ではappの通しプレイテストが既定の5秒でタイムアウトし、後続のテストも失敗した。テストのタイムアウト設定やソースを変えず、worker数を2に制限した全テストで成功。最後のUI文言修正後も全154件・build・lintを再実行して成功。
- Worker統合はサンドボックスの親ディレクトリ読み取り制限でdry-runが失敗したため、同一のモックテストを承認済みの制限外実行で成功させた。
- ローカルの実ブラウザで、ルール説明・開始待ち・開始操作後の残り30秒と入力フォーカスを確認。説明画面はスクロール可能、開始ボタンは説明欄の外に配置。
- 読み取りレビューでオンライン向けの説明文を確認し、CPUの説明は実際にCPUが参加している場合だけ表示するよう調整。
- コミット・push・マージ・公開は未実施。既存の未コミット変更を保持。
- 検証対象のHEAD/tree、環境と113ファイルのSHA-256は[検証記録](2026-11-10-manual-round-start-verification.json)に保存。最後のUI文言変更はWorkerから参照されないため、Worker結果は再利用した。

## Task 4: ルールの開閉と右下のターン操作（追加依頼）

1. `app/src/App.test.tsx` と `app/src/online/OnlineGame.start.test.tsx` に、ルールを閉じても開始しないこと、閉じた後の盤面操作・開始操作・説明の再表示・全員の状況表示を追加し、失敗を確認する。
2. `app/src/components/RulesDialog.tsx` を追加。ルール本文と閉じる操作・Escape・キーボードフォーカスを担当する。
3. `app/src/components/TurnControls.tsx` を追加。ターン番号・開始権限・待機状況と開始/遊び方ボタンを描画する。
4. `GameView.tsx` で表示状態を管理し、ゲーム初回は説明、閉じると開始待ちにする。説明の表示中だけ盤面を操作不可とし、開始アクションは既存のまま利用する。
5. `TokyoBoard.tsx` のマップ操作エリアへターン操作を配置するスロットを追加し、開始待ちでも全員の状況を確認できるようにする。位置調整のみのCSSを追加し、既存の盤面変更を保持する。
6. 対象テストの成功後、app全テスト・build・lintを検証する。Workerのソース・protocol・gameロジックは変更しないため前回のWorker検証を再利用する。
7. 実ブラウザでルールを閉じた後の盤面、右下の開始ボタン、補助ボタン、スマホ幅の表示を確認し、追加の検証記録を保存する。

### 追加依頼の実施結果

- ルール説明を独立したダイアログへ変更。「閉じる」/Escapeは画面だけを閉じ、回答・出題・通信は発生しない。
- ターン番号と開始/遊び方ボタンを右下の盤面操作エリアへ配置。開始待ちはマップの見回し・目的地確認・全員の状況確認を利用できる。
- 説明の開閉と状況確認後のフォーカス復帰を確認。状況画面の背景が操作可能に戻った後にフォーカスを復帰するよう調整。
- レビューで、オンラインの他参加者が説明中に開始した際、次ターンに説明が再表示されるケースを発見。失敗する回帰テストを確認後、開始待ちを離れる際に説明の表示状態を解除して修正。
- 最終app全156件、build、lint成功。Worker関連42ファイルのSHA-256に前回検証から差がなく、Worker73件・統合8件・型検査の結果を再利用。
- 実ブラウザでPC幅と390×844のスマホ幅を確認。説明の開閉、右下の配置、全員の状況、マップ見回し中のボタン配置、開始後の30秒表示と回答欄へのフォーカスを確認。サイズ指定は確認後に解除。
- [追加依頼の検証記録](2026-11-10-turn-controls-verification.json)に検証対象のHEAD/tree・ソースハッシュ・環境とコマンドを保存。本番公開・コミットは行っていない。
