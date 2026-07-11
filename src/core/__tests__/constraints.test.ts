import { describe, expect, it } from 'vitest';
import {
  findRotationLock,
  findTangentAnchor,
  isLengthConstrained,
  isRotationConstrained,
  isTangentAnchorRef,
  parallelOffset,
  perpendicularOffset,
  resolveCoincidentAnchor,
  resolveRef,
  solveConstraints,
  solveRigidRotation,
  solveTwoPointEndpoints,
  tangentAngleThroughPoint,
  type ConstraintIssue,
} from '../constraints';
import type { SceneObject, SceneObjects } from '../document';
import { localToWorld } from '../geometry';
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

// 線分系(両端の再構築が可能=2点拘束で長さが伸縮する)
const endpointPlugin = makeTestPlugin({
  id: 'test.endpoint',
  getEndpoints: (p) => [
    { x: -p.width / 2, y: 0 },
    { x: p.width / 2, y: 0 },
  ],
  setFromEndpoints: (p, a, b) => ({
    props: { ...p, width: Math.hypot(b.x - a.x, b.y - a.y) },
    transform: {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      rotation: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      scaleX: 1,
      scaleY: 1,
    },
  }),
});

// 円ターゲット(接線拘束の基準。半径=width/2)
const circlePlugin = makeTestPlugin({
  id: 'test.circle',
  getCircle: (p) => ({ center: { x: 0, y: 0 }, radius: p.width / 2 }),
});

// 楕円ターゲット(一致拘束の基準。半径X=width/2, 半径Y=height/2)
const ellipsePlugin = makeTestPlugin({
  id: 'test.ellipse',
  getEllipse: (p) => ({ center: { x: 0, y: 0 }, radiusX: p.width / 2, radiusY: p.height / 2 }),
});

