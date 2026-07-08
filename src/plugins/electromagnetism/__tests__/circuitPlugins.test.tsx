import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnyPlugin } from '../../../core/plugin';
import { identityTransform } from '../../../core/types';
import { acSourcePlugin } from '../acSource';
import { barMagnetPlugin } from '../barMagnet';
import { capacitorPlugin } from '../capacitor';
import { currentDirectionPlugin } from '../currentDirection';
import { dcSourcePlugin } from '../dcSource';
import { diodePlugin } from '../diode';
import { earthPlugin } from '../earth';
import { groundPlugin } from '../ground';
import { inductorPlugin } from '../inductor';
import { lampPlugin } from '../lamp';
import { ammeterPlugin, galvanometerPlugin, voltmeterPlugin } from '../meter';
import { pointChargePlugin } from '../pointCharge';
import { resistorPlugin } from '../resistor';
import { switchPlugin } from '../switchSym';
import { variableResistorPlugin } from '../variableResistor';

const plugins: AnyPlugin[] = [
  dcSourcePlugin,
  acSourcePlugin,
  resistorPlugin,
  variableResistorPlugin,
  capacitorPlugin,
  inductorPlugin,
  diodePlugin,
  switchPlugin,
  lampPlugin,
  ammeterPlugin,
  voltmeterPlugin,
  galvanometerPlugin,
  earthPlugin,
  groundPlugin,
  currentDirectionPlugin,
  pointChargePlugin,
  barMagnetPlugin,
];

function isFiniteRect(r: { x: number; y: number; width: number; height: number }): boolean {
  return [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;
}

describe('電磁気プラグイン スモークテスト', () => {
  it('IDが一意で category が「電磁気」', () => {
    const ids = plugins.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of plugins) expect(p.category).toBe('電磁気');
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
      expect(markup).toContain('<');
      // パス/座標に NaN が紛れ込んでいないこと
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

  it('2端子記号は端点編集が往復で整合する', () => {
    const twoTerminal: AnyPlugin[] = [resistorPlugin, capacitorPlugin, inductorPlugin, ammeterPlugin];
    for (const plugin of twoTerminal) {
      const a = { x: -30, y: 0 };
      const b = { x: 70, y: 0 };
      const res = plugin.setFromEndpoints!(plugin.defaultProps, a, b);
      // 中心が2端点の中点、長さが距離
      expect(res.transform.x).toBeCloseTo(20);
      expect(res.transform.y).toBeCloseTo(0);
      const [e0, e1] = plugin.getEndpoints!(res.props);
      expect(Math.hypot(e1.x - e0.x, e1.y - e0.y)).toBeCloseTo(100);
    }
  });
});
