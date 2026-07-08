import { unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { ObjectLabel } from '../basic/LabelView';
import { PatternDefs } from '../basic/PatternDefs';
import {
  fillOpacityField,
  fillPatternField,
  patternSizeField,
  resolveFill,
  resolveFillOpacity,
  type FillPattern,
  type PatternSize,
} from '../basic/fillPattern';
import { dashArray, lineStyleField, type LineStyle } from '../basic/lineUtils';
import {
  labelBgField,
  labelDecoDefaults,
  labelLocalBounds,
  moveLabelOffset,
  type LabelContent,
  type LabelDecoProps,
} from '../basic/objectLabel';

interface BlockProps extends LabelDecoProps {
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  label: string;
  /** ラベルの表示種別 */
  labelMode: LabelContent['mode'];
  /** LaTeX モードのときの数式 */
  labelLatex: string;
  fontSize: number;
  fillPattern: FillPattern;
  patternSize: PatternSize;
  fillOpacity: number;
}

const ORIGIN = { x: 0, y: 0 };

function blockLabel(props: BlockProps): LabelContent {
  return { mode: props.labelMode, text: props.label, latex: props.labelLatex };
}

export const blockPlugin: PhysicsObjectPlugin<BlockProps> = {
  id: 'mech.block',
  version: 1,
  name: 'ブロック',
  category: '力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="4" y="8" width="16" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="12" y="15" textAnchor="middle" dominantBaseline="central" fontSize="9" fontStyle="italic" fill="currentColor">
        m
      </text>
    </svg>
  ),
  defaultProps: {
    width: 80,
    height: 60,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    label: 'm',
    labelMode: 'text',
    labelLatex: 'm',
    fontSize: 12,
    fillPattern: 'none',
    patternSize: 'medium',
    fillOpacity: 0,
    ...labelDecoDefaults,
  },
  defaultSize: { width: 80, height: 60 },
  propertySchema: [
    { key: 'width', label: '幅', type: 'number', min: 1, step: 10 },
    { key: 'height', label: '高さ', type: 'number', min: 1, step: 10 },
    { key: 'fill', label: '塗り色', type: 'color' },
    fillOpacityField,
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
    lineStyleField,
    fillPatternField,
    patternSizeField,
    {
      key: 'labelMode',
      label: 'ラベル',
      type: 'select',
      options: [
        { value: 'text', label: 'テキスト' },
        { value: 'latex', label: 'LaTeX' },
        { value: 'none', label: 'なし' },
      ],
    },
    { key: 'label', label: 'ラベル文字', type: 'text' },
    { key: 'labelLatex', label: 'LaTeX式', type: 'text' },
    { key: 'fontSize', label: 'ラベルサイズ', type: 'number', min: 6, step: 2 },
    labelBgField,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => (
    <g>
      <PatternDefs props={props} />
      <rect
        x={-props.width / 2}
        y={-props.height / 2}
        width={props.width}
        height={props.height}
        fill={resolveFill(props)}
        fillOpacity={resolveFillOpacity(props)}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
      />
      <ObjectLabel
        anchor={ORIGIN}
        dx={props.labelDx}
        dy={props.labelDy}
        rotation={transform?.rotation ?? 0}
        content={blockLabel(props)}
        fontSize={props.fontSize}
        color={props.stroke}
        bg={props.labelBg}
        italic
        fontFamily='"Times New Roman", serif'
        objectId={objectId}
        interactive={interactive}
      />
    </g>
  ),
  getBounds: (props) => {
    const shape = {
      x: -props.width / 2,
      y: -props.height / 2,
      width: props.width,
      height: props.height,
    };
    const label = labelLocalBounds(ORIGIN, props, blockLabel(props), props.fontSize);
    return label ? unionRects([shape, label])! : shape;
  },
  getSnapPoints: (props) => {
    const hw = props.width / 2;
    const hh = props.height / 2;
    return [
      { x: 0, y: 0 },
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
      { x: 0, y: -hh },
      { x: hw, y: 0 },
      { x: 0, y: hh },
      { x: -hw, y: 0 },
    ];
  },
  getSegments: (props) => {
    const hw = props.width / 2;
    const hh = props.height / 2;
    return [
      [{ x: -hw, y: -hh }, { x: hw, y: -hh }],
      [{ x: hw, y: -hh }, { x: hw, y: hh }],
      [{ x: hw, y: hh }, { x: -hw, y: hh }],
      [{ x: -hw, y: hh }, { x: -hw, y: -hh }],
    ];
  },
  applyScale: (props, fx, fy) => ({
    ...props,
    width: props.width * fx,
    height: props.height * fy,
  }),
  moveLabel: moveLabelOffset,
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
