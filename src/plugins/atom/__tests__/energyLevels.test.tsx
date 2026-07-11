import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { identityTransform } from '../../../core/types';
import { energyLevelYs } from '../energyLevelMath';
import { energyLevelsPlugin } from '../energyLevels';

describe('energyLevelYs', () => {
  it('等間隔: n=1が下端・n=countが上端で等間隔', () => {
    const ys = energyLevelYs(4, 120, 'equal');
    expect(ys).toEqual([60, 20, -20, -60]);
  });

  it('水素型: y = H/2 - H(1-1/n²) で上に密集する', () => {
    const ys = energyLevelYs(3, 120, 'hydrogen');
    expect(ys[0]).toBeCloseTo(60, 10); // n=1 下端
    expect(ys[1]).toBeCloseTo(60 - 120 * (3 / 4), 10);
    expect(ys[2]).toBeCloseTo(60 - 120 * (8 / 9), 10);
    // 間隔は上へ行くほど狭い
    expect(ys[0] - ys[1]).toBeGreaterThan(ys[1] - ys[2]);
  });
});

describe('エネルギー準位図プラグイン', () => {
  it('Renderer が例外なくSVGを描き、遷移矢印(3→2)も描ける', () => {
    const Renderer = energyLevelsPlugin.Renderer;
    const props = { ...energyLevelsPlugin.defaultProps, transitionFrom: 3, transitionTo: 2 };
    const markup = renderToStaticMarkup(
      <Renderer props={props} transform={identityTransform()} objectId="t" interactive={false} />,
    );
    expect(markup).not.toContain('NaN');
    expect(markup).toContain('polygon'); // 遷移矢印の矢先
  });

  it('準位線の数だけ getSegments を返す(矢印のスナップ相手)', () => {
    const segs = energyLevelsPlugin.getSegments!(energyLevelsPlugin.defaultProps);
    expect(segs.length).toBe(energyLevelsPlugin.defaultProps.count);
  });

  it('範囲外の遷移指定では矢印を描かない', () => {
    const Renderer = energyLevelsPlugin.Renderer;
    const props = { ...energyLevelsPlugin.defaultProps, transitionFrom: 9, transitionTo: 2 };
    const markup = renderToStaticMarkup(
      <Renderer props={props} transform={identityTransform()} objectId="t" interactive={false} />,
    );
    expect(markup).not.toContain('polygon');
  });
});
