import { describe, expect, it } from 'vitest';
import { regionPathData } from '../../core/regionPath';
import type { Point } from '../../core/types';
import { buildArrangement, regionAt, type OwnedCurve } from '../regionMath';

const seg = (owner: string, a: Point, b: Point): OwnedCurve => ({ owner, curve: { kind: 'segment', a, b } });
const circle = (owner: string, center: Point, radius: number, start?: number, end?: number): OwnedCurve => ({
  owner,
  curve: { kind: 'circle', center, radius, rotation: 0, start, end },
});
const square = (owner: string, x: number, y: number, s: number): OwnedCurve[] => [
  seg(owner, { x, y }, { x: x + s, y }),
  seg(owner, { x: x + s, y }, { x: x + s, y: y + s }),
  seg(owner, { x: x + s, y: y + s }, { x, y: y + s }),
  seg(owner, { x, y: y + s }, { x, y }),
];

function areaAt(curves: OwnedCurve[], p: Point, tol = 0.5): number | null {
  const r = regionAt(buildArrangement(curves, tol), p);
  return r ? r.area : null;
}

/** 相対誤差 rel 以内で一致 */
function expectNear(actual: number | null, expected: number, rel = 0.002) {
  expect(actual).not.toBeNull();
  expect(Math.abs(actual! - expected) / expected).toBeLessThan(rel);
}

describe('regionAt: 直線で囲まれた領域', () => {
  it('正方形の内側は正方形全体', () => {
    const r = regionAt(buildArrangement(square('s', 0, 0, 100), 0.5), { x: 50, y: 50 });
    expect(r).not.toBeNull();
    expectNear(r!.area, 10000);
    expect(r!.loops).toHaveLength(1);
    expect(r!.loops[0].edges).toHaveLength(4);
    expect(r!.owners).toEqual(['s']);
  });

  it('外側をクリックすると null', () => {
    expect(areaAt(square('s', 0, 0, 100), { x: 150, y: 50 })).toBeNull();
  });

  it('対角線で区切ると三角形だけ', () => {
    const curves = [...square('s', 0, 0, 100), seg('d', { x: 0, y: 0 }, { x: 100, y: 100 })];
    expectNear(areaAt(curves, { x: 70, y: 20 }), 5000);
    expectNear(areaAt(curves, { x: 20, y: 70 }), 5000);
  });

  it('線が別々のオブジェクトでも交差で閉じた三角形を塗れる(はみ出しは無視)', () => {
    const curves = [
      seg('a', { x: -20, y: 0 }, { x: 120, y: 0 }),
      seg('b', { x: 0, y: -20 }, { x: 0, y: 120 }),
      seg('c', { x: -10, y: 110 }, { x: 110, y: -10 }),
    ];
    expectNear(areaAt(curves, { x: 20, y: 20 }), 5000);
  });

  it('許容距離以内の隙間は閉じているとみなす', () => {
    const curves = [
      seg('1', { x: 0, y: 0 }, { x: 100, y: 0 }),
      seg('2', { x: 100, y: 1 }, { x: 100, y: 100 }), // 1だけ離れている
      seg('3', { x: 100, y: 100 }, { x: 0, y: 100 }),
      seg('4', { x: 0, y: 100 }, { x: 0, y: 0 }),
    ];
    expect(areaAt(curves, { x: 50, y: 50 }, 0.5)).toBeNull();
    expectNear(areaAt(curves, { x: 50, y: 50 }, 2), 10000, 0.01);
  });

  it('T字の隙間(端点が辺の少し手前)も閉じているとみなす', () => {
    const curves = [...square('s', 0, 0, 100), seg('t', { x: 50, y: 1.5 }, { x: 50, y: 100 })];
    expectNear(areaAt(curves, { x: 25, y: 50 }, 2), 5000, 0.02);
  });

  it('辺を共有する2つの長方形(重なった辺)', () => {
    const curves = [...square('a', 0, 0, 100), ...square('b', 100, 0, 100)];
    expectNear(areaAt(curves, { x: 150, y: 50 }), 10000);
  });
});

