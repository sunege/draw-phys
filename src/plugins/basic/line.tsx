import { angleOfVector, localToWorld } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { hitStrokeWidth, lineFromDrag, segmentEndpoints, segmentFromEndpoints } from './lineUtils';

interface LineProps {
  length: number;
  stroke: string;
  strokeWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  /**
   * 接線拘束時の、線中心から接点までの符号付き距離(線方向)。
   * 0(既定)は接点=中点。端点ドラッグで片側長さを変えるとずれる。プラグインの内部状態。
   */
  tangentOffset?: number;
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
    // 接線拘束: 接点(局所 tangentOffset,0)を円周上のアンカーに一致させ、接線方向へ回転する
    const anchor = resolved.find((r) => r.role === 'anchor');
    if (!anchor?.tangent) return { props, transform };
    const off = props.tangentOffset ?? 0;
    return {
      props,
      transform: {
        ...transform,
        x: anchor.point.x - anchor.tangent.x * off,
        y: anchor.point.y - anchor.tangent.y * off,
        rotation: angleOfVector(anchor.tangent),
        scaleX: 1,
        scaleY: 1,
      },
    };
  },
  getAnchorPoint: (props) => ({ x: props.tangentOffset ?? 0, y: 0 }),
  dragEndpointConstrained(props, transform, end, world) {
    // 接点と反対側の端点を固定し、ドラッグ端点までの片側長さのみ変更する
    const off = props.tangentOffset ?? 0;
    const half = props.length / 2;
    const contact = localToWorld({ x: off, y: 0 }, transform);
    const rad = (transform.rotation * Math.PI) / 180;
    const da = { x: Math.cos(rad), y: Math.sin(rad) };
    // 各端点の接点からの符号付き距離
    let s0 = -half - off;
    let s1 = half - off;
    const s = (world.x - contact.x) * da.x + (world.y - contact.y) * da.y;
    if (end === 1) s1 = Math.max(s, s0 + 1);
    else s0 = Math.min(s, s1 - 1);
    return { ...props, length: s1 - s0, tangentOffset: -(s0 + s1) / 2 };
  },
  capabilities: { rotatable: false, scalable: 'none' },
  placement: 'drag-line',
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, 100);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
