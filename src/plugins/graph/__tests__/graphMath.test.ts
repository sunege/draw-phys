import { describe, expect, it } from 'vitest';
import {
  axisPositions,
  decimalsForStep,
  fitLinear,
  fitProportional,
  formatFitEquation,
  formatTick,
  graphToLocal,
  isValidRange,
  localToGraph,
  niceStep,
  originLocal,
  panRangeByLocalDelta,
  parseScatterText,
  sampleFunction,
  scatterToText,
  tickValues,
  zoomRangeToLocalRect,
  type GraphView,
} from '../graphMath';

/** ±5・320x240の標準ビュー */
const V: GraphView = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, width: 320, height: 240 };

describe('isValidRange', () => {
  it('min<maxで有限なら真', () => {
    expect(isValidRange({ xMin: -1, xMax: 1, yMin: -1, yMax: 1 })).toBe(true);
    expect(isValidRange({ xMin: 1, xMax: 1, yMin: -1, yMax: 1 })).toBe(false);
    expect(isValidRange({ xMin: 2, xMax: 1, yMin: -1, yMax: 1 })).toBe(false);
    expect(isValidRange({ xMin: -Infinity, xMax: 1, yMin: -1, yMax: 1 })).toBe(false);
    expect(isValidRange({ xMin: NaN, xMax: 1, yMin: -1, yMax: 1 })).toBe(false);
  });
});

describe('niceStep', () => {
  it('1-2-5系列を返す', () => {
    expect(niceStep(10)).toBeCloseTo(2); // 10/6≈1.67 → 2
    expect(niceStep(6)).toBeCloseTo(1); // 1
    expect(niceStep(30)).toBeCloseTo(5); // 5
    expect(niceStep(100)).toBeCloseTo(20);
    expect(niceStep(0.6)).toBeCloseTo(0.1);
    expect(niceStep(3)).toBeCloseTo(0.5);
  });

  it('不正なspanでは1へフォールバック', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-5)).toBe(1);
    expect(niceStep(Infinity)).toBe(1);
  });
});

