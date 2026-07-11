import { localToWorld } from '../../core/geometry';
import type { PhysicsObjectPlugin, TrimPiece } from '../../core/plugin';
import type { Point } from '../../core/types';
import { CenterMark } from './CenterMark';
import { PatternDefs } from './PatternDefs';
import { centerDefaults, centerFields } from './centerFields';
import {
  fillOpacityField,
  fillPatternField,
  patternSizeField,
  resolveFill,
  resolveFillOpacity,
  type FillPattern,
  type PatternSize,
} from './fillPattern';
import { dashArray, lineStyleField, segmentFromEndpoints, type LineStyle } from './lineUtils';

interface RectProps {
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  fillPattern: FillPattern;
  patternSize: PatternSize;
  fillOpacity: number;
  showCenter: boolean;
  centerStyle: 'cross' | 'dot';
  centerSize: number;
}

/** 4辺のローカル端点([始点, 終点] × 4)。上→右→下→左の順(getSegments と trim で共有) */
function rectEdges(props: RectProps): [Point, Point][] {
  const hw = props.width / 2;
  const hh = props.height / 2;
  return [
    [{ x: -hw, y: -hh }, { x: hw, y: -hh }],
    [{ x: hw, y: -hh }, { x: hw, y: hh }],
    [{ x: hw, y: hh }, { x: -hw, y: hh }],
    [{ x: -hw, y: hh }, { x: -hw, y: -hh }],
  ];
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
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    fillPattern: 'none',
    patternSize: 'medium',
    fillOpacity: 0,
    ...centerDefaults,
  },
  defaultSize: { width: 100, height: 60 },
  propertySchema: [
    { key: 'width', label: '幅', type: 'number', min: 1, step: 10 },
    { key: 'height', label: '高さ', type: 'number', min: 1, step: 10 },
    { key: 'fill', label: '塗り色', type: 'color' },
    fillOpacityField,
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
    lineStyleField,
    fillPatternField,
    patternSizeField,
    ...centerFields,
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
  getSegments: (props) => rectEdges(props),
  applyScale: (props, fx, fy) => ({
    ...props,
    width: props.width * fx,
    height: props.height * fy,
  }),
  // トリム: 四角形は閉じた1図形なので、切ると四角形では表せない。
  // クリックした辺を交点で切った線分に、残り3辺はまるごと線分に分解する(core.line群へ)。
  trim(props, transform, keeps, pick): TrimPiece[] {
    if (!pick || pick.kind !== 'segment') return [];
    const base = {
      stroke: props.stroke,
      strokeWidth: props.strokeWidth,
      lineStyle: props.lineStyle,
      lengthLocked: false,
    };
    const makeLine = (la: Point, lb: Point): TrimPiece | null => {
      const seg = segmentFromEndpoints(localToWorld(la, transform), localToWorld(lb, transform));
      if (seg.length < 1) return null; // 1px未満は捨てる
      return { pluginId: 'core.line', props: { ...base, length: seg.length }, transform: seg.transform };
    };
    const pieces: TrimPiece[] = [];
    rectEdges(props).forEach(([la, lb], i) => {
      if (i === pick.segIndex) {
        // クリックした辺: 残す区間[from,to]だけを線分化(端の短縮=1本, 中間削除=2本)
        for (const keep of keeps) {
          if (keep.kind !== 'segment') continue;
          const p0 = { x: la.x + (lb.x - la.x) * keep.from, y: la.y + (lb.y - la.y) * keep.from };
          const p1 = { x: la.x + (lb.x - la.x) * keep.to, y: la.y + (lb.y - la.y) * keep.to };
          const line = makeLine(p0, p1);
          if (line) pieces.push(line);
        }
      } else {
        // 他の辺: まるごと線分化
        const line = makeLine(la, lb);
        if (line) pieces.push(line);
      }
    });
    return pieces;
  },
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
