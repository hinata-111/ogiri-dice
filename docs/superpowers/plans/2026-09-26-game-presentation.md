# Game Presentation Implementation Plan

> 履歴：この計画による駅・列車テーマの実装は、ユーザーの「主題は芸人」という訂正を受けて再設計対象となった。[新しいデザイン提案](../specs/2026-09-26-comedian-presentation-design.md)を参照。以下の完了記録は旧案の実装・検証に限る。

> **For agentic workers:** Use executing-plans to implement this plan task-by-task. Investigation and final review may be delegated; implementation stays in this workspace.

**Goal:** タイトルから優勝までの画面・演出・BGM/SEを一貫した旅のゲームとして仕上げる。

**Architecture:** Appの進行処理と共通GameViewの描画を分離。presentation/に装飾と演出、audio/に単一の音声管理を置く。音の観測はreducerを変更しない。

**Tech Stack:** React 19, TypeScript, CSS, SVG, Web Audio API, Vitest.

## Global Constraints

- game/・地図データ・Worker権限・既存の変更を維持。
- 日本語UI、絵文字装飾を使わない。縮小画面と動き軽減を扱う。
- コミット・プッシュ・デプロイはこの依頼に含めない。

### Task 1: 音声の契約と実装

Files: `app/src/audio/{score,engine,AudioProvider,GameAudio}.ts(x)` と対応テスト。

Interface: `useAudio()` → `play(cue), setScene(scene), preferences, updatePreferences(patch), unlock()`。sceneはmenu/board/thinking/results、cueはselect/confirm/depart/topic/tick/roll/score/gain/loss/step/arrival/victory。

- [x] 状態差分で同一snapshot・手番交代・最後の一歩・接続復帰が鳴り過ぎないテストを先に追加し失敗確認。
- [x] 音声設定を正規化。単一AudioContext、背景停止、予約清掃、メニュー/盤面の複数小節の曲を実装。
- [x] Providerで初回操作とクリック音、常設の設定UIを接続。GameAudioは状態観測だけを行う。
- [x] 対応テストを実行。

### Task 2: 入口と待合室

Files: `components/TitleScreen.tsx`, `SetupScreen.tsx`, `online/OnlineGame.tsx`, `presentation/{TravelArt,presentation.css}`。

- [x] 列車・街並み・サイコロの専用SVG部品とスタイルを追加。
- [x] タイトルの見せ場と二つの選択肢、設定の乗車カードを実装。
- [x] オンラインの入口を名前/作成/参加に分け、待機室は4席を描画。実際のmembersから状態を表示。
- [x] 既存オンラインテストと待機室の開始権限/参加状態テストを実行。

### Task 3: プレイの見せ場

Files: `App.tsx`, `components/GameView.tsx`, `ResultOverlay.tsx`, `ArrivalOverlay.tsx`, `GameResultScreen.tsx`, `TopicCard.tsx`, `ChallengeIntro.tsx`。

- [x] LocalGameを既存GameViewへ接続して描画の重複を解消。
- [x] 手番・採点の溜めと発表・到着・優勝で異なる演出を追加。既存タイマーを延期しない。
- [x] TopicCardの絵文字を専用の色帯/日本語へ置換。
- [x] ローカル勝利まで・オンライン観戦/切断/IMEの既存テストを実行。

### Task 4: 実画面・音・レビュー

- [x] `cd app; npm test; npm run build; npm run lint` をそれぞれ実行。
- [x] ローカルサービスを実測URLで確認。PC/390px/短い横画面で入口と各イベント、オンラインの2人開始を操作。
- [x] ブラウザで初回操作の音声開始とミュートを確認。背景停止/復帰は音声エンジンのテストで確認。
- [x] 独立レビューの指摘を修正。証拠と残る制約をdesign内のレビュー記録へ保存。
