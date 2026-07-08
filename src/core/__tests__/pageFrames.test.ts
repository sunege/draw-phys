import { beforeAll, describe, expect, it } from 'vitest';
import { registerStandardPlugins } from '../../plugins';
import { createSceneObject, type SceneObjects } from '../document';
import { pluginRegistry } from '../registry';
import { orderedPageFrames, pageNumberOf } from '../pageFrames';

beforeAll(() => {
  if (!pluginRegistry.get('layout.pageFrame')) registerStandardPlugins();
});

function frame(id: string, pageNumber: number, x: number, y: number): SceneObjects[string] {
  const obj = createSceneObject(pluginRegistry.get('layout.pageFrame')!, { x, y }, 1);
  return { ...obj, id, props: { ...obj.props, pageNumber } };
}

describe('orderedPageFrames', () => {
  it('pageNumber昇順で並ぶ', () => {
    const objects: SceneObjects = {
      c: frame('c', 3, 0, 0),
      a: frame('a', 1, 0, 0),
      b: frame('b', 2, 0, 0),
    };
    expect(orderedPageFrames(objects).map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });

  it('pageNumberが同値なら位置(上→下・左→右)で決める', () => {
    const objects: SceneObjects = {
      br: frame('br', 1, 100, 100),
      tl: frame('tl', 1, 0, 0),
      tr: frame('tr', 1, 100, 0),
    };
    expect(orderedPageFrames(objects).map((o) => o.id)).toEqual(['tl', 'tr', 'br']);
  });

  it('非表示の用紙枠と用紙以外は除外する', () => {
    const rect = createSceneObject(pluginRegistry.get('core.rect')!, { x: 0, y: 0 }, 1);
    const objects: SceneObjects = {
      hidden: { ...frame('hidden', 1, 0, 0), visible: false },
      shown: frame('shown', 2, 0, 0),
      rect: { ...rect, id: 'rect' },
    };
    expect(orderedPageFrames(objects).map((o) => o.id)).toEqual(['shown']);
  });

  it('pageNumberOf: 未設定は0扱い', () => {
    expect(pageNumberOf({ props: {} } as unknown as SceneObjects[string])).toBe(0);
    expect(pageNumberOf({ props: { pageNumber: 5 } } as unknown as SceneObjects[string])).toBe(5);
  });
});
