import type { PhysicsObjectPlugin } from '../../core/plugin';
import {
  applyTangent,
  dashArray,
  dragTangentEndpoint,
  hitStrokeWidth,
  lineFromDrag,
  lineStyleField,
  segmentEndpoints,
  segmentFromEndpoints,
  tangentAnchorPoint,
  type LineStyle,
} from '../basic/lineUtils';

interface RayProps {
  length: number;
  stroke: string;
  strokeWidth: number;
  headSize: number;
  /** 矢印の位置(0=始点〜1=終点)。光線は途中に矢印を描く慣習 */
  arrowPos: number;
  lineStyle: LineStyle;
  /** 接線拘束時の接点オフセット(線分系共通の内部状態) */
  tangentOffset?: number;
}

/** 光線。線の途中(既定は中央)に進行方向の矢印を置く */
export const rayPlugin: PhysicsObjectPlugin<RayProps> = {
  id: 'optics.ray',
  version: 1,
  name: '光線',
  category: '光学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="3" y1="18" x2="21" y2="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15.5 6.5 L9.5 6 L12.5 11 Z" fill="currentColor" />
    </svg>
  ),
  defaultProps: {
    length: 140,
    stroke: '#000000',
    strokeWidth: 1,
    headSize: 9,
    arrowPos: 0.5,
    lineStyle: 'solid',
  },
  defaultSize: { width: 140, height: 9 },
  propertySchema: [
    { key: 'length', label: '長さ', type: 'number', min: 1, step: 10 },
    { key: 'stroke', label: '色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    { key: 'headSize', label: '矢先サイズ', type: 'number', min: 0, step: 1 },
    { key: 'arrowPos', label: '矢印位置(0〜1)', type: 'number', min: 0, max: 1, step: 0.05 },
  ],
  Renderer: ({ props }) => {
    const half = props.length / 2;
    const hs = props.headSize;
    const px = -half + props.length * props.arrowPos;
    return (
      <g>
        <line
          x1={-half}
          y1={0}
          x2={half}
          y2={0}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        />
        {hs > 0 && (
          <polygon
            points={`${px + hs * 0.5},0 ${px - hs * 0.5},${-hs * 0.4} ${px - hs * 0.5},${hs * 0.4}`}
            fill={props.stroke}
          />
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
    const { length, transform } = lineFromDrag(start, end, 140);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
