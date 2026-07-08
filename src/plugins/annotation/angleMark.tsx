import { identityTransform, type Point } from '../../core/types';
import { pointOnCircleAtAngle, unionRects } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { buildKatexExportCss } from '../basic/latex';
import {
  labelBgField,
  labelDecoDefaults,
  labelLocalBounds,
  moveLabelOffset,
  type LabelContent,
  type LabelDecoProps,
} from '../basic/objectLabel';
import { MarkLabel, type LabelMode } from './MarkLabel';
import {
  angleFromResolved,
  anglePropsFromPicks,
  isRightAngle,
  normalizeSweep,
  rightAnglePoints,
} from './angleMarkMath';

interface AngleMarkProps extends LabelDecoProps {
  /** 腕Aの向き(度)。頂点=局所原点 */
  startAngle: number;
  /** 腕Bの向き(度)。startAngleからの掃引側になす角の弧を描く */
  endAngle: number;
  radius: number;
  /** 弧の重ね本数(1 or 2) */
  count: number;
  /** 2重のときの内側弧との間隔 */
  gap: number;
  stroke: string;
  strokeWidth: number;
  labelMode: LabelMode;
  latex: string;
  fontSize: number;
  decimals: number;
}

const ORIGIN: Point = { x: 0, y: 0 };

/** 中心原点・符号付き掃引角の円弧パス(|sweep|<=180想定) */
function markArcPath(radius: number, startDeg: number, sweepDeg: number): string {
  const s = pointOnCircleAtAngle(ORIGIN, radius, startDeg);
  const e = pointOnCircleAtAngle(ORIGIN, radius, startDeg + sweepDeg);
  const largeArc = Math.abs(sweepDeg) > 180 ? 1 : 0;
  // y下向き系: 正のsweep=時計回り=sweep-flag 1
  const sweepFlag = sweepDeg >= 0 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${e.x} ${e.y}`;
}

function labelText(props: AngleMarkProps): string {
  const sweep = Math.abs(normalizeSweep(props.endAngle - props.startAngle));
  return `${sweep.toFixed(Math.max(0, props.decimals))}°`;
}

/** ラベル基準位置(局所座標)。弧の中央角の外側に置く */
function labelAnchor(props: AngleMarkProps): Point {
  const sweep = normalizeSweep(props.endAngle - props.startAngle);
  const midDeg = props.startAngle + sweep / 2;
  const labelR = props.radius + props.fontSize * 0.9;
  return pointOnCircleAtAngle(ORIGIN, labelR, midDeg);
}

function markContent(props: AngleMarkProps): LabelContent {
  return {
    mode: props.labelMode === 'value' ? 'text' : props.labelMode,
    text: labelText(props),
    latex: props.latex,
  };
}

export const angleMarkPlugin: PhysicsObjectPlugin<AngleMarkProps> = {
  id: 'core.angleMark',
  version: 1,
  name: '角度マーク',
  category: '注釈',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M4 20 L20 20" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M4 20 L18 8" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M15 20 A11 11 0 0 0 11.5 12" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  defaultProps: {
    startAngle: 0,
    endAngle: -60,
    radius: 32,
    count: 1,
    gap: 5,
    stroke: '#000000',
    strokeWidth: 1,
    labelMode: 'value',
    latex: '\\theta',
    fontSize: 12,
    decimals: 0,
    ...labelDecoDefaults,
  },
  defaultSize: { width: 64, height: 64 },
  propertySchema: [
    { key: 'radius', label: '半径', type: 'number', min: 5, step: 2 },
    {
      key: 'count',
      label: '弧の本数',
      type: 'select',
      options: [
        { value: '1', label: '1重' },
        { value: '2', label: '2重' },
      ],
    },
    { key: 'gap', label: '弧の間隔', type: 'number', min: 1, step: 1 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    {
      key: 'labelMode',
      label: 'ラベル',
      type: 'select',
      options: [
        { value: 'value', label: '実測角' },
        { value: 'latex', label: 'LaTeX' },
        { value: 'none', label: 'なし' },
      ],
    },
    { key: 'latex', label: 'LaTeX式', type: 'text' },
    { key: 'fontSize', label: 'ラベルサイズ', type: 'number', min: 6, step: 1 },
    { key: 'decimals', label: '小数桁', type: 'number', min: 0, max: 3, step: 1 },
    labelBgField,
  ],
  Renderer: ({ props, transform, objectId, interactive }) => {
    const sweep = normalizeSweep(props.endAngle - props.startAngle);
    const labelPos = labelAnchor(props);
    const double = Number(props.count) >= 2;
    const rightAngle = isRightAngle(sweep);
    let paths: string[];
    if (rightAngle) {
      // 直角マーク: 半径R相当の正方形コーナー(辺=R/√2でコーナーが半径R上に来る)
      const base = props.radius / Math.SQRT2;
      const sizes = double ? [base, base - props.gap] : [base];
      paths = sizes.map((s) => {
        const [p1, c, p2] = rightAnglePoints(s, props.startAngle, sweep);
        return `M ${p1.x} ${p1.y} L ${c.x} ${c.y} L ${p2.x} ${p2.y}`;
      });
    } else {
      const radii = double ? [props.radius, props.radius - props.gap] : [props.radius];
      paths = radii.map((r) => markArcPath(r, props.startAngle, sweep));
    }
    // 直角のときは実測値(90°)の表示は冗長なので省く(LaTeX/カスタムは残す)
    const labelMode = rightAngle && props.labelMode === 'value' ? 'none' : props.labelMode;
    return (
      <g>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={props.stroke} strokeWidth={props.strokeWidth} />
        ))}
        <MarkLabel
          x={labelPos.x}
          y={labelPos.y}
          dx={props.labelDx}
          dy={props.labelDy}
          rotation={transform?.rotation ?? 0}
          mode={labelMode}
          text={labelText(props)}
          latex={props.latex}
          fontSize={props.fontSize}
          color={props.stroke}
          bg={props.labelBg}
          objectId={objectId}
          interactive={interactive}
        />
      </g>
    );
  },
  getBounds: (props) => {
    const half = props.radius + props.fontSize * 1.6 + props.gap;
    const shape = { x: -half, y: -half, width: half * 2, height: half * 2 };
    const label = labelLocalBounds(labelAnchor(props), props, markContent(props), props.fontSize);
    return label ? unionRects([shape, label])! : shape;
  },
  getSnapPoints: () => [{ x: 0, y: 0 }],
  applyRefs: (props, resolved, transform) => {
    const solved = angleFromResolved(resolved);
    if (!solved) return { props, transform };
    return {
      props: { ...props, startAngle: solved.startAngle, endAngle: solved.endAngle },
      transform: { ...transform, x: solved.vertex.x, y: solved.vertex.y, rotation: 0, scaleX: 1, scaleY: 1 },
    };
  },
  moveLabel: moveLabelOffset,
  capabilities: { rotatable: false, scalable: 'none' },
  placement: 'pick-segments',
  createFromPicks: (picks) => {
    const solved = anglePropsFromPicks(picks);
    if (!solved) {
      return { props: angleMarkPlugin.defaultProps, transform: identityTransform(), refs: [] };
    }
    return {
      props: { ...angleMarkPlugin.defaultProps, startAngle: solved.startAngle, endAngle: solved.endAngle },
      transform: identityTransform(solved.vertex.x, solved.vertex.y),
      refs: solved.refs,
    };
  },
  exportStyles: buildKatexExportCss,
};
