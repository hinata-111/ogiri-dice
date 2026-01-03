# ogiri-dice

「大喜利すごろく」を軸にした放送作家との会話型ステージゲームです。プレイヤーはお題に対してテキストで回答し、その面白さをGemini API（`gemini-1.5-flash`）経由でスコア（1〜6）と短いツッコミコメントで即時評価されます。すごろく盤状のステージを進むことで次のお題へ進行します。

## コンセプトのポイント
- 若手の芸人として、目的地の劇場を巡って百万円を集める。
- Awaiting Input／Evaluating／Showing Result の状態変化に合わせて背景タイルとスポットライトの色・アニメを切り替えることで、Gemini API 待機中の退屈さを回避する。  
- UI はお題をランダムに即取得し、回答入力→評価待ち→結果→次へ のループが直感的になるよう構成する。

## 現在の作業方針
- `UI_UX_PLAN.md` に従い、トピック表示・入力・評価結果の各エリアと状態遷移図を整備し、Gemini 評価待機中のローディングや失敗処理も含めた体験設計を進める。  
- `OgiriEvaluatorFlow.md` をベースに `GeminiAPIManager`/`OgiriEvaluator`/`GameManager` を順に実装し、`EvaluationResult`（スコア＋コメント）を GameState に反映するループを確立する。  


## ゲームルール
- プレイヤーは大喜利で答えながらすごろく盤上を進み、目的地（ゴール）にたどり着くと賞金を獲得できる。  
- 評価の高い回答やイベントでボーナスが加算され、低評価/失敗時にはペナルティや追加ミッションが発生する。  
- 合計100万円を目指し、目的地の劇場を目指す。

## トピック選択の方針
- トピックデータは `GameCanvas-Unity-master/Assets/Scripts/Data`（`TopicDataStore`/`TopicRepository`）で管理しており、現状はカテゴリ・難易度を問わずランダムに `GetRandomTopic()` で引いています。  
- 将来的にカテゴリ絞り込みや優先度を追加したい場合は、`TopicRepository` に optional な `GetRandomTopic(category?, difficulty?)` を用意してランダム性を保ったまま制御できるよう拡張できるようにしてください。
## 目的と要件
- ロール: 経験豊富な Unity/C# エンジニアとして、大喜利すごろくゲームの Gemini API 連携とステート制御を実装。  
- Project Goal: Gemini API（`gemini-1.5-flash`）に回答テキストを送り、「1〜6 の整数スコア＋短いツッコミコメント」を取得して UI/ステージ演出につなげる。

## 実装要件
- `GeminiAPIManager.cs`: `UnityWebRequest` + `async/await` で `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}` に POST。Inspector で API キーを設定し、`responseMimeType: "application/json"` を含んだ `contents → parts → text` 構造のリクエストを送信。環境変数 `OGIRI_GEMINI_KEY` を優先して読み取るようにします。  
- `OgiriEvaluator.cs`: 「放送作家」システムプロンプトを構成してトピックと回答を Gemini API に送信し、JSON から `score`（1〜6）と `comment`（短文ツッコミ）を抽出して `EvaluationResult` を構築。  
- `GameManager.cs`: Inspector 上に「お題」「回答」の入力欄と実行ボタン（`[ContextMenu]` など）を用意し、`AwaitingInput → Evaluating → ShowingResult` の状態遷移を `EvaluationResult` で制御するテスト機構を持たせる。

### システムプロンプトと `EvaluationResult`
- Gemini には以下の System Prompt を送り、JSON 形式の応答だけを返すよう指示します。  
  ```
  あなたは放送作家です。提供された【お題】に対する【回答】を評価し、以下のJSONスキーマのみを返してください。マークダウン記法は不要です。
  { "score": 1~6の整数, "comment": "短いツッコミ" }
  ```  
- `OgiriEvaluator` は `Topic.Prompt` とユーザー回答をこのプロンプトに組み込み、`candidates[0].content.parts[0].text` を `Json.NET`（Newtonsoft.Json）で `JsonConvert.DeserializeObject<EvaluationResult>` などによってパースし、`EvaluationResult.Score`と`EvaluationResult.Comment`を設定。パース失敗や JSON 以外の応答時は `score=1`/`comment="解析失敗"` などのデフォルト値でフォールバックし、UI を停止させないようにする。

## 実装メモ
- Gemini のレスポンスは `candidates[0].content.parts[0].text` の深い階層にあるので、`EvaluationResponseParser` などで拾って DTO に変換する。  
- エラーハンドリング（無効 API キー、タイムアウト、ネットワーク障害、レート制限）を `GeminiAPIManager` 内で完結させ、GameManager はデフォルト値と再試行判断に集中する。

