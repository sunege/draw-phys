import type { PhysicsObjectPlugin } from '../../core/plugin';
import {
  hatchPositions,
  hitStrokeWidth,
  lineFromDrag,
  segmentEndpoints,
  segmentFromEndpoints,
} from '../basic/lineUtils';

interface MirrorProps {
  length: number;
  stroke: string;
  strokeWidth: number;
  hatchSpacing: number;
  hatchLength: number;
}

/** 平面鏡。反射面が上(-y)、裏側(+y)に斜線ハッチ */
export const mirrorPlugin: PhysicsObjectPlugin<MirrorProps> = {
  id: 'optics.mirror',
  version: 1,
  name: '平面鏡',
  category: '光学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="8" y1="3" x2="8" y2="21" stroke="currentColor" strokeWidth="2" />
      {[5, 9, 13, 17].map((y) => (
        <line key={y} x1={8} y1={y} x2={14} y2={y + 4} stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  ),
  defaultProps: {
    length: 160,
    stroke: '#000000',
    strokeWidth: 1,
    hatchSpacing: 8,
    hatchLength: 7,
  },
  defaultSize: { width: 160, height: 8 },
  propertySchema: [
    { key: 'length', label: '長さ', type: 'number', min: 10, step: 10 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    { key: 'hatchSpacing', label: '斜線間隔', type: 'number', min: 3, step: 1 },
    { key: 'hatchLength', label: '斜線長さ', type: 'number', min: 2, step: 1 },
  ],
  Renderer: ({ props }) => {
    const half = props.length / 2;
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
        {hatchPositions(props.length, props.hatchSpacing).map((x) => (
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
  capabilities: { rotatable: true, scalable: 'none' },
  placement: 'drag-line',
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, 160);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
