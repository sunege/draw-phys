import type { PhysicsObjectPlugin } from '../../core/plugin';
import {
  hitStrokeWidth,
  lineFromDrag,
  segmentEndpoints,
  segmentFromEndpoints,
} from '../basic/lineUtils';

interface FloorProps {
  length: number;
  stroke: string;
  strokeWidth: number;
  hatchSpacing: number;
  hatchLength: number;
}

export const floorPlugin: PhysicsObjectPlugin<FloorProps> = {
  id: 'mech.floor',
  version: 1,
  name: '床',
  category: '力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
      {[5, 9, 13, 17].map((x) => (
        <line key={x} x1={x + 3} y1={10} x2={x} y2={16} stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  ),
  defaultProps: {
    length: 200,
    stroke: '#333333',
    strokeWidth: 2,
    hatchSpacing: 12,
    hatchLength: 10,
  },
  defaultSize: { width: 200, height: 12 },
  propertySchema: [
    { key: 'length', label: '長さ', type: 'number', min: 10, step: 10 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    { key: 'hatchSpacing', label: '斜線間隔', type: 'number', min: 4, step: 1 },
    { key: 'hatchLength', label: '斜線長さ', type: 'number', min: 2, step: 1 },
  ],
  Renderer: ({ props }) => {
    const half = props.length / 2;
    const hatches: number[] = [];
    for (let x = -half + props.hatchSpacing; x <= half; x += props.hatchSpacing) {
      hatches.push(x);
    }
    return (
      <g>
        <line
          x1={-half}
          y1={0}
          x2={half}
          y2={0}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
        />
        {hatches.map((x) => (
          <line
            key={x}
            x1={x}
            y1={0}
            x2={x - props.hatchLength * 0.6}
            y2={props.hatchLength}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth * 0.6}
          />
        ))}
        <line
          x1={-half}
          y1={0}
          x2={half}
          y2={0}
          stroke="transparent"
          strokeWidth={hitStrokeWidth(props.hatchLength)}
        />
      </g>
    );
  },
  getBounds: (props) => ({
    x: -props.length / 2,
    y: -props.strokeWidth / 2,
    width: props.length,
    height: props.hatchLength + props.strokeWidth,
  }),
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
  capabilities: { rotatable: false, scalable: 'none' },
  placement: 'drag-line',
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, 200);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
