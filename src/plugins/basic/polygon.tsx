import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point } from '../../core/types';
import { PatternDefs } from './PatternDefs';
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
import {
  canAppendVertex,
  canClosePolygon,
  mirrorPolygon,
  movePolygonEdge,
  movePolygonVertex,
  polygonBounds,
  polygonEdges,
  polygonFromWorldPoints,
  polygonSnapPoints,
  scalePolygon,
  worldDeltaToLocal,
} from './polygonMath';
import { StyledStroke } from './StyledStroke';

interface PolygonProps {
  /** 頂点列(ローカル座標)。末尾→先頭で閉じる */
  points: Point[];
  fill: string;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  fillPattern: FillPattern;
  patternSize: PatternSize;
  fillOpacity: number;
}

/** 既定の形(クリック配置ではなく既定値として使う正三角形) */
const DEFAULT_POINTS: Point[] = [
  { x: 0, y: -40 },
  { x: 40, y: 30 },
  { x: -40, y: 30 },
];

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * 自己交差しない多角形。複雑な形状の面を塗る(斜面付きの容器・断面図など)ために使う。
 *
 * - 配置: 頂点を順にクリックし、最初の頂点をクリックすると閉じる(placement: 'click-path')
 * - 編集: 頂点ハンドル(菱形)で1頂点、辺ハンドル(円)で辺を平行移動
 * - 拘束: 全頂点がスナップ点なので頂点ごとに一致拘束を張れる。平行/垂直拘束は
 *   クリックした辺が基準に揃う(ObjectRef.selfSegIndex)
 *
 * 頂点編集でローカル原点(=重心)を再計算しないのが要点。一致拘束の localAnchor は
 * ローカル座標なので、フレームが動くと拘束済みの頂点がずれてしまう(polygonMath 参照)。
 */
export const polygonPlugin: PhysicsObjectPlugin<PolygonProps> = {
  id: 'core.polygon',
  version: 1,
  name: '多角形',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M12 3 L21 9 L18 20 L7 20 L3 10 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  defaultProps: {
    points: DEFAULT_POINTS,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    fillPattern: 'none',
    patternSize: 'medium',
    fillOpacity: 0,
  },
  defaultSize: { width: 80, height: 70 },
  // 頂点列はパネルで数値編集しない(キャンバス上のハンドルで編集する)
  propertySchema: [
    { key: 'fill', label: '塗り色', type: 'color' },
    fillOpacityField,
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0, step: 0.5 },
    lineStyleFieldExtended,
    fillPatternField,
    patternSizeField,
  ],
  Renderer: ({ props }) => (
    <g>
      <PatternDefs props={props} />
      <StyledStroke lineStyle={props.lineStyle} bounds={polygonBounds(props.points)}>
        <polygon
          points={props.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill={resolveFill(props)}
          fillOpacity={resolveFillOpacity(props)}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinejoin="round"
        />
      </StyledStroke>
    </g>
  ),
  getBounds: (props) => polygonBounds(props.points),
  // 先頭が頂点、続いて辺の中点(一致拘束の pointIndex がこの並びを指す)
  getSnapPoints: (props) => polygonSnapPoints(props.points),
  getSegments: (props) => polygonEdges(props.points),
  // 頂点=菱形(スケールハンドルの白い正方形と見分ける)、辺の中点=円
  getParts: (props) => [
    ...props.points.map((local, i) => ({
      id: `v${i}`,
      local,
      title: '頂点をドラッグして変形',
      shape: 'diamond' as const,
      snapLocal: local,
    })),
    ...polygonEdges(props.points).map(([a, b], i) => ({
      id: `e${i}`,
      local: mid(a, b),
      title: '辺をドラッグして平行移動',
      // 吸着は辺の端点基準(中点基準だと頂点がグリッドから半目盛ずれる)
      snapLocal: a,
    })),
  ],
  // 自己交差する操作は無視して直前の形を保つ(ドラッグはその位置で止まって見える)
  movePart: (props, transform, partId, fromWorld, toWorld) => {
    const index = Number(partId.slice(1));
    const delta = worldDeltaToLocal(
      { x: toWorld.x - fromWorld.x, y: toWorld.y - fromWorld.y },
      transform,
    );
    const next = partId.startsWith('e')
      ? movePolygonEdge(props.points, index, delta)
      : movePolygonVertex(props.points, index, delta);
    return next ? { ...props, points: next } : props;
  },
  applyScale: (props, fx, fy) => ({ ...props, points: scalePolygon(props.points, fx, fy) }),
  mirror: (props, transform, a, b) => {
    const m = mirrorPolygon(props.points, transform, a, b);
    return { props: { ...props, points: m.points }, transform: m.transform };
  },
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click-path',
  createFromPath: (world) => {
    const { points, transform } = polygonFromWorldPoints(world);
    return { props: { ...polygonPlugin.defaultProps, points }, transform };
  },
  // 作成中も自己交差させない: 交差する辺になるクリック・閉じ方は受け付けない
  canAppendPathPoint: (world, next) => canAppendVertex(world, next),
  canClosePath: (world) => canClosePolygon(world),
};
