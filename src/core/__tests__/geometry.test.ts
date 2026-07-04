import { describe, expect, it } from 'vitest';
import {
  angleOfVector,
  lineLineIntersection,
  localToWorld,
  pointOnCircleAtAngle,
  snapPoint,
  snapValue,
  transformToString,
  unionRects,
  worldBounds,
} from '../geometry';
import { identityTransform } from '../types';

describe('angleOfVector / pointOnCircleAtAngle / lineLineIntersection', () => {
  it('angleOfVectorは+x=0, +y=90(下向き系)', () => {
    expect(angleOfVector({ x: 1, y: 0 })).toBeCloseTo(0);
    expect(angleOfVector({ x: 0, y: 1 })).toBeCloseTo(90);
    expect(angleOfVector({ x: -1, y: 0 })).toBeCloseTo(180);
  });

  it('pointOnCircleAtAngleは中心+半径*方向', () => {
    const p = pointOnCircleAtAngle({ x: 10, y: 20 }, 5, 0);
    expect(p).toEqual({ x: 15, y: 20 });
    const q = pointOnCircleAtAngle({ x: 0, y: 0 }, 10, 90);
    expect(q.x).toBeCloseTo(0);
    expect(q.y).toBeCloseTo(10);
  });

  it('lineLineIntersectionは2直線の交点を返す', () => {
    // y=0 の直線 と x=5 の直線 → (5,0)
    const p = lineLineIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: -5 }, { x: 5, y: 5 });
    expect(p?.x).toBeCloseTo(5);
    expect(p?.y).toBeCloseTo(0);
  });

  it('平行線はnull', () => {
    const p = lineLineIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 });
    expect(p).toBeNull();
  });
});

describe('geometry', () => {
  it('localToWorldは平行移動を適用する', () => {
    const p = localToWorld({ x: 10, y: 5 }, identityTransform(100, 200));
    expect(p).toEqual({ x: 110, y: 205 });
  });

  it('localToWorldは回転を適用する(90度)', () => {
    const t = { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 };
    const p = localToWorld({ x: 10, y: 0 }, t);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });

  it('localToWorldはスケールを回転より先に適用する', () => {
    const t = { x: 0, y: 0, rotation: 90, scaleX: 2, scaleY: 1 };
    const p = localToWorld({ x: 10, y: 0 }, t);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(20);
  });

  it('worldBoundsは回転後のAABBを返す', () => {
    // 100x50 の矩形を90度回転すると 50x100 のAABB
    const local = { x: -50, y: -25, width: 100, height: 50 };
    const t = { x: 200, y: 100, rotation: 90, scaleX: 1, scaleY: 1 };
    const bounds = worldBounds(local, t);
    expect(bounds.x).toBeCloseTo(175);
    expect(bounds.y).toBeCloseTo(50);
    expect(bounds.width).toBeCloseTo(50);
    expect(bounds.height).toBeCloseTo(100);
  });

  it('unionRectsは包含矩形を返す', () => {
    expect(unionRects([])).toBeNull();
    const union = unionRects([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 5, width: 10, height: 10 },
    ]);
    expect(union).toEqual({ x: 0, y: 0, width: 30, height: 15 });
  });

  it('snapはグリッドへ丸める', () => {
    expect(snapValue(14, 10)).toBe(10);
    expect(snapValue(15, 10)).toBe(20);
    expect(snapPoint({ x: 14, y: 16 }, 10)).toEqual({ x: 10, y: 20 });
  });

  it('transformToStringはSVG形式を生成する', () => {
    expect(transformToString({ x: 1, y: 2, rotation: 45, scaleX: 2, scaleY: 3 })).toBe(
      'translate(1 2) rotate(45) scale(2 3)',
    );
  });
});
