import { angleOfVector, reflectAngle, reflectPoint, rotateVec, worldToLocal } from '../../core/geometry';
import type { Point, Rect, Transform } from '../../core/types';

/** 多角形として成立する最小の頂点数 */
export const MIN_POLYGON_VERTICES = 3;

/** 頂点が重なったとみなす距離(px)。これ未満の辺は退化として弾く */
const MIN_EDGE_LENGTH = 1e-6;

/** 外積の相対許容誤差(平行判定用。ベクトル長で正規化して使う) */
const CROSS_EPS = 1e-9;

/**
 * 多角形の頂点列(ローカル座標)。末尾→先頭で閉じる。
 *
 * **ローカル原点は生成時の頂点重心に置いたまま動かさない(頂点編集で再センタリングしない)**。
 * 一致拘束の `localAnchor` はローカル座標で焼き込まれるため、別の頂点を動かしただけで
 * 全頂点のローカル座標がずれると、拘束が「もう頂点ではない点」を掴んでしまう。
 * フレームを固定しておけば、動かしていない頂点のローカル座標は不変=拘束が保たれる。
 */
export type PolygonPoints = Point[];

/** 各辺のローカル端点([始点, 終点] × 頂点数)。i番目の辺は頂点i→頂点i+1 */
export function polygonEdges(points: PolygonPoints): [Point, Point][] {
  return points.map((p, i) => [p, points[(i + 1) % points.length]] as [Point, Point]);
}

