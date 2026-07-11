import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { identityTransform } from '../../../core/types';
import { tuningForkPlugin } from '../tuningFork';

describe('音叉プラグイン', () => {
  it('Renderer が例外なくSVGを描き、getBounds が有限', () => {
    const Renderer = tuningForkPlugin.Renderer;
    const markup = renderToStaticMarkup(
      <Renderer
        props={tuningForkPlugin.defaultProps}
        transform={identityTransform()}
        objectId="t"
        interactive={false}
      />,
    );
    expect(markup).not.toContain('NaN');
    const b = tuningForkPlugin.getBounds(tuningForkPlugin.defaultProps);
    expect([b.x, b.y, b.width, b.height].every(Number.isFinite)).toBe(true);
  });

  it('腕の先端と柄の下端がスナップ点', () => {
    const p = tuningForkPlugin.defaultProps;
    const snaps = tuningForkPlugin.getSnapPoints!(p);
    const totalH = p.prongLength + p.gap / 2 + p.stemLength;
    expect(snaps).toContainEqual({ x: -p.gap / 2, y: -totalH / 2 });
    expect(snaps).toContainEqual({ x: 0, y: totalH / 2 });
  });

  it('振動の弧を消すと横幅が縮む', () => {
    const on = tuningForkPlugin.getBounds(tuningForkPlugin.defaultProps);
    const off = tuningForkPlugin.getBounds({
      ...tuningForkPlugin.defaultProps,
      showVibration: false,
    });
    expect(off.width).toBeLessThan(on.width);
  });
});
