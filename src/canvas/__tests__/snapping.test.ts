import { describe, expect, it } from 'vitest';
import { makeTestPlugin } from '../../core/__tests__/testPlugin';
import { createSceneObject, type SceneObjects } from '../../core/document';
import { PluginRegistry } from '../../core/registry';
import {
  projectAnchorPoint,
  snapAnchorPoint,
  snapEndpoint,
  snapMovement,
  snapWorldPoint,
} from '../snapping';

// 100x50 中心原点のテストプラグイン(スナップ点はバウンディング角+中心)
const plugin = makeTestPlugin();

describe('snapMovement', () => {
  it('スナップ無効時は生の移動量を返す', () => {
    const moving = createSceneObject(plugin, { x: 0, y: 0 }, 1);
    const result = snapMovement({
      rawDx: 13,
      rawDy: 7,
      movingBefore: { [moving.id]: moving.transform },
      snapEnabled: false,
      gridSize: 10,
    });
    expect(result).toEqual({ dx: 13, dy: 7 });
  });

  it('グリッドへスナップする', () => {
    const moving = createSceneObject(plugin, { x: 0, y: 0 }, 1);
    const result = snapMovement({
      rawDx: 13,
      rawDy: 7,
      movingBefore: { [moving.id]: moving.transform },
      snapEnabled: true,
      gridSize: 10,
    });
    expect(result.dx).toBe(10);
    expect(result.dy).toBe(10);
  });

  describe('頂点同士の吸着', () => {
    // 端点+中点をスナップ点に持つ線分プラグイン
    const linePlugin = makeTestPlugin({
      id: 'test.line.move',
      getSnapPoints: (p) => [
        { x: -p.width / 2, y: 0 },
        { x: p.width / 2, y: 0 },
      ],
    });
    const registry = new PluginRegistry();
    registry.register(linePlugin);

    it('移動側の端点が他図形の端点へ届いたらぴったり重ねる', () => {
      // 静止側: 端点(150,100)。移動側: 端点(-50+x, y)
      const fixed = createSceneObject(linePlugin, { x: 100, y: 100 }, 1);
      const moving = createSceneObject(linePlugin, { x: 254, y: 103 }, 2); // 左端(204,103)
      const objects = { [fixed.id]: fixed, [moving.id]: moving } as SceneObjects;
      // 生の移動量で左端が(154,103)=静止側の右端(150,100)の近く(距離5)へ来る
      const r = snapMovement({
        rawDx: -50,
        rawDy: 0,
        movingBefore: { [moving.id]: moving.transform },
        snapEnabled: true,
        gridSize: 10,
        objects,
        registry,
        threshold: 8,
      });
      // 端点が完全に重なる移動量へ補正される(グリッドへは丸めない)
      expect(r.dx).toBeCloseTo(-54);
      expect(r.dy).toBeCloseTo(-3);
      expect(r.marker).toEqual({ x: 150, y: 100 });
    });

    it('近い頂点が無ければ従来どおりグリッドへ丸める', () => {
      const fixed = createSceneObject(linePlugin, { x: 100, y: 100 }, 1);
      const moving = createSceneObject(linePlugin, { x: 600, y: 600 }, 2);
      const objects = { [fixed.id]: fixed, [moving.id]: moving } as SceneObjects;
      const r = snapMovement({
        rawDx: 13,
        rawDy: 7,
        movingBefore: { [moving.id]: moving.transform },
        snapEnabled: true,
        gridSize: 10,
        objects,
        registry,
        threshold: 8,
      });
      expect(r.dx).toBe(10);
      expect(r.dy).toBe(10);
      expect(r.marker).toBeUndefined();
    });
  });

  it('複数選択でも相対位置が保たれる(一様な移動量)', () => {
    const a = createSceneObject(plugin, { x: 0, y: 0 }, 1);
    const b = createSceneObject(plugin, { x: 37, y: 13 }, 2);
    const result = snapMovement({
      rawDx: 8,
      rawDy: 8,
      movingBefore: { [a.id]: a.transform, [b.id]: b.transform },
      snapEnabled: true,
      gridSize: 10,
    });
    // 先頭オブジェクト基準のグリッドスナップ: 0+8→10
    expect(result.dx).toBe(10);
    expect(result.dy).toBe(10);
  });
});

