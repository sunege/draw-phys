import { describe, expect, it } from 'vitest';
import { localToWorld } from '../../../core/geometry';
import { identityTransform, type Point } from '../../../core/types';
import {
  dragParallelogramEdge,
  dragParallelogramVertex,
  MAX_SLANT_ANGLE,
  parallelogramBounds,
  parallelogramEdges,
  parallelogramVertices,
  scaleParallelogram,
  slantVector,
  type ParallelogramShape,
} from '../parallelogramMath';

const shape: ParallelogramShape = { width: 100, sideLength: 60, angle: 60 };

describe('parallelogramVertices', () => {
  it('重心が原点になる', () => {
    const vs = parallelogramVertices(shape);
    const cx = vs.reduce((s, p) => s + p.x, 0) / 4;
    const cy = vs.reduce((s, p) => s + p.y, 0) / 4;
    expect(cx).toBeCloseTo(0);
    expect(cy).toBeCloseTo(0);
  });

  it('底辺は水平で長さ=width、斜辺は挟角ぶん傾く', () => {
    const [a, b, c] = parallelogramVertices(shape);
    expect(b.y).toBeCloseTo(a.y);
    expect(b.x - a.x).toBeCloseTo(100);
    // 挟角60°・長さ60 → 水平30・上方向51.96
    expect(c.x - b.x).toBeCloseTo(30);
    expect(c.y - b.y).toBeCloseTo(-51.9615, 3);
  });

  it('挟角90°は長方形になる', () => {
    const [a, b, c, d] = parallelogramVertices({ width: 100, sideLength: 60, angle: 90 });
    expect(a).toEqual({ x: -50, y: 30 });
    expect(b).toEqual({ x: 50, y: 30 });
    expect(c.x).toBeCloseTo(50);
    expect(c.y).toBeCloseTo(-30);
    expect(d.x).toBeCloseTo(-50);
    expect(d.y).toBeCloseTo(-30);
  });

  it('向かい合う辺は平行(ベクトルが逆向きで同長)', () => {
    const [e0, e1, e2, e3] = parallelogramEdges(shape);
    const vec = ([p, q]: [{ x: number; y: number }, { x: number; y: number }]) => ({
      x: q.x - p.x,
      y: q.y - p.y,
    });
    expect(vec(e2).x).toBeCloseTo(-vec(e0).x);
    expect(vec(e2).y).toBeCloseTo(-vec(e0).y);
    expect(vec(e3).x).toBeCloseTo(-vec(e1).x);
    expect(vec(e3).y).toBeCloseTo(-vec(e1).y);
  });
});

describe('parallelogramBounds', () => {
  it('外接矩形が全頂点を含み、ぴったり接する', () => {
    const b = parallelogramBounds(shape);
    const vs = parallelogramVertices(shape);
    expect(Math.min(...vs.map((p) => p.x))).toBeCloseTo(b.x);
    expect(Math.max(...vs.map((p) => p.x))).toBeCloseTo(b.x + b.width);
    expect(Math.min(...vs.map((p) => p.y))).toBeCloseTo(b.y);
    expect(Math.max(...vs.map((p) => p.y))).toBeCloseTo(b.y + b.height);
  });

  it('鈍角(左上がり)でも幅は水平成分ぶん広がる', () => {
    const b = parallelogramBounds({ width: 100, sideLength: 60, angle: 120 });
    expect(b.width).toBeCloseTo(130);
    expect(b.height).toBeCloseTo(51.9615, 3);
  });
});

describe('scaleParallelogram', () => {
  it('頂点をそのまま(fx, fy)倍した形と一致する', () => {
    const fx = 1.5;
    const fy = 0.4;
    const scaled = parallelogramVertices(scaleParallelogram(shape, fx, fy));
    const expected = parallelogramVertices(shape).map((p) => ({ x: p.x * fx, y: p.y * fy }));
    scaled.forEach((p, i) => {
      expect(p.x).toBeCloseTo(expected[i].x);
      expect(p.y).toBeCloseTo(expected[i].y);
    });
  });

  it('等倍拡大では挟角が変わらない', () => {
    const s = scaleParallelogram(shape, 2, 2);
    expect(s.angle).toBeCloseTo(60);
    expect(s.width).toBeCloseTo(200);
    expect(s.sideLength).toBeCloseTo(120);
  });

  it('極端に潰しても挟角は可動範囲に収まり、辺長は1未満にならない', () => {
    const s = scaleParallelogram({ width: 100, sideLength: 60, angle: 120 }, 1, 0.0001);
    expect(s.angle).toBeLessThanOrEqual(MAX_SLANT_ANGLE);
    expect(s.sideLength).toBeGreaterThanOrEqual(1);
  });
});

