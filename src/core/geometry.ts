import type { Point, Rect, Transform } from './types';

const DEG_TO_RAD = Math.PI / 180;

/** SVGのtransform属性文字列を生成する */
export function transformToString(t: Transform): string {
  return `translate(${t.x} ${t.y}) rotate(${t.rotation}) scale(${t.scaleX} ${t.scaleY})`;
}

/** ベクトルを回転する(度) */
export function rotateVec(v: Point, deg: number): Point {
  const rad = deg * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** ローカル座標の点をワールド座標へ変換する */
export function localToWorld(p: Point, t: Transform): Point {
  const sx = p.x * t.scaleX;
  const sy = p.y * t.scaleY;
  const rad = t.rotation * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: t.x + sx * cos - sy * sin,
    y: t.y + sx * sin + sy * cos,
  };
}

/** ワールド座標の点をローカル座標へ変換する(localToWorldの逆変換) */
export function worldToLocal(p: Point, t: Transform): Point {
  const v = rotateVec({ x: p.x - t.x, y: p.y - t.y }, -t.rotation);
  return { x: v.x / t.scaleX, y: v.y / t.scaleY };
}

/** 矩形の4隅 */
export function rectCorners(r: Rect): [Point, Point, Point, Point] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
}

/** ローカルバウンディングボックスをワールド座標の軸平行矩形(AABB)へ変換する */
export function worldBounds(localBounds: Rect, t: Transform): Rect {
  const corners = rectCorners(localBounds).map((p) => localToWorld(p, t));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/** 複数矩形を包含する矩形。空配列ならnull */
export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 線分 a-b 上で点 p に最も近い点(端点でクランプ) */
export function nearestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

/** ベクトルの向き(度)。0=+x方向、画面下向き系で増加方向=時計回り */
export function angleOfVector(v: Point): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}

/** 中心・半径・角度(度)から円周上の点 */
export function pointOnCircleAtAngle(center: Point, radius: number, deg: number): Point {
  const rad = deg * DEG_TO_RAD;
  return { x: center.x + radius * Math.cos(rad), y: center.y + radius * Math.sin(rad) };
}

/**
 * 2直線(a1-a2 と b1-b2 を通る無限直線)の交点。平行ならnull。
 * 線分ではなく直線として扱う(角度マークの頂点算出に使う)。
 */
export function lineLineIntersection(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): Point | null {
  const d1x = a2.x - a1.x;
  const d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x;
  const d2y = b2.y - b1.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
  return { x: a1.x + d1x * t, y: a1.y + d1y * t };
}

/** 角度を[0,360)へ正規化する */
export function normalizeAngle360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** 角度を(-180,180]へ正規化する */
export function normalizeAngle180(deg: number): number {
  const x = normalizeAngle360(deg);
  return x > 180 ? x - 360 : x;
}

export function snapValue(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPoint(p: Point, gridSize: number): Point {
  return { x: snapValue(p.x, gridSize), y: snapValue(p.y, gridSize) };
}
