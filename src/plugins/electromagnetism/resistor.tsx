import { unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { lineFromDrag, lineStyleField, type LineStyle } from '../basic/lineUtils';
import { moveLabelOffset } from '../basic/objectLabel';
import { CircuitLabel, HitLine, Leads, ResistorBody } from './CircuitParts';
import {
  circuitLabelBounds,
  circuitLabelDefaults,
  circuitLabelFields,
  type CircuitLabelProps,
} from './circuitLabel';
import { twoTerminalScaffold } from './twoTerminal';

interface ResistorProps extends CircuitLabelProps {
  length: number;
  bodyLength: number;
  bodyHeight: number;
  style: 'box' | 'zigzag';
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  tangentOffset?: number;
}

const LABEL_GAP = 6;

export const resistorPlugin: PhysicsObjectPlugin<ResistorProps> = {
  id: 'em.resistor',
  version: 1,
  name: '抵抗',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6" y="8" width="12" height="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    length: 100,
    bodyLength: 48,
    bodyHeight: 20,
    style: 'box',
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    ...circuitLabelDefaults('R'),
  },
  defaultSize: { width: 100, height: 20 },
  propertySchema: [
    { key: 'length', label: '全長', type: 'number', min: 10, step: 10 },
    { key: 'bodyLength', label: '本体の長さ', type: 'number', min: 8, step: 2 },
    { key: 'bodyHeight', label: '本体の高さ', type: 'number', min: 4, step: 2 },
    {
      key: 'style',
      label: '記号',
      type: 'select',
      options: [
        { value: 'box', label: '長方形 □' },
        { value: 'zigzag', label: 'ギザギザ' },
      ],
    },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    ...circuitLabelFields,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
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
        <ResistorBody
          bodyLength={props.bodyLength}
          bodyHeight={props.bodyHeight}
          style={props.style}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          lineStyle={props.lineStyle}
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
    const h = Math.max(props.bodyHeight, props.strokeWidth);
    const body = { x: -props.length / 2, y: -h / 2, width: props.length, height: h };
    const label = circuitLabelBounds({ x: 0, y: -props.bodyHeight / 2 - LABEL_GAP }, props);
    return label ? unionRects([body, label])! : body;
  },
  ...twoTerminalScaffold<ResistorProps>(['bodyLength', 'bodyHeight']),
  moveLabel: moveLabelOffset,
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, this.defaultProps.length);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
