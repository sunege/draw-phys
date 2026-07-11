import { angleOfVector, normalizeAngle180, reflectAngle, reflectPoint } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point } from '../../core/types';
import { PatternDefs } from '../basic/PatternDefs';
import {
  fillOpacityField,
  fillPatternField,
  patternSizeField,
  resolveFill,
  resolveFillOpacity,
  type FillPattern,
  type PatternSize,
} from '../basic/fillPattern';
import { dashArray, hatchPositions, lineStyleField, type LineStyle } from '../basic/lineUtils';
import { inclineGeometry, type InclineDirection } from './inclineMath';

interface InclineProps {
  base: number;
  angle: number;
  direction: InclineDirection;
  hatch: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  fillPattern: FillPattern;
  patternSize: PatternSize;
  fillOpacity: number;
}

const HATCH_SPACING = 12;
const HATCH_LENGTH = 8;

/** 斜面(直角三角形)。斜辺・底辺が物体や力ベクトルのスナップ・拘束相手になる */
export const inclinePlugin: PhysicsObjectPlugin<InclineProps> = {
  id: 'mech.incline',
  version: 1,
  name: '斜面',
  category: '力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M3 18 L21 18 L21 5 Z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  defaultProps: {
    base: 180,
    angle: 30,
    direction: 'right',
    hatch: true,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    fillPattern: 'none',
    patternSize: 'medium',
    fillOpacity: 0,
  },
  defaultSize: { width: 180, height: 104 },
  propertySchema: [
    { key: 'base', label: '底辺', type: 'number', min: 10, step: 10 },
    { key: 'angle', label: '傾角(°)', type: 'number', min: 3, max: 80, step: 1 },
    {
      key: 'direction',
      label: '向き',
      type: 'select',
      options: [
        { value: 'right', label: '右上がり' },
        { value: 'left', label: '左上がり' },
      ],
    },
    { key: 'hatch', label: '底面の斜線', type: 'boolean' },
    { key: 'fill', label: '塗り色', type: 'color' },
    fillOpacityField,
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
    lineStyleField,
    fillPatternField,
    patternSizeField,
  ],
  Renderer: ({ props }) => {
    const { vertices, height } = inclineGeometry(props.base, props.angle, props.direction);
    const [a, b, c] = vertices;
    const hh = height / 2;
    return (
      <g>
        <PatternDefs props={props} />
        <polygon
          points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`}
          fill={resolveFill(props)}
          fillOpacity={resolveFillOpacity(props)}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinejoin="round"
          strokeDasharray={dashArray(props.lineStyle, props.strokeWidth)}
        />
        {props.hatch &&
          hatchPositions(props.base, HATCH_SPACING).map((x) => (
            <line
              key={x}
              x1={x}
              y1={hh}
              x2={x - HATCH_LENGTH * 0.6}
              y2={hh + HATCH_LENGTH}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth * 0.6}
            />
          ))}
      </g>
    );
  },
  getBounds: (props) => {
    const { height } = inclineGeometry(props.base, props.angle, props.direction);
    return {
      x: -props.base / 2,
      y: -height / 2,
      width: props.base,
      height: height + (props.hatch ? HATCH_LENGTH : 0),
    };
  },
  getSnapPoints: (props) => {
    const { vertices } = inclineGeometry(props.base, props.angle, props.direction);
    const [a, b, c] = vertices;
    const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    return [{ x: 0, y: 0 }, a, b, c, mid(a, b), mid(c, a)];
  },
  getSegments: (props) => {
    const { vertices } = inclineGeometry(props.base, props.angle, props.direction);
    const [a, b, c] = vertices;
    return [
      [a, b],
      [b, c],
      [c, a],
    ];
  },
  applyScale: (props, fx, fy) => {
    // 底辺はfx・高さはfyで伸びるので、傾角を対応する値へ再計算する
    const tan = Math.tan(props.angle * (Math.PI / 180)) * (fy / fx);
    const angle = Math.min(Math.max((Math.atan(tan) * 180) / Math.PI, 1), 85);
    return { ...props, base: props.base * fx, angle };
  },
  // 鏡像: 三角形の手性を direction の反転で表す。
  // 局所x反転(M_y)は M_x·Rot(180) なので回転は reflectAngle からさらに180°ずらす
  mirror: (props, t, a, b) => {
    const c = reflectPoint({ x: t.x, y: t.y }, a, b);
    const axisAngle = angleOfVector({ x: b.x - a.x, y: b.y - a.y });
    return {
      props: { ...props, direction: props.direction === 'right' ? 'left' : 'right' },
      transform: {
        ...t,
        x: c.x,
        y: c.y,
        rotation: normalizeAngle180(reflectAngle(t.rotation, axisAngle) - 180),
      },
    };
  },
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
