import type { PhysicsObjectPlugin } from '../../core/plugin';
import {
  applyTangent,
  dragTangentEndpoint,
  hitStrokeWidth,
  lineFromDrag,
  lineStyleFieldExtended,
  segmentEndpoints,
  segmentFromEndpoints,
  tangentAnchorPoint,
  type LineStyle,
} from './lineUtils';
import { StyledStroke } from './StyledStroke';

interface ArrowProps {
  length: number;
  stroke: string;
  strokeWidth: number;
  headSize: number;
  doubleHead: boolean;
  lineStyle: LineStyle;
  /** 接線拘束時の接点オフセット(線分系共通の内部状態) */
  tangentOffset?: number;
}

/** 矢先のポリゴン点列(先端がtipX) */
function headPoints(tipX: number, dir: 1 | -1, headSize: number): string {
  const base = tipX - dir * headSize;
  const halfW = headSize * 0.4;
  return `${tipX},0 ${base},${-halfW} ${base},${halfW}`;
}

export const arrowPlugin: PhysicsObjectPlugin<ArrowProps> = {
  id: 'core.arrow',
  version: 1,
  name: '矢印',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="4" y1="18" x2="17" y2="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 4 L18.5 11 L13 5.5 Z" fill="currentColor" />
    </svg>
  ),
  defaultProps: {
    length: 100,
    stroke: '#000000',
    strokeWidth: 1,
    headSize: 9,
    doubleHead: false,
    lineStyle: 'solid',
  },
  defaultSize: { width: 100, height: 9 },
  propertySchema: [
    { key: 'length', label: '長さ', type: 'number', min: 1, step: 10 },
    { key: 'stroke', label: '色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleFieldExtended,
    { key: 'headSize', label: '矢先サイズ', type: 'number', min: 2, step: 1 },
    { key: 'doubleHead', label: '両端矢印', type: 'boolean' },
  ],
  Renderer: ({ props }) => {
    const half = props.length / 2;
    // 矢先と線の重なりを避けるため、線は矢先の付け根まで
    const endX = half - props.headSize * 0.8;
    const startX = props.doubleHead ? -half + props.headSize * 0.8 : -half;
    return (
      <g>
        <StyledStroke
          lineStyle={props.lineStyle}
          bounds={{ x: -half, y: 0, width: props.length, height: 0 }}
        >
          <line
            x1={startX}
            y1={0}
            x2={endX}
            y2={0}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
          />
        </StyledStroke>
        <polygon points={headPoints(half, 1, props.headSize)} fill={props.stroke} />
        {props.doubleHead && (
          <polygon points={headPoints(-half, -1, props.headSize)} fill={props.stroke} />
        )}
        <line
          x1={-half}
          y1={0}
          x2={half}
          y2={0}
          stroke="transparent"
          strokeWidth={hitStrokeWidth(props.headSize)}
        />
      </g>
    );
  },
  getBounds: (props) => {
    const h = Math.max(props.strokeWidth, props.headSize * 0.8, 8);
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
