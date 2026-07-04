import { describe, expect, it } from 'vitest';
import { springPath } from '../spring';

describe('springPath', () => {
  it('始点と終点が長さの両端にある', () => {
    const d = springPath(120, 6, 10);
    expect(d.startsWith('M -60 0')).toBe(true);
    expect(d.endsWith('L 60 0')).toBe(true);
  });

  it('巻き数に応じた頂点数になる', () => {
    const d = springPath(100, 4, 8);
    // 先頭直線1 + ジグザグ(4巻き×2=8) + 末尾直線2 = L×11
    const segments = d.match(/L /g);
    expect(segments).toHaveLength(11);
  });

  it('振幅がY座標に反映される', () => {
    const d = springPath(100, 3, 15);
    expect(d).toContain('-15');
    expect(d).toContain(' 15');
  });
});
