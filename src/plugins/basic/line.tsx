import { angleOfVector } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { hitStrokeWidth, lineFromDrag, segmentEndpoints, segmentFromEndpoints } from './lineUtils';

interface LineProps {
  length: number;
  stroke: string;
  strokeWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
}

function dashArray(props: LineProps): string | undefined {
  if (props.lineStyle === 'dashed') return `${props.strokeWidth * 4} ${props.strokeWidth * 3}`;
  if (props.lineStyle === 'dotted') return `${props.strokeWidth} ${props.strokeWidth * 2}`;
  return undefined;
}

export const linePlugin: PhysicsObjectPlugin<LineProps> = {
  id: 'core.line',
  version: 1,
  name: '線',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="4" y1="19" x2="20" y2="5" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  defaultProps: {
    length: 100,
    stroke: '#333333',
    strokeWidth: 2,
    lineStyle: 'solid',
  },
  defaultSize: { width: 100, height: 2 },
  propertySchema: [
    { key: 'length', label: '長さ', type: 'number', min: 1, step: 10 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    {
      key: 'lineStyle',
      label: '線種',
      type: 'select',
      options: [
        { value: 'solid', label: '実線' },
        { value: 'dashed', label: '破線' },
        { value: 'dotted', label: '点線' },
      ],
    },
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
          strokeDasharray={dashArray(props)}
        />
        <line
          x1={-half}
          y1={0}
          x2={half}
          y2={0}
          stroke="transparent"
          strokeWidth={hitStrokeWidth(props.strokeWidth)}
        />
      </g>
    );
  },
  getBounds: (props) => {
    const h = Math.max(props.strokeWidth, 8);
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
  applyRefs(props, resolved, transform) {
    // 接線拘束: 中点を円周上のアンカーに一致させ、接線方向へ回転する(長さはpropsのまま)
    const anchor = resolved.find((r) => r.role === 'anchor');
    if (!anchor?.tangent) return { props, transform };
    return {
      props,
      transform: {
        ...transform,
        x: anchor.point.x,
        y: anchor.point.y,
        rotation: angleOfVector(anchor.tangent),
        scaleX: 1,
        scaleY: 1,
      },
    };
  },
  capabilities: { rotatable: false, scalable: 'none' },
  placement: 'drag-line',
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, 100);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