describe('snapWorldPoint', () => {
  const base = {
    snapEnabled: true,
    gridSize: 10,
    axisX: true,
    axisY: true,
  };

  it('スナップ無効時は元の点を返す', () => {
    const result = snapWorldPoint({ ...base, point: { x: 13, y: 7 }, snapEnabled: false });
    expect(result.point).toEqual({ x: 13, y: 7 });
  });

  it('グリッドへ丸める', () => {
    const result = snapWorldPoint({ ...base, point: { x: 13, y: 7 } });
    expect(result.point).toEqual({ x: 10, y: 10 });
  });

  it('axisXのみ指定時はY軸をスナップしない(辺ハンドル)', () => {
    const result = snapWorldPoint({ ...base, point: { x: 13, y: 7 }, axisY: false });
    expect(result.point.x).toBe(10);
    expect(result.point.y).toBe(7);
  });
});

describe('snapEndpoint', () => {
  // 水平線分(ローカル -50..50)を持つプラグイン。グリッド外の線上へ吸着できる
  const segPlugin = makeTestPlugin({
    getSnapPoints: () => [],
    getSegments: (p) => [
      [
        { x: -p.width / 2, y: 0 },
        { x: p.width / 2, y: 0 },
      ],
    ],
  });
  const segRegistry = new PluginRegistry();
  segRegistry.register(segPlugin);

  const base = {
    registry: segRegistry,
    excludeIds: new Set<string>(),
    snapEnabled: true,
    gridSize: 40,
    threshold: 6,
  };

  function segObjects() {
    const seg = createSceneObject(segPlugin, { x: 100, y: 100 }, 1);
    return { objects: { [seg.id]: seg } as SceneObjects, id: seg.id };
  }

  it('スナップ無効時は元の点を返す', () => {
    const { objects } = segObjects();
    const r = snapEndpoint({ ...base, objects, point: { x: 100, y: 103 }, snapEnabled: false });
    expect(r.point).toEqual({ x: 100, y: 103 });
    expect(r.marker).toBeUndefined();
  });

  it('線分上の最近点へ吸着する(グリッド外でも可)', () => {
    const { objects } = segObjects();
    // 世界座標の線分 (50,100)-(150,100)。(100,103)の最近点は(100,100)
    const r = snapEndpoint({ ...base, objects, point: { x: 100, y: 103 } });
    expect(r.point.x).toBeCloseTo(100);
    expect(r.point.y).toBeCloseTo(100);
    expect(r.marker).toBeDefined();
  });

  it('線分から離れていればグリッドへスナップする', () => {
    const { objects } = segObjects();
    const r = snapEndpoint({ ...base, objects, point: { x: 300, y: 300 } });
    expect(r.point).toEqual({ x: 320, y: 320 }); // 40グリッド
    expect(r.marker).toBeUndefined();
  });

  it('gridEnabled:false では線分は吸着するがグリッドへは吸着しない', () => {
    const { objects } = segObjects();
    // 線分の近くではこれまで通り吸着する
    const onSeg = snapEndpoint({ ...base, objects, point: { x: 100, y: 103 }, gridEnabled: false });
    expect(onSeg.point.x).toBeCloseTo(100);
    expect(onSeg.point.y).toBeCloseTo(100);
    expect(onSeg.marker).toBeDefined();
    // 何も近くになければグリッドへ丸めず、生の点をそのまま返す
    const away = snapEndpoint({ ...base, objects, point: { x: 300, y: 300 }, gridEnabled: false });
    expect(away.point).toEqual({ x: 300, y: 300 });
    expect(away.marker).toBeUndefined();
  });

  describe('頂点(端点)への吸着', () => {
    // 線分プラグイン(端点+中点をスナップ点に持つ=line と同じ形)
    const linePlugin = makeTestPlugin({
      id: 'test.line.endpoint',
      getSnapPoints: (p) => [
        { x: -p.width / 2, y: 0 },
        { x: 0, y: 0 },
        { x: p.width / 2, y: 0 },
      ],
      getSegments: (p) => [
        [
          { x: -p.width / 2, y: 0 },
          { x: p.width / 2, y: 0 },
        ],
      ],
    });
    const reg = new PluginRegistry();
    reg.register(linePlugin);
    // 線分ワールド (50,100)-(150,100)。右端の頂点は(150,100)
    const lineBase = { ...base, registry: reg, threshold: 8 };
    function lineObjects() {
      const o = createSceneObject(linePlugin, { x: 100, y: 100 }, 1);
      return { objects: { [o.id]: o } as SceneObjects, id: o.id };
    }

    it('端点の近くでは辺への垂線の足より端点を優先する', () => {
      const { objects, id } = lineObjects();
      // (145,102): 辺上の最近点(145,100)は距離2、右端(150,100)は距離約5.4。端点が勝つ
      const r = snapEndpoint({ ...lineBase, objects, point: { x: 145, y: 102 } });
      expect(r.point.x).toBeCloseTo(150);
      expect(r.point.y).toBeCloseTo(100);
      expect(r.vertex).toBe(true);
      // 長さマーク等のバインドは維持する(端点が乗っている辺を相手にする)
      expect(r.attach).toEqual({ targetId: id, kind: 'segment', segIndex: 0 });
    });

    it('端点はグリッド点より遠くても優先する(端点同士をぴったり合わせる)', () => {
      const o = createSceneObject(linePlugin, { x: 103, y: 100 }, 1);
      // 線分(53,100)-(153,100)。右端(153,100)はグリッド(40)から外れている
      const r = snapEndpoint({
        ...lineBase,
        objects: { [o.id]: o } as SceneObjects,
        point: { x: 158, y: 100 },
      });
      expect(r.point.x).toBeCloseTo(153);
      expect(r.vertex).toBe(true);
    });

    it('辺の途中では従来どおり辺へ吸着する(頂点扱いにしない)', () => {
      const { objects, id } = lineObjects();
      const r = snapEndpoint({ ...lineBase, objects, point: { x: 120, y: 103 } });
      expect(r.point.x).toBeCloseTo(120);
      expect(r.point.y).toBeCloseTo(100);
      expect(r.vertex).toBe(false);
      expect(r.attach).toEqual({ targetId: id, kind: 'segment', segIndex: 0 });
    });

    it('円周上の頂点(4分点)へ吸着しても円のバインドは維持する', () => {
      const circlePlugin = makeTestPlugin({
        id: 'test.circle.endpoint',
        getSnapPoints: (p) => [
          { x: 0, y: 0 },
          { x: p.width / 2, y: 0 },
        ],
        getCircle: (p) => ({ center: { x: 0, y: 0 }, radius: p.width / 2 }),
      });
      const circleReg = new PluginRegistry();
      circleReg.register(circlePlugin);
      const c = createSceneObject(circlePlugin, { x: 0, y: 0 }, 1); // 半径50
      // 右の4分点(50,0)近傍。円周上の最近点より頂点が優先される
      const r = snapEndpoint({
        ...lineBase,
        registry: circleReg,
        objects: { [c.id]: c } as SceneObjects,
        point: { x: 48, y: 4 },
      });
      expect(r.point.x).toBeCloseTo(50);
      expect(r.point.y).toBeCloseTo(0);
      expect(r.vertex).toBe(true);
      expect(r.attach?.kind).toBe('circle');
      expect(r.attach?.t).toBeCloseTo(0);
    });
  });

  it('楕円周へ吸着する(位置のみ、attachは付かない)', () => {
    const ellipsePlugin = makeTestPlugin({
      id: 'test.ellipse.endpoint',
      getSnapPoints: () => [],
      getEllipse: (p) => ({ center: { x: 0, y: 0 }, radiusX: p.width / 2, radiusY: p.height / 2 }),
    });
    const reg = new PluginRegistry();
    reg.register(ellipsePlugin);
    const e = createSceneObject(ellipsePlugin, { x: 100, y: 100 }, 1); // rx=50, ry=25
    // +y周点はワールド(100,125)。近傍(100,128)から吸着する
    const r = snapEndpoint({ ...base, registry: reg, objects: { [e.id]: e }, point: { x: 100, y: 128 } });
    expect(r.point.x).toBeCloseTo(100);
    expect(r.point.y).toBeCloseTo(125);
    expect(r.marker).toBeDefined();
    expect(r.attach).toBeUndefined();
  });
});

