import { normalizeAngle180 } from '../../core/geometry';
import type { PhysicsObjectPlugin, TrimPiece } from '../../core/plugin';
import { CenterMark } from './CenterMark';
import { PatternDefs } from './PatternDefs';
import { centerDefaults, centerFields } from './centerFields';
import {
  fillOpacityField,
  fillPatternField,
  resolveFill,
  resolveFillOpacity,
  type FillPattern,
} from './fillPattern';
import { dashArray, lineStyleField, type LineStyle } from './lineUtils';

interface CircleProps {
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  fillPattern: FillPattern;
  fillOpacity: number;
  showCenter: boolean;
  centerStyle: 'cross' | 'dot';
  centerSize: number;
}

export const circlePlugin: PhysicsObjectPlugin<CircleProps> = {
  id: 'core.circle',
  version: 1,
  name: '円',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  defaultProps: {
    radius: 40,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    fillPattern: 'none',
    fillOpacity: 0,
    ...centerDefaults,
  },
  defaultSize: { width: 80, height: 80 },
  propertySchema: [
    { key: 'radius', label: '半径', type: 'number', min: 1, step: 5 },
    { key: 'fill', label: '塗り色', type: 'color' },
    fillOpacityField,
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
    lineStyleField,
    fillPatternField,
    ...centerFields,
  ],
  Renderer: ({ props }) => (
    <g>
      <PatternDefs props={props} />
      <circle
        r={props.radius}
        fill={resolveFill(props)}
        fillOpacity={resolveFillOpacity(props)}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
      />
      {props.showCenter && (
        <CenterMark color={props.stroke} style={props.centerStyle} size={props.centerSize} />
      )}
    </g>
  ),
  getBounds: (props) => ({
    x: -props.radius,
    y: -props.radius,
    width: props.radius * 2,
    height: props.radius * 2,
  }),
  getSnapPoints: (props) => [
    { x: 0, y: 0 },
    { x: 0, y: -props.radius },
    { x: props.radius, y: 0 },
    { x: 0, y: props.radius },
    { x: -props.radius, y: 0 },
  ],
  getCircle: (props) => ({ center: { x: 0, y: 0 }, radius: props.radius }),
  applyScale: (props, fx) => ({ ...props, radius: props.radius * fx }),
  // トリム: 円は円弧へ種別変更する。残す区間(削除ギャップの補角)を持つ円弧を作る
  trim(props, transform, keeps): TrimPiece[] {
    const keep = keeps[0];
    if (!keep || keep.kind !== 'arc') return [];
    return [
      {
        pluginId: 'core.arc',
        props: {
          radius: props.radius,
          startAngle: normalizeAngle180(keep.fromDeg),
          endAngle: normalizeAngle180(keep.toDeg),
          stroke: props.stroke,
          strokeWidth: props.strokeWidth,
          lineStyle: props.lineStyle,
          showCenter: props.showCenter,
          centerStyle: props.centerStyle,
          centerSize: props.centerSize,
        },
        transform,
      },
    ];
  },
  capabilities: { rotatable: false, scalable: 'uniform', construction: true },
  placement: 'click',
};
