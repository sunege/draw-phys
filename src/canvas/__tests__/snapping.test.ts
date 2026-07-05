import { describe, expect, it } from 'vitest';
import { makeTestPlugin } from '../../core/__tests__/testPlugin';
import { createSceneObject, type SceneObjects } from '../../core/document';
import { PluginRegistry } from '../../core/registry';
import { snapEndpoint, snapMovement, snapWorldPoint } from '../snapping';

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
});
