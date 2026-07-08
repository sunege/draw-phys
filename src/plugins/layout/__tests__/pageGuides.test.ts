import { describe, expect, it } from 'vitest';
import { divisions, guidePoints, guideSegments } from '../pageGuides';

describe('divisions', () => {
  it('2等分は中央1点', () => {
    expect(divisions(100, 2)).toEqual([0]);
  });
  it('4等分は内部3点(等間隔)', () => {
    expect(divisions(100, 4)).toEqual([-25, 0, 25]);
  });
  it('1以下は分割線なし', () => {
    expect(divisions(100, 1)).toEqual([]);
    expect(divisions(100, 0)).toEqual([]);
  });
});

describe('guideSegments', () => {
  it('2×2+対角で 縦1・横1・対角2 = 4本', () => {
    const segs = guideSegments({ width: 200, height: 100, cols: 2, rows: 2, diagonals: true });
    expect(segs).toHaveLength(4);
    // 中央縦線
    expect(segs[0]).toEqual([{ x: 0, y: -50 }, { x: 0, y: 50 }]);
    // 中央横線
    expect(segs[1]).toEqual([{ x: -100, y: 0 }, { x: 100, y: 0 }]);
  });

  it('対角OFFなら等分線のみ', () => {
    const segs = guideSegments({ width: 200, height: 100, cols: 3, rows: 1, diagonals: false });
    // 縦は3等分=2本、横は1で0本、対角なし
    expect(segs).toHaveLength(2);
  });
});

describe('guidePoints', () => {
  it('2×2は中央交点+各辺の中点(4)=5点', () => {
    const pts = guidePoints({ width: 200, height: 100, cols: 2, rows: 2, diagonals: true });
    // 内部交点1(0,0) + 縦線が上下辺と交わる2 + 横線が左右辺と交わる2
    expect(pts).toHaveLength(5);
    expect(pts).toContainEqual({ x: 0, y: 0 });
    expect(pts).toContainEqual({ x: 0, y: -50 });
    expect(pts).toContainEqual({ x: -100, y: 0 });
  });
});
