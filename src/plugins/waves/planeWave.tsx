import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point } from '../../core/types';
import { dashArray, lineStyleField, type LineStyle } from '../basic/lineUtils';
import { waveFrontLines } from './waveMath';

type RegionMode = 'expand' | 'fixed';

interface PlaneWaveProps {
  count: number;
  spacing: number;
  /** 各波面(直線)の長さ。伝搬方向(ローカルx)に直交(ローカルy)方向 */
  frontLength: number;
  /** 位相(0〜360°)。波源(伝搬方向の後端)から新しい波面が生まれ +x へ伝搬する */
  phase: number;
  /** 山=実線 / 谷=破線 で交互に描く(spacingは山→谷の半波長になる) */
  alternate: boolean;
  /** expand=波面全体に外枠を合わせる / fixed=固定枠にクリップ(はみ出しを切取り) */
  region: RegionMode;
  /** 固定枠の伝搬方向(x)の長さ */
  regionWidth: number;
  showFrame: boolean;
  showArrow: boolean;
  arrowSize: number;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
}

/** 波源(伝搬の後端)のローカルx位置 */
function planeWaveBase(props: PlaneWaveProps): number {
  return props.region === 'fixed'
    ? -props.regionWidth / 2 // 波源=固定枠の左端
    : -((props.count - 1) * props.spacing) / 2; // 原点中心(先頭↔後端が対称)
}

/**
 * 波面(直線)を波源から伝搬方向 +x へ放射する。位相を時間発展とみなし、
 * 波源から新しい波面が生まれて外(先頭)へ進み、先頭波面は外縁を越えると消える。
 */
function planeWaveFronts(props: PlaneWaveProps) {
  return waveFrontLines(
    planeWaveBase(props),
    props.spacing,
    props.phase,
    props.alternate,
    props.count,
  );
}

function styleOf(props: PlaneWaveProps, crest: boolean): LineStyle {
  if (!props.alternate) return props.lineStyle;
  return crest ? 'solid' : 'dashed';
}

/**
 * 平面波の波面。伝搬方向(ローカル+x、回転で向き変更)に直交する直線を等間隔に並べる。
 * 円形波と同じく山=実線/谷=破線の交互表示・位相ずらし・固定枠クリップに対応。
 */
