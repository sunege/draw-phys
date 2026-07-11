import { unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point, Rect } from '../../core/types';
import { arcBounds, arcPath } from '../basic/arc';
import { hitStrokeWidth } from '../basic/lineUtils';
import { arcHatchTicks, curvedMirrorGeometry, type CurvedMirrorKind } from './opticsMath';

interface CurvedMirrorProps {
  radius: number;
  halfAngle: number;
  showAxis: boolean;
  axisLength: number;
  showFocus: boolean;
  fontSize: number;
  hatchLength: number;
  stroke: string;
  strokeWidth: number;
}

/** 焦点・曲率中心ラベルの光軸下オフセット */
const LABEL_GAP = 5;

/**
 * 球面鏡(凹面鏡・凸面鏡)。鏡の頂点が原点・光軸が+x方向で、
 * 焦点F(R/2)と曲率中心Cを光軸上に表示できる。getCircle を返すので
 * 光線の端点を鏡面へ一致させる拘束・接線拘束の相手になれる。
 */
function makeCurvedMirrorPlugin(
  kind: CurvedMirrorKind,
  id: string,
  name: string,
): PhysicsObjectPlugin<CurvedMirrorProps> {
  return {
    id,
    version: 1,
    name,
    category: '光学',
    Icon: () =>
      kind === 'concave' ? (
        <svg width="20" height="20" viewBox="0 0 24 24">
          <line x1="6" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1" />
          <path d="M10 3 Q3 12 10 21" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="15" cy="12" r="1.5" fill="currentColor" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24">
          <line x1="2" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="1" />
          <path d="M8 3 Q15 12 8 21" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="6" cy="12" r="1.5" fill="currentColor" />
        </svg>
      ),
    defaultProps: {
      radius: 160,
      halfAngle: 40,
      showAxis: true,
      axisLength: 320,
      showFocus: true,
      fontSize: 12,
      hatchLength: 6,
      stroke: '#000000',
      strokeWidth: 1,
    },
    defaultSize: { width: 320, height: 200 },
    propertySchema: [
      { key: 'radius', label: '曲率半径', type: 'number', min: 10, step: 10 },
      { key: 'halfAngle', label: '開き角(半角)', type: 'number', min: 5, max: 85, step: 5 },
      { key: 'showAxis', label: '光軸を表示', type: 'boolean' },
      { key: 'axisLength', label: '光軸の長さ', type: 'number', min: 20, step: 20 },
      { key: 'showFocus', label: '焦点F・曲率中心Cを表示', type: 'boolean' },
      { key: 'fontSize', label: '記号サイズ', type: 'number', min: 6, step: 1 },
      { key: 'hatchLength', label: '斜線長さ', type: 'number', min: 0, step: 1 },
      { key: 'stroke', label: '線色', type: 'color' },
      { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    ],
    Renderer: ({ props, transform }) => {
      const g = curvedMirrorGeometry(kind, props.radius, props.halfAngle);
      const ticks =
        props.hatchLength > 0
          ? arcHatchTicks(
              g.center,
              g.radius,
              g.startAngle,
              g.endAngle,
              kind === 'concave',
              props.hatchLength,
              10,
            )
          : [];
      const rot = -(transform?.rotation ?? 0);
      const marks: { p: Point; text: string }[] = props.showFocus
        ? [
            { p: g.focus, text: 'F' },
            { p: g.curvatureCenter, text: 'C' },
          ]
        : [];
      const d = arcPath(g.radius, g.startAngle, g.endAngle);
      const arcTranslate = `translate(${g.center.x} ${g.center.y})`;
      return (
        <g>
          {props.showAxis && (
            <line
              x1={-props.axisLength / 2}
              y1={0}
              x2={props.axisLength / 2}
              y2={0}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
            />
          )}
          <path
            d={d}
            transform={arcTranslate}
            fill="none"
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
          />
          {ticks.map(([a, b], i) => (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth * 0.6}
            />
          ))}
          {marks.map(({ p, text }) => (
            <g key={text}>
              <circle cx={p.x} cy={p.y} r={2} fill={props.stroke} />
              <text
                transform={`rotate(${rot} ${p.x} ${p.y + LABEL_GAP})`}
                x={p.x}
                y={p.y + LABEL_GAP}
                textAnchor="middle"
                dominantBaseline="hanging"
                fontSize={props.fontSize}
                fontFamily='"Times New Roman", serif'
                fontStyle="italic"
                fill={props.stroke}
              >
                {text}
              </text>
            </g>
          ))}
          <path
            d={d}
            transform={arcTranslate}
            fill="none"
            stroke="transparent"
            strokeWidth={hitStrokeWidth(props.strokeWidth)}
          />
        </g>
      );
    },
    getBounds: (props) => {
      const g = curvedMirrorGeometry(kind, props.radius, props.halfAngle);
      const b = arcBounds(props.radius, g.startAngle, g.endAngle);
      const hl = props.hatchLength;
      const rects: Rect[] = [
        {
          x: b.x + g.center.x - hl,
          y: b.y + g.center.y - hl,
          width: b.width + hl * 2,
          height: b.height + hl * 2,
        },
      ];
      if (props.showAxis) {
        rects.push({ x: -props.axisLength / 2, y: -1, width: props.axisLength, height: 2 });
      }
      if (props.showFocus) {
        for (const p of [g.focus, g.curvatureCenter]) {
          rects.push({
            x: p.x - props.fontSize,
            y: p.y - 3,
            width: props.fontSize * 2,
            height: LABEL_GAP + props.fontSize + 4,
          });
        }
      }
      return unionRects(rects)!;
    },
    getSnapPoints: (props) => {
      const g = curvedMirrorGeometry(kind, props.radius, props.halfAngle);
      const pts: Point[] = [{ x: 0, y: 0 }, g.focus, g.curvatureCenter, g.ends[0], g.ends[1]];
      if (props.showAxis) {
        pts.push({ x: -props.axisLength / 2, y: 0 }, { x: props.axisLength / 2, y: 0 });
      }
      return pts;
    },
    getCircle: (props) => {
      const g = curvedMirrorGeometry(kind, props.radius, props.halfAngle);
      return {
        center: g.center,
        radius: g.radius,
        startAngle: g.startAngle,
        endAngle: g.endAngle,
      };
    },
    applyScale: (props, fx) => ({
      ...props,
      radius: props.radius * fx,
      axisLength: props.axisLength * fx,
      fontSize: props.fontSize * fx,
    }),
    capabilities: { rotatable: true, scalable: 'uniform' },
    placement: 'click',
  };
}

export const concaveMirrorPlugin = makeCurvedMirrorPlugin(
  'concave',
  'optics.concaveMirror',
  '凹面鏡',
);
export const convexMirrorPlugin = makeCurvedMirrorPlugin(
  'convex',
  'optics.convexMirror',
  '凸面鏡',
);
