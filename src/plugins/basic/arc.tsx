import {
  angleOfVector,
  normalizeAngle180,
  normalizeAngle360,
  reflectAngle,
  reflectPoint,
  worldToLocal,
} from '../../core/geometry';
import type { PhysicsObjectPlugin, TrimPiece } from '../../core/plugin';
import type { Point, Rect } from '../../core/types';
import { CenterMark } from './CenterMark';
import { centerDefaults, centerFields } from './centerFields';
import { dashArray, lineStyleField, type LineStyle } from './lineUtils';

interface ArcProps {
  radius: number;
  /** 開始角(度, -180〜180)。0=右方向、角度が増えると画面上は時計回り */
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

const DEG = Math.PI / 180;

function pointAt(r: number, deg: number): Point {
  return { x: r * Math.cos(deg * DEG), y: r * Math.sin(deg * DEG) };
}

/** 開始角→終了角(増加方向)の掃引角(度)。0〜360に正規化し、0はfull扱い */
export function sweepDelta(startAngle: number, endAngle: number): number {
  let delta = ((endAngle - startAngle) % 360 + 360) % 360;
  if (delta === 0) delta = 360;
  return delta;
}

/** ほぼ全周かどうか(1本のarcで描けないため円で描く) */
export function isFullArc(startAngle: number, endAngle: number): boolean {
  return sweepDelta(startAngle, endAngle) >= 359.999;
}

/** 円弧のSVGパス(中心原点) */
export function arcPath(radius: number, startAngle: number, endAngle: number): string {
  const delta = sweepDelta(startAngle, endAngle);
  const s = pointAt(radius, startAngle);
  const e = pointAt(radius, startAngle + delta);
  const largeArc = delta > 180 ? 1 : 0;
  // y下向き座標系では増加方向=時計回りなので sweep-flag=1
  return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

/** 円弧の軸平行バウンディングボックス(中心原点) */
export function arcBounds(radius: number, startAngle: number, endAngle: number): Rect {
  if (isFullArc(startAngle, endAngle)) {
    return { x: -radius, y: -radius, width: radius * 2, height: radius * 2 };
  }
  const delta = sweepDelta(startAngle, endAngle);
  const a1 = startAngle + delta;
  const pts: Point[] = [pointAt(radius, startAngle), pointAt(radius, a1)];
  // 範囲内の90°倍数(x=±r, y=±rの極値)を加える
  for (let k = Math.ceil(startAngle / 90) * 90; k <= a1; k += 90) {
    pts.push(pointAt(radius, k));
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

export const arcPlugin: PhysicsObjectPlugin<ArcProps> = {
  id: 'core.arc',
  version: 1,
  name: '円弧',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M5 18 A9 9 0 0 1 19 6" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  defaultProps: {
    radius: 50,
    startAngle: 0,
    endAngle: 120,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    ...centerDefaults,
  },
  defaultSize: { width: 100, height: 100 },
  propertySchema: [
    { key: 'radius', label: '半径', type: 'number', min: 1, step: 5 },
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
        <circle
          r={props.radius}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        />
      ) : (
        <path
          d={arcPath(props.radius, props.startAngle, props.endAngle)}
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
  getBounds: (props) => arcBounds(props.radius, props.startAngle, props.endAngle),
  getSnapPoints: (props) => {
    const delta = sweepDelta(props.startAngle, props.endAngle);
    return [
      { x: 0, y: 0 },
      pointAt(props.radius, props.startAngle),
      pointAt(props.radius, props.startAngle + delta),
      pointAt(props.radius, props.startAngle + delta / 2),
    ];
  },
  getCircle: (props) => ({
    center: { x: 0, y: 0 },
    radius: props.radius,
    startAngle: props.startAngle,
    endAngle: props.endAngle,
  }),
  applyScale: (props, fx) => ({ ...props, radius: props.radius * fx }),
  // 開始点・終了点ハンドル。ドラッグで各角度を視覚的に変える(半径・中心は保つ)
  getParts: (props) => {
    if (isFullArc(props.startAngle, props.endAngle)) return [];
    return [
      { id: 'start', local: pointAt(props.radius, props.startAngle), title: '開始角をドラッグ' },
      { id: 'end', local: pointAt(props.radius, props.endAngle), title: '終了角をドラッグ' },
    ];
  },
  movePart: (props, transform, partId, _fromWorld, toWorld) => {
    const local = worldToLocal(toWorld, transform);
    const angle = Math.round(normalizeAngle180(angleOfVector(local)));
    if (partId === 'start') return { ...props, startAngle: angle };
    if (partId === 'end') return { ...props, endAngle: angle };
    return props;
  },
  // トリム: 残す各区間[fromDeg,toDeg]を新しい円弧として作り直す(掃引の一部を残す)
  trim(props, transform, keeps) {
    const pieces: TrimPiece[] = [];
    for (const keep of keeps) {
      if (keep.kind !== 'arc') continue;
      if ((normalizeAngle360(keep.toDeg - keep.fromDeg) || 360) < 0.5) continue; // ごく短い残片は捨てる
      pieces.push({
        pluginId: 'core.arc',
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
  // 鏡像: 手性(掃引の向き)を反転させるため開始/終了角を負反転し、回転を軸に対して反転する
  mirror: (props, t, a, b) => {
    const c = reflectPoint({ x: t.x, y: t.y }, a, b);
    const axisAngle = angleOfVector({ x: b.x - a.x, y: b.y - a.y });
    return {
      props: { ...props, startAngle: -props.endAngle, endAngle: -props.startAngle },
      transform: { ...t, x: c.x, y: c.y, rotation: reflectAngle(t.rotation, axisAngle) },
    };
  },
  capabilities: { rotatable: true, scalable: 'uniform' },
  placement: 'click',
};
