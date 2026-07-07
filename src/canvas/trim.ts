import type { SceneObject, SceneObjects } from '../core/document';
import { angleOfVector, localToWorld, normalizeAngle360 } from '../core/geometry';
import type { AnyPlugin, EdgePick, TrimKeep } from '../core/plugin';
import type { PluginRegistry } from '../core/registry';
import type { Point } from '../core/types';
import {
  bracketCyclic,
  bracketLinear,
  circleCircle,
  ellipseParamAngle,
  pointOnArc,
  pointOnEllipticalArc,
  projectSegmentT,
  segmentCircle,
  segmentEllipse,
  segmentSegment,
} from './trimMath';

/** 交点計算に使うワールド座標の曲線(切断相手・クリック対象共通) */
type WorldCurve =
  | { kind: 'segment'; a: Point; b: Point }
  | { kind: 'circle'; center: Point; radius: number; rotation: number; start?: number; end?: number }
  | {
      kind: 'ellipse';
      center: Point;
      radiusX: number;
      radiusY: number;
      rotation: number;
      start?: number;
      end?: number;
    };

/** オブジェクトの getSegments / getCircle をワールド座標の曲線群に変換する */
function objectWorldCurves(obj: SceneObject, plugin: AnyPlugin): WorldCurve[] {
  const curves: WorldCurve[] = [];
  const segs = plugin.getSegments?.(obj.props);
  if (segs) {
    for (const s of segs) {
      curves.push({
        kind: 'segment',
        a: localToWorld(s[0], obj.transform),
        b: localToWorld(s[1], obj.transform),
      });
    }
  }
  const c = plugin.getCircle?.(obj.props);
  if (c) {
    const center = localToWorld(c.center, obj.transform);
    const edge = localToWorld({ x: c.center.x + c.radius, y: c.center.y }, obj.transform);
    curves.push({
      kind: 'circle',
      center,
      radius: Math.hypot(edge.x - center.x, edge.y - center.y),
      rotation: obj.transform.rotation,
      start: c.startAngle,
      end: c.endAngle,
    });
  }
  const e = plugin.getEllipse?.(obj.props);
  if (e) {
    const center = localToWorld(e.center, obj.transform);
    const edgeX = localToWorld({ x: e.center.x + e.radiusX, y: e.center.y }, obj.transform);
    const edgeY = localToWorld({ x: e.center.x, y: e.center.y + e.radiusY }, obj.transform);
    curves.push({
      kind: 'ellipse',
      center,
      radiusX: Math.hypot(edgeX.x - center.x, edgeX.y - center.y),
      radiusY: Math.hypot(edgeY.x - center.x, edgeY.y - center.y),
      rotation: obj.transform.rotation,
      start: e.startAngle,
      end: e.endAngle,
    });
  }
  return curves;
}

