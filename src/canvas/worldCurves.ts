import type { SceneObject } from '../core/document';
import { localToWorld } from '../core/geometry';
import type { AnyPlugin } from '../core/plugin';
import type { Point } from '../core/types';
import {
  circleCircle,
  circleEllipse,
  ellipseEllipse,
  pointOnArc,
  pointOnEllipticalArc,
  segmentCircle,
  segmentEllipse,
  segmentSegment,
} from './trimMath';

/** 交点計算に使うワールド座標の曲線(切断相手・クリック対象共通) */
export type WorldCurve =
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
export function objectWorldCurves(obj: SceneObject, plugin: AnyPlugin): WorldCurve[] {
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

/** カッターが円弧/楕円弧のとき、交点pがその角度範囲内にあるか(全円/全楕円/線分は常にtrue) */
export function cutterInRange(cut: WorldCurve, p: Point): boolean {
  if (cut.kind === 'circle' && cut.start != null && cut.end != null) {
    return pointOnArc(cut.center, cut.rotation, cut.start, cut.end, p);
  }
  if (cut.kind === 'ellipse' && cut.start != null && cut.end != null) {
    return pointOnEllipticalArc(cut.center, cut.radiusX, cut.radiusY, cut.rotation, cut.start, cut.end, p);
  }
  return true;
}

/** 線分AB × カッター曲線 の交点(ワールド, 角度範囲チェック前) */
export function segmentCutterPoints(a: Point, b: Point, cut: WorldCurve): Point[] {
  if (cut.kind === 'segment') {
    const p = segmentSegment(a, b, cut.a, cut.b);
    return p ? [p] : [];
  }
  if (cut.kind === 'circle') return segmentCircle(a, b, cut.center, cut.radius);
  return segmentEllipse(a, b, cut.center, cut.radiusX, cut.radiusY, cut.rotation);
}

/** 円(center, radius) × カッター曲線 の交点(ワールド, 角度範囲チェック前) */
export function circleCutterPoints(center: Point, radius: number, cut: WorldCurve): Point[] {
  if (cut.kind === 'segment') return segmentCircle(cut.a, cut.b, center, radius);
  if (cut.kind === 'circle') return circleCircle(center, radius, cut.center, cut.radius);
  return circleEllipse(center, radius, cut.center, cut.radiusX, cut.radiusY, cut.rotation);
}

/** 楕円(center, radiusX, radiusY, rotation) × カッター曲線 の交点(ワールド, 角度範囲チェック前) */
export function ellipseCutterPoints(
  center: Point,
  radiusX: number,
  radiusY: number,
  rotation: number,
  cut: WorldCurve,
): Point[] {
  if (cut.kind === 'segment') return segmentEllipse(cut.a, cut.b, center, radiusX, radiusY, rotation);
  if (cut.kind === 'circle') return circleEllipse(cut.center, cut.radius, center, radiusX, radiusY, rotation);
  return ellipseEllipse(
    center,
    radiusX,
    radiusY,
    rotation,
    cut.center,
    cut.radiusX,
    cut.radiusY,
    cut.rotation,
  );
}

