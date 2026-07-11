import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnyPlugin } from '../../../core/plugin';
import { pluginRegistry } from '../../../core/registry';
import { identityTransform } from '../../../core/types';
import { registerStandardPlugins } from '../../index';
import { cylinderPlugin } from '../cylinder';
import { flamePlugin } from '../flame';
import { gasMoleculesPlugin } from '../gasMolecules';
import { thermometerPlugin } from '../thermometer';

const plugins: AnyPlugin[] = [cylinderPlugin, gasMoleculesPlugin, flamePlugin, thermometerPlugin];

function isFiniteRect(r: { x: number; y: number; width: number; height: number }): boolean {
  return [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;
}

describe('熱力学プラグイン スモークテスト', () => {
  it('registerStandardPlugins で「熱力学」カテゴリに登録される', () => {
    expect(() => registerStandardPlugins()).not.toThrow();
    const ids = (pluginRegistry.byCategory().get('熱力学') ?? []).map((p) => p.id).sort();
    expect(ids).toEqual(
      ['thermo.cylinder', 'thermo.gasMolecules', 'thermo.flame', 'thermo.thermometer'].sort(),
    );
  });

  for (const plugin of plugins) {
    it(`${plugin.name}: Renderer が例外なくSVGを描き、getBounds が有限`, () => {
      const Renderer = plugin.Renderer;
      const markup = renderToStaticMarkup(
        <Renderer
          props={plugin.defaultProps}
          transform={identityTransform()}
          objectId="test"
          interactive={false}
        />,
      );
      expect(markup.length).toBeGreaterThan(0);
      expect(markup).not.toContain('NaN');

      const bounds = plugin.getBounds(plugin.defaultProps);
      expect(isFiniteRect(bounds)).toBe(true);

      const snaps = plugin.getSnapPoints?.(plugin.defaultProps) ?? [];
      for (const s of snaps) {
        expect(Number.isFinite(s.x)).toBe(true);
        expect(Number.isFinite(s.y)).toBe(true);
      }
    });
  }

  it('ピストンハンドルのドラッグで pistonPos が動き、内腔にクランプされる', () => {
    const t = identityTransform();
    const moved = cylinderPlugin.movePart!(
      cylinderPlugin.defaultProps,
      t,
      'piston',
      { x: 0, y: 0 },
      { x: 30, y: 0 },
    );
    expect(moved.pistonPos).toBe(130);
    const clamped = cylinderPlugin.movePart!(
      cylinderPlugin.defaultProps,
      t,
      'piston',
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
    );
    // length 160 - ピストン厚 10
    expect(clamped.pistonPos).toBe(150);
  });

  it('回転したシリンダーでもハンドルのドラッグがローカルx方向で解釈される', () => {
    const t = { ...identityTransform(), rotation: 90 };
    // 画面下(+y)へのドラッグ = ローカル+x(開口側)
    const moved = cylinderPlugin.movePart!(
      cylinderPlugin.defaultProps,
      t,
      'piston',
      { x: 0, y: 0 },
      { x: 0, y: 20 },
    );
    expect(moved.pistonPos).toBeCloseTo(120);
  });

  it('気体分子の getBounds は領域そのもの', () => {
    const b = gasMoleculesPlugin.getBounds(gasMoleculesPlugin.defaultProps);
    expect(b).toEqual({ x: -70, y: -50, width: 140, height: 100 });
  });
});
