/** 表プラグインの純粋なデータ・寸法計算(セル配列の並べ替え、罫線位置)。 */

export type TableAlign = 'left' | 'center' | 'right';

export interface TableProps {
  rows: number;
  cols: number;
  /** row-major(rows×cols)のセル文字列。プレーンテキスト */
  cells: string[];
  /** 各列の幅(内部単位)。length=cols */
  colWidths: number[];
  /** 各行の高さ(内部単位)。length=rows */
  rowHeights: number[];
  fontSize: number;
  /** 罫線色 */
  stroke: string;
  strokeWidth: number;
  /** セル背景色('none'で透明) */
  fill: string;
  textColor: string;
  /** 先頭行を見出しにする(太字・薄い背景) */
  headerRow: boolean;
  align: TableAlign;
}

/** 表全体の外形寸法(内部単位) */
export function tableSize(props: Pick<TableProps, 'colWidths' | 'rowHeights'>): {
  width: number;
  height: number;
} {
  const width = props.colWidths.reduce((a, b) => a + b, 0);
  const height = props.rowHeights.reduce((a, b) => a + b, 0);
  return { width, height };
}

/** sizes を累積した罫線座標(中央原点)。長さ n+1(先頭=-total/2, 末尾=+total/2) */
export function edges(sizes: number[]): number[] {
  const total = sizes.reduce((a, b) => a + b, 0);
  const out = [-total / 2];
  for (let i = 0; i < sizes.length; i++) out.push(out[i] + sizes[i]);
  return out;
}

/** (r,c) セルの文字列。範囲外は空文字 */
export function cellAt(props: Pick<TableProps, 'cells' | 'cols'>, r: number, c: number): string {
  return props.cells[r * props.cols + c] ?? '';
}

/**
 * 行数・列数を変更した新しい cells/colWidths/rowHeights を返す(既存の内容・寸法は保持)。
 * 追加された列/行には既定寸法、空文字を割り当てる。1以上に丸める。
 */
export function resizeTable(
  props: TableProps,
  rows: number,
  cols: number,
  defColW: number,
  defRowH: number,
): Pick<TableProps, 'rows' | 'cols' | 'cells' | 'colWidths' | 'rowHeights'> {
  rows = Math.max(1, Math.floor(rows));
  cols = Math.max(1, Math.floor(cols));
  const cells: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(r < props.rows && c < props.cols ? (props.cells[r * props.cols + c] ?? '') : '');
    }
  }
  const colWidths = Array.from({ length: cols }, (_, c) => props.colWidths[c] ?? defColW);
  const rowHeights = Array.from({ length: rows }, (_, r) => props.rowHeights[r] ?? defRowH);
  return { rows, cols, cells, colWidths, rowHeights };
}
