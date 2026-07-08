import { unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { moveLabelOffset } from '../basic/objectLabel';
import { CircuitLabel } from './CircuitParts';
import {
  circuitLabelBounds,
  circuitLabelDefaults,
  circuitLabelFields,
  type CircuitLabelProps,
} from './circuitLabel';

interface GroundProps extends CircuitLabelProps {
  width: number;
  height: number;
  stub: number;
  filled: boolean;
  stroke: string;
  strokeWidth: number;
}

/** グランド(シグナル/シャーシ接地)。接続点=上端、下向き三角。アースと別記号 */
export const groundPlugin: PhysicsObjectPlugin<GroundProps> = {
  id: 'em.ground',
  version: 1,
  name: 'グランド',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="12" y1="3" x2="12" y2="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 9 L19 9 L12 20 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  defaultProps: {
    width: 28,
    height: 22,
    stub: 10,
    filled: true,
    stroke: '#000000',
    strokeWidth: 1,
    ...circuitLabelDefaults('', 'none'),
  },
  defaultSize: { width: 28, height: 32 },
  propertySchema: [
    { key: 'width', label: '三角の幅', type: 'number', min: 8, step: 2 },
    { key: 'height', label: '三角の高さ', type: 'number', min: 6, step: 2 },
    { key: 'stub', label: '接続線の長さ', type: 'number', min: 0, step: 2 },
    { key: 'filled', label: '三角を塗る', type: 'boolean' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    ...circuitLabelFields,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const hw = props.width / 2;
    const top = props.stub;
    const bottom = props.stub + props.height;
    const anchor = { x: props.width / 2 + 8, y: props.stub };
    return (
      <g>
        <line x1={0} y1={0} x2={0} y2={top} stroke={props.stroke} strokeWidth={props.strokeWidth} />
        <polygon
          points={`${-hw},${top} ${hw},${top} 0,${bottom}`}
          fill={props.filled ? props.stroke : '#ffffff'}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinejoin="round"
        />
        <CircuitLabel
          anchor={anchor}
          props={props}
          color={props.stroke}
          rotation={transform?.rotation ?? 0}
          objectId={objectId}
          interactive={interactive}
        />
      </g>
    );
  },
  getBounds: (props) => {
    const body = {
      x: -props.width / 2,
      y: -props.strokeWidth,
      width: props.width,
      height: props.stub + props.height + props.strokeWidth * 2,
    };
    const label = circuitLabelBounds({ x: props.width / 2 + 8, y: props.stub }, props);
    return label ? unionRects([body, label])! : body;
  },
  getSnapPoints: () => [{ x: 0, y: 0 }],
  moveLabel: moveLabelOffset,
  capabilities: { rotatable: true, scalable: 'none' },
  placement: 'click',
};
