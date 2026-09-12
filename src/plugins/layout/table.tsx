import { useRef } from 'react';
import { worldDeltaToLocal } from '../../core/geometry';
import type { PartHandle, PhysicsObjectPlugin } from '../../core/plugin';
import type { Point } from '../../core/types';
import { useInlineTextEditStore } from '../../state/inlineTextEditStore';
import { DEFAULT_FONT_FAMILY, FONT_FAMILY_OPTIONS } from '../basic/fontFamilies';
import { buildKatexExportCss } from '../basic/latex';
import { renderDocHtml } from '../basic/latexDocParser';
import { TableCellEditor } from './TableCellEditor';
import { TablePanel } from './TablePanel';
import {
  cellAt,
  cellContainerStyle,
  cellIndexAt,
  edges,
  keepTopLeft,
  MIN_COL_W,
  MIN_ROW_H,
  tableSize,
  withSizeAt,
  type TableProps,
} from './tableMath';

/**
 * 表プラグイン。行列とセル文字列を props に持つ箱型オブジェクト。
 * 罫線・セル背景・セル内容を中央原点のローカル座標で描く。
 *
 * - セル内容は地の文 + `$...$` の数式(latexDocParser を共有)を foreignObject で描く
 * - 列幅/行高は props(内部単位)に焼き込み(applyScale)、フォントは拡縮で不変(latexDoc と同じ方針)
 * - 内部の罫線は getParts/movePart のハンドルでドラッグでき、左上を固定して伸縮する
 * - ダブルクリック(と配置直後)でセルに input を重ね、その場で入力する(inlineEdit)
 */

/** 見出し行のセル背景 */
const HEADER_BG = '#f1f5f9';

export const tablePlugin: PhysicsObjectPlugin<TableProps> = {
  id: 'layout.table',
  version: 2,
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
    fontFamily: DEFAULT_FONT_FAMILY,
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
    { key: 'fontFamily', label: 'フォント', type: 'select', options: [...FONT_FAMILY_OPTIONS] },
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
  Renderer: ({ props, objectId, interactive }) => {
    const isInlineTarget = useInlineTextEditStore((s) => s.objectId === objectId);
    const editing = interactive === true && isInlineTarget && !!objectId;
    // 直前に表の上で押した位置(ローカル座標)。ダブルクリックしたセルへ初期フォーカスを合わせる
    const lastLocalRef = useRef<Point | null>(null);

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
        const bg = isHeader ? HEADER_BG : props.fill;
        const text = cellAt(props, r, c);
        cellEls.push(
          <g key={`c${r}-${c}`}>
            {bg && bg !== 'none' && (
              <rect x={cl} y={ct} width={cr - cl} height={cb - ct} fill={bg} />
            )}
            {text && !editing && (
              // セルより内容が広いときも隠さず描く(列幅は「内容に合わせる」で詰められる)
              <foreignObject
                x={cl}
                y={ct}
                width={cr - cl}
                height={cb - ct}
                style={{ overflow: 'visible' }}
              >
                <div
                  // 単体SVGとして書き出したときにも正しく解釈されるよう名前空間を明示する
                  {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
                  style={cellContainerStyle({
                    fontSize: props.fontSize,
                    fontFamily: props.fontFamily,
                    bold: isHeader,
                    color: props.textColor,
                    align: props.align,
                  })}
                >
                  {/* 地の文と数式を1つのインライン要素にまとめる
                      (flexへ直接流すと文字列と数式が別のフレックス要素になり間隔が崩れる) */}
                  <span
                    style={{ display: 'inline-block' }}
                    // 地の文はエスケープ済み・数式はKaTeXが生成した信頼できるHTMLのみを流し込む
                    dangerouslySetInnerHTML={{ __html: renderDocHtml(text) }}
                  />
                </div>
              </foreignObject>
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
      <g
        onPointerDown={
          interactive
            ? (e) => {
                // 画面座標→この<g>のローカル座標(パン・ズーム・回転を一度に外す)
                const ctm = e.currentTarget.getScreenCTM();
                if (!ctm) return;
                const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
                lastLocalRef.current = { x: pt.x, y: pt.y };
              }
            : undefined
        }
      >
        {cellEls}
        {lines}
        {editing && objectId && (
          <TableCellEditor
            objectId={objectId}
            props={props}
            focusIndex={Math.max(
              0,
              lastLocalRef.current ? cellIndexAt(props, lastLocalRef.current) : 0,
            )}
          />
        )}
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
  // 内部の罫線ハンドル: 縦罫は下辺に、横罫は右辺に出す(外周は拡縮ハンドルが担当)
  getParts: (props) => {
    const xs = edges(props.colWidths);
    const ys = edges(props.rowHeights);
    const bottom = ys[ys.length - 1];
    const right = xs[xs.length - 1];
    const parts: PartHandle[] = [];
    for (let i = 1; i < xs.length - 1; i++) {
      const local = { x: xs[i], y: bottom };
      parts.push({ id: `c${i}`, local, title: '列の幅を変える', shape: 'diamond', snapLocal: local });
    }
    for (let i = 1; i < ys.length - 1; i++) {
      const local = { x: right, y: ys[i] };
      parts.push({ id: `r${i}`, local, title: '行の高さを変える', shape: 'diamond', snapLocal: local });
    }
    return parts;
  },
  // 罫線 i のドラッグは直前の列/行だけを伸縮させ、左上は動かさない(以降の列・行は押し出される)
  movePart: (props, transform, partId, fromWorld, toWorld) => {
    const boundary = Number(partId.slice(1));
    const delta = worldDeltaToLocal(
      { x: toWorld.x - fromWorld.x, y: toWorld.y - fromWorld.y },
      transform,
    );
    if (partId.startsWith('c')) {
      const i = boundary - 1;
      const colWidths = withSizeAt(props.colWidths, i, props.colWidths[i] + delta.x, MIN_COL_W);
      return {
        props: { ...props, colWidths },
        transform: keepTopLeft(transform, colWidths[i] - props.colWidths[i], 0),
      };
    }
    const i = boundary - 1;
    const rowHeights = withSizeAt(props.rowHeights, i, props.rowHeights[i] + delta.y, MIN_ROW_H);
    return {
      props: { ...props, rowHeights },
      transform: keepTopLeft(transform, 0, rowHeights[i] - props.rowHeights[i]),
    };
  },
  // 列幅・行高を焼き込む(フォントは不変)。
  // 下限で丸めると枠の実寸がドラッグ量とずれるため、ここでは丸めない(下限は罫線ドラッグ側だけ)
  applyScale: (props, fx, fy) => ({
    ...props,
    colWidths: props.colWidths.map((w) => w * fx),
    rowHeights: props.rowHeights.map((h) => h * fy),
  }),
  // v1(フォント種別なし)は既定の明朝体で補完する
  migrate: (_from, props) =>
    ({ fontFamily: DEFAULT_FONT_FAMILY, ...(props as Record<string, unknown>) }) as unknown as TableProps,
  // セル内の数式を書き出しSVGへ自己完結させる(KaTeXフォントをdata URIで同梱)
  exportStyles: buildKatexExportCss,
  capabilities: { rotatable: true, scalable: 'both' },
  // ダブルクリック・配置直後にセルの入力欄を出す(Renderer が objectId を見て切り替える)
  inlineEdit: true,
  placement: 'click',
};