const registry = new PluginRegistry();
registry.register(segPlugin);
registry.register(depPlugin);
registry.register(snapPlugin);
registry.register(endpointPlugin);
registry.register(circlePlugin);
registry.register(ellipsePlugin);

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

  it('楕円周上の媒介変数角度tの点をワールド座標で返す', () => {
    // width=100(rx=50), height=50(ry=25), 中心ワールド(100,100)
    const objects: SceneObjects = { e: obj('e', 'test.ellipse', 100, 100) };
    // t=0 は+x方向の周点=中心+(rx,0)
    const r0 = resolveRef({ role: 'coincident', targetId: 'e', kind: 'ellipse', t: 0 }, objects, registry);
    expect(r0?.point.x).toBeCloseTo(150);
    expect(r0?.point.y).toBeCloseTo(100);
    // t=90 は+y方向の周点=中心+(0,ry)
    const r90 = resolveRef({ role: 'coincident', targetId: 'e', kind: 'ellipse', t: 90 }, objects, registry);
    expect(r90?.point.x).toBeCloseTo(100);
    expect(r90?.point.y).toBeCloseTo(125);
  });

  it('楕円周に接線方向が付く(単独接線=applyTangent用)', () => {
    const objects: SceneObjects = { e: obj('e', 'test.ellipse', 0, 0) };
    // t=0(+x端)の接線は+y方向(rx≠ryでも端点では軸に一致)。2点法の微小誤差は許容(precision 1)
    const r0 = resolveRef({ role: 'anchor', targetId: 'e', kind: 'ellipse', t: 0 }, objects, registry);
    expect(r0?.tangent?.x).toBeCloseTo(0, 1);
    expect(Math.abs(r0?.tangent?.y ?? 0)).toBeCloseTo(1, 1);
    // t=90(+y端)の接線は±x方向
    const r90 = resolveRef({ role: 'anchor', targetId: 'e', kind: 'ellipse', t: 90 }, objects, registry);
    expect(Math.abs(r90?.tangent?.x ?? 0)).toBeCloseTo(1, 1);
    expect(r90?.tangent?.y).toBeCloseTo(0, 1);
  });

  it('回転した楕円でも媒介変数角度tがtransformで正しく反映される', () => {
    // rotation=90(画面時計回り): ローカル+x(rx=50)がワールド+yへ向く
    const objects: SceneObjects = {
      e: obj('e', 'test.ellipse', 0, 0, { transform: { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 } }),
    };
    const r = resolveRef({ role: 'coincident', targetId: 'e', kind: 'ellipse', t: 0 }, objects, registry);
    expect(r?.point.x).toBeCloseTo(0);
    expect(r?.point.y).toBeCloseTo(50);
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

  it('楕円周への一致拘束(kind:ellipse)で依存の局所アンカーが周点へ追従する', () => {
    // 依存 d(中心=localAnchor {0,0})を楕円 e の t=90 の周点へ一致させる
    const objects: SceneObjects = {
      e: obj('e', 'test.ellipse', 100, 100),
      d: obj('d', 'test.box', 0, 0, {
        refs: [{ role: 'coincident', targetId: 'e', kind: 'ellipse', t: 90, localAnchor: { x: 0, y: 0 } }],
      }),
    };
    const solved = solveConstraints(objects, registry);
    // e の +y 周点 = 中心(100,100)+(0, ry=25)
    expect(solved.d.transform.x).toBeCloseTo(100);
    expect(solved.d.transform.y).toBeCloseTo(125);
    // 楕円を動かすと一致点も追従する
    const moved: SceneObjects = { ...objects, e: obj('e', 'test.ellipse', 300, 100) };
    const solved2 = solveConstraints(moved, registry);
    expect(solved2.d.transform.x).toBeCloseTo(300);
    expect(solved2.d.transform.y).toBeCloseTo(125);
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

describe('中点拘束(role: coincident + midpoint)', () => {
  // 中点拘束はエッジ中点(kind:'segment', t:0.5)への一致拘束。midpointフラグは表示・
  // マーカー操作の区別用で、ソルバは通常の一致拘束とまったく同じに解く。
  function midpointRef(targetId: string, localAnchor: { x: number; y: number }) {
    return {
      role: 'coincident' as const,
      targetId,
      kind: 'segment' as const,
      segIndex: 0,
      t: 0.5,
      localAnchor,
      midpoint: true,
    };
  }

  it('動かす側の中点(局所原点)を基準エッジの中点へ一致させる', () => {
    const objects: SceneObjects = {
      // s の線分は中心(100,100)、幅100=(50,100)-(150,100)。中点=(100,100)
      s: obj('s', 'test.seg', 100, 100),
      d: obj('d', 'test.dep', 0, 0, { refs: [midpointRef('s', { x: 0, y: 0 })] }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.x).toBeCloseTo(100);
    expect(solved.d.transform.y).toBeCloseTo(100);
  });

  it('基準エッジを動かすと中点へ追従する(端点アンカーでも同様)', () => {
    const objects: SceneObjects = {
      s: obj('s', 'test.seg', 220, 80),
      // 端点をつかんだ想定: 局所(10,0)を中点(220,80)に合わせる → 中心=(210,80)
      d: obj('d', 'test.dep', 0, 0, { refs: [midpointRef('s', { x: 10, y: 0 })] }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.x).toBeCloseTo(210);
    expect(solved.d.transform.y).toBeCloseTo(80);
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

function coRef(targetId: string, pointIndex: number, localAnchor: { x: number; y: number }) {
  return { role: 'coincident', targetId, kind: 'point' as const, pointIndex, localAnchor };
}

describe('一致×2(2点拘束)', () => {
  it('線分の両端が2つの基準点へ一致し、長さも伸縮する', () => {
    const objects: SceneObjects = {
      s1: obj('s1', 'test.snap', 100, 100),
      s2: obj('s2', 'test.snap', 300, 100),
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [coRef('s1', 0, { x: -50, y: 0 }), coRef('s2', 0, { x: 50, y: 0 })],
      }),
    };
    const issues: ConstraintIssue[] = [];
    const solved = solveConstraints(objects, registry, issues);
    expect(issues).toHaveLength(0);
    expect((solved.d.props as { width: number }).width).toBeCloseTo(200);
    expect(solved.d.transform.x).toBeCloseTo(200);
    expect(solved.d.transform.y).toBeCloseTo(100);
    expect(solved.d.transform.rotation).toBeCloseTo(0);
    // 長さが変わったので localAnchor は新しい端点位置へ書き直される
    expect(solved.d.refs?.[0].localAnchor?.x).toBeCloseTo(-100);
    expect(solved.d.refs?.[1].localAnchor?.x).toBeCloseTo(100);
  });

  it('マスターを動かすと回転・長さ込みで追従し、再解決しても冪等', () => {
    const objects: SceneObjects = {
      s1: obj('s1', 'test.snap', 0, 0),
      s2: obj('s2', 'test.snap', 100, 0),
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [coRef('s1', 0, { x: -50, y: 0 }), coRef('s2', 0, { x: 50, y: 0 })],
      }),
    };
    const once = solveConstraints(objects, registry);
    // s2 を(0,200)へ移動 → 垂直な線分になる
    once.s2 = { ...once.s2, transform: { ...once.s2.transform, x: 0, y: 200 } };
    const twice = solveConstraints(once, registry);
    expect((twice.d.props as { width: number }).width).toBeCloseTo(200);
    expect(twice.d.transform.rotation).toBeCloseTo(90);
    // 冪等性: もう一度解いても変わらない
    const third = solveConstraints(twice, registry);
    expect(third.d.transform.x).toBeCloseTo(twice.d.transform.x);
    expect(third.d.transform.rotation).toBeCloseTo(twice.d.transform.rotation);
    expect((third.d.props as { width: number }).width).toBeCloseTo(200);
  });

  it('剛体(伸縮不可)は基準点間の距離が一致すれば回転で解ける', () => {
    const objects: SceneObjects = {
      s1: obj('s1', 'test.snap', 50, 50),
      s2: obj('s2', 'test.snap', 50, 150), // アンカー間と同じ距離100・垂直方向
      d: obj('d', 'test.snap', 0, 0, {
        refs: [coRef('s1', 0, { x: 0, y: 0 }), coRef('s2', 0, { x: 100, y: 0 })],
      }),
    };
    const issues: ConstraintIssue[] = [];
    const solved = solveConstraints(objects, registry, issues);
    expect(issues).toHaveLength(0);
    expect(solved.d.transform.rotation).toBeCloseTo(90);
    expect(solved.d.transform.x).toBeCloseTo(50);
    expect(solved.d.transform.y).toBeCloseTo(50);
  });

  it('剛体で距離が不一致なら過剰拘束(issue)になり、先着の一致は維持される', () => {
    const objects: SceneObjects = {
      s1: obj('s1', 'test.snap', 50, 50),
      s2: obj('s2', 'test.snap', 50, 200), // 距離150 ≠ アンカー間100
      d: obj('d', 'test.snap', 0, 0, {
        refs: [coRef('s1', 0, { x: 0, y: 0 }), coRef('s2', 0, { x: 100, y: 0 })],
      }),
    };
    const issues: ConstraintIssue[] = [];
    const solved = solveConstraints(objects, registry, issues);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ objectId: 'd', role: 'coincident', refIndex: 1 });
    // 先着(1本目)の一致は満たしたまま、回転は変えない
    expect(solved.d.transform.x).toBeCloseTo(50);
    expect(solved.d.transform.y).toBeCloseTo(50);
    expect(solved.d.transform.rotation).toBeCloseTo(0);
  });

  it('3本目の一致は自由度が無く過剰拘束(issue)', () => {
    const objects: SceneObjects = {
      s1: obj('s1', 'test.snap', 0, 0),
      s2: obj('s2', 'test.snap', 200, 0),
      s3: obj('s3', 'test.snap', 100, 80), // 線分上に無い
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [
          coRef('s1', 0, { x: -50, y: 0 }),
          coRef('s2', 0, { x: 50, y: 0 }),
          coRef('s3', 0, { x: 0, y: 0 }),
        ],
      }),
    };
    const issues: ConstraintIssue[] = [];
    solveConstraints(objects, registry, issues);
    expect(issues.some((i) => i.objectId === 'd' && i.refIndex === 2)).toBe(true);
  });

  it('2つの基準点が同じ位置なら解かずissue(線分が潰れない)', () => {
    const objects: SceneObjects = {
      s1: obj('s1', 'test.snap', 100, 100),
      s2: obj('s2', 'test.snap', 100, 100),
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [coRef('s1', 0, { x: -50, y: 0 }), coRef('s2', 0, { x: 50, y: 0 })],
      }),
    };
    const issues: ConstraintIssue[] = [];
    const solved = solveConstraints(objects, registry, issues);
    expect(issues).toHaveLength(1);
    expect((solved.d.props as { width: number }).width).toBeCloseTo(100); // 長さは保つ
  });
});

