import { describe, expect, it } from 'vitest';
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

describe('trimMath 楕円', () => {
  // rx=2, ry=1, rotation=90° の楕円上、媒介変数角度30°の点は
  // 回転前ローカル(1.732,0.5) → 90°回転でワールド(-0.5, 1.732) になる。
  // 「回転を先に打ち消してから軸ごとに割る」正しい順序でないと角度がずれる組み合わせ。
  it('ellipseParamAngle: 回転+非対称半径でも媒介変数角度を正しく復元する', () => {
    const t = ellipseParamAngle({ x: 0, y: 0 }, 2, 1, 90, { x: -0.5, y: Math.sqrt(3) });
    expect(t).toBeCloseTo(30, 1);
  });

  it('segmentEllipse: 回転90°の楕円を長軸方向へ貫く線は長軸両端で交わる', () => {
    // t=0→ワールド(0,2)、t=180→ワールド(0,-2)(rotation=90°で長軸rx=2がワールドy軸に一致)
    const pts = segmentEllipse({ x: 0, y: -10 }, { x: 0, y: 10 }, { x: 0, y: 0 }, 2, 1, 90);
    expect(pts).toHaveLength(2);
    const ys = pts.map((p) => p.y).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-2);
    expect(ys[1]).toBeCloseTo(2);
    pts.forEach((p) => expect(p.x).toBeCloseTo(0));
  });

  it('segmentEllipse: 軸並行(rotation=0)でも従来のsegmentCircle相当に交わる', () => {
    const pts = segmentEllipse({ x: -100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, 40, 20, 0);
    expect(pts).toHaveLength(2);
    const xs = pts.map((p) => p.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-40);
    expect(xs[1]).toBeCloseTo(40);
  });

  it('pointOnEllipticalArc: 回転+非対称半径の範囲内/範囲外を正しく判定する', () => {
    // start=0,end=90(媒介変数角度)の楕円弧。t=30°の点(範囲内)/t=180°の点(範囲外)
    expect(pointOnEllipticalArc({ x: 0, y: 0 }, 2, 1, 90, 0, 90, { x: -0.5, y: Math.sqrt(3) })).toBe(true);
    expect(pointOnEllipticalArc({ x: 0, y: 0 }, 2, 1, 90, 0, 90, { x: 0, y: -2 })).toBe(false);
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