describe('snapAnchorPoint', () => {
  // スナップ点(中心=index0, 右端=index1)+水平線分を持つプラグイン
  const anchorPlugin = makeTestPlugin({
    getSnapPoints: (p) => [
      { x: 0, y: 0 },
      { x: p.width / 2, y: 0 },
    ],
    getSegments: (p) => [
      [
        { x: -p.width / 2, y: 0 },
        { x: p.width / 2, y: 0 },
      ],
    ],
  });
  const registry = new PluginRegistry();
  registry.register(anchorPlugin);

  const base = {
    registry,
    excludeIds: new Set<string>(),
    snapEnabled: true,
    gridSize: 40,
    threshold: 6,
  };

  function anchorObjects() {
    const o = createSceneObject(anchorPlugin, { x: 100, y: 100 }, 1);
    return { objects: { [o.id]: o } as SceneObjects, id: o.id };
  }

  it('スナップ無効時は元の点を返し、bindは無い', () => {
    const { objects } = anchorObjects();
    const r = snapAnchorPoint({ ...base, objects, point: { x: 152, y: 101 }, snapEnabled: false });
    expect(r.point).toEqual({ x: 152, y: 101 });
    expect(r.bind).toBeUndefined();
  });

  it('離散スナップ点(右端 index1)へ吸着し pointIndex を返す', () => {
    const { objects, id } = anchorObjects();
    // 右端はワールド(150,100)
    const r = snapAnchorPoint({ ...base, objects, point: { x: 152, y: 101 } });
    expect(r.point.x).toBeCloseTo(150);
    expect(r.point.y).toBeCloseTo(100);
    expect(r.bind).toEqual({ targetId: id, kind: 'point', pointIndex: 1 });
  });

  it('スナップ点から外れた線分上では kind:segment と t を返す', () => {
    const { objects, id } = anchorObjects();
    // 線分ワールド(50,100)-(150,100)。x=120 はスナップ点(100/150)から>6離れた線分上
    const r = snapAnchorPoint({ ...base, objects, point: { x: 120, y: 102 } });
    expect(r.point.x).toBeCloseTo(120);
    expect(r.point.y).toBeCloseTo(100);
    expect(r.bind?.kind).toBe('segment');
    if (r.bind?.kind === 'segment') {
      expect(r.bind.targetId).toBe(id);
      expect(r.bind.t).toBeCloseTo(0.7); // (120-50)/100
    }
  });

  it('離散スナップ点はグリッド点より遠くても優先する', () => {
    const o = createSceneObject(anchorPlugin, { x: 103, y: 100 }, 1);
    // 右端はワールド(153,100)=グリッド(40)から外れている。(158,100)から頂点へ吸着する
    const r = snapAnchorPoint({ ...base, objects: { [o.id]: o } as SceneObjects, point: { x: 158, y: 100 } });
    expect(r.point.x).toBeCloseTo(153);
    expect(r.vertex).toBe(true);
    expect(r.bind).toEqual({ targetId: o.id, kind: 'point', pointIndex: 1 });
  });

  it('どこにも近くなければグリッドへ吸着し bind は無い', () => {
    const { objects } = anchorObjects();
    const r = snapAnchorPoint({ ...base, objects, point: { x: 300, y: 300 } });
    expect(r.point).toEqual({ x: 320, y: 320 });
    expect(r.bind).toBeUndefined();
  });

  it('楕円周上へ吸着し kind:ellipse と媒介変数角度tを返す', () => {
    const ellipsePlugin = makeTestPlugin({
      id: 'test.ellipse.anchor',
      getSnapPoints: () => [{ x: 0, y: 0 }],
      getEllipse: (p) => ({ center: { x: 0, y: 0 }, radiusX: p.width / 2, radiusY: p.height / 2 }),
    });
    const reg = new PluginRegistry();
    reg.register(ellipsePlugin);
    const e = createSceneObject(ellipsePlugin, { x: 100, y: 100 }, 1); // rx=50, ry=25
    // +y周点ワールド(100,125)近傍。中心スナップ点(100,100)からは遠い
    const r = snapAnchorPoint({ ...base, registry: reg, objects: { [e.id]: e }, point: { x: 100, y: 128 } });
    expect(r.point.x).toBeCloseTo(100);
    expect(r.point.y).toBeCloseTo(125);
    expect(r.bind?.kind).toBe('ellipse');
    if (r.bind?.kind === 'ellipse') {
      expect(r.bind.targetId).toBe(e.id);
      expect(r.bind.t).toBeCloseTo(90);
    }
  });
});

