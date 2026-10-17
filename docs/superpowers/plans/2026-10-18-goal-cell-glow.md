# ゴールマスを金色に光らせる

ユーザー指定: 「ゴールのマスの色は金色に光らせて」。現在の目的地マス本体だけを金色にし、周囲に静かな光を付ける。点滅やアーチの演出追加は行わない。

## 実装

- `TokyoBoard.tsx` の既存の目的地判定からマス本体へ `goal` クラスを付与する。マスの識別には `data-cell-id` を使い、既存ボタンの `data-node-id` と区別する。
- `tokyo-board.css` で金色の塗りと淡い金色の光を設定。移動可能なゴールには既存の緑色の輪郭を残す。
- 目的地の変更・解除・ゲーム終了で金色と光を外す。マス種別・移動処理・reducer・Workerは変更しない。
- 既存のゴールアーチ仕様を、マス本体の金色発光について今回のユーザー指定で拡張する。アーチ自体は従来どおり。

## 検証

- `GoalCell.test.tsx` を先行追加し、金色の目的地が存在しないことで2件の失敗を確認してから実装。
- `npm test -- src/components/map/GoalCell.test.tsx src/components/map/TokyoBoard.test.tsx`: 24テスト成功。
- `npm run build`、`npm run lint`、`git diff --check`: 成功。
- Codex内蔵ブラウザの1280×800・390×844でゴール本体の金色と光を目視確認。移動可能時の緑輪郭、ゴールの直接タップ、目的地変更後の元の色への復帰も確認。
- 環境: Windows / PowerShell、Node v24.16.0、npm 11.13.0、Vite 8.1.3。物理スマートフォンでの確認は未実施。
- ベースcommit: `ba899eeab97915d4e43e620000fe306a07c5e474`。検証対象の作業ツリー（HEADへ作業中のapp/・worker/を反映）のtree ID: `6f9417ebfeb163e11cec9230d1328c1107a25300`。一時index・一時オブジェクト保存先で計算し、利用者のindexは変更していない。
- `TokyoBoard.tsx` SHA256: `CA416A3526904A12D17DD934ABB4214EC32EF02E552AD84BCE3ECB8D0341EB69`。
- `tokyo-board.css` SHA256: `70C2F08260833E331C5A50ABC00C4A09CE83F715ADFB32C5697EABE539641110`。
- `GoalCell.test.tsx` SHA256: `69FE788426A75B0546C17500443C5C87A339937C13AD4C868F5206A84E2DD5B6`。
- 今回の変更はローカルのみ。コミット・push・公開は行っていない。

## 2026-10-18 公開準備

- ユーザーの「公開して」に基づき、現行公開版main `466cfabe090eb57c7104bfa97f7e8cdd18d652f4`へゴールの描画・CSS・テスト・本記録だけを取り込んだ。
- 別件の未公開変更は含めていない。Worker・Secretは更新しない。
- mainで `npm test -- src/components/map/GoalCell.test.tsx src/components/map/TokyoBoard.test.tsx src/components/map/GoalArch.test.tsx` の25テスト成功。本番設定build、oxlint、差分検査も成功。
- Windows / PowerShell、Node v24.16.0、npm 11.13.0、Vite 8.1.3。本番API接続・モック無効。
- 公開用JS `index-BzcnrnO0.js`: SHA256 `C9E5E984A76886D9E21F1130354E679F8D4AC8D261F0FD642697CB73ADCDFDDD`。
- 公開用CSS `index-8Ho7N5h9.css`: SHA256 `FA958355C2878CEDB29F8F6432DA267003DA32BD511CBA5FA82F60A3766AB5F0`。
- 検証済みapp subtree ID: `ae30248b341f3195c872caf8583e6366d3c88ade`。
