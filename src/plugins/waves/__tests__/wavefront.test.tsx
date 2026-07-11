import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnyPlugin } from '../../../core/plugin';
import { identityTransform } from '../../../core/types';
import { planeWavePlugin } from '../planeWave';
import { wavefrontPlugin } from '../wavefront';

function render(plugin: AnyPlugin, props: object): string {
  const Renderer = plugin.Renderer;
  return renderToStaticMarkup(
    <Renderer
      props={{ ...plugin.defaultProps, ...props }}
      transform={identityTransform()}
      objectId="t"
      interactive={false}
    />,
  );
}

describe('波面(円形波)', () => {
  it('alternate ON で破線(strokeDasharray)が現れる', () => {
    expect(render(wavefrontPlugin, { alternate: false })).not.toContain('stroke-dasharray');
    expect(render(wavefrontPlugin, { alternate: true })).toContain('stroke-dasharray');
  });

  it('expandモードでも外枠は位相に依らず一定(時間発展で伸縮しない)', () => {
    const b0 = wavefrontPlugin.getBounds({ ...wavefrontPlugin.defaultProps, phase: 0 });
    const b200 = wavefrontPlugin.getBounds({ ...wavefrontPlugin.defaultProps, phase: 200 });
    expect(b0).toEqual(b200);
    // 外縁半径 = startRadius + (count-1)*spacing
    const { startRadius, count, spacing, strokeWidth } = wavefrontPlugin.defaultProps;
    expect(b0.width).toBeCloseTo((startRadius + (count - 1) * spacing + strokeWidth) * 2, 6);
  });

  it('固定枠モードでは位相を変えても外枠(getBounds)が一定でクリップされる', () => {
    const p0 = { ...wavefrontPlugin.defaultProps, region: 'fixed' as const, phase: 0 };
    const p300 = { ...wavefrontPlugin.defaultProps, region: 'fixed' as const, phase: 300 };
    const b0 = wavefrontPlugin.getBounds(p0);
    const b300 = wavefrontPlugin.getBounds(p300);
    expect(b0).toEqual(b300);
    expect(b0.width).toBe(wavefrontPlugin.defaultProps.regionWidth);
    // クリップパスが定義される
    expect(render(wavefrontPlugin, { region: 'fixed' })).toContain('clipPath');
  });

  it('alternate: 位相を進めても実線→破線の入れ替わりが起きない(円の描画数が安定)', () => {
    // 山=実線/谷=破線が保たれるなら、位相を少し進めても破線円の本数は増減しない
    const countDashed = (ph: number) => {
      const m = render(wavefrontPlugin, { alternate: true, phase: ph, startRadius: 0 });
      return (m.match(/stroke-dasharray/g) ?? []).length;
    };
    // round境界(旧バグの発火点)を跨ぐ位相でも破線本数は一定(全反転しない)
    const a = countDashed(0);
    const b = countDashed(90);
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1); // 外縁で1本出入りする程度
  });

  it('v1(位相/交互なし)からの migrate で既定値が補完される', () => {
    const migrated = wavefrontPlugin.migrate!(1, {
      count: 3,
      spacing: 18,
      startRadius: 18,
      stroke: '#000000',
      strokeWidth: 1,
      lineStyle: 'solid',
      showCenter: true,
      centerStyle: 'dot',
      centerSize: 4,
    });
    expect(migrated.phase).toBe(0);
    expect(migrated.alternate).toBe(false);
    expect(migrated.region).toBe('expand');
    expect(migrated.regionWidth).toBe(200);
    expect(migrated.count).toBe(3);
  });
});

describe('波面(平面波)', () => {
  it('phase=0 では原点対称に配置される', () => {
    const b = planeWavePlugin.getBounds({ ...planeWavePlugin.defaultProps, phase: 0, showArrow: false });
    expect(b.x + b.width / 2).toBeCloseTo(0, 6);
  });

  it('alternate ON で山=実線/谷=破線が交互になる', () => {
    const markup = render(planeWavePlugin, { alternate: true });
    expect(markup).toContain('stroke-dasharray');
  });

  it('各波面が getSegments を返す(光線などのスナップ相手)', () => {
    const segs = planeWavePlugin.getSegments!(planeWavePlugin.defaultProps);
    expect(segs.length).toBe(planeWavePlugin.defaultProps.count);
    // 各波面は伝搬方向(x)に直交する縦線
    for (const [a, b] of segs) expect(a.x).toBeCloseTo(b.x, 6);
  });

  it('固定枠モードでは波源が左端、位相で波面が +x へ進み外枠は一定', () => {
    const props = { ...planeWavePlugin.defaultProps, region: 'fixed' as const };
    // phase=0 の先頭(波源)波面は左端 -regionWidth/2
    const segs0 = planeWavePlugin.getSegments!({ ...props, phase: 0 });
    expect(segs0[0][0].x).toBeCloseTo(-props.regionWidth / 2, 6);
    // 位相を進めると先頭が +x へ動く
    const segs90 = planeWavePlugin.getSegments!({ ...props, phase: 90 });
    expect(segs90[0][0].x).toBeGreaterThan(segs0[0][0].x);
    // 外枠(getBounds)は位相に依らず一定
    const b0 = planeWavePlugin.getBounds({ ...props, phase: 0, showArrow: false });
    const b300 = planeWavePlugin.getBounds({ ...props, phase: 300, showArrow: false });
    expect(b0).toEqual(b300);
    // クリップパスが定義される
    expect(render(planeWavePlugin, { region: 'fixed' })).toContain('clipPath');
  });
});
