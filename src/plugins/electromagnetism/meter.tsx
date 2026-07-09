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

interface MeterProps extends CircuitLabelProps {
  length: number;
  radius: number;
  /** 円内に表示する記号(A/V/G など) */
  letter: string;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  tangentOffset?: number;
}

const LABEL_GAP = 6;

/**
 * 計器(円+記号)の共通プラグイン生成。
 * 電流計(A)・電圧計(V)・検流計(G)は既定の letter だけが異なる。
 */
function makeMeterPlugin(
  id: string,
  name: string,
  letter: string,
): PhysicsObjectPlugin<MeterProps> {
  return {
    id,
    version: 1,
    name,
    category: '電磁気',
    Icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <line x1="1" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text
          x="12"
          y="12"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="9"
          fontStyle="italic"
          fontFamily='"Times New Roman", serif'
          fill="currentColor"
        >
          {letter}
        </text>
        <line x1="19" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    defaultProps: {
      length: 100,
      radius: 16,
      letter,
      stroke: '#000000',
      strokeWidth: 1,
      lineStyle: 'solid',
      ...circuitLabelDefaults('', 'none'),
    },
    defaultSize: { width: 100, height: 32 },
    propertySchema: [
      { key: 'length', label: '全長', type: 'number', min: 10, step: 10 },
      { key: 'radius', label: '円の半径', type: 'number', min: 6, step: 1 },
      { key: 'letter', label: '記号(円内)', type: 'text' },
      { key: 'stroke', label: '線色', type: 'color' },
      { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
      lineStyleField,
      ...circuitLabelFields,
    ],
    Renderer: ({ props, transform, objectId, interactive }) => {
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
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={props.radius * 1.1}
            fontStyle="italic"
            fontFamily='"Times New Roman", serif'
            fill={props.stroke}
            transform={`rotate(${-(transform?.rotation ?? 0)})`}
          >
            {props.letter}
          </text>
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
    ...twoTerminalScaffold<MeterProps>(['radius']),
    moveLabel: moveLabelOffset,
    createFromDrag(start, end) {
      const { length, transform } = lineFromDrag(start, end, this.defaultProps.length);
      return { props: { ...this.defaultProps, length }, transform };
    },
  };
}

export const ammeterPlugin = makeMeterPlugin('em.ammeter', '電流計', 'A');
export const voltmeterPlugin = makeMeterPlugin('em.voltmeter', '電圧計', 'V');
export const galvanometerPlugin = makeMeterPlugin('em.galvanometer', '検流計', 'G');
