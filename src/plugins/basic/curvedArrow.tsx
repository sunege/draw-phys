import { angleOfVector, reflectAngle, reflectPoint, worldToLocal } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import {
  arcPathDeg,
  clampSweep,
  curvedArrowBounds,
  curvedArrowDragEnd,
  curvedArrowPaths,
  dirSign,
  endAngleOf,
} from './curvedArrowMath';
import { ellipseParamAngle, ellipsePointAt } from './ellipseMath';
import { dashArray, hitStrokeWidth, lineStyleField, type LineStyle } from './lineUtils';

interface CurvedArrowProps {
  radiusX: number;
  radiusY: number;
  startAngle: number;
  sweep: number;
  /** true=反時計回り(画面), false=時計回り */
  ccw: boolean;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  headSize: number;
  doubleHead: boolean;
}

/** 回転方向を示す巻矢印。楕円弧＋接線方向の矢先で時計回り/反時計回りを表す。縦横に潰せる */
export const curvedArrowPlugin: PhysicsObjectPlugin<CurvedArrowProps> = {
  id: 'core.curvedArrow',
  version: 1,
  name: '巻矢印',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M12 6 A9 6 0 1 0 21 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <polygon points="21,12.5 17.5,11 20.5,7.5" fill="currentColor" />
    </svg>
  ),
  defaultProps: {
    radiusX: 50,
    radiusY: 30,
    startAngle: -45,
    sweep: 270,
    ccw: true,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    headSize: 9,
    doubleHead: false,
  },
  defaultSize: { width: 100, height: 60 },
  propertySchema: [
    { key: 'radiusX', label: '半径X', type: 'number', min: 5, step: 5 },
    { key: 'radiusY', label: '半径Y', type: 'number', min: 5, step: 5 },
    { key: 'sweep', label: '掃引角', type: 'number', min: 5, max: 360, step: 5 },
    { key: 'startAngle', label: '開始角', type: 'number', min: -180, max: 180, step: 5 },
    { key: 'ccw', label: '反時計回り', type: 'boolean' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    { key: 'headSize', label: '矢先サイズ', type: 'number', min: 2, step: 1 },
    { key: 'doubleHead', label: '両端矢印', type: 'boolean' },
  ],
  Renderer: ({ props, interactive }) => {
    const { arc, heads } = curvedArrowPaths(props, props.headSize, props.doubleHead);
    return (
      <g>
        <path
          d={arc}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        />
        {heads.map((points, i) => (
          <polygon key={i} points={points} fill={props.stroke} />
        ))}
        {/* 選択しやすくするための当たり判定(弧沿いの透明な太線) */}
        {interactive !== false && (
          <path
            d={arcPathDeg(props.radiusX, props.radiusY, props.startAngle, endAngleOf(props))}
            fill="none"
            stroke="transparent"
            strokeWidth={hitStrokeWidth(props.strokeWidth)}
          />
        )}
      </g>
    );
  },
  getBounds: (props) => curvedArrowBounds(props, props.headSize, props.strokeWidth),
  getSnapPoints: (props) => {
    const dir = dirSign(props.ccw);
    const sweep = clampSweep(props.sweep);
    return [
      { x: 0, y: 0 },
      ellipsePointAt(props.radiusX, props.radiusY, props.startAngle),
      ellipsePointAt(props.radiusX, props.radiusY, props.startAngle + dir * sweep / 2),
      ellipsePointAt(props.radiusX, props.radiusY, props.startAngle + dir * sweep),
    ];
  },
  applyScale: (props, fx, fy) => ({
    ...props,
    radiusX: props.radiusX * fx,
    radiusY: props.radiusY * fy,
  }),
  // 始点(尾)・終点(矢先)ハンドル。ドラッグで各端の媒介変数角を視覚的に変える。
  // 反対の端と回転の向きは固定したまま掃引角を計算し直す
  getParts: (props) => [
    {
      id: 'start',
      local: ellipsePointAt(props.radiusX, props.radiusY, props.startAngle),
      title: '始点をドラッグ',
    },
    {
      id: 'end',
      local: ellipsePointAt(props.radiusX, props.radiusY, endAngleOf(props)),
      title: '終点(矢先)をドラッグ',
    },
  ],
  movePart: (props, transform, partId, _fromWorld, toWorld) => {
    if (partId !== 'start' && partId !== 'end') return props;
    const local = worldToLocal(toWorld, transform);
    const target = ellipseParamAngle(props.radiusX, props.radiusY, local);
    const { startAngle, sweep } = curvedArrowDragEnd(props, partId, target);
    return { ...props, startAngle: Math.round(startAngle), sweep: Math.round(sweep) };
  },
  // 鏡像: 手性(回転の向き)を反転させるため開始角を負反転し ccw をトグル、位置・回転を軸に対して反転する
  mirror: (props, t, a, b) => {
    const c = reflectPoint({ x: t.x, y: t.y }, a, b);
    const axisAngle = angleOfVector({ x: b.x - a.x, y: b.y - a.y });
    return {
      props: { ...props, startAngle: -props.startAngle, ccw: !props.ccw },
      transform: { ...t, x: c.x, y: c.y, rotation: reflectAngle(t.rotation, axisAngle) },
    };
  },
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
