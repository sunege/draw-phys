import { describe, expect, it } from 'vitest';
import { arcBounds, arcPath, isFullArc } from '../arc';

describe('isFullArc', () => {
  it('-180〜180は全周', () => {
    expect(isFullArc(-180, 180)).toBe(true);
  });
  it('開始=終了は全周(掃引360扱い)', () => {
    expect(isFullArc(30, 30)).toBe(true);
  });
  it('通常の円弧は全周でない', () => {
    expect(isFullArc(0, 120)).toBe(false);
  });
});

describe('arcPath', () => {
  it('90度の弧はlargeArc=0・sweep=1で始点から描く', () => {
    const d = arcPath(50, 0, 90);
    expect(d.startsWith('M 50 0 A 50 50 0 0 1')).toBe(true);
  });
  it('270度の弧はlargeArc=1', () => {
    const d = arcPath(50, 0, 270);
    expect(d).toContain('A 50 50 0 1 1');
  });
});

describe('arcBounds', () => {
  it('第1象限90度の弧は原点〜(r,r)の箱', () => {
    const b = arcBounds(50, 0, 90);
    expect(b.x).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(0);
    expect(b.width).toBeCloseTo(50);
    expect(b.height).toBeCloseTo(50);
  });
  it('全周は半径の正方形', () => {
    const b = arcBounds(50, -180, 180);
    expect(b).toEqual({ x: -50, y: -50, width: 100, height: 100 });
  });
});