describe('tickValues', () => {
  it('0を位相基準にstep刻みで返す', () => {
    expect(tickValues(-5, 5, 2)).toEqual([-4, -2, 0, 2, 4]);
    expect(tickValues(-1, 1, 0.5)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });

  it('境界は誤差込みで包含する', () => {
    // 0.1刻みの浮動小数誤差でも0.3が落ちない
    const ticks = tickValues(0.1, 0.3, 0.1);
    expect(ticks.length).toBe(3);
    expect(ticks[2]).toBeCloseTo(0.3);
  });

  it('本数が暴走する指定は空を返す', () => {
    expect(tickValues(0, 1e6, 0.1)).toEqual([]);
    expect(tickValues(0, 1, 0)).toEqual([]);
  });
});

describe('graphToLocal / localToGraph', () => {
  it('原点はビュー中心、y軸は反転する', () => {
    expect(graphToLocal({ x: 0, y: 0 }, V)).toEqual({ x: 0, y: 0 });
    // グラフのy=+5(上端)はローカルy=-120(上)
    const top = graphToLocal({ x: 0, y: 5 }, V);
    expect(top.y).toBeCloseTo(-120);
    const right = graphToLocal({ x: 5, y: 0 }, V);
    expect(right.x).toBeCloseTo(160);
  });

  it('往復で恒等', () => {
    const p = { x: 1.25, y: -3.5 };
    const back = localToGraph(graphToLocal(p, V), V);
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });

  it('非対称な範囲でも正しい', () => {
    const v: GraphView = { xMin: 0, xMax: 10, yMin: -2, yMax: 8, width: 100, height: 100 };
    const o = graphToLocal({ x: 0, y: 0 }, v);
    expect(o.x).toBeCloseTo(-50);
    expect(o.y).toBeCloseTo(30); // y=0は範囲の20%位置 → 下から20% → ローカル+30
  });
});

describe('axisPositions / originLocal', () => {
  it('0が範囲内なら軸はそのまま', () => {
    const a = axisPositions(V);
    expect(a.xAxisY).toBeCloseTo(0);
    expect(a.yAxisX).toBeCloseTo(0);
    expect(a.xClamped).toBe(false);
    expect(a.yClamped).toBe(false);
  });

  it('0が範囲外なら最寄りの辺へクランプ', () => {
    const v: GraphView = { xMin: 1, xMax: 11, yMin: 2, yMax: 12, width: 100, height: 100 };
    const a = axisPositions(v);
    expect(a.yAxisX).toBeCloseTo(-50); // x=0は左外 → 左辺
    expect(a.xAxisY).toBeCloseTo(50); // y=0は下外 → 下辺
    expect(a.xClamped).toBe(true);
    expect(a.yClamped).toBe(true);
    expect(originLocal(v)).toEqual({ x: -50, y: 50 });
  });
});

describe('formatTick / decimalsForStep', () => {
  it('刻みから小数桁を推定する', () => {
    expect(decimalsForStep(5)).toBe(0);
    expect(decimalsForStep(0.5)).toBe(1);
    expect(decimalsForStep(0.25)).toBe(2);
  });

  it('decimals=-1は自動、-0は0に寄せる', () => {
    expect(formatTick(2, 0.5, -1)).toBe('2.0');
    expect(formatTick(2, 1, -1)).toBe('2');
    expect(formatTick(3.14159, 1, 2)).toBe('3.14');
    expect(formatTick(-0.0000001, 1, 0)).toBe('0');
  });
});

describe('sampleFunction', () => {
  it('連続関数は1本のポリラインになる', () => {
    const lines = sampleFunction((x) => Math.sin(x), V);
    expect(lines.length).toBe(1);
    expect(lines[0].length).toBeGreaterThan(100);
    // 端点はxMin/xMaxに対応
    expect(lines[0][0].x).toBeCloseTo(-160);
    expect(lines[0][lines[0].length - 1].x).toBeCloseTo(160);
  });

  it('1/xは非有限・ジャンプで分割される', () => {
    const lines = sampleFunction((x) => 1 / x, V);
    expect(lines.length).toBe(2);
  });

  it('tanは複数区間に分割される', () => {
    const lines = sampleFunction((x) => Math.tan(x), V);
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it('log の負域(NaN)はスキップされる', () => {
    const lines = sampleFunction((x) => Math.log(x), V);
    expect(lines.length).toBe(1);
    // 全点が x>0 側
    for (const p of lines[0]) expect(p.x).toBeGreaterThan(-1);
  });

  it('yは箱高さの±5倍にクランプされる', () => {
    const lines = sampleFunction((x) => 1e9 * x * x + 1e6, V);
    for (const line of lines) {
      for (const p of line) expect(Math.abs(p.y)).toBeLessThanOrEqual(V.height * 5);
    }
  });

  it('定義域で範囲を絞れる', () => {
    const lines = sampleFunction((x) => x, V, { min: 0, max: 2 });
    expect(lines.length).toBe(1);
    expect(lines[0][0].x).toBeCloseTo(0);
    expect(lines[0][lines[0].length - 1].x).toBeCloseTo(64); // x=2 → 2/10*320=64
  });

  it('定義域が表示範囲外なら空', () => {
    expect(sampleFunction((x) => x, V, { min: 10, max: 20 })).toEqual([]);
  });
});

describe('fitLinear / fitProportional', () => {
  it('既知の直線を復元する(y=2x+1)', () => {
    const pts = [0, 1, 2, 3].map((x) => ({ x, y: 2 * x + 1 }));
    const fit = fitLinear(pts)!;
    expect(fit.a).toBeCloseTo(2);
    expect(fit.b).toBeCloseTo(1);
  });

  it('ばらつきのあるデータでも最小二乗解', () => {
    const fit = fitLinear([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 4 },
    ])!;
    expect(fit.a).toBeCloseTo(1.2);
    expect(fit.b).toBeCloseTo(0.2);
  });

  it('退化(点不足・x全同値)はnull', () => {
    expect(fitLinear([])).toBeNull();
    expect(fitLinear([{ x: 1, y: 1 }])).toBeNull();
    expect(
      fitLinear([
        { x: 2, y: 1 },
        { x: 2, y: 5 },
      ]),
    ).toBeNull();
  });

  it('比例はy=axを復元し原点を通る', () => {
    const pts = [1, 2, 3].map((x) => ({ x, y: 3 * x }));
    expect(fitProportional(pts)!.a).toBeCloseTo(3);
    expect(fitProportional([{ x: 0, y: 5 }])).toBeNull(); // Σx²=0
  });
});

describe('formatFitEquation', () => {
  it('切片の符号で表記を変える', () => {
    expect(formatFitEquation({ a: 1.234, b: 0.5 }, 2)).toBe('y = 1.23x + 0.50');
    expect(formatFitEquation({ a: 2, b: -1.5 }, 1)).toBe('y = 2.0x − 1.5');
    expect(formatFitEquation({ a: 0.5 }, 2)).toBe('y = 0.50x');
  });
});

describe('parseScatterText / scatterToText', () => {
  it('タブ・カンマ・空白区切りに対応(Excel TSV貼り付け)', () => {
    const r = parseScatterText('1\t2\n3, 4\n5 6');
    expect(r.points).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
    ]);
    expect(r.skipped).toBe(0);
  });

  it('空行は無視、不正行はスキップ数に数える', () => {
    const r = parseScatterText('1 2\n\nabc def\n3 x\n4 5');
    expect(r.points).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 5 },
    ]);
    expect(r.skipped).toBe(2);
  });

  it('scatterToTextはタブ区切りで往復できる', () => {
    const pts = [
      { x: 1.5, y: -2 },
      { x: 0, y: 3 },
    ];
    expect(parseScatterText(scatterToText(pts)).points).toEqual(pts);
  });
});

