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

interface EllipseProps {
  radiusX: number;
  radiusY: number;
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

export const ellipsePlugin: PhysicsObjectPlugin<EllipseProps> = {
  id: 'core.ellipse',
  version: 1,
  name: '楕円',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <ellipse cx="12" cy="12" rx="9" ry="6" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  defaultProps: {
    radiusX: 50,
    radiusY: 30,
    fill: '#ffffff',
    stroke: '#333333',
    strokeWidth: 2,
    lineStyle: 'solid',
    fillPattern: 'none',
    fillOpacity: 1,
    ...centerDefaults,
  },
  defaultSize: { width: 100, height: 60 },
  propertySchema: [
    { key: 'radiusX', label: '半径X', type: 'number', min: 1, step: 5 },
    { key: 'radiusY', label: '半径Y', type: 'number', min: 1, step: 5 },
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
      <ellipse
        rx={props.radiusX}
        ry={props.radiusY}
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
    x: -props.radiusX,
    y: -props.radiusY,
    width: props.radiusX * 2,
    height: props.radiusY * 2,
  }),
  getSnapPoints: (props) => [
    { x: 0, y: 0 },
    { x: 0, y: -props.radiusY },
    { x: props.radiusX, y: 0 },
    { x: 0, y: props.radiusY },
    { x: -props.radiusX, y: 0 },
  ],
  getEllipse: (props) => ({ center: { x: 0, y: 0 }, radiusX: props.radiusX, radiusY: props.radiusY }),
  applyScale: (props, fx, fy) => ({
    ...props,
    radiusX: props.radiusX * fx,
    radiusY: props.radiusY * fy,
  }),
  // トリム: 楕円は楕円弧へ種別変更する。残す区間(削除ギャップの補角)を持つ楕円弧を作る
  trim(props, transform, keeps): TrimPiece[] {
    const keep = keeps[0];
    if (!keep || keep.kind !== 'arc') return [];
    return [
      {
        pluginId: 'core.ellipseArc',
        props: {
          radiusX: props.radiusX,
          radiusY: props.radiusY,
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
  capabilities: { rotatable: true, scalable: 'both', construction: true },
  placement: 'click',
};
