import { describe, expect, it } from 'vitest';
import { aspectHeight, fitSize } from '../imageMath';

describe('fitSize', () => {
  it('最大寸法以下ならそのまま(拡大しない)', () => {
    expect(fitSize(300, 200, 400)).toEqual({ width: 300, height: 200 });
  });

  it('横長は幅を最大寸法に合わせて縮める', () => {
    expect(fitSize(800, 400, 400)).toEqual({ width: 400, height: 200 });
  });

  it('縦長は高さを最大寸法に合わせて縮める', () => {
    expect(fitSize(400, 1600, 400)).toEqual({ width: 100, height: 400 });
  });

  it('不正な寸法は正方形フォールバック', () => {
    expect(fitSize(0, 100, 400)).toEqual({ width: 400, height: 400 });
  });
});

describe('aspectHeight', () => {
  it('幅を基準に元画像の縦横比へ揃える', () => {
    expect(aspectHeight({ width: 200, height: 999, naturalW: 800, naturalH: 400 })).toBe(100);
  });

  it('元寸法が無ければ現在の高さを保つ', () => {
    expect(aspectHeight({ width: 200, height: 150, naturalW: 0, naturalH: 0 })).toBe(150);
  });
});
