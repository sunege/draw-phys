import { useEffect, useRef, useState } from 'react';
import {
  findRotationLock,
  localSnapPoints,
  parallelOffset,
  perpendicularOffset,
  resolveCoincidentAnchor,
} from '../core/constraints';
import { createSceneObject, type SceneObject } from '../core/document';
import {
  angleOfVector,
  distance,
  localToWorld,
  nearestPointOnSegment,
  snapPoint,
  transformToString,
  worldBounds,
  worldToLocal,
} from '../core/geometry';
import type { AnyPlugin, EdgePick, SegmentPick } from '../core/plugin';
import { pluginRegistry } from '../core/registry';
import type { ObjectRef, Point, Rect, Transform } from '../core/types';
import { copySelection, duplicateSelection, pasteClipboard } from '../state/clipboard';
import { useConstraintStore } from '../state/constraintStore';
import { expandWithGroups, useDocumentStore } from '../state/documentStore';
import { useEditorModalStore } from '../state/editorModalStore';
import { useHintStore } from '../state/hintStore';
import { useToolStore } from '../state/toolStore';
import { useViewportStore } from '../state/viewportStore';
import { ConstraintMarkers } from './ConstraintMarkers';
import { screenToWorld } from './coords';
import { isDoubleClick, type ClickRecord } from './doubleClick';
import { GridLayer } from './GridLayer';
import { ObjectsLayer } from './ObjectsLayer';
import { PageBadges } from './PageBadges';
import { SelectionOverlay } from './SelectionOverlay';
import {
  snapAnchorPoint,
  snapEndpoint,
  snapMovement,
  snapWorldPoint,
  type AnchorBind,
  type EndpointAttach,
} from './snapping';
import {
  COINCIDENT_TOOL,
  GRAPH_RANGE_TOOL,
  PARALLEL_TOOL,
  PERPENDICULAR_TOOL,
  TANGENT_TOOL,
  TRIM_TOOL,
} from './tools';
import { computeTrimKeeps } from './trim';
import { ellipseParamAngle } from './trimMath';
import {
  computeRotationAboutPivot,
  computeScaleDrag,
  computeScaleToProps,
  projectOntoFixedRadius,
  type HandleDir,
} from './transformMath';
import styles from './CanvasStage.module.css';

type DragState =
  | { mode: 'pan'; lastX: number; lastY: number }
  | {
      mode: 'move';
      /** クリックしたオブジェクトのID(ダブルクリック判定に使う) */
      hitId: string;
      startWorld: Point;
      before: Record<string, Transform>;
      moved: boolean;
    }
  | {
      mode: 'scale';
      id: string;
      before: Transform;
      beforeProps: Record<string, unknown>;
      plugin: AnyPlugin;
      bounds: Rect;
      handle: HandleDir;
      uniform: boolean;
      moved: boolean;
    }
  | {
      mode: 'rotate';
      id: string;
      before: Transform;
      /** 回転軸(ワールド座標)。既定は中心 */
      pivot: Point;
      /** つかんだ点(ワールド座標)。回転角の基準にする */
      grab: Point;
      moved: boolean;
    }
  | { mode: 'rotatePivot'; id: string; moved: boolean }
  | {
      mode: 'endpoint';
      id: string;
      end: 0 | 1;
      before: Transform;
      beforeProps: Record<string, unknown>;
      plugin: AnyPlugin;
      /** 円拘束された線の端点(片側長さ変更モード) */
      constrained: boolean;
      /**
       * 一致/平行拘束された線の端点編集。反対端(または一致基準点)を固定して長さを変える。
       * coincidentBase があれば位置を固定、parallelLocked なら向きを基準へ固定する。
       */
      endpointPin: {
        coincidentBase: Point | null;
        parallelLocked: boolean;
        beforeRefs: ObjectRef[];
      } | null;
      moved: boolean;
    }
  | { mode: 'anchor'; id: string; targetId: string; beforeRefs: ObjectRef[]; moved: boolean }
  | { mode: 'coincidentDrag'; id: string; beforeRefs: ObjectRef[]; moved: boolean }
  | {
      mode: 'labelDrag';
      id: string;
      before: Transform;
      beforeProps: Record<string, unknown>;
      plugin: AnyPlugin;
      startWorld: Point;
      moved: boolean;
    }
  | {
      mode: 'markOffset';
      id: string;
      before: Transform;
      beforeProps: Record<string, unknown>;
      plugin: AnyPlugin;
      moved: boolean;
    }
  | { mode: 'marquee'; start: Point; additive: boolean }
  | { mode: 'place-line'; plugin: AnyPlugin; start: Point }
  | {
      /** プラグイン定義のパーツハンドル(グラフの原点など)のドラッグ */
      mode: 'partDrag';
      id: string;
      partId: string;
      before: Transform;
      beforeProps: Record<string, unknown>;
      plugin: AnyPlugin;
      startWorld: Point;
      moved: boolean;
    }
  | {
      /** グラフ範囲ツール: ドラッグ矩形で対象の表示範囲を指定する */
      mode: 'zoomRect';
      id: string;
      plugin: AnyPlugin;
      start: Point;
      moved: boolean;
    };

/** ドラッグ配置中のゴースト表示 */
interface PlacementPreview {
  plugin: AnyPlugin;
  props: Record<string, unknown>;
  transform: Transform;
}

interface Guides {
  /** 端点がオブジェクトへ吸着した位置のマーカー */
  marker?: Point;
}

/** 編集対象外の要素(入力欄など)でのキー操作か判定する */
function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  );
}

function objectWorldBounds(obj: SceneObject): Rect | null {
  const plugin = pluginRegistry.get(obj.pluginId);
  if (!plugin) return null;
  return worldBounds(plugin.getBounds(obj.props), obj.transform);
}

/** クリック位置に最も近い線分を選び、ワールド座標のピック情報を返す(pick-segments用) */
function pickSegment(obj: SceneObject, world: Point): SegmentPick | null {
  const plugin = pluginRegistry.get(obj.pluginId);
  const segs = plugin?.getSegments?.(obj.props);
  if (!segs || segs.length === 0) return null;
  const holder: { best: { i: number; dist: number; a: Point; b: Point } | null } = { best: null };
  for (let i = 0; i < segs.length; i++) {
    const a = localToWorld(segs[i][0], obj.transform);
    const b = localToWorld(segs[i][1], obj.transform);
    const d = distance(world, nearestPointOnSegment(world, a, b));
    if (!holder.best || d < holder.best.dist) holder.best = { i, dist: d, a, b };
  }
  const { best } = holder;
  if (!best) return null;
  return { targetId: obj.id, segIndex: best.i, worldPoint: world, a: best.a, b: best.b };
}

/** 角度tを円弧の角度範囲[start, start+sweep]にクランプする */
function clampToArc(t: number, start: number, end: number): number {
  const sweep = ((end - start) % 360 + 360) % 360 || 360;
  const rel = ((t - start) % 360 + 360) % 360;
  if (rel <= sweep) return t;
  // 範囲外は近い方の端へ
  return rel - sweep <= 360 - rel ? start + sweep : start;
}

/** 円/円弧オブジェクト上で、ワールド点に対応するローカル角度(度)を返す。円でなければnull */
function circleAngleAt(obj: SceneObject, world: Point): number | null {
  const plugin = pluginRegistry.get(obj.pluginId);
  const c = plugin?.getCircle?.(obj.props);
  if (!c) return null;
  const center = localToWorld(c.center, obj.transform);
  const t = angleOfVector({ x: world.x - center.x, y: world.y - center.y }) - obj.transform.rotation;
  if (c.startAngle != null && c.endAngle != null) return clampToArc(t, c.startAngle, c.endAngle);
  return t;
}

