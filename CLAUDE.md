# CLAUDE.md

物理教材用のブラウザ製ドローソフト（Vite + React + TypeScript, SVG描画）。汎用ドローでなく「物理オブジェクト」の配置・編集＋プリント/スライド作成に特化し、**すべての図形をプラグインとして実装する**。完全な要件は `要件.md`。コメント・UI文言・コミットは日本語。

## Commands

```bash
npm run dev    # Vite（ポート5199固定: .claude/launch.json）
npm run build  # tsc -b（型チェック）→ vite build
npm run lint   # oxlint
npm test       # vitest run
```

型チェックのみ `npx tsc -b`。単一テストは `npx vitest run <path>` / `-t "<名前の一部>"`。

**プレビュー検証**: キャンバスは pointerイベント駆動（mouse-clickは無反応→`PointerEvent`をdispatch）。ツール切替・選択はZustand同期だがReact再描画は非同期→DOM検証は別呼び出しに分ける。チェックボックスは`.click()`で（合成`change`は無効）。

## Architecture

### プラグイン経由でのみ図形を扱う

中核契約は `src/core/plugin.ts` の `PhysicsObjectPlugin<P>`。本体（キャンバス・選択・Undo/Redo・保存・出力）は図形種別を知らず `pluginRegistry`(`src/core/registry.ts`)経由でのみアクセス。**新図形＝1ファイル新規＋`src/plugins/index.ts`に登録1行**（`要件.md`§16, 不変目標）。プラグインは `src/plugins/{basic,mechanics,thermo,electromagnetism,optics,waves,atom,annotation,graph,layout}/` に分け、`category`がツールボックス見出し。主なフック（多くは任意）:
- `Renderer({props,transform?,objectId?,interactive?})` — **ローカル座標**でSVG描画。`interactive`は書き出し時false（キャンバス専用の補助線・当たり判定を出し分ける）
- `getBounds`/`getSnapPoints`/`getSegments`/`getCircle` — 当たり判定・スナップ・拘束相手
- `propertySchema` — `PropertyPanel.tsx`自動生成。表せない配列・ボタン等は`PanelExtra`(独自パネル部品)
- `applyScale`/`getEndpoints`+`setFromEndpoints`/`applyRefs`/`moveLabel` — 操作の焼き込み
- `initProps(props,siblings)` — 配置直後に同種既存を見て補正（用紙枠のページ自動採番）
- `capabilities`: `rotatable` / `scalable`('both'|'uniform'|'x'|'none') / `construction`(補助線化, 線・円のみ) / `printFrame`(用紙枠=本体が種別を知らず用紙を発見)
- `EditorModal`(+`openEditorOnCreate`) — 大型エディタ。`editorModalStore`+汎用`SourceEditorModal`。latex/latexDocが使用。**latexDoc**は地の文+KaTeX混在を`latexDocParser.ts`(純粋)で分割・枠幅で折返し、`applyScale`はフォント不変で枠のみ

**グラフ**(`src/plugins/graph/`)は座標系+複数プロットの複合プラグイン。数式`exprParser.ts`(初等関数・暗黙乗算・全角正規化)、座標変換・目盛り・最小二乗は純粋`graphMath.ts`(要テスト)。表示範囲props持ちで原点ハンドル=パン・「グラフ範囲」ツール=ズーム。曲線はサイズ由来idの`clipPath`で箱内クリップ(objectId非依存=書き出し安全)。

### 座標・単位・transform（最重要）

プラグインは常に**原点=中心のローカル座標**で描画。移動・回転・拡縮は本体が`Transform`(`translate→rotate→scale`順)で一元処理し、`ObjectsLayer`/`exporter`が`<g transform>`適用後に`Renderer`を呼ぶ。幾何は`src/core/geometry.ts`。

**単位**(`src/core/units.ts`): 1内部単位 = 1 CSS px = 1/96インチ = 0.75pt = 0.2646mm。`mmToUnits`/`unitsToMm`/`unitsToPt`/`dpiToScale(=dpi/96)`。用紙・実寸出力はmm props→`mmToUnits`で内部単位へ。

