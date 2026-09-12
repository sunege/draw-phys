/** 表プラグインの純粋なデータ・寸法計算(セル配列の並べ替え、罫線位置、内容に合わせた寸法)。 */

import type { CSSProperties } from 'react';
import { rotateVec } from '../../core/geometry';
import type { Point, Transform } from '../../core/types';
import { resolveFontFamily } from '../basic/fontFamilies';

export type TableAlign = 'left' | 'center' | 'right';

export interface TableProps {
  rows: number;
  cols: number;
  /** row-major(rows×cols)のセル文字列。地の文 + $...$ の数式を書ける */
  cells: string[];
  /** 各列の幅(内部単位)。length=cols */
  colWidths: number[];
  /** 各行の高さ(内部単位)。length=rows */
  rowHeights: number[];
  fontSize: number;
  /** セル文字のフォント種別(fontFamilies のキー) */
  fontFamily: string;
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

/** セル内容の左右パディング(内部単位)。描画と幅の自動調整で共有する */
export const CELL_PAD_X = 5;
/** セル内容の上下パディング(内部単位)。行高の自動調整で使う */
export const CELL_PAD_Y = 4;
/** 列幅・行高の下限(内部単位)。罫線が重ならない程度に確保する */
export const MIN_COL_W = 10;
export const MIN_ROW_H = 10;

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

/**
 * ローカル座標の点が入るセルの row-major インデックス。表の外なら -1。
 * インライン編集で「ダブルクリックしたセル」へ入力欄の初期フォーカスを合わせるのに使う。
 */
export function cellIndexAt(
  props: Pick<TableProps, 'rows' | 'cols' | 'colWidths' | 'rowHeights'>,
  local: Point,
): number {
  const xs = edges(props.colWidths);
  const ys = edges(props.rowHeights);
  const c = xs.findIndex((x, i) => i < props.cols && local.x >= x && local.x < xs[i + 1]);
  const r = ys.findIndex((y, i) => i < props.rows && local.y >= y && local.y < ys[i + 1]);
  return c === -1 || r === -1 ? -1 : r * props.cols + c;
}

/** サイズ配列の index 番目だけを差し替える(下限で丸める) */
export function withSizeAt(sizes: number[], index: number, size: number, min: number): number[] {
  return sizes.map((s, i) => (i === index ? Math.max(min, size) : s));
}

/**
 * 外形が (dw, dh) だけ増えたとき、左上の角をその場に留めるための transform。
 * edges() は常に中央原点なので、幅が dw 増えると左辺が dw/2 だけ外へ出る。
 * その分をローカル軸方向へ平行移動して打ち消す(列幅ドラッグが右方向へだけ伸びて見える)。
 */
export function keepTopLeft(transform: Transform, dw: number, dh: number): Transform {
  const d = rotateVec(
    { x: (dw / 2) * (transform.scaleX || 1), y: (dh / 2) * (transform.scaleY || 1) },
    transform.rotation,
  );
  return { ...transform, x: transform.x + d.x, y: transform.y + d.y };
}

/** セル内容の実測サイズ(row-major、length=rows*cols) */
export interface CellSize {
  width: number;
  height: number;
}

/** 各列の最大セル幅 + 左右パディングを列幅にする(内容に合わせる) */
export function fitColWidths(sizes: CellSize[], rows: number, cols: number): number[] {
  return Array.from({ length: cols }, (_, c) => {
    let w = 0;
    for (let r = 0; r < rows; r++) w = Math.max(w, sizes[r * cols + c]?.width ?? 0);
    return Math.max(MIN_COL_W, Math.ceil(w + CELL_PAD_X * 2));
  });
}

/** 各行の最大セル高 + 上下パディングを行高にする(内容に合わせる) */
export function fitRowHeights(sizes: CellSize[], rows: number, cols: number): number[] {
  return Array.from({ length: rows }, (_, r) => {
    let h = 0;
    for (let c = 0; c < cols; c++) h = Math.max(h, sizes[r * cols + c]?.height ?? 0);
    return Math.max(MIN_ROW_H, Math.ceil(h + CELL_PAD_Y * 2));
  });
}

export interface CellFontOpts {
  fontSize: number;
  fontFamily: string;
  /** 見出し行のセルは太字 */
  bold: boolean;
}

/**
 * セル内容のフォント指定。描画(Renderer)と実測(tableMeasure)がこの1関数を共有して、
 * 「内容に合わせる」の結果と実際の描画幅を一致させる。
 * (実測で element.style へ Object.assign するため、値はすべて単位付き文字列)
 */
export function cellFontStyle(opts: CellFontOpts): CSSProperties {
  return {
    fontSize: `${opts.fontSize}px`,
    fontFamily: resolveFontFamily(opts.fontFamily),
    fontWeight: opts.bold ? 700 : 400,
    lineHeight: '1.2',
  };
}

export interface CellStyleOpts extends CellFontOpts {
  color: string;
  align: TableAlign;
}

/** セル内容を包むコンテナのスタイル(セル矩形いっぱいに広げ、上下中央・指定の横揃えで置く) */
export function cellContainerStyle(opts: CellStyleOpts): CSSProperties {
  return {
    ...cellFontStyle(opts),
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    padding: `0 ${CELL_PAD_X}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      opts.align === 'left' ? 'flex-start' : opts.align === 'right' ? 'flex-end' : 'center',
    color: opts.color,
    whiteSpace: 'nowrap',
  };
}
