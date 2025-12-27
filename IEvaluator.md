# IEvaluator 抽象

## 概要
`IEvaluator` はお題/回答ペアを受け取り、スコア（1～6の整数）と短いコメントを返す非同期契約です。Gemini API を呼ぶ本番実装も、テスト用のモック/CPU 実装もこのインターフェースを通して GameManager に差し替えることで、UI/状態遷移のロジックに余計な依存を持たせずに済みます。

## 使い方の例
1. `GameManager` は `[SerializeField] private MonoBehaviour evaluatorProvider;` のようにコンポーネントや工場を受け取り、起動時に `IEvaluator evaluator = evaluatorProvider as IEvaluator;` で取得します。
2. 評価が必要なタイミング（`GameState.Evaluating`）で `await evaluator.EvaluateAsync(currentTopic, playerAnswer)` を呼び出し、返却値を使ってスコア更新や結果表示を行います。
3. テストやオフライン実行時は、`new MockEvaluator((topic, answer) => new EvaluationResult(4, "CPUモードコメント"))` のように簡易評価器を注入すれば Gemini 呼び出しなしで動作確認が可能です。

## 実装の切り替えパターン
- **本番 (GeminiEvaluator)**: `OgiriEvaluator` + `GeminiAPIManager` で JSON をパースし、`EvaluationResult` を構築して返す。
- **モック/CPU**: 固定スコアやランダム・簡易計算を行い、`MockEvaluator` で `IEvaluator` を実装。特定のメソッドで `EvaluationResult` を返すだけなので GameManager からの呼び出しは変わりません。

## 次の作業
1. `GeminiEvaluator`（`IEvaluator` を実装）と `OgiriEvaluator` の連携コードを追加して、実際の API 呼び出しと JSON パースをつなげる。
2. `GameManager` の状態遷移図と照らし合わせて、`Evaluating` ステートで `IEvaluator` を呼ぶ箇所を明示する（例えば `OnEnterEvaluating` など）。
3. Inspector/DI の仕組みで本番用とテスト用の `IEvaluator` を切り替える設定をまとめる。
