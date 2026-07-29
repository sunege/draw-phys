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
import type { AnyPlugin, EllipseGeometry } from '../core/plugin';
import type { PluginRegistry } from '../core/registry';
import type { ObjectRef, Point, Transform } from '../core/types';

export interface MoveSnapResult {
  dx: number;
  dy: number;
  /** 頂点同士が吸着した位置(マーカー表示用) */
  marker?: Point;
}

/**
 * 吸着候補の優先度。頂点(端点・角・中心)は辺・円周より優先する。
 * 端点の近くでは辺への垂線の足の方が常に近くなるため、距離だけで選ぶと
 * 「端点同士をぴったり合わせる」ができない(辺の上に少しずれて乗る)。
 */
const RANK_CURVE = 0;
const RANK_VERTEX = 1;

/** 頂点が辺上/円周上に乗っているとみなす許容誤差(同じtransformで算出するので誤差は浮動小数のみ) */
const ON_GEOMETRY_EPS = 1e-6;

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
  /** 吸着先が頂点(端点・角・中心)ならtrue(マーカー表示を変える) */
  vertex?: boolean;
  /** 吸着相手(線分/円)。長さマークなどの追従バインドに使う */
  attach?: EndpointAttach;
}

/**
 * 頂点へ吸着したときの追従バインド相手。長さマークなどは辺・円周に紐付くので、
 * その頂点が辺上/円周上に乗っていれば同じ相手を返す
 * (頂点優先にしても「線の端点へ吸着してバインドする」操作が失われないように)。
 */
function vertexAttach(
  plugin: AnyPlugin,
  props: unknown,
  transform: Transform,
  targetId: string,
  vertex: Point,
): EndpointAttach | undefined {
  const segs = plugin.getSegments?.(props);
  if (segs) {
    for (let i = 0; i < segs.length; i++) {
      const a = localToWorld(segs[i][0], transform);
      const b = localToWorld(segs[i][1], transform);
      if (distance(vertex, nearestPointOnSegment(vertex, a, b)) < ON_GEOMETRY_EPS) {
        return { targetId, kind: 'segment', segIndex: i };
      }
    }
  }
  const circle = plugin.getCircle?.(props);
  if (circle) {
    const center = localToWorld(circle.center, transform);
    const rw = Math.abs(circle.radius * transform.scaleX);
    if (Math.abs(distance(vertex, center) - rw) < ON_GEOMETRY_EPS) {
      const worldAngle = angleOfVector({ x: vertex.x - center.x, y: vertex.y - center.y });
      return { targetId, kind: 'circle', t: worldAngle - transform.rotation };
    }
  }
  return undefined;
}

/**
 * 端点ドラッグのスナップ。他オブジェクトのスナップ点(頂点)・線分上の最近点・円周上の最近点を
 * 候補にし、グリッド点より近ければオブジェクトへ吸着する(2次元の真の最近点。軸分解しない)。
 * **頂点はしきい値内なら辺・円周・グリッドより優先**する(端点同士をぴったり合わせるため)。
 * 吸着相手が線分/円なら attach に紐付け情報を返す(頂点でもその辺・円周を相手にする)。
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
  const holder: {
    best: { p: Point; dist: number; rank: number; attach?: EndpointAttach } | null;
  } = { best: null };
  // 優先度が高い候補(頂点)は遠くても勝つ。同順位では近い方、同距離なら attach 付きを優先する
  const consider = (p: Point, rank: number, attach?: EndpointAttach) => {
    const d = distance(point, p);
    if (d > threshold) return;
    const b = holder.best;
    if (!b || rank > b.rank || (rank === b.rank && (d < b.dist || (attach && d <= b.dist)))) {
      holder.best = { p, dist: d, rank, attach };
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
        consider(nearestPointOnSegment(point, a, b), RANK_CURVE, {
          targetId: id,
          kind: 'segment',
          segIndex,
        });
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
      consider(edge, RANK_CURVE, { targetId: id, kind: 'circle', t: worldAngle - obj.transform.rotation });
    }
    // 楕円周候補(位置のみ。楕円は半径が一意でなく長さマーク等の吸着相手にならないため attach なし)
    const ellipse = plugin?.getEllipse?.(obj.props);
    if (ellipse) consider(ellipseCurveCandidate(ellipse, obj.transform, point).point, RANK_CURVE);
    // 頂点(端点・角・中心)。辺・円周より優先し、乗っている辺・円周を attach にする
    if (plugin) {
      for (const p of worldSnapPoints(objects, registry, id, obj.transform)) {
        consider(p, RANK_VERTEX, vertexAttach(plugin, obj.props, obj.transform, id, p));
      }
    }
  }

  const { best } = holder;
  if (!gridEnabled) {
    if (best) {
      return { point: best.p, marker: best.p, vertex: best.rank === RANK_VERTEX, attach: best.attach };
    }
    return { point: { ...point } };
  }

  const gridPt = snapPoint(point, gridSize);
  const gridDist = distance(point, gridPt);
  // 頂点はしきい値内なら常にグリッドより優先(端点同士を厳密に合わせる)。
  // 辺・円周はグリッド点以下の距離のときだけ吸着する
  if (best && (best.rank === RANK_VERTEX || best.dist <= gridDist)) {
    return { point: best.p, marker: best.p, vertex: best.rank === RANK_VERTEX, attach: best.attach };
  }
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
  /** 吸着先が頂点(端点・角・中心)ならtrue(マーカー表示を変える) */
  vertex?: boolean;
  /** 吸着先(あれば接続。無ければ自由座標=point) */
  bind?: AnchorBind;
}

