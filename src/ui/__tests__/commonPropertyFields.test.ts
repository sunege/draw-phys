import { describe, expect, it } from 'vitest';
import type { SceneObject } from '../../core/document';
import { PluginRegistry } from '../../core/registry';
import { identityTransform } from '../../core/types';
import { makeTestPlugin } from '../../core/__tests__/testPlugin';
import { computeCommonFields } from '../commonPropertyFields';

function makeObject(
  pluginId: string,
  props: Record<string, unknown>,
  overrides: Partial<SceneObject> = {},
): SceneObject {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    pluginId,
    version: 1,
    transform: identityTransform(),
    zIndex: 0,
    locked: false,
    visible: true,
    props,
    ...overrides,
  };
}

describe('computeCommonFields', () => {
  it('同種オブジェクトで値が一致する場合はmixed:falseで共通値を返す', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin());
    const objs = [makeObject('test.box', { width: 100, height: 50 }), makeObject('test.box', { width: 100, height: 80 })];
    const result = computeCommonFields(objs, registry);
    const widthField = result.find((f) => f.field.key === 'width');
    expect(widthField).toEqual({ field: { key: 'width', label: '幅', type: 'number' }, mixed: false, value: 100 });
  });

  it('同種オブジェクトで値が食い違う場合はmixed:trueになる', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin());
    const objs = [makeObject('test.box', { width: 100, height: 50 }), makeObject('test.box', { width: 200, height: 50 })];
    const result = computeCommonFields(objs, registry);
    const widthField = result.find((f) => f.field.key === 'width');
    expect(widthField?.mixed).toBe(true);
  });

  it('異種混在でも key と type が一致するフィールドは共通項目になる', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin({ id: 'a' }));
    registry.register(
      makeTestPlugin({
        id: 'b',
        propertySchema: [
          { key: 'width', label: '幅', type: 'number' },
          { key: 'color', label: '色', type: 'color' },
        ],
      }),
    );
    const objs = [makeObject('a', { width: 100, height: 50 }), makeObject('b', { width: 100, color: '#000000' })];
    const result = computeCommonFields(objs, registry);
    expect(result.map((f) => f.field.key)).toEqual(['width']);
  });

  it('同じkeyでも type が異なるフィールドは除外される', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin({ id: 'a', propertySchema: [{ key: 'size', label: 'サイズ', type: 'number' }] }));
    registry.register(makeTestPlugin({ id: 'b', propertySchema: [{ key: 'size', label: 'サイズ', type: 'text' }] }));
    const objs = [makeObject('a', { size: 1 }), makeObject('b', { size: 'M' })];
    expect(computeCommonFields(objs, registry)).toEqual([]);
  });

  it('select型はoptionsの値集合が一致しないと除外される', () => {
    const registry = new PluginRegistry();
    registry.register(
      makeTestPlugin({
        id: 'a',
        propertySchema: [
          {
            key: 'lineStyle',
            label: '線種',
            type: 'select',
            options: [
              { value: 'solid', label: '実線' },
              { value: 'dashed', label: '破線' },
            ],
          },
        ],
      }),
    );
    registry.register(
      makeTestPlugin({
        id: 'b',
        propertySchema: [
          {
            key: 'lineStyle',
            label: '線種',
            type: 'select',
            options: [
              { value: 'solid', label: '実線' },
              { value: 'dashed', label: '破線' },
              { value: 'dotted', label: '点線' },
            ],
          },
        ],
      }),
    );
    const objs = [makeObject('a', { lineStyle: 'solid' }), makeObject('b', { lineStyle: 'solid' })];
    expect(computeCommonFields(objs, registry)).toEqual([]);
  });

  it('select型はoptionsの順序が違っても値集合が同じなら共通項目になる', () => {
    const registry = new PluginRegistry();
    registry.register(
      makeTestPlugin({
        id: 'a',
        propertySchema: [
          {
            key: 'lineStyle',
            label: '線種',
            type: 'select',
            options: [
              { value: 'solid', label: '実線' },
              { value: 'dashed', label: '破線' },
            ],
          },
        ],
      }),
    );
    registry.register(
      makeTestPlugin({
        id: 'b',
        propertySchema: [
          {
            key: 'lineStyle',
            label: '線種',
            type: 'select',
            options: [
              { value: 'dashed', label: '破線' },
              { value: 'solid', label: '実線' },
            ],
          },
        ],
      }),
    );
    const objs = [makeObject('a', { lineStyle: 'solid' }), makeObject('b', { lineStyle: 'solid' })];
    expect(computeCommonFields(objs, registry).map((f) => f.field.key)).toEqual(['lineStyle']);
  });

  it('片方のプラグインにしかないキーは共通項目に出ない', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin({ id: 'a', propertySchema: [{ key: 'fill', label: '塗り', type: 'color' }] }));
    registry.register(makeTestPlugin({ id: 'b', propertySchema: [{ key: 'width', label: '幅', type: 'number' }] }));
    const objs = [makeObject('a', { fill: '#ffffff' }), makeObject('b', { width: 10 })];
    expect(computeCommonFields(objs, registry)).toEqual([]);
  });

  it('ロック中オブジェクトは除外される(除外後に値が一致すればmixed:false)', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin());
    const objs = [
      makeObject('test.box', { width: 100, height: 50 }),
      makeObject('test.box', { width: 100, height: 50 }),
      makeObject('test.box', { width: 999, height: 50 }, { locked: true }),
    ];
    const result = computeCommonFields(objs, registry);
    expect(result.find((f) => f.field.key === 'width')?.mixed).toBe(false);
  });

  it('ロック除外後に対象が1個以下になる場合は空配列', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin());
    const objs = [makeObject('test.box', { width: 100, height: 50 }), makeObject('test.box', { width: 100, height: 50 }, { locked: true })];
    expect(computeCommonFields(objs, registry)).toEqual([]);
  });

  it('レジストリに存在しないpluginIdのオブジェクトは無視される', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin());
    const objs = [
      makeObject('test.box', { width: 100, height: 50 }),
      makeObject('test.box', { width: 100, height: 50 }),
      makeObject('unknown.plugin', { anything: 1 }),
    ];
    expect(computeCommonFields(objs, registry).map((f) => f.field.key)).toEqual(['width', 'height']);
  });

  it('number型のmin/maxは交差(より厳しい範囲)を返す', () => {
    const registry = new PluginRegistry();
    registry.register(
      makeTestPlugin({ id: 'a', propertySchema: [{ key: 'radius', label: '半径', type: 'number', min: 0, max: 100 }] }),
    );
    registry.register(
      makeTestPlugin({ id: 'b', propertySchema: [{ key: 'radius', label: '半径', type: 'number', min: 5, max: 50 }] }),
    );
    const objs = [makeObject('a', { radius: 10 }), makeObject('b', { radius: 10 })];
    const result = computeCommonFields(objs, registry);
    expect(result.find((f) => f.field.key === 'radius')?.field).toMatchObject({ min: 5, max: 50 });
  });

  it('片方にminが無い場合は定義されている側の値を採用する', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin({ id: 'a', propertySchema: [{ key: 'radius', label: '半径', type: 'number', min: 3 }] }));
    registry.register(makeTestPlugin({ id: 'b', propertySchema: [{ key: 'radius', label: '半径', type: 'number' }] }));
    const objs = [makeObject('a', { radius: 10 }), makeObject('b', { radius: 10 })];
    const result = computeCommonFields(objs, registry);
    expect(result.find((f) => f.field.key === 'radius')?.field).toMatchObject({ min: 3 });
  });

  it('共通項目の並び順は先頭オブジェクトのpropertySchemaの順序を保つ', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin());
    const objs = [makeObject('test.box', { width: 100, height: 50 }), makeObject('test.box', { width: 200, height: 80 })];
    expect(computeCommonFields(objs, registry).map((f) => f.field.key)).toEqual(['width', 'height']);
  });

  it('共通するフィールドが1つも無ければ空配列を返す', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin({ id: 'a', propertySchema: [{ key: 'fill', label: '塗り', type: 'color' }] }));
    registry.register(makeTestPlugin({ id: 'b', propertySchema: [{ key: 'label', label: 'ラベル', type: 'text' }] }));
    const objs = [makeObject('a', { fill: '#000000' }), makeObject('b', { label: 'x' })];
    expect(computeCommonFields(objs, registry)).toEqual([]);
  });

  it('boolean型も値の一致/不一致を判定できる', () => {
    const registry = new PluginRegistry();
    registry.register(makeTestPlugin({ propertySchema: [{ key: 'bold', label: '太字', type: 'boolean' }] }));
    const objs = [makeObject('test.box', { bold: true }), makeObject('test.box', { bold: false })];
    expect(computeCommonFields(objs, registry).find((f) => f.field.key === 'bold')?.mixed).toBe(true);
  });
});