describe('regionAt: 曲線を含む領域', () => {
  it('半円(円弧+直径)', () => {
    const curves = [circle('arc', { x: 0, y: 0 }, 50, 0, 180), seg('d', { x: -50, y: 0 }, { x: 50, y: 0 })];
    expectNear(areaAt(curves, { x: 0, y: 20 }), (Math.PI * 2500) / 2);
    expect(areaAt(curves, { x: 0, y: -20 })).toBeNull();
  });

  it('円と半径2本で扇形と残りを塗り分けられる', () => {
    const curves = [
      circle('c', { x: 0, y: 0 }, 50),
      seg('r1', { x: 0, y: 0 }, { x: 50, y: 0 }),
      seg('r2', { x: 0, y: 0 }, { x: 0, y: 50 }),
    ];
    expectNear(areaAt(curves, { x: 20, y: 20 }), (Math.PI * 2500) / 4);
    expectNear(areaAt(curves, { x: -20, y: -20 }), (Math.PI * 2500 * 3) / 4);
  });

  it('2円の重なり(レンズ形)', () => {
    const curves = [circle('a', { x: 0, y: 0 }, 50), circle('b', { x: 50, y: 0 }, 50)];
    // レンズ面積 = 2r²acos(d/2r) − (d/2)√(4r²−d²)
    const lens = 2 * 2500 * Math.acos(0.5) - 25 * Math.sqrt(10000 - 2500);
    expectNear(areaAt(curves, { x: 25, y: 0 }), lens);
    expectNear(areaAt(curves, { x: -25, y: 0 }), Math.PI * 2500 - lens);
  });

  it('接する直線と円(接点を共有)', () => {
    // 円の下端 y=50 に接する線と、両端から円へ届く縦線で囲まれた領域
    const curves = [
      circle('c', { x: 0, y: 0 }, 50),
      seg('t', { x: -50, y: 50 }, { x: 50, y: 50 }),
      seg('l', { x: -50, y: 0 }, { x: -50, y: 50 }),
      seg('r', { x: 50, y: 0 }, { x: 50, y: 50 }),
    ];
    // 正方形50×100の下半分 − 半円の下半分 = 5000 − π·2500/2
    expectNear(areaAt(curves, { x: -45, y: 45 }), (5000 - (Math.PI * 2500) / 2) / 2, 0.01);
  });

  it('内側の独立した円は穴としてくり抜く', () => {
    const curves = [...square('s', 0, 0, 100), circle('hole', { x: 50, y: 50 }, 20)];
    const r = regionAt(buildArrangement(curves, 0.5), { x: 10, y: 10 });
    expect(r).not.toBeNull();
    expect(r!.loops).toHaveLength(2);
    expectNear(r!.area, 10000 - Math.PI * 400);
    // 穴の中をクリックすれば円そのもの
    expectNear(areaAt(curves, { x: 50, y: 50 }), Math.PI * 400);
  });

  it('楕円と弦', () => {
    const curves: OwnedCurve[] = [
      { owner: 'e', curve: { kind: 'ellipse', center: { x: 0, y: 0 }, radiusX: 80, radiusY: 40, rotation: 0 } },
      seg('chord', { x: -100, y: 0 }, { x: 100, y: 0 }),
    ];
    expectNear(areaAt(curves, { x: 0, y: 10 }), (Math.PI * 80 * 40) / 2);
  });
});

describe('regionPathData', () => {
  it('円弧は A コマンド・閉じたパスになる', () => {
    const curves = [circle('arc', { x: 0, y: 0 }, 50, 0, 180), seg('d', { x: -50, y: 0 }, { x: 50, y: 0 })];
    const r = regionAt(buildArrangement(curves, 0.5), { x: 0, y: 20 })!;
    const d = regionPathData(r.loops);
    expect(d).toMatch(/^M /);
    expect(d).toContain('A 50 50 0 0');
    expect(d.trim().endsWith('Z')).toBe(true);
  });
});
