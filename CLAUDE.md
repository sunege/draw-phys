# CLAUDE.md

物理教材用のブラウザ製ドローソフト（Vite + React + TypeScript, SVG描画）。汎用ドローではなく「物理オブジェクト」の配置・編集に特化し、**すべての図形をプラグインとして実装する**。完全な要件は `要件.md`。コメント・UI文言・コミットは日本語。

## Commands

```bash
npm run dev        # Vite dev server（ポート5199固定: .claude/launch.json）
npm run build      # tsc -b（型チェック）→ vite build
npm run lint       # oxlint
npm test           # vitest run（全テスト）
```

型チェック単体は `npx tsc -b`。単一テストは `npx vitest run <path>` / `-t "<名前の一部>"`。

**プレビュー検証の注意**: キャンバスは pointerイベント駆動（mouse-click では反応しない→`PointerEvent` を dispatch）。ツール切替・選択は Zustand には同期反映されるが React 再描画は非同期なので DOM 検証は別呼び出しに分ける。チェックボックスは `onChange` が `click` 発火なので `.click()`（合成 `change` は無効）。

## Architecture

### 本体はプラグイン経由でのみ図形を扱う

中核契約は `src/core/plugin.ts` の `PhysicsObjectPlugin<P>`。本体（キャンバス・選択・Undo/Redo・保存・出力）は図形種別を知らず、`pluginRegistry`（`src/core/registry.ts`）経由でのみアクセスする。**新図形は「1ファイル新規 + `src/plugins/index.ts` に登録1行」で完結**（`要件.md` §16, 不変目標）。プラグインは `src/plugins/{basic,mechanics,annotation}/` にカテゴリ分けし、`category` がツールボックス見出しになる。

主なフック（多くは任意メソッドで後方互換）:
- `Renderer({ props, transform?, objectId?, interactive? })` — **ローカル座標**でSVG描画
- `getBounds` / `getSnapPoints` / `getSegments` / `getCircle` — 当たり判定・スナップ・拘束相手
- `propertySchema` — プロパティパネル（`src/ui/PropertyPanel.tsx`）の自動生成
- `applyScale` / `getEndpoints`+`setFromEndpoints` / `applyRefs` / `moveLabel` — 操作の焼き込み

### 座標とtransformの規約（最重要）

プラグインは常に**原点=オブジェクト中心のローカル座標**で描画。移動・回転・拡縮は本体が `Transform`（`translate → rotate → scale` 順）で一元処理し、`ObjectsLayer`/`exporter` が `<g transform>` を適用してから `Renderer` を呼ぶ。ユーティリティは `src/core/geometry.ts`（`localToWorld`/`worldBounds`/`rotateVec` 等）。

拡縮は2系統:
- **箱型**（rect/circle/block/text/latex/point/arc）は `applyScale` でサイズを **props に焼き込む**（`transform.scale` は常に1 → 線幅不変・文字サイズ可変）。計算は `src/canvas/transformMath.ts`。
- **線分系**（line/arrow/spring/vector/force/floor）は `scalable:'none'` + `getEndpoints`/`setFromEndpoints` の端点編集で長さ・角度・中心を再構築。

### 参照/拘束レイヤー（refs）

`SceneObject.refs?: ObjectRef[]` が他オブジェクトへの参照を持つ。`src/core/constraints.ts` の `resolveRef` が対象の `getSegments`/`getCircle`/スナップ点 + transform からワールドのアンカー点・接線・半径を算出し、`solveConstraints` が **DFSトポロジカル順（対象→依存）**で解決する。refs はプレーンデータなので保存・Undo/Redo にそのまま乗り、`solveConstraints` 再実行で整合が回復。循環・欠損はスキップ。解決は2方式:

1. **プラグイン固有**（`applyRefs(props, resolved, transform)`）: 依存側プラグインが自分の transform/props を再構築。角度マーク（2線分）・長さマーク（線分/円）・接線（円; line.tsx）が使う。
2. **本体ソルバ直接処理の汎用ロール**（`solveInto` が種別を問わず処理し `applyRefs` をスキップ。`ObjectRef.role` で予約）:
   - `'parallel'` … 回転だけを基準線分と平行に保つ（`angleOffset` 0/180 を焼き込み最小回転で平行）
   - `'coincident'` … 局所アンカー `localAnchor` を基準点に一致させ追従（位置のみ）

   両者は別成分（回転/位置）なので同一オブジェクトで合成可。基準点は `kind:'point'`+`pointIndex`（対象のスナップ点。`localSnapPoints` で並びを CanvasStage と共有）で参照。

