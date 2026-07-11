import type { PhysicsObjectPlugin } from '../../core/plugin';
import { flamePath } from './thermoMath';

interface FlameProps {
  width: number;
  height: number;
  showInner: boolean;
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
}

/** 熱源(炎)。シリンダーや容器の下に置いて加熱を表す */
export const flamePlugin: PhysicsObjectPlugin<FlameProps> = {
  id: 'thermo.flame',
  version: 1,
  name: '熱源(炎)',
  category: '熱力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M12 3 C13.5 6.5 17 8 17 13 A5 5.5 0 0 1 7 13 C7 8 10.5 6.5 12 3 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  ),
  defaultProps: {
    width: 28,
    height: 40,
    showInner: true,
    fill: '#ffffff',
    fillOpacity: 0,
    stroke: '#000000',
    strokeWidth: 1,
  },
  defaultSize: { width: 28, height: 40 },
  propertySchema: [
    { key: 'width', label: '幅', type: 'number', min: 4, step: 2 },
    { key: 'height', label: '高さ', type: 'number', min: 6, step: 2 },
    { key: 'showInner', label: '内炎を表示', type: 'boolean' },
    { key: 'fill', label: '塗り色', type: 'color' },
    { key: 'fillOpacity', label: '塗りの不透明度', type: 'number', min: 0, max: 1, step: 0.1 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
  ],
  Renderer: ({ props }) => (
    <g>
      <path
        d={flamePath(props.width, props.height)}
        fill={props.fill}
        fillOpacity={props.fillOpacity}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
      />
      {props.showInner && (
        <path
          d={flamePath(props.width * 0.45, props.height * 0.5)}
          transform={`translate(0 ${props.height * 0.18})`}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth * 0.8}
        />
      )}
    </g>
  ),
  getBounds: (props) => ({
    x: -props.width / 2,
    y: -props.height / 2,
    width: props.width,
    height: props.height,
  }),
  getSnapPoints: (props) => [
    { x: 0, y: 0 },
    { x: 0, y: -props.height / 2 },
    { x: 0, y: props.height / 2 },
  ],
  applyScale: (props, fx, fy) => ({
    ...props,
    width: props.width * fx,
    height: props.height * fy,
  }),
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
