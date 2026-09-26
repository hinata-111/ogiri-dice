# 共通お題ラウンド Implementation Plan

**Goal:** オンラインで全員が30秒の共通お題に回答し、P1から固定順に移動する。追加お題は15秒のまま。

**Architecture:** gameReducerに共通回答・並列採点・結果一覧とラウンドデータを追加。Roomは期限・参加資格・採点ジョブを管理し、配信時に回答本文を締切まで秘匿する。GameViewは本人の提出状況と全員の結果を描画する。

**Tech Stack:** React、TypeScript、Vitest、Cloudflare Durable Objects。

1. `app/src/game/sharedRound.test.ts` に同時回答、重複拒否、時間切れ、順不同採点、固定順移動、追加お題後の歩数保持、次ラウンドのテストを書く。`npm test -- src/game/sharedRound.test.ts` の失敗を確認。
2. `app/src/game/state.ts` にラウンド用アクション・フェーズ・データ、`rules.ts` に30秒定数を追加し上記テストを通す。既存ローカルフローを維持。
3. `worker/src/roomModel.test.ts` に同じrevisionからの別プレイヤー同時提出、秘匿、30秒共通期限、評価期限・復帰のテストを先行追加。roomModelとroomで通常回答だけラウンド識別に変更し、alarm経由も採点開始可能にする。
4. `app/src/online/OnlineGame.test.tsx` に全員入力、提出済み待機、結果一覧のテストを追加。protocol、OnlineGame、GameView、RoomLobbyの文言と描画を変更。
5. `worker/tests/rooms.integration.mjs` を共通回答フローへ更新し、WebSocket・alarm経由の提出/締切/採点を確認。
6. app/worker全テスト、app build/lint、worker typecheck/integrationを実行。オンライン仕様と利用ガイドを同期する。公開は行わない。

完了: 1〜6を実施。検証記録は対応するshared-round-design.mdに記載。
