import type { PhysicsObjectPlugin } from '../../core/plugin';
import { CenterMark } from '../basic/CenterMark';
import { dashArray, lineStyleField, type LineStyle } from '../basic/lineUtils';
import { waveFrontLines } from './waveMath';

type RegionMode = 'expand' | 'fixed';

interface WavefrontProps {
  count: number;
  spacing: number;
  startRadius: number;
  /** 位相(0〜360°)。波源から次々に波面が生まれ外へ伝搬する様子を表す */
  phase: number;
  /** 山=実線 / 谷=破線 で交互に描く(spacingは山→谷の半波長になる) */
  alternate: boolean;
  /** expand=波面全体に外枠を合わせる / fixed=固定枠にクリップ(はみ出しを切取り) */
  region: RegionMode;
  regionWidth: number;
  regionHeight: number;
  showFrame: boolean;
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  showCenter: boolean;
  centerStyle: 'cross' | 'dot';
  centerSize: number;
}

/** 実際に描かれる円(半径>0)の一覧。位相を進めると波源から新しい円が生まれ外へ動く */
function wavefrontRings(props: WavefrontProps) {
  return waveFrontLines(
    props.startRadius,
    props.spacing,
    props.phase,
    props.alternate,
    props.count,
  ).filter((r) => r.offset > 0.5);
}

/** 波面が到達する外縁半径(位相に依らず一定=外枠が伸縮しない) */
function maxRadius(props: WavefrontProps): number {
  return props.startRadius + Math.max(0, props.count - 1) * props.spacing;
}

function styleOf(props: WavefrontProps, crest: boolean): LineStyle {
  if (!props.alternate) return props.lineStyle;
  return crest ? 'solid' : 'dashed';
}

/**
 * 波面(円形波)。波源から等間隔に広がる波を同心円で表す。
 * - 位相(0〜360°)を進めると波源から新しい波面が生まれ、外側へ伝搬する。
 * - 「山=実線/谷=破線」で山谷を区別できる。
 * - 領域=固定にすると外枠のサイズを変えずに、はみ出した波面を切り取る
 *   (波が空の領域へ伝搬する様子や、定常的に波で満ちた領域を表現できる)。
 */
export const wavefrontPlugin: PhysicsObjectPlugin<WavefrontProps> = {
  id: 'wave.wavefront',
  version: 3,
  name: '波面(円形波)',
  category: '波動',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 2.4"
      />
    </svg>
  ),
  defaultProps: {
    count: 5,
    spacing: 16,
    startRadius: 16,
    phase: 0,
    alternate: false,
    region: 'expand',
    regionWidth: 200,
    regionHeight: 200,
    showFrame: false,
    stroke: '#000000',
    strokeWidth: 1,
    lineStyle: 'solid',
    showCenter: true,
    centerStyle: 'dot',
    centerSize: 4,
  },
  defaultSize: { width: 160, height: 160 },
  propertySchema: [
    { key: 'count', label: '本数', type: 'number', min: 1, max: 60, step: 1 },
    { key: 'spacing', label: '線の間隔', type: 'number', min: 2, step: 2 },
    { key: 'startRadius', label: '波源の半径', type: 'number', min: 0, step: 2 },
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
    { key: 'regionWidth', label: '枠の幅(固定時)', type: 'number', min: 20, step: 10 },
    { key: 'regionHeight', label: '枠の高さ(固定時)', type: 'number', min: 20, step: 10 },
    { key: 'showFrame', label: '枠線を表示(固定時)', type: 'boolean' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    lineStyleField,
    { key: 'showCenter', label: '波源を表示', type: 'boolean' },
    {
      key: 'centerStyle',
      label: '波源マーク',
      type: 'select',
      options: [
        { value: 'dot', label: '点' },
        { value: 'cross', label: '十字' },
      ],
    },
    { key: 'centerSize', label: '波源サイズ', type: 'number', min: 1, step: 1 },
  ],
  Renderer: ({ props }) => {
    const rings = wavefrontRings(props);
    const fixed = props.region === 'fixed';
    const hw = props.regionWidth / 2;
    const hh = props.regionHeight / 2;
    // 書き出し時は objectId が渡らないためサイズ由来のidにする(graph/PatternDefsと同じ扱い)
    const clipId = `wfclip-${Math.round(props.regionWidth)}-${Math.round(props.regionHeight)}`;
    const circles = rings.map((ring, i) => (
      <g key={i}>
        <circle
          r={ring.offset}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeDasharray={dashArray(styleOf(props, ring.crest), props.strokeWidth)}
        />
        <circle r={ring.offset} fill="none" stroke="transparent" strokeWidth={8} />
      </g>
    ));
    return (
      <g>
        {fixed && (
          <defs>
            <clipPath id={clipId}>
              <rect x={-hw} y={-hh} width={props.regionWidth} height={props.regionHeight} />
            </clipPath>
          </defs>
        )}
        {fixed ? <g clipPath={`url(#${clipId})`}>{circles}</g> : circles}
        {fixed && props.showFrame && (
          <rect
            x={-hw}
            y={-hh}
            width={props.regionWidth}
            height={props.regionHeight}
            fill="none"
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
          />
        )}
        {props.showCenter && (
          <CenterMark color={props.stroke} style={props.centerStyle} size={props.centerSize} />
        )}
      </g>
    );
  },
  getBounds: (props) => {
    if (props.region === 'fixed') {
      return {
        x: -props.regionWidth / 2,
        y: -props.regionHeight / 2,
        width: props.regionWidth,
        height: props.regionHeight,
      };
    }
    const r = maxRadius(props) + props.strokeWidth;
    return { x: -r, y: -r, width: r * 2, height: r * 2 };
  },
  getSnapPoints: (props) => {
    if (props.region === 'fixed') {
      const hw = props.regionWidth / 2;
      const hh = props.regionHeight / 2;
      return [
        { x: 0, y: 0 },
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
      ];
    }
    const r = maxRadius(props);
    return [
      { x: 0, y: 0 },
      { x: r, y: 0 },
      { x: -r, y: 0 },
      { x: 0, y: r },
      { x: 0, y: -r },
    ];
  },
  applyScale: (props, fx) => ({
    ...props,
    startRadius: props.startRadius * fx,
    spacing: props.spacing * fx,
    regionWidth: props.regionWidth * fx,
    regionHeight: props.regionHeight * fx,
  }),
  migrate: (_from, props) =>
    ({
      phase: 0,
      alternate: false,
      region: 'expand',
      regionWidth: 200,
      regionHeight: 200,
      showFrame: false,
      ...(props as Record<string, unknown>),
    }) as unknown as WavefrontProps,
  capabilities: { rotatable: false, scalable: 'uniform' },
  placement: 'click',
};
