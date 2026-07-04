import { describe, expect, it } from 'vitest';
import type { SegmentPick } from '../../../core/plugin';
import { angleFromResolved, anglePropsFromPicks, normalizeSweep } from '../angleMarkMath';

describe('normalizeSweep', () => {
  it('(-180,180]へ正規化する', () => {
    expect(normalizeSweep(90)).toBe(90);
    expect(normalizeSweep(270)).toBe(-90);
    expect(normalizeSweep(-270)).toBe(90);
    expect(normalizeSweep(180)).toBe(180);
  });
});

describe('anglePropsFromPicks', () => {
  // 水平線分(0,0)-(100,0) と 垂直線分(0,0)-(0,100) が原点で交わる
  const pa: SegmentPick = {
    targetId: 'A',
    segIndex: 0,
    worldPoint: { x: 80, y: 0 }, // 右向きの腕をクリック
    a: { x: 0, y: 0 },
    b: { x: 100, y: 0 },
  };
  const pb: SegmentPick = {
    targetId: 'B',
    segIndex: 0,
    worldPoint: { x: 0, y: 80 }, // 下向きの腕をクリック
    a: { x: 0, y: 0 },
    b: { x: 0, y: 100 },
  };

  it('交点を頂点、クリック側を腕方向にする', () => {
    const r = anglePropsFromPicks([pa, pb]);
    expect(r?.vertex.x).toBeCloseTo(0);
    expect(r?.vertex.y).toBeCloseTo(0);
    expect(r?.startAngle).toBeCloseTo(0); // 右向き
    expect(r?.endAngle).toBeCloseTo(90); // 下向き
    // なす角は90°
    expect(Math.abs(normalizeSweep((r?.endAngle ?? 0) - (r?.startAngle ?? 0)))).toBeCloseTo(90);
    expect(r?.refs).toHaveLength(2);
    expect(r?.refs[0].mode).toBe('pos');
  });

  it('反対側をクリックすると腕が反転しmode:negになる', () => {
    const r = anglePropsFromPicks([{ ...pa, worldPoint: { x: -80, y: 0 } }, pb]);
    expect(Math.abs(r?.startAngle ?? 0)).toBeCloseTo(180); // 左向き(±180)
    expect(r?.refs[0].mode).toBe('neg');
  });

  it('平行(交点なし)はnull', () => {
    const r = anglePropsFromPicks([
      pa,
      { ...pb, a: { x: 0, y: 50 }, b: { x: 100, y: 50 } },
    ]);
    expect(r).toBeNull();
  });
});

describe('angleFromResolved', () => {
  it('2腕の点+接線から頂点と角度を復元する', () => {
    const r = angleFromResolved([
      { role: 'a', point: { x: 50, y: 0 }, tangent: { x: 1, y: 0 } },
      { role: 'b', point: { x: 0, y: 50 }, tangent: { x: 0, y: 1 } },
    ]);
    expect(r?.vertex.x).toBeCloseTo(0);
    expect(r?.vertex.y).toBeCloseTo(0);
    expect(r?.startAngle).toBeCloseTo(0);
    expect(r?.endAngle).toBeCloseTo(90);
  });

  it('腕が不足ならnull', () => {
    expect(angleFromResolved([{ role: 'a', point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 } }])).toBeNull();
  });
});
