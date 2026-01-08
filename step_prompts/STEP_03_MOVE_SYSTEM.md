# Step 3: 1マスずつ移動の基盤

目的:
- 1マスずつ進む移動演出の基盤を作る。

前提:
- 0.1秒間隔で1マスずつ進める。
- `GameManager` から呼べるAPIにする。

指示:
- `BoardManager` を追加する。
- `MovePlayerCoroutine(player, steps)` を実装し、1マスごとに `player.position` を更新する。
- 0.1秒待機しながら進める。
- 移動完了イベント（例: `OnMoveFinished`）を発火する。
- `steps=0` の場合は即完了扱いとする。

出力:
- 1マス移動ロジックの概要
- 移動完了イベントの仕様

完了条件:
- `steps` の値に応じて段階的に移動し、最後に完了通知が出る。
