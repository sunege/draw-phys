import { describe, expect, it } from 'vitest';
import {
  createSceneObject,
  deserializeDocument,
  serializeDocument,
  sortedObjects,
  type SceneObjects,
} from '../document';
import { PluginRegistry } from '../registry';
import { makeTestPlugin } from './testPlugin';

function makeRegistry() {
  const registry = new PluginRegistry();
  registry.register(makeTestPlugin());
  return registry;
}

describe('SceneDocument', () => {
  it('createSceneObjectはdefaultPropsのコピーを持つ', () => {
    const plugin = makeTestPlugin();
    const obj = createSceneObject(plugin, { x: 10, y: 20 }, 1);
    expect(obj.pluginId).toBe('test.box');
    expect(obj.version).toBe(2);
    expect(obj.transform).toEqual({ x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 });
    expect(obj.props).toEqual(plugin.defaultProps);
    expect(obj.props).not.toBe(plugin.defaultProps);
  });

  it('シリアライズ→デシリアライズで往復できる', () => {
    const plugin = makeTestPlugin();
    const registry = makeRegistry();
    const a = createSceneObject(plugin, { x: 0, y: 0 }, 2);
    const b = createSceneObject(plugin, { x: 5, y: 5 }, 1);
    const objects: SceneObjects = { [a.id]: a, [b.id]: b };

    const json = serializeDocument(objects);
    expect(json.schemaVersion).toBe(1);
    // zIndex順で保存される
    expect(json.objects.map((o) => o.id)).toEqual([b.id, a.id]);

    const restored = deserializeDocument(json, registry);
    expect(restored).toEqual(objects);
  });

  it('旧バージョンのpropsはmigrateで移行される', () => {
    const registry = new PluginRegistry();
    registry.register(
      makeTestPlugin({
        migrate: (fromVersion, props) => {
          expect(fromVersion).toBe(1);
          const old = props as { w: number; h: number };
          return { width: old.w, height: old.h };
        },
      }),
    );
    const restored = deserializeDocument(
      {
        schemaVersion: 1,
        objects: [
          {
            id: 'obj1',
            pluginId: 'test.box',
            version: 1,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            zIndex: 1,
            locked: false,
            visible: true,
            props: { w: 30, h: 40 },
          },
        ],
      },
      registry,
    );
    expect(restored['obj1']?.props).toEqual({ width: 30, height: 40 });
    expect(restored['obj1']?.version).toBe(2);
  });

  it('未知のプラグインIDのオブジェクトは読み飛ばす', () => {
    const registry = makeRegistry();
    const restored = deserializeDocument(
      {
        schemaVersion: 1,
        objects: [
          {
            id: 'obj1',
            pluginId: 'unknown.plugin',
            version: 1,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            zIndex: 1,
            locked: false,
            visible: true,
            props: {},
          },
        ],
      },
      registry,
    );
    expect(Object.keys(restored)).toHaveLength(0);
  });

  it('sortedObjectsはzIndex昇順で返す', () => {
    const plugin = makeTestPlugin();
    const a = createSceneObject(plugin, { x: 0, y: 0 }, 3);
    const b = createSceneObject(plugin, { x: 0, y: 0 }, 1);
    const c = createSceneObject(plugin, { x: 0, y: 0 }, 2);
    const sorted = sortedObjects({ [a.id]: a, [b.id]: b, [c.id]: c });
    expect(sorted.map((o) => o.zIndex)).toEqual([1, 2, 3]);
  });
});
