import { localSnapPoints } from '../core/constraints';
import type { SceneObject, SceneObjects } from '../core/document';
import {
  angleOfVector,
  distance,
  localToWorld,
  nearestPointOnSegment,
  pointOnEllipseAtParam,
  rectCorners,
  snapPoint,
  snapValue,
  worldToLocal,
} from '../core/geometry';
import type { EllipseGeometry } from '../core/plugin';
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


/**
 * 楕円周上で、ワールド点 point に対応するスナップ候補(ワールド点+局所媒介変数角度t)。
 * u空間(楕円→単位円)で放射投影する: 対象ローカルへ移してから軸ごとに rx/ry で割った
 * 向きの角度を t とし、その t の楕円周点をワールドへ戻す。回転・非一様スケールも
 * transform 経由で正しく反映される。点が楕円上にあれば厳密に同じ点へ戻る。
 */
function ellipseCurveCandidate(
  ellipse: EllipseGeometry,
  transform: Transform,
  point: Point,
): { point: Point; t: number } {
  const local = worldToLocal(point, transform);
  const dir = { x: (local.x - ellipse.center.x) / ellipse.radiusX, y: (local.y - ellipse.center.y) / ellipse.radiusY };
  const t = angleOfVector(dir);
  const off = pointOnEllipseAtParam(ellipse.radiusX, ellipse.radiusY, t);
  return {
    point: localToWorld({ x: ellipse.center.x + off.x, y: ellipse.center.y + off.y }, transform),
    t,
  };
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
  /** falseならグリッドへのスナップを無効化し、他オブジェクトへのスナップのみ行う(既定true) */
  gridEnabled?: boolean;
}): EndpointSnapResult {
  const { point, objects, registry, excludeIds, snapEnabled, gridSize, threshold, gridEnabled = true } =
    params;
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
    // 楕円周候補(位置のみ。楕円は半径が一意でなく長さマーク等の吸着相手にならないため attach なし)
    const ellipse = plugin?.getEllipse?.(obj.props);
    if (ellipse) consider(ellipseCurveCandidate(ellipse, obj.transform, point).point);
    // 通常のスナップ点(端点・中心など。attachなし)
    for (const p of worldSnapPoints(objects, registry, id, obj.transform)) consider(p);
  }

  if (!gridEnabled) {
    const { best } = holder;
    if (best) return { point: best.p, marker: best.p, attach: best.attach };
    return { point: { ...point } };
  }

  const gridPt = snapPoint(point, gridSize);
  const gridDist = distance(point, gridPt);
  const { best } = holder;
  // オブジェクト候補がグリッド点以下の距離なら、グリッド外でもオブジェクトへ吸着する
  if (best && best.dist <= gridDist) return { point: best.p, marker: best.p, attach: best.attach };
  return { point: gridPt };
}

/** 一致拘束の基準点を吸着したときの接続先(kind 別) */
export type AnchorBind =
  | { targetId: string; kind: 'point'; pointIndex: number }
  | { targetId: string; kind: 'segment'; segIndex: number; t: number }
  | { targetId: string; kind: 'circle'; t: number }
  | { targetId: string; kind: 'ellipse'; t: number };

export interface AnchorSnapResult {
  point: Point;
  /** オブジェクトへ吸着したときの位置(マーカー表示用) */
  marker?: Point;
  /** 吸着先(あれば接続。無ければ自由座標=point) */
  bind?: AnchorBind;
}

/**
 * 一致点(coincidentの基準点)ドラッグのスナップ。
 * 他オブジェクトのスナップ点(角・端点・中心)・線分上の最近点・円周上の最近点を候補にし、
 * グリッド点より近ければオブジェクトへ吸着して接続情報(bind)を返す。
 * スナップ点(角・中心)は同距離なら線分/円より優先する(離散点の方が意味を持つ)。
 * スナップ無効なら生の点(自由座標)を返す。
 */