describe('dragParallelogramVertex', () => {
  const t = { ...identityTransform(), x: 200, y: 100, rotation: 20 };
  const worldVertices = (s: ParallelogramShape, tr = t) =>
    parallelogramVertices(s).map((p) => localToWorld(p, tr));

  it.each([0, 1, 2, 3])('頂点%iが指定位置へ移り、隣の2頂点は動かない', (k) => {
    const before = worldVertices(shape);
    const target = { x: before[k].x + 37, y: before[k].y - 21 };
    const r = dragParallelogramVertex(shape, t, k, { x: 37, y: -21 });
    const after = worldVertices(r.shape, r.transform);

    // 巡回の向き・始点は正規化で変わりうるので、頂点集合として比べる
    const key = (p: { x: number; y: number }) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    const set = new Set(after.map(key));
    expect(set.has(key(target))).toBe(true);
    expect(set.has(key(before[(k + 1) % 4]))).toBe(true);
    expect(set.has(key(before[(k + 3) % 4]))).toBe(true);
    // 対角の頂点は逆向きに動く(平行四辺形の条件)
    const opp = before[(k + 2) % 4];
    expect(set.has(key({ x: opp.x - 37, y: opp.y + 21 }))).toBe(true);
  });

  it('中心(重心)は動かない', () => {
    const r = dragParallelogramVertex(shape, t, 2, { x: 90, y: -140 });
    expect(r.transform.x).toBeCloseTo(t.x);
    expect(r.transform.y).toBeCloseTo(t.y);
  });

  it('底辺の向きが変われば回転も追従する', () => {
    // 底辺(v0→v1)の終点を真下へ動かすと、底辺が傾く
    const r = dragParallelogramVertex(shape, identityTransform(), 1, { x: 0, y: 100 });
    expect(r.transform.rotation).not.toBeCloseTo(0);
    // 変形後も平行四辺形(向かい合う辺が平行・同長)であること
    const v = worldVertices(r.shape, r.transform);
    expect(v[1].x - v[0].x).toBeCloseTo(v[2].x - v[3].x);
    expect(v[1].y - v[0].y).toBeCloseTo(v[2].y - v[3].y);
  });

  it('裏返す方向へ動かしても挟角は正のまま(底辺と斜辺が入れ替わる)', () => {
    // v0を上辺のさらに上へ引き上げる=底辺をまたぐ
    const r = dragParallelogramVertex(shape, identityTransform(), 0, { x: 0, y: -200 });
    expect(r.shape.angle).toBeGreaterThan(0);
    expect(r.shape.angle).toBeLessThanOrEqual(MAX_SLANT_ANGLE);
    expect(r.shape.width).toBeGreaterThanOrEqual(1);
  });
});

describe('dragParallelogramEdge', () => {
  const t = { ...identityTransform(), x: 200, y: 100, rotation: 20 };
  const worldVertices = (s: ParallelogramShape, tr = t) =>
    parallelogramVertices(s).map((p) => localToWorld(p, tr));
  const key = (p: Point) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;

  it.each([0, 1, 2, 3])('辺%iが平行移動し、対辺の2頂点は動かない', (k) => {
    const before = worldVertices(shape);
    const d = { x: 24, y: 41 };
    const r = dragParallelogramEdge(shape, t, k, d);
    const after = new Set(worldVertices(r.shape, r.transform).map(key));

    // 掴んだ辺の2頂点はdだけ動く
    for (const i of [k, (k + 1) % 4]) {
      expect(after.has(key({ x: before[i].x + d.x, y: before[i].y + d.y }))).toBe(true);
    }
    // 対辺の2頂点は不動
    for (const i of [(k + 2) % 4, (k + 3) % 4]) {
      expect(after.has(key(before[i]))).toBe(true);
    }
  });

  it('掴んだ辺の長さと向きは変わらない(平行移動)', () => {
    const before = worldVertices(shape);
    const r = dragParallelogramEdge(shape, t, 1, { x: -60, y: 15 });
    const after = worldVertices(r.shape, r.transform);
    const vec = (v: Point[], i: number) => ({
      x: v[(i + 1) % 4].x - v[i].x,
      y: v[(i + 1) % 4].y - v[i].y,
    });
    // 正規化で頂点の並びが変わりうるので、辺ベクトルの集合として比べる
    const dir = (p: Point) => `${Math.abs(p.x).toFixed(3)},${Math.abs(p.y).toFixed(3)}`;
    const target = dir(vec(before, 1));
    expect([0, 1, 2, 3].map((i) => dir(vec(after, i)))).toContain(target);
  });

  it('底辺を動かすと幅と回転は変わらず、斜辺と挟角だけ変わる', () => {
    const r = dragParallelogramEdge(shape, identityTransform(), 0, { x: 20, y: 30 });
    expect(r.shape.width).toBeCloseTo(shape.width);
    expect(r.transform.rotation).toBeCloseTo(0);
    expect(r.shape.angle).not.toBeCloseTo(shape.angle);
    // 対辺が固定なので中心は動いた分の半分だけ動く
    expect(r.transform.x).toBeCloseTo(10);
    expect(r.transform.y).toBeCloseTo(15);
  });

  it('対辺を越えて動かしても退化しない', () => {
    const r = dragParallelogramEdge(shape, identityTransform(), 0, { x: 0, y: -400 });
    expect(r.shape.sideLength).toBeGreaterThanOrEqual(1);
    expect(r.shape.angle).toBeGreaterThan(0);
    expect(r.shape.angle).toBeLessThanOrEqual(MAX_SLANT_ANGLE);
  });
});

describe('slantVector', () => {
  it('鋭角は右上・鈍角は左上を向く(画面Yは下向き)', () => {
    expect(slantVector(10, 45).x).toBeGreaterThan(0);
    expect(slantVector(10, 45).y).toBeLessThan(0);
    expect(slantVector(10, 135).x).toBeLessThan(0);
    expect(slantVector(10, 135).y).toBeLessThan(0);
  });
});
