import type { PhysicsObjectPlugin } from '../../core/plugin';
import { PatternDefs } from '../basic/PatternDefs';
import { fillPatternField, resolveFill, type FillPattern } from '../basic/fillPattern';

interface BlockProps {
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  label: string;
  fontSize: number;
  fillPattern: FillPattern;
}

export const blockPlugin: PhysicsObjectPlugin<BlockProps> = {
  id: 'mech.block',
  version: 1,
  name: 'ブロック',
  category: '力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="4" y="8" width="16" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="12" y="15" textAnchor="middle" dominantBaseline="central" fontSize="9" fontStyle="italic" fill="currentColor">
        m
      </text>
    </svg>
  ),
  defaultProps: {
    width: 80,
    height: 60,
    fill: '#f5f5f5',
    stroke: '#333333',
    strokeWidth: 2,
    label: 'm',
    fontSize: 20,
    fillPattern: 'none',
  },
  defaultSize: { width: 80, height: 60 },
  propertySchema: [
    { key: 'width', label: '幅', type: 'number', min: 1, step: 10 },
    { key: 'height', label: '高さ', type: 'number', min: 1, step: 10 },
    { key: 'fill', label: '塗り色', type: 'color' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
    fillPatternField,
    { key: 'label', label: 'ラベル', type: 'text' },
    { key: 'fontSize', label: 'ラベルサイズ', type: 'number', min: 6, step: 2 },
  ],
  Renderer: ({ props }) => (
    <g>
      <PatternDefs props={props} />
      <rect
        x={-props.width / 2}
        y={-props.height / 2}
        width={props.width}
        height={props.height}
        fill={resolveFill(props)}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
      />
      {props.label && (
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={props.fontSize}
          fontStyle="italic"
          fontFamily='"Times New Roman", serif'
          fill={props.stroke}
        >
          {props.label}
        </text>
      )}
    </g>
  ),
  getBounds: (props) => ({
    x: -props.width / 2,
    y: -props.height / 2,
    width: props.width,
    height: props.height,
  }),
  getSnapPoints: (props) => {
    const hw = props.width / 2;
    const hh = props.height / 2;
    return [
      { x: 0, y: 0 },
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
      { x: 0, y: -hh },
      { x: hw, y: 0 },
      { x: 0, y: hh },
      { x: -hw, y: 0 },
    ];
  },
  getSegments: (props) => {
    const hw = props.width / 2;
    const hh = props.height / 2;
    return [
      [{ x: -hw, y: -hh }, { x: hw, y: -hh }],
      [{ x: hw, y: -hh }, { x: hw, y: hh }],
      [{ x: hw, y: hh }, { x: -hw, y: hh }],
      [{ x: -hw, y: hh }, { x: -hw, y: -hh }],
    ];
  },
  applyScale: (props, fx, fy) => ({
    ...props,
    width: props.width * fx,
    height: props.height * fy,
  }),
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
