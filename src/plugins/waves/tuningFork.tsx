import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point } from '../../core/types';

interface TuningForkProps {
  prongLength: number;
  gap: number;
  stemLength: number;
  showVibration: boolean;
  stroke: string;
  strokeWidth: number;
}

/** 全高(足先からU字上端まで)と各部のy位置 */
function forkLayout(props: TuningForkProps) {
  const arcR = props.gap / 2;
  const totalH = props.prongLength + arcR + props.stemLength;
  const top = -totalH / 2;
  const arcY = top + props.prongLength;
  return { arcR, totalH, top, arcY, stemTop: arcY + arcR, bottom: totalH / 2 };
}

/** 音叉。U字の腕+柄。振動を表す弧を腕の外側に描ける */
export const tuningForkPlugin: PhysicsObjectPlugin<TuningForkProps> = {
  id: 'wave.tuningFork',
  version: 1,
  name: '音叉',
  category: '波動',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M8 3 L8 11 A4 4 0 0 0 16 11 L16 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <line x1="12" y1="15" x2="12" y2="21" stroke="currentColor" strokeWidth="2.2" />
      <path d="M5 4 Q3.5 6.5 5 9" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M19 4 Q20.5 6.5 19 9" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  defaultProps: {
    prongLength: 36,
    gap: 14,
    stemLength: 22,
    showVibration: true,
    stroke: '#000000',
    strokeWidth: 1,
  },
  defaultSize: { width: 34, height: 66 },
  propertySchema: [
    { key: 'prongLength', label: '腕の長さ', type: 'number', min: 4, step: 2 },
    { key: 'gap', label: '腕の間隔', type: 'number', min: 2, step: 2 },
    { key: 'stemLength', label: '柄の長さ', type: 'number', min: 0, step: 2 },
    { key: 'showVibration', label: '振動の弧を表示', type: 'boolean' },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
  ],
  Renderer: ({ props }) => {
    const { arcR, top, arcY, stemTop, bottom } = forkLayout(props);
    const marks: string[] = [];
    if (props.showVibration) {
      const span = Math.min(props.prongLength * 0.5, 16);
      for (const s of [-1, 1]) {
        for (const off of [4, 8]) {
          const x = s * (arcR + off);
          marks.push(`M ${x} ${top + 1} Q ${x + s * 3.5} ${top + 1 + span / 2} ${x} ${top + 1 + span}`);
        }
      }
    }
    return (
      <g>
        <path
          d={`M ${-arcR} ${top} L ${-arcR} ${arcY} A ${arcR} ${arcR} 0 0 0 ${arcR} ${arcY} L ${arcR} ${top}`}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth * 1.5}
        />
        {props.stemLength > 0 && (
          <line
            x1={0}
            y1={stemTop}
            x2={0}
            y2={bottom}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth * 2}
          />
        )}
        {marks.map((d) => (
          <path key={d} d={d} fill="none" stroke={props.stroke} strokeWidth={props.strokeWidth * 0.8} />
        ))}
        <rect
          x={-arcR - 2}
          y={top}
          width={props.gap + 4}
          height={bottom - top}
          fill="transparent"
          stroke="none"
        />
      </g>
    );
  },
  getBounds: (props) => {
    const { arcR, top, bottom } = forkLayout(props);
    const hw = arcR + (props.showVibration ? 12 : props.strokeWidth);
    return { x: -hw, y: top, width: hw * 2, height: bottom - top };
  },
  getSnapPoints: (props) => {
    const { arcR, top, bottom } = forkLayout(props);
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: -arcR, y: top },
      { x: arcR, y: top },
      { x: 0, y: bottom },
    ];
    return pts;
  },
  applyScale: (props, fx, fy) => ({
    ...props,
    prongLength: props.prongLength * fy,
    stemLength: props.stemLength * fy,
    gap: props.gap * fx,
  }),
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