describe('projectAnchorPoint', () => {
  // スナップ点(中心=index0, 右端=index1)+水平線分を持つプラグイン
  const anchorPlugin = makeTestPlugin({
    getSnapPoints: (p) => [
      { x: 0, y: 0 },
      { x: p.width / 2, y: 0 },
    ],
    getSegments: (p) => [
      [
        { x: -p.width / 2, y: 0 },
        { x: p.width / 2, y: 0 },
      ],
    ],
  });
  const registry = new PluginRegistry();
  registry.register(anchorPlugin);

  it('遠く離れた点でも対象の幾何上へクランプする(グリッド・自由座標へは出ない)', () => {
    const target = createSceneObject(anchorPlugin, { x: 100, y: 100 }, 1);
    // 線分ワールド(50,100)-(150,100)。遥か右下(500,400)の最近点は右端(150,100)
    const r = projectAnchorPoint({ point: { x: 500, y: 400 }, target, registry, threshold: 6 });
    expect(r?.point.x).toBeCloseTo(150);
    expect(r?.point.y).toBeCloseTo(100);
    expect(r?.bind.targetId).toBe(target.id);
  });

  it('線分上をスライドし kind:segment と t を返す', () => {
    const target = createSceneObject(anchorPlugin, { x: 100, y: 100 }, 1);
    const r = projectAnchorPoint({ point: { x: 120, y: 130 }, target, registry, threshold: 6 });
    expect(r?.point.x).toBeCloseTo(120);
    expect(r?.point.y).toBeCloseTo(100);
    expect(r?.bind.kind).toBe('segment');
    if (r?.bind.kind === 'segment') expect(r.bind.t).toBeCloseTo(0.7); // (120-50)/100
  });

  it('しきい値内なら離散スナップ点(右端)を優先する', () => {
    const target = createSceneObject(anchorPlugin, { x: 100, y: 100 }, 1);
    const r = projectAnchorPoint({ point: { x: 148, y: 102 }, target, registry, threshold: 6 });
    expect(r?.bind).toMatchObject({ kind: 'point', pointIndex: 1 });
    expect(r?.point.x).toBeCloseTo(150);
  });

  it('線分・円の無いオブジェクトは最寄りのスナップ点(しきい値なし)へ', () => {
    const boxPlugin = makeTestPlugin({ id: 'test.box.project' });
    const reg = new PluginRegistry();
    reg.register(boxPlugin);
    const target = createSceneObject(boxPlugin, { x: 0, y: 0 }, 1);
    // 100x50の箱。遠い(500,500)でも右下角(50,25)へクランプ
    const r = projectAnchorPoint({ point: { x: 500, y: 500 }, target, registry: reg, threshold: 6 });
    expect(r?.point.x).toBeCloseTo(50);
    expect(r?.point.y).toBeCloseTo(25);
    expect(r?.bind.kind).toBe('point');
  });

  it('円周上をスライドし kind:circle と局所角度tを返す', () => {
    const circlePlugin = makeTestPlugin({
      id: 'test.circle.project',
      getSnapPoints: () => [{ x: 0, y: 0 }],
      getCircle: (p) => ({ center: { x: 0, y: 0 }, radius: p.width / 2 }),
    });
    const reg = new PluginRegistry();
    reg.register(circlePlugin);
    const target = createSceneObject(circlePlugin, { x: 0, y: 0 }, 1); // 半径50
    const r = projectAnchorPoint({ point: { x: 200, y: 0 }, target, registry: reg, threshold: 6 });
    expect(r?.point.x).toBeCloseTo(50);
    expect(r?.point.y).toBeCloseTo(0);
    expect(r?.bind.kind).toBe('circle');
    if (r?.bind.kind === 'circle') expect(r.bind.t).toBeCloseTo(0);
  });

  it('楕円周上をスライドし kind:ellipse と媒介変数角度tを返す', () => {
    const ellipsePlugin = makeTestPlugin({
      id: 'test.ellipse.project',
      getSnapPoints: () => [{ x: 0, y: 0 }],
      getEllipse: (p) => ({ center: { x: 0, y: 0 }, radiusX: p.width / 2, radiusY: p.height / 2 }),
    });
    const reg = new PluginRegistry();
    reg.register(ellipsePlugin);
    const target = createSceneObject(ellipsePlugin, { x: 0, y: 0 }, 1); // rx=50, ry=25
    // 真下(0,200)の周点は t=90 → (0, ry=25)
    const r = projectAnchorPoint({ point: { x: 0, y: 200 }, target, registry: reg, threshold: 6 });
    expect(r?.point.x).toBeCloseTo(0);
    expect(r?.point.y).toBeCloseTo(25);
    expect(r?.bind.kind).toBe('ellipse');
    if (r?.bind.kind === 'ellipse') expect(r.bind.t).toBeCloseTo(90);
  });
});
