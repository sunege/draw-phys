import { angleOfVector, lineLineIntersection } from '../../core/geometry';
import type { HostTrim, SegmentPick } from '../../core/plugin';
import type { ObjectRef, Point, Rect } from '../../core/types';

const DEG = Math.PI / 180;

/** 弧の中心・接点・掃引角(度)。すべて頂点=原点のローカル座標 */
export interface FilletGeometry {
  /** 弧の中心 */
  center: Point;
  /** 腕A側の接点 */
  tangentA: Point;
  /** 腕B側の接点 */
  tangentB: Point;
  /** 接点Aの中心基準角(度) */
  startDeg: number;
  /** 掃引角(度, 符号付き, |値|=180-なす角<180) */
  sweepDeg: number;
  radius: number;
}

function angleOf(x: number, y: number): number {
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** 角度差を(-180,180]へ */
function normDeg(d: number): number {
  return (((d % 360) + 540) % 360) - 180;
}

function normalizeVec(v: Point): Point {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * 2腕の外向き角度(度)と半径から、頂点を原点(0,0)としたフィレット幾何を求める。
 * 腕が平行/一直線(なす角が0または180)なら角が無いので null。
 */
export function filletGeometry(
  armADeg: number,
  armBDeg: number,
  radius: number,
): FilletGeometry | null {
  if (!(radius > 0)) return null;
  const uA = { x: Math.cos(armADeg * DEG), y: Math.sin(armADeg * DEG) };
  const uB = { x: Math.cos(armBDeg * DEG), y: Math.sin(armBDeg * DEG) };
  const dot = Math.min(1, Math.max(-1, uA.x * uB.x + uA.y * uB.y));
  const phi = Math.acos(dot); // なす角 0..π
  if (phi < 1e-4 || Math.PI - phi < 1e-4) return null; // 平行/一直線=角なし
  const half = phi / 2;
  const t = radius / Math.tan(half); // 頂点から接点までの距離
  const tangentA = { x: uA.x * t, y: uA.y * t };
  const tangentB = { x: uB.x * t, y: uB.y * t };
  const bis = normalizeVec({ x: uA.x + uB.x, y: uA.y + uB.y }); // 角の二等分方向(内側)
  const d = radius / Math.sin(half);
  const center = { x: bis.x * d, y: bis.y * d };
  const startDeg = angleOf(tangentA.x - center.x, tangentA.y - center.y);
  const endDeg = angleOf(tangentB.x - center.x, tangentB.y - center.y);
  const sweepDeg = normDeg(endDeg - startDeg); // |値|=π-φ<180
  return { center, tangentA, tangentB, startDeg, sweepDeg, radius };
}

/** フィレット円弧のSVGパス(頂点原点のローカル座標)。null幾何なら空文字 */
export function filletPath(geo: FilletGeometry | null): string {
  if (!geo) return '';
  const { tangentA, tangentB, sweepDeg, radius } = geo;
  // y下向き系: 正のsweep(角度増加)=時計回り=sweep-flag 1(angleMark/arcと同規約)
  const sweepFlag = sweepDeg >= 0 ? 1 : 0;
  const largeArc = Math.abs(sweepDeg) > 180 ? 1 : 0;
  return `M ${tangentA.x} ${tangentA.y} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${tangentB.x} ${tangentB.y}`;
}

/** 弧の軸平行バウンディングボックス(頂点原点)。弧上を標本化して包む */
export function filletBounds(geo: FilletGeometry | null): Rect {
  if (!geo) return { x: 0, y: 0, width: 0, height: 0 };
  const { center, startDeg, sweepDeg, radius } = geo;
  const pts: Point[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const a = (startDeg + (sweepDeg * i) / steps) * DEG;
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/** 1つの線分ピックから、頂点を基準にした腕の外向き方向とmode符号を求める */
function armDir(pick: SegmentPick, vertex: Point): { dir: Point; sign: 'pos' | 'neg' } {
  const seg = { x: pick.b.x - pick.a.x, y: pick.b.y - pick.a.y };
  const toClick = { x: pick.worldPoint.x - vertex.x, y: pick.worldPoint.y - vertex.y };
  const dot = seg.x * toClick.x + seg.y * toClick.y;
  const sign: 'pos' | 'neg' = dot >= 0 ? 'pos' : 'neg';
  const dir = sign === 'pos' ? seg : { x: -seg.x, y: -seg.y };
  return { dir, sign };
}

/**
 * 母線(線分ピック)を接点まで詰めるための新しいワールド端点[keptEnd, tangentPoint]。
 * 残す側(=uの向き)の端点を残し、頂点側の端点を接点へ移動する。
 * 線分が接点に届かない(接点が端点より外)場合は詰めても伸びるだけなので null。
 */
function hostTrimFor(
  pick: SegmentPick,
  vertex: Point,
  u: Point,
  t: number,
): HostTrim | null {
  const projA = (pick.a.x - vertex.x) * u.x + (pick.a.y - vertex.y) * u.y;
  const projB = (pick.b.x - vertex.x) * u.x + (pick.b.y - vertex.y) * u.y;
  const keptEnd = projA >= projB ? pick.a : pick.b;
  const keptProj = Math.max(projA, projB);
  if (keptProj <= t + 1e-6) return null; // 接点まで線分が届かない
  const tangentPoint = { x: vertex.x + u.x * t, y: vertex.y + u.y * t };
  // 詰めた端点は元の線分向き(a→b)を保つ順で返す。順が反転すると getSegments の向きが
  // 変わり、refs の mode 符号が実態と食い違って applyRefs が逆の角へ接してしまう。
  const dir = { x: pick.b.x - pick.a.x, y: pick.b.y - pick.a.y };
  const forward = (tangentPoint.x - keptEnd.x) * dir.x + (tangentPoint.y - keptEnd.y) * dir.y >= 0;
  return forward
    ? { targetId: pick.targetId, a: keptEnd, b: tangentPoint }
    : { targetId: pick.targetId, a: tangentPoint, b: keptEnd };
}

/** createFromPicks の解決結果 */
export interface FilletSolve {
  vertex: Point;
  armA: number;
  armB: number;
  refs: ObjectRef[];
  hostTrims: HostTrim[];
}

/**
 * 2つの線分ピックと半径から、頂点・腕角度・参照・母線trimを求める。
 * 2線分が平行(交点なし)なら null。
 */
export function filletFromPicks(picks: SegmentPick[], radius: number): FilletSolve | null {
  const [pa, pb] = picks;
  if (!pa || !pb) return null;
  const vertex = lineLineIntersection(pa.a, pa.b, pb.a, pb.b);
  if (!vertex) return null;
  const da = armDir(pa, vertex);
  const db = armDir(pb, vertex);
  const geo = filletGeometry(angleOfVector(da.dir), angleOfVector(db.dir), radius);
  if (!geo) return null; // 一直線=角なし
  const uA = normalizeVec(da.dir);
  const uB = normalizeVec(db.dir);
  const t = radius / Math.tan(Math.acos(Math.min(1, Math.max(-1, uA.x * uB.x + uA.y * uB.y))) / 2);
  const trims: HostTrim[] = [];
  // 同一オブジェクトの2辺を選んだ場合はtrimしない(端点編集の意味が壊れるため)
  if (pa.targetId !== pb.targetId) {
    const ta = hostTrimFor(pa, vertex, uA, t);
    const tb = hostTrimFor(pb, vertex, uB, t);
    if (ta) trims.push(ta);
    if (tb) trims.push(tb);
  }
  return {
    vertex,
    armA: angleOfVector(da.dir),
    armB: angleOfVector(db.dir),
    refs: [
      { role: 'a', targetId: pa.targetId, kind: 'segment', segIndex: pa.segIndex, t: 0.5, mode: da.sign },
      { role: 'b', targetId: pb.targetId, kind: 'segment', segIndex: pb.segIndex, t: 0.5, mode: db.sign },
    ],
    hostTrims: trims,
  };
}

/** 解決済み参照(2腕の点+外向き接線)から頂点と2腕角度を求める。交点なしなら null */
export function filletFromResolved(
  aPoint: Point,
  aTangent: Point,
  bPoint: Point,
  bTangent: Point,
): { vertex: Point; armA: number; armB: number } | null {
  const vertex = lineLineIntersection(
    aPoint,
    { x: aPoint.x + aTangent.x, y: aPoint.y + aTangent.y },
    bPoint,
    { x: bPoint.x + bTangent.x, y: bPoint.y + bTangent.y },
  );
  if (!vertex) return null;
  return { vertex, armA: angleOfVector(aTangent), armB: angleOfVector(bTangent) };
}
