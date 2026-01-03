# 大喜利すごろくゲーム 開発ロードマップ

このドキュメントは、大喜利すごろくゲームの開発をジュニアエンジニア向けに段階的に進めるためのロードマップです。経験豊富な Unity/C# エンジニアとして、Gemini API を使った評価連携とテスト可能な構成を意識して構成しています。

## 1. 全体像の把握
- 対戦（複数プレイヤー）＋CPU（AI）量モードを持つすごろくゲーム全体像を整理し、Gemini API でユーザー回答を「各スコア＋コメント」付きで評価する流れと勝敗判定をイメージ。
- 使用する技術（UnityWebRequest、async/await、JSONパース、Inspector での設定）をリストアップして理解。対戦ロジックではプレイヤー/ラウンド状態の切り替えや CPU 評価間の比較が必要。
- 開発で必要な外部サービス（Gemini API キー・レスポンス構造）の調査を終える。

## 2. 環境とライブラリの準備
- Unity プロジェクトで必要な NuGet/Package（Newtonsoft.Json など）を導入するか、軽量な JsonUtility ラッパーを用意。
- 自動テスト用に `GeminiAPIManager` の API キーや URL を Inspector で差し替えられるように `SerializeField` を用意。
- ネットワーク周りを Unity プロジェクトに紐づけてセットアップ（Player Settings で TLS/HTTP パーミッション確認など）。

## 3. GeminiAPIManager 実装
- POST リクエストを送るメソッドを作成し、`UnityWebRequest.Put` で JSON ボディ（`contents`→`parts`→`text`）を設定。
- `async/await` を使ってレスポンスを待つ。`using var request = UnityWebRequest.Post(...)` を使い、ヘッダーに `Content-Type` 追加。
- API キーを URL の `?key=...` に差し込み、`responseMimeType` を `"application/json"` に設定。
- エラー内容（無効キー、タイムアウト、HTTP ステータス）をログに残す。

## 4. OgiriEvaluator 実装
- 「あなたは放送作家です」プロンプトを構築し、`GeminiAPIManager` を通じてユーザーのお題＋回答を送信。
- 返ってきたレスポンスから `candidates[0].content.parts[0].text` を抽出するユーティリティを作成。
- JSON を `score/comment` の DTO にパース。Newtonsoft ならクラス、JsonUtility ならラッパー。
- 緊急時のデフォルト値（パース失敗時は `score=1` など）を定義して安定化。

## 5. GameManager（テスト用）実装
- Inspector に「お題」「回答」フィールドと「評価開始」ボタン（`[ContextMenu]` など）を用意。
- ボタン押下で `OgiriEvaluator` を呼び出し、Gemini のレスポンスをログ出力。プレイヤー対 CPU の評価を比較するため、2つの評価を実行できるようなフローを用意。
- API エラーやタイムアウトは `Debug.LogError` で表現し、原因と対応（再実行、キー確認）を明示。
- 複数の結果を保持したい場合はリスト/履歴を作り、ログ表示と UI 表示を分離。CPU 評価はモックや固定値で先に動作確認すると安定する。

## 6. 動作確認と微調整
- 実際のお題＋回答を使って実行し、「score=1〜6」「comment=短文」の JSON が出ることを確認。
- レスポンスが JSON 以外・想定外ならプロンプト（System Prompt/ユーザープロンプト）を調整。
- 時間制限や複数連続評価を想定した例（リトライ、タイムアウト）をテスト。

## 7. 次の展開準備
- Gemini API のレート制限や追加パラメータに備えて、結果をキャッシュしたり失敗時の待機処理を検討。
- UI/セーブ/ステート機能の実装に進む前に、Gemini 連携部分を別クラス・インターフェースで分離。
- テスト用のモック（API を呼ばないモックレスポンス）を用意して、ローカルで単体テストしやすい構成へ。

## 補足
- このロードマップは「まず動くもの」が得られることを優先して構成しています。各フェーズで出た課題はタスク化し、次のスプリントでクリアしていくとスムーズです。
- 不明点や具体的なコード例が必要であれば、どのフェーズの何を知りたいか教えてください。
