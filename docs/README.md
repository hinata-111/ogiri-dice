# ドキュメント一覧

## 現在の開発・運用

- [README](../README.md): 起動、遊び方、検証コマンド
- [アーキテクチャ](../ARCHITECTURE.md): 実装の責務と状態管理
- [オンライン運用](online-multiplayer.md): 設定、公開、検証履歴
- [開発用プレビュー](../app/dev/README.md): 画面・音響の確認

- [Git管理対象](repository-maintenance.md): 整理後の変更区分と除外対象

## 仕様の優先順

移動操作は[隣接マスの直接移動](superpowers/specs/2026-10-18-direct-cell-movement-design.md)、地図の見回しは[マップ操作](superpowers/specs/2026-09-28-map-navigation-design.md)を参照します。

両モードの通常回答・移動順は[共通30秒ラウンド](superpowers/specs/2026-09-26-shared-round-design.md)を最優先にします。部屋・接続・復帰は[オンライン対戦](superpowers/specs/2026-09-26-online-multiplayer-design.md)、盤面・青赤チャレンジ・賞金・勝利条件は[v2東京マップ](superpowers/specs/2026-07-08-ogiri-dice-v2-tokyo-map-design.md)を参照します。

`superpowers/specs/`は各変更の設計、`superpowers/plans/`は実施計画です。`design/`は見た目・音響の検討と確認記録、`research/`は調査資料です。過去の設計書の承認状態や検証履歴は、現在のコード全体の状態を保証するものではありません。

## 元仕様・旧Unity資料

- [旧README](legacy/unity-readme.md)、[旧アーキテクチャ](legacy/unity-architecture.md)
- ルートの`map.md`、`UI_UX_PLAN.md`、`SCENE_STRUCTURE.md`、`OgiriEvaluatorFlow.md`、`TopicDataStore.md`、`DEVELOPMENT_ROADMAP.md`、`step_prompts/`は元仕様・旧実装資料として保持しています。
- `GameCanvas-Unity-master/`は参照専用です。

現在の環境構築にはルートREADMEを使用してください。
