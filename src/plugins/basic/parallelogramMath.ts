import { localToWorld, rotateVec } from '../../core/geometry';
import type { Point, Transform } from '../../core/types';

/** 挟角の可動範囲(度)。0/180に潰れると面積0の退化図形になるため制限する */
export const MIN_SLANT_ANGLE = 5;
export const MAX_SLANT_ANGLE = 175;

/** 平行四辺形の形状パラメータ(底辺・斜辺の長さと、その2辺の挟角) */
export interface ParallelogramShape {
  /** 底辺(ローカルX軸方向)の長さ */
  width: number;
  /** 斜辺の長さ */
  sideLength: number;
  /** 底辺と斜辺のなす角(度)。90で長方形、90未満で右上がり */
  angle: number;
}

export function clampSlantAngle(deg: number): number {
  return Math.min(Math.max(deg, MIN_SLANT_ANGLE), MAX_SLANT_ANGLE);
}

/**
 * 斜辺のベクトル(ローカル座標)。画面Yは下向きなので、
 * 挟角が鋭角(90未満)のとき上辺が右へずれた右上がりの形になる。
 */
export function slantVector(sideLength: number, angle: number): Point {
  const rad = (angle * Math.PI) / 180;
  return { x: sideLength * Math.cos(rad), y: -sideLength * Math.sin(rad) };
}

/**
 * 4頂点(ローカル座標、原点=重心=対角線の交点)。
 * 左下(底辺始点)→右下→右上→左上の順で、getSegments・trim と共有する。
 */
export function parallelogramVertices(shape: ParallelogramShape): [Point, Point, Point, Point] {
  const s = slantVector(shape.sideLength, shape.angle);
  const v0 = { x: -(shape.width + s.x) / 2, y: -s.y / 2 };
  const v1 = { x: v0.x + shape.width, y: v0.y };
  return [v0, v1, { x: v1.x + s.x, y: v1.y + s.y }, { x: v0.x + s.x, y: v0.y + s.y }];
}

/** 4辺のローカル端点([始点, 終点] × 4)。底辺→右斜辺→上辺→左斜辺の順 */
export function parallelogramEdges(shape: ParallelogramShape): [Point, Point][] {
  const [a, b, c, d] = parallelogramVertices(shape);
  return [
    [a, b],
    [b, c],
    [c, d],
    [d, a],
  ];
}

/** ローカル外接矩形(底辺は水平なので、幅は斜辺の水平成分ぶんだけ広がる) */
export function parallelogramBounds(shape: ParallelogramShape): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const s = slantVector(shape.sideLength, shape.angle);
  const width = shape.width + Math.abs(s.x);
  const height = Math.abs(s.y);
  return { x: -width / 2, y: -height / 2, width, height };
}

/**
 * ワールド上の4頂点(平行四辺形をなす前提)から形状・transform を復元する。
 * 底辺=ローカルX軸という表現に合わせるため、斜辺が上を向く辺の組を底辺に選ぶ。
 * 頂点の巡回順は問わない(反転した並びでも正の挟角へ正規化される)。
 */
export function parallelogramFromVertices(
  worldVertices: [Point, Point, Point, Point],
  base: Transform,
): { shape: ParallelogramShape; transform: Transform } {
  const [w0, w1, , w3] = worldVertices;
  const e1 = { x: w1.x - w0.x, y: w1.y - w0.y };
  const e2 = { x: w3.x - w0.x, y: w3.y - w0.y };
  // 画面Yは下向きなので、外積が負=e2がe1の上側。そちらを(底辺, 斜辺)に採る
  const flip = e1.x * e2.y - e1.y * e2.x > 0;
  const baseVec = flip ? e2 : e1;
  const sideVec = flip ? e1 : e2;

  const rotation = (Math.atan2(baseVec.y, baseVec.x) * 180) / Math.PI;
  const s = rotateVec(sideVec, -rotation);
  const center = {
    x: worldVertices.reduce((sum, p) => sum + p.x, 0) / 4,
    y: worldVertices.reduce((sum, p) => sum + p.y, 0) / 4,
  };
  return {
    shape: {
      width: Math.max(Math.hypot(baseVec.x, baseVec.y), 1),
      sideLength: Math.max(Math.hypot(s.x, s.y), 1),
      angle: clampSlantAngle((Math.atan2(-s.y, s.x) * 180) / Math.PI),
    },
    transform: { ...base, x: center.x, y: center.y, rotation, scaleX: 1, scaleY: 1 },
  };
}

/**
 * 頂点ドラッグ。掴んだ頂点を delta だけ動かし、隣り合う2頂点は固定する。
 * 平行四辺形は v0+v2 = v1+v3 を満たすので、1頂点を動かすと必ずもう1頂点が動く。
 * 隣接2頂点を固定する流儀では対角の頂点だけが逆向きに動き、中心(重心)は不動になる。
 * 底辺の向き・挟角・辺の長さがすべて変わりうるので、transform も作り直して返す。
 */
export function dragParallelogramVertex(
  shape: ParallelogramShape,
  transform: Transform,
  index: number,
  delta: Point,
): { shape: ParallelogramShape; transform: Transform } {
  const world = parallelogramVertices(shape).map((p) => localToWorld(p, transform));
  const moved = [...world];
  moved[index] = { x: world[index].x + delta.x, y: world[index].y + delta.y };
  // 対角の頂点は平行四辺形の条件から決まる(= 隣接2頂点の和 - 掴んだ頂点)。
  // 隣接2頂点が固定なので、結果として対角は逆向きに同じだけ動く
  const opposite = (index + 2) % 4;
  moved[opposite] = { x: world[opposite].x - delta.x, y: world[opposite].y - delta.y };
  return parallelogramFromVertices(moved as [Point, Point, Point, Point], transform);
}

/**
 * 辺ドラッグ。掴んだ辺(端点2つ)を delta だけ平行移動し、対辺は固定する。
 * 掴んだ辺は向き・長さが変わらず、対辺と平行なままなので図形は平行四辺形を保つ
 * (変わるのは隣り合う2辺=奥行きの長さと挟角)。
 * 対辺が固定でも中心は動くため、transform の位置も作り直して返す。
 */
export function dragParallelogramEdge(
  shape: ParallelogramShape,
  transform: Transform,
  index: number,
  delta: Point,
): { shape: ParallelogramShape; transform: Transform } {
  const world = parallelogramVertices(shape).map((p) => localToWorld(p, transform));
  const moved = world.map((p, i) =>
    i === index || i === (index + 1) % 4 ? { x: p.x + delta.x, y: p.y + delta.y } : p,
  );
  return parallelogramFromVertices(moved as [Point, Point, Point, Point], transform);
}

/**
 * 拡大縮小を形状パラメータへ焼き込む。
 * 平行四辺形を非等倍に伸ばしても平行四辺形のままなので、
 * 底辺はfx倍、斜辺ベクトルは(fx, fy)倍した結果から長さと挟角を求め直す。
 */
export function scaleParallelogram(
  shape: ParallelogramShape,
  fx: number,
  fy: number,
): ParallelogramShape {
  const s = slantVector(shape.sideLength, shape.angle);
  const x = s.x * fx;
  const y = s.y * fy;
  return {
    width: Math.max(shape.width * fx, 1),
    sideLength: Math.max(Math.hypot(x, y), 1),
    angle: clampSlantAngle((Math.atan2(-y, x) * 180) / Math.PI),
  };
}
