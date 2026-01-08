# Step 4: Player count selection and turn manager (1-6 players)

Prompt:
ゲーム開始前にプレイヤー人数（1〜6人）を選べる仕組みを追加。選択人数ぶん `Player` を生成し `TurnManager` で管理。既存 `GameManager` の評価完了後に `BoardManager` へ steps を渡し、移動→イベント処理→ターン切替の順で実行する流れを組み込む。