describe('拘束の優先度(refs配列順=先着優先)', () => {
  function parRef(targetId: string) {
    return { role: 'parallel', targetId, kind: 'segment' as const, segIndex: 0, t: 0.5, angleOffset: 0 };
  }

  it('平行が先なら、向きの軸から外れた2本目の一致はissue', () => {
    const objects: SceneObjects = {
      seg: obj('seg', 'test.seg', 500, 500), // 水平
      s1: obj('s1', 'test.snap', 0, 0),
      s2: obj('s2', 'test.snap', 100, 80), // 水平軸上に無い
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [parRef('seg'), coRef('s1', 0, { x: -50, y: 0 }), coRef('s2', 0, { x: 50, y: 0 })],
      }),
    };
    const issues: ConstraintIssue[] = [];
    const solved = solveConstraints(objects, registry, issues);
    expect(issues.some((i) => i.refIndex === 2)).toBe(true);
    expect(solved.d.transform.rotation).toBeCloseTo(0); // 先着の平行を維持
  });

  it('平行が先でも2本目の一致が軸上なら長さの伸縮で解ける', () => {
    const objects: SceneObjects = {
      seg: obj('seg', 'test.seg', 500, 500),
      s1: obj('s1', 'test.snap', 0, 0),
      s2: obj('s2', 'test.snap', 300, 0), // 水平軸上
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [parRef('seg'), coRef('s1', 0, { x: -50, y: 0 }), coRef('s2', 0, { x: 50, y: 0 })],
      }),
    };
    const issues: ConstraintIssue[] = [];
    const solved = solveConstraints(objects, registry, issues);
    expect(issues).toHaveLength(0);
    expect((solved.d.props as { width: number }).width).toBeCloseTo(300);
    expect(solved.d.transform.rotation).toBeCloseTo(0);
  });

  it('一致×2が先なら、後からの平行はissueになり解を変えない', () => {
    const objects: SceneObjects = {
      seg: obj('seg', 'test.seg', 500, 500, {
        transform: { x: 500, y: 500, rotation: 45, scaleX: 1, scaleY: 1 },
      }),
      s1: obj('s1', 'test.snap', 0, 0),
      s2: obj('s2', 'test.snap', 200, 0),
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [coRef('s1', 0, { x: -50, y: 0 }), coRef('s2', 0, { x: 50, y: 0 }), parRef('seg')],
      }),
    };
    const issues: ConstraintIssue[] = [];
    const solved = solveConstraints(objects, registry, issues);
    expect(issues.some((i) => i.role === 'parallel')).toBe(true);
    expect(solved.d.transform.rotation).toBeCloseTo(0); // 一致×2の解を維持
  });
});

