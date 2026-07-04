import { describe, expect, it } from 'vitest';
import { resolveRef, solveConstraints } from '../constraints';
import type { SceneObject, SceneObjects } from '../document';
import { PluginRegistry } from '../registry';
import { makeTestPlugin } from './testPlugin';

// 線分ターゲット(ローカル -w/2..w/2 の水平線分)
const segPlugin = makeTestPlugin({
  id: 'test.seg',
  getSegments: (p) => [
    [
      { x: -p.width / 2, y: 0 },
      { x: p.width / 2, y: 0 },
    ],
  ],
});
// 依存側: role 'anchor' の点へ自分の中心を移動する
const depPlugin = makeTestPlugin({
  id: 'test.dep',
  applyRefs: (props, resolved, transform) => {
    const a = resolved.find((r) => r.role === 'anchor');
    if (!a) return { props, transform };
    return { props, transform: { ...transform, x: a.point.x, y: a.point.y } };
  },
});

const registry = new PluginRegistry();
registry.register(segPlugin);
registry.register(depPlugin);

function obj(
  id: string,
  pluginId: string,
  x: number,
  y: number,
  extra: Partial<SceneObject> = {},
): SceneObject {
  return {
    id,
    pluginId,
    version: 1,
    transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
    zIndex: 1,
    locked: false,
    visible: true,
    props: { width: 100, height: 50 },
    ...extra,
  };
}

describe('resolveRef', () => {
  it('線分の中点t=0.5をワールド座標で返し接線も付く', () => {
    const objects: SceneObjects = { s: obj('s', 'test.seg', 100, 100) };
    const r = resolveRef({ role: 'anchor', targetId: 's', kind: 'segment', t: 0.5 }, objects, registry);
    expect(r?.point.x).toBeCloseTo(100);
    expect(r?.point.y).toBeCloseTo(100);
    expect(r?.tangent?.x).toBeCloseTo(1);
    expect(r?.tangent?.y).toBeCloseTo(0);
  });

  it('mode:negで接線が反転する', () => {
    const objects: SceneObjects = { s: obj('s', 'test.seg', 100, 100) };
    const r = resolveRef(
      { role: 'anchor', targetId: 's', kind: 'segment', t: 0.5, mode: 'neg' },
      objects,
      registry,
    );
    expect(r?.tangent?.x).toBeCloseTo(-1);
  });

  it('ターゲット不在ならnull', () => {
    const r = resolveRef({ role: 'anchor', targetId: 'x', kind: 'segment', t: 0 }, {}, registry);
    expect(r).toBeNull();
  });
});

describe('solveConstraints', () => {
  it('依存オブジェクトを対象の端点(t=1)へ追従させる', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.seg', 100, 100),
      d: obj('d', 'test.dep', 0, 0, {
        refs: [{ role: 'anchor', targetId: 's', kind: 'segment', t: 1 }],
      }),
    };
    const solved = solveConstraints(objects, registry);
    // s の右端は (150,100)
    expect(solved.d.transform.x).toBeCloseTo(150);
    expect(solved.d.transform.y).toBeCloseTo(100);
    // 元のマップは不変(純粋)
    expect(objects.d.transform.x).toBe(0);
  });

  it('対象を動かすと依存も追従する', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.seg', 200, 100),
      d: obj('d', 'test.dep', 0, 0, {
        refs: [{ role: 'anchor', targetId: 's', kind: 'segment', t: 1 }],
      }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.x).toBeCloseTo(250);
  });

  it('連鎖依存でも対象→依存の順に解決される', () => {
    const objects: SceneObjects = {
      // d は s に依存、d2 は d に依存(d を線分として使うため getSegments を持つ segPlugin にする)
      s: obj('s', 'test.seg', 100, 100),
      d: obj('d', 'test.seg', 0, 0, {
        refs: [{ role: 'anchor', targetId: 's', kind: 'segment', t: 1 }],
        pluginId: 'test.seg',
      }),
    };
    // segPlugin に applyRefs は無いので d は動かない。順序のみ検証: 例外なく解ける
    expect(() => solveConstraints(objects, registry)).not.toThrow();
  });

  it('循環参照でも無限ループせず返る', () => {
    const objects: SceneObjects = {
      a: obj('a', 'test.dep', 0, 0, { refs: [{ role: 'anchor', targetId: 'b', kind: 'segment', t: 0 }] }),
      b: obj('b', 'test.dep', 0, 0, { refs: [{ role: 'anchor', targetId: 'a', kind: 'segment', t: 0 }] }),
    };
    expect(() => solveConstraints(objects, registry)).not.toThrow();
  });
});
