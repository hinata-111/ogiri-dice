# UI/UX 実装計画書

## 目的
大喜利すごろくのコアループ（お題提示→回答受付→評価→結果表示→次のお題）がユーザーに分かりやすく、待機時間中も状態が伝わる体験になるように UI/UX を設計する。

## 画面構成
1. **お題表示エリア**
   - 現在の `Topic`（`category`/`difficulty` を含む）を中央上部に表示。

2. **回答入力エリア**
   - `TMP_InputField` か `InputField` を画面下部に設け、送信ボタン（`Submit`）と一体化。
   - 送信時はボタンを無効化し、ローディング表示やスピナーを出して評価待ちを明示。
   - 解答時間は15秒でタイマーを右上に表示し、秒数のカウントを行う。
3. **評価結果エリア**
   - `EvaluationResult.Score` を大きい数値＋ゲージで表示（1〜6）。
   - `EvaluationResult.Comment` を吹き出し風のテキストで表示する。

4. **移動エリア**
   - `EvaluationResult.Score`分のますを矢印キーで移動する
   - 止まったマスによってはイベントが発生する

5. **イベントマスエリア**
   - 止まったマス目に応じてイベントが発生する。
   - 種類:
      - 赤マス: お題と1~4のランダムな数字(目標値)が表示され、回答を入力し`EvaluationResult.Score`を得る（**回答入力エリア**-> **評価結果エリア**と同様）。目標値を下回ると所持金が減る。
      - 青マス:お題が表示され、回答を入力し`EvaluationResult.Score`を得る（**回答入力エリア**-> **評価結果エリア**と同様）。`EvaluationResult.Score`に応じて所持金が増える。
   - `Next` ボタンで `TryNextPlayer` を呼んで次のプレイヤーのターンへ移行。

## 状態遷移と GameManager 連携
| 状態 | UI 表示 | GameManager 呼び出し |
| --- | --- | --- |
| AwaitingInput | 入力欄アクティブ・評価結果非表示 | `TryNextPlayer` (前段階で) |
| Evaluating | 入力欄ロック + 評価中 UI | `EvaluateCurrentAnswerAsync(answer)` を await |
| ShowingResult | 結果表示（スコア/コメント） + Next ボタン表示 | 結果受け取り後に `Next` で `TryNextPlayer` |

GameManager 側では `EvaluationResult` を受け取ると `GameState` を `ShowingResult` に切り替え、それを UI にイベント通知 (`Action<GameState>` など) すると状態同期が取れる。

## UX 強化
- 評価失敗時は「評価をやり直す」ボタンを表示し、ロケール設定に応じたメッセージ（例:「通信エラー」）も表示。
- `MockEvaluator` を挿せば、API停止時でも UI/UX のループ確認ができるようにする。

## テスト観点
1. Inspector の `ContextMenu` でモック回答を送信し、スコア/コメントの表示が想定通りか確認。
2. 難易度切り替えボタンを押して `GameManager` が `difficulty` パラメータを正しく渡すかログでチェック。
3. `GeminiAPIManager` でレート制限が発生したときに `fallback` ルートが呼ばれるか、UI が「評価中」状態で固まらないか検証。

## デザイナーへの共有
- `UI View` プレハブに `GameView` スクリプトをアタッチし、Inspector から `GameManager`/`InputField`/`ResultText` を参照する。
- `TopicDataStore`/`GeminiAPIManager` のアセットを `Resources/UiConfig` にまとめて、シーンを切り替えても共通設定を使えるようにする。

## 次の作業
1. `GameView` MonoBehaviour を実装し、ボタン/入力欄の信号を `GameManager` に渡す。
2. Canvas に UI 要素（お題テキスト・評価結果・ローディング）を配置し、状態遷移に合わせた Animator/Color を設定。
3. `MockEvaluator` を用いた Play モードでの UX 確認と、Gemini API 実装時の差分テストを行う。
