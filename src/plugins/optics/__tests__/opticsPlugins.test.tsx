import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnyPlugin } from '../../../core/plugin';
import { identityTransform } from '../../../core/types';
import { inclinePlugin } from '../../mechanics/incline';
import { pulleyPlugin } from '../../mechanics/pulley';
import { sineWavePlugin } from '../../waves/sineWave';
import { wavefrontPlugin } from '../../waves/wavefront';
import { concaveMirrorPlugin, convexMirrorPlugin } from '../curvedMirror';
import { concaveLensPlugin, convexLensPlugin } from '../lens';
import { lightSourcePlugin } from '../lightSource';
import { mirrorPlugin } from '../mirror';
import { prismPlugin } from '../prism';
import { rayPlugin } from '../ray';

const plugins: AnyPlugin[] = [
  convexLensPlugin,
  concaveLensPlugin,
  mirrorPlugin,
  concaveMirrorPlugin,
  convexMirrorPlugin,
  rayPlugin,
  lightSourcePlugin,
  prismPlugin,
  sineWavePlugin,
  wavefrontPlugin,
  pulleyPlugin,
  inclinePlugin,
];

function isFiniteRect(r: { x: number; y: number; width: number; height: number }): boolean {
  return [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;
}

describe('光学・波動・力学追加プラグイン スモークテスト', () => {
  it('IDが一意', () => {
    const ids = plugins.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
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

  it('線分系(平面鏡・光線・正弦波)は端点編集が往復で整合する', () => {
    for (const plugin of [mirrorPlugin, rayPlugin, sineWavePlugin] as AnyPlugin[]) {
      const res = plugin.setFromEndpoints!(plugin.defaultProps, { x: -30, y: 0 }, { x: 70, y: 0 });
      expect(res.transform.x).toBeCloseTo(20);
      const [e0, e1] = plugin.getEndpoints!(res.props);
      expect(Math.hypot(e1.x - e0.x, e1.y - e0.y)).toBeCloseTo(100);
    }
  });

  it('レンズの焦点±f・±2fがスナップ点に含まれる', () => {
    const f = convexLensPlugin.defaultProps.focalLength as number;
    const snaps = convexLensPlugin.getSnapPoints!(convexLensPlugin.defaultProps);
    for (const x of [f, -f, 2 * f, -2 * f]) {
      expect(snaps.some((p) => p.x === x && p.y === 0)).toBe(true);
    }
  });

  it('球面鏡は getCircle を返し光線の拘束相手になれる', () => {
    const c = concaveMirrorPlugin.getCircle!(concaveMirrorPlugin.defaultProps);
    expect(c).not.toBeNull();
    expect(c!.radius).toBe(concaveMirrorPlugin.defaultProps.radius);
    expect(pulleyPlugin.getCircle!(pulleyPlugin.defaultProps)!.radius).toBe(
      pulleyPlugin.defaultProps.radius,
    );
  });

  it('斜面の鏡像は direction が反転する', () => {
    const t = { ...identityTransform(), x: 10, y: 20 };
    const res = inclinePlugin.mirror!(
      inclinePlugin.defaultProps,
      t,
      { x: 0, y: -100 },
      { x: 0, y: 100 },
    );
    expect(res.props.direction).toBe('left');
    // x=0の縦軸に対する鏡像: 中心xが反転、回転0のまま
    expect(res.transform.x).toBeCloseTo(-10);
    expect(res.transform.y).toBeCloseTo(20);
    expect(Math.abs(res.transform.rotation)).toBeCloseTo(0);
  });
});
