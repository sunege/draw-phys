import { unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { lineFromDrag, lineStyleField, type LineStyle } from '../basic/lineUtils';
import { moveLabelOffset } from '../basic/objectLabel';
import { CircuitLabel, HitLine, Leads } from './CircuitParts';
import {
  circuitLabelBounds,
  circuitLabelDefaults,
  circuitLabelFields,
  type CircuitLabelProps,
} from './circuitLabel';
import { diodeShape, pointsAttr } from './circuitMath';
import { twoTerminalScaffold } from './twoTerminal';

interface DiodeProps extends CircuitLabelProps {
  length: number;
  bodyLength: number;
  bodyHeight: number;
  reversed: boolean;
  filled: boolean;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  tangentOffset?: number;
}

const LABEL_GAP = 6;

/** ダイオード。三角形+バー(reversed で向き反転) */
export const diodePlugin: PhysicsObjectPlugin<DiodeProps> = {
  id: 'em.diode',
  version: 1,
  name: 'ダイオード',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="2" y1="12" x2="7" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 6 L7 18 L16 12 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="16" y1="6" x2="16" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    length: 100,
    bodyLength: 22,
    bodyHeight: 24,
    reversed: false,
    filled: true,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    ...circuitLabelDefaults('D'),
  },
  defaultSize: { width: 100, height: 24 },
  propertySchema: [
    { key: 'length', label: '全長', type: 'number', min: 10, step: 10 },
    { key: 'bodyLength', label: '三角の長さ', type: 'number', min: 6, step: 2 },
    { key: 'bodyHeight', label: '三角の高さ', type: 'number', min: 6, step: 2 },
    { key: 'reversed', label: '向き反転', type: 'boolean' },
    { key: 'filled', label: '三角を塗る', type: 'boolean' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    ...circuitLabelFields,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const { triangle, barX, halfH } = diodeShape(props.bodyLength, props.bodyHeight, props.reversed);
    const anchor = { x: 0, y: -props.bodyHeight / 2 - LABEL_GAP };
    return (
      <g>
        <Leads
          length={props.length}
          bodyLength={props.bodyLength}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          lineStyle={props.lineStyle}
        />
        <polygon
          points={pointsAttr(triangle)}
          fill={props.filled ? props.stroke : '#ffffff'}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinejoin="round"
        />
        <line
          x1={barX}
          y1={-halfH}
          x2={barX}
          y2={halfH}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
        />
        <HitLine length={props.length} height={props.bodyHeight} />
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
    const h = props.bodyHeight + props.strokeWidth;
    const body = { x: -props.length / 2, y: -h / 2, width: props.length, height: h };
    const label = circuitLabelBounds({ x: 0, y: -props.bodyHeight / 2 - LABEL_GAP }, props);
    return label ? unionRects([body, label])! : body;
  },
  ...twoTerminalScaffold<DiodeProps>(['bodyLength', 'bodyHeight']),
  moveLabel: moveLabelOffset,
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, this.defaultProps.length);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
