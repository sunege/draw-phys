import { describe, expect, it } from 'vitest';
import {
  cylinderWallPath,
  flamePath,
  gasMoleculeLayout,
  pistonClamp,
  thermometerLayout,
} from '../thermoMath';

describe('cylinderWallPath', () => {
  it('NaNが無く、外周が壁厚ぶん内腔より広い閉パス', () => {
    const d = cylinderWallPath(160, 80, 6);
    expect(d).not.toContain('NaN');
    expect(d).toContain('Z');
    expect(d).toContain('-86'); // 外周: -(bore/2 + wt) = -46 と -(length/2 + wt) = -86
    expect(d).toContain('-46');
  });
});

describe('pistonClamp', () => {
  it('内腔の範囲(0〜length-ピストン厚)にクランプ', () => {
    expect(pistonClamp(100, 160, 10)).toBe(100);
    expect(pistonClamp(-5, 160, 10)).toBe(0);
    expect(pistonClamp(1000, 160, 10)).toBe(150);
  });
});

describe('gasMoleculeLayout', () => {
  it('同じシードなら同じ配置、違うシードなら異なる', () => {
    const a = gasMoleculeLayout(140, 100, 12, 3, 1, 5);
    const b = gasMoleculeLayout(140, 100, 12, 3, 1, 5);
    const c = gasMoleculeLayout(140, 100, 12, 3, 2, 5);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('個数どおり生成され、全て領域(margin内側)に収まる', () => {
    const ms = gasMoleculeLayout(140, 100, 20, 3, 7, 10);
    expect(ms.length).toBe(20);
    for (const m of ms) {
      expect(Math.abs(m.x)).toBeLessThanOrEqual(60);
      expect(Math.abs(m.y)).toBeLessThanOrEqual(40);
      expect(Number.isFinite(m.angle)).toBe(true);
    }
  });
});

describe('flamePath', () => {
  it('先端(0,-h/2)から始まる閉パスでNaNが無い', () => {
    const d = flamePath(28, 40);
    expect(d.startsWith('M 0 -20')).toBe(true);
    expect(d).toContain('Z');
    expect(d).not.toContain('NaN');
  });
});

describe('thermometerLayout', () => {
  it('level=0で液柱の高さ0、level=1で管の上端近くまで', () => {
    const empty = thermometerLayout(70, 7, 6, 0, 5);
    expect(empty.liquid.height).toBeCloseTo(0, 10);
    const full = thermometerLayout(70, 7, 6, 1, 5);
    expect(full.liquid.y).toBeCloseTo(full.tube.y + 6, 10);
    // 範囲外のlevelはクランプ
    const over = thermometerLayout(70, 7, 6, 2, 5);
    expect(over.liquid.y).toBeCloseTo(full.liquid.y, 10);
  });

  it('全高=管+球部の直径、目盛りは指定数', () => {
    const L = thermometerLayout(70, 7, 6, 0.5, 5);
    expect(L.totalHeight).toBe(84);
    expect(L.ticksY.length).toBe(5);
    expect(L.bulbCenter.y).toBeCloseTo(84 / 2 - 7, 10);
  });
});
