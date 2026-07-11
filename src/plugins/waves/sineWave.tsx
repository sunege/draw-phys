import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point } from '../../core/types';
import {
  dashArray,
  lineFromDrag,
  lineStyleField,
  segmentEndpoints,
  segmentFromEndpoints,
  type LineStyle,
} from '../basic/lineUtils';
import { sineWavePoints, waveNodePositions } from './waveMath';

interface SineWaveProps {
  length: number;
  amplitude: number;
  wavelength: number;
  /** 位相(度)。左端の初期位相 */
  phase: number;
  showBaseline: boolean;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
}

/** 正弦波。波長・振幅・位相をpropsに持ち、節の位置がスナップ点になる */
export const sineWavePlugin: PhysicsObjectPlugin<SineWaveProps> = {
  id: 'wave.sine',
  version: 1,
  name: '正弦波',
  category: '波動',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M2 12 Q4.5 3 7 12 T12 12 T17 12 T22 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  ),
  defaultProps: {
    length: 240,
    amplitude: 30,
    wavelength: 120,
    phase: 0,
    showBaseline: false,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
  },
  defaultSize: { width: 240, height: 60 },
  propertySchema: [
    { key: 'length', label: '長さ', type: 'number', min: 10, step: 10 },
    { key: 'amplitude', label: '振幅', type: 'number', min: 0, step: 5 },
    { key: 'wavelength', label: '波長', type: 'number', min: 4, step: 10 },
    { key: 'phase', label: '位相(°)', type: 'number', step: 15 },
    { key: 'showBaseline', label: '基準線を表示', type: 'boolean' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
  ],
  Renderer: ({ props }) => {
    const half = props.length / 2;
    const pts = sineWavePoints(props.length, props.amplitude, props.wavelength, props.phase)
      .map((p) => `${p.x},${p.y}`)
      .join(' ');
    return (
      <g>
        {props.showBaseline && (
          <line
            x1={-half}
            y1={0}
            x2={half}
            y2={0}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth * 0.5}
            strokeDasharray="4 4"
          />
        )}
        <polyline
          points={pts}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinejoin="round"
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        />
        <polyline points={pts} fill="none" stroke="transparent" strokeWidth={12} />
      </g>
    );
  },
  getBounds: (props) => {
    const h = props.amplitude + props.strokeWidth;
    return { x: -props.length / 2, y: -h, width: props.length, height: h * 2 };
  },
  getSnapPoints: (props) => {
    const pts: Point[] = [
      { x: -props.length / 2, y: 0 },
      { x: 0, y: 0 },
      { x: props.length / 2, y: 0 },
    ];
    for (const x of waveNodePositions(props.length, props.wavelength, props.phase)) {
      pts.push({ x, y: 0 });
    }
    return pts;
  },
  getSegments: (props) => [segmentEndpoints(props.length)],
  getEndpoints: (props) => segmentEndpoints(props.length),
  setFromEndpoints(props, a, b) {
    const { length, transform } = segmentFromEndpoints(a, b);
    return { props: { ...props, length }, transform };
  },
  applyScale: (props, fx) => ({
    ...props,
    length: props.length * fx,
    wavelength: props.wavelength * fx,
    amplitude: props.amplitude * fx,
  }),
  capabilities: { rotatable: true, scalable: 'none' },
  placement: 'drag-line',
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, 240);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
