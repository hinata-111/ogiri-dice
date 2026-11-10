# Persistent Player Roster Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 全プレイヤーの状況をゲーム中の画面上部に常設する。

**Architecture:** GameViewに読み取り専用のPlayerRosterと、残りの高さを使うゲーム領域を置く。TokyoBoardの手番カード/状況ダイアログを置き換え、状態管理とオンライン処理を維持する。

**Tech Stack:** React 19 / TypeScript / Vitest / CSS。

---

1. `PlayerRoster.test.tsx` に全フェーズでの常設・4人固定順・更新・共通回答の表示を追加し、既存実装で失敗を確認する。
2. `PlayerRoster.tsx` を作成。ゲーム状態から各人の所持金/到着/順位/進行状況を描画する。
3. `GameView.tsx` の上部へ一覧を置き、盤面・各オーバーレイは下のゲーム領域へ収める。タイトル/設定の既存表示を維持する。
4. `TokyoBoard.tsx` の既存手番カードと状況ダイアログ/開閉ボタンを削除。ゴールや見回しの操作を維持する。開発用盤面プレビューにも一覧を配置する。
5. `presentation.css` に横並び/スマホ2列/短い画面/キーボード時の表示を追加し、回答窓が一覧に重ならないよう配置する。
6. 既存Appテストを常設表示へ更新し、関連→全テスト・build・lintを実行。実ブラウザで4人と回答中の表示を確認する。
7. 前回からの公開依頼に続けて、検証済みの表示をmainへ統合し、既存のPagesへ公開。本番の配信ファイルと常設表示を確認し記録する。Workerは変更・再公開しない。

## 検証記録

- 環境: Windows PowerShell / Node.js 24.16.0 / npm 11.13.0 / Vite 8.1.3。
- 検証したapp tree: `a02a5ec3688eb1a079b41c996604a450ee43fd0f`。Worker tree: `ec53928c28d48c6ebefb07bb9b34c01b8b6de7de`（変更なし）。
- RED: 常設一覧の新テストは既存実装で13件失敗/1件成功。
- 関連テスト: PlayerRoster / App / OnlineGame.start、28件成功。
- 全テスト: `cd app; npm test -- --maxWorkers=2`、31ファイル/173件成功。
- `npm run build`、`npm run lint` 成功。最後のスマホ用CSS修正後にもbuild/lintを再実行。
- 実ブラウザ: PC 1280×720で4人の固定順と移動中、390×844で4人/長い名前/開始待ち/共通回答/提出後の表示を確認。回答窓は一覧の下に収まり、提出後も一覧を維持。
- 実機のソフトキーボードは未確認。キーボード用の縮小レイアウトはCSSと既存のviewportフックの範囲で確認。
- 実ブラウザの回答確認は開発用モックを使用。Gemini API呼び出しなし。
- ローカル画面: `player-roster-desktop.png` / `player-roster-mobile.png` / `player-roster-answer-mobile.png`（Codex visualizationsフォルダ）。
