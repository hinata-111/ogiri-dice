# Step 2: ボード・プレイヤーの基礎クラス

目的:
- 盤面とプレイヤーの基本データ構造を定義する。

前提:
- Playerは位置と所持金を持つ。
- 初期所持金は10000円。

指示:
- `BoardCell`（id/index/type/label を保持）を作成する。
- `CellType` enum（Normal/Blue/Red/Goal）を作成する。
- `Board` は `BoardCell[]` を保持し、境界チェック用のAPIを持たせる。
- `Player` は `position` と `money` を保持する。
- デバッグ用に現在位置と所持金をログ or Inspectorで確認できるようにする。
- BoardLoader は非同期経由で利用する前提で、統合時に初期化順序を設計する。

出力:
- 各クラスのフィールドと責務の説明

完了条件:
- Board/Playerが最小構成で動作し、情報が確認できる。
