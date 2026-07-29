import {
  angleOfVector,
  localToWorld,
  normalizeAngle180,
  reflectAngle,
  reflectPoint,
} from '../../core/geometry';
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
import { lineStyleFieldExtended, segmentFromEndpoints, type LineStyle } from './lineUtils';
import {
  dragParallelogramEdge,
  dragParallelogramVertex,
  MAX_SLANT_ANGLE,
  MIN_SLANT_ANGLE,
  parallelogramBounds,
  parallelogramEdges,
  parallelogramVertices,
  scaleParallelogram,
} from './parallelogramMath';
import { StyledStroke } from './StyledStroke';

interface ParallelogramProps {
  width: number;
  sideLength: number;
  angle: number;
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

const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/**
 * 平行四辺形。直方体などの立体を斜投影で描くときの各面(上面・側面)に使う。
 * 底辺・斜辺の長さと挟角で形を決めるので、「奥行き○px を45°で」がそのまま入力できる。
 */
export const parallelogramPlugin: PhysicsObjectPlugin<ParallelogramProps> = {
  id: 'core.parallelogram',
  version: 1,
  name: '平行四辺形',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M2 18 L15 18 L22 6 L9 6 Z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  defaultProps: {
    width: 100,
    sideLength: 60,
    angle: 60,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    fillPattern: 'none',
    patternSize: 'medium',
    fillOpacity: 0,
    ...centerDefaults,
  },
  defaultSize: { width: 130, height: 52 },
  propertySchema: [
    { key: 'width', label: '底辺', type: 'number', min: 1, step: 10 },
    { key: 'sideLength', label: '斜辺', type: 'number', min: 1, step: 10 },
    {
      key: 'angle',
      label: '挟角(°)',
      type: 'number',
      min: MIN_SLANT_ANGLE,
      max: MAX_SLANT_ANGLE,
      step: 5,
    },
    { key: 'fill', label: '塗り色', type: 'color' },
    fillOpacityField,
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
    lineStyleFieldExtended,
    fillPatternField,
    patternSizeField,
    ...centerFields,
  ],
  Renderer: ({ props }) => (
    <g>
      <PatternDefs props={props} />
      <StyledStroke lineStyle={props.lineStyle} bounds={parallelogramBounds(props)}>
        <polygon
          points={parallelogramVertices(props)
            .map((p) => `${p.x},${p.y}`)
            .join(' ')}
          fill={resolveFill(props)}
          fillOpacity={resolveFillOpacity(props)}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinejoin="round"
        />
      </StyledStroke>
      {props.showCenter && (
        <CenterMark color={props.stroke} style={props.centerStyle} size={props.centerSize} />
      )}
    </g>
  ),
  getBounds: (props) => parallelogramBounds(props),
  getSnapPoints: (props) => {
    const [a, b, c, d] = parallelogramVertices(props);
    return [{ x: 0, y: 0 }, a, b, c, d, mid(a, b), mid(b, c), mid(c, d), mid(d, a)];
  },
  getSegments: (props) => parallelogramEdges(props),
  // 頂点(菱形)と辺の中点(円)のハンドル。頂点はスケールハンドル(白い正方形)と
  // 重なる角があるので菱形で描き分ける
  getParts: (props) => {
    const vertices = parallelogramVertices(props);
    return [
      ...vertices.map((local, i) => ({
        id: `v${i}`,
        local,
        title: '頂点をドラッグして変形(隣り合う2頂点は固定)',
        shape: 'diamond' as const,
        snapLocal: local,
      })),
      ...vertices.map((a, i) => ({
        id: `e${i}`,
        local: mid(a, vertices[(i + 1) % 4]),
        title: '辺をドラッグして平行移動(対辺は固定)',
        // 吸着は辺の端点基準。中点を基準にすると頂点がグリッドから半目盛ずれる
        snapLocal: a,
      })),
    ];
  },
  movePart: (props, transform, partId, fromWorld, toWorld) => {
    const index = Number(partId.slice(1));
    const delta = { x: toWorld.x - fromWorld.x, y: toWorld.y - fromWorld.y };
    const r = partId.startsWith('e')
      ? dragParallelogramEdge(props, transform, index, delta)
      : dragParallelogramVertex(props, transform, index, delta);
    return { props: { ...props, ...r.shape }, transform: r.transform };
  },
  applyScale: (props, fx, fy) => ({ ...props, ...scaleParallelogram(props, fx, fy) }),
  // トリム: 長方形と同じく閉じた1図形なので、切ると平行四辺形では表せない。
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
    const edges = parallelogramEdges(props);
    // クリックした辺: 残す区間[from,to]だけを線分化(keeps順のまま先頭に置き、
    // 分割でクリックした断片=keeps先頭が元IDを引き継ぐようにする)
    const [ca, cb] = edges[pick.segIndex];
    for (const keep of keeps) {
      if (keep.kind !== 'segment') continue;
      const p0 = { x: ca.x + (cb.x - ca.x) * keep.from, y: ca.y + (cb.y - ca.y) * keep.from };
      const p1 = { x: ca.x + (cb.x - ca.x) * keep.to, y: ca.y + (cb.y - ca.y) * keep.to };
      const line = makeLine(p0, p1);
      if (line) pieces.push(line);
    }
    // 他の辺: まるごと線分化
    edges.forEach(([la, lb], i) => {
      if (i === pick.segIndex) return;
      const line = makeLine(la, lb);
      if (line) pieces.push(line);
    });
    return pieces;
  },
  // 鏡像: 平行四辺形は手性を持つので、挟角の補角(右上がり↔左上がり)で表す。
  // 局所x反転は M_y·Rot(180) なので回転は reflectAngle からさらに180°ずらす(斜面と同様)。
  mirror: (props, t, a, b) => {
    const c = reflectPoint({ x: t.x, y: t.y }, a, b);
    const axisAngle = angleOfVector({ x: b.x - a.x, y: b.y - a.y });
    return {
      props: { ...props, angle: 180 - props.angle },
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
