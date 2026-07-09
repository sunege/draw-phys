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
import { twoTerminalScaffold } from './twoTerminal';

interface LampProps extends CircuitLabelProps {
  length: number;
  radius: number;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  tangentOffset?: number;
}

const LABEL_GAP = 6;

/** 電球/ランプ。円の中に×印 */
export const lampPlugin: PhysicsObjectPlugin<LampProps> = {
  id: 'em.lamp',
  version: 1,
  name: '電球・ランプ',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="1" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="7" x2="17" y2="17" stroke="currentColor" strokeWidth="1.5" />
      <line x1="17" y1="7" x2="7" y2="17" stroke="currentColor" strokeWidth="1.5" />
      <line x1="19" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    length: 100,
    radius: 16,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    ...circuitLabelDefaults('', 'none'),
  },
  defaultSize: { width: 100, height: 32 },
  propertySchema: [
    { key: 'length', label: '全長', type: 'number', min: 10, step: 10 },
    { key: 'radius', label: '円の半径', type: 'number', min: 6, step: 1 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    ...circuitLabelFields,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const d = props.radius * Math.SQRT1_2;
    const anchor = { x: 0, y: -props.radius - LABEL_GAP };
    return (
      <g>
        <Leads
          length={props.length}
          bodyLength={props.radius * 2}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          lineStyle={props.lineStyle}
        />
        <circle
          r={props.radius}
          fill="#ffffff"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        />
        <line x1={-d} y1={-d} x2={d} y2={d} stroke={props.stroke} strokeWidth={props.strokeWidth} />
        <line x1={d} y1={-d} x2={-d} y2={d} stroke={props.stroke} strokeWidth={props.strokeWidth} />
        <HitLine length={props.length} height={props.radius * 2} />
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
    const h = props.radius * 2 + props.strokeWidth;
    const body = { x: -props.length / 2, y: -h / 2, width: props.length, height: h };
    const label = circuitLabelBounds({ x: 0, y: -props.radius - LABEL_GAP }, props);
    return label ? unionRects([body, label])! : body;
  },
  ...twoTerminalScaffold<LampProps>(['radius']),
  moveLabel: moveLabelOffset,
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, this.defaultProps.length);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
