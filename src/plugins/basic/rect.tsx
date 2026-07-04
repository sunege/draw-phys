import type { PhysicsObjectPlugin } from '../../core/plugin';
import { CenterMark } from './CenterMark';
import { PatternDefs } from './PatternDefs';
import { fillPatternField, resolveFill, type FillPattern } from './fillPattern';

interface RectProps {
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillPattern: FillPattern;
  showCenter: boolean;
}

export const rectPlugin: PhysicsObjectPlugin<RectProps> = {
  id: 'core.rect',
  version: 1,
  name: '長方形',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <rect x="4" y="7" width="16" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  defaultProps: {
    width: 100,
    height: 60,
    fill: '#ffffff',
    stroke: '#333333',
    strokeWidth: 2,
    fillPattern: 'none',
    showCenter: false,
  },
  defaultSize: { width: 100, height: 60 },
  propertySchema: [
    { key: 'width', label: '幅', type: 'number', min: 1, step: 10 },
    { key: 'height', label: '高さ', type: 'number', min: 1, step: 10 },
    { key: 'fill', label: '塗り色', type: 'color' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
    fillPatternField,
    { key: 'showCenter', label: '重心を表示', type: 'boolean' },
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
      {props.showCenter && <CenterMark color={props.stroke} />}
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
