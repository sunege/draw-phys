import type { PhysicsObjectPlugin } from '../../core/plugin';

interface PulleyProps {
  radius: number;
  hubRadius: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
  fillOpacity: number;
}

/**
 * 滑車(円板+軸)。getCircle を返すので、線・ロープ(core.line等)の
 * 接線拘束・円周への一致拘束の相手になれる。
 */
export const pulleyPlugin: PhysicsObjectPlugin<PulleyProps> = {
  id: 'mech.pulley',
  version: 1,
  name: '滑車',
  category: '力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="9" r="1.5" fill="currentColor" />
      <line x1="6" y1="9" x2="6" y2="20" stroke="currentColor" strokeWidth="1.5" />
      <line x1="18" y1="9" x2="18" y2="20" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    radius: 25,
    hubRadius: 2.5,
    stroke: '#000000',
    strokeWidth: 1,
    fill: '#ffffff',
    fillOpacity: 0,
  },
  defaultSize: { width: 50, height: 50 },
  propertySchema: [
    { key: 'radius', label: '半径', type: 'number', min: 2, step: 5 },
    { key: 'hubRadius', label: '軸の半径', type: 'number', min: 0, step: 0.5 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    { key: 'fill', label: '塗り色', type: 'color' },
    { key: 'fillOpacity', label: '塗りの不透明度', type: 'number', min: 0, max: 1, step: 0.1 },
  ],
  Renderer: ({ props }) => (
    <g>
      <circle
        r={props.radius}
        fill={props.fill}
        fillOpacity={props.fillOpacity}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
      />
      {props.hubRadius > 0 && <circle r={props.hubRadius} fill={props.stroke} />}
      <circle r={props.radius} fill="transparent" stroke="none" />
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
    { x: props.radius, y: 0 },
    { x: -props.radius, y: 0 },
    { x: 0, y: props.radius },
    { x: 0, y: -props.radius },
  ],
  getCircle: (props) => ({ center: { x: 0, y: 0 }, radius: props.radius }),
  applyScale: (props, fx) => ({
    ...props,
    radius: props.radius * fx,
    hubRadius: props.hubRadius * fx,
  }),
  capabilities: { rotatable: false, scalable: 'uniform' },
  placement: 'click',
};
