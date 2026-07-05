# CLAUDE.md

物理教材用のブラウザ製ドローソフト（Vite + React + TypeScript, SVG描画）。汎用ドローではなく「物理オブジェクト」の配置・編集に特化し、**すべての図形をプラグインとして実装する**。完全な要件は `要件.md`。コメント・UI文言・コミットは日本語。

## Commands

```bash
npm run dev    # Vite dev server（ポート5199固定: .claude/launch.json）
npm run build  # tsc -b（型チェック）→ vite build
npm run lint   # oxlint
npm test       # vitest run（全テスト）
```

型チェックのみ `npx tsc -b`。単一テストは `npx vitest run <path>` / `-t "<名前の一部>"`。

**プレビュー検証**: キャンバスは pointerイベント駆動（mouse-clickは無反応→`PointerEvent`をdispatch）。ツール切替・選択はZustandへ同期反映されるがReact再描画は非同期→DOM検証は別呼び出しに分ける。チェックボックスは`onChange`が`click`発火なので`.click()`（合成`change`は無効）。

## Architecture

### プラグイン経由でのみ図形を扱う

中核契約は `src/core/plugin.ts` の `PhysicsObjectPlugin<P>`。本体（キャンバス・選択・Undo/Redo・保存・出力）は図形種別を知らず `pluginRegistry`(`src/core/registry.ts`)経由でのみアクセス。**新図形＝1ファイル新規＋`src/plugins/index.ts`に登録1行**（`要件.md`§16, 不変目標）。プラグインは `src/plugins/{basic,mechanics,annotation}/` にカテゴリ分けし、`category`がツールボックス見出し。主なフック（多くは任意）:
- `Renderer({props,transform?,objectId?,interactive?})` — **ローカル座標**でSVG描画
- `getBounds`/`getSnapPoints`/`getSegments`/`getCircle` — 当たり判定・スナップ・拘束相手
- `propertySchema` — プロパティパネル(`src/ui/PropertyPanel.tsx`)自動生成
- `applyScale`/`getEndpoints`+`setFromEndpoints`/`applyRefs`/`moveLabel` — 操作の焼き込み
- `capabilities`: `rotatable` / `scalable`('both'|'uniform'|'x'|'none') / `construction`(補助線化の可否, 線・円のみ)

### 座標とtransformの規約（最重要）

プラグインは常に**原点=中心のローカル座標**で描画。移動・回転・拡縮は本体が`Transform`(`translate → rotate → scale`順)で一元処理し、`ObjectsLayer`/`exporter`が`<g transform>`適用後に`Renderer`を呼ぶ。ユーティリティは`src/core/geometry.ts`。拡縮は2系統:
- **箱型**(rect/circle/block/text/latex/point/arc)は`applyScale`でサイズを**propsへ焼き込む**(`transform.scale`は常に1→線幅不変・文字サイズ可変)。計算は`src/canvas/transformMath.ts`。
- **線分系**(line/arrow/spring/vector/force/floor)は`scalable:'none'`＋`getEndpoints`/`setFromEndpoints`の端点編集で長さ・角度・中心を再構築。

回転も`transformMath.ts`: 表示角は「水平右=0°・反時計回りが正」で、内部rotation(画面時計回り正)とは`toDisplayAngle`/`fromDisplayAngle`で符号反転。回転ハンドルは任意軸ピボット対応(`computeRotationAboutPivot`＋CanvasStageの`rotatePivot`; ピボットは一時状態で非永続)。

### 参照/拘束レイヤー（refs）

`SceneObject.refs?: ObjectRef[]`が他オブジェクトへの参照を持つ。`src/core/constraints.ts`の`resolveRef`が対象の`getSegments`/`getCircle`/スナップ点+transformからワールドのアンカー点・接線・半径を算出し、`solveConstraints`が**DFSトポロジカル順(対象→依存)**で解決。refsはプレーンデータなので保存・Undo/Redoに乗り、再実行で整合回復。循環・欠損はスキップ。解決2方式:

1. **プラグイン固有**(`applyRefs`): 依存側が自分のtransform/propsを再構築。角度マーク(2線分)・長さマーク(線分/円)・接線(円; line.tsx)。
2. **本体ソルバ直接**(`solveInto`が種別を問わず処理, `ObjectRef.role`で予約):
   - `'parallel'`/`'perpendicular'` … 回転だけを基準線分と平行/垂直に保つ。`angleOffset`を基準角に加算(平行=0/180・垂直=±90を最小回転で選択; `parallelOffset`/`perpendicularOffset`)。両者は回転成分を奪い合う=排他→`findRotationLock`で共通判定(回転ハンドル/回転角入力の非表示など)。
   - `'coincident'` … 局所アンカー`localAnchor`を基準点に一致させ位置追従。基準は対象スナップ点(`kind:'point'`+`pointIndex`; `localSnapPoints`で並びをCanvasStageと共有)、または**対象なしの自由座標`worldAnchor`**(`targetId:''`)。`resolveCoincidentAnchor`が両者を解決。

回転(平行/垂直)と位置(一致)は別成分なので同一オブジェクトで合成可。拘束作成は**非プラグインの操作ツール**(`src/canvas/tools.tsx`の`OPERATION_TOOLS`: 接線/平行/垂直/一致。「拘束」欄に並び`activeTool`にidが入りCanvasStageが分岐)。マーカーは`ConstraintMarkers.tsx`が常時描画(平行=`>>`シェブロン、垂直=直角L字、一致=接続点リング)。`data-constraint`/`-role`クリック→`constraintStore.focused`→解除ピル or Deleteでそのロールのみ除去。`PropertyPanel`の「追従を解除」は全refsクリア。

