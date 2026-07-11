import { angleOfVector, reflectAngle, reflectPoint } from '../../core/geometry';
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

interface StringProps {
  length: number;
  /** 中央のたるみ量(局所+y方向)。0で直線、負で逆側に膨らむ */
  sag: number;
  lengthLocked: boolean;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  /** 接線拘束時の接点オフセット(線分系共通の内部状態) */
  tangentOffset?: number;
}

/** 糸の描画パス(たるみは2次ベジェ。中点の垂れ=sag) */
function stringPath(length: number, sag: number): string {
  const half = length / 2;
  if (Math.abs(sag) < 0.01) return `M ${-half} 0 L ${half} 0`;
  return `M ${-half} 0 Q 0 ${sag * 2} ${half} 0`;
}

/**
 * 糸・ロープ。たるみ付きの線分で、長さ固定(振り子)や
 * 滑車(getCircleを持つ円)への接線拘束が使える。
 */
export const stringPlugin: PhysicsObjectPlugin<StringProps> = {
  id: 'mech.string',
  version: 1,
  name: '糸・ロープ',
  category: '力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M3 9 Q12 17 21 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="3" cy="9" r="1.5" fill="currentColor" />
      <circle cx="21" cy="9" r="1.5" fill="currentColor" />
    </svg>
  ),
  defaultProps: {
    length: 120,
    sag: 0,
    lengthLocked: false,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
  },
  defaultSize: { width: 120, height: 4 },
  propertySchema: [
    { key: 'length', label: '長さ', type: 'number', min: 1, step: 10 },
    { key: 'sag', label: 'たるみ', type: 'number', step: 2 },
    { key: 'lengthLocked', label: '長さ固定', type: 'boolean' },
    { key: 'stroke', label: '色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
  ],
  Renderer: ({ props }) => {
    const d = stringPath(props.length, props.sag);
    return (
      <g>
        <path
          d={d}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        />
        <path d={d} fill="none" stroke="transparent" strokeWidth={hitStrokeWidth(props.strokeWidth)} />
      </g>
    );
  },
  getBounds: (props) => {
    const y0 = Math.min(0, props.sag) - 4;
    const y1 = Math.max(0, props.sag) + 4;
    return { x: -props.length / 2, y: y0, width: props.length, height: y1 - y0 };
  },
  getSnapPoints: (props) => [
    { x: -props.length / 2, y: 0 },
    { x: 0, y: props.sag },
    { x: props.length / 2, y: 0 },
  ],
  getSegments: (props) => [segmentEndpoints(props.length)],
  getEndpoints: (props) => segmentEndpoints(props.length),
  setFromEndpoints(props, a, b) {
    const { length, transform } = segmentFromEndpoints(a, b);
    return { props: { ...props, length }, transform };
  },
  isLengthLocked: (props) => props.lengthLocked,
  applyRefs: applyTangent,
  getAnchorPoint: tangentAnchorPoint,
  dragEndpointConstrained: dragTangentEndpoint,
  // 鏡像: たるみは線に対して手性を持つので符号を反転する(arc.tsx と同じ M_x 方式)
  mirror: (props, t, a, b) => {
    const c = reflectPoint({ x: t.x, y: t.y }, a, b);
    const axisAngle = angleOfVector({ x: b.x - a.x, y: b.y - a.y });
    return {
      props: { ...props, sag: -props.sag },
      transform: { ...t, x: c.x, y: c.y, rotation: reflectAngle(t.rotation, axisAngle) },
    };
  },
  capabilities: { rotatable: true, scalable: 'none' },
  placement: 'drag-line',
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, 120);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