拡縮2系統:
- **箱型**(rect/circle/block/text/latex/point/arc/image/table/pageFrame)は`applyScale`でサイズを**propsへ焼き込む**(`transform.scale`常に1→線幅不変・文字サイズ可変)。計算`src/canvas/transformMath.ts`。
- **線分系**(line/arrow/spring/vector/force/floor)は`scalable:'none'`＋`getEndpoints`/`setFromEndpoints`の端点編集。

回転(`transformMath.ts`): 表示角「水平右=0°・反時計回り正」、内部rotation(画面時計回り正)と`toDisplayAngle`/`fromDisplayAngle`で符号反転。回転ハンドルは任意軸ピボット対応(一時状態・非永続)。

### 参照/拘束レイヤー（refs）

`SceneObject.refs?: ObjectRef[]`が他オブジェクトへの参照を持つ。`src/core/constraints.ts`の`resolveRef`が対象の`getSegments`/`getCircle`/スナップ点+transformからワールドのアンカー・接線・半径を算出、`solveConstraints`が**DFSトポロジカル順(対象→依存)**で解決。refsはプレーンデータ=保存・Undo/Redoに乗り再実行で整合回復。循環・欠損はスキップ。2方式:
1. **プラグイン固有**(`applyRefs`): 依存側が自分のtransform/propsを再構築。角度/長さマーク・接線。
2. **本体ソルバ直接**(`solveReservedRoles`, `ObjectRef.role`予約): **refs配列順=優先度の逐次DOF解決**(位置2・回転1・線分系は長さ1)。`'parallel'`/`'perpendicular'`=回転(`angleOffset`加算、排他)。`'coincident'`=局所`localAnchor`を基準点へ一致。**複数可**: 2本目は回転+長さ(線分=`setFromEndpoints`で伸縮+`localAnchor`書き直し/剛体=距離一致必須)で解く=2点拘束。`'anchor'`(kind:'circle')がcoincidentと同居すると**一致点を通る円への接線**として回転を解く(接点浮動、`t`書き直し。単独時は従来どおり`applyRefs`)。**注意: 端点を円周に一致させた拘束は`{role:'coincident', kind:'circle'}`＝`kind`だけでは接線と区別不能**。接点ハンドルの表示/接点スライドdrag/マスター円の移動追従など「接線らしさ」判定は必ず`findTangentAnchor`(`role==='anchor' && kind==='circle'`)を通す(`kind==='circle'`だけで判定すると円周一致線に旧接線マークが出て、ドラッグで接線化してしまう)。基準は対象スナップ点(`kind:'point'`+`pointIndex`, `localSnapPoints`で並び共有)or自由座標`worldAnchor`(`targetId:''`)。

先着の拘束を厳密に満たし、後着で解けないものは`ConstraintIssue`(過剰拘束)→`constraintStore.issues`→マーカー赤表示。拘束作成は`tryAddRefs`(CanvasStage)が試し解きで却下しトースト表示。回転拘束の判定は`isRotationConstrained`(平行/垂直・一致×2・一致+接線→回転ハンドル/角度入力を非表示)。長さは`isLengthConstrained`(一致×2→パネルの長さ入力を無効化)。パネルの長さ変更(`updateProps`)は線分系(`getEndpoints`)で一致アンカーの`localAnchor`を長さ比で更新し、一致点を固定して反対端だけ伸縮させる。拘束作成は非プラグイン操作ツール(`src/canvas/tools.tsx`の`OPERATION_TOOLS`)。マーカーは`ConstraintMarkers.tsx`常時描画(平行`>>`/垂直L字/一致リング×refs位置)、`data-constraint-role`(+`data-constraint-index`)クリック→`constraintStore.focused`→解除ピル/Deleteでその拘束のみ除去。端点ドラッグは一致=基準点/平行垂直・一致+接線=向き固定で反対端を編集(一致×2は完全拘束=端点編集不可)。一致点ドラッグは`projectAnchorPoint`で**対象オブジェクトの幾何上のみ**スライド(自由基準点のみ`snapAnchorPoint`で再接続可)。**`localAnchor`はオブジェクトのローカル座標=長さで変わるフレーム基準なので`props`(長さ)と対**。2点拘束の線分は解くたびソルバが`localAnchor`+`props`を同フレームへ書き直す＝両者が整合している前提。この整合が崩れると2点拘束の再パラメタ化(`u1/u2`)がずれ長さが発散する。よって**一致マーカーのドラッグは毎tick `props/transform/refs`をドラッグ開始値へ戻してから解く**(`setObjectTransient`。前tickで伸びた`props`を持ち越すと`beforeRefs`の旧フレーム`localAnchor`と食い違い発散)。commitも同様に開始値へ戻してから確定。

