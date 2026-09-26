# アーキテクチャ

## ゲームの状態

`app/src/game/state.ts`の`gameReducer`がゲーム状態を更新します。UIは描画とアクション発行を担当し、不正な状態遷移はreducerが無視します。定数は`rules.ts`に集約します。

- ローカル: `App.tsx`が入力・タイマー・Evaluatorをつなぎます。
- オンライン: Workerの`GameRoom`が部屋ごとの状態を永続化し、WebSocketで配信します。端末からの要求は`roomModel.ts`が参加資格・手番・期限を検証したうえでreducerへ渡します。
- 共通回答: 全員30秒の受付→並列採点→全員の結果→P1から固定順移動。未提出は1点、採点失敗時は3点のフォールバックです。締切前の回答本文は配信しません。
- 追加お題: 青・赤マスで手番プレイヤーだけが15秒で回答し、金銭を計算します。

## 描画・音響

`GameView`はローカルとオンラインで共用します。`components/map/`は東京マップの描画と移動先の選択、`presentation/`は見た目、`audio/`は状態変化に応じたBGM・効果音を担当します。プレビューの固定データは`src/dev/`に分離しています。

## 評価と秘密情報

採点は`Evaluator`インターフェース経由です。ローカルのモック、APIクライアント、WorkerのGemini評価器を切り替えられます。秘密キーはWorkerだけが持ちます。

## 検証と運用

純ロジックはVitest、画面はTesting Library、WorkerのWebSocket・alarm・復元はMiniflare/workerdで検証します。公開手順と本番検証履歴は[オンライン運用ガイド](docs/online-multiplayer.md)にあります。

旧Unity版の構成は[旧アーキテクチャ](docs/legacy/unity-architecture.md)として保存しています。
