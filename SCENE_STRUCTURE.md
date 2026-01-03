# Scene/Prefab 構成ガイド

このドキュメントは Unity シーンでの GameManager・UIパネル・Animator の配置と接続ルールを整理するものです。実装段階で「どの GameObject に何を入れるか」「Inspector で何をつなげるべきか」がひと目で理解できるようにまとめます。

## 1. GameObject 構成（Prefab化の候補）

| GameObject | 役割 | 主なアタッチコンポーネント |
|------------|------|-----------------------------|
| `GameManager` | ゲームロジック・状態遷移のコントローラ | `GameManager` スクリプト、`OgiriEvaluator`、`GeminiAPIManager`（ScriptableObject 参照） |
| `UI Root`（Canvas） | 全 UI 要素の親。Canvas + CanvasScaler + GraphicRaycaster をアサイン | - |
| `Input Panel`（CanvasGroup） | 回答欄＋送信ボタン | `CanvasGroup`、`TMP_InputField`/`InputField`、`Button`、`GameView` など |
| `Loading Overlay` | 評価中のオーバーレイ表示 | `CanvasGroup`、`Animator`（状態遷移）、`TMP_Text`（「評価中…」など） |
| `Result Panel` | スコア/コメント表示＋Next/Retry | `CanvasGroup`、`Animator`、`TMP_Text`（score/comment）、`Button`（Next/Retry） |
| `Background Lights` | ステージライト・タイル部分 | `Animator`（Color/Emission にアニメーション）、`SpriteRenderer`/`Image`など |

※ `Input Panel`・`Loading Overlay`・`Result Panel` は Prefab にしておくと再利用がしやすい。`GameManager` の Inspector で `SerializeField` 参照を持たせて Drag&Drop できる構成にします。

## 2. GameManager → UI 連携（Inspector 配置）

- `GameManager` スクリプトは以下の SerializedField を持つ想定:
  - `InputPanelController inputPanel`
  - `ResultPanelController resultPanel`
  - `LoadingOverlayController loadingOverlay`
  - `Animator backgroundAnimator`
  - `CanvasGroup baseCanvasGroup`
- `OnStateChanged(GameState state)` で `inputPanel.SetActive(state == AwaitingInput)` などを切り替えると同時に、それぞれの Animator Trigger を発火します。

## 3. Animator Controller（シンプルステート）

Animator Controller は `UI Root` 直下もしくは各パネルの Animator にアタッチ。以下の Trigger を持ち、State を切り替えるだけで CanvasGroup やライトの状態が変化します。

| Trigger | 内容 |
|---------|------|
| `TriggerAwaitingInput` | 入力欄を表示、Loading/Result を非表示。ライトを落ち着いた色に。 |
| `TriggerEvaluating` | 入力無効＋スピナー表示。ローディングテキスト出現。ライトを集中色（黄色やオレンジ）に。 |
| `TriggerShowingResult` | スコア/コメント表示と Next ボタン表示。結果用ライトを短く光らせる。 |
| `TriggerRetry` | 評価失敗時の状態（エラー表示＋再送ボタン）。`TriggerShowingResult` 状態に遷移後、Retry ボタンだけを強調する形でも可。 |

各 Animator には CanvasGroup の alpha を切り替える State を作り、`CanvasGroup.alpha` を直接アニメートするか、`CanvasGroup.interactable` をトグルします。背景ライト用 Animator には Color/Emission のタイムラインを入れて状態感を補完してください。

## 4. Prefab 接続フロー

1. `Input Panel` Prefab: `TMP_InputField` と `SubmitButton`（`GameView` など）をアタッチ。`SubmitButton.onClick` で `GameManager.HandleSubmit` を呼ぶよう設定。
2. `Loading Overlay` Prefab: `Animator`（上の Trigger を持つ）をアタッチし、`GameManager` の `OnStateChanged` から `animator.SetTrigger("TriggerEvaluating")`。
3. `Result Panel` Prefab: `TMP_Text`（score/comment）と `NextButton`/`RetryButton` を持ち、`Next` は `GameManager.TryPickNextTopic()`、`Retry` は `GameManager.RetryEvaluation()` などに接続。
4. `Background Lights` オブジェクトの Animator は `GameManager` から `animator.SetTrigger` で `TriggerAwaitingInput`/`TriggerShowingResult` を叩き、状態に応じて色を変えます。

## 5. 開発をシンプルに保つためのアドバイス

- UI の見た目は CanvasGroup の alpha を切り替えるだけに留め、複雑な Tween は後回し。  
- Animator Trigger を少数に絞ればステート設計が楽になる。  
- Prefab で動作確認する際は `MockEvaluator` を差し込み、UI の状態遷移が正しく `State` を反映しているかを確認します。

必要であれば、この構成を図に起こして `SCENE_STRUCTURE.md` に挿絵を追加することもできますので、指示をください。*** End Patch***/