describe('一致+接線(円周アンカーとの合成)', () => {
  function tanRef(targetId: string, t = 0) {
    return { role: 'anchor', targetId, kind: 'circle' as const, t };
  }

  it('一致点を通る円への接線角へ回転し、接点(t)を書き直す', () => {
    const objects: SceneObjects = {
      p: obj('p', 'test.snap', 0, 0),
      c: obj('c', 'test.circle', 100, 0), // 半径50
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [coRef('p', 0, { x: -50, y: 0 }), tanRef('c')],
      }),
    };
    const issues: ConstraintIssue[] = [];
    const solved = solveConstraints(objects, registry, issues);
    expect(issues).toHaveLength(0);
    // d(P,C)=100, r=50 → 接線角=±30°(現回転0に近い枝)
    expect(Math.abs(solved.d.transform.rotation)).toBeCloseTo(30);
    // 一致点(局所-50,0)は基準点(0,0)を保つ
    const anchorWorld = localToWorld({ x: -50, y: 0 }, solved.d.transform);
    expect(anchorWorld.x).toBeCloseTo(0);
    expect(anchorWorld.y).toBeCloseTo(0);
    // 接点角がrefへ書き込まれる(回転+30なら接点は円ローカル120°)
    expect(Math.abs(solved.d.refs?.[1].t ?? 0)).toBeCloseTo(120);
  });

  it('現在の回転に近い接線の枝を選ぶ', () => {
    const objects: SceneObjects = {
      p: obj('p', 'test.snap', 0, 0),
      c: obj('c', 'test.circle', 100, 0),
      d: obj('d', 'test.endpoint', 0, 0, {
        transform: { x: 0, y: 0, rotation: -20, scaleX: 1, scaleY: 1 },
        refs: [coRef('p', 0, { x: -50, y: 0 }), tanRef('c')],
      }),
    };
    const solved = solveConstraints(objects, registry);
    expect(solved.d.transform.rotation).toBeCloseTo(-30);
  });

  it('一致点が円の内側なら解なし(issue)で姿勢を保つ', () => {
    const objects: SceneObjects = {
      p: obj('p', 'test.snap', 0, 0),
      c: obj('c', 'test.circle', 30, 0), // 中心まで30 < 半径50
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [coRef('p', 0, { x: -50, y: 0 }), tanRef('c')],
      }),
    };
    const issues: ConstraintIssue[] = [];
    const solved = solveConstraints(objects, registry, issues);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ objectId: 'd', role: 'anchor', refIndex: 1 });
    expect(solved.d.transform.rotation).toBeCloseTo(0); // 回転は変えない
    // 一致(先着)は満たす
    const anchorWorld = localToWorld({ x: -50, y: 0 }, solved.d.transform);
    expect(anchorWorld.x).toBeCloseTo(0);
  });

  it('円を動かすと接線も追従する', () => {
    const objects: SceneObjects = {
      p: obj('p', 'test.snap', 0, 0),
      c: obj('c', 'test.circle', 100, 0),
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [coRef('p', 0, { x: -50, y: 0 }), tanRef('c')],
      }),
    };
    const once = solveConstraints(objects, registry);
    once.c = { ...once.c, transform: { ...once.c.transform, x: 100, y: 100 } };
    const twice = solveConstraints(once, registry);
    // d(P,C)=√2*100, β=asin(50/141.42)≈20.705° → 45-20.705≈24.295(前回30に近い枝)
    expect(twice.d.transform.rotation).toBeCloseTo(24.295, 2);
  });
});

