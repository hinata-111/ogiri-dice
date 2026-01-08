# Step 3: Step-by-step movement system

Prompt:
`BoardManager` を追加して `MovePlayerCoroutine(player, steps)` を実装。0.1秒間隔で1マスずつ進める。移動完了時にイベント（OnMoveFinished）を発火。`GameManager` から呼び出せる public API にして。
