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
import { batteryBodyHalf, batteryCells } from './circuitMath';
import { twoTerminalScaffold } from './twoTerminal';

interface DcSourceProps extends CircuitLabelProps {
  length: number;
  cells: number;
  pitch: number;
  longHeight: number;
  shortHeight: number;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  tangentOffset?: number;
}

const LABEL_GAP = 6;

/** 起電力・電池(直流)。cells=1 で単セル、2以上で電池(長=正極/短=負極) */
export const dcSourcePlugin: PhysicsObjectPlugin<DcSourceProps> = {
  id: 'em.dcSource',
  version: 1,
  name: '起電力・電池(直流)',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="2" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="6" x2="9" y2="18" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="9" x2="14" y2="15" stroke="currentColor" strokeWidth="3" />
      <line x1="14" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    length: 100,
    cells: 1,
    pitch: 8,
    longHeight: 26,
    shortHeight: 12,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    ...circuitLabelDefaults('E'),
  },
  defaultSize: { width: 100, height: 26 },
  propertySchema: [
    { key: 'length', label: '全長', type: 'number', min: 10, step: 10 },
    { key: 'cells', label: 'セル数', type: 'number', min: 1, max: 8, step: 1 },
    { key: 'pitch', label: '極板の間隔', type: 'number', min: 3, step: 1 },
    { key: 'longHeight', label: '長い極板の高さ', type: 'number', min: 6, step: 2 },
    { key: 'shortHeight', label: '短い極板の高さ', type: 'number', min: 4, step: 2 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    ...circuitLabelFields,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const plates = batteryCells(props.cells, props.longHeight / 2, props.shortHeight / 2, props.pitch);
    const bodyLength = batteryBodyHalf(props.cells, props.pitch) * 2;
    const anchor = { x: 0, y: -props.longHeight / 2 - LABEL_GAP };
    return (
      <g>
        <Leads
          length={props.length}
          bodyLength={bodyLength}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          lineStyle={props.lineStyle}
        />
        {plates.map((p, i) => (
          <line
            key={i}
            x1={p.x}
            y1={-p.halfH}
            x2={p.x}
            y2={p.halfH}
            stroke={props.stroke}
            strokeWidth={p.short ? props.strokeWidth * 2.2 : props.strokeWidth}
          />
        ))}
        <HitLine length={props.length} height={props.longHeight} />
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
    const h = Math.max(props.longHeight, props.shortHeight, props.strokeWidth);
    const body = { x: -props.length / 2, y: -h / 2, width: props.length, height: h };
    const label = circuitLabelBounds({ x: 0, y: -props.longHeight / 2 - LABEL_GAP }, props);
    return label ? unionRects([body, label])! : body;
  },
  ...twoTerminalScaffold<DcSourceProps>(['pitch', 'longHeight', 'shortHeight']),
  moveLabel: moveLabelOffset,
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, this.defaultProps.length);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
