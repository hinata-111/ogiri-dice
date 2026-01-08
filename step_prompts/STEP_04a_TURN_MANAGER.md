# Step 4a: TurnManager実装

目的:
- プレイヤーのターン順管理システムを構築する。

前提:
- プレイヤーリストを受け取り、順番にターンを回す。
- ターン切替時にイベントを発火する。

指示:
- `TurnManager` クラスを `Assets/Scripts/Game/` に作成する。
- 以下のフィールドとメソッドを実装：
  - `List<Player> players` フィールド
  - `int currentPlayerIndex` フィールド
  - `Player CurrentPlayer` プロパティ（get only）
  - `void Initialize(List<Player> playerList)` メソッド
  - `void NextTurn()` メソッド
    - currentPlayerIndexをインクリメント
    - プレイヤー数を超えたら0に戻る（ループ）
    - Debug.Logで「Player{X}のターン」を出力
  - `Action<Player> OnTurnChanged` イベント

出力:
- TurnManagerクラスの実装
- デバッグログでターン切替を確認

完了条件:
- プレイヤーリストを受け取り、NextTurn()で順番にターンを回せる。
- OnTurnChangedイベントが正しく発火する。
- ログでターン進行が確認できる。
