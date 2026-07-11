import { unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point } from '../../core/types';
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
import {
  labelBgField,
  labelDecoDefaults,
  labelLocalBounds,
  moveLabelOffset,
  type LabelContent,
  type LabelDecoProps,
} from '../basic/objectLabel';

interface CartProps extends LabelDecoProps {
  width: number;
  height: number;
  wheelRadius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  label: string;
  labelMode: LabelContent['mode'];
  labelLatex: string;
  fontSize: number;
  fillPattern: FillPattern;
  patternSize: PatternSize;
  fillOpacity: number;
}

/** 車体(荷台)と車輪のローカル配置。原点=全体(車体+車輪)の中心 */
function cartLayout(props: CartProps) {
  const totalH = props.height + props.wheelRadius;
  const bodyTop = -totalH / 2;
  const wheelY = bodyTop + props.height;
  const wheelX = Math.max(0, props.width / 2 - props.wheelRadius - 4);
  return { totalH, bodyTop, wheelY, wheelX, bodyCenterY: bodyTop + props.height / 2 };
}

function cartLabel(props: CartProps): LabelContent {
  return { mode: props.labelMode, text: props.label, latex: props.labelLatex };
}

/** 台車(力学台車)。車体の上面・側面がスナップ・拘束相手になる */
export const cartPlugin: PhysicsObjectPlugin<CartProps> = {
  id: 'mech.cart',
  version: 1,
  name: '台車',
  category: '力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="3" y="8" width="18" height="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="17.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="17.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    width: 90,
    height: 26,
    wheelRadius: 8,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    label: 'M',
    labelMode: 'text',
    labelLatex: 'M',
    fontSize: 12,
    fillPattern: 'none',
    patternSize: 'medium',
    fillOpacity: 0,
    ...labelDecoDefaults,
  },
  defaultSize: { width: 90, height: 34 },
  propertySchema: [
    { key: 'width', label: '幅', type: 'number', min: 10, step: 10 },
    { key: 'height', label: '車体の高さ', type: 'number', min: 4, step: 2 },
    { key: 'wheelRadius', label: '車輪の半径', type: 'number', min: 1, step: 1 },
    { key: 'fill', label: '塗り色', type: 'color' },
    fillOpacityField,
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
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
  Renderer: ({ props, transform, objectId, interactive }) => {
    const L = cartLayout(props);
    return (
      <g>
        <PatternDefs props={props} />
        <rect
          x={-props.width / 2}
          y={L.bodyTop}
          width={props.width}
          height={props.height}
          fill={resolveFill(props)}
          fillOpacity={resolveFillOpacity(props)}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
        />
        {[-L.wheelX, L.wheelX].map((x) => (
          <g key={x}>
            <circle
              cx={x}
              cy={L.wheelY}
              r={props.wheelRadius}
              fill="#ffffff"
              fillOpacity={0}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
            />
            <circle cx={x} cy={L.wheelY} r={1.5} fill={props.stroke} />
          </g>
        ))}
        <ObjectLabel
          anchor={{ x: 0, y: L.bodyCenterY }}
          dx={props.labelDx}
          dy={props.labelDy}
          rotation={transform?.rotation ?? 0}
          content={cartLabel(props)}
          fontSize={props.fontSize}
          color={props.stroke}
          bg={props.labelBg}
          italic
          fontFamily='"Times New Roman", serif'
          objectId={objectId}
          interactive={interactive}
        />
      </g>
    );
  },
  getBounds: (props) => {
    const L = cartLayout(props);
    const shape = {
      x: -props.width / 2,
      y: L.bodyTop,
      width: props.width,
      height: L.totalH,
    };
    const label = labelLocalBounds({ x: 0, y: L.bodyCenterY }, props, cartLabel(props), props.fontSize);
    return label ? unionRects([shape, label])! : shape;
  },
  getSnapPoints: (props) => {
    const L = cartLayout(props);
    const hw = props.width / 2;
    const bodyBottom = L.bodyTop + props.height;
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: L.bodyTop },
      { x: -hw, y: L.bodyTop },
      { x: hw, y: L.bodyTop },
      { x: -hw, y: L.bodyCenterY },
      { x: hw, y: L.bodyCenterY },
      { x: -hw, y: bodyBottom },
      { x: hw, y: bodyBottom },
      // 車輪の接地点(床に乗せる用)
      { x: -L.wheelX, y: L.totalH / 2 },
      { x: L.wheelX, y: L.totalH / 2 },
    ];
    return pts;
  },
  getSegments: (props) => {
    const L = cartLayout(props);
    const hw = props.width / 2;
    const bodyBottom = L.bodyTop + props.height;
    return [
      [
        { x: -hw, y: L.bodyTop },
        { x: hw, y: L.bodyTop },
      ],
      [
        { x: -hw, y: L.bodyTop },
        { x: -hw, y: bodyBottom },
      ],
      [
        { x: hw, y: L.bodyTop },
        { x: hw, y: bodyBottom },
      ],
    ];
  },
  applyScale: (props, fx, fy) => ({
    ...props,
    width: props.width * fx,
    height: props.height * fy,
    wheelRadius: props.wheelRadius * Math.min(fx, fy),
  }),
  moveLabel: moveLabelOffset,
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