拘束オブジェクトの**端点ドラッグ**(CanvasStage `endpointPin`): 一致は基準点を、平行/垂直は反対端を固定して長さのみ変える(向きは基準にロック)。一致点(ピンクのリング)自体もドラッグで移動可(`snapAnchorPoint`でスナップ点/辺/円へ再接続、離すと自由座標)。

### 状態管理（Zustand ストア）

`src/state/`に分割。`documentStore`が中核で**immerパッチベースUndo/Redo**(`mutate`が`produceWithPatches`でredo/undo組を履歴に積む)。ドラッグは**transient → commit**の2段:
- `setTransformsTransient`/`setObjectTransient`(transform/props/refs)/`setObjectRefsTransient` … 履歴に残さずライブ更新
- `commitTransforms`/`commitObject`(transform/props/refs) … 確定時に開始値を渡し1履歴エントリ記録

`mutate`末尾と各transient/undo/redo/loadObjectsで`solveConstraints(InPlace)`を通すので拘束はドラッグ中もライブ追従。オブジェクトのフラグは`setObjectFlags`(locked/visible/construction)。他ストア: `toolStore`/`viewportStore`(pan/zoom/grid/snap)/`workspaceStore`(ファイルツリー)/`constraintStore`(アクセス中の拘束)。

### 入力処理は CanvasStage に集中

`src/canvas/CanvasStage.tsx`が全ポインタ操作の中心。`DragState`ユニオンがmove/scale/rotate/rotatePivot/endpoint/anchor/coincidentDrag/labelDrag/markOffset/marquee/place-line/panを表し、`onPointerDown`でモード判定、`onPointerMove`でフック呼び出し+transient更新、`onPointerUp`でcommit。選択枠・ハンドルは`SelectionOverlay.tsx`、スナップは`snapping.ts`(グリッド＋端点`snapEndpoint`＋一致点`snapAnchorPoint`)。※移動時のオブジェクト整列スナップ(赤点線)は廃止済みでグリッドのみ。

### 描画レイヤーとラベル

`ObjectsLayer`(zIndex順)→`SelectionOverlay`(枠・ハンドル)→`ConstraintMarkers`(拘束マーク)の順。ラベル付き(block/vector/force/lengthMark/angleMark)は`objectLabel.ts`(ロジック)＋`LabelView.tsx`(`ObjectLabel`)を共有し、LaTeX入力・常時正立(親回転を`rotate(-rotation)`で打消し)・ドラッグ移動(`labelDx/labelDy`+`moveLabel`+`data-object-label`)・背景白塗り対応。**コンストラクション**(補助線, `SceneObject.construction`)は`ConstructionView.tsx`が`getSegments`/`getCircle`から色付き点線で描画。スナップ・拘束は通常どおり効き**書き出しのみ除外**。角度マークは掃引角が90°で自動的に直角マーク(L字/正方形)に切替(`angleMarkMath.ts`の`isRightAngle`/`rightAnglePoints`)。

### 保存と書き出し

- **永続化**: `src/persistence/`(IndexedDB, `idb`, structuredClone)。形式は`{pluginId,version,props}`+共通エンベロープ(transform/zIndex/locked/visible/groupId/construction/refs)。`version`不一致は`migrate()`、未知`pluginId`は読み飛ばす。
- **書き出し**: `src/export/exporter.ts`が各`Renderer`を`renderToStaticMarkup`で自己完結SVGにしPNG/JPEG/PDFへラスタライズ。非visible・constructionは除外。**KaTeX foreignObjectはcanvas汚染回避のためdata URL+`crossOrigin`**(blob URL不可)。KaTeX CSSの非data-URIフォント参照は除去必須(`exportStyles()`=`buildKatexExportCss`)。
- **クリップボードはPNGのみ**(`copyToClipboard`)。SVGを載せるとWindowsのWord/PowerPointがforeignObject(KaTeX)を誤描画(数式消失・線幅異常)するため`image/svg+xml`は付けない。

## Conventions / gotchas

- **fast-refresh警告回避のためコンポーネントと非コンポーネントを別ファイルに**(例 `fillPattern.ts`↔`PatternDefs.tsx`, `objectLabel.ts`↔`LabelView.tsx`)。
- macOSはcase-insensitive → `objectLabel.ts`と`ObjectLabel.tsx`のような**大小違いだけの名前はtsc(TS1149)で衝突**。名前を明確に分ける。
- 純粋な幾何・算術はRendererから切り出し`*Math.ts`で単体テスト(`transformMath`/`lengthMarkMath`/`angleMarkMath`/`arc`等)。
- **Zustandセレクタは安定参照/プリミティブのみ返す**。`worldBounds`等の新規オブジェクトを返すと"getSnapshot should be cached"→無限ループ。派生値はセレクタで`objects[id]`等を返しコンポーネント本体で算出。
- KaTeX実測はフォント非同期ロードに依存→`katexFonts.ts`(`useKatexFontsTick`/`areKatexFontsReady`)でロード完了後に測り直す(リロード時の数式サイズずれ防止)。
