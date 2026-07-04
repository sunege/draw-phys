import { describe, expect, it } from 'vitest';
import { normalizeFormula } from '../latex';

describe('normalizeFormula', () => {
  it('半角円記号(¥)をバックスラッシュに変換する', () => {
    expect(normalizeFormula('¥frac{1}{2}')).toBe('\\frac{1}{2}');
  });

  it('全角円記号(￥)をバックスラッシュに変換する', () => {
    expect(normalizeFormula('￥sqrt{2}')).toBe('\\sqrt{2}');
  });

  it('複数の円記号すべてを変換する', () => {
    expect(normalizeFormula('¥vec{F} = m¥vec{a}')).toBe('\\vec{F} = m\\vec{a}');
  });

  it('既存のバックスラッシュや通常文字はそのまま', () => {
    expect(normalizeFormula('\\alpha + x^2')).toBe('\\alpha + x^2');
  });
});
