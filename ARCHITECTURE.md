# 大喜利すごろくゲーム アーキテクチャ

ゲーム全体の構成は Unity（GameCanvas）側でのプレゼンテーション・状態管理と、Gemini API を通じた大喜利評価ロジックを分離した以下のレイヤー構造になります。

```mermaid
flowchart TD
    subgraph UIレイヤー
        A[GameCanvas Scene]
        B[UI 表示・入力 (オーダー/スコア)]
    end
    subgraph GameLogic
        C[GameManager]
        D[State Machine]
        E[Turn/Score Manager]
    end
    subgraph Evaluation
        F[OgiriEvaluator]
        G[GeminiAPIManager]
        H[Json パーサ]
    end
    subgraph Data
        I[お題リスト (ScriptableObject/JSON)]
        J[CPU回答パターン / 履歴]
    end

    A --> B
    B --> C
    C --> D
    C --> E
    C --> I
    C --> J
    C --> F
    F --> G
    G --> H

    click G "https://cloud.google.com/generative-ai"
```

## レイヤー詳細

- **UIレイヤー (GameCanvas Scene + UI)**  
  GameCanvas の描画ループで背景・サイコロ・キャラクター・スコアを描画し、クリックやタップで GameManager に入力を渡す。このレイヤーは描画/入力に特化させ、ロジックを含めない。

- **GameLogic**  
  - `GameManager` はゲーム進行全体（お題提示・回答受付・Gemini 評価呼び出し・得点比較）を制御。`enum GameState { AwaitingInput, Evaluating, ShowingResult, CPU }` などの状態を持ち、State Machine を通じて処理を切り替える。  
  - `Turn/Score Manager` はプレイヤー/CPU のターン制御と累積スコアを保持。Gemini 評価結果を受け取ると、得点を更新して次のターンを決定する。  
  - CPU モードは `IEvaluator` を経由し、Gemini を呼ばないモック評価器を切り替えられるようにしておくとテストやオフライン開発がしやすい。

- **Evaluation**  
  - `OgiriEvaluator` は「辛口放送作家」プロンプトを組み立て、ユーザー入力とお題を `GeminiAPIManager` に渡す。  
  - `GeminiAPIManager` は `UnityWebRequest` + `async/await` で `gemini-1.5-flash` のエンドポイントに POST。`responseMimeType: "application/json"` を指定して JSON を受け取り、エラーハンドリングを処理。  
  - `Json パーサ`（Newtonsoft or JsonUtility）で `candidates[0].content.parts[0].text` ⇒ `score/comment` を DTO に変換。必要ならパース失敗時のデフォルト値を返すことでゲーム側の安定性を確保。

- **Data**  
  お題リストや CPU 回答パターンは `ScriptableObject` / JSON で外部化し、GameManager から参照。スコア履歴や対戦設定もこのレイヤーで保持し、柔軟な調整（対戦人数や CPU 強度）に対応。

## 追加のポイント

- **依存関係の逆転**: GameManager は `IEvaluator` 抽象を受け取り、Gemini 本番用とモックを継ぎ替えられる。
- **テスト機構**: Inspector テスト機能（`[ContextMenu]`）で「プレイヤー/CPU お題＋回答」を入力し、評価結果をログ出力して GameState とスコア更新を検証。
- **今後の拡張**: キャラクターごとのコマの移動やリアルタイム対戦に進む際は、GameLogic（State Machine）を拡張してネットワーク同期やステート復元を追加。

必要があれば、この構成に基づくクラス図やシーケンス図のテンプレートも提供できますので、続きが必要でしたら教えてください。
