import { describe, expect, it } from 'vitest';
import type { ResolvedRef } from '../../../core/plugin';
import { identityTransform, type Transform } from '../../../core/types';
import { linePlugin } from '../line';

const baseProps = { ...linePlugin.defaultProps, length: 100 };

describe('line applyRefs(接線拘束)', () => {
  it('tangentOffset=0は接点=中点を円周アンカーに合わせ接線方向へ回転', () => {
    const resolved: ResolvedRef[] = [
      { role: 'anchor', point: { x: 100, y: 100 }, tangent: { x: 0, y: 1 } },
    ];
    const res = linePlugin.applyRefs!(baseProps, resolved, identityTransform());
    expect(res.transform.x).toBeCloseTo(100);
    expect(res.transform.y).toBeCloseTo(100);
    expect(res.transform.rotation).toBeCloseTo(90);
  });

  it('tangentOffsetがあると接点が中点からずれる(中心=接点-接線*off)', () => {
    const resolved: ResolvedRef[] = [
      { role: 'anchor', point: { x: 100, y: 100 }, tangent: { x: 0, y: 1 } },
    ];
    const res = linePlugin.applyRefs!({ ...baseProps, tangentOffset: 20 }, resolved, identityTransform());
    expect(res.transform.x).toBeCloseTo(100);
    expect(res.transform.y).toBeCloseTo(80); // 100 - 1*20
  });
});

describe('line dragEndpointConstrained(片側長さ変更)', () => {
  const transform: Transform = { x: 100, y: 100, rotation: 90, scaleX: 1, scaleY: 1 };

  it('端点1を接点から80へ伸ばすと長さ130・tangentOffset -15', () => {
    // 縦向き(da=(0,1))、length100、off0 → 端点は(100,50)と(100,150)
    const res = linePlugin.dragEndpointConstrained!(baseProps, transform, 1, { x: 100, y: 180 });
    // s1: (180-100)=80, s0=-50 → length=130, off=-(-50+80)/2=-15
    expect(res.length).toBeCloseTo(130);
    expect(res.tangentOffset).toBeCloseTo(-15);
  });

  it('反対端(端点0)は固定され最小長を割らない', () => {
    const res = linePlugin.dragEndpointConstrained!(baseProps, transform, 1, { x: 100, y: 40 });
    // s=-60 < s0(-50)+1 → クランプ s1=-49, length=1
    expect(res.length).toBeGreaterThanOrEqual(1);
  });
});

describe('line getAnchorPoint', () => {
  it('接点のローカル位置=(tangentOffset,0)', () => {
    expect(linePlugin.getAnchorPoint!({ ...baseProps, tangentOffset: 12 })).toEqual({ x: 12, y: 0 });
  });
});

describe('line isLengthLocked', () => {
  it('既定はfalse、lengthLocked:trueでtrueを返す', () => {
    expect(linePlugin.isLengthLocked!(baseProps)).toBe(false);
    expect(linePlugin.isLengthLocked!({ ...baseProps, lengthLocked: true })).toBe(true);
  });
});

describe('line isAngleLocked', () => {
  it('既定はfalse、angleLocked:trueでtrueを返す', () => {
    expect(linePlugin.isAngleLocked!(baseProps)).toBe(false);
    expect(linePlugin.isAngleLocked!({ ...baseProps, angleLocked: true })).toBe(true);
  });
});
