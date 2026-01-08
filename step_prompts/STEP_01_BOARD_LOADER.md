# Step 1: Boardデータ読み込み（StreamingAssets）

目的:
- StreamingAssetsのJSONを読み込み、`Board` のセル配列に変換する。

前提:
- 既存の `TopicRepository` と同様にロード設計する。
- JsonUtilityで読み取れるDTOを使う。

指示:
- `BoardLoader` クラスを作成する。
- StreamingAssetsからJSONを読み込む（失敗時は空Boardで警告ログ）。
- DTO（例: `BoardData`, `CellData`）を定義し、`Board` の `BoardCell[]` に変換する。
- モバイル/WebGL向けに `LoadDataFromStreamingAssetsAsync` を用意し、非同期経由を標準とする。
- iOS実機ではファイル読込可能だが、フレーム停止を避けるため非同期経由を基本とする。
- JSONが空/不正の場合のフォールバックを明記する。
- 既存の `GameManager` にはまだ組み込まない（Step 2以降で統合）。

出力:
- `BoardLoader` の責務と流れ
- 主要なDTOの定義

完了条件:
- JSON読込失敗時に警告ログを出して空Boardを返す。
- 正常時に `BoardCell[]` が生成できる。