describe('一致+接線(楕円周アンカーとの合成)', () => {
  function tanRef(targetId: string, t = 0) {
    return { role: 'anchor', targetId, kind: 'ellipse' as const, t };
  }
  // 横長楕円(rx=100, ry=50)を中心ワールド(200,0)へ置く
  const bigEllipse = (x: number, y: number) =>
    obj('e', 'test.ellipse', x, y, { props: { width: 200, height: 100 } });

  it('一致点を通る楕円への接線角へ回転し、接点(t)を書き直す', () => {
    const objects: SceneObjects = {
      p: obj('p', 'test.snap', 0, 0), // pin基準=原点
      e: bigEllipse(200, 0),
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [coRef('p', 0, { x: -50, y: 0 }), tanRef('e')],
      }),
    };
    const issues: ConstraintIssue[] = [];
    const solved = solveConstraints(objects, registry, issues);
    expect(issues).toHaveLength(0);
    // 一致点(局所-50,0)は基準点(0,0)を保つ
    const anchorWorld = localToWorld({ x: -50, y: 0 }, solved.d.transform);
    expect(anchorWorld.x).toBeCloseTo(0);
    expect(anchorWorld.y).toBeCloseTo(0);
    // 接点(媒介変数t)は±120°(横長楕円ゆえ円とは異なる角度)。回転はpin→接点の向きに一致
    const t = solved.d.refs![1].t!;
    expect(Math.abs(t)).toBeCloseTo(120);
    const rad = (t * Math.PI) / 180;
    const contact = { x: 200 + 100 * Math.cos(rad), y: 100 * 0.5 * Math.sin(rad) };
    const ang = (Math.atan2(contact.y, contact.x) * 180) / Math.PI;
    // 直線(原点→接点)の向き=解いた回転(=接線)
    expect(Math.abs(ang)).toBeCloseTo(Math.abs(solved.d.transform.rotation));
  });

  it('一致点が楕円の内側なら解なし(issue)で姿勢を保つ', () => {
    const objects: SceneObjects = {
      p: obj('p', 'test.snap', 0, 0),
      e: bigEllipse(30, 0), // 中心まで30 < rx=100 → 原点は楕円の内側
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [coRef('p', 0, { x: -50, y: 0 }), tanRef('e')],
      }),
    };
    const issues: ConstraintIssue[] = [];
    const solved = solveConstraints(objects, registry, issues);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ objectId: 'd', role: 'anchor', refIndex: 1 });
    expect(solved.d.transform.rotation).toBeCloseTo(0); // 回転は変えない
    const anchorWorld = localToWorld({ x: -50, y: 0 }, solved.d.transform); // 一致(先着)は満たす
    expect(anchorWorld.x).toBeCloseTo(0);
  });

  it('楕円を動かすと接線も追従する', () => {
    const objects: SceneObjects = {
      p: obj('p', 'test.snap', 0, 0),
      e: bigEllipse(200, 0),
      d: obj('d', 'test.endpoint', 0, 0, {
        refs: [coRef('p', 0, { x: -50, y: 0 }), tanRef('e')],
      }),
    };
    const once = solveConstraints(objects, registry);
    const rot1 = once.d.transform.rotation;
    once.e = { ...once.e, transform: { ...once.e.transform, y: 80 } };
    const twice = solveConstraints(once, registry);
    // 楕円を上へ動かすと接線角も変わる(追従している)
    expect(twice.d.transform.rotation).not.toBeCloseTo(rot1);
    // それでも一致点は基準点(0,0)を保つ
    const anchorWorld = localToWorld({ x: -50, y: 0 }, twice.d.transform);
    expect(anchorWorld.x).toBeCloseTo(0);
    expect(anchorWorld.y).toBeCloseTo(0);
  });
});

