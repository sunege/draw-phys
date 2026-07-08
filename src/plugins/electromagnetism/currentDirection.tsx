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

interface CurrentDirectionProps extends CircuitLabelProps {
  radius: number;
  dir: 'in' | 'out';
  stroke: string;
  strokeWidth: number;
}

const LABEL_GAP = 6;

/** 電流/磁場の向き。in=⊗(紙面奥へ) / out=⊙(紙面手前へ) */
export const currentDirectionPlugin: PhysicsObjectPlugin<CurrentDirectionProps> = {
  id: 'em.currentDirection',
  version: 1,
  name: '電流・磁場の向き',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="17.5" y1="6.5" x2="6.5" y2="17.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    radius: 10,
    dir: 'in',
    stroke: '#000000',
    strokeWidth: 1,
    ...circuitLabelDefaults('', 'none'),
  },
  defaultSize: { width: 20, height: 20 },
  propertySchema: [
    { key: 'radius', label: '半径', type: 'number', min: 3, step: 1 },
    {
      key: 'dir',
      label: '向き',
      type: 'select',
      options: [
        { value: 'in', label: '奥へ ⊗' },
        { value: 'out', label: '手前へ ⊙' },
      ],
    },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    ...circuitLabelFields,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const d = props.radius * Math.SQRT1_2;
    const anchor = { x: 0, y: -props.radius - LABEL_GAP };
    return (
      <g>
        <circle r={props.radius} fill="#ffffff" stroke={props.stroke} strokeWidth={props.strokeWidth} />
        {props.dir === 'in' ? (
          <>
            <line x1={-d} y1={-d} x2={d} y2={d} stroke={props.stroke} strokeWidth={props.strokeWidth} />
            <line x1={d} y1={-d} x2={-d} y2={d} stroke={props.stroke} strokeWidth={props.strokeWidth} />
          </>
        ) : (
          <circle r={Math.max(1, props.radius * 0.2)} fill={props.stroke} />
        )}
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
