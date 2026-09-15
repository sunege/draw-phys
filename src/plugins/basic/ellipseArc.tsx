import {
  angleOfVector,
  normalizeAngle180,
  normalizeAngle360,
  reflectAngle,
  reflectPoint,
  worldToLocal,
} from '../../core/geometry';
import type { PhysicsObjectPlugin, TrimPiece } from '../../core/plugin';
import type { Rect } from '../../core/types';
import { isFullArc, sweepDelta } from './arc';
import {
  arcClosureField,
  closeArcPath,
  closureBounds,
  closureSegments,
  resolveClosure,
  type ArcClosure,
} from './arcClosure';
import { CenterMark } from './CenterMark';
import { centerDefaults, centerFields } from './centerFields';
import {
  ellipseArcBounds,
  ellipseArcPath,
  ellipseParamAngle,
  ellipsePointAt,
} from './ellipseMath';
import {
  fillOpacityField,
  fillPatternField,
  patternSizeField,
  resolveFill,
  resolveFillOpacity,
  type FillPattern,
  type PatternSize,
} from './fillPattern';
import { lineStyleFieldExtended, type LineStyle } from './lineUtils';
import { PatternDefs } from './PatternDefs';
import { StyledStroke } from './StyledStroke';

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
  /** 閉じ方(弓形・扇形にすると塗れる)。未設定=開いた弧 */
  closure?: ArcClosure;
  fill?: string;
  fillPattern?: FillPattern;
  patternSize?: PatternSize;
  fillOpacity?: number;
  showCenter: boolean;
  centerStyle: 'cross' | 'dot';
  centerSize: number;
}

/** 塗りパターン解決用(旧データの未設定propsを既定値で補う) */
function closedFillProps(props: EllipseArcProps) {
  return {
    fill: props.fill ?? '#ffffff',
    stroke: props.stroke,
    fillPattern: props.fillPattern ?? 'none',
    patternSize: props.patternSize,
    fillOpacity: props.fillOpacity ?? 0,
  };
}

function closedEllipseArcBounds(props: EllipseArcProps): Rect {
  const b = ellipseArcBounds(props.radiusX, props.radiusY, props.startAngle, props.endAngle);
  return isFullArc(props.startAngle, props.endAngle) ? b : closureBounds(b, resolveClosure(props.closure));
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
    closure: 'open',
    fill: '#ffffff',
    fillPattern: 'none',
    patternSize: 'medium',
    fillOpacity: 0,
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
    lineStyleFieldExtended,
    arcClosureField,
    { key: 'fill', label: '塗り色', type: 'color' },
    fillOpacityField,
    fillPatternField,
    patternSizeField,
    ...centerFields,
  ],
  Renderer: ({ props }) => {
    const closure = resolveClosure(props.closure);
    const fillProps = closedFillProps(props);
    const fill = closure === 'open' ? 'none' : resolveFill(fillProps);
    const fillOpacity = closure === 'open' ? undefined : resolveFillOpacity(fillProps);
    return (
      <g>
        {closure !== 'open' && <PatternDefs props={fillProps} />}
        <StyledStroke lineStyle={props.lineStyle} bounds={closedEllipseArcBounds(props)}>
          {isFullArc(props.startAngle, props.endAngle) ? (
            <ellipse
              rx={props.radiusX}
              ry={props.radiusY}
              fill={fill}
              fillOpacity={fillOpacity}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
            />
          ) : (
            <path
              d={closeArcPath(
                ellipseArcPath(props.radiusX, props.radiusY, props.startAngle, props.endAngle),
                closure,
              )}
              fill={fill}
              fillOpacity={fillOpacity}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </StyledStroke>
        {props.showCenter && (
          <CenterMark color={props.stroke} style={props.centerStyle} size={props.centerSize} />
        )}
      </g>
    );
  },
  getBounds: (props) => closedEllipseArcBounds(props),
  getSnapPoints: (props) => {
    const delta = sweepDelta(props.startAngle, props.endAngle);
    return [
      { x: 0, y: 0 },
      ellipsePointAt(props.radiusX, props.radiusY, props.startAngle),
      ellipsePointAt(props.radiusX, props.radiusY, props.startAngle + delta),
      ellipsePointAt(props.radiusX, props.radiusY, props.startAngle + delta / 2),
    ];
  },
  // 弓形・扇形の閉じる辺(弦/半径)。スナップ・拘束の相手になる
  getSegments: (props) => {
    if (isFullArc(props.startAngle, props.endAngle)) return [];
    const delta = sweepDelta(props.startAngle, props.endAngle);
    return closureSegments(
      ellipsePointAt(props.radiusX, props.radiusY, props.startAngle),
      ellipsePointAt(props.radiusX, props.radiusY, props.startAngle + delta),
      resolveClosure(props.closure),
    );
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
  // 開始点・終了点ハンドル。ドラッグで各媒介変数角を視覚的に変える(半径・中心は保つ)
  getParts: (props) => {
    if (isFullArc(props.startAngle, props.endAngle)) return [];
    return [
      {
        id: 'start',
        local: ellipsePointAt(props.radiusX, props.radiusY, props.startAngle),
        title: '開始角をドラッグ',
      },
      {
        id: 'end',
        local: ellipsePointAt(props.radiusX, props.radiusY, props.endAngle),
        title: '終了角をドラッグ',
      },
    ];
  },
  movePart: (props, transform, partId, _fromWorld, toWorld) => {
    const local = worldToLocal(toWorld, transform);
    const angle = Math.round(
      normalizeAngle180(ellipseParamAngle(props.radiusX, props.radiusY, local)),
    );
    if (partId === 'start') return { ...props, startAngle: angle };
    if (partId === 'end') return { ...props, endAngle: angle };
    return props;
  },
  // トリム: 残す各区間[fromDeg,toDeg]を新しい楕円弧として作り直す(掃引の一部を残す)
  trim(props, transform, keeps, pick) {
    // 閉じる辺(弦・半径)は切れない(弧の角度だけで形が決まるため)
    if (pick?.kind === 'segment') return null;
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
  // 鏡像: 媒介変数角を負反転(手性を反転)し、回転を軸に対して反転する。radiusX/Yは不変
  mirror: (props, t, a, b) => {
    const c = reflectPoint({ x: t.x, y: t.y }, a, b);
    const axisAngle = angleOfVector({ x: b.x - a.x, y: b.y - a.y });
    return {
      props: { ...props, startAngle: -props.endAngle, endAngle: -props.startAngle },
      transform: { ...t, x: c.x, y: c.y, rotation: reflectAngle(t.rotation, axisAngle) },
    };
  },
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
