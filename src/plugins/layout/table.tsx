import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point } from '../../core/types';
import { TablePanel } from './TablePanel';
import { edges, tableSize, type TableProps } from './tableMath';

/**
 * 表プラグイン。行列とセル文字列を props に持つ箱型オブジェクト。
 * 罫線・セル背景・文字を中央原点のローカル座標で描く。列幅/行高は props(内部単位)に
 * 焼き込み(applyScale)、フォントは拡縮で不変(latexDoc等と同じ方針)。
 */

/** セル内テキストの左右パディング(内部単位) */
const CELL_PAD = 5;

export const tablePlugin: PhysicsObjectPlugin<TableProps> = {
  id: 'layout.table',
  version: 1,
  name: '表',
  category: 'レイアウト',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth="1.5" />
      <line x1="15" y1="4" x2="15" y2="20" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    rows: 2,
    cols: 3,
    cells: ['', '', '', '', '', ''],
    colWidths: [80, 80, 80],
    rowHeights: [34, 34],
    fontSize: 12,
    stroke: '#000000',
    strokeWidth: 1,
    fill: '#ffffff',
    textColor: '#000000',
    headerRow: true,
    align: 'center',
  },
  defaultSize: { width: 240, height: 68 },
  propertySchema: [
    { key: 'fontSize', label: '文字サイズ', type: 'number', min: 4, step: 1 },
    { key: 'align', label: '文字揃え', type: 'select', options: [
      { value: 'left', label: '左' },
      { value: 'center', label: '中央' },
      { value: 'right', label: '右' },
    ] },
    { key: 'headerRow', label: '先頭行を見出し', type: 'boolean' },
    { key: 'fill', label: 'セル背景', type: 'color' },
    { key: 'textColor', label: '文字色', type: 'color' },
    { key: 'stroke', label: '罫線色', type: 'color' },
    { key: 'strokeWidth', label: '罫線幅', type: 'number', min: 0, step: 0.5 },
  ],
  PanelExtra: TablePanel,
  Renderer: ({ props }) => {
    const xs = edges(props.colWidths);
    const ys = edges(props.rowHeights);
    const left = xs[0];
    const right = xs[xs.length - 1];
    const top = ys[0];
    const bottom = ys[ys.length - 1];

    const cellEls: React.ReactNode[] = [];
    for (let r = 0; r < props.rows; r++) {
      for (let c = 0; c < props.cols; c++) {
        const cl = xs[c];
        const cr = xs[c + 1];
        const ct = ys[r];
        const cb = ys[r + 1];
        const isHeader = props.headerRow && r === 0;
        const bg = isHeader ? '#f1f5f9' : props.fill;
        const text = props.cells[r * props.cols + c] ?? '';
        let tx = (cl + cr) / 2;
        let anchor: 'start' | 'middle' | 'end' = 'middle';
        if (props.align === 'left') {
          tx = cl + CELL_PAD;
          anchor = 'start';
        } else if (props.align === 'right') {
          tx = cr - CELL_PAD;
          anchor = 'end';
        }
        cellEls.push(
          <g key={`c${r}-${c}`}>
            {bg && bg !== 'none' && (
              <rect x={cl} y={ct} width={cr - cl} height={cb - ct} fill={bg} />
            )}
            {text && (
              <text
                x={tx}
                y={(ct + cb) / 2}
                fontSize={props.fontSize}
                fill={props.textColor}
                textAnchor={anchor}
                dominantBaseline="central"
                fontWeight={isHeader ? 'bold' : 'normal'}
              >
                {text}
              </text>
            )}
          </g>,
        );
      }
    }

    const lines: React.ReactNode[] = [];
    for (let i = 0; i < xs.length; i++) {
      lines.push(
        <line key={`v${i}`} x1={xs[i]} y1={top} x2={xs[i]} y2={bottom} stroke={props.stroke} strokeWidth={props.strokeWidth} />,
      );
    }
    for (let i = 0; i < ys.length; i++) {
      lines.push(
        <line key={`h${i}`} x1={left} y1={ys[i]} x2={right} y2={ys[i]} stroke={props.stroke} strokeWidth={props.strokeWidth} />,
      );
    }
    return (
      <g>
        {cellEls}
        {lines}
      </g>
    );
  },
  getBounds: (props) => {
    const { width, height } = tableSize(props);
    return { x: -width / 2, y: -height / 2, width, height };
  },
  getSnapPoints: (props) => {
    const xs = edges(props.colWidths);
    const ys = edges(props.rowHeights);
    const pts: Point[] = [{ x: 0, y: 0 }];
    // 罫線の交点をすべてスナップ点にする(セル頂点に合わせやすくする)
    for (const x of xs) for (const y of ys) pts.push({ x, y });
    return pts;
  },
  getSegments: (props) => {
    const { width, height } = tableSize(props);
    const hw = width / 2;
    const hh = height / 2;
    return [
      [{ x: -hw, y: -hh }, { x: hw, y: -hh }],
      [{ x: hw, y: -hh }, { x: hw, y: hh }],
      [{ x: hw, y: hh }, { x: -hw, y: hh }],
      [{ x: -hw, y: hh }, { x: -hw, y: -hh }],
    ];
  },
  // 列幅・行高を焼き込む(フォントは不変)
  applyScale: (props, fx, fy) => ({
    ...props,
    colWidths: props.colWidths.map((w) => w * fx),
    rowHeights: props.rowHeights.map((h) => h * fy),
  }),
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
