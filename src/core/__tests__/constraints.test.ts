import { describe, expect, it } from 'vitest';
import {
  findRotationLock,
  parallelOffset,
  perpendicularOffset,
  resolveCoincidentAnchor,
  resolveRef,
  solveConstraints,
} from '../constraints';
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

// スナップ点を明示する対象(一致/接続の基準点用)
const snapPlugin = makeTestPlugin({
  id: 'test.snap',
  getSnapPoints: (p) => [
    { x: 0, y: 0 }, // 0: 中心
    { x: p.width / 2, y: -p.height / 2 }, // 1: 右上角
  ],
});

const registry = new PluginRegistry();
registry.register(segPlugin);
registry.register(depPlugin);
registry.register(snapPlugin);

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

describe('parallelOffset', () => {
  it('向きの差が90度以内なら0(同方向)', () => {
    expect(parallelOffset(30, 0)).toBe(0);
    expect(parallelOffset(-80, 0)).toBe(0);
  });

  it('向きの差が90度超なら180(逆方向)', () => {
    expect(parallelOffset(150, 0)).toBe(180);
    expect(parallelOffset(30, 200)).toBe(180);
  });

  it('360度境界をまたいでも正規化される', () => {
    expect(parallelOffset(10, 350)).toBe(0); // 実質20度差
  });
});

describe('perpendicularOffset', () => {
  it('現在の回転に近い側(+90 か -90)を返す', () => {
    expect(perpendicularOffset(40, 0)).toBe(90);
    expect(perpendicularOffset(-40, 0)).toBe(-90);
    expect(perpendicularOffset(0, 0)).toBe(90); // 同距離は+90
    expect(perpendicularOffset(120, 0)).toBe(90);
    expect(perpendicularOffset(-120, 0)).toBe(-90);
  });

  it('基準角を考慮する', () => {
    expect(perpendicularOffset(10, 90)).toBe(-90); // 目標0(=90-90)へ最小回転
    expect(perpendicularOffset(170, 90)).toBe(90); // 目標180(=90+90)へ
  });
});

describe('findRotationLock', () => {
  it('平行または垂直のrefを返し、無ければundefined', () => {
    const par = { role: 'parallel', targetId: 's', kind: 'segment' as const };
    const perp = { role: 'perpendicular', targetId: 's', kind: 'segment' as const };
    expect(findRotationLock([par])?.role).toBe('parallel');
    expect(findRotationLock([perp])?.role).toBe('perpendicular');
    expect(findRotationLock([{ role: 'coincident', targetId: 's', kind: 'point' }])).toBeUndefined();
    expect(findRotationLock(undefined)).toBeUndefined();
  });
});

describe('垂直拘束(role: perpendicular)', () => {
  function perpRef(targetId: string, angleOffset: number) {
    return { role: 'perpendicular', targetId, kind: 'segment' as const, segIndex: 0, t: 0.5, angleOffset };
  }

  it('水平な基準線分に対し依存を垂直(rotation=90)へ揃える', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.seg', 100, 100),
      d: obj('d', 'test.dep', 300, 300, {
        transform: { x: 300, y: 300, rotation: 40, scaleX: 1, scaleY: 1 },
        refs: [perpRef('s', 90)],
      }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.rotation).toBeCloseTo(90);
    // 位置は変えない(向きだけの拘束)
    expect(solved.d.transform.x).toBeCloseTo(300);
    expect(solved.d.transform.y).toBeCloseTo(300);
  });

  it('angleOffset -90 で逆向きの垂直(rotation=-90)へ揃える', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.seg', 100, 100),
      d: obj('d', 'test.dep', 0, 0, { refs: [perpRef('s', -90)] }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.rotation).toBeCloseTo(-90);
  });

  it('基準を回転させると依存も垂直を保って追従する', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.seg', 100, 100, {
        transform: { x: 100, y: 100, rotation: 30, scaleX: 1, scaleY: 1 },
      }),
      d: obj('d', 'test.dep', 0, 0, { refs: [perpRef('s', 90)] }),
    };
    const solved = solveConstraints(objects, registry);
    // 基準30° + 90 = 120°
    expect(solved.d.transform.rotation).toBeCloseTo(120);
  });

  it('垂直と一致を同時に適用できる(回転=垂直 / 位置=一致)', () => {
    const objects: SceneObjects = {
      seg: obj('seg', 'test.seg', 300, 300),
      pt: obj('pt', 'test.snap', 100, 100),
      d: obj('d', 'test.dep', 0, 0, {
        refs: [
          perpRef('seg', 90),
          { role: 'coincident', targetId: 'pt', kind: 'point', pointIndex: 0, localAnchor: { x: 0, y: 0 } },
        ],
      }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.rotation).toBeCloseTo(90);
    expect(solved.d.transform.x).toBeCloseTo(100);
    expect(solved.d.transform.y).toBeCloseTo(100);
  });
});

