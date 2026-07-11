import { rotateVec } from '../../core/geometry';
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
import { cylinderWallPath, pistonClamp } from './thermoMath';

interface CylinderProps {
  length: number;
  bore: number;
  wallThickness: number;
  /** 閉端からピストン左面までの距離 */
  pistonPos: number;
  pistonThickness: number;
  rodLength: number;
  gasFill: string;
  gasOpacity: number;
  pistonFill: string;
  /** 壁の塗り(fillPatternで断熱壁のハッチにできる) */
  fill: string;
  fillOpacity: number;
  fillPattern: FillPattern;
  patternSize: PatternSize;
  stroke: string;
  strokeWidth: number;
}

/**
 * ピストン付きシリンダー。左が閉端・右が開口(縦置きは回転で)。
 * ピストンは選択中のハンドル(getParts/movePart)でシリンダー内をドラッグできる。
 */
export const cylinderPlugin: PhysicsObjectPlugin<CylinderProps> = {
  id: 'thermo.cylinder',
  version: 1,
  name: 'ピストン付きシリンダー',
  category: '熱力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M20 6 L3 6 L3 18 L20 18" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="13" y1="7" x2="13" y2="17" stroke="currentColor" strokeWidth="2.5" />
      <line x1="14" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  defaultProps: {
    length: 160,
    bore: 80,
    wallThickness: 6,
    pistonPos: 100,
    pistonThickness: 10,
    rodLength: 50,
    gasFill: '#ffffff',
    gasOpacity: 0,
    pistonFill: '#ffffff',
    fill: '#ffffff',
    fillOpacity: 0,
    fillPattern: 'none',
    patternSize: 'small',
    stroke: '#000000',
    strokeWidth: 1,
  },
  defaultSize: { width: 220, height: 92 },
  propertySchema: [
    { key: 'length', label: '長さ(内寸)', type: 'number', min: 20, step: 10 },
    { key: 'bore', label: '内径', type: 'number', min: 10, step: 10 },
    { key: 'wallThickness', label: '壁の厚さ', type: 'number', min: 1, step: 1 },
    { key: 'pistonPos', label: 'ピストン位置', type: 'number', min: 0, step: 5 },
    { key: 'pistonThickness', label: 'ピストンの厚さ', type: 'number', min: 2, step: 1 },
    { key: 'rodLength', label: '棒の長さ', type: 'number', min: 0, step: 5 },
    { key: 'gasFill', label: '気体の塗り色', type: 'color' },
    { key: 'gasOpacity', label: '気体の不透明度', type: 'number', min: 0, max: 1, step: 0.1 },
    { key: 'pistonFill', label: 'ピストンの塗り色', type: 'color' },
    { key: 'fill', label: '壁の塗り色', type: 'color' },
    fillOpacityField,
    fillPatternField,
    patternSizeField,
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
  ],
  Renderer: ({ props }) => {
    const hl = props.length / 2;
    const hb = props.bore / 2;
    const pos = pistonClamp(props.pistonPos, props.length, props.pistonThickness);
    const pistonX = -hl + pos;
    const rodStart = pistonX + props.pistonThickness;
    const rodEnd = rodStart + props.rodLength;
    return (
      <g>
        <PatternDefs props={props} />
        {props.gasOpacity > 0 && (
          <rect
            x={-hl}
            y={-hb}
            width={pos}
            height={props.bore}
            fill={props.gasFill}
            fillOpacity={props.gasOpacity}
          />
        )}
        <path
          d={cylinderWallPath(props.length, props.bore, props.wallThickness)}
          fill={resolveFill(props)}
          fillOpacity={resolveFillOpacity(props)}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinejoin="round"
        />
        <rect
          x={pistonX}
          y={-hb}
          width={props.pistonThickness}
          height={props.bore}
          fill={props.pistonFill}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
        />
        {props.rodLength > 0 && (
          <>
            <line
              x1={rodStart}
              y1={0}
              x2={rodEnd}
              y2={0}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth * 2.5}
            />
            <line
              x1={rodEnd}
              y1={-hb * 0.35}
              x2={rodEnd}
              y2={hb * 0.35}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth * 2.5}
            />
          </>
        )}
      </g>
    );
  },
  getBounds: (props) => {
    const hl = props.length / 2;
    const hb = props.bore / 2;
    const wt = props.wallThickness;
    const pos = pistonClamp(props.pistonPos, props.length, props.pistonThickness);
    const rodEnd = -hl + pos + props.pistonThickness + props.rodLength;
    const x1 = Math.max(hl, rodEnd);
    return {
      x: -hl - wt,
      y: -hb - wt,
      width: x1 + hl + wt,
      height: (hb + wt) * 2,
    };
  },
  getSnapPoints: (props) => {
    const hl = props.length / 2;
    const hb = props.bore / 2;
    const wt = props.wallThickness;
    const pos = pistonClamp(props.pistonPos, props.length, props.pistonThickness);
    const pistonX = -hl + pos;
    return [
      { x: 0, y: 0 },
      { x: -hl, y: 0 },
      { x: pistonX, y: 0 },
      { x: pistonX + props.pistonThickness + props.rodLength, y: 0 },
      { x: 0, y: -hb - wt },
      { x: 0, y: hb + wt },
      { x: hl, y: -hb - wt },
      { x: hl, y: hb + wt },
    ];
  },
  getSegments: (props) => {
    const hl = props.length / 2;
    const hb = props.bore / 2;
    const pos = pistonClamp(props.pistonPos, props.length, props.pistonThickness);
    const pistonX = -hl + pos;
    return [
      [
        { x: -hl, y: -hb },
        { x: hl, y: -hb },
      ],
      [
        { x: -hl, y: hb },
        { x: hl, y: hb },
      ],
      [
        { x: -hl, y: -hb },
        { x: -hl, y: hb },
      ],
      [
        { x: pistonX, y: -hb },
        { x: pistonX, y: hb },
      ],
    ];
  },
  getParts: (props) => {
    const hl = props.length / 2;
    const pos = pistonClamp(props.pistonPos, props.length, props.pistonThickness);
    return [
      {
        id: 'piston',
        local: { x: -hl + pos + props.pistonThickness / 2, y: 0 } as Point,
        title: 'ピストンをドラッグで移動',
      },
    ];
  },
  movePart: (props, transform, partId, fromWorld, toWorld) => {
    if (partId !== 'piston') return props;
    const d = rotateVec(
      { x: toWorld.x - fromWorld.x, y: toWorld.y - fromWorld.y },
      -transform.rotation,
    );
    return {
      ...props,
      pistonPos: pistonClamp(props.pistonPos + d.x, props.length, props.pistonThickness),
    };
  },
  applyScale: (props, fx, fy) => ({
    ...props,
    length: props.length * fx,
    pistonPos: props.pistonPos * fx,
    pistonThickness: props.pistonThickness * fx,
    rodLength: props.rodLength * fx,
    bore: props.bore * fy,
    wallThickness: props.wallThickness * fy,
  }),
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
