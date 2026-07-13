import { localToWorld, unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { buildKatexExportCss } from '../basic/latex';
import { lineFromDrag, segmentEndpoints, segmentFromEndpoints } from '../basic/lineUtils';
import {
  labelBgField,
  labelDecoDefaults,
  labelLocalBounds,
  moveLabelOffset,
  type LabelContent,
  type LabelDecoProps,
} from '../basic/objectLabel';
import { MarkLabel, type LabelMode } from './MarkLabel';
import { lengthMarkFromResolved } from './lengthMarkMath';

interface LengthMarkProps extends LabelDecoProps {
  length: number;
  /** extension: 両端に垂直な補助線+矢印 / arc: 中央を切った扁平楕円の両端弧(算数の長さ記号) */
  style: 'extension' | 'arc';
  /** arc スタイルで弧を描く向きを反転する(既定 +y=下 → -y=上) */
  arcFlip: boolean;
  labelMode: LabelMode;
  latex: string;
  /** ラベルの軸からの距離 */
  offset: number;
  /**
   * 測定線分からの垂直オフセット(バインド時に平行にずらす距離)。
   * 0以外のとき、測定点(局所 y=-perpOffset)と寸法線(y=0)を結ぶ点線の補助線を描く。
   */
  perpOffset: number;
  arrowSize: number;
  capSize: number;
  fontSize: number;
  decimals: number;
  /** 円に紐付けたときの測定内容 */
  measureMode: 'radius' | 'diameter';
  stroke: string;
  strokeWidth: number;
}

/** 端点tip(ワールド向き dir=+1で右)を指す矢じりの三角形パス */
function arrowHead(tipX: number, dir: 1 | -1, size: number): string {
  const bx = tipX - dir * size;
  const h = size * 0.45;
  return `M ${tipX} 0 L ${bx} ${-h} L ${bx} ${h} Z`;
}

/** ラベル表示内容(value は実測長のテキスト) */
function markContent(props: LengthMarkProps): LabelContent {
  return {
    mode: props.labelMode === 'value' ? 'text' : props.labelMode,
    text: props.length.toFixed(Math.max(0, props.decimals)),
    latex: props.latex,
  };
}

/** extension スタイルの端キャップ(端点に立てる垂直な補助線) */
function endCap(x: number, cap: number): string {
  return `M ${x} ${-cap} L ${x} ${cap}`;
}

/** arc スタイルの楕円短半径は capSize の何倍か */
const ARC_MINOR_SCALE = 2;

/**
 * arc スタイルの端キャップ。
 * 線分全長を長径(端点=頂点)とする扁平楕円を中央で切り、両端に残る楕円弧だけを描く
 * (小中学校の算数で線分の長さを示す記号)。矢印・寸法線は無し。
 * 短半径は capSize の {@link ARC_MINOR_SCALE} 倍で、短軸の片側だけを描く。
 * @param half 線分の半分(=楕円の長半径, 頂点は ±half)
 * @param cap  楕円の短半径の基準値(実際の高さは ARC_MINOR_SCALE 倍)
 * @param dir  -1=左端(頂点 -half) / +1=右端(頂点 +half)
 * @param flip true で描画側を反転(+y=下 → -y=上)
 */
function arcCap(half: number, cap: number, dir: 1 | -1, flip: boolean): string {
  // 頂点から中央側へ 70° ぶん(短軸の頂点=90°の手前)まで回し、楕円の底へ回り込ませて
  // 膨らみを出す。残り 20° ぶん(中央 x=±half·cos70°)は切ってラベル用の隙間にする。
  const phi = (70 * Math.PI) / 180;
  const from = dir === 1 ? 0 : Math.PI; // 頂点(端点 ±half)
  const to = dir === 1 ? phi : Math.PI - phi; // 中央側へ短軸の片側方向にだけ開く
  const b = cap * ARC_MINOR_SCALE * (flip ? -1 : 1);
  const steps = 16;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const th = from + ((to - from) * i) / steps;
    const x = half * Math.cos(th);
    const y = b * Math.sin(th);
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d.trim();
}

export const lengthMarkPlugin: PhysicsObjectPlugin<LengthMarkProps> = {
  id: 'core.lengthMark',
  version: 1,
  name: '長さマーク',
  category: '注釈',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M5 6 L5 18 M19 6 L19 18" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M5 12 L19 12" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M5 12 L9 9 L9 15 Z M19 12 L15 9 L15 15 Z" fill="currentColor" />
    </svg>
  ),
  defaultProps: {
    length: 100,
    style: 'extension',
    arcFlip: false,
    labelMode: 'value',
    latex: 'L',
    offset: 16,
    perpOffset: 0,
    arrowSize: 9,
    capSize: 7,
    fontSize: 12,
    decimals: 0,
    measureMode: 'radius',
    stroke: '#000000',
    strokeWidth: 1,
    ...labelDecoDefaults,
  },
  defaultSize: { width: 100, height: 40 },
  propertySchema: [
    { key: 'length', label: '長さ', type: 'number', min: 1, step: 5 },
    {
      key: 'style',
      label: 'スタイル',
      type: 'select',
      options: [
        { value: 'extension', label: '補助線+矢印' },
        { value: 'arc', label: '弧' },
      ],
    },
    { key: 'arcFlip', label: '弧の向きを反転', type: 'boolean' },
    {
      key: 'labelMode',
      label: 'ラベル',
      type: 'select',
      options: [
        { value: 'value', label: '実測長' },
        { value: 'latex', label: 'LaTeX' },
        { value: 'none', label: 'なし' },
      ],
    },
    { key: 'latex', label: 'LaTeX式', type: 'text' },
    {
      key: 'measureMode',
      label: '円の測定',
      type: 'select',
      options: [
        { value: 'radius', label: '半径' },
        { value: 'diameter', label: '直径' },
      ],
    },
    { key: 'offset', label: 'ラベル位置', type: 'number', min: 0, step: 2 },
    { key: 'perpOffset', label: 'オフセット', type: 'number', step: 2 },
    { key: 'arrowSize', label: '矢印サイズ', type: 'number', min: 1, step: 1 },
    { key: 'capSize', label: '端の大きさ', type: 'number', min: 0, step: 1 },
    { key: 'fontSize', label: 'ラベルサイズ', type: 'number', min: 6, step: 1 },
    { key: 'decimals', label: '小数桁', type: 'number', min: 0, max: 3, step: 1 },
    labelBgField,
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const half = props.length / 2;
    const { stroke, strokeWidth, arrowSize, capSize, style } = props;
    const po = props.perpOffset ?? 0;
    const dash = `${strokeWidth * 2} ${strokeWidth * 2}`;
    return (
      <g>
        {po !== 0 && (
          <>
            {/* 測定点(y=-po)から寸法線(y=0)への点線補助線 */}
            <line
              x1={-half}
              y1={-po}
              x2={-half}
              y2={0}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
            />
            <line
              x1={half}
              y1={-po}
              x2={half}
              y2={0}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
            />
          </>
        )}
        {style === 'arc' ? (
          <>
            {/* 中央を切った扁平楕円の両端弧のみ(寸法線・矢印なし) */}
            <path d={arcCap(half, capSize, -1, props.arcFlip)} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
            <path d={arcCap(half, capSize, 1, props.arcFlip)} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
          </>
        ) : (
          <>
            <path d={endCap(-half, capSize)} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
            <path d={endCap(half, capSize)} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
            <line x1={-half} y1={0} x2={half} y2={0} stroke={stroke} strokeWidth={strokeWidth} />
            <path d={arrowHead(-half, -1, arrowSize)} fill={stroke} />
            <path d={arrowHead(half, 1, arrowSize)} fill={stroke} />
          </>
        )}
        <MarkLabel
          x={0}
          y={-props.offset}
          dx={props.labelDx}
          dy={props.labelDy}
          rotation={transform?.rotation ?? 0}
          mode={props.labelMode}
          text={props.length.toFixed(Math.max(0, props.decimals))}
          latex={props.latex}
          fontSize={props.fontSize}
          color={stroke}
          bg={props.labelBg}
          objectId={objectId}
          interactive={interactive}
        />
      </g>
    );
  },
  getBounds: (props) => {
    const half = props.length / 2;
    const po = props.perpOffset ?? 0;
    // 描画部の上下端(局所y)。arc は短軸 ARC_MINOR_SCALE 倍・片側のみ(反転で上下切替)
    let markTop: number;
    let markBot: number;
    if (props.style === 'arc') {
      const reach = props.capSize * ARC_MINOR_SCALE;
      markTop = props.arcFlip ? -reach : 0;
      markBot = props.arcFlip ? 0 : reach;
    } else {
      markTop = -props.capSize;
      markBot = props.capSize;
    }
    const yTop = Math.min(markTop, -po, -(props.offset + props.fontSize));
    const yBot = Math.max(markBot, -po);
    const shape = { x: -half - 2, y: yTop, width: props.length + 4, height: yBot - yTop };
    const label = labelLocalBounds(
      { x: 0, y: -props.offset },
      props,
      markContent(props),
      props.fontSize,
    );
    return label ? unionRects([shape, label])! : shape;
  },
  getSnapPoints: (props) => segmentEndpoints(props.length).concat([{ x: 0, y: 0 }]),
  getEndpoints: (props) => segmentEndpoints(props.length),
  setFromEndpoints(props, a, b) {
    const { length, transform } = segmentFromEndpoints(a, b);
    return { props: { ...props, length }, transform };
  },
  applyRefs: (props, resolved, transform) => {
    const r = lengthMarkFromResolved(resolved, props.measureMode, props.perpOffset ?? 0);
    if (!r) return { props, transform };
    return { props: { ...props, length: r.length }, transform: r.transform };
  },
  dragOffset(props, transform, world) {
    // 測定線分(局所 y=-perpOffset)を再構成し、ポインタの垂直距離を新しい perpOffset にする
    const half = props.length / 2;
    const po = props.perpOffset ?? 0;
    const a = localToWorld({ x: -half, y: -po }, transform);
    const b = localToWorld({ x: half, y: -po }, transform);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const perpOffset = (world.x - mx) * nx + (world.y - my) * ny;
    return { ...props, perpOffset };
  },
  moveLabel: moveLabelOffset,
  capabilities: { rotatable: false, scalable: 'none' },
  placement: 'drag-line',
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, 80);
    return { props: { ...this.defaultProps, length }, transform };
  },
  // オブジェクトのエッジ(線分)/円周をクリックしたら、その測定にバインドする
  createFromEdge(pick) {
    if (pick.kind === 'segment') {
      return [
        { role: 'p0', targetId: pick.targetId, kind: 'segment', segIndex: pick.segIndex, t: 0 },
        { role: 'p1', targetId: pick.targetId, kind: 'segment', segIndex: pick.segIndex, t: 1 },
      ];
    }
    if (pick.kind === 'circle') {
      return [{ role: 'circle', targetId: pick.targetId, kind: 'circle', t: pick.t }];
    }
    return null; // 楕円は長さマーク未対応(壊れた参照を作らない)
  },
  exportStyles: buildKatexExportCss,
};
