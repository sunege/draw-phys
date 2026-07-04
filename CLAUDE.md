# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

物理教材用のブラウザ製ドローソフト（Vite + React + TypeScript, SVG描画）。汎用ドローではなく「物理オブジェクト」の配置・編集に特化し、**すべての図形をプラグインとして実装する**アーキテクチャを採る。完全な要件は `要件.md`（日本語）にある。コメント・UI文言・コミットは日本語。

## Commands

```bash
npm run dev        # Vite dev server（このリポジトリでは常にポート5199固定: .claude/launch.json）
npm run build      # tsc -b で型チェック → vite build
npm run lint       # oxlint
npm test           # vitest run（全テスト）
npm run test:watch # vitest watch
```

型チェック単体は `npx tsc -b`。単一テストは `npx vitest run <path>` または `npx vitest run -t "<テスト名の一部>"`。

プレビュー検証時の注意: キャンバスは **pointerイベント駆動**なので mouse-click 系ツールでは反応しない（`PointerEvent` を dispatch する）。ツール切替・選択は Zustand ストアには同期反映されるが React 再描画は非同期なので、DOM を読む検証は別呼び出しに分ける。チェックボックスは React の `onChange` が `click` で発火するため `.click()` を使う（合成 `change` イベントは効かない）。

## Architecture

### 本体はプラグインを介してのみ図形を扱う

中核の契約は `src/core/plugin.ts` の `PhysicsObjectPlugin<P>`。本体（キャンバス・選択・Undo/Redo・保存・出力）は図形の種類を一切知らず、`pluginRegistry`（`src/core/registry.ts`、`pluginId` → プラグイン）経由でのみアクセスする。**新しい図形の追加は「1ファイル新規作成 + `src/plugins/index.ts` に登録1行」で完結する**のが不変の設計目標（`要件.md` §16）。プラグインは `src/plugins/{basic,mechanics,annotation}/` にカテゴリ分けされ、`category` フィールドがツールボックスの見出しになる。

プラグインが提供する主なフック（多くは任意メソッドで後方互換）:
- `Renderer({ props, transform?, objectId?, interactive? })` — **ローカル座標**でのSVG描画
- `getBounds` / `getSnapPoints` / `getSegments` / `getCircle` — 当たり判定・スナップ・拘束相手
- `propertySchema` — プロパティパネル（`src/ui/PropertyPanel.tsx`）を自動生成するフィールド定義
- `applyScale` / `getEndpoints`+`setFromEndpoints` / `applyRefs` / `moveLabel` など、操作系の焼き込み

### 座標とtransformの規約（最重要）

プラグインは常に**原点=オブジェクト中心のローカル座標**で描画する。移動・回転・拡縮は本体が `Transform`（`translate → rotate → scale` の順）で一元処理する。`ObjectsLayer` と `exporter` は `<g transform=...>` でこのエンベロープを適用してから `Renderer` を呼ぶ。変換ユーティリティは `src/core/geometry.ts`（`localToWorld` / `worldBounds` / `rotateVec` など）。

拡縮は2系統ある:
- **箱型**（rect/circle/block/text/latex/point/arc）は `applyScale` を実装し、拡縮を幅・半径・フォントサイズ等の **props に焼き込む**。`transform.scaleX/scaleY` は常に1。これにより線幅は拡縮不変・文字サイズは可変になる（要件）。計算は `src/canvas/transformMath.ts`。
- **線分系**（line/arrow/spring/vector/force/floor）は `scalable:'none'` + `getEndpoints`/`setFromEndpoints` による端点編集で長さ・角度・中心を再構築する。

### 参照/拘束レイヤー（refs）

`SceneObject.refs?: ObjectRef[]` が他オブジェクトへの参照（角度マークが2線分に、長さマークが線分/円に、接線が円に追従する等）を保持する。`src/core/constraints.ts` の `resolveRef` が対象の `getSegments`/`getCircle` + transform からワールドのアンカー点・接線・半径を算出し、`solveConstraints` が **DFSトポロジカル順（対象→依存）**で各依存側の `applyRefs(props, resolved, transform)` を呼んで transform/props を再構築する。refs はプレーンなデータなので保存・Undo/Redo にそのまま乗り、`solveConstraints` の再実行で整合が回復する。循環・欠損はスキップする。

