import { unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { moveLabelOffset } from '../basic/objectLabel';
import { CircuitLabel } from './CircuitParts';
import {
  circuitLabelBounds,
  circuitLabelDefaults,
  circuitLabelFields,
  type CircuitLabelProps,
} from './circuitLabel';

interface BarMagnetProps extends CircuitLabelProps {
  width: number;
  height: number;
  nColor: string;
  sColor: string;
  poleColor: string;
  showPoles: boolean;
  stroke: string;
  strokeWidth: number;
}

const LABEL_GAP = 6;

/** 棒磁石。N(赤)/S(青)に二分し極名を表示 */
export const barMagnetPlugin: PhysicsObjectPlugin<BarMagnetProps> = {
  id: 'em.barMagnet',
  version: 1,
  name: '棒磁石',
  category: '電磁気',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="3" y="8" width="9" height="8" fill="#e05a5a" stroke="currentColor" strokeWidth="1" />
      <rect x="12" y="8" width="9" height="8" fill="#5a7de0" stroke="currentColor" strokeWidth="1" />
      <text x="7.5" y="12.5" textAnchor="middle" dominantBaseline="central" fontSize="6" fill="#fff">N</text>
      <text x="16.5" y="12.5" textAnchor="middle" dominantBaseline="central" fontSize="6" fill="#fff">S</text>
    </svg>
  ),
  defaultProps: {
    width: 100,
    height: 34,
    nColor: '#e05a5a',
    sColor: '#5a7de0',
    poleColor: '#ffffff',
    showPoles: true,
    stroke: '#000000',
    strokeWidth: 1,
    ...circuitLabelDefaults('', 'none'),
  },
  defaultSize: { width: 100, height: 34 },
  propertySchema: [
    { key: 'width', label: '幅', type: 'number', min: 10, step: 10 },
    { key: 'height', label: '高さ', type: 'number', min: 6, step: 2 },
    { key: 'nColor', label: 'N極の色', type: 'color' },
    { key: 'sColor', label: 'S極の色', type: 'color' },
    { key: 'poleColor', label: '極名の色', type: 'color' },
    { key: 'showPoles', label: 'N/S を表示', type: 'boolean' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
    ...circuitLabelFields,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const hw = props.width / 2;
    const hh = props.height / 2;
    const rot = -(transform?.rotation ?? 0);
    const fs = Math.min(props.height * 0.5, props.width * 0.25);
    const anchor = { x: 0, y: -hh - LABEL_GAP };
    return (
      <g>
        <rect x={-hw} y={-hh} width={hw} height={props.height} fill={props.nColor} />
        <rect x={0} y={-hh} width={hw} height={props.height} fill={props.sColor} />
        <rect
          x={-hw}
          y={-hh}
          width={props.width}
          height={props.height}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
        />
        {props.showPoles && (
          <>
            <text
              transform={`rotate(${rot} ${-hw / 2} 0)`}
              x={-hw / 2}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fs}
              fontFamily='"Times New Roman", serif'
              fill={props.poleColor}
            >
              N
            </text>
            <text
              transform={`rotate(${rot} ${hw / 2} 0)`}
              x={hw / 2}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fs}
              fontFamily='"Times New Roman", serif'
              fill={props.poleColor}
            >
              S
            </text>
          </>
        )}
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
    const body = {
      x: -props.width / 2,
      y: -props.height / 2,
      width: props.width,
      height: props.height,
    };
    const label = circuitLabelBounds({ x: 0, y: -props.height / 2 - LABEL_GAP }, props);
    return label ? unionRects([body, label])! : body;
  },
  getSnapPoints: (props) => {
    const hw = props.width / 2;
    const hh = props.height / 2;
    return [
      { x: 0, y: 0 },
      { x: -hw, y: 0 },
      { x: hw, y: 0 },
      { x: -hw / 2, y: 0 },
      { x: hw / 2, y: 0 },
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ];
  },
  applyScale: (props, fx, fy) => ({ ...props, width: props.width * fx, height: props.height * fy }),
  moveLabel: moveLabelOffset,
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
