import { describe, expect, it } from 'vitest';
import { clamp, resizeAxis, toggleAxisState, type AxisConfig } from '../layoutMath';

const cfg: AxisConfig = { min: 140, max: 360, collapseBelow: 110, expandAbove: 140, collapsedSize: 48 };

describe('clamp', () => {
  it('範囲内はそのまま、範囲外はmin/maxに丸める', () => {
    expect(clamp(200, 0, 100)).toBe(100);
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

describe('resizeAxis', () => {
  it('展開中に範囲内でドラッグするとsizeのみ変化し展開を維持する', () => {
    const next = resizeAxis({ size: 180, collapsed: false }, 20, cfg);
    expect(next).toEqual({ size: 200, collapsed: false });
  });

  it('collapseBelow未満まで縮めると折りたたみへ反転する', () => {
    const next = resizeAxis({ size: 180, collapsed: false }, -80, cfg); // -> 100 < 110
    expect(next.collapsed).toBe(true);
    expect(next.size).toBe(100);
  });

  it('折りたたみ中、collapseBelow〜expandAboveの不感帯に留まる限り折りたたみのまま', () => {
    const collapsedAt100 = { size: 100, collapsed: true };
    const next = resizeAxis(collapsedAt100, 20, cfg); // -> 120, まだ expandAbove(140)未満
    expect(next.collapsed).toBe(true);
    expect(next.size).toBe(120);
  });

  it('折りたたみ中にexpandAboveを超えると展開へ反転する', () => {
    const collapsedAt120 = { size: 120, collapsed: true };
    const next = resizeAxis(collapsedAt120, 25, cfg); // -> 145 >= 140
    expect(next.collapsed).toBe(false);
    expect(next.size).toBe(145);
  });

  it('maxを超えて拡大できず、collapsedSizeを下回って縮小できない', () => {
    expect(resizeAxis({ size: 180, collapsed: false }, 1000, cfg).size).toBe(cfg.max);
    expect(resizeAxis({ size: 300, collapsed: true }, -1000, cfg).size).toBe(cfg.collapsedSize);
  });
});

describe('toggleAxisState', () => {
  it('collapsedを反転する', () => {
    expect(toggleAxisState({ size: 180, collapsed: false }, cfg).collapsed).toBe(true);
    expect(toggleAxisState({ size: 180, collapsed: true }, cfg).collapsed).toBe(false);
  });

  it('展開へ切り替える際、min未満の極小sizeはminへ引き上げる', () => {
    const next = toggleAxisState({ size: 50, collapsed: true }, cfg);
    expect(next).toEqual({ size: cfg.min, collapsed: false });
  });

  it('折りたたみへ切り替える際はsizeを変更しない(次に展開する時の復元値)', () => {
    const next = toggleAxisState({ size: 220, collapsed: false }, cfg);
    expect(next).toEqual({ size: 220, collapsed: true });
  });
});
