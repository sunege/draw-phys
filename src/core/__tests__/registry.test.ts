import { describe, expect, it } from 'vitest';
import { PluginRegistry } from '../registry';
import { makeTestPlugin } from './testPlugin';

describe('PluginRegistry', () => {
  it('登録したプラグインをIDで取得できる', () => {
    const registry = new PluginRegistry();
    const plugin = makeTestPlugin();
    registry.register(plugin);
    expect(registry.get('test.box')).toBe(plugin);
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('同じIDの二重登録はエラーになる', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin());
    expect(() => registry.register(makeTestPlugin())).toThrow(/登録済み/);
  });

  it('byCategoryはカテゴリごとに登録順で返す', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin({ id: 'a', category: '力学' }));
    registry.register(makeTestPlugin({ id: 'b', category: '基本図形' }));
    registry.register(makeTestPlugin({ id: 'c', category: '力学' }));
    const categories = registry.byCategory();
    expect([...categories.keys()]).toEqual(['力学', '基本図形']);
    expect(categories.get('力学')?.map((p) => p.id)).toEqual(['a', 'c']);
  });
});
