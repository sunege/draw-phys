import { unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { dashArray, lineFromDrag, lineStyleField, type LineStyle } from '../basic/lineUtils';
import { moveLabelOffset } from '../basic/objectLabel';
import { CircuitLabel, HitLine, Leads } from './CircuitParts';
import {
  circuitLabelBounds,
  circuitLabelDefaults,
  circuitLabelFields,
  type CircuitLabelProps,
} from './circuitLabel';
import { coilLoopsPath } from './circuitMath';
import { twoTerminalScaffold } from './twoTerminal';

interface InductorProps extends CircuitLabelProps {
  length: number;
  bodyLength: number;
  loops: number;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  tangentOffset?: number;
}

const LABEL_GAP = 6;

function loopRadius(props: InductorProps): number {
  return props.bodyLength / Math.max(1, Math.round(props.loops)) / 2;
}

/** コイル(インダクタ)。半円のこぶ列 */
export const inductorPlugin: PhysicsObjectPlugin<InductorProps> = {
  id: 'em.inductor',
  version: 1,
  name: 'コイル',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="2" y1="14" x2="5" y2="14" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 14 A2.5 2.5 0 0 1 10 14 A2.5 2.5 0 0 1 15 14 A2.5 2.5 0 0 1 19 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line x1="19" y1="14" x2="22" y2="14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    length: 100,
    bodyLength: 56,
    loops: 4,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    ...circuitLabelDefaults('L'),
  },
  defaultSize: { width: 100, height: 16 },
  propertySchema: [
    { key: 'length', label: '全長', type: 'number', min: 10, step: 10 },
    { key: 'bodyLength', label: '本体の長さ', type: 'number', min: 8, step: 2 },
    { key: 'loops', label: '巻き数', type: 'number', min: 1, max: 12, step: 1 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    ...circuitLabelFields,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const r = loopRadius(props);
    const anchor = { x: 0, y: -r - LABEL_GAP };
    return (
      <g>
        <Leads
          length={props.length}
          bodyLength={props.bodyLength}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          lineStyle={props.lineStyle}
        />
        <path
          d={coilLoopsPath(props.bodyLength, props.loops)}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
          strokeLinejoin="round"
        />
        <HitLine length={props.length} height={r * 2} />
        <CircuitLabel
          anchor={anchor}
          props={props}
          color={props.stroke}
          rotation={transform?.rotation ?? 0}
          objectId={objectId}
          interactive={interactive}
        />
      </g>
    );
  },
  getBounds: (props) => {
    const r = loopRadius(props);
    const body = {
      x: -props.length / 2,
      y: -(r + props.strokeWidth),
      width: props.length,
      height: r + props.strokeWidth * 2,
    };
    const label = circuitLabelBounds({ x: 0, y: -r - LABEL_GAP }, props);
    return label ? unionRects([body, label])! : body;
  },
  ...twoTerminalScaffold<InductorProps>(),
  moveLabel: moveLabelOffset,
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, this.defaultProps.length);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
