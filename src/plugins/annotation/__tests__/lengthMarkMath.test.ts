import { describe, expect, it } from 'vitest';
import type { ResolvedRef } from '../../../core/plugin';
import { lengthMarkFromResolved } from '../lengthMarkMath';

describe('lengthMarkFromResolved', () => {
  it('線分の2点(p0,p1)から長さと中心を求める', () => {
    const resolved: ResolvedRef[] = [
      { role: 'p0', point: { x: 0, y: 0 } },
      { role: 'p1', point: { x: 100, y: 0 } },
    ];
    const r = lengthMarkFromResolved(resolved, 'radius');
    expect(r?.length).toBeCloseTo(100);
    expect(r?.transform.x).toBeCloseTo(50);
    expect(r?.transform.rotation).toBeCloseTo(0);
  });

  it('円のradiusモードは中心→円周の半径を測る', () => {
    // 円周上の点(50,0)、接線+y方向、半径50 → 中心は(0,0)
    const resolved: ResolvedRef[] = [
      { role: 'circle', point: { x: 50, y: 0 }, tangent: { x: 0, y: 1 }, radius: 50 },
    ];
    const r = lengthMarkFromResolved(resolved, 'radius');
    expect(r?.length).toBeCloseTo(50);
    // 中心(0,0)→円周(50,0) の中点(25,0)
    expect(r?.transform.x).toBeCloseTo(25);
    expect(r?.transform.y).toBeCloseTo(0);
  });

  it('円のdiameterモードは直径を測る', () => {
    const resolved: ResolvedRef[] = [
      { role: 'circle', point: { x: 50, y: 0 }, tangent: { x: 0, y: 1 }, radius: 50 },
    ];
    const r = lengthMarkFromResolved(resolved, 'diameter');
    expect(r?.length).toBeCloseTo(100);
    // (50,0)と反対側(-50,0)の中点(0,0)
    expect(r?.transform.x).toBeCloseTo(0);
  });

  it('参照不足ならnull', () => {
    expect(lengthMarkFromResolved([{ role: 'p0', point: { x: 0, y: 0 } }], 'radius')).toBeNull();
  });
});
