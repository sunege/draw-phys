import type { PhysicsObjectPlugin } from '../../core/plugin';
import { thermometerLayout } from './thermoMath';

interface ThermometerProps {
  stemLength: number;
  bulbRadius: number;
  tubeWidth: number;
  /** 液面の高さ(0=球部のみ〜1=管の上端近く) */
  level: number;
  tickCount: number;
  showTicks: boolean;
  liquid: string;
  stroke: string;
  strokeWidth: number;
}

/** 温度計。管を上・球部を下に描き、液面の高さをpropsで変えられる */
export const thermometerPlugin: PhysicsObjectPlugin<ThermometerProps> = {
  id: 'thermo.thermometer',
  version: 1,
  name: '温度計',
  category: '熱力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="10" y="2" width="4" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="18.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="9" x2="12" y2="16" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="18.5" r="2" fill="currentColor" />
    </svg>
  ),
  defaultProps: {
    stemLength: 70,
    bulbRadius: 7,
    tubeWidth: 6,
    level: 0.5,
    tickCount: 5,
    showTicks: true,
    liquid: '#e05a5a',
    stroke: '#000000',
    strokeWidth: 1,
  },
  defaultSize: { width: 20, height: 84 },
  propertySchema: [
    { key: 'stemLength', label: '管の長さ', type: 'number', min: 10, step: 5 },
    { key: 'bulbRadius', label: '球部の半径', type: 'number', min: 2, step: 1 },
    { key: 'tubeWidth', label: '管の幅', type: 'number', min: 2, step: 1 },
    { key: 'level', label: '液面(0〜1)', type: 'number', min: 0, max: 1, step: 0.1 },
    { key: 'showTicks', label: '目盛りを表示', type: 'boolean' },
    { key: 'tickCount', label: '目盛りの数', type: 'number', min: 1, max: 30, step: 1 },
    { key: 'liquid', label: '液の色', type: 'color' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
  ],
  Renderer: ({ props }) => {
    const L = thermometerLayout(
      props.stemLength,
      props.bulbRadius,
      props.tubeWidth,
      props.level,
      props.tickCount,
    );
    return (
      <g>
        <rect
          x={L.liquid.x}
          y={L.liquid.y}
          width={L.liquid.width}
          height={L.liquid.height}
          fill={props.liquid}
        />
        <circle cx={L.bulbCenter.x} cy={L.bulbCenter.y} r={props.bulbRadius * 0.72} fill={props.liquid} />
        <rect
          x={L.tube.x}
          y={L.tube.y}
          width={L.tube.width}
          height={L.tube.height}
          rx={props.tubeWidth / 2}
          fill="#ffffff"
          fillOpacity={0}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
        />
        <circle
          cx={L.bulbCenter.x}
          cy={L.bulbCenter.y}
          r={props.bulbRadius}
          fill="#ffffff"
          fillOpacity={0}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
        />
        {props.showTicks &&
          L.ticksY.map((y) => (
            <line
              key={y}
              x1={props.tubeWidth / 2 + 1}
              y1={y}
              x2={props.tubeWidth / 2 + 4}
              y2={y}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
            />
          ))}
      </g>
    );
  },
  getBounds: (props) => {
    const L = thermometerLayout(
      props.stemLength,
      props.bulbRadius,
      props.tubeWidth,
      props.level,
      props.tickCount,
    );
    const hw = Math.max(props.bulbRadius, props.tubeWidth / 2 + 5);
    return { x: -hw, y: -L.totalHeight / 2, width: hw * 2, height: L.totalHeight };
  },
  getSnapPoints: (props) => {
    const L = thermometerLayout(
      props.stemLength,
      props.bulbRadius,
      props.tubeWidth,
      props.level,
      props.tickCount,
    );
    return [
      { x: 0, y: 0 },
      { x: 0, y: -L.totalHeight / 2 },
      L.bulbCenter,
      { x: 0, y: L.totalHeight / 2 },
    ];
  },
  applyScale: (props, fx) => ({
    ...props,
    stemLength: props.stemLength * fx,
    bulbRadius: props.bulbRadius * fx,
    tubeWidth: props.tubeWidth * fx,
  }),
  capabilities: { rotatable: true, scalable: 'uniform' },
  placement: 'click',
};
