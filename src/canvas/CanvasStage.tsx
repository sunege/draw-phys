import { useEffect, useRef, useState } from 'react';
import { createSceneObject, type SceneObject } from '../core/document';
import {
  angleOfVector,
  distance,
  localToWorld,
  nearestPointOnSegment,
  snapPoint,
  transformToString,
  worldBounds,
} from '../core/geometry';
import type { AnyPlugin, SegmentPick } from '../core/plugin';
import { pluginRegistry } from '../core/registry';
import type { ObjectRef, Point, Rect, Transform } from '../core/types';
import { copySelection, duplicateSelection, pasteClipboard } from '../state/clipboard';
import { expandWithGroups, useDocumentStore } from '../state/documentStore';
import { useToolStore } from '../state/toolStore';
import { useViewportStore } from '../state/viewportStore';
import { screenToWorld } from './coords';
import { GridLayer } from './GridLayer';
import { ObjectsLayer } from './ObjectsLayer';
import { SelectionOverlay } from './SelectionOverlay';
import { snapEndpoint, snapMovement, snapWorldPoint, type EndpointAttach } from './snapping';
import { TANGENT_TOOL } from './tools';
import {
  computeRotationDrag,
  computeScaleDrag,
  computeScaleToProps,
  type HandleDir,
} from './transformMath';
import styles from './CanvasStage.module.css';

type DragState =
  | { mode: 'pan'; lastX: number; lastY: number }
  | { mode: 'move'; startWorld: Point; before: Record<string, Transform>; moved: boolean }
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
  | { mode: 'rotate'; id: string; before: Transform; moved: boolean }
  | {
      mode: 'endpoint';
      id: string;
      end: 0 | 1;
      before: Transform;
      beforeProps: Record<string, unknown>;
      plugin: AnyPlugin;
      /** 円拘束された線の端点(片側長さ変更モード) */
      constrained: boolean;
      moved: boolean;
    }
  | { mode: 'anchor'; id: string; targetId: string; beforeRefs: ObjectRef[]; moved: boolean }
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
  | { mode: 'place-line'; plugin: AnyPlugin; start: Point };

/** ドラッグ配置中のゴースト表示 */
interface PlacementPreview {
  plugin: AnyPlugin;
  props: Record<string, unknown>;
  transform: Transform;
}

interface Guides {
  x?: number;
  y?: number;
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
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [guides, setGuides] = useState<Guides>({});
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [preview, setPreview] = useState<PlacementPreview | null>(null);
  /** pick-segments 配置(角度マーク)で選択済みの線分ピック */
  const [segPicks, setSegPicks] = useState<SegmentPick[]>([]);
  /** 接線モードで先に選択した既存線分のID(省略可) */
  const [tangentLineId, setTangentLineId] = useState<string | null>(null);

  const pan = useViewportStore((s) => s.pan);
  const zoom = useViewportStore((s) => s.zoom);
  const activeTool = useToolStore((s) => s.activeTool);

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
        doc.removeObjects(doc.selection);
      } else if (e.key === 'Escape') {
        useToolStore.getState().setActiveTool('select');
        doc.clearSelection();
        setSegPicks([]);
        setTangentLineId(null);
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

  // ツールを切り替えたら進行中の線分ピック・接線対象を破棄する
  useEffect(() => {
    setSegPicks([]);
    setTangentLineId(null);
  }, [activeTool]);

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
    const { snapEnabled, gridSize } = useViewportStore.getState();
    const world = worldFromEvent(e);

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

      const position = snapEnabled ? snapPoint(world, gridSize) : world;
      if (plugin.placement === 'drag-line' && plugin.createFromDrag) {
        // ドラッグで始点→終点を決める。確定はpointerupで行う
        dragRef.current = { mode: 'place-line', plugin, start: position };
        setPreview({ plugin, ...plugin.createFromDrag(position, position) });
      } else {
        doc.addObject(createSceneObject(plugin, position, doc.nextZIndex));
        useToolStore.getState().setActiveTool('select');
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
          dragRef.current = { mode: 'rotate', id: obj.id, before: obj.transform, moved: false };
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
          dragRef.current = {
            mode: 'endpoint',
            id: obj.id,
            end,
            before: obj.transform,
            beforeProps: obj.props,
            plugin,
            constrained,
            moved: false,
          };
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
    dragRef.current = { mode: 'move', startWorld: world, before, moved: false };
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
    const { snapEnabled, gridSize, zoom } = useViewportStore.getState();

    if (drag.mode === 'move') {
      const snapped = snapMovement({
        rawDx: world.x - drag.startWorld.x,
        rawDy: world.y - drag.startWorld.y,
        movingBefore: drag.before,
        objects: doc.objects,
        registry: pluginRegistry,
        snapEnabled,
        gridSize,
        threshold: 6 / zoom,
      });
      const transforms: Record<string, Transform> = {};
      for (const [id, t] of Object.entries(drag.before)) {
        transforms[id] = { ...t, x: t.x + snapped.dx, y: t.y + snapped.dy };
      }
      doc.setTransformsTransient(transforms);
      setGuides({ x: snapped.guideX, y: snapped.guideY });
      drag.moved = true;
      return;
    }

    if (drag.mode === 'scale') {
      let point = world;
      let guideX: number | undefined;
      let guideY: number | undefined;
      // 回転済みオブジェクトはハンドルの移動軸がワールド軸と一致しないため、
      // ワールド軸に沿ったスナップは回転0のときだけ適用する
      if (drag.before.rotation === 0) {
        const snapped = snapWorldPoint({
          point: world,
          objects: doc.objects,
          registry: pluginRegistry,
          excludeIds: new Set([drag.id]),
          snapEnabled,
          gridSize,
          threshold: 6 / zoom,
          axisX: drag.handle.sx !== 0,
          axisY: drag.handle.sy !== 0,
        });
        point = snapped.point;
        guideX = snapped.guideX;
        guideY = snapped.guideY;
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
      setGuides({ x: guideX, y: guideY });
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
      const next = computeRotationDrag(drag.before, world, snapEnabled ? 15 : undefined);
      doc.setTransformsTransient({ [drag.id]: next });
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
    } else if (drag.mode === 'endpoint' && drag.moved) {
      // applyRefs対応(長さマーク等)が対象へ吸着していれば、追従バインドを作成
      const { snapEnabled, gridSize, zoom } = useViewportStore.getState();
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
      const { snapEnabled, gridSize } = useViewportStore.getState();
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
        {preview && (
          <g transform={transformToString(preview.transform)} opacity={0.5} pointerEvents="none">
            <preview.plugin.Renderer props={preview.props} transform={preview.transform} />
          </g>
        )}
        <SelectionOverlay />
        <g pointerEvents="none">
          {guides.x !== undefined && (
            <line
              x1={guides.x}
              y1={pan.y}
              x2={guides.x}
              y2={pan.y + viewHeight}
              stroke="#e0457b"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom} ${3 / zoom}`}
            />
          )}
          {guides.y !== undefined && (
            <line
              x1={pan.x}
              y1={guides.y}
              x2={pan.x + viewWidth}
              y2={guides.y}
              stroke="#e0457b"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom} ${3 / zoom}`}
            />
          )}
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
        </g>
      </svg>
    </div>
  );
}
