import type { PhysicsObjectPlugin } from '../../core/plugin';

interface PointProps {
  radius: number;
  color: string;
}

/** 点(小さい塗り円)。質点・作用点・交点などに使う */
export const pointPlugin: PhysicsObjectPlugin<PointProps> = {
  id: 'core.point',
  version: 1,
  name: '点',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  ),
  defaultProps: {
    radius: 2,
    color: '#000000',
  },
  defaultSize: { width: 4, height: 4 },
  propertySchema: [
    { key: 'radius', label: '半径', type: 'number', min: 0.5, step: 0.5 },
    { key: 'color', label: '色', type: 'color' },
  ],
  Renderer: ({ props }) => <circle r={props.radius} fill={props.color} />,
  getBounds: (props) => ({
    x: -props.radius,
    y: -props.radius,
    width: props.radius * 2,
    height: props.radius * 2,
  }),
  getSnapPoints: () => [{ x: 0, y: 0 }],
  capabilities: { rotatable: false, scalable: 'none' },
  placement: 'click',
};
