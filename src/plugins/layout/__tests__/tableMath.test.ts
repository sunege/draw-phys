import { describe, expect, it } from 'vitest';
import { cellAt, edges, resizeTable, tableSize, type TableProps } from '../tableMath';

function props(over: Partial<TableProps> = {}): TableProps {
  return {
    rows: 2,
    cols: 2,
    cells: ['a', 'b', 'c', 'd'],
    colWidths: [50, 70],
    rowHeights: [30, 40],
    fontSize: 14,
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
