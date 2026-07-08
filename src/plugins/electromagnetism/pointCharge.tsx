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

interface PointChargeProps extends CircuitLabelProps {
  radius: number;
  sign: '+' | '-';
  fill: string;
  signColor: string;
  stroke: string;
  strokeWidth: number;
}

const LABEL_GAP = 6;

/** 点電荷。円+符号(+/-)。静電気の作図に使う */
export const pointChargePlugin: PhysicsObjectPlugin<PointChargeProps> = {
  id: 'em.pointCharge',
  version: 1,
  name: '点電荷',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="7" x2="12" y2="17" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    radius: 11,
    sign: '+',
    fill: '#e05a5a',
    signColor: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    ...circuitLabelDefaults('q'),
  },
  defaultSize: { width: 22, height: 22 },
  propertySchema: [
    { key: 'radius', label: '半径', type: 'number', min: 3, step: 1 },
    {
      key: 'sign',
      label: '符号',
      type: 'select',
      options: [
        { value: '+', label: '正 +' },
        { value: '-', label: '負 −' },
      ],
    },
    { key: 'fill', label: '円の色', type: 'color' },
    { key: 'signColor', label: '符号の色', type: 'color' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
    ...circuitLabelFields,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const s = props.radius * 0.55;
    const sw = Math.max(1.2, props.radius * 0.16);
    const rot = -(transform?.rotation ?? 0);
    const anchor = { x: 0, y: -props.radius - LABEL_GAP };
    return (
      <g>
        <circle
          r={props.radius}
          fill={props.fill}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
        />
        <g transform={`rotate(${rot})`}>
          <line x1={-s} y1={0} x2={s} y2={0} stroke={props.signColor} strokeWidth={sw} strokeLinecap="round" />
          {props.sign === '+' && (
            <line x1={0} y1={-s} x2={0} y2={s} stroke={props.signColor} strokeWidth={sw} strokeLinecap="round" />
          )}
        </g>
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
    const r = props.radius + props.strokeWidth;
    const body = { x: -r, y: -r, width: r * 2, height: r * 2 };
    const label = circuitLabelBounds({ x: 0, y: -props.radius - LABEL_GAP }, props);
    return label ? unionRects([body, label])! : body;
  },
  getSnapPoints: () => [{ x: 0, y: 0 }],
  applyScale: (props, fx) => ({ ...props, radius: props.radius * fx }),
  moveLabel: moveLabelOffset,
  capabilities: { rotatable: false, scalable: 'uniform' },
  placement: 'click',
};
