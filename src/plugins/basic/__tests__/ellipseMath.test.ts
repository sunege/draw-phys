import { describe, expect, it } from 'vitest';
import { ellipseArcBounds, ellipseArcPath, ellipsePointAt } from '../ellipseMath';

describe('ellipsePointAt', () => {
  it('rx≠ryのとき軸ごとに異なる半径でスケールする', () => {
    expect(ellipsePointAt(50, 30, 0)).toEqual({ x: 50, y: 0 });
    const p = ellipsePointAt(50, 30, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(30);
  });
});

describe('ellipseArcPath', () => {
  it('90度の弧はlargeArc=0・sweep=1で始点から描く', () => {
    const d = ellipseArcPath(50, 30, 0, 90);
    expect(d.startsWith('M 50 0 A 50 30 0 0 1')).toBe(true);
  });
  it('270度の弧はlargeArc=1', () => {
    const d = ellipseArcPath(50, 30, 0, 270);
    expect(d).toContain('A 50 30 0 1 1');
  });
});

describe('ellipseArcBounds', () => {
  it('第1象限90度の弧は原点〜(rx,ry)の箱', () => {
    const b = ellipseArcBounds(50, 30, 0, 90);
    expect(b.x).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(0);
    expect(b.width).toBeCloseTo(50);
    expect(b.height).toBeCloseTo(30);
  });
  it('全周はrx×ryの箱', () => {
    const b = ellipseArcBounds(50, 30, -180, 180);
    expect(b).toEqual({ x: -50, y: -30, width: 100, height: 60 });
  });
});
