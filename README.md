# 大喜利ダイス

大喜利の回答をGeminiが1〜6点で採点し、その歩数で東京マップを進むブラウザゲームです。劇場などの目的地を巡り、100万円を目指します。

**公開サイト:** https://ogiri-dice.pages.dev/

## 遊び方

- オンライン: 2〜4人が各自のスマホから招待URL・部屋コードで参加します。全員が共通のお題に30秒で回答し、採点後はプレイヤー1から固定順に移動します。
- ローカル: 1台で1〜4人（CPUを含む）が順番に遊びます。通常回答は15秒です。
- 青・赤マスの追加お題はどちらのモードも15秒。青は賞金、赤は目標点に届かなかった分のペナルティです。

## 開発を始める

Node.js 24とnpmを使用します。フロントエンドとWorkerは別々のパッケージです。

```powershell
cd app
npm ci
npm run dev
```

ローカルモードは開発用モック評価器で動きます。オンラインをローカルで試す場合は、別のターミナルでWorkerも起動します。

```powershell
cd worker
npm ci
npm run dev -- --ip 127.0.0.1 --port 8787 --var USE_MOCK:1
```

Viteが表示するURLを開いてください。API/WebSocketは8787番へプロキシされます。Geminiを使用する場合の設定と公開手順は[オンライン運用ガイド](docs/online-multiplayer.md)を参照してください。

## 検証

`app`で`npm test`、`npm run lint`、`npm run build`。`worker`で`npm test`、`npm run typecheck`、`npm run test:integration`を実行します。統合テストはローカルのMiniflare/workerdで動き、本番への公開は行いません。

## 構成

| 場所 | 内容 |
|---|---|
| `app/src/game/` | Reactに依存しないルール・状態遷移・テスト |
| `app/src/components/` | ゲーム画面・東京マップ |
| `app/src/online/` | 部屋への参加・WebSocket・オンライン画面 |
| `app/src/ai/` | Evaluatorとモック・APIクライアント |
| `app/src/audio/`, `presentation/` | 音響・演出 |
| `app/dev/`, `app/src/dev/` | 開発用プレビューと固定データの画面 |
| `app/scripts/` | マップ生成・試聴音声生成 |
| `worker/src/` | Geminiプロキシ・Durable Objectによる対戦管理 |
| `docs/` | 現行仕様・設計・運用・旧資料への案内 |
| `GameCanvas-Unity-master/` | 旧Unity実装。参照専用 |

確認用ページは[プレビュー一覧](app/dev/README.md)、設計は[アーキテクチャ](ARCHITECTURE.md)、仕様の優先順は[ドキュメント一覧](docs/README.md)を参照してください。

## 設定とGit管理

Gemini APIキーは`worker/.dev.vars`と本番WorkerのSecretにのみ置きます。`app/.env.production`は公開APIのURLなど、ブラウザに公開してよい値だけを持ちます。依存物・ビルド成果物・ローカル設定はGit管理対象外です。

このリポジトリはUnity版からWeb版へ移行しています。[旧README](docs/legacy/unity-readme.md)は元仕様の参照用です。現在の起動方法には上記を使用してください。
