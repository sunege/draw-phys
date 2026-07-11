import { unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point, Rect } from '../../core/types';
import { hitStrokeWidth } from '../basic/lineUtils';
import { lensOutlinePath, type LensKind } from './opticsMath';

interface LensProps {
  height: number;
  focalLength: number;
  style: 'symbol' | 'shape';
  thickness: number;
  headSize: number;
  showAxis: boolean;
  axisLength: number;
  showFocus: boolean;
  fontSize: number;
  stroke: string;
  strokeWidth: number;
}

/** 焦点ラベルの光軸下オフセット */
const FOCUS_LABEL_GAP = 6;

/** 凸レンズ・凹レンズ共通の実装(記号スタイル/レンズ形スタイル、光軸・焦点F付き) */
function makeLensPlugin(kind: LensKind, id: string, name: string): PhysicsObjectPlugin<LensProps> {
  return {
    id,
    version: 1,
    name,
    category: '光学',
    Icon: () =>
      kind === 'convex' ? (
        <svg width="20" height="20" viewBox="0 0 24 24">
          <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1" />
          <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 2 L9.5 7 L14.5 7 Z" fill="currentColor" />
          <path d="M12 22 L9.5 17 L14.5 17 Z" fill="currentColor" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24">
          <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1" />
          <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 7 L9.5 2 L14.5 2 Z" fill="currentColor" />
          <path d="M12 17 L9.5 22 L14.5 22 Z" fill="currentColor" />
        </svg>
      ),
    defaultProps: {
      height: 120,
      focalLength: 60,
      style: 'symbol',
      thickness: 32,
      headSize: 9,
      showAxis: true,
      axisLength: 320,
      showFocus: true,
      fontSize: 12,
      stroke: '#000000',
      strokeWidth: 1,
    },
    defaultSize: { width: 320, height: 120 },
    propertySchema: [
      { key: 'height', label: '高さ', type: 'number', min: 10, step: 10 },
      { key: 'focalLength', label: '焦点距離', type: 'number', min: 5, step: 5 },
      {
        key: 'style',
        label: '表示スタイル',
        type: 'select',
        options: [
          { value: 'symbol', label: '記号(矢印)' },
          { value: 'shape', label: 'レンズ形' },
        ],
      },
      { key: 'thickness', label: '厚み(レンズ形)', type: 'number', min: 4, step: 2 },
      { key: 'headSize', label: '矢先サイズ(記号)', type: 'number', min: 2, step: 1 },
      { key: 'showAxis', label: '光軸を表示', type: 'boolean' },
      { key: 'axisLength', label: '光軸の長さ', type: 'number', min: 20, step: 20 },
      { key: 'showFocus', label: '焦点Fを表示', type: 'boolean' },
      { key: 'fontSize', label: '焦点記号サイズ', type: 'number', min: 6, step: 1 },
      { key: 'stroke', label: '線色', type: 'color' },
      { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    ],
    Renderer: ({ props, transform }) => {
      const hh = props.height / 2;
      const hs = props.headSize;
      const hw = hs * 0.4;
      const f = props.focalLength;
      const rot = -(transform?.rotation ?? 0);
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
          {props.style === 'shape' ? (
            <path
              d={lensOutlinePath(kind, props.height, props.thickness)}
              fill="#ffffff"
              fillOpacity={0}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
            />
          ) : (
            <>
              <line
                x1={0}
                y1={-hh}
                x2={0}
                y2={hh}
                stroke={props.stroke}
                strokeWidth={props.strokeWidth}
              />
              {kind === 'convex' ? (
                <>
                  <polygon points={`0,${-hh} ${-hw},${-hh + hs} ${hw},${-hh + hs}`} fill={props.stroke} />
                  <polygon points={`0,${hh} ${-hw},${hh - hs} ${hw},${hh - hs}`} fill={props.stroke} />
                </>
              ) : (
                <>
                  <polygon points={`0,${-hh + hs} ${-hw},${-hh} ${hw},${-hh}`} fill={props.stroke} />
                  <polygon points={`0,${hh - hs} ${-hw},${hh} ${hw},${hh}`} fill={props.stroke} />
                </>
              )}
            </>
          )}
          {props.showFocus &&
            ([-1, 1] as const).map((s) => (
              <g key={s}>
                <circle cx={s * f} cy={0} r={2} fill={props.stroke} />
                <text
                  transform={`rotate(${rot} ${s * f} ${FOCUS_LABEL_GAP})`}
                  x={s * f}
                  y={FOCUS_LABEL_GAP}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fontSize={props.fontSize}
                  fontFamily='"Times New Roman", serif'
                  fontStyle="italic"
                  fill={props.stroke}
                >
                  F
                </text>
              </g>
            ))}
          <line
            x1={0}
            y1={-hh}
            x2={0}
            y2={hh}
            stroke="transparent"
            strokeWidth={hitStrokeWidth(props.strokeWidth)}
          />
        </g>
      );
    },
    getBounds: (props) => {
      const halfW = props.style === 'shape' ? props.thickness / 2 : props.headSize * 0.5;
      const rects: Rect[] = [
        { x: -halfW, y: -props.height / 2, width: halfW * 2, height: props.height },
      ];
      if (props.showAxis) {
        rects.push({ x: -props.axisLength / 2, y: -1, width: props.axisLength, height: 2 });
      }
      if (props.showFocus) {
        const w = props.focalLength + props.fontSize;
        rects.push({ x: -w, y: -3, width: w * 2, height: FOCUS_LABEL_GAP + props.fontSize + 4 });
      }
      return unionRects(rects)!;
    },
    getSnapPoints: (props) => {
      const hh = props.height / 2;
      const f = props.focalLength;
      const pts: Point[] = [
        { x: 0, y: 0 },
        { x: 0, y: -hh },
        { x: 0, y: hh },
        { x: -f, y: 0 },
        { x: f, y: 0 },
        { x: -2 * f, y: 0 },
        { x: 2 * f, y: 0 },
      ];
      if (props.showAxis) {
        pts.push({ x: -props.axisLength / 2, y: 0 }, { x: props.axisLength / 2, y: 0 });
      }
      return pts;
    },
    getSegments: (props) => {
      const hh = props.height / 2;
      const segs: [Point, Point][] = [
        [
          { x: 0, y: -hh },
          { x: 0, y: hh },
        ],
      ];
      if (props.showAxis) {
        segs.push([
          { x: -props.axisLength / 2, y: 0 },
          { x: props.axisLength / 2, y: 0 },
        ]);
      }
      return segs;
    },
    applyScale: (props, fx, fy) => ({
      ...props,
      height: props.height * fy,
      thickness: props.thickness * fx,
      focalLength: props.focalLength * fx,
      axisLength: props.axisLength * fx,
      headSize: props.headSize * fy,
      fontSize: props.fontSize * fy,
    }),
    capabilities: { rotatable: true, scalable: 'both' },
    placement: 'click',
  };
}

export const convexLensPlugin = makeLensPlugin('convex', 'optics.convexLens', '凸レンズ');
export const concaveLensPlugin = makeLensPlugin('concave', 'optics.concaveLens', '凹レンズ');