### 状態管理（Zustand ストア）

`src/state/` に分割。`documentStore` が中核で **immer パッチベースの Undo/Redo**（`mutate` レシピが `produceWithPatches` で redo/undo パッチ組を履歴に積む）を持つ。ドラッグ操作は「**transient → commit**」の2段構え:
- `setTransformsTransient` / `setObjectTransient` / `setObjectRefsTransient` … 履歴に残さずライブ更新（ドラッグ中）
- `commitTransforms` / `commitObject` … ドラッグ確定時に「開始時の値」を渡して1履歴エントリを記録

`mutate` の末尾と各 transient/undo/redo/loadObjects で `solveConstraints(InPlace)` を通すので、拘束はドラッグ中もライブ追従する。他ストア: `toolStore`（選択中ツール）、`viewportStore`（pan/zoom/grid/snap）、`workspaceStore`（ファイル/フォルダのツリー）。

### 入力処理は CanvasStage に集中

`src/canvas/CanvasStage.tsx` が全ポインタ操作の中心。`DragState` のユニオン型が move / scale / rotate / endpoint / anchor / labelDrag / markOffset / marquee / place-line / pan の各モードを表し、`onPointerDown` でどのモードに入るか（ハンドル種別・ヒット対象・ツール）を判定、`onPointerMove` でプラグインのフックを呼んで transient 更新、`onPointerUp` で commit する。選択枠・ハンドルの描画は `SelectionOverlay.tsx`、スナップは `snapping.ts`。

### 描画レイヤーとラベル

`ObjectsLayer`（全オブジェクトを zIndex 順に描画）→ `SelectionOverlay`（枠・ハンドル）の順に重ねる。ラベル付きオブジェクト（block/vector/force/lengthMark/angleMark）は共通基盤 `src/plugins/basic/objectLabel.ts`（ロジック）+ `LabelView.tsx`（`ObjectLabel` コンポーネント）を使い、LaTeX入力・常時正立（親回転を `rotate(-rotation)` で打ち消す）・ドラッグ移動（局所オフセット `labelDx/labelDy` + `moveLabel` フック + `data-object-label`）・背景白塗りに対応する。

### 保存と書き出し

- **永続化**: `src/persistence/`（IndexedDB, `idb`）。保存形式は `{ pluginId, version, props }` + 共通エンベロープ（transform/zIndex/locked/visible/groupId/refs）。読込時に `version` 不一致は各プラグインの `migrate()` で移行し、未知の `pluginId` は読み飛ばす（データを壊さない）。
- **書き出し**: `src/export/exporter.ts` が各 `Renderer` を `renderToStaticMarkup` で自己完結 SVG 文字列にし、PNG/JPEG/PDF へラスタライズする。**KaTeX を含む foreignObject は canvas 汚染を避けるため blob URL でなく data URL + `crossOrigin`** で読み込む。KaTeX CSS の非 data-URI フォント参照（woff/ttf）は除去が必須（プラグインの `exportStyles()` = `buildKatexExportCss` が担当）。

## Conventions / gotchas

- **oxlint の fast-refresh 警告回避のため、コンポーネントと非コンポーネントを別ファイルに分ける**（例: ロジック `fillPattern.ts` / `objectLabel.ts` ↔ コンポーネント `PatternDefs.tsx` / `LabelView.tsx`）。
- macOS は case-insensitive なので、`objectLabel.ts` と `ObjectLabel.tsx` のような **大文字小文字違いだけのファイル名は tsc(TS1149) で衝突する**。命名を明確に分ける。
- 純粋な幾何・算術ロジックは Renderer から切り出して `*Math.ts` に置き、単体テストする（`transformMath` / `lengthMarkMath` / `angleMarkMath` / `arc` など）。
