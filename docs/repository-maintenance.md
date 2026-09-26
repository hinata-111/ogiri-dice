# Gitに記録する対象

以下はWeb版・オンライン対戦・表示音響・リポジトリ整理をGitに記録する際の区分です。

- Web版・オンライン対戦: `app/src/`, `worker/src/`, `worker/tests/`, パッケージ定義・ロックファイル・Vite/Wrangler設定。
- 表示・音響素材: `app/public/art/`、`app/src/audio/`、`app/src/presentation/`。旧コンポーネントの削除も置き換えの一部としてレビューします。
- 開発用プレビュー: `app/dev/`、`app/src/dev/`、`app/scripts/`。`dev/audio/previews/`には音響テストが比較する参照音声も含まれるため、まとめて削除・ignoreしないでください。
- ドキュメント: ルートREADME・アーキテクチャ・AGENTS/CLAUDE、`docs/`。
- `app/.env.production`: 公開API URLとモック切替のみ。秘密情報を含めない設定として管理します。

`.dev.vars`、個人用`.env.*.local`、`.claude/settings.local.json`、`.superpowers/`、`node_modules/`、`dist/`、`.wrangler/`、ブラウザ確認成果物は管理対象外です。

本番公開はGitコミットとは別に行います。差分・テストを確認してコミット・pushした状態からビルドし、Pagesには対象コミットのSHAを付けて公開します。公開先と過去の検証記録はonline-multiplayer.mdを参照してください。
