import { describe, expect, it } from 'vitest';
import {
  cellAt,
  cellIndexAt,
  edges,
  fitColWidths,
  fitRowHeights,
  keepTopLeft,
  resizeTable,
  tableSize,
  withSizeAt,
  type TableProps,
} from '../tableMath';

function props(over: Partial<TableProps> = {}): TableProps {
  return {
    rows: 2,
    cols: 2,
    cells: ['a', 'b', 'c', 'd'],
    colWidths: [50, 70],
    rowHeights: [30, 40],
    fontSize: 14,
    fontFamily: 'serif',
    stroke: '#000',
    strokeWidth: 1,
    fill: '#fff',
    textColor: '#000',
    headerRow: false,
    align: 'center',
    ...over,
  };
}

describe('tableSize', () => {
  it('列幅・行高の合計', () => {
    expect(tableSize(props())).toEqual({ width: 120, height: 70 });
  });
});

describe('edges', () => {
  it('中央原点で累積した罫線座標(長さn+1)', () => {
    expect(edges([50, 70])).toEqual([-60, -10, 60]);
    expect(edges([30, 40])).toEqual([-35, -5, 35]);
  });
});

describe('cellAt', () => {
  it('row-majorで取得、範囲外は空', () => {
    const p = props();
    expect(cellAt(p, 0, 0)).toBe('a');
    expect(cellAt(p, 1, 1)).toBe('d');
    expect(cellAt(p, 5, 5)).toBe('');
  });
});

describe('resizeTable', () => {
  it('列を増やすと既存内容を保ち末尾に空セル・既定幅を足す', () => {
    const r = resizeTable(props(), 2, 3, 80, 34);
    expect(r.cols).toBe(3);
    expect(r.cells).toEqual(['a', 'b', '', 'c', 'd', '']);
    expect(r.colWidths).toEqual([50, 70, 80]);
    expect(r.rowHeights).toEqual([30, 40]);
  });

  it('行を減らすと末尾行を削る', () => {
    const r = resizeTable(props(), 1, 2, 80, 34);
    expect(r.rows).toBe(1);
    expect(r.cells).toEqual(['a', 'b']);
    expect(r.rowHeights).toEqual([30]);
  });

  it('1未満は1に丸める', () => {
    const r = resizeTable(props(), 0, 0, 80, 34);
    expect(r.rows).toBe(1);
    expect(r.cols).toBe(1);
    expect(r.cells).toEqual(['a']);
  });
});

describe('withSizeAt', () => {
  it('指定位置だけ差し替え、下限で丸める', () => {
    expect(withSizeAt([50, 70], 0, 90, 10)).toEqual([90, 70]);
    expect(withSizeAt([50, 70], 1, -5, 10)).toEqual([50, 10]);
  });
});

describe('keepTopLeft', () => {
  const base = { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1 };

  it('幅が増えた分の半分だけ右へ寄せて左辺を留める', () => {
    expect(keepTopLeft(base, 20, 0)).toEqual({ ...base, x: 110, y: 50 });
  });

  it('回転していればローカル軸方向へ寄せる', () => {
    const t = keepTopLeft({ ...base, rotation: 90 }, 20, 0);
    expect(t.x).toBeCloseTo(100);
    expect(t.y).toBeCloseTo(60);
  });
});

describe('fitColWidths / fitRowHeights', () => {
  const sizes = [
    { width: 30, height: 12 },
    { width: 10, height: 40 },
    { width: 50, height: 12 },
    { width: 20, height: 12 },
  ];

  it('列は最大幅+左右パディング(5×2)', () => {
    expect(fitColWidths(sizes, 2, 2)).toEqual([60, 30]);
  });

  it('行は最大高+上下パディング(4×2)', () => {
    expect(fitRowHeights(sizes, 2, 2)).toEqual([48, 20]);
  });

  it('内容が空でも下限を割らない', () => {
    expect(fitColWidths([{ width: 0, height: 0 }], 1, 1)).toEqual([10]);
    expect(fitRowHeights([{ width: 0, height: 0 }], 1, 1)).toEqual([10]);
  });
});

describe('cellIndexAt', () => {
  // colWidths [50,70] → 罫線 x = -60, -10, 60 / rowHeights [30,40] → y = -35, -5, 35
  const p = props();

  it('左上セルは0、右下セルは末尾', () => {
    expect(cellIndexAt(p, { x: -30, y: -20 })).toBe(0);
    expect(cellIndexAt(p, { x: 30, y: 20 })).toBe(3);
  });

  it('列・行の境界は右下側のセルに属する', () => {
    expect(cellIndexAt(p, { x: -10, y: -5 })).toBe(3);
  });

  it('表の外は-1', () => {
    expect(cellIndexAt(p, { x: -61, y: 0 })).toBe(-1);
    expect(cellIndexAt(p, { x: 0, y: 35 })).toBe(-1);
  });
});
