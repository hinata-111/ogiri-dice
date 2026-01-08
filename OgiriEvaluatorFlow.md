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
2. `GeminiAPIManager` は `primaryModel=gemini-1.5-pro` をまず叩き、rate-limit エラーなら `fallbackModel=gemini-1.5-flash` で再試行。`responseMimeType: "application/json"` を指定し、JSON を返す。API キーは ScriptableObject アセットに保持し、Inspector から OgiriEvaluator に割り当てることで安全性を確保（詳細は次節）。`OGIRI_GEMINI_KEY` 環境変数が設定されていれば `GenerateAsync` はその値を最優先で読み取り、`Debug.Log` で `GeminiAPIManager: OGIRI_GEMINI_KEY detected; using environment variable value.` を出力するようになっているため、CI やテスト環境では `.env`/workflow 側でキーを注入するだけで動作します。レスポンスの確認には `GeminiAPIManager: primary (gemini-1.5-pro) succeeded.` → `GeminiAPIManager: primary rate-limited, trying fallback (gemini-1.5-flash).` → `GeminiAPIManager: fallback succeeded.` → `GeminiAPIManager: Both primary and fallback failed...` というログの並びを追えばどちらのモデルが動いたかや、`RequestResult` の `ErrorMessage`/`Body` から HTTP ステータスや本文も確認できます。  
3. `GameManager` は `[SerializeField] private OgiriEvaluator ogiriEvaluator;`（または `IEvaluator`）を受け取り、`AwaitingInput → Evaluating → ShowingResult` という `GameState` を `OnStateChanged` イベントと背景アニメーターの `TriggerAwaitingInput`/`TriggerEvaluating`/`TriggerShowingResult`/`TriggerRetry` で UI（Input Panel/Loading Overlay/Result Panel）の CanvasGroup やライトに伝えることで状態遷移を制御し、`EvaluationResult` を受け取ったらスコアやコメントを表示する。評価失敗時は `score=1`/`comment="評価失敗"` を表示し `RetryEvaluation()` を ResultPanel の Retry ボタンに割り当てて再送可能にしつつ、必要に応じて `MockEvaluator` を差し込んでループの検証を行う。

### ログの運用
- `GeminiAPIManager.GenerateAsync` では primary/fallback の各分岐で `Debug.Log`/`Debug.LogWarning` を出し、primary 成功時には `GeminiAPIManager: primary (gemini-1.5-pro) succeeded.`、rate-limit で fallback に移行したときには `GeminiAPIManager: primary rate-limited, trying fallback (gemini-1.5-flash).`、fallback 成功時には `GeminiAPIManager: fallback succeeded.`、両方失敗時には `GeminiAPIManager: Both primary and fallback failed...` といったログを残します。`OGIRI_GEMINI_KEY` を環境変数で渡していれば `GeminiAPIManager: OGIRI_GEMINI_KEY detected; using environment variable value.` という出力も含まれ、レスポンス本文は `RequestResult.Body` の要約（最大 400 字）をログに添えているため、どのモデル・キー・レスポンスで止まっているのかをたどることができます。  
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
- `.env` や CI 環境で `OGIRI_GEMINI_KEY` を注入した場合は Console に `GeminiAPIManager: OGIRI_GEMINI_KEY detected; using environment variable value.` が出ることを確認し、意図したキーが反映されていることを残します。  
- API キーを変えた場合は再度 Inspector 上で保存し、Gemini へのリクエストが成功することを確認してください。  

このフローをベースに `OgiriEvaluator`/`GeminiAPIManager` を順に実装し、GameManager 側で `EvaluationResult` を使うステート遷移（`ShowingResult`）やスコア処理を固めていきましょう。不明点があれば都度お知らせください。