### 状態管理（Zustand）

`src/state/`。`documentStore`が中核で**immerパッチベースUndo/Redo**(`mutate`=`produceWithPatches`)。ドラッグは**transient→commit**の2段: `set*Transient`(履歴外ライブ) → `commit*`(開始値を渡し1エントリ記録)。`mutate`末尾と各transient/undo/redo/loadで`solveConstraints`を通し拘束はドラッグ中もライブ追従。主なアクション: `setObjectFlags`(locked/visible/construction)・`updateProps`/`updatePropsMany`(一括=1履歴)・`alignSelection`/`distributeSelection`。他ストア: `viewportStore`(pan/zoom/grid/snap+`frameWorldRect`)・`toolStore`・`workspaceStore`・`constraintStore`。

### 入力処理は CanvasStage に集中

`src/canvas/CanvasStage.tsx`が全ポインタ操作の中心。`DragState`ユニオン(move/scale/rotate/endpoint/anchor/labelDrag/markOffset/marquee/place-line/pan)を down=モード判定/move=フック+transient/up=commit で回す。選択枠`SelectionOverlay.tsx`、スナップ`snapping.ts`(グリッド＋`snapEndpoint`＋`snapAnchorPoint`。移動はグリッドのみ)。マーキーは`rectsIntersect`だが**用紙枠は`rectContains`**(枠全体を囲んだ時だけ選択=内部ドラッグで巻き込まない)。**画像取込**: 外枠へのファイルD&Dと`paste`イベント(OSクリップボード画像は`clipboardData`=pasteでしか読めず、Ctrl+Vはpasteで処理。画像あれば画像化・無ければ`pasteClipboard`)。挿入`insertImage.ts`+`imageLoad.ts`。

### 描画レイヤーとラベル

`ObjectsLayer`(zIndex順)→`PageBadges`(用紙左上のページ番号=クリックで枠選択)→`SelectionOverlay`→`ConstraintMarkers`。ラベル付き(block/vector/force/lengthMark/angleMark)は`objectLabel.ts`+`LabelView.tsx`共有: LaTeX入力・常時正立(`rotate(-rotation)`)・ドラッグ移動(`labelDx/labelDy`+`moveLabel`)・背景白塗り。**コンストラクション**(`SceneObject.construction`)は`ConstructionView.tsx`が色付き点線で描画、スナップ・拘束は効き**書き出しのみ除外**。角度マークは90°で直角マークへ自動切替(`angleMarkMath.ts`)。

### レイアウト・印刷・書き出し

**用紙枠**(`layout.pageFrame`, `printFrame`): props実寸mm・回転不可。プリセット/向き`pageFrameMath.ts`、補助線(等分線・対角線, キャンバスのみ非印刷, スナップ有効)`pageGuides.ts`、ページ順は明示`pageNumber`(`initProps`で自動採番)。共有`src/core/pageFrames.ts`(`orderedPageFrames`)をpanel/書き出し/バッジ/ページ移動で共用。**画像**(`layout.image`)=srcをdata URLで持つ箱型(保存・書き出しそのまま)。**表**(`layout.table`, `tableMath.ts`)。

