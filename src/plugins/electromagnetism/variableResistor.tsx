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

interface VariableResistorProps extends CircuitLabelProps {
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

/** 斜め矢印の矢先ポリゴン(先端 tip、方向 dir=単位ベクトル) */
function arrowHead(tip: { x: number; y: number }, dir: { x: number; y: number }, size: number): string {
  const nx = -dir.y;
  const ny = dir.x;
  const bx = tip.x - dir.x * size;
  const by = tip.y - dir.y * size;
  const w = size * 0.45;
  return `${tip.x},${tip.y} ${bx + nx * w},${by + ny * w} ${bx - nx * w},${by - ny * w}`;
}

/** 可変抵抗(レオスタット/ポテンショメータ)。抵抗本体+斜め矢印 */
export const variableResistorPlugin: PhysicsObjectPlugin<VariableResistorProps> = {
  id: 'em.variableResistor',
  version: 1,
  name: '可変抵抗',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="2" y1="14" x2="6" y2="14" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6" y="10" width="12" height="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="18" y1="14" x2="22" y2="14" stroke="currentColor" strokeWidth="1.5" />
      <line x1="5" y1="19" x2="19" y2="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M19 6 L15 7 L17.5 9.5 Z" fill="currentColor" />
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
  defaultSize: { width: 100, height: 34 },
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
    const reach = props.bodyHeight * 0.85;
    const tip = { x: props.bodyLength * 0.42, y: -reach };
    const tail = { x: -props.bodyLength * 0.42, y: reach };
    const len = Math.hypot(tip.x - tail.x, tip.y - tail.y);
    const dir = { x: (tip.x - tail.x) / len, y: (tip.y - tail.y) / len };
    const anchor = { x: 0, y: -reach - LABEL_GAP };
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
        <line
          x1={tail.x}
          y1={tail.y}
          x2={tip.x}
          y2={tip.y}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
        />
        <polygon points={arrowHead(tip, dir, 8)} fill={props.stroke} />
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
    const reach = props.bodyHeight * 0.85 + props.strokeWidth;
    const body = { x: -props.length / 2, y: -reach, width: props.length, height: reach * 2 };
    const label = circuitLabelBounds({ x: 0, y: -props.bodyHeight * 0.85 - LABEL_GAP }, props);
    return label ? unionRects([body, label])! : body;
  },
  ...twoTerminalScaffold<VariableResistorProps>(),
  moveLabel: moveLabelOffset,
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, this.defaultProps.length);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