export const planeWavePlugin: PhysicsObjectPlugin<PlaneWaveProps> = {
  id: 'wave.planeWave',
  version: 2,
  name: '波面(平面波)',
  category: '波動',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="5" y1="4" x2="5" y2="20" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="4" x2="10" y2="20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2.4" />
      <line x1="15" y1="4" x2="15" y2="20" stroke="currentColor" strokeWidth="1.5" />
      <line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.2" />
      <path d="M22 12 L19.5 10.5 L19.5 13.5 Z" fill="currentColor" />
    </svg>
  ),
  defaultProps: {
    count: 5,
    spacing: 20,
    frontLength: 120,
    phase: 0,
    alternate: false,
    region: 'expand',
    regionWidth: 160,
    showFrame: false,
    showArrow: false,
    arrowSize: 9,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
  },
  defaultSize: { width: 80, height: 120 },
  propertySchema: [
    { key: 'count', label: '本数', type: 'number', min: 1, max: 60, step: 1 },
    { key: 'spacing', label: '線の間隔', type: 'number', min: 2, step: 2 },
    { key: 'frontLength', label: '波面の長さ', type: 'number', min: 10, step: 10 },
    { key: 'phase', label: '位相(°)', type: 'number', min: 0, max: 360, step: 15 },
    { key: 'alternate', label: '山=実線/谷=破線', type: 'boolean' },
    {
      key: 'region',
      label: '領域',
      type: 'select',
      options: [
        { value: 'expand', label: '波面に合わせる' },
        { value: 'fixed', label: '固定枠で切取り' },
      ],
    },
    { key: 'regionWidth', label: '枠の長さ(固定時)', type: 'number', min: 20, step: 10 },
    { key: 'showFrame', label: '枠線を表示(固定時)', type: 'boolean' },
    { key: 'showArrow', label: '伝搬方向の矢印', type: 'boolean' },
    { key: 'arrowSize', label: '矢先サイズ', type: 'number', min: 2, step: 1 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
  ],
  Renderer: ({ props }) => {
    const fronts = planeWaveFronts(props);
    const hl = props.frontLength / 2;
    const fixed = props.region === 'fixed';
    const hw = props.regionWidth / 2;
    const clipId = `pwclip-${Math.round(props.regionWidth)}-${Math.round(props.frontLength)}`;
    // 矢印は外縁(先頭波面の到達点=位相に依らず一定)に置く
    const arrowBaseX = fixed ? hw : planeWaveBase(props) + Math.max(0, props.count - 1) * props.spacing;
    const hs = props.arrowSize;
    const lines = fronts.map((f, i) => (
      <g key={i}>
        <line
          x1={f.offset}
          y1={-hl}
          x2={f.offset}
          y2={hl}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeDasharray={dashArray(styleOf(props, f.crest), props.strokeWidth)}
        />
        <line x1={f.offset} y1={-hl} x2={f.offset} y2={hl} stroke="transparent" strokeWidth={8} />
      </g>
    ));
    return (
      <g>
        {fixed && (
          <defs>
            <clipPath id={clipId}>
              <rect x={-hw} y={-hl} width={props.regionWidth} height={props.frontLength} />
            </clipPath>
          </defs>
        )}
        {fixed ? <g clipPath={`url(#${clipId})`}>{lines}</g> : lines}
        {fixed && props.showFrame && (
          <rect
            x={-hw}
            y={-hl}
            width={props.regionWidth}
            height={props.frontLength}
            fill="none"
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
          />
        )}
        {props.showArrow && (
          <g>
            <line
              x1={arrowBaseX + 6}
              y1={0}
              x2={arrowBaseX + 6 + hs * 1.8}
              y2={0}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
            />
            <polygon
              points={`${arrowBaseX + 6 + hs * 2.4},0 ${arrowBaseX + 6 + hs * 1.4},${-hs * 0.4} ${arrowBaseX + 6 + hs * 1.4},${hs * 0.4}`}
              fill={props.stroke}
            />
          </g>
        )}
      </g>
    );
  },
  getBounds: (props) => {
    const hl = props.frontLength / 2 + props.strokeWidth;
    let minX: number;
    let maxX: number;
    if (props.region === 'fixed') {
      minX = -props.regionWidth / 2;
      maxX = props.regionWidth / 2;
    } else {
      // 波源〜外縁の一定範囲(位相に依らず外枠は伸縮しない)
      minX = planeWaveBase(props);
      maxX = minX + Math.max(0, props.count - 1) * props.spacing;
    }
    if (props.showArrow) maxX += 6 + props.arrowSize * 2.4;
    return {
      x: minX - props.strokeWidth,
      y: -hl,
      width: maxX - minX + props.strokeWidth * 2,
      height: hl * 2,
    };
  },
  getSnapPoints: (props) => {
    const fronts = planeWaveFronts(props);
    const hl = props.frontLength / 2;
    const pts: Point[] = [{ x: 0, y: 0 }];
    for (const f of fronts) {
      pts.push({ x: f.offset, y: 0 }, { x: f.offset, y: -hl }, { x: f.offset, y: hl });
    }
    return pts;
  },
  getSegments: (props) => {
    const hl = props.frontLength / 2;
    return planeWaveFronts(props).map(
      (f): [Point, Point] => [
        { x: f.offset, y: -hl },
        { x: f.offset, y: hl },
      ],
    );
  },
  applyScale: (props, fx, fy) => ({
    ...props,
    spacing: props.spacing * fx,
    frontLength: props.frontLength * fy,
    regionWidth: props.regionWidth * fx,
  }),
  migrate: (_from, props) =>
    ({
      region: 'expand',
      regionWidth: 160,
      showFrame: false,
      ...(props as Record<string, unknown>),
    }) as unknown as PlaneWaveProps,
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