/** 楕円/楕円弧オブジェクト上で、ワールド点に対応する媒介変数角度(度)を返す。楕円でなければnull */
function ellipseAngleAt(obj: SceneObject, world: Point): number | null {
  const plugin = pluginRegistry.get(obj.pluginId);
  const e = plugin?.getEllipse?.(obj.props);
  if (!e) return null;
  const center = localToWorld(e.center, obj.transform);
  const t = ellipseParamAngle(center, e.radiusX, e.radiusY, obj.transform.rotation, world);
  if (e.startAngle != null && e.endAngle != null) return clampToArc(t, e.startAngle, e.endAngle);
  return t;
}

/** 指定ロールの拘束だけを外す(オブジェクト本体・他の拘束は残す) */
function removeConstraint(id: string, role: string): void {
  const doc = useDocumentStore.getState();
  const obj = doc.objects[id];
  if (!obj?.refs) return;
  doc.setObjectRefs(
    id,
    obj.refs.filter((r) => r.role !== role),
  );
}

/** クリック位置に最も近い、対象のスナップ点(局所座標+インデックス)を返す */
function nearestSnapPoint(obj: SceneObject, world: Point): { local: Point; index: number } | null {
  const plugin = pluginRegistry.get(obj.pluginId);
  if (!plugin) return null;
  const pts = localSnapPoints(plugin, obj.props);
  const holder: { best: { local: Point; index: number; dist: number } | null } = { best: null };
  pts.forEach((local, index) => {
    const d = distance(world, localToWorld(local, obj.transform));
    if (!holder.best || d < holder.best.dist) holder.best = { local, index, dist: d };
  });
  return holder.best ? { local: holder.best.local, index: holder.best.index } : null;
}

/**
 * 一致点ドラッグの結果(bind/自由座標)から新しい coincident 参照を作る。
 * localAnchor(自オブジェクト側の接続点)は引き継ぐ。
 */
function makeCoincidentRef(
  prev: ObjectRef,
  snapped: { point: Point; bind?: AnchorBind },
): ObjectRef {
  if (snapped.bind) {
    return { role: 'coincident', localAnchor: prev.localAnchor, ...snapped.bind };
  }
  // どこにも吸着しなければ自由座標へ(対象なし)
  return { role: 'coincident', kind: 'point', targetId: '', localAnchor: prev.localAnchor, worldAnchor: snapped.point };
}

/** クリックしたオブジェクトの最寄りエッジ(線分)または円周を EdgePick で返す */
function pickEdge(obj: SceneObject, world: Point): EdgePick | null {
  const seg = pickSegment(obj, world);
  if (seg) return { kind: 'segment', targetId: seg.targetId, segIndex: seg.segIndex };
  const t = circleAngleAt(obj, world);
  if (t != null) return { kind: 'circle', targetId: obj.id, t };
  const te = ellipseAngleAt(obj, world);
  if (te != null) return { kind: 'ellipse', targetId: obj.id, t: te };
  return null;
}

/** 端点吸着の相手情報から追従バインド用の refs を作る */
function attachToRefs(attach: EndpointAttach): ObjectRef[] {
  if (attach.kind === 'segment') {
    return [
      { role: 'p0', targetId: attach.targetId, kind: 'segment', segIndex: attach.segIndex, t: 0 },
      { role: 'p1', targetId: attach.targetId, kind: 'segment', segIndex: attach.segIndex, t: 1 },
    ];
  }
  return [{ role: 'circle', targetId: attach.targetId, kind: 'circle', t: attach.t }];
}

