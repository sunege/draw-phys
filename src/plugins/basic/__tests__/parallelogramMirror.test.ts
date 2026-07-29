import { describe, expect, it } from 'vitest';
import { localToWorld, reflectPoint } from '../../../core/geometry';
import type { Transform } from '../../../core/types';
import { parallelogramPlugin } from '../parallelogram';
import { parallelogramVertices } from '../parallelogramMath';

const props = { ...parallelogramPlugin.defaultProps, width: 100, sideLength: 60, angle: 60 };

/** 対称軸を張る2点(x=40 の鉛直線 / 斜め線) */
const axes: [string, [{ x: number; y: number }, { x: number; y: number }]][] = [
  ['鉛直軸', [{ x: 40, y: -10 }, { x: 40, y: 10 }]],
  ['斜め軸', [{ x: -20, y: 0 }, { x: 30, y: 45 }]],
];

describe('parallelogram.mirror', () => {
  it('挟角が補角になる(右上がり↔左上がり)', () => {
    const t: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    const r = parallelogramPlugin.mirror!(props, t, axes[0][1][0], axes[0][1][1]);
    expect(r.props.angle).toBeCloseTo(120);
  });

  it.each(axes)('%s: 全頂点が軸に関する鏡像位置へ移る', (_name, [a, b]) => {
    const t: Transform = { x: 60, y: -30, rotation: 25, scaleX: 1, scaleY: 1 };
    const r = parallelogramPlugin.mirror!(props, t, a, b);
    const before = parallelogramVertices(props).map((p) => reflectPoint(localToWorld(p, t), a, b));
    const after = parallelogramVertices(r.props).map((p) => localToWorld(p, r.transform));
    // 反射で頂点の巡回向きが逆転するため、集合として一致するかで比べる
    const key = (p: { x: number; y: number }) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
    expect(after.map(key).sort()).toEqual(before.map(key).sort());
  });
});
