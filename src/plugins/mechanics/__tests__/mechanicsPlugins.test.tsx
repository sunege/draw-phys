import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnyPlugin } from '../../../core/plugin';
import { identityTransform } from '../../../core/types';
import { cartPlugin } from '../cart';
import { stringPlugin } from '../string';

const plugins: AnyPlugin[] = [cartPlugin, stringPlugin];

describe('台車・糸プラグイン', () => {
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
      const b = plugin.getBounds(plugin.defaultProps);
      expect([b.x, b.y, b.width, b.height].every(Number.isFinite)).toBe(true);
      expect(b.width).toBeGreaterThan(0);
    });
  }

  it('糸: 端点編集が往復で整合し、たるみ中点がスナップ点になる', () => {
    const res = stringPlugin.setFromEndpoints!(
      stringPlugin.defaultProps,
      { x: -30, y: 0 },
      { x: 70, y: 0 },
    );
    expect(res.transform.x).toBeCloseTo(20);
    const [e0, e1] = stringPlugin.getEndpoints!(res.props);
    expect(Math.hypot(e1.x - e0.x, e1.y - e0.y)).toBeCloseTo(100);

    const sagged = { ...stringPlugin.defaultProps, sag: 12 };
    const snaps = stringPlugin.getSnapPoints!(sagged);
    expect(snaps).toContainEqual({ x: 0, y: 12 });
  });

  it('糸: 鏡像でたるみの符号が反転する(手性の保持)', () => {
    const props = { ...stringPlugin.defaultProps, sag: 10 };
    const t = { ...identityTransform(), x: 20, y: 0 };
    // 垂直軸 x=0 に対する鏡像
    const res = stringPlugin.mirror!(props, t, { x: 0, y: -50 }, { x: 0, y: 50 });
    expect(res.props.sag).toBe(-10);
    expect(res.transform.x).toBeCloseTo(-20);
    // 回転180 + sag反転 = 垂れる向き(ワールド下向き)は変わらない
    expect(Math.abs(res.transform.rotation)).toBeCloseTo(180);
  });

  it('台車: 車輪の接地点が全体の下端にある', () => {
    const snaps = cartPlugin.getSnapPoints!(cartPlugin.defaultProps);
    const { height, wheelRadius } = cartPlugin.defaultProps;
    const bottom = (height + wheelRadius) / 2;
    expect(snaps.filter((p) => p.y === bottom).length).toBe(2);
  });
});
