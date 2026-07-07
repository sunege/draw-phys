import { describe, expect, it } from 'vitest';
import { isDoubleClick } from '../doubleClick';

const click = (id: string, time: number, x = 100, y = 100) => ({ id, time, x, y });

describe('isDoubleClick', () => {
  it('同一オブジェクトを400ms以内・6px以内で2回クリックするとtrue', () => {
    expect(isDoubleClick(click('a', 1000), click('a', 1300, 103, 98))).toBe(true);
  });

  it('直前クリックがなければfalse', () => {
    expect(isDoubleClick(null, click('a', 1000))).toBe(false);
  });

  it('別のオブジェクトならfalse', () => {
    expect(isDoubleClick(click('a', 1000), click('b', 1100))).toBe(false);
  });

  it('時間を超えるとfalse', () => {
    expect(isDoubleClick(click('a', 1000), click('a', 1401))).toBe(false);
  });

  it('位置が離れているとfalse', () => {
    expect(isDoubleClick(click('a', 1000), click('a', 1100, 110, 100))).toBe(false);
    expect(isDoubleClick(click('a', 1000), click('a', 1100, 100, 110))).toBe(false);
  });
});
