import type { PhysicsObjectPlugin } from '../../core/plugin';
import { blockArrowHeight, blockArrowPointsAttr } from './blockArrowMath';
import {
  fillOpacityField,
  fillPatternField,
  resolveFill,
  resolveFillOpacity,
  type FillPattern,
} from './fillPattern';
import { PatternDefs } from './PatternDefs';
import {
  applyTangent,
  dashArray,
  dragTangentEndpoint,
  lineFromDrag,
  lineStyleField,
  segmentEndpoints,
  segmentFromEndpoints,
  tangentAnchorPoint,
  type LineStyle,
} from './lineUtils';

interface BlockArrowProps {
  length: number;
  shaftWidth: number;
  headWidth: number;
  headLength: number;
  doubleHead: boolean;
  fill: string;
  fillOpacity: number;
  fillPattern: FillPattern;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  /** 接線拘束時の接点オフセット(線分系共通の内部状態) */
  tangentOffset?: number;
}

export const blockArrowPlugin: PhysicsObjectPlugin<BlockArrowProps> = {
  id: 'core.blockArrow',
  version: 1,
  name: '中抜き矢印',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <polygon
        points="3,9 14,9 14,5 21,12 14,19 14,15 3,15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  defaultProps: {
    length: 100,
    shaftWidth: 24,
    headWidth: 44,
    headLength: 30,
    doubleHead: false,
    fill: '#ffffff',
    fillOpacity: 0,
    fillPattern: 'none',
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
  },
  defaultSize: { width: 100, height: 44 },
  propertySchema: [
    { key: 'length', label: '長さ', type: 'number', min: 1, step: 10 },
    { key: 'shaftWidth', label: '軸の太さ', type: 'number', min: 2, step: 1 },
    { key: 'headWidth', label: '矢先の幅', type: 'number', min: 2, step: 1 },
    { key: 'headLength', label: '矢先の長さ', type: 'number', min: 1, step: 1 },
    { key: 'doubleHead', label: '両端矢印', type: 'boolean' },
    { key: 'fill', label: '塗り色', type: 'color' },
    fillOpacityField,
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    fillPatternField,
  ],
  Renderer: ({ props }) => (
    <g>
      <PatternDefs props={props} />
      <polygon
        points={blockArrowPointsAttr(props)}
        fill={resolveFill(props)}
        fillOpacity={resolveFillOpacity(props)}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        strokeLinejoin="round"
      />
    </g>
  ),
  getBounds: (props) => {
    const h = Math.max(blockArrowHeight(props), props.strokeWidth);
    return { x: -props.length / 2, y: -h / 2, width: props.length, height: h };
  },
  getSnapPoints: (props) => [
    { x: -props.length / 2, y: 0 },
    { x: 0, y: 0 },
    { x: props.length / 2, y: 0 },
  ],
  getSegments: (props) => [segmentEndpoints(props.length)],
  getEndpoints: (props) => segmentEndpoints(props.length),
  setFromEndpoints(props, a, b) {
    const { length, transform } = segmentFromEndpoints(a, b);
    return { props: { ...props, length }, transform };
  },
  applyRefs: applyTangent,
  getAnchorPoint: tangentAnchorPoint,
  dragEndpointConstrained: dragTangentEndpoint,
  capabilities: { rotatable: true, scalable: 'none' },
  placement: 'drag-line',
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, 100);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