## Gemini API アセットの取り扱い
- `Assets/GameCanvas/Resources/GeminiAPIManager.asset.template` を複製して `GeminiAPIManager.asset` を作成し、Inspector の `apiKey` 欄にキーを貼り付ける。実ファイル `GeminiAPIManager.asset`/`.meta` は `.gitignore` に入っているため GitHub に含まれません。  
- `Resources` 配下（例: `Assets/GameCanvas/Resources`）に置けば `Resources.Load<GeminiAPIManager>("GeminiAPIManager")` でシーン間共有でき、OgiriEvaluator の `Gemini Settings` からドラッグ＆ドロップで設定できます。  
- `.env` やシェル環境変数 `OGIRI_GEMINI_KEY` を設定しておけば、Inspector の `apiKey` より環境変数を優先して読み取るので、複数マシン・CI の運用が容易になります。

## 環境変数のテストと CI でのキー注入
- **ローカルテスト:** プロジェクトルート（このリポジトリ直下）に `.env` を作成し `OGIRI_GEMINI_KEY=実際のキー` を記述。`source .env`（Windows は `set OGIRI_GEMINI_KEY=…`）をして Unity を再起動し、Play モードで `GameManager` → `OgiriEvaluator` を回してコンソールに `GeminiAPIManager: … success=true` が出るか確認します。  
- **CI 例（GitHub Actions）:** セクレト `GEMINI_API_KEY` を登録し、ワークフローで `env: OGIRI_GEMINI_KEY: ${{ secrets.GEMINI_API_KEY }}` を指定。`actions/checkout` → ビルド・テストステップ実行の直前で環境変数にキーが渡るため、テンプレート asset をそのまま置いておくだけで動作します。  
  ```yaml
  env:
    OGIRI_GEMINI_KEY: ${{ secrets.GEMINI_API_KEY }}

  steps:
    - uses: actions/checkout@v4
    - name: Run evaluation smoke test
      run: |
        cd GameCanvas-Unity-master
        # Unity の検証コマンドや試験用スクリプトを実行
  ```

## GameManager の評価失敗ハンドリング
- 評価結果が返ってこなかった（通信エラー、Gemini エラー、JSON パース失敗）ときは UI ロックを解除し、「評価に失敗しました」メッセージと再送ボタンを表示してユーザーが操作をやめないようにします。
- `EvaluationResult` が取得できない場合は `score=1`/`comment="評価失敗"` のデフォルト値を表示し、`TryAgain` などのトリガーで再度 `EvaluateAsync` を呼べるフローを用意しておくと、開発中のデバッグとユーザー体験の両面で安心です。

## Gemini API のログとフォールバック追跡
- `GeminiAPIManager.GenerateAsync` の中で primary（`gemini-1.5-pro`）→ fallback（`gemini-1.5-flash`）の流れを追い、各分岐でログを出します。具体的には primary が成功したら `Debug.Log($"GeminiAPIManager: primary ({primaryModel}) succeeded.")`、rate-limit/失敗で fallback に移ったタイミングでは `Debug.Log($"GeminiAPIManager: primary rate-limited, trying fallback ({fallbackModel}).")`、fallback 成功時には `Debug.Log("GeminiAPIManager: fallback succeeded.")`、両方失敗なら `Debug.LogWarning($"GeminiAPIManager: both models failed. Primary: {primary.ErrorMessage}, fallback: {fallback.ErrorMessage}")` を出します。
- `SendRequestAsync` から返す `RequestResult` に含まれる `ErrorMessage` と `Body` をログに添えて、HTTP ステータスや Gemini からのレスポンス本文（要約）も出力すると再現性が上がります。  
- `OgiriEvaluatorFlow.md` でも「該当ログを確認し、どのモデルで失敗したのか／fallback が起動したのかを追う」と追記し、運用時・デバッグ時にどのログを見ればよいかがすぐ把握できるようにしておきます。
- **GameManager ⇔ UI 連携テンプレート**
- GameManager は `GameState` enum を持ち、UI は CanvasGroup/Animator のトリガーで状態を切り替え。簡単なテンプレート例:
- ```csharp
- public enum GameState { AwaitingInput, Evaluating, ShowingResult }
- public class GameManager : MonoBehaviour
- {
-     [SerializeField] private GameState currentState;
-     public event Action<GameState> OnStateChanged;
-     public void SetState(GameState state)
-     {
-         if (currentState == state) return;
-         currentState = state;
-         OnStateChanged?.Invoke(state);
-     }
-     public void HandleSubmit(string answer) => StartCoroutine(EvaluateAnswer(answer));
- }
- ```
- UI 側は `OnStateChanged` を受けて以下の Animator Trigger / CanvasGroup を呼び出します:
- 1. `TriggerAwaitingInput`（入力欄アクティブ、ローディング非表示）
- 2. `TriggerEvaluating`（入力無効＋Spinner表示）
- 3. `TriggerShowingResult`（スコア＆コメント表示＋Nextボタン）
- 4. Optional: `TriggerRetry`（評価失敗時の再送/エラーメッセージ）