/** ローカル外接矩形(頂点が無ければ0サイズ) */
export function polygonBounds(points: PolygonPoints): Rect {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** 頂点の平均(生成時のローカル原点に使う代表点) */
export function polygonCentroid(points: PolygonPoints): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * スナップ点(ローカル座標)。**先頭が頂点0..n-1、続いて各辺の中点**。
 * 一致拘束は `pointIndex` でこの並びを指すので、頂点を先頭に固定しておくと
 * 「頂点iへの一致」がインデックスとして安定する。
 */
export function polygonSnapPoints(points: PolygonPoints): Point[] {
  const mids = polygonEdges(points).map(([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }));
  return [...points, ...mids];
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** 3点の向き(正=時計回り, 負=反時計回り, 0=共線)。共線判定は辺長で正規化する */
function orientation(a: Point, b: Point, c: Point): number {
  const u = sub(b, a);
  const v = sub(c, a);
  const cr = cross(u, v);
  const scale = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  if (scale < MIN_EDGE_LENGTH || Math.abs(cr) <= CROSS_EPS * scale) return 0;
  return cr > 0 ? 1 : -1;
}

/** 共線の点pが線分ab上(端点含む)にあるか */
function onSegment(a: Point, b: Point, p: Point): boolean {
  return (
    p.x <= Math.max(a.x, b.x) + MIN_EDGE_LENGTH &&
    p.x >= Math.min(a.x, b.x) - MIN_EDGE_LENGTH &&
    p.y <= Math.max(a.y, b.y) + MIN_EDGE_LENGTH &&
    p.y >= Math.min(a.y, b.y) - MIN_EDGE_LENGTH
  );
}

/** 2線分が交わるか(端点での接触も交差とみなす=頂点が他の辺に乗るのを禁止する) */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  // 共線で重なるケース
  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return false;
}

/**
 * 自己交差しない(単純)多角形か。作成時のクリック・頂点/辺ドラッグの可否判定に使う。
 * - 頂点3つ未満・長さ0の辺は不可
 * - 隣り合わない辺どうしが交差(端点接触を含む)したら不可
 * - 隣り合う辺が180°折り返して重なるのも不可
 */
export function isSimplePolygon(points: PolygonPoints): boolean {
  const n = points.length;
  if (n < MIN_POLYGON_VERTICES) return false;
  const edges = polygonEdges(points);
  for (const [a, b] of edges) {
    if (Math.hypot(b.x - a.x, b.y - a.y) < MIN_EDGE_LENGTH) return false;
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      const [a, b] = edges[i];
      const [c, d] = edges[j];
      if (adjacent) {
        // 共有頂点で折り返して重なる(なす角0°)のは退化。それ以外の接触は正常
        const e1 = sub(b, a);
        const e2 = sub(d, c);
        const scale = Math.hypot(e1.x, e1.y) * Math.hypot(e2.x, e2.y);
        const collinear = Math.abs(cross(e1, e2)) <= CROSS_EPS * scale;
        if (collinear && e1.x * e2.x + e1.y * e2.y < 0) return false;
        continue;
      }
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

/**
 * 作成途中の頂点列に次の頂点を足せるか(自己交差の予防)。
 * 新しい辺 last→next が、既存の辺(隣接する最後の辺を除く)と交わらないことを見る。
 * まだ閉じていないので開いた折れ線として判定する。
 */
export function canAppendVertex(points: PolygonPoints, next: Point): boolean {
  if (points.length === 0) return true;
  const last = points[points.length - 1];
  if (Math.hypot(next.x - last.x, next.y - last.y) < MIN_EDGE_LENGTH) return false;
  for (let i = 0; i + 1 < points.length - 1; i++) {
    if (segmentsIntersect(points[i], points[i + 1], last, next)) return false;
  }
  return true;
}

/** 作成途中の頂点列を閉じられるか(閉じ辺 last→first が既存の辺と交わらないか) */
export function canClosePolygon(points: PolygonPoints): boolean {
  return points.length >= MIN_POLYGON_VERTICES && isSimplePolygon(points);
}

/** ワールドの移動量をローカルの移動量へ(回転・スケールを外す) */
export function worldDeltaToLocal(delta: Point, transform: Transform): Point {
  const r = rotateVec(delta, -transform.rotation);
  return { x: r.x / (transform.scaleX || 1), y: r.y / (transform.scaleY || 1) };
}

/**
 * 頂点ドラッグ。掴んだ頂点だけをローカル移動量ぶん動かす(他の頂点・フレームは不動)。
 * 自己交差する結果になる場合は null(呼び出し側は元の形を保つ)。
 */
export function movePolygonVertex(
  points: PolygonPoints,
  index: number,
  deltaLocal: Point,
): PolygonPoints | null {
  const next = points.map((p, i) =>
    i === index ? { x: p.x + deltaLocal.x, y: p.y + deltaLocal.y } : p,
  );
  return isSimplePolygon(next) ? next : null;
}

/**
 * 辺ドラッグ。辺の両端の頂点をローカル移動量ぶん平行移動する(辺の向き・長さは不変)。
 * 自己交差する結果になる場合は null。
 */
export function movePolygonEdge(
  points: PolygonPoints,
  index: number,
  deltaLocal: Point,
): PolygonPoints | null {
  const n = points.length;
  const j = (index + 1) % n;
  const next = points.map((p, i) =>
    i === index || i === j ? { x: p.x + deltaLocal.x, y: p.y + deltaLocal.y } : p,
  );
  return isSimplePolygon(next) ? next : null;
}

/** 拡大縮小を頂点座標へ焼き込む(線幅は変えない=箱型と同じ流儀) */
export function scalePolygon(points: PolygonPoints, fx: number, fy: number): PolygonPoints {
  return points.map((p) => ({ x: p.x * fx, y: p.y * fy }));
}

/**
 * クリックで置いたワールド頂点列から props/transform を作る。
 * ローカル原点=頂点の重心、回転0。以後この原点は頂点編集では動かさない。
 */
export function polygonFromWorldPoints(world: Point[]): { points: PolygonPoints; transform: Transform } {
  const c = polygonCentroid(world);
  return {
    points: world.map((p) => ({ x: p.x - c.x, y: p.y - c.y })),
    transform: { x: c.x, y: c.y, rotation: 0, scaleX: 1, scaleY: 1 },
  };
}

/**
 * 対称軸(a,b)に関する鏡像。頂点列は自由なので、原点と回転を反射した新フレームを作り、
 * 反射後のワールド頂点をそのフレームのローカル座標へ落とせばよい(手性もそのまま反転する)。
 */
export function mirrorPolygon(
  points: PolygonPoints,
  transform: Transform,
  a: Point,
  b: Point,
): { points: PolygonPoints; transform: Transform } {
  const axisAngle = angleOfVector({ x: b.x - a.x, y: b.y - a.y });
  const origin = reflectPoint({ x: transform.x, y: transform.y }, a, b);
  const next: Transform = {
    ...transform,
    x: origin.x,
    y: origin.y,
    rotation: reflectAngle(transform.rotation, axisAngle),
  };
  const world = points.map((p) => {
    const w = rotateVec({ x: p.x * transform.scaleX, y: p.y * transform.scaleY }, transform.rotation);
    return reflectPoint({ x: transform.x + w.x, y: transform.y + w.y }, a, b);
  });
  return { points: world.map((p) => worldToLocal(p, next)), transform: next };
}