**書き出し**(`src/export/exporter.ts`): 各`Renderer`を`renderToStaticMarkup`で自己完結SVG化→PNG/JPEG/PDFへラスタライズ。非visible・constructionは除外。**KaTeX foreignObjectはcanvas汚染回避のためdata URL+`crossOrigin`**(blob URL不可)、KaTeX CSSの非data-URIフォント参照は除去必須(`exportStyles()`)。PDFは`exportPdfPages`(複数ページ=`addPage`)、`physicalMm`で実寸(mm)/図の縦横比(pt)を切替、canvas上限(≈16.7Mpx)は`cappedScale`で自動抑制。**印刷**(`src/export/print.ts`)=各用紙をPNG化→隠しiframeに`@page{size:mm}`で並べ`print()`。**クリップボードはPNGのみ**(SVGはWord/PowerPointがKaTeXを誤描画)。**ページ移動**=MenuBarのページ選択→`viewportStore.frameWorldRect`で用紙を画面中央へ。

**永続化**: `src/persistence/`(IndexedDB)。`{pluginId,version,props}`+共通エンベロープ(transform/zIndex/locked/visible/groupId/construction/refs)。`version`不一致は`migrate()`、未知`pluginId`は読み飛ばす。個別JSON/ZIP両対応。**保存先は`StorageAdapter`(`types.ts`)で抽象化**され、ローカル(`IndexedDbAdapter`)とGoogle Drive(`src/integrations/googleDrive/`)を切替可。`authStore`がソース(local/drive:email)とアカウントを管理し`workspaceStore.init(adapter)`を差し替え、`WorkspaceSourceSelector`で切替(切替時は`/`へ)。Drive認証はGIS token flow(`gis.ts`)＝クライアントシークレット不要・トークン非保存(メモリのみ)・`prompt:''`でサイレント再取得しログイン保持、localStorageは非機密ヒント(email/最終ソース)のみ。`GoogleDriveAdapter`は各ノードを`appDataFolder`直下の1ファイルに平置き(階層は`appProperties`のnodeId/parentId/nodeType、表示名はDrive`name`、node.idはUUID維持でDrive実idと`idMap`対応)。**ノード=ファイル実体のため`createFile`/`copy`は`putNode`→`writeDocument`順が必須**(`writeDocument`は実体が無いとno-op)。スコープは`drive.appdata`(非センシティブ=重い審査不要)。**信頼性の要(データ消失対策)**: ①`driveFetch`はバースト書き込みのスロットリングで書き込みが黙って失われないよう、429/5xx/403レート制限/ネットワーク断を指数バックオフで再試行(401は従来どおり1回だけ強制トークン更新)。②読み書きは`useDocumentIO`に集約し、**初回読み込みが成功するまで自動保存しない**=読み込み失敗ファイルを開いても空キャンバスで上書きしない(旧`useAutosave`の空上書きでDriveが白紙化する事故を防ぐ)。③ZIP/JSON読込(`WorkspacePanel`)は中身書き込み失敗時に空ノードをロールバックし、成功/失敗をトースト通知(黙って白紙ファイルを残さない)。

## Conventions / gotchas

- **fast-refresh回避でコンポーネントと非コンポーネントを別ファイル**(`fillPattern.ts`↔`PatternDefs.tsx` 等)。
- macOSはcase-insensitive → 大小違いだけの名前はtsc(TS1149)で衝突。名前を明確に分ける。
- 純粋な幾何・算術はRendererから`*Math.ts`へ切り出し単体テスト。
- **Zustandセレクタは安定参照/プリミティブのみ返す**。`worldBounds`や`orderedPageFrames`等の新規オブジェクト/配列を返すと"getSnapshot should be cached"→無限ループ。セレクタは`objects`等を返し本体で導出。
- KaTeX実測はフォント非同期ロード依存→`katexFonts.ts`でロード完了後に測り直す。