describe('zoomRangeToLocalRect', () => {
  it('ローカル矩形からグラフ範囲を求める(逆方向ドラッグも同じ)', () => {
    // 中心から右下 (0,0)-(160,120) → x:[0,5], y:[-5,0]
    const r = zoomRangeToLocalRect(V, { x: 0, y: 0 }, { x: 160, y: 120 })!;
    expect(r.xMin).toBeCloseTo(0);
    expect(r.xMax).toBeCloseTo(5);
    expect(r.yMin).toBeCloseTo(-5);
    expect(r.yMax).toBeCloseTo(0);
    const rev = zoomRangeToLocalRect(V, { x: 160, y: 120 }, { x: 0, y: 0 })!;
    expect(rev).toEqual(r);
  });

  it('実質クリック(極小矩形)はnull', () => {
    expect(zoomRangeToLocalRect(V, { x: 10, y: 10 }, { x: 10, y: 50 })).toBeNull();
    expect(zoomRangeToLocalRect(V, { x: 10, y: 10 }, { x: 50, y: 10 })).toBeNull();
  });
});

describe('panRangeByLocalDelta', () => {
  it('原点を右へ動かすと範囲は左へシフトする', () => {
    const r = panRangeByLocalDelta(V, { x: 32, y: 0 }, { width: 320, height: 240 });
    expect(r.xMin).toBeCloseTo(-6);
    expect(r.xMax).toBeCloseTo(4);
    expect(r.yMin).toBeCloseTo(-5);
    expect(r.yMax).toBeCloseTo(5);
  });

  it('原点を下へ動かすと範囲は上へシフトする', () => {
    const r = panRangeByLocalDelta(V, { x: 0, y: 24 }, { width: 320, height: 240 });
    expect(r.yMin).toBeCloseTo(-4);
    expect(r.yMax).toBeCloseTo(6);
  });
});
