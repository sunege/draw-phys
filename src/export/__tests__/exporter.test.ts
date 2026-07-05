import { describe, expect, it } from 'vitest';
import { makeTestPlugin } from '../../core/__tests__/testPlugin';
import { createSceneObject } from '../../core/document';
import { PluginRegistry } from '../../core/registry';
import { buildSvgString, contentRegion } from '../exporter';

function setup() {
  const registry = new PluginRegistry();
  const plugin = makeTestPlugin({
    Renderer: () => null,
  });
  registry.register(plugin);
  return { registry, plugin };
}

describe('exporter', () => {
  it('contentRegionは全オブジェクトを余白付きで包含する', () => {
    const { registry, plugin } = setup();
    // 100x50 中心原点 → (0,0)配置でバウンドは -50..50 / -25..25
    const a = createSceneObject(plugin, { x: 0, y: 0 }, 1);
    const b = createSceneObject(plugin, { x: 200, y: 100 }, 2);
    const region = contentRegion([a, b], registry);
    expect(region).toEqual({ x: -60, y: -35, width: 320, height: 170 });
  });

  it('非表示オブジェクトは領域計算から除外される', () => {
    const { registry, plugin } = setup();
    const a = createSceneObject(plugin, { x: 0, y: 0 }, 1);
    const hidden = { ...createSceneObject(plugin, { x: 999, y: 999 }, 2), visible: false };
    const region = contentRegion([a, hidden], registry);
    expect(region).toEqual({ x: -60, y: -35, width: 120, height: 70 });
  });

  it('コンストラクション(補助線)は領域計算から除外される', () => {
    const { registry, plugin } = setup();
    const a = createSceneObject(plugin, { x: 0, y: 0 }, 1);
    const guide = { ...createSceneObject(plugin, { x: 999, y: 999 }, 2), construction: true };
    const region = contentRegion([a, guide], registry);
    // 補助線は含めない → aだけの領域
    expect(region).toEqual({ x: -60, y: -35, width: 120, height: 70 });
  });

  it('コンストラクションは書き出しSVGの本体に含まれない', async () => {
    const { registry, plugin } = setup();
    const normal = createSceneObject(plugin, { x: 10, y: 20 }, 1);
    const guide = { ...createSceneObject(plugin, { x: 300, y: 300 }, 2), construction: true };
    const svg = await buildSvgString([normal, guide], { x: 0, y: 0, width: 400, height: 400 }, registry);
    expect(svg).toContain('translate(10 20)'); // 通常オブジェクトは含まれる
    expect(svg).not.toContain('translate(300 300)'); // 補助線は除外される
  });

  it('buildSvgStringはviewBoxとオブジェクトのtransformを含む', async () => {
    const { registry, plugin } = setup();
    const obj = createSceneObject(plugin, { x: 10, y: 20 }, 1);
    const region = contentRegion([obj], registry)!;
    const svg = await buildSvgString([obj], region, registry);
    expect(svg).toContain(`viewBox="${region.x} ${region.y} ${region.width} ${region.height}"`);
    expect(svg).toContain('translate(10 20)');
    expect(svg).toContain('</svg>');
    expect(svg).not.toContain('<style>');
  });

  it('背景色指定で背景rectが入る', async () => {
    const { registry, plugin } = setup();
    const obj = createSceneObject(plugin, { x: 0, y: 0 }, 1);
    const region = contentRegion([obj], registry)!;
    const svg = await buildSvgString([obj], region, registry, '#ffffff');
    expect(svg).toContain('fill="#ffffff"');
  });

  it('exportStylesを持つプラグインのCSSが<style>として同梱される', async () => {
    const registry = new PluginRegistry();
    const plugin = makeTestPlugin({
      exportStyles: async () => '.my-font { font-family: X; }',
    });
    registry.register(plugin);
    const obj = createSceneObject(plugin, { x: 0, y: 0 }, 1);
    const svg = await buildSvgString([obj], { x: 0, y: 0, width: 100, height: 100 }, registry);
    expect(svg).toContain('<style>.my-font { font-family: X; }</style>');
  });
});
