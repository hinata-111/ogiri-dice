# TopicDataStore の使い方

## 概要
`TopicDataStore` は `CreateAssetMenu` を持った `ScriptableObject` で、Unity Editor 上から `Topic[]` を直感的に編集できるデータリポジトリです。`TopicRepository.ToRepository()` を介して GameManager や他のシステムでそのまま利用できます。

## 作成手順
1. Unity Editor で `Assets` フォルダを右クリックし、`Create -> Ogiri Dice -> Topic Data Store` を選択してアセットを生成します。適切な場所（例: `Assets/Data/TopicDataStore.asset`）に保存してください。
2. インスペクタ上で `Topics` 配列を展開し、1行ずつ `Id`・`Category`・`Prompt`・`Difficulty` を設定します（`Difficulty` は `Easy`/`Normal`/`Hard`）。
3. 必要であれば `category` に UI タブ名、`difficulty` にステージ/ターゲットの難易度を設定し、保存します。

## ゲーム内での利用
- `TopicRepository.FromStore(myTopicDataStore)` を呼ぶことで `Topic[]` をそのままリポジトリに渡せます。`GameManager` の初期化時に `TopicRepository` を `TopicDataStore.ToRepository()` で構築するのも簡単です。
- UI 側では `topic.Category` でセクションを分け、`TopicDifficulty` を選択してフィルタリングすることで、「簡単」→「難しい」へ段階的に出題できます。
- `TopicDataStore` を複数用意してプレイモード（例: 週末イベント/常設モード）ごとに差し替えることも可能です。デザイナーは Inspector 上で直接 `Category`・`Difficulty` を編集するだけで新しいセットを構築できます。

このワークフローを守ることで、データ量が増えても UI 表示・出題・Gemini 評価ロジックはクリーンに保てます。
