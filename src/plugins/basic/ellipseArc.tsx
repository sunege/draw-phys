import { normalizeAngle180, normalizeAngle360 } from '../../core/geometry';
import type { PhysicsObjectPlugin, TrimPiece } from '../../core/plugin';
import { isFullArc, sweepDelta } from './arc';
import { CenterMark } from './CenterMark';
import { centerDefaults, centerFields } from './centerFields';
import { ellipseArcBounds, ellipseArcPath, ellipsePointAt } from './ellipseMath';
import { dashArray, lineStyleField, type LineStyle } from './lineUtils';

interface EllipseArcProps {
  radiusX: number;
  radiusY: number;
  /** 開始角(度, -180〜180)。媒介変数角度で、0=+x方向、増加すると画面上は時計回り */
  startAngle: number;
  /** 終了角(度, -180〜180) */
  endAngle: number;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  showCenter: boolean;
  centerStyle: 'cross' | 'dot';
  centerSize: number;
}

export const ellipseArcPlugin: PhysicsObjectPlugin<EllipseArcProps> = {
  id: 'core.ellipseArc',
  version: 1,
  name: '楕円弧',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M4 16 A10 6 0 0 1 20 10" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  defaultProps: {
    radiusX: 50,
    radiusY: 30,
    startAngle: 0,
    endAngle: 120,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    ...centerDefaults,
  },
  defaultSize: { width: 100, height: 60 },
  propertySchema: [
    { key: 'radiusX', label: '半径X', type: 'number', min: 1, step: 5 },
    { key: 'radiusY', label: '半径Y', type: 'number', min: 1, step: 5 },
    { key: 'startAngle', label: '開始角', type: 'number', min: -180, max: 180, step: 5 },
    { key: 'endAngle', label: '終了角', type: 'number', min: -180, max: 180, step: 5 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    ...centerFields,
  ],
  Renderer: ({ props }) => (
    <g>
      {isFullArc(props.startAngle, props.endAngle) ? (
        <ellipse
          rx={props.radiusX}
          ry={props.radiusY}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        />
      ) : (
        <path
          d={ellipseArcPath(props.radiusX, props.radiusY, props.startAngle, props.endAngle)}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        />
      )}
      {props.showCenter && (
        <CenterMark color={props.stroke} style={props.centerStyle} size={props.centerSize} />
      )}
    </g>
  ),
  getBounds: (props) => ellipseArcBounds(props.radiusX, props.radiusY, props.startAngle, props.endAngle),
  getSnapPoints: (props) => {
    const delta = sweepDelta(props.startAngle, props.endAngle);
    return [
      { x: 0, y: 0 },
      ellipsePointAt(props.radiusX, props.radiusY, props.startAngle),
      ellipsePointAt(props.radiusX, props.radiusY, props.startAngle + delta),
      ellipsePointAt(props.radiusX, props.radiusY, props.startAngle + delta / 2),
    ];
  },
  getEllipse: (props) => ({
    center: { x: 0, y: 0 },
    radiusX: props.radiusX,
    radiusY: props.radiusY,
    startAngle: props.startAngle,
    endAngle: props.endAngle,
  }),
  applyScale: (props, fx, fy) => ({
    ...props,
    radiusX: props.radiusX * fx,
    radiusY: props.radiusY * fy,
  }),
  // トリム: 残す各区間[fromDeg,toDeg]を新しい楕円弧として作り直す(掃引の一部を残す)
  trim(props, transform, keeps) {
    const pieces: TrimPiece[] = [];
    for (const keep of keeps) {
      if (keep.kind !== 'arc') continue;
      if ((normalizeAngle360(keep.toDeg - keep.fromDeg) || 360) < 0.5) continue; // ごく短い残片は捨てる
      pieces.push({
        pluginId: 'core.ellipseArc',
        props: {
          ...props,
          startAngle: normalizeAngle180(keep.fromDeg),
          endAngle: normalizeAngle180(keep.toDeg),
        },
        transform,
      });
    }
    return pieces;
  },
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
