import { describe, expect, it } from 'vitest';
import { PAGE_PRESETS, landscape, portrait } from '../pageFrameMath';

describe('pageFrameMath', () => {
  it('A4プリセットは210×297mm(縦)', () => {
    const a4 = PAGE_PRESETS.find((p) => p.id === 'a4');
    expect(a4).toEqual({ id: 'a4', label: 'A4', w: 210, h: 297 });
  });

  it('portrait/landscapeは幅と高さの大小をそろえる', () => {
    expect(portrait(297, 210)).toEqual({ width: 210, height: 297 });
    expect(portrait(210, 297)).toEqual({ width: 210, height: 297 });
    expect(landscape(210, 297)).toEqual({ width: 297, height: 210 });
    expect(landscape(297, 210)).toEqual({ width: 297, height: 210 });
  });

  it('向き変換は面積(=同じ用紙サイズ)を保つ', () => {
    const p = portrait(254, 143);
    const l = landscape(254, 143);
    expect(p.width * p.height).toBe(l.width * l.height);
  });
});
