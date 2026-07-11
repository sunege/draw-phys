import type { PhysicsObjectPlugin } from '../../core/plugin';

interface LightSourceProps {
  radius: number;
  rayCount: number;
  rayLength: number;
  rayGap: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
  fillOpacity: number;
}

/** 点光源。中心の円から放射状の短い光線を描く */
export const lightSourcePlugin: PhysicsObjectPlugin<LightSourceProps> = {
  id: 'optics.lightSource',
  version: 1,
  name: '点光源',
  category: '光学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        return (
          <line
            key={deg}
            x1={12 + 6 * c}
            y1={12 + 6 * s}
            x2={12 + 10 * c}
            y2={12 + 10 * s}
            stroke="currentColor"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  ),
  defaultProps: {
    radius: 5,
    rayCount: 8,
    rayLength: 9,
    rayGap: 3,
    stroke: '#000000',
    strokeWidth: 1,
    fill: '#ffffff',
    fillOpacity: 0,
  },
  defaultSize: { width: 34, height: 34 },
  propertySchema: [
    { key: 'radius', label: '半径', type: 'number', min: 1, step: 1 },
    { key: 'rayCount', label: '光線の本数', type: 'number', min: 0, max: 36, step: 1 },
    { key: 'rayLength', label: '光線の長さ', type: 'number', min: 1, step: 1 },
    { key: 'rayGap', label: '光線との隙間', type: 'number', min: 0, step: 1 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    { key: 'fill', label: '塗り色', type: 'color' },
    { key: 'fillOpacity', label: '塗りの不透明度', type: 'number', min: 0, max: 1, step: 0.1 },
  ],
  Renderer: ({ props }) => {
    const inner = props.radius + props.rayGap;
    const outer = inner + props.rayLength;
    const rays: { deg: number; c: number; s: number }[] = [];
    for (let i = 0; i < props.rayCount; i++) {
      const deg = (360 * i) / props.rayCount;
      const rad = (deg * Math.PI) / 180;
      rays.push({ deg, c: Math.cos(rad), s: Math.sin(rad) });
    }
    return (
      <g>
        <circle
          r={props.radius}
          fill={props.fill}
          fillOpacity={props.fillOpacity}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
        />
        {rays.map(({ deg, c, s }) => (
          <line
            key={deg}
            x1={inner * c}
            y1={inner * s}
            x2={outer * c}
            y2={outer * s}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
          />
        ))}
        <circle r={outer} fill="transparent" stroke="none" />
      </g>
    );
  },
  getBounds: (props) => {
    const r = props.radius + props.rayGap + props.rayLength;
    return { x: -r, y: -r, width: r * 2, height: r * 2 };
  },
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
    rayLength: props.rayLength * fx,
    rayGap: props.rayGap * fx,
  }),
  capabilities: { rotatable: true, scalable: 'uniform' },
  placement: 'click',
};
