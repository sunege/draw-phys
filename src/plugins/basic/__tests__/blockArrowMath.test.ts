import { describe, expect, it } from 'vitest';
import { blockArrowHeight, blockArrowPoints } from '../blockArrowMath';

describe('blockArrowPoints', () => {
  it('片矢先: 先端が中心線上(y=0)、後端は軸幅で平ら', () => {
    const pts = blockArrowPoints({
      length: 100,
      shaftWidth: 20,
      headWidth: 40,
      headLength: 30,
      doubleHead: false,
    });
    expect(pts).toHaveLength(7);
    const tip = pts.find((p) => p.x === 50);
    expect(tip).toEqual({ x: 50, y: 0 });
    const back = pts.filter((p) => p.x === -50);
    expect(back).toEqual([
      { x: -50, y: -10 },
      { x: -50, y: 10 },
    ]);
  });

  it('片矢先: headLengthが全長を超えても自己交差しないようクランプ', () => {
    const pts = blockArrowPoints({
      length: 40,
      shaftWidth: 10,
      headWidth: 30,
      headLength: 999,
      doubleHead: false,
    });
    const xs = pts.map((p) => p.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-20);
  });

  it('両矢先: 両端が中心線上の頂点になる', () => {
    const pts = blockArrowPoints({
      length: 100,
      shaftWidth: 20,
      headWidth: 40,
      headLength: 30,
      doubleHead: true,
    });
    expect(pts).toHaveLength(10);
    expect(pts).toContainEqual({ x: -50, y: 0 });
    expect(pts).toContainEqual({ x: 50, y: 0 });
  });

  it('両矢先: headLengthが半長を超えてもクランプしhs1<=hs2を保つ', () => {
    const pts = blockArrowPoints({
      length: 40,
      shaftWidth: 10,
      headWidth: 30,
      headLength: 999,
      doubleHead: true,
    });
    const xs = pts.map((p) => p.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-20);
    expect(Math.max(...xs)).toBeLessThanOrEqual(20);
  });
});

describe('blockArrowHeight', () => {
  it('矢先幅と軸太さの大きい方を返す', () => {
    expect(blockArrowHeight({ shaftWidth: 20, headWidth: 40 })).toBe(40);
    expect(blockArrowHeight({ shaftWidth: 50, headWidth: 40 })).toBe(50);
  });
});
