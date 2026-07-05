import type { SceneObjects } from '../core/document';
import {
  angleOfVector,
  distance,
  localToWorld,
  nearestPointOnSegment,
  rectCorners,
  snapPoint,
  snapValue,
} from '../core/geometry';
import type { PluginRegistry } from '../core/registry';
import type { ObjectRef, Point, Transform } from '../core/types';

export interface MoveSnapResult {
  dx: number;
  dy: number;
}

/** オブジェクトのスナップ点をワールド座標で列挙する */
function worldSnapPoints(
  objects: SceneObjects,
  registry: PluginRegistry,
  id: string,
  transform: Transform,
): Point[] {
  const obj = objects[id];
  if (!obj) return [];
  const plugin = registry.get(obj.pluginId);
  if (!plugin) return [];
  const bounds = plugin.getBounds(obj.props);
  const locals = plugin.getSnapPoints?.(obj.props) ?? [
    ...rectCorners(bounds),
    { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
  ];
  return locals.map((p) => localToWorld(p, transform));
}


/** 端点吸着時に、吸着相手オブジェクトへ紐付けるための情報 */
export type EndpointAttach = Pick<ObjectRef, 'targetId' | 'kind' | 'segIndex' | 't'>;

export interface EndpointSnapResult {
  point: Point;
  /** オブジェクトへ吸着したときの位置(マーカー表示用) */
  marker?: Point;
  /** 吸着相手(線分/円)。長さマークなどの追従バインドに使う */
  attach?: EndpointAttach;
}

/**
 * 端点ドラッグのスナップ。他オブジェクトのスナップ点・線分上の最近点・円周上の最近点を候補にし、
 * グリッド点より近ければオブジェクトへ吸着する(2次元の真の最近点。軸分解しない)。
 * 吸着相手が線分/円なら attach に紐付け情報を返す。
 */
export function snapEndpoint(params: {
  point: Point;
  objects: SceneObjects;
  registry: PluginRegistry;
  excludeIds: Set<string>;
  snapEnabled: boolean;
  gridSize: number;
  threshold: number;
}): EndpointSnapResult {
  const { point, objects, registry, excludeIds, snapEnabled, gridSize, threshold } = params;
  if (!snapEnabled) return { point: { ...point } };

  // クロージャからの代入で外側変数がnarrowされないよう、ホルダ経由で保持する
  const holder: { best: { p: Point; dist: number; attach?: EndpointAttach } | null } = { best: null };
  // attach付き候補は同距離でも吸着相手を優先するため <= で上書き、無印は < のみ
  const consider = (p: Point, attach?: EndpointAttach) => {
    const d = distance(point, p);
    if (d > threshold) return;
    if (!holder.best || d < holder.best.dist || (attach && d <= holder.best.dist)) {
      holder.best = { p, dist: d, attach };
    }
  };

  for (const [id, obj] of Object.entries(objects)) {
    if (excludeIds.has(id) || !obj.visible) continue;
    const plugin = registry.get(obj.pluginId);
    // 線分候補(吸着相手として segIndex を記録)
    const segs = plugin?.getSegments?.(obj.props);
    if (segs) {
      segs.forEach((seg, segIndex) => {
        const a = localToWorld(seg[0], obj.transform);
        const b = localToWorld(seg[1], obj.transform);
        consider(nearestPointOnSegment(point, a, b), { targetId: id, kind: 'segment', segIndex });
      });
    }
    // 円周候補(ローカル角度 t を記録)
    const circle = plugin?.getCircle?.(obj.props);
    if (circle) {
      const center = localToWorld(circle.center, obj.transform);
      const dir = { x: point.x - center.x, y: point.y - center.y };
      const worldAngle = angleOfVector(dir);
      const rw = circle.radius * obj.transform.scaleX;
      const edge = {
        x: center.x + rw * (dir.x / (Math.hypot(dir.x, dir.y) || 1)),
        y: center.y + rw * (dir.y / (Math.hypot(dir.x, dir.y) || 1)),
      };
      consider(edge, { targetId: id, kind: 'circle', t: worldAngle - obj.transform.rotation });
    }
    // 通常のスナップ点(端点・中心など。attachなし)
    for (const p of worldSnapPoints(objects, registry, id, obj.transform)) consider(p);
  }

  const gridPt = snapPoint(point, gridSize);
  const gridDist = distance(point, gridPt);
  const { best } = holder;
  // オブジェクト候補がグリッド点以下の距離なら、グリッド外でもオブジェクトへ吸着する
  if (best && best.dist <= gridDist) return { point: best.p, marker: best.p, attach: best.attach };
  return { point: gridPt };
}

export interface PointSnapResult {
  point: Point;
}

/**
 * 単一のワールド座標点(スケールハンドル位置など)をグリッドへ吸着する。
 * axisX / axisY で吸着対象の軸を絞る(辺ハンドルは片軸のみ)。
 */
export function snapWorldPoint(params: {
  point: Point;
  snapEnabled: boolean;
  gridSize: number;
  axisX: boolean;
  axisY: boolean;
}): PointSnapResult {
  const { point, snapEnabled, gridSize, axisX, axisY } = params;
  if (!snapEnabled) return { point: { ...point } };

  const result: PointSnapResult = { point: { ...point } };
  if (axisX) result.point.x = snapValue(point.x, gridSize);
  if (axisY) result.point.y = snapValue(point.y, gridSize);
  return result;
}

/**
 * 移動ドラッグのスナップ補正。先頭オブジェクトの位置を基準にグリッドへスナップし、
 * 相対配置を保ったまま移動量を全選択オブジェクトへ一様に適用する。
 */
export function snapMovement(params: {
  rawDx: number;
  rawDy: number;
  movingBefore: Record<string, Transform>;
  snapEnabled: boolean;
  gridSize: number;
}): MoveSnapResult {
  const { rawDx, rawDy, movingBefore, snapEnabled, gridSize } = params;
  if (!snapEnabled) return { dx: rawDx, dy: rawDy };

  const result: MoveSnapResult = { dx: rawDx, dy: rawDy };
  // グリッドスナップは先頭オブジェクトの位置を基準に、相対配置を保ったまま補正する
  const primary = Object.values(movingBefore)[0];
  if (primary) {
    result.dx = snapValue(primary.x + rawDx, gridSize) - primary.x;
    result.dy = snapValue(primary.y + rawDy, gridSize) - primary.y;
  }
  return result;
}
