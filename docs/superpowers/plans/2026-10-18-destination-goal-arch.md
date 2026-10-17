# Destination Goal Arch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 現在の目的地だけに地名入りの小さな静止ゴールアーチを表示する。

**Architecture:** TokyoBoardがdestinationIdとphaseから表示を導出し、GoalArchがSVGと地名を描画する。ゲーム状態やカメラには新しい状態を追加しない。既存の未コミット変更を保持し、現在のfeature/web-rewriteブランチで作業する。

**Tech Stack:** React / TypeScript / CSS / SVG / Vitest

## 1. 表示の回帰テスト

`app/src/components/map/TokyoBoard.test.tsx` に目的地の切り替え・解除・ゲーム終了でアーチが出入りし、通常の地名へ戻る検証を追加する。

Run (app): `npm test -- src/components/map/TokyoBoard.test.tsx --maxWorkers=2`

Expected: 新しいゴール表示が存在しないため追加テストが失敗する。

## 2. アーチの描画

- Create: `app/src/components/map/GoalArch.tsx`
- Modify: `app/src/components/map/TokyoBoard.tsx`
- Modify: `app/src/components/map/tokyo-board.css`

既存の目的地ラベルを、同じ座標に固定した小さなアーチへ置き換える。SVGで二本の柱と朱色の看板を描き、地名はHTML文字で表示する。柱の間を空けてマスとコマが見えるようにする。pointer-events:noneを指定し、新しい操作やアニメーションは追加しない。通常の地名ラベルとアーチの地名を重複表示しない。

同じテストを実行しPASSを確認する。

## 3. 統合確認

順に `npm test -- --maxWorkers=2`、`npm run build`、`npm run lint` をappで実行し、`git diff --check`も確認する。

既存の `app/dev/board.html` でPC・縦画面の目的地表示、広く見る、拡大縮小、同居するコマ、マス情報の操作を確認する。目的地候補の端の地点と最長地名も確認する。確認結果をここへ追記する。コミット・公開はしない。

## 完了・検証記録

- GoalArchを追加し、現在の目的地の通常ラベルと置き換えた。目的地の切り替え・解除・ゲーム終了で通常表示に戻る。上部UI、背景画像、ゲームロジックは変更していない。
- 追加した表示ライフサイクルのテストは実装前に失敗、実装後に成功を確認した。
- 最終確認: `npm test -- --maxWorkers=2` は28ファイル・143テスト成功。`npm run build`、`npm run lint`、`git diff --check`も成功。同時に進んでいる移動UIの変更を含む作業ツリー全体での結果。
- ブラウザの1280×720と390×844で浅草・新宿のアーチと切り替えを確認。縦画面の浅草では既存の見回し案内が地名に重なったため、縦画面だけ96×60pxへ小さくした（PCは112×80px）。地名とマスが読み取れることを再確認した。
- 目的地マスの情報、広く見る、拡大縮小をブラウザで操作し、アーチが操作を遮らないことを確認した。
- 全12目的地それぞれの実画面と物理スマホ、本番オンライン対戦は未確認。マップデータを変えず、共通の座標と描画で配置する。PCの確認画像はワークスペース外の可視化フォルダに保存した。
- 既存の未コミット変更を保持し、コミット・公開はしていない。

## mainへの統合（追加承認）

ユーザーの「mainにマージまでして」という追加指示により、ゴールアーチ分だけをmain基準で分離する。移動UI・カメラ・退出処理などの未コミット変更は含めない。

統合用テストは app/src/components/map/GoalArch.test.tsx に独立させた。main基準の候補で全25ファイル・112テスト、build、oxlintが成功。元の作業ツリーで確認した143テストとは対象が異なる。統合は専用ブランチcodex/destination-goal-archから行い、main上でも同じ検証を実行する。push・公開は行わない。