describe('純関数ヘルパ', () => {
  it('tangentAngleThroughPoint: 基本の接線角と内側の解なし', () => {
    expect(tangentAngleThroughPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 50, 0)).toBeCloseTo(30);
    expect(tangentAngleThroughPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 50, -20)).toBeCloseTo(-30);
    expect(tangentAngleThroughPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 150, 0)).toBeNull();
    // 半径0=点を通る直線
    expect(tangentAngleThroughPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 0, 10)).toBeCloseTo(0);
  });

  it('solveTwoPointEndpoints: 両端・中点+端点・同一パラメタ', () => {
    const both = solveTwoPointEndpoints(0, 1, { x: 10, y: 20 }, { x: 110, y: 20 });
    expect(both?.a).toEqual({ x: 10, y: 20 });
    expect(both?.b).toEqual({ x: 110, y: 20 });
    const mid = solveTwoPointEndpoints(0.5, 1, { x: 0, y: 0 }, { x: 50, y: 0 });
    expect(mid?.a.x).toBeCloseTo(-50);
    expect(mid?.b.x).toBeCloseTo(50);
    expect(solveTwoPointEndpoints(0.3, 0.3, { x: 0, y: 0 }, { x: 50, y: 0 })).toBeNull();
  });

  it('solveRigidRotation: 距離一致で回転、不一致でnull', () => {
    expect(solveRigidRotation({ x: 100, y: 0 }, { x: 0, y: 100 })).toBeCloseTo(90);
    expect(solveRigidRotation({ x: 100, y: 0 }, { x: 0, y: 150 })).toBeNull();
    expect(solveRigidRotation({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
  });
});

describe('isRotationConstrained', () => {
  const par = { role: 'parallel', targetId: 's', kind: 'segment' as const };
  const co1 = { role: 'coincident', targetId: 's', kind: 'point' as const };
  const co2 = { role: 'coincident', targetId: 't', kind: 'point' as const };
  const tan = { role: 'anchor', targetId: 'c', kind: 'circle' as const };

  it('平行/垂直、一致×2、一致+接線で回転が拘束される', () => {
    expect(isRotationConstrained([par])).toBe(true);
    expect(isRotationConstrained([co1, co2])).toBe(true);
    expect(isRotationConstrained([co1, tan])).toBe(true);
  });

  it('一致×1のみ・接線のみ・refs無しは拘束されない', () => {
    expect(isRotationConstrained([co1])).toBe(false);
    expect(isRotationConstrained([tan])).toBe(false);
    expect(isRotationConstrained(undefined)).toBe(false);
    expect(isRotationConstrained([])).toBe(false);
  });
});

describe('isLengthConstrained', () => {
  const co1 = { role: 'coincident', targetId: 's', kind: 'point' as const };
  const co2 = { role: 'coincident', targetId: 't', kind: 'point' as const };
  const tan = { role: 'anchor', targetId: 'c', kind: 'circle' as const };

  it('一致×2(2点拘束)で長さが確定する', () => {
    expect(isLengthConstrained([co1, co2])).toBe(true);
  });

  it('一致×1・一致+接線・refs無しは長さ自由', () => {
    expect(isLengthConstrained([co1])).toBe(false);
    expect(isLengthConstrained([co1, tan])).toBe(false);
    expect(isLengthConstrained(undefined)).toBe(false);
  });
});

describe('findTangentAnchor', () => {
  const tan = { role: 'anchor', targetId: 'c', kind: 'circle' as const };
  const tanEllipse = { role: 'anchor', targetId: 'e', kind: 'ellipse' as const };
  // 周へ一致させた拘束。kind は circle/ellipse だが接線ではない(誤検出防止の要)
  const coCircle = { role: 'coincident', targetId: 'c', kind: 'circle' as const, t: 0 };
  const coEllipse = { role: 'coincident', targetId: 'e', kind: 'ellipse' as const, t: 0 };
  const coPoint = { role: 'coincident', targetId: 's', kind: 'point' as const };

  it('接線(role:anchor, kind:circle|ellipse)を拾う', () => {
    expect(findTangentAnchor([tan])).toBe(tan);
    expect(findTangentAnchor([coPoint, tan])).toBe(tan);
    expect(findTangentAnchor([tanEllipse])).toBe(tanEllipse);
    expect(findTangentAnchor([coPoint, tanEllipse])).toBe(tanEllipse);
  });

  it('周への一致拘束(role:coincident)は接線として拾わない', () => {
    expect(findTangentAnchor([coCircle])).toBeUndefined();
    expect(findTangentAnchor([coEllipse])).toBeUndefined();
    expect(findTangentAnchor([coPoint, coCircle])).toBeUndefined();
    expect(findTangentAnchor(undefined)).toBeUndefined();
    expect(findTangentAnchor([])).toBeUndefined();
  });

  it('isTangentAnchorRef: role=anchor かつ kind=circle|ellipse のみ真', () => {
    expect(isTangentAnchorRef(tan)).toBe(true);
    expect(isTangentAnchorRef(tanEllipse)).toBe(true);
    expect(isTangentAnchorRef(coCircle)).toBe(false);
    expect(isTangentAnchorRef(coEllipse)).toBe(false);
    expect(isTangentAnchorRef(coPoint)).toBe(false);
  });
});
