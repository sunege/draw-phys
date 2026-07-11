import { describe, expect, it } from 'vitest';
import { pluginRegistry } from '../../../core/registry';
import { registerStandardPlugins } from '../../index';

describe('光学・波動・力学追加プラグインの登録', () => {
  it('registerStandardPlugins で光学・波動カテゴリと滑車・斜面が登録される', () => {
    expect(() => registerStandardPlugins()).not.toThrow();
    const byCat = pluginRegistry.byCategory();

    const optics = (byCat.get('光学') ?? []).map((p) => p.id).sort();
    expect(optics).toEqual(
      [
        'optics.convexLens',
        'optics.concaveLens',
        'optics.mirror',
        'optics.concaveMirror',
        'optics.convexMirror',
        'optics.ray',
        'optics.lightSource',
        'optics.prism',
      ].sort(),
    );

    const waves = (byCat.get('波動') ?? []).map((p) => p.id).sort();
    expect(waves).toEqual(['wave.sine', 'wave.tuningFork', 'wave.wavefront'].sort());

    const mech = (byCat.get('力学') ?? []).map((p) => p.id);
    expect(mech).toContain('mech.pulley');
    expect(mech).toContain('mech.incline');
    expect(mech).toContain('mech.cart');
    expect(mech).toContain('mech.string');

    const atom = (byCat.get('原子') ?? []).map((p) => p.id);
    expect(atom).toEqual(['atom.energyLevels']);
  });
});
