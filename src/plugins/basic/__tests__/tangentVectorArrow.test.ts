import { describe, expect, it } from 'vitest';
import type { AnyPlugin, ResolvedRef } from '../../../core/plugin';
import { identityTransform } from '../../../core/types';
import { forceVectorPlugin } from '../../mechanics/forceVector';
import { vectorPlugin } from '../../mechanics/vector';
import { arrowPlugin } from '../arrow';

/** 矢印・ベクトル・力ベクトルも線と同じ接線拘束フックを備える */
const cases: [string, AnyPlugin][] = [
  ['矢印', arrowPlugin as AnyPlugin],
  ['ベクトル', vectorPlugin as AnyPlugin],
  ['力ベクトル', forceVectorPlugin as AnyPlugin],
];

describe.each(cases)('%s の接線拘束', (_name, plugin) => {
  const props = { ...plugin.defaultProps, length: 100 };

  it('applyRefsで接点を円周アンカーへ合わせ接線方向へ回転する', () => {
    const resolved: ResolvedRef[] = [
      { role: 'anchor', point: { x: 100, y: 100 }, tangent: { x: 0, y: 1 } },
    ];
    const res = plugin.applyRefs!(props, resolved, identityTransform());
    expect(res.transform.x).toBeCloseTo(100);
    expect(res.transform.y).toBeCloseTo(100);
    expect(res.transform.rotation).toBeCloseTo(90);
  });

  it('getAnchorPointは接点のローカル位置(tangentOffset,0)を返す', () => {
    expect(plugin.getAnchorPoint!({ ...props, tangentOffset: 12 })).toEqual({ x: 12, y: 0 });
  });

  it('dragEndpointConstrainedで片側長さのみ変える', () => {
    const transform = { x: 100, y: 100, rotation: 90, scaleX: 1, scaleY: 1 };
    const res = plugin.dragEndpointConstrained!(props, transform, 1, { x: 100, y: 180 });
    expect(res.length).toBeCloseTo(130);
    expect(res.tangentOffset).toBeCloseTo(-15);
  });
});