/** クリック対象以外の可視オブジェクトの全曲線(切断相手) */
function collectCutters(objects: SceneObjects, registry: PluginRegistry, clickedId: string): WorldCurve[] {
  const cutters: WorldCurve[] = [];
  for (const obj of Object.values(objects)) {
    if (obj.id === clickedId || !obj.visible) continue;
    const plugin = registry.get(obj.pluginId);
    if (plugin) cutters.push(...objectWorldCurves(obj, plugin));
  }
  return cutters;
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/**
 * 円/楕円(cyclicまたは既存円弧/楕円弧)を、収集した交点角度とクリック角度から
 * 残す区間(TrimKeep[])へ解決する。円ブランチ・楕円ブランチ共通(角度の意味だけが違う)。
 */
function resolveArcKeeps(
  angles: number[],
  clickAngle: number,
  hasRange: boolean,
  start: number | undefined,
  sweepAll: number,
): TrimKeep[] | null {
  if (!hasRange || sweepAll >= 359.999) {
    // 完全な円/楕円: cyclic。2交点以上必要。残すのは削除ギャップの補角
    if (angles.length < 2) return null;
    const removal = bracketCyclic(angles, clickAngle);
    if (!removal) return null;
    const [lo, hi] = removal;
    // 残すのは削除ギャップ(増加方向 lo→hi)の補角 = 増加方向 hi→lo
    return [{ kind: 'arc', fromDeg: hi, toDeg: lo }];
  }

  // 円弧/楕円弧: 掃引範囲[start, start+sweep]を「巻き戻さない」座標に展開して線形処理
  const s = start!;
  const us = angles
    .map((a) => s + normalizeAngle360(a - s))
    .filter((u) => u <= s + sweepAll + 1e-3);
  const interior = us.filter((u) => u > s + 1e-4 && u < s + sweepAll - 1e-4);
  if (interior.length === 0) return null;
  const clickU = s + normalizeAngle360(clickAngle - s);
  const removal = bracketLinear([s, s + sweepAll, ...interior], clickU);
  if (!removal) return null;
  const [lo, hi] = removal;
  const keeps: TrimKeep[] = [];
  if (lo - s > 1e-4) keeps.push({ kind: 'arc', fromDeg: s, toDeg: lo });
  if (s + sweepAll - hi > 1e-4) keeps.push({ kind: 'arc', fromDeg: hi, toDeg: s + sweepAll });
  return keeps;
}

/**
 * トリムで残す区間(TrimKeep[])を算出する。トリムできなければ null。
 * クリック曲線と全切断相手の交点を求め、クリック位置を挟む区間を削除する。
 * 交点が無い(境界を作れない)場合は null(no-op)。
 */
export function computeTrimKeeps(
  objects: SceneObjects,
  registry: PluginRegistry,
  clickedId: string,
  world: Point,
  pick: EdgePick,
): TrimKeep[] | null {
  const clicked = objects[clickedId];
  const clickedPlugin = clicked && registry.get(clicked.pluginId);
  if (!clicked || !clickedPlugin) return null;
  const cutters = collectCutters(objects, registry, clickedId);

  // クリックした線分をトリム
  if (pick.kind === 'segment') {
    const seg = clickedPlugin.getSegments?.(clicked.props)?.[pick.segIndex];
    if (!seg) return null;
    const A = localToWorld(seg[0], clicked.transform);
    const B = localToWorld(seg[1], clicked.transform);
    const clickT = clamp01(projectSegmentT(world, A, B));
    const params: number[] = [];
    for (const cut of cutters) {
      if (cut.kind === 'segment') {
        const p = segmentSegment(A, B, cut.a, cut.b);
        if (p) params.push(projectSegmentT(p, A, B));
      } else if (cut.kind === 'circle') {
        for (const p of segmentCircle(A, B, cut.center, cut.radius)) {
          if (
            cut.start != null &&
            cut.end != null &&
            !pointOnArc(cut.center, cut.rotation, cut.start, cut.end, p)
          ) {
            continue;
          }
          params.push(projectSegmentT(p, A, B));
        }
      } else {
        for (const p of segmentEllipse(A, B, cut.center, cut.radiusX, cut.radiusY, cut.rotation)) {
          if (
            cut.start != null &&
            cut.end != null &&
            !pointOnEllipticalArc(cut.center, cut.radiusX, cut.radiusY, cut.rotation, cut.start, cut.end, p)
          ) {
            continue;
          }
          params.push(projectSegmentT(p, A, B));
        }
      }
    }
    const interior = params.filter((t) => t > 1e-4 && t < 1 - 1e-4);
    if (interior.length === 0) return null; // 切断相手なし
    const removal = bracketLinear([0, 1, ...interior], clickT);
    if (!removal) return null;
    const [lo, hi] = removal;
    const keeps: TrimKeep[] = [];
    if (lo > 1e-4) keeps.push({ kind: 'segment', from: 0, to: lo });
    if (hi < 1 - 1e-4) keeps.push({ kind: 'segment', from: hi, to: 1 });
    return keeps;
  }

  // クリックした円/円弧をトリム
  if (pick.kind === 'circle') {
    const circle = clickedPlugin.getCircle?.(clicked.props);
    if (!circle) return null;
    const center = localToWorld(circle.center, clicked.transform);
    const edge = localToWorld({ x: circle.center.x + circle.radius, y: circle.center.y }, clicked.transform);
    const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
    const rotation = clicked.transform.rotation;
    const hasRange = circle.startAngle != null && circle.endAngle != null;
    const sweepAll = hasRange ? normalizeAngle360(circle.endAngle! - circle.startAngle!) || 360 : 360;
    const isArc = hasRange && sweepAll < 359.999;

    // 交点をクリック対象ローカルの角度で集める
    const angles: number[] = [];
    for (const cut of cutters) {
      const pts =
        cut.kind === 'segment'
          ? segmentCircle(cut.a, cut.b, center, radius)
          : cut.kind === 'circle'
            ? circleCircle(center, radius, cut.center, cut.radius)
            : []; // 楕円カッターは対象外(交点なし扱い)
      for (const p of pts) {
        if (isArc && !pointOnArc(center, rotation, circle.startAngle!, circle.endAngle!, p)) continue;
        if (
          cut.kind === 'circle' &&
          cut.start != null &&
          cut.end != null &&
          !pointOnArc(cut.center, cut.rotation, cut.start, cut.end, p)
        ) {
          continue;
        }
        angles.push(angleOfVector({ x: p.x - center.x, y: p.y - center.y }) - rotation);
      }
    }
    return resolveArcKeeps(angles, pick.t, hasRange, circle.startAngle, sweepAll);
  }

  // クリックした楕円/楕円弧をトリム(カッターは線分系オブジェクトのみ対応)
  const ellipse = clickedPlugin.getEllipse?.(clicked.props);
  if (!ellipse) return null;
  const center = localToWorld(ellipse.center, clicked.transform);
  const edgeX = localToWorld({ x: ellipse.center.x + ellipse.radiusX, y: ellipse.center.y }, clicked.transform);
  const edgeY = localToWorld({ x: ellipse.center.x, y: ellipse.center.y + ellipse.radiusY }, clicked.transform);
  const radiusX = Math.hypot(edgeX.x - center.x, edgeX.y - center.y);
  const radiusY = Math.hypot(edgeY.x - center.x, edgeY.y - center.y);
  const rotation = clicked.transform.rotation;
  const hasRange = ellipse.startAngle != null && ellipse.endAngle != null;
  const sweepAll = hasRange ? normalizeAngle360(ellipse.endAngle! - ellipse.startAngle!) || 360 : 360;
  const isArc = hasRange && sweepAll < 359.999;

  const angles: number[] = [];
  for (const cut of cutters) {
    if (cut.kind !== 'segment') continue; // 円・楕円カッターは対応スコープ外
    for (const p of segmentEllipse(cut.a, cut.b, center, radiusX, radiusY, rotation)) {
      if (
        isArc &&
        !pointOnEllipticalArc(center, radiusX, radiusY, rotation, ellipse.startAngle!, ellipse.endAngle!, p)
      ) {
        continue;
      }
      angles.push(ellipseParamAngle(center, radiusX, radiusY, rotation, p));
    }
  }
  return resolveArcKeeps(angles, pick.t, hasRange, ellipse.startAngle, sweepAll);
}
