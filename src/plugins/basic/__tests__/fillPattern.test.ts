import { describe, expect, it } from 'vitest';
import { PATTERN_SIZES, patternLines, type PatternLine } from '../fillPattern';

/** 点と線分の距離 */
function distToSegment(px: number, py: number, l: PatternLine): number {
  const dx = l.x2 - l.x1;
  const dy = l.y2 - l.y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - l.x1) * dx + (py - l.y1) * dy) / len2));
  return Math.hypot(px - (l.x1 + t * dx), py - (l.y1 + t * dy));
}

/**
 * タイルを敷き詰めた時に斜線の太さが一定になること = タイル内の任意の点について
 * 「無限に続く斜線の帯の内側」なら必ずどれかの描画線分の帯にも入る、を確認する。
 * (本線1本だけだとタイルの角付近が抜けて線がくびれる)
 */
function uncoveredPoints(pattern: 'hatch' | 'hatchBack' | 'cross', spacing: number, lineWidth: number) {
  const lines = patternLines(pattern, spacing, lineWidth);
  const h = lineWidth / 2;
  const bad: Array<[number, number]> = [];
  const step = 0.05;
  for (let x = 0; x <= spacing; x += step) {
    for (let y = 0; y <= spacing; y += step) {
      // 無限斜線(格子)までの距離。cross は両方向
      const dirs = pattern === 'hatchBack' ? ['\\'] : pattern === 'hatch' ? ['/'] : ['/', '\\'];
      const onLattice = dirs.some((d) => {
        // 「/」: x+y = k*s 、「\」: y-x = k*s との距離
        const v = d === '/' ? x + y : y - x;
        const k = Math.round(v / spacing);
        return Math.abs(v - k * spacing) / Math.SQRT2 <= h - 1e-6;
      });
      if (!onLattice) continue;
      const covered = lines.some((l) => distToSegment(x, y, l) <= h + 1e-9);
      if (!covered) bad.push([x, y]);
    }
  }
  return bad;
}

describe('patternLines', () => {
  it('斜線「/」はタイル境界でくびれない(角の断片を含む)', () => {
    for (const { spacing, lineWidth } of Object.values(PATTERN_SIZES)) {
      expect(uncoveredPoints('hatch', spacing, lineWidth)).toEqual([]);
    }
  });

  it('斜線「\\」はタイル境界でくびれない', () => {
    for (const { spacing, lineWidth } of Object.values(PATTERN_SIZES)) {
      expect(uncoveredPoints('hatchBack', spacing, lineWidth)).toEqual([]);
    }
  });

  it('網掛けは両方向ともくびれない', () => {
    for (const { spacing, lineWidth } of Object.values(PATTERN_SIZES)) {
      expect(uncoveredPoints('cross', spacing, lineWidth)).toEqual([]);
    }
  });

  it('本線1本だけだと角が欠ける(回帰テストの前提確認)', () => {
    const { spacing, lineWidth } = PATTERN_SIZES.medium;
    const only = [{ x1: 0, y1: spacing, x2: spacing, y2: 0 }];
    const h = lineWidth / 2;
    // 角(0,0)のすぐ内側は格子線の帯の中だが、本線だけでは覆えない
    expect(distToSegment(0.1, 0.1, only[0])).toBeGreaterThan(h);
  });

  it('縦横線はタイル端をまたいで延長される', () => {
    const { spacing } = PATTERN_SIZES.medium;
    const [hLine] = patternLines('horizontal', spacing, 1);
    expect(hLine.x1).toBeLessThan(0);
    expect(hLine.x2).toBeGreaterThan(spacing);
    const [vLine] = patternLines('vertical', spacing, 1);
    expect(vLine.y1).toBeLessThan(0);
    expect(vLine.y2).toBeGreaterThan(spacing);
  });

  it('ドットは線分を持たない', () => {
    expect(patternLines('dots', 8, 1)).toEqual([]);
    expect(patternLines('none', 8, 1)).toEqual([]);
  });
});
