# Step 0: JSONスキーマ定義（最小構成）

目的:
- Board用のJSONスキーマを最小項目で定義し、以降のロード実装の基盤を作る。

前提:
- UnityのJsonUtilityで読み込む。
- 必須項目は `id`, `index`, `type`, `label` の4つ。
- `type` は Normal / Blue / Red / Goal の4種。

指示:
- JSONの構造を明確に定義する（例: ルートに `cells` 配列を持つ）。
- `id` は一意である前提を明記する。
- `index` は0始まりのマス番号として扱う。
- `label` はUI表示に使う短文として扱う。
- JsonUtilityで読める形式にする（配列はラップオブジェクトに入れる）。
- 具体的なJSONサンプルを1つ提示する。

出力:
- JSONスキーマ説明（必須項目の意味）
- JSONサンプル（10マス程度の短い例）

完了条件:
- `id`, `index`, `type`, `label` の意味が明文化されている。
- JsonUtilityで読める構造になっている。
