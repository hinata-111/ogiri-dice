# Console Theater Presentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 承認画像に沿い、顔なし・東京の劇場主題・地図上の読みやすい回答カードを実装する。

**Architecture:** 既存Reactの描画部品とCSSだけを変更。マップの背景を別名の素材にし、既存座標にSVGの角形マスと番号入りコマを重ねる。新しい全員回答の進行とreducer・Workerを保持する。

**Tech Stack:** React 19 / TypeScript / SVG / CSS / Vite / Vitest。

現在の feature/web-rewrite に既存の未コミット変更があるため同じ作業場所で境界を守る。ユーザーの承認は画面実装。コミット・配信は行わない。

### Task 1: 基準と素材
- docs/superpowers/specs/2026-09-26-comedian-presentation-design.md に確定条件を保存。
- 承認画像を docs/design/2026-09-26-console-theater/approved-reference.png に保存。
- app/public/art/tokyo-board-console.png を元地図と承認案から生成し、道路・ランドマークの位置を目視確認。生成プロンプトをデザイン記録へ保存。

### Task 2: 劇場とメンバー
- app/src/presentation/StageArt.tsx に顔なしマイク記号・番号コマ・小劇場の背景を作成。
- TitleScreen.tsx, SetupScreen.tsx, online/RoomLobby.tsx, GameView.tsx, ArrivalOverlay.tsx, GameResultScreen.tsx の列車や乗車文言を置換。操作ラベル・参加条件を保持。
- presentation.css で白い窓・控えめな劇場の赤・浅い影の体系に統一。

### Task 3: 発表と盤面
- ResultOverlay.tsx を回答左・点数右・講評と操作が下のカードへ。番号を実プレイヤーIDから受け取る。採点の待機・所持金・再審査を保持。
- GameView.tsx の全員結果もマップ上の発表窓に。各人の回答と点数は1対1に対応させる。
- map/TokyoBoard.tsx, map/tokyo-board.css で浅い角形マスと円筒コマを描画。座標・合法手・障害物配置は保持。
- scene-preview.tsx で実マップ上の通常/長文/減額/失敗の状態を確認できるようにする。

### Task 4: 確認
- Baseline: npm test --prefix app -- --maxWorkers=2 = 23 files / 108 tests passed。
- 変更後に同コマンド、npm run build --prefix app、npm run lint --prefix app を実行しgreenを確認。
- ブラウザでPC・390px縦・844×390横を確認。カード本文がスクロール可能で操作が消えないこと、現在地/目的地と合法手を判別できることを確認。
- docs/design/2026-09-26-console-theater/review.md に実際の検証結果を残す。既存の旧レビューを新しい完成証拠として流用しない。

## 完了
Task 1〜4を実施。108 tests、build、lint、diff checkは成功。PC・縦・横の実画面を確認し、短い横画面での長文の見切れを修正した。結果と表示例は docs/design/2026-09-26-console-theater/review.md に記録。
