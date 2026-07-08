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
import { twoTerminalScaffold } from './twoTerminal';

interface SwitchProps extends CircuitLabelProps {
  length: number;
  gap: number;
  closed: boolean;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  tangentOffset?: number;
}

const LABEL_GAP = 8;
const OPEN_ANGLE = 30; // 開いたときのレバー角(度)

/** スイッチ。closed で開閉を切替 */
export const switchPlugin: PhysicsObjectPlugin<SwitchProps> = {
  id: 'em.switch',
  version: 1,
  name: 'スイッチ',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="2" y1="15" x2="7" y2="15" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="15" r="1.6" fill="currentColor" />
      <line x1="7" y1="15" x2="16" y2="8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="15" r="1.6" fill="currentColor" />
      <line x1="17" y1="15" x2="22" y2="15" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    length: 100,
    gap: 34,
    closed: false,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    ...circuitLabelDefaults('S'),
  },
  defaultSize: { width: 100, height: 20 },
  propertySchema: [
    { key: 'length', label: '全長', type: 'number', min: 10, step: 10 },
    { key: 'gap', label: '接点の間隔', type: 'number', min: 10, step: 2 },
    { key: 'closed', label: '閉じる(ON)', type: 'boolean' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    ...circuitLabelFields,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const pivotX = -props.gap / 2;
    const contactX = props.gap / 2;
    const dot = Math.max(2, props.strokeWidth * 1.6);
    const rad = (OPEN_ANGLE * Math.PI) / 180;
    const leverEnd = props.closed
      ? { x: contactX, y: 0 }
      : { x: pivotX + props.gap * Math.cos(rad), y: -props.gap * Math.sin(rad) };
    const bodyH = props.closed ? dot * 2 : props.gap * Math.sin(rad) + dot;
    const anchor = { x: 0, y: -bodyH - LABEL_GAP };
    return (
      <g>
        <Leads
          length={props.length}
          bodyLength={props.gap}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          lineStyle={props.lineStyle}
        />
        <circle cx={pivotX} cy={0} r={dot} fill={props.stroke} />
        <circle cx={contactX} cy={0} r={dot} fill={props.stroke} />
        <line
          x1={pivotX}
          y1={0}
          x2={leverEnd.x}
          y2={leverEnd.y}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinecap="round"
        />
        <HitLine length={props.length} height={props.gap} />
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
    const rad = (OPEN_ANGLE * Math.PI) / 180;
    const h = props.gap * Math.sin(rad) + props.strokeWidth * 2;
    const body = { x: -props.length / 2, y: -h, width: props.length, height: h * 2 };
    const label = circuitLabelBounds({ x: 0, y: -h - LABEL_GAP }, props);
    return label ? unionRects([body, label])! : body;
  },
  ...twoTerminalScaffold<SwitchProps>(),
  moveLabel: moveLabelOffset,
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, this.defaultProps.length);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
