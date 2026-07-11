import { describe, expect, it } from 'vitest';
import {
  arcHatchTicks,
  curvedMirrorGeometry,
  lensArcRadius,
  lensOutlinePath,
  prismVertices,
} from '../opticsMath';

describe('curvedMirrorGeometry', () => {
  it('凹面鏡: 頂点が原点、C=中心が+x側、F=R/2', () => {
    const g = curvedMirrorGeometry('concave', 160, 40);
    expect(g.center).toEqual({ x: 160, y: 0 });
    expect(g.focus).toEqual({ x: 80, y: 0 });
    expect(g.curvatureCenter).toEqual({ x: 160, y: 0 });
    expect(g.startAngle).toBe(140);
    expect(g.endAngle).toBe(220);
    // 掃引の中央(180°)が鏡の頂点=原点
    const midX = 160 + 160 * Math.cos(Math.PI);
    expect(midX).toBeCloseTo(0, 10);
    // 両端はy対称で、開いた側(+x)にある
    expect(g.ends[0].y).toBeCloseTo(-g.ends[1].y, 10);
    expect(g.ends[0].x).toBeGreaterThan(0);
  });

  it('凸面鏡: C・Fが-x側(虚焦点)、弧は+x側へ膨らむ', () => {
    const g = curvedMirrorGeometry('convex', 100, 30);
    expect(g.center).toEqual({ x: -100, y: 0 });
    expect(g.focus).toEqual({ x: -50, y: 0 });
    expect(g.startAngle).toBe(-30);
    expect(g.endAngle).toBe(30);
    // 両端は頂点(x=0)より裏側(-x)
    expect(g.ends[0].x).toBeLessThan(0);
    expect(g.ends[1].x).toBeLessThan(0);
  });
});

describe('arcHatchTicks', () => {
  it('outward=true で円の中心から離れる向きに描く', () => {
    const center = { x: 100, y: 0 };
    const ticks = arcHatchTicks(center, 100, 170, 190, true, 5, 10);
    for (const [a, b] of ticks) {
      const da = Math.hypot(a.x - center.x, a.y - center.y);
      const db = Math.hypot(b.x - center.x, b.y - center.y);
      expect(da).toBeCloseTo(100, 6);
      expect(db).toBeCloseTo(105, 6);
    }
  });

  it('outward=false で円の中心へ向かう', () => {
    const center = { x: -100, y: 0 };
    const [[, b]] = arcHatchTicks(center, 100, -10, 10, false, 5, 1000);
    const db = Math.hypot(b.x - center.x, b.y - center.y);
    expect(db).toBeCloseTo(95, 6);
  });
});

describe('prismVertices', () => {
  it('頂角60°・高さ100 → 底辺半幅 = 100·tan30°', () => {
    const [apex, right, left] = prismVertices(100, 60);
    expect(apex).toEqual({ x: 0, y: -50 });
    expect(right.x).toBeCloseTo(100 * Math.tan(Math.PI / 6), 10);
    expect(right.y).toBe(50);
    expect(left.x).toBeCloseTo(-right.x, 10);
  });
});

describe('lensArcRadius', () => {
  it('端点と矢(sagitta)から R=(hh²+s²)/(2s) を返す', () => {
    // hh=60, s=16 → (3600+256)/32 = 120.5
    expect(lensArcRadius(60, 16)).toBeCloseTo(120.5, 6);
    // 半円(s=hh)では R=hh
    expect(lensArcRadius(60, 60)).toBeCloseTo(60, 6);
  });
});

describe('lensOutlinePath', () => {
  it('凸: 端点で尖り中央がふくらむ円弧2枚(ベジェを使わない)', () => {
    const convex = lensOutlinePath('convex', 120, 32);
    expect(convex.startsWith('M 0 -60')).toBe(true);
    // 中央のふくらみ=16 → R=120.5 の円弧。sweep=1 で左右にふくらむ
    expect(convex).toContain('A 120.5 120.5 0 0 1 0 60');
    expect(convex).toContain('A 120.5 120.5 0 0 1 0 -60');
    expect(convex.endsWith('Z')).toBe(true);
    expect(convex).not.toContain('Q');
  });

  it('凹: 上下の平らな辺+内側へえぐる円弧2枚', () => {
    const concave = lensOutlinePath('concave', 120, 32);
    // 縁厚=32 → 上辺は x=-16→16 の直線
    expect(concave.startsWith('M -16 -60 L 16 -60')).toBe(true);
    expect(concave).toContain(' A '); // 円弧を使う
    expect(concave).toContain('0 0 0'); // large-arc=0, sweep=0(内側へえぐる)
    expect(concave.endsWith('Z')).toBe(true);
    expect(concave).not.toContain('Q');
  });

  it('厚みが極小のときは退化パスでNaNを出さない', () => {
    expect(lensOutlinePath('convex', 120, 0)).not.toContain('NaN');
    expect(lensOutlinePath('concave', 120, 0)).not.toContain('NaN');
  });
});