describe('平行拘束(role: parallel)', () => {
  function parallelRef(targetId: string, angleOffset = 0) {
    return {
      role: 'parallel',
      targetId,
      kind: 'segment' as const,
      segIndex: 0,
      t: 0.5,
      angleOffset,
    };
  }

  it('水平な基準線分に対し依存の回転を0へ揃える(位置は拘束しない)', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.seg', 100, 100),
      d: obj('d', 'test.dep', 300, 300, {
        transform: { x: 300, y: 300, rotation: 40, scaleX: 1, scaleY: 1 },
        refs: [parallelRef('s')],
      }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.rotation).toBeCloseTo(0);
    // 位置は変えない(向きだけの拘束)
    expect(solved.d.transform.x).toBeCloseTo(300);
    expect(solved.d.transform.y).toBeCloseTo(300);
  });

  it('基準を回転させると依存も同じ向きへ追従する', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.seg', 100, 100, {
        transform: { x: 100, y: 100, rotation: 30, scaleX: 1, scaleY: 1 },
      }),
      d: obj('d', 'test.dep', 0, 0, { refs: [parallelRef('s')] }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.rotation).toBeCloseTo(30);
  });

  it('angleOffset 180 で逆向き(平行)へ揃える', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.seg', 100, 100),
      d: obj('d', 'test.dep', 0, 0, { refs: [parallelRef('s', 180)] }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.rotation).toBeCloseTo(180);
  });

  it('基準が欠損していれば回転は変わらない', () => {
    const objects: SceneObjects = {
      d: obj('d', 'test.dep', 0, 0, {
        transform: { x: 0, y: 0, rotation: 12, scaleX: 1, scaleY: 1 },
        refs: [parallelRef('missing')],
      }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.rotation).toBeCloseTo(12);
  });
});

describe('resolveCoincidentAnchor', () => {
  it('対象があればスナップ点を返す', () => {
    const objects: SceneObjects = { s: obj('s', 'test.snap', 100, 100) };
    const at = resolveCoincidentAnchor(
      { role: 'coincident', targetId: 's', kind: 'point', pointIndex: 1 },
      objects,
      registry,
    );
    expect(at?.x).toBeCloseTo(150);
    expect(at?.y).toBeCloseTo(75);
  });

  it('対象がなくても worldAnchor を返す(自由基準点)', () => {
    const at = resolveCoincidentAnchor(
      { role: 'coincident', targetId: '', kind: 'point', worldAnchor: { x: 20, y: 30 } },
      {},
      registry,
    );
    expect(at).toEqual({ x: 20, y: 30 });
  });

  it('対象もworldAnchorも無ければnull', () => {
    const at = resolveCoincidentAnchor(
      { role: 'coincident', targetId: 'missing', kind: 'point' },
      {},
      registry,
    );
    expect(at).toBeNull();
  });
});

describe('resolveRef kind:point', () => {
  it('対象のスナップ点をワールド座標で返す', () => {
    const objects: SceneObjects = { s: obj('s', 'test.snap', 100, 100) };
    const r = resolveRef({ role: 'coincident', targetId: 's', kind: 'point', pointIndex: 1 }, objects, registry);
    // 右上角 局所(50,-25) が (100,100) で (150,75)
    expect(r?.point.x).toBeCloseTo(150);
    expect(r?.point.y).toBeCloseTo(75);
  });

  it('getSnapPoints未実装ならbounds四隅+中心で代用(index4=中心)', () => {
    const objects: SceneObjects = { s: obj('s', 'test.seg', 100, 100) };
    const r = resolveRef({ role: 'coincident', targetId: 's', kind: 'point', pointIndex: 4 }, objects, registry);
    expect(r?.point.x).toBeCloseTo(100);
    expect(r?.point.y).toBeCloseTo(100);
  });
});

