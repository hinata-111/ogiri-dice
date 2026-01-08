# Step 4b: プレイヤー人数選択UI（オプション）

目的:
- ゲーム開始前にプレイヤー人数（1〜6人）を選択できるようにする。

前提:
- TurnManager（Step 4a）が実装済み。
- GameManagerでPlayer配列を生成し、TurnManagerに渡す。

指示:
- プレイヤー人数選択UIを追加する：
  - Dropdown または Button（1〜6人）
  - Inspector設定でもOK（開発初期）
- `GameManager` に以下を追加：
  - `int playerCount` フィールド（Inspector設定可能）
  - `Player[] CreatePlayers(int count)` メソッド
    - count分のPlayerインスタンスを生成
    - 各プレイヤーに名前（"Player1", "Player2"...）を設定
    - 初期位置0、初期所持金10000円
- 生成したPlayerリストをTurnManagerに渡す。
- ゲーム開始時にTurnManager.Initialize()を呼ぶ。

出力:
- プレイヤー人数選択の仕組み
- GameManagerとTurnManagerの連携

完了条件:
- プレイヤー人数を変更でき、その人数分のPlayerが生成される。
- TurnManagerが正しく初期化され、ターンが回る。
- Inspector またはUIで人数を確認できる。

注意:
- このステップはUI実装が含まれるため、開発初期はInspector設定で代用可能。
- UIは後から追加することも可能。
