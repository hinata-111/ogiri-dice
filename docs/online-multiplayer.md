# オンライン対戦の運用

## 公開先

- ゲーム: https://ogiri-dice.pages.dev/
- 対戦・採点API: https://ogiri-dice-api.yos570038.workers.dev
- Pagesプロジェクト: `ogiri-dice`（production branch: `main`）
- Worker: `ogiri-dice-api`、Durable Object: `GameRoom`（SQLite）

「オンラインで遊ぶ」から名前を入力して部屋を作成し、表示された招待URLを友達に共有する。2〜4人が接続したらホストが開始する。通常は全員が共通のお題に30秒で同時回答する。全員提出または締切で採点し、参加順にプレイヤー1から点数分を移動する。青・赤マスの追加お題は従来どおり手番の人だけ15秒で回答する。部屋は24時間で失効する。

## ローカル起動

別々のターミナルで実行する。

```powershell
cd worker
npm run dev -- --ip 127.0.0.1 --port 8787 --var USE_MOCK:1
```

```powershell
cd app
npm run dev -- --host 127.0.0.1 --port 5173
```

Viteの`/api`プロキシはWebSocketにも対応する。`USE_MOCK:1`はWorker側の検証用設定。本番には設定しない。独立した参加者の検証には異なるブラウザまたはブラウザプロファイルを使う。同じ保存済み参加情報で別画面から接続すると、新しい接続が有効になり、古い画面は操作できなくなる。

## Geminiキー

本番はWorkerの`GEMINI_API_KEY` Secretを使用する。ローカルのキーは`worker/.dev.vars`のみに置き、Gitには含めない。キーをフロントエンドの環境変数に置かない。

登録・変更が許可されている場合、`worker`から以下を実行してプロンプトへ入力する。

```powershell
npx wrangler secret put GEMINI_API_KEY
```

キー未設定・API障害・タイムアウト時はフォールバック3点で進行する。フォールバックでの進行はGemini採点成功の証拠にはならない。

## 検証コマンド

```powershell
cd app
npm test
npm run build
npm run lint
```

```powershell
cd worker
npm test
npm run typecheck
npm run test:integration
```

統合テストは公開せずにWorkerをビルドし、Miniflare/workerdで実行する。2接続の同期、不正操作の拒否、再接続、実alarm、プロセス再起動後の永続化復元、定員競合、一部提出・切断時の共通30秒締切と採点を確認する。

## 最新コードの再公開

上記検証を通してから、公開許可のある作業として実行する。

```powershell
cd worker
npx wrangler deploy
```

```powershell
cd app
$env:VITE_USE_MOCK = '0'
$env:VITE_API_BASE = 'https://ogiri-dice-api.yos570038.workers.dev'
npm run build
node ../worker/node_modules/wrangler/bin/wrangler.js pages deploy dist --project-name ogiri-dice --branch main --commit-dirty=true
```

`app/.env.production`にも同じ公開設定を保存している。シェルの環境変数がある場合はそちらが優先される。上記はGitへのcommit/pushを行わず、現在の作業ツリーからビルドして公開する。

## 2026-09-26の検証記録

- アプリ: 70テスト成功、型検査を含むビルド・oxlint成功。
- Worker: 30テスト成功、型検査成功。
- 実行環境統合テスト: 5テスト成功。
- ローカルの独立した2ブラウザを390×844で確認。部屋作成、招待から参加、双方の回答、手動移動、採点結果共有、ページ再読み込みからの復帰を確認。
- 本番Pages: `2e31a071-b7d3-4086-9213-f6a2436b98ae`、Production/main。配信バンドル `index-Diyrj5mF.js` とHTTP 200を確認。
- 本番Worker初回公開: `20c624c9-031e-4497-b2b0-8cd11c472279`。
- 本番の独立した2ブラウザで部屋作成・参加・待機室同期・同じお題の表示・手番ごとの操作制限・手動移動後のチャレンジ進行・ページ再読み込み後の席の復帰を確認。
- 既存キー再利用の明示承認後、`GEMINI_API_KEY`を本番Secretに登録済み。旧Unityファイルは変更していない。
- 旧キーはGoogleからHTTP 400 / INVALID_ARGUMENTで拒否されたため、ユーザーが`worker/.dev.vars`に設定した更新済みキーを本番Secretへ反映。
- 更新後、本番の独立した2接続で回答を送信し、Geminiの実採点（5点とコメント）が同じ状態として配信されることを確認。フォールバックなし。確認後は両参加者を退出させた。
- 実スマートフォン2台の別回線からの動作は未確認。ブラウザのスマホ幅検証と区別する。


## 2026-09-26 main 3bd667d のUIを反映

GitHub mainの3bd667d（縦画面UI・イラスト東京マップ）を取得し、既存のオンライン対戦に統合。3bd667d単体にはオンライン対戦が含まれないため、公開物は同コミットのUIとオンライン統合変更を含む作業ツリーから生成した。Gitへの追加コミット・pushは行っていない。

- Pages productionを80a4cdd0.ogiri-dice.pages.devへ更新。通常の公開URLは引き続き https://ogiri-dice.pages.dev/ 。
- 配信JSはindex-T4BBs6zm.js。通常公開URLのHTTP 200と、東京マップ画像が取り込んだmainの画像とSHA-256で一致することを確認。
- アプリ85テスト、型検査を含むビルド、oxlint成功。
- 本番の独立した2ブラウザで参加、同じお題の表示、実Gemini採点（3点と講評、フォールバックなし）、新マップでの手動移動の共有、観戦者の移動操作非表示、リロード後の席の復帰を確認。
- 390×844の両画面で新版マップの配置を確認。実スマホ2台・別回線の実機検証ではない。
- バックエンドのプロトコル・ゲームルール・本番Secretは今回変更していない。既存のWorkerを継続使用。

## 2026-09-27 共通30秒ラウンドを本番反映

- ユーザーの「反映させて」に基づき、現在の作業ツリーを本番へ公開。
- アプリ111テスト、Worker33テスト、Worker統合5テスト、app build/lint、Worker型検査成功。
- Worker version: cf6e24a6-6ef0-443f-9668-d06bfe2f3b21。
- Pages production: https://f18992a6.ogiri-dice.pages.dev 。通常URL https://ogiri-dice.pages.dev/ のHTTP 200と新バンドル index-CaCA18Ws.js の配信を確認。
- 本番の独立した2つのWebSocket接続で、共通30秒、同一revisionから両者の回答受付、締切前の回答本文秘匿、両者の実採点（fallback=false）、P1から点数分の移動開始を確認。確認後は両参加者を退出。
- 追加お題15秒の仕様を維持。実スマホ複数台での今回の検証は未実施。
