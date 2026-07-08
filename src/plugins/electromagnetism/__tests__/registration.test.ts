import { describe, expect, it } from 'vitest';
import { pluginRegistry } from '../../../core/registry';
import { registerStandardPlugins } from '../../index';

describe('標準プラグイン登録', () => {
  it('registerStandardPlugins が例外なく走り、「電磁気」カテゴリに全記号が入る', () => {
    expect(() => registerStandardPlugins()).not.toThrow();
    const em = pluginRegistry.byCategory().get('電磁気') ?? [];
    const ids = em.map((p) => p.id).sort();
    expect(ids).toEqual(
      [
        'em.acSource',
        'em.ammeter',
        'em.barMagnet',
        'em.capacitor',
        'em.currentDirection',
        'em.dcSource',
        'em.diode',
        'em.earth',
        'em.galvanometer',
        'em.ground',
        'em.inductor',
        'em.lamp',
        'em.pointCharge',
        'em.resistor',
        'em.switch',
        'em.variableResistor',
        'em.voltmeter',
      ].sort(),
    );
  });
});
