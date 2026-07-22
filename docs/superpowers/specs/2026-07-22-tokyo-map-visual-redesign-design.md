# 東京マップ ビジュアル再設計(桃鉄風) 設計書

日付: 2026-07-22 / ブランチ: feature/web-rewrite / 対象: 描画層のみ(`game/` ロジック変更なし)

## 目的

現状の IsoMapView(単色背景・細線エッジ・絵文字建物)を、桃太郎電鉄風の
「明るくポップで、1マス1マスがはっきり見え、東京らしい没入感のある」2Dアイソメマップに刷新する。

## 決定事項

- アセット方針: **プロシージャルSVG**(画像ファイル不使用。全てコードで描画)
- トーン: **昼の東京・明るいポップ**(クリームベージュ地、スカイブルーの海、パキッとした青/赤マス)
- カメラ: 移動時ズーム演出 + 目的地発表パン + 全体俯瞰切替
- `game/` は不変。`map.json` の座標変更が必要な場合のみ `gen-map.mjs` 修正→再生成

## アーキテクチャ

`IsoMapView.tsx` を `app/src/components/map/` 配下にレイヤー分割:

```
app/src/components/map/
  decor.ts          # 地形装飾の座標定数(React非依存・純TS)
  camera.ts         # computeCamera() 純関数(React非依存・Vitestテスト対象)
  TerrainLayer.tsx  # 背景: 地面・海・川・緑地・街区ブロック
  RoadLayer.tsx     # エッジをアイソメ太帯で描画
  TileLayer.tsx     # マス: 立体菱形(上面+側面)
  BuildingLayer.tsx # 拠点建物: kind別プロシージャルSVG + 地名プレート
  IsoMapView.tsx    # 統合 + CameraRig(g transform) + コマ描画(移設)
```

旧 `components/IsoMapView.tsx` は削除し import 先を更新。

## 各レイヤー仕様

### 1. TerrainLayer(背景)

- 地面: クリームベージュ(#f4e9d0 系)の大矩形
- 東京湾: 盤面右下(南東)にスカイブルー面 + 白波線2〜3本。お台場ノード周辺は湾に浮かぶ島(緑縁の陸地)
- 隅田川: 浅草付近から湾へ縦断する青帯(道と交差しない経路でデフォルメ)
- 皇居緑地: 神保町南あたりに緑の楕円ブロック + 濠(青縁)
- 街区: 淡色(白〜薄グレー・薄黄)の小矩形群を道路沿いに散らす(座標は decor.ts に静的定義)
- 全装飾はノード座標(map.json)と同じアイソメ座標系。decor.ts に `iso(col,row)` 変換を複製せず、定数座標で直接定義してよい

### 2. RoadLayer(道)

- 現状: stroke 12px の line → 変更: アイソメ太帯(平行四辺形パス、幅約28px)
- 塗り: 白クリーム(#fff8ec)、縁取り: 茶系(#b08d57)2px
- エッジ重複排除ロジック(id辞書順)は現行を踏襲

### 3. TileLayer(マス)

- stop ノード: 立体菱形 = 上面(菱形) + 左右側面(暗色パス)で厚み約10px
- 色: blue=#2f7de1 / red=#e14b4b / normal=#ffffff。側面は各色の暗変種
- 縁取り白1.5px + 半透明の落ち影(ellipse)
- 目的地ノード: 金色縁(#ffd700)+ 既存の旗(🚩)バウンス維持

### 4. BuildingLayer(拠点)

- 絵文字+紫箱を廃止。kind 別プロシージャルSVG(各 30〜60行程度のパス合成):
  - theater: 赤幕ファサード + 白壁 + 電飾(黄色ドット列) + 三角屋根
  - tv: グレー局舎 + 大窓 + 屋上アンテナ(お台場のみ球体モチーフ)
  - station: 緑屋根の駅舎 + ホーム屋根 + 時計
- 拠点の足元にも通常マスと同じ立体菱形(上面白)を敷く(拠点=止まれるマス)
- 地名: 白丸角プレート(rect rx=8)+ 濃色文字。現行の stroke 縁取りテキストから変更

### 5. camera.ts + CameraRig

```ts
type CameraMode = "follow" | "moving" | "reveal" | "overview";
interface CameraState { x: number; y: number; scale: number; }
computeCamera(mode, focus: {x,y}, viewSize, mapBounds): CameraState
```

- follow: 現在プレイヤー中心・scale 1.0(現行挙動)
- moving: 同中心・scale 1.15
- reveal: 目的地ノード中心・scale 1.3(ArrivalOverlay/目的地発表時)
- overview: 全ノード+装飾が収まる fit(scale = min(vw/bw, vh/bh) 系、中心=マップ重心)
- モード決定は App/IsoMapView 側で GamePhase から導出。reducer 変更禁止
- 俯瞰切替: 移動操作中に押せる「🗾 全体」トグルボタン(UIローカルstate)
- transform 適用は `translate(...) scale(...)` を board-camera の CSS transition(0.8s)で補間
- コマ移動: 1マスごとの jump は `.piece` の transform transition + keyframes(既存 0.26s を跳ね系に強化)

## テスト

- `camera.ts`: computeCamera の4モードを Vitest で検証(中心座標・scale・overview の fit 計算)
- レイヤー描画: ロジック極薄のためユニットテスト不要。`npm run build` green + 目視確認
- 既存テスト(game/)は全て無変更で green を維持

## 受け入れ基準

1. モックモードで起動し、昼の東京トーンのマップが表示される
2. 青/赤/通常マスが一目で判別できる(立体菱形)
3. 劇場/テレビ局/駅が形状で見分けられ、地名プレートが読める
4. 移動中ズーム・目的地発表パン・俯瞰切替が動作
5. `npm test` / `npm run build` green、`game/` に diff なし