/**
 * 一致点(coincidentの基準点)ドラッグのスナップ。
 * 他オブジェクトのスナップ点(角・端点・中心)・線分上の最近点・円周上の最近点を候補にし、
 * グリッド点より近ければオブジェクトへ吸着して接続情報(bind)を返す。
 * スナップ点(角・中心)は同距離なら線分/円より優先し、しきい値内ならグリッドより優先する
 * (離散点の方が意味を持つ=頂点へ確実に接続させる)。
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
  // 頂点(離散スナップ点)はしきい値内なら常にグリッドより優先する(頂点へ確実に接続させる)
  if (best && (best.bind.kind === 'point' || best.dist <= gridDist)) {
    return { point: best.p, marker: best.p, vertex: best.bind.kind === 'point', bind: best.bind };
  }
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
 * 移動中のオブジェクトの頂点が、他オブジェクトの頂点の近くへ来ていれば
 * ぴったり重ねる移動量を返す(最も近い頂点ペアを採用)。近い組が無ければ null。
 */
function snapMovingVertices(params: {
  rawDx: number;
  rawDy: number;
  movingBefore: Record<string, Transform>;
  objects: SceneObjects;
  registry: PluginRegistry;
  threshold: number;
}): MoveSnapResult | null {
  const { rawDx, rawDy, movingBefore, objects, registry, threshold } = params;
  // 移動後の頂点(ワールド)
  const moved: Point[] = [];
  for (const [id, before] of Object.entries(movingBefore)) {
    const after = { ...before, x: before.x + rawDx, y: before.y + rawDy };
    moved.push(...worldSnapPoints(objects, registry, id, after));
  }
  if (!moved.length) return null;

  const holder: { best: { dx: number; dy: number; dist: number; marker: Point } | null } = {
    best: null,
  };
  for (const [id, obj] of Object.entries(objects)) {
    if (movingBefore[id] || !obj.visible) continue;
    for (const target of worldSnapPoints(objects, registry, id, obj.transform)) {
      for (const m of moved) {
        const d = distance(m, target);
        if (d > threshold) continue;
        if (!holder.best || d < holder.best.dist) {
          holder.best = {
            dx: rawDx + (target.x - m.x),
            dy: rawDy + (target.y - m.y),
            dist: d,
            marker: target,
          };
        }
      }
    }
  }
  const { best } = holder;
  return best ? { dx: best.dx, dy: best.dy, marker: best.marker } : null;
}

/**
 * 移動ドラッグのスナップ補正。相対配置を保ったまま移動量を全選択オブジェクトへ一様に適用する。
 * objects/registry/threshold を渡すと、まず移動側の頂点と他オブジェクトの頂点が重なる補正を試し
 * (端点同士をぴったり合わせる)、近い頂点ペアが無ければ先頭オブジェクト基準のグリッドへ丸める。
 */
export function snapMovement(params: {
  rawDx: number;
  rawDy: number;
  movingBefore: Record<string, Transform>;
  snapEnabled: boolean;
  gridSize: number;
  /** 頂点スナップ用(省略時はグリッドのみ) */
  objects?: SceneObjects;
  registry?: PluginRegistry;
  threshold?: number;
}): MoveSnapResult {
  const { rawDx, rawDy, movingBefore, snapEnabled, gridSize, objects, registry, threshold } = params;
  if (!snapEnabled) return { dx: rawDx, dy: rawDy };

  if (objects && registry && threshold != null) {
    const vertex = snapMovingVertices({ rawDx, rawDy, movingBefore, objects, registry, threshold });
    if (vertex) return vertex;
  }

  const result: MoveSnapResult = { dx: rawDx, dy: rawDy };
  // グリッドスナップは先頭オブジェクトの位置を基準に、相対配置を保ったまま補正する
  const primary = Object.values(movingBefore)[0];
  if (primary) {
    result.dx = snapValue(primary.x + rawDx, gridSize) - primary.x;
    result.dy = snapValue(primary.y + rawDy, gridSize) - primary.y;
  }
  return result;
}
