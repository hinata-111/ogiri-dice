# Direct Cell Movement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 隣接マスそのものを押す1操作で1歩進める。

**Architecture:** TokyoBoardのマス情報用ヒット領域を、合法候補では移動用へ切り替える。既存のカメラのジェスチャー抑止とSTEP_TOを使い、ゲーム状態はreducerだけが変更する。既存の未コミット変更とゴールアーチを維持する。

**Tech Stack:** React 19、TypeScript、Vitest、oxlint、Vite。

## Task 1: 操作の回帰テスト

1. `app/src/components/map/TokyoBoard.test.tsx`の旧選択＋確定テストを、実マスの1クリック／タップでonStepを1回発行するテストへ更新する。
2. 移動後の候補更新、通信待ち・CPU、ドラッグ・ピンチ後の誤入力、見回し中の移動、同一状態の重複送信とキーリピートを確認する。
3. `app/src/App.test.tsx`と`app/src/online/OnlineGame.test.tsx`をマス直接操作へ更新する。
4. `cd app; npm test -- src/components/map/TokyoBoard.test.tsx src/App.test.tsx src/online/OnlineGame.test.tsx`で、新操作が未実装のため失敗することを確認する。

## Task 2: UI実装

1. `app/src/components/map/TokyoBoard.tsx`からselection、placeChoices、A/B/C、比較欄、決定ボタンを除く。
2. 各マスの座標に置いた透明なbuttonを合法隣接時だけ移動可能にし、クリックでonStep(nodeId)を発行する。ドラッグ抑止はuseMapCameraを継続利用する。
3. `app/src/components/map/tokyo-board.css`で合法マスの輪郭と44pxのタッチ領域を定義し、旧移動操作用スタイルを除く。
4. `app/src/components/GameView.tsx`のフォーカス先を実マスへ更新する。候補比較が占有していた縦画面の安全領域を`useMapCamera.ts`で縮める。
5. Task 1のテストを再実行し成功を確認する。

## Task 3: 検証と仕様の整合

1. `cd app; npm test`、`npm run build`、`npm run lint`を実行する。
2. モック評価器で移動ターンまでプレイし、マス直接タップでコマが動くこと、独立した選択・決定ボタンがないことをブラウザで確認する。
3. 9/28の仕様に本仕様への参照を追加し、検証結果を記録する。コミット・push・デプロイは行わない。

## 実施結果

- Task 1〜3を実施。変更前は新操作のテストが失敗し、変更後は関連37件が成功。
- アプリ全28ファイル・143テスト、production build、oxlintが成功。
- モック評価器のブラウザ実操作で、通常幅と390px幅の直接クリックによる1歩移動、歩数減少、候補切り替え、ドラッグでの非移動、見回し中の直接移動を確認。
- 実機のタッチ操作と本番オンライン接続は未確認。オンラインの操作可否は既存UIテストで確認。
- 既存の未コミット変更を保持。コミット・push・デプロイは未実施。

## 2026-10-18 公開用統合

ユーザーの「マージして本番に反映させて」に基づき、mainの目的地アーチと既存変更を保持した作業領域へfeature/web-rewriteをマージし、直接移動と必要なマップ操作のファイルだけを取り込んだ。元の作業領域にある退出処理・開発運用文書などの未コミット変更は含めない。

- 統合版アプリ141テスト、Worker33テスト、オンライン統合テスト5件が成功。アプリbuild・oxlintとWorker typecheckも成功。
- 公開用ビルドはVITE_USE_MOCK=0と既存の本番API URLを指定。配信予定JSはindex-Bg8Ec3qQ.js、CSSはindex-qPeRURQi.css。
- ゲームロジック・Worker・本番Secret・目的地アーチ実装は変更しない。既存Workerを利用し、Pagesだけを更新する。