拘束作成は**非プラグインの操作ツール**（`src/canvas/tools.tsx` の `OPERATION_TOOLS`: 接線/平行/一致。ツールボックス「拘束」欄に並び、`activeTool` に id が入って CanvasStage が分岐）。マーカーは `ConstraintMarkers.tsx` が常時描画（平行=`>>`シェブロン、一致=接続点リング）。`data-constraint`/`data-constraint-role` でクリック→`constraintStore`（`focused:{objectId,role}`）にアクセス→解除ピル or Delete でそのロールだけ除去。`PropertyPanel` の「追従を解除」は全 refs をクリア。

### 状態管理（Zustand ストア）

`src/state/` に分割。`documentStore` が中核で **immer パッチベースの Undo/Redo**（`mutate` が `produceWithPatches` で redo/undo 組を履歴に積む）。ドラッグは「**transient → commit**」の2段:
- `setTransformsTransient`/`setObjectTransient`/`setObjectRefsTransient` … 履歴に残さずライブ更新
- `commitTransforms`/`commitObject` … 確定時に「開始値」を渡し1履歴エントリを記録

`mutate` 末尾と各 transient/undo/redo/loadObjects で `solveConstraints(InPlace)` を通すので拘束はドラッグ中もライブ追従。他ストア: `toolStore`（選択ツール）、`viewportStore`（pan/zoom/grid/snap）、`workspaceStore`（ファイルツリー）、`constraintStore`（アクセス中の拘束）。

### 入力処理は CanvasStage に集中

`src/canvas/CanvasStage.tsx` が全ポインタ操作の中心。`DragState` ユニオンが move/scale/rotate/endpoint/anchor/labelDrag/markOffset/marquee/place-line/pan を表し、`onPointerDown` でモード判定、`onPointerMove` でプラグインフックを呼び transient 更新、`onPointerUp` で commit。選択枠・ハンドルは `SelectionOverlay.tsx`、スナップは `snapping.ts`。

### 描画レイヤーとラベル

`ObjectsLayer`（zIndex 順）→ `SelectionOverlay`（枠・ハンドル）→ `ConstraintMarkers`（拘束マーク）の順に重ねる。ラベル付き（block/vector/force/lengthMark/angleMark）は `objectLabel.ts`（ロジック）+ `LabelView.tsx`（`ObjectLabel`）を共有し、LaTeX入力・常時正立（親回転を `rotate(-rotation)` で打消し）・ドラッグ移動（`labelDx/labelDy`+`moveLabel`+`data-object-label`）・背景白塗りに対応。

### 保存と書き出し

- **永続化**: `src/persistence/`（IndexedDB, `idb`）。形式は `{ pluginId, version, props }` + 共通エンベロープ（transform/zIndex/locked/visible/groupId/refs）。`version` 不一致は `migrate()`、未知 `pluginId` は読み飛ばす。
- **書き出し**: `src/export/exporter.ts` が各 `Renderer` を `renderToStaticMarkup` で自己完結 SVG にし PNG/JPEG/PDF へラスタライズ。**KaTeX foreignObject は canvas 汚染回避のため data URL + `crossOrigin`**（blob URL 不可）。KaTeX CSS の非 data-URI フォント参照は除去必須（`exportStyles()`=`buildKatexExportCss`）。
- **クリップボードは PNG のみ**（`copyToClipboard`）。SVG を載せると Windows の Word/PowerPoint が foreignObject(KaTeX) を誤描画（数式消失・線幅異常）するため、あえて `image/svg+xml` は付けない。

## Conventions / gotchas

- **fast-refresh 警告回避のためコンポーネントと非コンポーネントを別ファイルに分ける**（例 `fillPattern.ts`↔`PatternDefs.tsx`, `objectLabel.ts`↔`LabelView.tsx`）。
- macOS は case-insensitive → `objectLabel.ts` と `ObjectLabel.tsx` のような**大小違いだけの名前は tsc(TS1149) で衝突**。名前を明確に分ける。
- 純粋な幾何・算術は Renderer から切り出し `*Math.ts` で単体テスト（`transformMath`/`lengthMarkMath`/`angleMarkMath`/`arc` 等）。
- **Zustand セレクタは安定参照/プリミティブのみ返す**。`worldBounds` 等の新規オブジェクトを返すと "getSnapshot should be cached" → 無限ループ。派生値はセレクタで `objects[id]` 等を返しコンポーネント本体で算出する。
