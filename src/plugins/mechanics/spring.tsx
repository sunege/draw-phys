import type { PhysicsObjectPlugin } from '../../core/plugin';
import {
  hitStrokeWidth,
  lineFromDrag,
  segmentEndpoints,
  segmentFromEndpoints,
} from '../basic/lineUtils';

interface SpringProps {
  length: number;
  coils: number;
  amplitude: number;
  stroke: string;
  strokeWidth: number;
}

/** バネのジグザグパス(X軸沿い・中心原点) */
export function springPath(length: number, coils: number, amplitude: number): string {
  const half = length / 2;
  const lead = Math.min(length * 0.15, 20);
  const innerLength = length - lead * 2;
  const n = Math.max(1, Math.round(coils)) * 2; // 半周期の数
  const seg = innerLength / n;

  const parts = [`M ${-half} 0`, `L ${-half + lead} 0`];
  for (let i = 0; i < n; i++) {
    const x = -half + lead + seg * (i + 0.5);
    const y = i % 2 === 0 ? -amplitude : amplitude;
    parts.push(`L ${x} ${y}`);
  }
  parts.push(`L ${half - lead} 0`, `L ${half} 0`);
  return parts.join(' ');
}

export const springPlugin: PhysicsObjectPlugin<SpringProps> = {
  id: 'mech.spring',
  version: 1,
  name: 'バネ',
  category: '力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M2 12 L4 12 L6 7 L9 17 L12 7 L15 17 L18 7 L20 12 L22 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  ),
  defaultProps: {
    length: 120,
    coils: 6,
    amplitude: 10,
    stroke: '#333333',
    strokeWidth: 2,
  },
  defaultSize: { width: 120, height: 20 },
  propertySchema: [
    { key: 'length', label: '長さ', type: 'number', min: 10, step: 10 },
    { key: 'coils', label: '巻き数', type: 'number', min: 1, max: 40, step: 1 },
    { key: 'amplitude', label: '振幅', type: 'number', min: 2, step: 1 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
  ],
  Renderer: ({ props }) => (
    <g>
      <path
        d={springPath(props.length, props.coils, props.amplitude)}
        fill="none"
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        strokeLinejoin="round"
      />
      <line
        x1={-props.length / 2}
        y1={0}
        x2={props.length / 2}
        y2={0}
        stroke="transparent"
        strokeWidth={hitStrokeWidth(props.amplitude * 2)}
      />
    </g>
  ),
  getBounds: (props) => {
    const h = props.amplitude * 2 + props.strokeWidth;
    return { x: -props.length / 2, y: -h / 2, width: props.length, height: h };
  },
  getSnapPoints: (props) => [
    { x: -props.length / 2, y: 0 },
    { x: 0, y: 0 },
    { x: props.length / 2, y: 0 },
  ],
  getSegments: (props) => [segmentEndpoints(props.length)],
  getEndpoints: (props) => segmentEndpoints(props.length),
  setFromEndpoints(props, a, b) {
    const { length, transform } = segmentFromEndpoints(a, b);
    return { props: { ...props, length }, transform };
  },
  capabilities: { rotatable: true, scalable: 'none' },
  placement: 'drag-line',
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, 120);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
