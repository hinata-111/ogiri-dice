# OgiriEvaluator 実装フロー（契約確認）

## 契約の再確認
- `IEvaluator` の契約は `Task<EvaluationResult> EvaluateAsync(string topic, string answer, CancellationToken cancellationToken = default)` です（`Assets/Scripts/Evaluation/IEvaluator.cs:31`）。  
  - 引数 `topic` は `Topic.Prompt`（現在のお題文）、`answer` はプレイヤー／CPU の回答文字列です。  
  - 戻り値 `EvaluationResult` は `score`（1～6）と `comment`（短いツッコミ）を持ち、`Topic` と回答の組み合わせをその場で評価して返します。

## GameManager からの呼び出し
1. `TryPickNextTopic` で `currentTopic` を設定し、`currentTopic.Prompt` を使ってプレイヤー回答を評価対象にする。  
2. UI（後続）から `GameManager.HandlePlayerAnswer(string answer)` のようなメソッドを用意して `currentTopic` を見ながら `await evaluator.EvaluateAsync(currentTopic.Prompt, answer)` を呼ぶ。  
3. 評価中は `GameState.Evaluating` とし、`EvaluationResult` を受け取ったら `ShowingResult` のロジックへ渡してスコアやコメント表示を行う。

## 進め方
1. `OgiriEvaluator` では「辛口放送作家」プロンプト＋ `topic`＋`answer` を `GeminiAPIManager` に渡すための `PreparePrompt(topic, answer)` を用意する。System Prompt/ユーザープロンプトへの整形はここで行う。  
2. `GeminiAPIManager` で JSON を受け取り、`candidates[0].content.parts[0].text` を `EvaluationResult` にマッピング。失敗時は `EvaluationResult(1, "評価失敗")` などデフォルト値を返す。  
3. `GameManager` では `[SerializeField] private MonoBehaviour evaluatorProvider;` を使って Inspector から `OgiriEvaluator` または `MockEvaluator` を注入し、`Awake` で `evaluatorProvider as IEvaluator` して `EvaluateAsync` を呼び出す。UI 未構築でも `MockEvaluator` で `currentTopic`→`EvaluationResult` のパスが検証できる。

このフローをベースに `OgiriEvaluator`/`GeminiAPIManager` を順に実装し、GameManager 側で `EvaluationResult` を使うステート遷移（`ShowingResult`）やスコア処理を固めていきましょう。不明点があれば都度お知らせください。