export function CanvasStage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  /** 直前の「移動していないクリック」の記録(ダブルクリック判定用) */
  const lastClickRef = useRef<ClickRecord | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [guides, setGuides] = useState<Guides>({});
  const [marquee, setMarquee] = useState<Rect | null>(null);
  // グラフ範囲ツールのドラッグ矩形(マーキーと区別するため別state・別色)
  const [rangeRect, setRangeRect] = useState<Rect | null>(null);
  /** 回転軸マーカー(赤)。回転ハンドルに触れると表示し、ドラッグで移動できる。選択中のみ有効 */
  const [rotatePivot, setRotatePivot] = useState<{ id: string; world: Point } | null>(null);
  const [preview, setPreview] = useState<PlacementPreview | null>(null);
  /** pick-segments 配置(角度マーク)で選択済みの線分ピック */
  const [segPicks, setSegPicks] = useState<SegmentPick[]>([]);
  /** 接線モードで先に選択した既存線分のID(省略可) */
  const [tangentLineId, setTangentLineId] = useState<string | null>(null);
  /** 平行拘束モードで先に選択した「向きを変えるオブジェクト」のID */
  const [parallelObjId, setParallelObjId] = useState<string | null>(null);
  /** 一致/接続モードで先に選択した「動かす側」のIDと接続点(局所アンカー) */
  const [coincidentPick, setCoincidentPick] = useState<{ objId: string; localAnchor: Point } | null>(
    null,
  );

  const pan = useViewportStore((s) => s.pan);
  const zoom = useViewportStore((s) => s.zoom);
  const activeTool = useToolStore((s) => s.activeTool);
  const selection = useDocumentStore((s) => s.selection);
  // 選択が変わり、回転軸マーカーの対象が単独選択でなくなったら隠す
  useEffect(() => {
    if (!(selection.length === 1 && rotatePivot && selection[0] === rotatePivot.id)) {
      setRotatePivot(null);
    }
  }, [selection, rotatePivot]);
  // 拘束モードで1回目に選んだオブジェクト(安定した参照を購読し、枠は描画時に導出)
  const firstPickId = parallelObjId ?? coincidentPick?.objId ?? tangentLineId ?? null;
  const firstPickObj = useDocumentStore((s) => (firstPickId ? s.objects[firstPickId] : undefined));
  const firstPickPlugin = firstPickObj ? pluginRegistry.get(firstPickObj.pluginId) : undefined;
  const firstPickBounds =
    firstPickObj && firstPickPlugin
      ? worldBounds(firstPickPlugin.getBounds(firstPickObj.props), firstPickObj.transform)
      : null;
  // 一致/接続モードで選んだ接続点(局所アンカー)のワールド位置
  const coincidentPickPoint =
    coincidentPick && firstPickObj ? localToWorld(coincidentPick.localAnchor, firstPickObj.transform) : null;

  // コンテナサイズの追従(viewBox計算用)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ホイールズーム(preventDefaultのためpassive:falseで登録)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { pan, zoom, zoomAt } = useViewportStore.getState();
      const worldPoint = screenToWorld(e.clientX, e.clientY, svg, pan, zoom);
      zoomAt(worldPoint, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // キーボードショートカット
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const doc = useDocumentStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceHeld(true);
      } else if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          doc.redo();
        } else {
          doc.undo();
        }
      } else if (mod && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          doc.ungroupSelection();
        } else {
          doc.groupSelection();
        }
      } else if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft')) {
        e.preventDefault();
        const toFront = e.code === 'BracketRight';
        doc.reorderSelection(
          e.shiftKey ? (toFront ? 'front' : 'back') : toFront ? 'forward' : 'backward',
        );
      } else if (e.key.startsWith('Arrow') && doc.selection.length > 0) {
        e.preventDefault();
        const { gridSize } = useViewportStore.getState();
        const step = e.shiftKey ? 1 : gridSize;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const before: Record<string, Transform> = {};
        const transforms: Record<string, Transform> = {};
        for (const id of doc.selection) {
          const obj = doc.objects[id];
          if (!obj || obj.locked) continue;
          before[id] = obj.transform;
          transforms[id] = { ...obj.transform, x: obj.transform.x + dx, y: obj.transform.y + dy };
        }
        doc.setTransformsTransient(transforms);
        doc.commitTransforms(before);
      } else if (mod && key === 'y') {
        e.preventDefault();
        doc.redo();
      } else if (mod && key === 'c') {
        e.preventDefault();
        copySelection();
      } else if (mod && key === 'v') {
        e.preventDefault();
        pasteClipboard();
      } else if (mod && key === 'd') {
        e.preventDefault();
        duplicateSelection();
      } else if (mod && key === 'a') {
        e.preventDefault();
        doc.setSelection(
          Object.values(doc.objects)
            .filter((o) => o.visible && !o.locked)
            .map((o) => o.id),
        );
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // マーカーでアクセス中の拘束があれば、オブジェクトではなくその拘束だけを外す
        const focused = useConstraintStore.getState().focused;
        const focusedObj = focused ? doc.objects[focused.objectId] : undefined;
        if (focused && focusedObj?.refs?.some((r) => r.role === focused.role)) {
          removeConstraint(focused.objectId, focused.role);
          useConstraintStore.getState().setFocused(null);
        } else {
          doc.removeObjects(doc.selection);
        }
      } else if (key === 's' && !mod) {
        // スナップON/OFF切り替え(間隔設定は保持)
        e.preventDefault();
        useViewportStore.getState().toggleSnap();
      } else if (e.key === 'Escape') {
        useToolStore.getState().setActiveTool('select');
        doc.clearSelection();
        setSegPicks([]);
        setTangentLineId(null);
        setParallelObjId(null);
        setCoincidentPick(null);
        useConstraintStore.getState().setFocused(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ツールを切り替えたら進行中の線分ピック・接線対象・平行/一致対象を破棄する
  useEffect(() => {
    setSegPicks([]);
    setTangentLineId(null);
    setParallelObjId(null);
    setCoincidentPick(null);
  }, [activeTool]);

  // 拘束モードの操作ガイドを上部中央に表示する(ステップ進行で文言を差し替え)
  useEffect(() => {
    const { setHint } = useHintStore.getState();
    if (activeTool === PARALLEL_TOOL || activeTool === PERPENDICULAR_TOOL) {
      const title = activeTool === PERPENDICULAR_TOOL ? '垂直' : '平行';
      setHint(
        parallelObjId
          ? { title, message: '基準にする線分・辺をクリック', step: { current: 2, total: 2 } }
          : { title, message: '向きを合わせるオブジェクトをクリック', step: { current: 1, total: 2 } },
      );
    } else if (activeTool === COINCIDENT_TOOL) {
      setHint(
        coincidentPick
          ? { title: '一致', message: '基準にする接続点をクリック', step: { current: 2, total: 2 } }
          : { title: '一致', message: '動かすオブジェクトの接続点をクリック', step: { current: 1, total: 2 } },
      );
    } else if (activeTool === TANGENT_TOOL) {
      setHint(
        tangentLineId
          ? { title: '接線', message: '接続する円・円弧をクリック' }
          : { title: '接線', message: '円・円弧をクリック（先に線・矢印・ベクトルを選ぶと接続）' },
      );
    } else if (activeTool === TRIM_TOOL) {
      setHint({ title: 'トリム', message: '切り取る線・円弧・円のエッジをクリック（Escで終了）' });
    } else if (activeTool === GRAPH_RANGE_TOOL) {
      setHint({ title: 'グラフ範囲', message: 'グラフ内をドラッグして表示範囲を指定（Escで終了）' });
    } else {
      setHint(null);
    }
  }, [activeTool, parallelObjId, coincidentPick, tangentLineId]);

  // アンマウント時にヒントを片付ける
  useEffect(() => () => useHintStore.getState().clearHint(), []);

  const worldFromEvent = (e: React.PointerEvent): Point => {
    const { pan, zoom } = useViewportStore.getState();
    return screenToWorld(e.clientX, e.clientY, svgRef.current!, pan, zoom);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    // ポインタが既に無効な場合(合成イベント等)は捕捉できなくてもよい
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }

    // パン: 中ボタン or 右ドラッグ or Space+左ドラッグ
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceHeld)) {
      dragRef.current = { mode: 'pan', lastX: e.clientX, lastY: e.clientY };
      setPanning(true);
      return;
    }
    if (e.button !== 0) return;

    const doc = useDocumentStore.getState();
    const { snapEnabled, snapStep } = useViewportStore.getState();
    const gridSize = snapStep();
    const world = worldFromEvent(e);

    // 拘束の解除ピルのクリック: そのロールの拘束のみを外す
    const removeEl = (e.target as Element).closest('[data-constraint-remove]');
    if (removeEl) {
      const id = removeEl.getAttribute('data-constraint-remove');
      const role = removeEl.getAttribute('data-constraint-role');
      if (id && role) removeConstraint(id, role);
      useConstraintStore.getState().setFocused(null);
      return;
    }
    // 拘束マーカーのクリック/ドラッグ
    const markerEl = (e.target as Element).closest('[data-constraint]');
    if (markerEl) {
      const id = markerEl.getAttribute('data-constraint');
      const role = markerEl.getAttribute('data-constraint-role');
      const mObj = id ? doc.objects[id] : undefined;
      if (id && role && mObj) {
        doc.setSelection([id]);
        if (role === 'coincident' && !mObj.locked) {
          // 一致点はドラッグで移動できる。未移動(クリック)なら pointerup でアクセスUIを出す
          dragRef.current = { mode: 'coincidentDrag', id, beforeRefs: mObj.refs ?? [], moved: false };
        } else {
          // それ以外(平行など)はクリックで拘束へアクセス(解除UIを出す)
          useConstraintStore.getState().setFocused({ objectId: id, role });
        }
      }
      return;
    }
    // マーカー以外をクリックしたらアクセス中の拘束フォーカスを解除する
    if (useConstraintStore.getState().focused) useConstraintStore.getState().setFocused(null);

    // 平行/垂直拘束モード: 「向きを変えるオブジェクト」→「基準の線分/エッジ」の順にクリック
    if (activeTool === PARALLEL_TOOL || activeTool === PERPENDICULAR_TOOL) {
      const perp = activeTool === PERPENDICULAR_TOOL;
      const hit = (e.target as Element).closest('[data-object-id]');
      const hitObj = hit ? doc.objects[hit.getAttribute('data-object-id') ?? ''] : undefined;
      if (!hitObj) return;
      if (!parallelObjId) {
        // 1回目: 拘束される側を選ぶ
        setParallelObjId(hitObj.id);
        doc.setSelection([hitObj.id]);
        return;
      }
      if (hitObj.id === parallelObjId) return; // 自分自身は基準にできない
      // 2回目: 基準となる線分/エッジを選ぶ(getSegments を持つオブジェクトのみ)
      const pick = pickSegment(hitObj, world);
      if (!pick) return;
      const dep = doc.objects[parallelObjId];
      if (!dep) {
        setParallelObjId(null);
        return;
      }
      const refAngle = angleOfVector({ x: pick.b.x - pick.a.x, y: pick.b.y - pick.a.y });
      const offset = perp
        ? perpendicularOffset(dep.transform.rotation, refAngle)
        : parallelOffset(dep.transform.rotation, refAngle);
      // 回転拘束(平行/垂直)は排他。既存の回転拘束を外して付け替える
      const others = dep.refs?.filter((r) => r.role !== 'parallel' && r.role !== 'perpendicular') ?? [];
      doc.setObjectRefs(parallelObjId, [
        ...others,
        {
          role: perp ? 'perpendicular' : 'parallel',
          targetId: pick.targetId,
          kind: 'segment',
          segIndex: pick.segIndex,
          t: 0.5,
          angleOffset: offset,
        },
      ]);
      doc.setSelection([parallelObjId]);
      setParallelObjId(null);
      useToolStore.getState().setActiveTool('select');
      return;
    }

    // 一致/接続モード: 「動かす側+その接続点」→「基準のスナップ点」の順にクリック
    if (activeTool === COINCIDENT_TOOL) {
      const hit = (e.target as Element).closest('[data-object-id]');
      const hitObj = hit ? doc.objects[hit.getAttribute('data-object-id') ?? ''] : undefined;
      if (!hitObj) return;
      const snap = nearestSnapPoint(hitObj, world);
      if (!snap) return;
      if (!coincidentPick) {
        // 1回目: 動かす側のオブジェクトと接続点(最寄りのスナップ点=局所アンカー)
        setCoincidentPick({ objId: hitObj.id, localAnchor: snap.local });
        doc.setSelection([hitObj.id]);
        return;
      }
      if (hitObj.id === coincidentPick.objId) return; // 自分自身は基準にできない
      const dep = doc.objects[coincidentPick.objId];
      if (!dep) {
        setCoincidentPick(null);
        return;
      }
      // 2回目: 基準側のスナップ点。既存の一致拘束は差し替え、他ロール(平行等)は残す
      const others = dep.refs?.filter((r) => r.role !== 'coincident') ?? [];
      doc.setObjectRefs(coincidentPick.objId, [
        ...others,
        {
          role: 'coincident',
          targetId: hitObj.id,
          kind: 'point',
          pointIndex: snap.index,
          localAnchor: coincidentPick.localAnchor,
        },
      ]);
      doc.setSelection([coincidentPick.objId]);
      setCoincidentPick(null);
      useToolStore.getState().setActiveTool('select');
      return;
    }

    // 接線モード: (任意)線分クリック→円/円弧クリックで、線の中点を接線方向に接続
    if (activeTool === TANGENT_TOOL) {
      const hit = (e.target as Element).closest('[data-object-id]');
      const hitObj = hit ? doc.objects[hit.getAttribute('data-object-id') ?? ''] : undefined;
      if (!hitObj) return;
      const hitPlugin = pluginRegistry.get(hitObj.pluginId);
      if (hitPlugin?.getCircle) {
        const t = circleAngleAt(hitObj, world);
        if (t == null) return;
        let lineId = tangentLineId;
        if (!lineId) {
          const linePlugin = pluginRegistry.get('core.line');
          if (!linePlugin) return;
          const newLine = createSceneObject(linePlugin, world, doc.nextZIndex);
          doc.addObject(newLine);
          lineId = newLine.id;
        }
        doc.setObjectRefs(lineId, [{ role: 'anchor', targetId: hitObj.id, kind: 'circle', t }]);
        doc.setSelection([lineId]);
        setTangentLineId(null);
        useToolStore.getState().setActiveTool('select');
      } else if (hitPlugin?.getEndpoints) {
        // 既存の線分を接続対象として記録
        setTangentLineId(hitObj.id);
      }
      return;
    }

    // トリムモード: クリックした線・円弧・円のエッジを、交点から交点まで切り取る
    if (activeTool === TRIM_TOOL) {
      const hit = (e.target as Element).closest('[data-object-id]');
      const hitObj = hit ? doc.objects[hit.getAttribute('data-object-id') ?? ''] : undefined;
      if (!hitObj || hitObj.locked) return;
      const trimPlugin = pluginRegistry.get(hitObj.pluginId);
      if (!trimPlugin?.trim) return;
      const pick = pickEdge(hitObj, world);
      if (!pick) return;
      const keeps = computeTrimKeeps(doc.objects, pluginRegistry, hitObj.id, world, pick);
      if (!keeps) return;
      const pieces = trimPlugin.trim(hitObj.props, hitObj.transform, keeps);
      if (pieces) doc.applyTrim(hitObj.id, pieces);
      // トリムモードは維持(連続してトリムできる。Escで終了)
      return;
    }

    // グラフ範囲モード: zoomToRect を実装したオブジェクトの上でドラッグして表示範囲を指定
    if (activeTool === GRAPH_RANGE_TOOL) {
      const hit = (e.target as Element).closest('[data-object-id]');
      const hitObj = hit ? doc.objects[hit.getAttribute('data-object-id') ?? ''] : undefined;
      if (!hitObj || hitObj.locked) return;
      const rangePlugin = pluginRegistry.get(hitObj.pluginId);
      if (!rangePlugin?.zoomToRect) return;
      doc.setSelection([hitObj.id]);
      dragRef.current = { mode: 'zoomRect', id: hitObj.id, plugin: rangePlugin, start: world, moved: false };
      return;
    }

    // 配置ツール
    if (activeTool !== 'select') {
      const plugin = pluginRegistry.get(activeTool);
      if (!plugin) return;

      // pick-segments: 線分を2つクリックして生成(角度マーク)
      if (plugin.placement === 'pick-segments') {
        const hit = (e.target as Element).closest('[data-object-id]');
        const hitId = hit?.getAttribute('data-object-id');
        const hitObj = hitId ? doc.objects[hitId] : undefined;
        if (!hitObj) return;
        const pick = pickSegment(hitObj, world);
        if (!pick) return;
        const picks = [...segPicks, pick];
        if (picks.length >= 2 && plugin.createFromPicks) {
          const created = plugin.createFromPicks(picks);
          doc.addObject({
            ...createSceneObject(plugin, created.transform, doc.nextZIndex),
            props: created.props as Record<string, unknown>,
            transform: created.transform,
            refs: created.refs,
          });
          setSegPicks([]);
          useToolStore.getState().setActiveTool('select');
        } else {
          setSegPicks(picks);
        }
        return;
      }

      // エッジバインド対応ツール(長さマーク): 背景でなくオブジェクトを
      // クリックしたら、そのエッジ/円へバインドして生成する
      if (plugin.createFromEdge) {
        const hit = (e.target as Element).closest('[data-object-id]');
        const hitObj = hit ? doc.objects[hit.getAttribute('data-object-id') ?? ''] : undefined;
        if (hitObj) {
          const pick = pickEdge(hitObj, world);
          const refs = pick ? plugin.createFromEdge(pick) : null;
          if (refs) {
            doc.addObject({ ...createSceneObject(plugin, world, doc.nextZIndex), refs });
            useToolStore.getState().setActiveTool('select');
            return;
          }
        }
        // オブジェクト以外(背景)や非対応オブジェクトは通常のドラッグ配置へ
      }

      const position = snapEnabled ? snapPoint(world, gridSize) : world;
      if (plugin.placement === 'drag-line' && plugin.createFromDrag) {
        // ドラッグで始点→終点を決める。確定はpointerupで行う
        dragRef.current = { mode: 'place-line', plugin, start: position };
        setPreview({ plugin, ...plugin.createFromDrag(position, position) });
      } else {
        const created = createSceneObject(plugin, position, doc.nextZIndex);
        doc.addObject(created);
        useToolStore.getState().setActiveTool('select');
        // 文章系オブジェクトは配置直後に大型エディタを開く
        if (plugin.EditorModal && plugin.openEditorOnCreate) {
          useEditorModalStore.getState().open(created.id);
        }
      }
      return;
    }

    // 選択ハンドル(スケール・回転・端点)
    const handleEl = (e.target as Element).closest('[data-handle]');
    const handleKind = handleEl?.getAttribute('data-handle');
    if (handleKind && doc.selection.length === 1) {
      const obj = doc.objects[doc.selection[0]];
      const plugin = obj ? pluginRegistry.get(obj.pluginId) : undefined;
      if (obj && plugin) {
        if (handleKind === 'rotate') {
          // 回転軸: 既に置いた軸があればそれ、無ければ中心。触れた時点で赤マーカーを表示
          const pivot =
            rotatePivot?.id === obj.id
              ? rotatePivot.world
              : { x: obj.transform.x, y: obj.transform.y };
          setRotatePivot({ id: obj.id, world: pivot });
          dragRef.current = {
            mode: 'rotate',
            id: obj.id,
            before: obj.transform,
            pivot,
            grab: world,
            moved: false,
          };
        } else if (handleKind === 'pivot') {
          dragRef.current = { mode: 'rotatePivot', id: obj.id, moved: false };
        } else if (handleKind === 'anchor') {
          const anchorRef = obj.refs?.find((r) => r.kind === 'circle');
          if (anchorRef) {
            dragRef.current = {
              mode: 'anchor',
              id: obj.id,
              targetId: anchorRef.targetId,
              beforeRefs: obj.refs ?? [],
              moved: false,
            };
          }
        } else if (handleKind.startsWith('endpoint:')) {
          const end = Number(handleKind.slice('endpoint:'.length)) as 0 | 1;
          const constrained = !!(
            obj.refs?.some((r) => r.kind === 'circle') && plugin.dragEndpointConstrained
          );
          // 一致/平行拘束された線: 固定点を保って長さ(平行なら向きも)を変える端点編集
          const coRef = !constrained ? obj.refs?.find((r) => r.role === 'coincident') : undefined;
          const rotLockRef = !constrained ? findRotationLock(obj.refs) : undefined;
          const base = coRef ? resolveCoincidentAnchor(coRef, doc.objects, pluginRegistry) : null;
          const hasCo = !!(coRef && base);
          const endpointPin =
            hasCo || rotLockRef
              ? {
                  coincidentBase: hasCo ? base : null,
                  parallelLocked: !!rotLockRef,
                  beforeRefs: obj.refs ?? [],
                }
              : null;
          dragRef.current = {
            mode: 'endpoint',
            id: obj.id,
            end,
            before: obj.transform,
            beforeProps: obj.props,
            plugin,
            constrained,
            endpointPin,
            moved: false,
          };
        } else if (handleKind.startsWith('part:')) {
          // プラグイン定義のパーツハンドル(グラフの原点ハンドルなど)
          if (!obj.locked && plugin.movePart) {
            dragRef.current = {
              mode: 'partDrag',
              id: obj.id,
              partId: handleKind.slice('part:'.length),
              before: obj.transform,
              beforeProps: obj.props,
              plugin,
              startWorld: world,
              moved: false,
            };
          }
        } else {
          const [sx, sy] = handleKind.replace('scale:', '').split(',').map(Number);
          let before = obj.transform;
          let beforeProps = obj.props;
          // applyScale対応プラグインは常に scale=1。旧データにscaleが残っていればpropsへ焼き込む
          if (plugin.applyScale && (before.scaleX !== 1 || before.scaleY !== 1)) {
            beforeProps = plugin.applyScale(obj.props, before.scaleX, before.scaleY);
            before = { ...before, scaleX: 1, scaleY: 1 };
            doc.setObjectTransient(obj.id, { transform: before, props: beforeProps });
          }
          dragRef.current = {
            mode: 'scale',
            id: obj.id,
            before,
            beforeProps,
            plugin,
            bounds: plugin.getBounds(beforeProps),
            handle: { sx, sy } as HandleDir,
            uniform: plugin.capabilities?.scalable === 'uniform',
            moved: false,
          };
        }
        return;
      }
    }

    // 選択中オブジェクトのラベルをドラッグ: 本体移動ではなくラベル位置の変更にする
    const labelEl = (e.target as Element).closest('[data-object-label]');
    const labelId = labelEl?.getAttribute('data-object-label');
    if (labelId && doc.selection.length === 1 && doc.selection[0] === labelId) {
      const obj = doc.objects[labelId];
      const plugin = obj ? pluginRegistry.get(obj.pluginId) : undefined;
      if (obj && !obj.locked && plugin?.moveLabel) {
        dragRef.current = {
          mode: 'labelDrag',
          id: labelId,
          before: obj.transform,
          beforeProps: obj.props,
          plugin,
          startWorld: world,
          moved: false,
        };
        return;
      }
    }

    // オブジェクトのクリック選択+移動ドラッグ開始
    const hit = (e.target as Element).closest('[data-object-id]');
    const hitId = hit?.getAttribute('data-object-id');
    const hitObj = hitId ? doc.objects[hitId] : undefined;

    if (!hitObj || hitObj.locked) {
      // 空クリック: マーキー選択開始
      dragRef.current = { mode: 'marquee', start: world, additive: e.shiftKey };
      if (!e.shiftKey) doc.clearSelection();
      return;
    }

    if (e.shiftKey) {
      doc.toggleSelection(hitObj.id);
      return;
    }

    // 拘束された長さマーク等: 本体ドラッグは移動ではなく平行オフセットの変更にする
    const hitPlugin = pluginRegistry.get(hitObj.pluginId);
    if (hitObj.refs && hitObj.refs.length > 0 && hitPlugin?.dragOffset) {
      if (!doc.selection.includes(hitObj.id)) doc.setSelection([hitObj.id]);
      dragRef.current = {
        mode: 'markOffset',
        id: hitObj.id,
        before: hitObj.transform,
        beforeProps: hitObj.props,
        plugin: hitPlugin,
        moved: false,
      };
      return;
    }

    // グループに属する場合はグループ全体を選択する
    const hitIds = expandWithGroups(doc.objects, [hitObj.id]);
    const ids = doc.selection.includes(hitObj.id) ? doc.selection : hitIds;
    if (!doc.selection.includes(hitObj.id)) doc.setSelection(hitIds);

    const before: Record<string, Transform> = {};
    for (const id of ids) {
      const obj = doc.objects[id];
      if (obj && !obj.locked) before[id] = obj.transform;
    }
    // 接線拘束された線を動かすときはマスター円も一緒に動かす(円マスター・線追従)
    for (const id of Object.keys(before)) {
      const cref = doc.objects[id]?.refs?.find((r) => r.kind === 'circle');
      const target = cref ? doc.objects[cref.targetId] : undefined;
      if (target && !target.locked && !(cref!.targetId in before)) {
        before[cref!.targetId] = target.transform;
      }
    }
    dragRef.current = { mode: 'move', hitId: hitObj.id, startWorld: world, before, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.mode === 'pan') {
      useViewportStore.getState().panBy(e.clientX - drag.lastX, e.clientY - drag.lastY);
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      return;
    }

    const world = worldFromEvent(e);
    const doc = useDocumentStore.getState();
    const { snapEnabled, zoom, snapStep } = useViewportStore.getState();
    const gridSize = snapStep();

    if (drag.mode === 'move') {
      const snapped = snapMovement({
        rawDx: world.x - drag.startWorld.x,
        rawDy: world.y - drag.startWorld.y,
        movingBefore: drag.before,
        snapEnabled,
        gridSize,
      });
      const transforms: Record<string, Transform> = {};
      for (const [id, t] of Object.entries(drag.before)) {
        transforms[id] = { ...t, x: t.x + snapped.dx, y: t.y + snapped.dy };
      }
      doc.setTransformsTransient(transforms);
      drag.moved = true;
      return;
    }

    if (drag.mode === 'scale') {
      let point = world;
      // 回転済みオブジェクトはハンドルの移動軸がワールド軸と一致しないため、
      // ワールド軸に沿ったスナップは回転0のときだけ適用する
      if (drag.before.rotation === 0) {
        const snapped = snapWorldPoint({
          point: world,
          snapEnabled,
          gridSize,
          axisX: drag.handle.sx !== 0,
          axisY: drag.handle.sy !== 0,
        });
        point = snapped.point;
      }
      const uniform = drag.uniform || e.shiftKey;
      if (drag.plugin.applyScale) {
        // 拡大縮小をサイズpropsへ反映する(線幅は変わらず、文字サイズは変わる)
        const next = computeScaleToProps(
          drag.before,
          drag.beforeProps,
          drag.plugin,
          drag.handle,
          point,
          uniform,
        );
        doc.setObjectTransient(drag.id, { transform: next.transform, props: next.props });
      } else {
        const next = computeScaleDrag(drag.before, drag.bounds, drag.handle, point, uniform);
        doc.setTransformsTransient({ [drag.id]: next });
      }
      drag.moved = true;
      return;
    }

    if (drag.mode === 'endpoint' && drag.constrained && drag.plugin.dragEndpointConstrained) {
      // 接線拘束された線: 片側長さのみ変更(接点・反対端は固定)
      const props = drag.plugin.dragEndpointConstrained(drag.beforeProps, drag.before, drag.end, world);
      doc.setObjectTransient(drag.id, { props });
      drag.moved = true;
      return;
    }

    if (
      drag.mode === 'endpoint' &&
      drag.endpointPin &&
      drag.plugin.getEndpoints &&
      drag.plugin.setFromEndpoints
    ) {
      // 一致/平行拘束された線: 固定点を保ちドラッグ端だけ動かして長さ(平行なら向きも固定)を再構築
      const { coincidentBase, parallelLocked, beforeRefs } = drag.endpointPin;
      const lengthLocked = !!drag.plugin.isLengthLocked?.(drag.beforeProps);
      const snapped = snapEndpoint({
        point: world,
        objects: doc.objects,
        registry: pluginRegistry,
        excludeIds: new Set([drag.id]),
        snapEnabled,
        gridSize,
        threshold: 8 / zoom,
        gridEnabled: !lengthLocked,
      });
      const worldEps = drag.plugin.getEndpoints(drag.beforeProps).map((p) => localToWorld(p, drag.before));
      const co = beforeRefs.find((r) => r.role === 'coincident');
      const anchor = co?.localAnchor ?? { x: 0, y: 0 };
      // 一致点が中点(局所原点)なら中心を固定して反対端を点対称に動かす
      const centerAnchor = coincidentBase != null && Math.hypot(anchor.x, anchor.y) < 1e-6;
      // 固定基準点: 一致基準点があればそれ、無ければ非ドラッグ端の現在位置
      const F = coincidentBase ?? worldEps[1 - drag.end];
      // ドラッグ端の目標位置。平行なら向きを固定して基準線上へ射影する
      let target = snapped.point;
      if (parallelLocked) {
        const dv = {
          x: worldEps[drag.end].x - worldEps[1 - drag.end].x,
          y: worldEps[drag.end].y - worldEps[1 - drag.end].y,
        };
        const dl = Math.hypot(dv.x, dv.y) || 1;
        const d = { x: dv.x / dl, y: dv.y / dl };
        const proj = (target.x - F.x) * d.x + (target.y - F.y) * d.y;
        const len = centerAnchor ? proj : Math.max(proj, 1);
        target = { x: F.x + len * d.x, y: F.y + len * d.y };
      }
      if (lengthLocked) {
        // 長さ固定: 基準点Fからの距離を元の全長(中点固定なら半分)へ強制し、向きは維持する
        const total = distance(worldEps[0], worldEps[1]);
        target = projectOntoFixedRadius(F, centerAnchor ? total / 2 : total, target);
      }
      let a: Point;
      let b: Point;
      if (centerAnchor) {
        const other = { x: 2 * F.x - target.x, y: 2 * F.y - target.y };
        a = drag.end === 0 ? target : other;
        b = drag.end === 1 ? target : other;
      } else {
        a = drag.end === 0 ? target : F;
        b = drag.end === 1 ? target : F;
      }
      const res = drag.plugin.setFromEndpoints(drag.beforeProps, a, b);
      // 一致拘束があれば固定側の新しい局所位置に localAnchor を更新し整合を保つ
      let refs: ObjectRef[] | undefined;
      if (co) {
        const len = (res.props as { length?: number }).length ?? 0;
        const newAnchor = centerAnchor ? { x: 0, y: 0 } : { x: drag.end === 0 ? len / 2 : -len / 2, y: 0 };
        refs = [...beforeRefs.filter((r) => r.role !== 'coincident'), { ...co, localAnchor: newAnchor }];
      }
      doc.setObjectTransient(drag.id, {
        transform: res.transform,
        props: res.props,
        ...(refs ? { refs } : {}),
      });
      setGuides({ marker: snapped.marker });
      drag.moved = true;
      return;
    }

    if (
      drag.mode === 'endpoint' &&
      !drag.endpointPin &&
      drag.plugin.getEndpoints &&
      drag.plugin.setFromEndpoints &&
      drag.plugin.isLengthLocked?.(drag.beforeProps)
    ) {
      // 長さ固定: 反対端を中心に固定半径の円上でのみ動く(グリッドスナップは無効、他オブジェクトへは有効)
      const eps = drag.plugin.getEndpoints(drag.beforeProps);
      const worldEps = eps.map((p) => localToWorld(p, drag.before));
      const anchor = worldEps[1 - drag.end];
      const length = distance(worldEps[0], worldEps[1]);
      const snapped = snapEndpoint({
        point: world,
        objects: doc.objects,
        registry: pluginRegistry,
        excludeIds: new Set([drag.id]),
        snapEnabled,
        gridSize,
        threshold: 8 / zoom,
        gridEnabled: false,
      });
      const target = projectOntoFixedRadius(anchor, length, snapped.point);
      const a = drag.end === 0 ? target : anchor;
      const b = drag.end === 1 ? target : anchor;
      const res = drag.plugin.setFromEndpoints(drag.beforeProps, a, b);
      doc.setObjectTransient(drag.id, { transform: res.transform, props: res.props });
      setGuides({ marker: snapped.marker });
      drag.moved = true;
      return;
    }

    if (drag.mode === 'endpoint' && drag.plugin.getEndpoints && drag.plugin.setFromEndpoints) {
      const snapped = snapEndpoint({
        point: world,
        objects: doc.objects,
        registry: pluginRegistry,
        excludeIds: new Set([drag.id]),
        snapEnabled,
        gridSize,
        threshold: 8 / zoom,
      });
      const eps = drag.plugin.getEndpoints(drag.beforeProps);
      const worldEps = eps.map((p) => localToWorld(p, drag.before));
      const a = drag.end === 0 ? snapped.point : worldEps[0];
      const b = drag.end === 1 ? snapped.point : worldEps[1];
      const res = drag.plugin.setFromEndpoints(drag.beforeProps, a, b);
      doc.setObjectTransient(drag.id, { transform: res.transform, props: res.props });
      setGuides({ marker: snapped.marker });
      drag.moved = true;
      return;
    }

    if (drag.mode === 'rotate') {
      const next = computeRotationAboutPivot(
        drag.before,
        drag.pivot,
        drag.grab,
        world,
        snapEnabled ? 15 : undefined,
      );
      doc.setTransformsTransient({ [drag.id]: next });
      drag.moved = true;
      return;
    }

    if (drag.mode === 'rotatePivot') {
      // 回転軸マーカーの移動。スナップON時はグリッド/他オブジェクトのスナップ点へ吸着
      const snapped = snapEndpoint({
        point: world,
        objects: doc.objects,
        registry: pluginRegistry,
        excludeIds: new Set(),
        snapEnabled,
        gridSize,
        threshold: 8 / zoom,
      });
      setRotatePivot({ id: drag.id, world: snapped.point });
      setGuides({ marker: snapped.marker });
      drag.moved = true;
      return;
    }

    if (drag.mode === 'coincidentDrag') {
      // 一致点(基準点)の移動。他オブジェクトのスナップ点/辺/円へ吸着すれば再接続、離せば自由座標
      const co = drag.beforeRefs.find((r) => r.role === 'coincident');
      if (co) {
        const snapped = snapAnchorPoint({
          point: world,
          objects: doc.objects,
          registry: pluginRegistry,
          excludeIds: new Set([drag.id]),
          snapEnabled,
          gridSize,
          threshold: 8 / zoom,
        });
        const others = drag.beforeRefs.filter((r) => r.role !== 'coincident');
        doc.setObjectRefsTransient(drag.id, [...others, makeCoincidentRef(co, snapped)]);
        setGuides({ marker: snapped.marker });
      }
      drag.moved = true;
      return;
    }

    if (drag.mode === 'anchor') {
      const target = doc.objects[drag.targetId];
      const t = target ? circleAngleAt(target, world) : null;
      if (t != null) {
        doc.setObjectRefsTransient(drag.id, [
          { role: 'anchor', targetId: drag.targetId, kind: 'circle', t },
        ]);
      }
      drag.moved = true;
      return;
    }

    if (drag.mode === 'labelDrag' && drag.plugin.moveLabel) {
      const props = drag.plugin.moveLabel(drag.beforeProps, drag.before, drag.startWorld, world);
      doc.setObjectTransient(drag.id, { props });
      drag.moved = true;
      return;
    }

    if (drag.mode === 'partDrag' && drag.plugin.movePart) {
      const props = drag.plugin.movePart(
        drag.beforeProps,
        drag.before,
        drag.partId,
        drag.startWorld,
        world,
      );
      doc.setObjectTransient(drag.id, { props });
      drag.moved = true;
      return;
    }

    if (drag.mode === 'zoomRect') {
      setRangeRect({
        x: Math.min(drag.start.x, world.x),
        y: Math.min(drag.start.y, world.y),
        width: Math.abs(world.x - drag.start.x),
        height: Math.abs(world.y - drag.start.y),
      });
      drag.moved = true;
      return;
    }

    if (drag.mode === 'markOffset' && drag.plugin.dragOffset) {
      const props = drag.plugin.dragOffset(drag.beforeProps, drag.before, world);
      doc.setObjectTransient(drag.id, { props });
      drag.moved = true;
      return;
    }

    if (drag.mode === 'marquee') {
      setMarquee({
        x: Math.min(drag.start.x, world.x),
        y: Math.min(drag.start.y, world.y),
        width: Math.abs(world.x - drag.start.x),
        height: Math.abs(world.y - drag.start.y),
      });
      return;
    }

    if (drag.mode === 'place-line' && drag.plugin.createFromDrag) {
      const end = snapEnabled ? snapPoint(world, gridSize) : world;
      setPreview({ plugin: drag.plugin, ...drag.plugin.createFromDrag(drag.start, end) });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setPanning(false);
    setGuides({});
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }

    if (!drag) return;
    const doc = useDocumentStore.getState();

    if (drag.mode === 'move' && drag.moved) {
      doc.commitTransforms(drag.before);
    } else if (drag.mode === 'move') {
      // 移動なしのクリック: 同一オブジェクトへの2連続クリックで大型エディタを開く
      const cur: ClickRecord = { id: drag.hitId, time: e.timeStamp, x: e.clientX, y: e.clientY };
      if (isDoubleClick(lastClickRef.current, cur)) {
        lastClickRef.current = null;
        const plugin = pluginRegistry.get(doc.objects[drag.hitId]?.pluginId ?? '');
        if (plugin?.EditorModal) useEditorModalStore.getState().open(drag.hitId);
      } else {
        lastClickRef.current = cur;
      }
    } else if (drag.mode === 'rotate' && drag.moved) {
      doc.commitTransforms({ [drag.id]: drag.before });
    } else if (drag.mode === 'scale' && drag.moved) {
      if (drag.plugin.applyScale) {
        doc.commitObject(drag.id, { transform: drag.before, props: drag.beforeProps });
      } else {
        doc.commitTransforms({ [drag.id]: drag.before });
      }
    } else if (drag.mode === 'endpoint' && drag.moved && drag.constrained) {
      // 接線拘束の片側長さ変更はバインドを作らずそのまま確定する
      doc.commitObject(drag.id, { transform: drag.before, props: drag.beforeProps });
    } else if (drag.mode === 'endpoint' && drag.moved && drag.endpointPin) {
      // 一致/平行拘束された線: transform/props(一致ならlocalAnchorも)を1エントリで確定
      const hasCo = drag.endpointPin.beforeRefs.some((r) => r.role === 'coincident');
      doc.commitObject(drag.id, {
        transform: drag.before,
        props: drag.beforeProps,
        ...(hasCo ? { refs: drag.endpointPin.beforeRefs } : {}),
      });
    } else if (drag.mode === 'endpoint' && drag.moved) {
      // applyRefs対応(長さマーク等)が対象へ吸着していれば、追従バインドを作成
      const { snapEnabled, zoom, snapStep } = useViewportStore.getState();
      const gridSize = snapStep();
      const snapped = snapEndpoint({
        point: worldFromEvent(e),
        objects: doc.objects,
        registry: pluginRegistry,
        excludeIds: new Set([drag.id]),
        snapEnabled,
        gridSize,
        threshold: 8 / zoom,
      });
      if (drag.plugin.applyRefs && snapped.attach) {
        doc.setObjectRefs(drag.id, attachToRefs(snapped.attach));
        // 測定対象と重ならないよう、既定の平行オフセットを与える(長さマーク等)
        const bound = doc.objects[drag.id];
        if (drag.plugin.dragOffset && bound && !bound.props.perpOffset) {
          doc.updateProps(drag.id, { perpOffset: 30 });
        }
      } else {
        doc.commitObject(drag.id, { transform: drag.before, props: drag.beforeProps });
      }
    } else if (drag.mode === 'labelDrag' && drag.moved) {
      doc.commitObject(drag.id, { transform: drag.before, props: drag.beforeProps });
    } else if (drag.mode === 'partDrag' && drag.moved) {
      doc.commitObject(drag.id, { transform: drag.before, props: drag.beforeProps });
    } else if (drag.mode === 'zoomRect') {
      // グラフ範囲の確定。極小ドラッグ(実質クリック)は無視。ツールは維持(Escで終了)
      setRangeRect(null);
      const { zoom: z } = useViewportStore.getState();
      const world = worldFromEvent(e);
      if (
        drag.moved &&
        Math.abs(world.x - drag.start.x) > 4 / z &&
        Math.abs(world.y - drag.start.y) > 4 / z
      ) {
        const obj = doc.objects[drag.id];
        if (obj && drag.plugin.zoomToRect) {
          const next = drag.plugin.zoomToRect(
            obj.props,
            worldToLocal(drag.start, obj.transform),
            worldToLocal(world, obj.transform),
          );
          if (next) doc.updateProps(drag.id, next);
        }
      }
    } else if (drag.mode === 'markOffset' && drag.moved) {
      doc.commitObject(drag.id, { transform: drag.before, props: drag.beforeProps });
    } else if (drag.mode === 'anchor' && drag.moved) {
      // 接続点スライドの確定: ベースを戻して1履歴エントリで記録する
      const target = doc.objects[drag.targetId];
      const t = target ? circleAngleAt(target, worldFromEvent(e)) : null;
      doc.setObjectRefsTransient(drag.id, drag.beforeRefs);
      if (t != null) {
        doc.setObjectRefs(drag.id, [{ role: 'anchor', targetId: drag.targetId, kind: 'circle', t }]);
      }
    } else if (drag.mode === 'coincidentDrag') {
      if (drag.moved) {
        const { snapEnabled, zoom, snapStep } = useViewportStore.getState();
        const gridSize = snapStep();
        const co = drag.beforeRefs.find((r) => r.role === 'coincident');
        if (co) {
          const snapped = snapAnchorPoint({
            point: worldFromEvent(e),
            objects: doc.objects,
            registry: pluginRegistry,
            excludeIds: new Set([drag.id]),
            snapEnabled,
            gridSize,
            threshold: 8 / zoom,
          });
          const others = drag.beforeRefs.filter((r) => r.role !== 'coincident');
          // ベースを戻してから設定し、1履歴エントリで記録する
          doc.setObjectRefsTransient(drag.id, drag.beforeRefs);
          doc.setObjectRefs(drag.id, [...others, makeCoincidentRef(co, snapped)]);
        }
      } else {
        // クリック(未移動): 拘束へアクセス(解除UIを出す)
        useConstraintStore.getState().setFocused({ objectId: drag.id, role: 'coincident' });
      }
    } else if (drag.mode === 'marquee') {
      // stateのmarqueeは描画用。判定はイベント座標から直接計算する(再レンダー前でも正しく動くように)
      const world = worldFromEvent(e);
      const rect: Rect = {
        x: Math.min(drag.start.x, world.x),
        y: Math.min(drag.start.y, world.y),
        width: Math.abs(world.x - drag.start.x),
        height: Math.abs(world.y - drag.start.y),
      };
      if (rect.width > 1 || rect.height > 1) {
        const hits = Object.values(doc.objects)
          .filter((obj) => obj.visible && !obj.locked)
          .filter((obj) => {
            const bounds = objectWorldBounds(obj);
            return bounds !== null && rectsIntersect(bounds, rect);
          })
          .map((obj) => obj.id);
        const expanded = expandWithGroups(doc.objects, hits);
        doc.setSelection(
          drag.additive ? [...new Set([...doc.selection, ...expanded])] : expanded,
        );
      }
      setMarquee(null);
    } else if (drag.mode === 'place-line' && drag.plugin.createFromDrag) {
      const { snapEnabled, snapStep } = useViewportStore.getState();
      const gridSize = snapStep();
      const world = worldFromEvent(e);
      const end = snapEnabled ? snapPoint(world, gridSize) : world;
      const created = drag.plugin.createFromDrag(drag.start, end);
      const obj = {
        ...createSceneObject(drag.plugin, created.transform, doc.nextZIndex),
        props: created.props as Record<string, unknown>,
        transform: created.transform,
      };
      doc.addObject(obj);
      setPreview(null);
      useToolStore.getState().setActiveTool('select');
    }
  };

  const cursor = panning
    ? 'grabbing'
    : spaceHeld
      ? 'grab'
      : activeTool !== 'select'
        ? 'crosshair'
        : 'default';

  const viewWidth = Math.max(size.width, 1) / zoom;
  const viewHeight = Math.max(size.height, 1) / zoom;
  const viewBox = `${pan.x} ${pan.y} ${viewWidth} ${viewHeight}`;

  return (
    <div ref={containerRef} className={styles.container}>
      <svg
        ref={svgRef}
        data-canvas-stage
        className={styles.stage}
        viewBox={viewBox}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <GridLayer viewWidth={size.width} viewHeight={size.height} />
        <ObjectsLayer />
        <PageBadges />
        {preview && (
          <g transform={transformToString(preview.transform)} opacity={0.5} pointerEvents="none">
            <preview.plugin.Renderer props={preview.props} transform={preview.transform} />
          </g>
        )}
        <SelectionOverlay />
        <ConstraintMarkers />
        {rotatePivot && selection.length === 1 && selection[0] === rotatePivot.id && (
          <g>
            <circle
              data-handle="pivot"
              cx={rotatePivot.world.x}
              cy={rotatePivot.world.y}
              r={7 / zoom}
              fill="rgba(224,69,123,0.12)"
              stroke="#e0457b"
              strokeWidth={1.5 / zoom}
              style={{ cursor: 'move' }}
            />
            <line
              x1={rotatePivot.world.x - 11 / zoom}
              y1={rotatePivot.world.y}
              x2={rotatePivot.world.x + 11 / zoom}
              y2={rotatePivot.world.y}
              stroke="#e0457b"
              strokeWidth={1 / zoom}
              pointerEvents="none"
            />
            <line
              x1={rotatePivot.world.x}
              y1={rotatePivot.world.y - 11 / zoom}
              x2={rotatePivot.world.x}
              y2={rotatePivot.world.y + 11 / zoom}
              stroke="#e0457b"
              strokeWidth={1 / zoom}
              pointerEvents="none"
            />
          </g>
        )}
        <g pointerEvents="none">
          {marquee && (
            <rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.width}
              height={marquee.height}
              fill="rgba(43, 125, 233, 0.08)"
              stroke="#2b7de9"
              strokeWidth={1 / zoom}
            />
          )}
          {rangeRect && (
            <rect
              x={rangeRect.x}
              y={rangeRect.y}
              width={rangeRect.width}
              height={rangeRect.height}
              fill="rgba(46, 158, 91, 0.08)"
              stroke="#2e9e5b"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom} ${3 / zoom}`}
            />
          )}
          {guides.marker && (
            <circle
              cx={guides.marker.x}
              cy={guides.marker.y}
              r={5 / zoom}
              fill="none"
              stroke="#e0457b"
              strokeWidth={1.5 / zoom}
            />
          )}
          {segPicks.map((p, i) => (
            <line
              key={i}
              x1={p.a.x}
              y1={p.a.y}
              x2={p.b.x}
              y2={p.b.y}
              stroke="#e0457b"
              strokeWidth={3 / zoom}
              opacity={0.6}
            />
          ))}
          {firstPickBounds && (
            <rect
              x={firstPickBounds.x}
              y={firstPickBounds.y}
              width={firstPickBounds.width}
              height={firstPickBounds.height}
              fill="rgba(224,69,123,0.08)"
              stroke="#e0457b"
              strokeWidth={1.5 / zoom}
              strokeDasharray={`${4 / zoom} ${3 / zoom}`}
            />
          )}
          {coincidentPickPoint && (
            <circle
              cx={coincidentPickPoint.x}
              cy={coincidentPickPoint.y}
              r={5 / zoom}
              fill="none"
              stroke="#e0457b"
              strokeWidth={2 / zoom}
            />
          )}
        </g>
      </svg>
    </div>
  );
}