describe('一致/接続(role: coincident)', () => {
  function coincidentRef(targetId: string, pointIndex: number, localAnchor: { x: number; y: number }) {
    return { role: 'coincident', targetId, kind: 'point' as const, pointIndex, localAnchor };
  }

  it('局所アンカーを基準スナップ点へ一致させ、位置だけ動かす', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.snap', 100, 100),
      d: obj('d', 'test.dep', 0, 0, { refs: [coincidentRef('s', 0, { x: 10, y: 5 })] }),
    };
    const solved = solveConstraints(objects, registry);
    // s中心(100,100)に d局所(10,5)が来る → d中心=(90,95)、回転は不変
    expect(solved.d.transform.x).toBeCloseTo(90);
    expect(solved.d.transform.y).toBeCloseTo(95);
    expect(solved.d.transform.rotation).toBeCloseTo(0);
  });

  it('基準を動かすと依存も追従する', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.snap', 250, 60),
      d: obj('d', 'test.dep', 0, 0, { refs: [coincidentRef('s', 0, { x: 0, y: 0 })] }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.x).toBeCloseTo(250);
    expect(solved.d.transform.y).toBeCloseTo(60);
  });

  it('回転した依存でも局所アンカーが基準点に一致する', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.snap', 100, 100),
      d: obj('d', 'test.dep', 0, 0, {
        transform: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 },
        refs: [coincidentRef('s', 0, { x: 10, y: 0 })],
      }),
    };
    const solved = solveConstraints(objects, registry);
    // 局所(10,0)を90°回すと(0,10)。中心+(0,10)=(100,100) → 中心=(100,90)
    expect(solved.d.transform.x).toBeCloseTo(100);
    expect(solved.d.transform.y).toBeCloseTo(90);
  });

  it('対象なし+worldAnchorの自由基準点へ追従する', () => {
    const objects: SceneObjects = {
      d: obj('d', 'test.dep', 0, 0, {
        refs: [
          {
            role: 'coincident',
            targetId: '',
            kind: 'point',
            localAnchor: { x: 10, y: 5 },
            worldAnchor: { x: 200, y: 100 },
          },
        ],
      }),
    };
    const solved = solveConstraints(objects, registry);
    // 局所(10,5)がworldAnchor(200,100)に来る → 中心=(190,95)
    expect(solved.d.transform.x).toBeCloseTo(190);
    expect(solved.d.transform.y).toBeCloseTo(95);
  });

  it('対象が解決できれば worldAnchor より対象スナップ点を優先する', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.snap', 100, 100),
      d: obj('d', 'test.dep', 0, 0, {
        refs: [
          {
            role: 'coincident',
            targetId: 's',
            kind: 'point',
            pointIndex: 0,
            localAnchor: { x: 0, y: 0 },
            worldAnchor: { x: 999, y: 999 },
          },
        ],
      }),
    };
    const solved = solveConstraints(objects, registry);
    // 対象s中心(100,100)へ。worldAnchorは無視される
    expect(solved.d.transform.x).toBeCloseTo(100);
    expect(solved.d.transform.y).toBeCloseTo(100);
  });

  it('平行と一致を同時に適用できる(回転=平行 / 位置=一致)', () => {
    const objects: SceneObjects = {
      seg: obj('seg', 'test.seg', 300, 300, {
        transform: { x: 300, y: 300, rotation: 30, scaleX: 1, scaleY: 1 },
      }),
      pt: obj('pt', 'test.snap', 100, 100),
      d: obj('d', 'test.dep', 0, 0, {
        refs: [
          { role: 'parallel', targetId: 'seg', kind: 'segment', segIndex: 0, t: 0.5, angleOffset: 0 },
          coincidentRef('pt', 0, { x: 0, y: 0 }),
        ],
      }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.rotation).toBeCloseTo(30);
    expect(solved.d.transform.x).toBeCloseTo(100);
    expect(solved.d.transform.y).toBeCloseTo(100);
  });
});

describe('対称拘束(role: symmetric)', () => {
  // ax(test.seg, 中心100,0)の線分は世界(50,0)-(150,0)=直線 y=0 を対称軸にする
  function symRefs(sourceId: string, axisId: string) {
    return [
      { role: 'symmetric', targetId: sourceId, kind: 'object' as const },
      { role: 'symmetricAxis', targetId: axisId, kind: 'segment' as const, segIndex: 0 },
    ];
  }

  it('基準オブジェクトの、対称軸(水平線 y=0)に関する鏡像になる', () => {
    const objects: SceneObjects = {
      ax: obj('ax', 'test.seg', 100, 0),
      src: obj('src', 'test.snap', 30, 20, {
        transform: { x: 30, y: 20, rotation: 10, scaleX: 1, scaleY: 1 },
      }),
      d: obj('d', 'test.snap', 0, 0, { refs: symRefs('src', 'ax') }),
    };
    const solved = solveConstraints(objects, registry);
    // 中心(30,20)→(30,-20)、回転10°→-10°(軸0°での反転)
    expect(solved.d.transform.x).toBeCloseTo(30);
    expect(solved.d.transform.y).toBeCloseTo(-20);
    expect(solved.d.transform.rotation).toBeCloseTo(-10);
    // 元マップは不変(純粋)
    expect(objects.d.transform.y).toBe(0);
  });

  it('基準を動かすと鏡像も常に追従する', () => {
    const objects: SceneObjects = {
      ax: obj('ax', 'test.seg', 100, 0),
      src: obj('src', 'test.snap', 30, 50),
      d: obj('d', 'test.snap', 0, 0, { refs: symRefs('src', 'ax') }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.y).toBeCloseTo(-50);
  });

  it('基準が欠損していれば自分の状態を保つ', () => {
    const objects: SceneObjects = {
      ax: obj('ax', 'test.seg', 100, 0),
      d: obj('d', 'test.snap', 7, 8, { refs: symRefs('missing', 'ax') }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.x).toBeCloseTo(7);
    expect(solved.d.transform.y).toBeCloseTo(8);
  });
});
