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
import { capacitorPlates } from './circuitMath';
import { twoTerminalScaffold } from './twoTerminal';

interface CapacitorProps extends CircuitLabelProps {
  length: number;
  gap: number;
  plateHeight: number;
  curved: boolean;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  tangentOffset?: number;
}

const LABEL_GAP = 6;

/** コンデンサ。2枚の極板(curved で電解コンデンサ表現) */
export const capacitorPlugin: PhysicsObjectPlugin<CapacitorProps> = {
  id: 'em.capacitor',
  version: 1,
  name: 'コンデンサ',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="2" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="5" x2="10" y2="19" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="5" x2="14" y2="19" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    length: 100,
    gap: 10,
    plateHeight: 28,
    curved: false,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    ...circuitLabelDefaults('C'),
  },
  defaultSize: { width: 100, height: 28 },
  propertySchema: [
    { key: 'length', label: '全長', type: 'number', min: 10, step: 10 },
    { key: 'gap', label: '極板の間隔', type: 'number', min: 4, step: 1 },
    { key: 'plateHeight', label: '極板の高さ', type: 'number', min: 6, step: 2 },
    { key: 'curved', label: '電解(片側を弧に)', type: 'boolean' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    ...circuitLabelFields,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const { leftX, rightX, halfH } = capacitorPlates(props.gap, props.plateHeight);
    const bow = props.plateHeight * 0.45;
    const anchor = { x: 0, y: -props.plateHeight / 2 - LABEL_GAP };
    return (
      <g>
        <Leads
          length={props.length}
          bodyLength={props.gap}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          lineStyle={props.lineStyle}
        />
        <line
          x1={leftX}
          y1={-halfH}
          x2={leftX}
          y2={halfH}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
        />
        {props.curved ? (
          <path
            d={`M ${rightX} ${-halfH} Q ${rightX + bow} 0 ${rightX} ${halfH}`}
            fill="none"
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
          />
        ) : (
          <line
            x1={rightX}
            y1={-halfH}
            x2={rightX}
            y2={halfH}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
          />
        )}
        <HitLine length={props.length} height={props.plateHeight} />
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
    const h = props.plateHeight + props.strokeWidth;
    const body = { x: -props.length / 2, y: -h / 2, width: props.length, height: h };
    const label = circuitLabelBounds({ x: 0, y: -props.plateHeight / 2 - LABEL_GAP }, props);
    return label ? unionRects([body, label])! : body;
  },
  ...twoTerminalScaffold<CapacitorProps>(['gap', 'plateHeight']),
  moveLabel: moveLabelOffset,
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, this.defaultProps.length);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
