import { describe, expect, it } from 'vitest';
import { rectPlugin } from '../rect';

const base = { ...rectPlugin.defaultProps, width: 100, height: 60 };

describe('長方形の角丸半径', () => {
  it('半径0では従来どおり四隅を結ぶ4辺を返す(既存データ互換)', () => {
    expect(rectPlugin.getSegments!({ ...base, cornerRadius: 0 })).toEqual([
      [{ x: -50, y: -30 }, { x: 50, y: -30 }],
      [{ x: 50, y: -30 }, { x: 50, y: 30 }],
      [{ x: 50, y: 30 }, { x: -50, y: 30 }],
      [{ x: -50, y: 30 }, { x: -50, y: -30 }],
    ]);
  });

  it('半径ぶん両端を詰めた直線部を返し、辺の並びと向きは変わらない', () => {
    expect(rectPlugin.getSegments!({ ...base, cornerRadius: 10 })).toEqual([
      [{ x: -40, y: -30 }, { x: 40, y: -30 }],
      [{ x: 50, y: -20 }, { x: 50, y: 20 }],
      [{ x: 40, y: 30 }, { x: -40, y: 30 }],
      [{ x: -50, y: 20 }, { x: -50, y: -20 }],
    ]);
  });

  it('幅・高さの半分を超える半径はクランプされる(短辺側の直線部が消えるだけ)', () => {
    expect(rectPlugin.getSegments!({ ...base, cornerRadius: 999 })).toEqual([
      [{ x: -20, y: -30 }, { x: 20, y: -30 }],
      [{ x: 50, y: 0 }, { x: 50, y: 0 }],
      [{ x: 20, y: 30 }, { x: -20, y: 30 }],
      [{ x: -50, y: 0 }, { x: -50, y: 0 }],
    ]);
  });

  it('外接矩形とスナップ点は半径によらず不変(拘束の pointIndex が安定)', () => {
    const sharp = { ...base, cornerRadius: 0 };
    const round = { ...base, cornerRadius: 20 };
    expect(rectPlugin.getBounds!(round)).toEqual(rectPlugin.getBounds!(sharp));
    expect(rectPlugin.getSnapPoints!(round)).toEqual(rectPlugin.getSnapPoints!(sharp));
  });

  it('拡縮しても半径は変わらない', () => {
    const scaled = rectPlugin.applyScale!({ ...base, cornerRadius: 10 }, 2, 0.5);
    expect(scaled.cornerRadius).toBe(10);
    expect(scaled.width).toBe(200);
    expect(scaled.height).toBe(30);
  });
});

describe('長方形の migrate', () => {
  it('v1(角丸なし)は cornerRadius:0 で補完される', () => {
    const migrated = rectPlugin.migrate!(1, { width: 100, height: 60 });
    expect(migrated.cornerRadius).toBe(0);
    expect(migrated.width).toBe(100);
  });

  it('既に持っている値は上書きしない', () => {
    expect(rectPlugin.migrate!(1, { width: 100, height: 60, cornerRadius: 8 }).cornerRadius).toBe(8);
  });
});
