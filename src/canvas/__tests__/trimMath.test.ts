import { describe, expect, it } from 'vitest';
import {
  bracketCyclic,
  bracketLinear,
  circleCircle,
  pointOnArc,
  projectSegmentT,
  segmentCircle,
  segmentSegment,
} from '../trimMath';

describe('trimMath 交点', () => {
  it('線分×線分: 中央で交差した点を返す', () => {
    const p = segmentSegment({ x: -50, y: 0 }, { x: 50, y: 0 }, { x: 0, y: -50 }, { x: 0, y: 50 });
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(0);
    expect(p!.y).toBeCloseTo(0);
  });

  it('線分×線分: 範囲外(交わらない)は null', () => {
    expect(segmentSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: -5 }, { x: 20, y: 5 })).toBeNull();
  });

  it('線分×線分: 平行は null', () => {
    expect(segmentSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBeNull();
  });

  it('線分×円: 直径線は左右2点で交わる', () => {
    const pts = segmentCircle({ x: -100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, 40);
    expect(pts).toHaveLength(2);
    const xs = pts.map((p) => p.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-40);
    expect(xs[1]).toBeCloseTo(40);
  });

  it('円×円: 2交点', () => {
    const pts = circleCircle({ x: 0, y: 0 }, 50, { x: 80, y: 0 }, 50);
    expect(pts).toHaveLength(2);
    expect(pts[0].x).toBeCloseTo(40);
    expect(Math.abs(pts[0].y)).toBeCloseTo(30);
  });

  it('projectSegmentT: 中点は 0.5', () => {
    expect(projectSegmentT({ x: 0, y: 0 }, { x: -50, y: 0 }, { x: 50, y: 0 })).toBeCloseTo(0.5);
  });
});

describe('trimMath 円弧判定', () => {
  it('pointOnArc: 範囲内の点は true / 範囲外は false', () => {
    // start=0, end=90 の円弧(半径10, 中心原点, 回転0)
    expect(pointOnArc({ x: 0, y: 0 }, 0, 0, 90, { x: 7, y: 7 })).toBe(true); // 45°付近
    expect(pointOnArc({ x: 0, y: 0 }, 0, 0, 90, { x: -7, y: 7 })).toBe(false); // 135°
  });
});

describe('trimMath ブラケット', () => {
  it('bracketLinear: click を挟む隣接境界を返す', () => {
    expect(bracketLinear([0, 0.3, 0.7, 1], 0.5)).toEqual([0.3, 0.7]);
    expect(bracketLinear([0, 0.5, 1], 0.7)).toEqual([0.5, 1]);
  });

  it('bracketCyclic: click を含む削除ギャップ(増加方向 lo→hi)を返す', () => {
    // 交点 90,270。click=0(右) はギャップ 270→(90+360) に入る
    expect(bracketCyclic([90, 270], 0)).toEqual([270, 90]);
    // click=180(左) はギャップ 90→270 に入る
    expect(bracketCyclic([90, 270], 180)).toEqual([90, 270]);
  });

  it('bracketCyclic: 2交点未満は null', () => {
    expect(bracketCyclic([90], 0)).toBeNull();
  });
});
