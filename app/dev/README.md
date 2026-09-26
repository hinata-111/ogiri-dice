# 開発用プレビュー

`app`で`npm run dev`を起動し、表示されたURLに以下のパスを付けて開きます。

| パス | 内容 |
|---|---|
| `/dev/board.html` | 東京マップの全地点・4人配置 |
| `/dev/scenes.html` | 回答・結果・青赤・到着・最終順位の固定データ |
| `/dev/presentation-review.html` | 画面を並べた表示確認 |
| `/dev/console-review.html` | サイズ・場面の切り替え |
| `/dev/bgm-preview.html` | BGMの試聴 |

Reactのプレビュー入口は`app/src/dev/`、試聴音声はこのディレクトリの`audio/previews/`にあります。HTML・音声は本番の`dist`へコピーされません。

試聴音声の再生成は`app`で`node scripts/render-original-bgm-variants.mjs`を実行します。別案の生成は`python scripts/render-bgm-previews.py`（NumPyが必要）です。音声生成はゲーム本体の曲を変更しません。
