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
1. `OgiriEvaluator` は `PreparePrompt` でプロンプトを生成し、`GeminiAPIManager.GenerateAsync` へ投げて JSON を取得、`EvaluationResponseParser.Parse` で `EvaluationResult` を構築する一連の非同期フローを実装（例外/キャンセルはログを残してデフォルト結果にフォールバック）。  
2. `GeminiAPIManager` は `primaryModel=gemini-1.5-pro` をまず叩き、rate-limit エラーなら `fallbackModel=gemini-1.5-flash` で再試行。`responseMimeType: "application/json"` を指定し、JSON を返す。API キーは ScriptableObject アセットに保持し、Inspector から OgiriEvaluator に割り当てることで安全性を確保（詳細は次節）。  
3. `GameManager` は `[SerializeField] private OgiriEvaluator ogiriEvaluator;`（または `IEvaluator`）を受け取り、UI からの入力を `EvaluateCurrentAnswerAsync(answer)` 経由で `EvaluationResult` に変換し、スコアや `ShowingResult` への遷移に使う。UI が固まっていなくても `MockEvaluator` を差し込むことで GameLogic 側のループを検証可能。

### ログの運用
- `GeminiAPIManager.GenerateAsync` では primary/fallback の各分岐で `Debug.Log`/`Debug.LogWarning` を出し、primary 成功・primary rate-limit → fallback・fallback 成功・fallback 失敗のタイミングでそれぞれモデル名・HTTP ステータス・レスポンス本文を残す。`RequestResult` の `ErrorMessage`/`Body` を活用すると詳細な原因追跡が可能です。  
- `OgiriEvaluatorFlow` のフローを確認するときはこれらのログが出ているかを先にチェックし、fallback に落ちたパスを辿りながら原因（API キー/レート制限など）を突き止めるようにしてください。

## Gemini API セットアップ
### 目的
`GeminiAPIManager` の API キーを ScriptableObject アセット化し、OgiriEvaluator にアサインすることで GameManager から UI を介さず評価を呼び出せるようにします。

### 手順
1. Unity Editor の `Project` ウィンドウで右クリック → `Create -> Ogiri Dice -> Gemini API Manager` を選び `GeminiAPIManager` アセットを作成（例: `Assets/GameCanvas/Resources/GeminiAPIManager.asset`）。  
2. アセットを選択し、Inspector の `Api Key` フィールドに Gemini のキーを貼り付ける。`Primary Model` は `gemini-1.5-pro`、`Fallback Model` は `gemini-1.5-flash` に設定する。  
3. OgiriEvaluator をアタッチした GameObject（例: GameManager）を選び、Inspector の `Gemini Settings` セクションに先ほどのアセットをドラッグ＆ドロップ。API キーは `Assets/GameCanvas/Resources/GeminiAPIManager.asset` 内の `apiKey` フィールドに直接貼り付けるか、Unity Inspector からペーストしてください。必要に応じて TopicRepository や StreamingAssets の設定も確認する。  
4. `Resources`（`Assets/GameCanvas/Resources` など）に置いておけば複数シーンから `Resources.Load<GeminiAPIManager>("GeminiAPIManager")` で使い回せます。

### 確認
- Play モード開始時、GameManager が `OgiriEvaluator` 経由で `GeminiAPIManager.GenerateAsync` を呼び、Console に「Loaded … topics」「Selected topic …」「Fallback model succeeded」などのログが出ていれば正しく設定されています。  
- API キーを変えた場合は再度 Inspector 上で保存し、Gemini へのリクエストが成功することを確認してください。

このフローをベースに `OgiriEvaluator`/`GeminiAPIManager` を順に実装し、GameManager 側で `EvaluationResult` を使うステート遷移（`ShowingResult`）やスコア処理を固めていきましょう。不明点があれば都度お知らせください。
