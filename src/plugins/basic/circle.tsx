import type { PhysicsObjectPlugin } from '../../core/plugin';
import { CenterMark } from './CenterMark';
import { PatternDefs } from './PatternDefs';
import { fillPatternField, resolveFill, type FillPattern } from './fillPattern';

interface CircleProps {
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillPattern: FillPattern;
  showCenter: boolean;
}

export const circlePlugin: PhysicsObjectPlugin<CircleProps> = {
  id: 'core.circle',
  version: 1,
  name: '円',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  defaultProps: {
    radius: 40,
    fill: '#ffffff',
    stroke: '#333333',
    strokeWidth: 2,
    fillPattern: 'none',
    showCenter: false,
  },
  defaultSize: { width: 80, height: 80 },
  propertySchema: [
    { key: 'radius', label: '半径', type: 'number', min: 1, step: 5 },
    { key: 'fill', label: '塗り色', type: 'color' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
    fillPatternField,
    { key: 'showCenter', label: '重心を表示', type: 'boolean' },
  ],
  Renderer: ({ props }) => (
    <g>
      <PatternDefs props={props} />
      <circle
        r={props.radius}
        fill={resolveFill(props)}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
      />
      {props.showCenter && <CenterMark color={props.stroke} />}
    </g>
  ),
  getBounds: (props) => ({
    x: -props.radius,
    y: -props.radius,
    width: props.radius * 2,
    height: props.radius * 2,
  }),
  getSnapPoints: (props) => [
    { x: 0, y: 0 },
    { x: 0, y: -props.radius },
    { x: props.radius, y: 0 },
    { x: 0, y: props.radius },
    { x: -props.radius, y: 0 },
  ],
  getCircle: (props) => ({ center: { x: 0, y: 0 }, radius: props.radius }),
  applyScale: (props, fx) => ({ ...props, radius: props.radius * fx }),
  capabilities: { rotatable: false, scalable: 'uniform' },
  placement: 'click',
};