export function snapAnchorPoint(params: {
  point: Point;
  objects: SceneObjects;
  registry: PluginRegistry;
  excludeIds: Set<string>;
  snapEnabled: boolean;
  gridSize: number;
  threshold: number;
}): AnchorSnapResult {
  const { point, objects, registry, excludeIds, snapEnabled, gridSize, threshold } = params;
  if (!snapEnabled) return { point: { ...point } };

  const holder: { best: { p: Point; dist: number; bind: AnchorBind } | null } = { best: null };
  // 離散スナップ点(kind:'point')は同距離で優先させるため <= 、線分/円は < のみ
  const consider = (p: Point, bind: AnchorBind, prefer = false) => {
    const d = distance(point, p);
    if (d > threshold) return;
    if (!holder.best || d < holder.best.dist || (prefer && d <= holder.best.dist)) {
      holder.best = { p, dist: d, bind };
    }
  };

  for (const [id, obj] of Object.entries(objects)) {
    if (excludeIds.has(id) || !obj.visible) continue;
    const plugin = registry.get(obj.pluginId);
    if (!plugin) continue;
    // 離散スナップ点(角・端点・中心)。localSnapPoints の並びは resolveRef と共有する
    localSnapPoints(plugin, obj.props).forEach((local, index) => {
      consider(localToWorld(local, obj.transform), { targetId: id, kind: 'point', pointIndex: index }, true);
    });
    // 線分上の最近点(パラメタ t を記録)
    plugin.getSegments?.(obj.props)?.forEach((seg, segIndex) => {
      const a = localToWorld(seg[0], obj.transform);
      const b = localToWorld(seg[1], obj.transform);
      const near = nearestPointOnSegment(point, a, b);
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const t = len2 < 1e-9 ? 0 : ((near.x - a.x) * (b.x - a.x) + (near.y - a.y) * (b.y - a.y)) / len2;
      consider(near, { targetId: id, kind: 'segment', segIndex, t });
    });
    // 円周上の最近点(局所角度 t を記録)
    const circle = plugin.getCircle?.(obj.props);
    if (circle) {
      const center = localToWorld(circle.center, obj.transform);
      const dir = { x: point.x - center.x, y: point.y - center.y };
      const rw = circle.radius * obj.transform.scaleX;
      const norm = Math.hypot(dir.x, dir.y) || 1;
      const edge = { x: center.x + rw * (dir.x / norm), y: center.y + rw * (dir.y / norm) };
      consider(edge, { targetId: id, kind: 'circle', t: angleOfVector(dir) - obj.transform.rotation });
    }
    // 楕円周上の最近点(局所媒介変数角度 t を記録)
    const ellipse = plugin.getEllipse?.(obj.props);
    if (ellipse) {
      const cand = ellipseCurveCandidate(ellipse, obj.transform, point);
      consider(cand.point, { targetId: id, kind: 'ellipse', t: cand.t });
    }
  }

  const gridPt = snapPoint(point, gridSize);
  const gridDist = distance(point, gridPt);
  const { best } = holder;
  if (best && best.dist <= gridDist) return { point: best.p, marker: best.p, bind: best.bind };
  return { point: gridPt };
}

/**
 * 一致点(coincidentの基準点)を、指定した対象オブジェクトの幾何上へ投影する。
 * snapAnchorPoint と違い対象1つに限定し、しきい値なしの最近点を必ず返す
 * (=一致点のドラッグがオブジェクトの外へ出ない)。グリッド・自由座標へは落ちない。
 * 線分・円周は連続投影、離散スナップ点(角・端点・中心)は threshold 内なら優先する。
 */
export function projectAnchorPoint(params: {
  point: Point;
  target: SceneObject;
  registry: PluginRegistry;
  /** 離散スナップ点を線分/円より優先する距離 */
  threshold: number;
}): { point: Point; bind: AnchorBind } | null {
  const { point, target, registry, threshold } = params;
  const plugin = registry.get(target.pluginId);
  if (!plugin) return null;

  const holder: { best: { p: Point; dist: number; bind: AnchorBind } | null } = { best: null };
  const consider = (p: Point, bind: AnchorBind) => {
    const d = distance(point, p);
    if (!holder.best || d < holder.best.dist) holder.best = { p, dist: d, bind };
  };
  // 線分上の最近点
  plugin.getSegments?.(target.props)?.forEach((seg, segIndex) => {
    const a = localToWorld(seg[0], target.transform);
    const b = localToWorld(seg[1], target.transform);
    const near = nearestPointOnSegment(point, a, b);
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t = len2 < 1e-9 ? 0 : ((near.x - a.x) * (b.x - a.x) + (near.y - a.y) * (b.y - a.y)) / len2;
    consider(near, { targetId: target.id, kind: 'segment', segIndex, t });
  });
  // 円周上の最近点
  const circle = plugin.getCircle?.(target.props);
  if (circle) {
    const center = localToWorld(circle.center, target.transform);
    const dir = { x: point.x - center.x, y: point.y - center.y };
    const rw = circle.radius * Math.abs(target.transform.scaleX);
    const norm = Math.hypot(dir.x, dir.y) || 1;
    const edge = { x: center.x + rw * (dir.x / norm), y: center.y + rw * (dir.y / norm) };
    consider(edge, { targetId: target.id, kind: 'circle', t: angleOfVector(dir) - target.transform.rotation });
  }
  // 楕円周上の最近点(局所媒介変数角度 t を記録)
  const ellipse = plugin.getEllipse?.(target.props);
  if (ellipse) {
    const cand = ellipseCurveCandidate(ellipse, target.transform, point);
    consider(cand.point, { targetId: target.id, kind: 'ellipse', t: cand.t });
  }
  // 離散スナップ点: threshold 内なら優先、連続候補が無いオブジェクトでは無条件の最近点
  const discrete: { best: { p: Point; dist: number; bind: AnchorBind } | null } = { best: null };
  localSnapPoints(plugin, target.props).forEach((local, index) => {
    const p = localToWorld(local, target.transform);
    const d = distance(point, p);
    if (!discrete.best || d < discrete.best.dist) {
      discrete.best = { p, dist: d, bind: { targetId: target.id, kind: 'point', pointIndex: index } };
    }
  });
  const d = discrete.best;
  if (d && (d.dist <= threshold || !holder.best)) return { point: d.p, bind: d.bind };
  const { best } = holder;
  return best ? { point: best.p, bind: best.bind } : null;
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
