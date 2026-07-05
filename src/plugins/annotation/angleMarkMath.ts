import { angleOfVector, lineLineIntersection, pointOnCircleAtAngle } from '../../core/geometry';
import type { ResolvedRef, SegmentPick } from '../../core/plugin';
import type { ObjectRef, Point } from '../../core/types';

/** 角度差を (-180, 180] へ正規化した符号付き掃引角 */
export function normalizeSweep(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/** 掃引角が直角(±90°)とみなせるか。tol は許容誤差(度) */
export function isRightAngle(sweep: number, tol = 0.5): boolean {
  return Math.abs(Math.abs(normalizeSweep(sweep)) - 90) <= tol;
}

/**
 * 直角マーク(正方形コーナー)の3点。頂点=原点、start方向と start+sweep 方向に
 * 一辺 size の正方形の角を作る。返り値は [腕A上の点, コーナー, 腕B上の点]。
 * コーナーは2腕の内側(角の内部)を向く。
 */
export function rightAnglePoints(
  size: number,
  startDeg: number,
  sweepDeg: number,
): [Point, Point, Point] {
  const p1 = pointOnCircleAtAngle({ x: 0, y: 0 }, size, startDeg);
  const p2 = pointOnCircleAtAngle({ x: 0, y: 0 }, size, startDeg + sweepDeg);
  return [p1, { x: p1.x + p2.x, y: p1.y + p2.y }, p2];
}

/** 1つの線分ピックから、頂点を基準にした腕の外向き方向と符号(mode)を求める */
function armDir(pick: SegmentPick, vertex: Point): { dir: Point; sign: 'pos' | 'neg' } {
  const seg = { x: pick.b.x - pick.a.x, y: pick.b.y - pick.a.y };
  const toClick = { x: pick.worldPoint.x - vertex.x, y: pick.worldPoint.y - vertex.y };
  const dot = seg.x * toClick.x + seg.y * toClick.y;
  const sign: 'pos' | 'neg' = dot >= 0 ? 'pos' : 'neg';
  const dir = sign === 'pos' ? seg : { x: -seg.x, y: -seg.y };
  return { dir, sign };
}

/**
 * 2つの線分ピックから、頂点・2腕の向き・参照(refs)を求める。
 * 2線分が平行(交点なし)なら null。
 */
export function anglePropsFromPicks(
  picks: SegmentPick[],
): { vertex: Point; startAngle: number; endAngle: number; refs: ObjectRef[] } | null {
  const [pa, pb] = picks;
  if (!pa || !pb) return null;
  const vertex = lineLineIntersection(pa.a, pa.b, pb.a, pb.b);
  if (!vertex) return null;
  const da = armDir(pa, vertex);
  const db = armDir(pb, vertex);
  return {
    vertex,
    startAngle: angleOfVector(da.dir),
    endAngle: angleOfVector(db.dir),
    refs: [
      { role: 'a', targetId: pa.targetId, kind: 'segment', segIndex: pa.segIndex, t: 0.5, mode: da.sign },
      { role: 'b', targetId: pb.targetId, kind: 'segment', segIndex: pb.segIndex, t: 0.5, mode: db.sign },
    ],
  };
}

/**
 * 解決済み参照(2腕の点+外向き接線)から頂点と2腕の向きを求める。
 * 交点が得られなければ null(現状維持)。
 */
export function angleFromResolved(
  resolved: ResolvedRef[],
): { vertex: Point; startAngle: number; endAngle: number } | null {
  const a = resolved.find((r) => r.role === 'a');
  const b = resolved.find((r) => r.role === 'b');
  if (!a?.tangent || !b?.tangent) return null;
  const vertex = lineLineIntersection(
    a.point,
    { x: a.point.x + a.tangent.x, y: a.point.y + a.tangent.y },
    b.point,
    { x: b.point.x + b.tangent.x, y: b.point.y + b.tangent.y },
  );
  if (!vertex) return null;
  return { vertex, startAngle: angleOfVector(a.tangent), endAngle: angleOfVector(b.tangent) };
}
