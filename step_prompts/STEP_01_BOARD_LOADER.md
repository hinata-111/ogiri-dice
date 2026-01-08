# Step 1: Board data loading (StreamingAssets)

Prompt:
既存の `TopicRepository` と同様に、StreamingAssetsからJSONを読み込む `BoardLoader` を作成。`JsonUtility` で読めるDTOを用意し、`Board` のセル配列に変換する。読み込み失敗時は空Boardで警告ログ。
