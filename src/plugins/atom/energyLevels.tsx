import type { PhysicsObjectPlugin } from '../../core/plugin';
import type { Point } from '../../core/types';
import { energyLevelYs, type LevelSpacing } from './energyLevelMath';

interface EnergyLevelsProps {
  width: number;
  height: number;
  count: number;
  spacing: LevelSpacing;
  labelFormat: 'n' | 'E' | 'none';
  fontSize: number;
  /** 水素型のとき電離レベル(E=0)の破線を上端に描く */
  showIonization: boolean;
  /** 遷移矢印の始状態n(0でなし) */
  transitionFrom: number;
  /** 遷移矢印の終状態n(0でなし) */
  transitionTo: number;
  /** 遷移矢印のx位置(中央からのオフセット) */
  transitionOffset: number;
  headSize: number;
  stroke: string;
  strokeWidth: number;
}

/** ラベルの概算幅(getBoundsで右側に確保する) */
function labelWidth(props: EnergyLevelsProps): number {
  return props.labelFormat === 'none' ? 0 : props.fontSize * 3;
}

/**
 * エネルギー準位図。等間隔/水素型(E∝-1/n²)の準位線と遷移矢印を描く。
 * 各準位線は getSegments を返すので、追加の遷移は既存の矢印をスナップして描ける。
 */
export const energyLevelsPlugin: PhysicsObjectPlugin<EnergyLevelsProps> = {
  id: 'atom.energyLevels',
  version: 1,
  name: 'エネルギー準位図',
  category: '原子',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <line x1="4" y1="19" x2="20" y2="19" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4" y1="10" x2="20" y2="10" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4" y1="5" x2="20" y2="5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="10" x2="12" y2="16" stroke="currentColor" strokeWidth="1.2" />
      <path d="M12 19 L10 15 L14 15 Z" fill="currentColor" />
    </svg>
  ),
  defaultProps: {
    width: 140,
    height: 130,
    count: 4,
    spacing: 'hydrogen',
    labelFormat: 'n',
    fontSize: 12,
    showIonization: false,
    transitionFrom: 0,
    transitionTo: 0,
    transitionOffset: 0,
    headSize: 9,
    stroke: '#000000',
    strokeWidth: 1,
  },
  defaultSize: { width: 180, height: 140 },
  propertySchema: [
    { key: 'width', label: '準位線の長さ', type: 'number', min: 20, step: 10 },
    { key: 'height', label: '高さ', type: 'number', min: 20, step: 10 },
    { key: 'count', label: '準位の数', type: 'number', min: 2, max: 10, step: 1 },
    {
      key: 'spacing',
      label: '間隔',
      type: 'select',
      options: [
        { value: 'hydrogen', label: '水素型(E∝-1/n²)' },
        { value: 'equal', label: '等間隔' },
      ],
    },
    {
      key: 'labelFormat',
      label: 'ラベル',
      type: 'select',
      options: [
        { value: 'n', label: 'n=1,2,…' },
        { value: 'E', label: 'E₁,E₂,…' },
        { value: 'none', label: 'なし' },
      ],
    },
    { key: 'fontSize', label: 'ラベルサイズ', type: 'number', min: 6, step: 1 },
    { key: 'showIonization', label: '電離レベル(E=0)を表示', type: 'boolean' },
    { key: 'transitionFrom', label: '遷移矢印: 始状態n(0でなし)', type: 'number', min: 0, step: 1 },
    { key: 'transitionTo', label: '遷移矢印: 終状態n', type: 'number', min: 0, step: 1 },
    { key: 'transitionOffset', label: '遷移矢印のx位置', type: 'number', step: 5 },
    { key: 'headSize', label: '矢先サイズ', type: 'number', min: 2, step: 1 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
  ],
  Renderer: ({ props }) => {
    const hw = props.width / 2;
    const ys = energyLevelYs(props.count, props.height, props.spacing);
    const labelX = hw + 4;
    const from = props.transitionFrom;
    const to = props.transitionTo;
    const showTransition =
      from >= 1 && to >= 1 && from <= props.count && to <= props.count && from !== to;
    const tx = props.transitionOffset;
    const hs = props.headSize;
    const dir = showTransition ? Math.sign(ys[to - 1] - ys[from - 1]) : 1;
    return (
      <g>
        {ys.map((y, i) => (
          <g key={i}>
            <line
              x1={-hw}
              y1={y}
              x2={hw}
              y2={y}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
            />
            {props.labelFormat !== 'none' && (
              <text
                x={labelX}
                y={y}
                dominantBaseline="central"
                fontSize={props.fontSize}
                fontFamily='"Times New Roman", serif'
                fontStyle="italic"
                fill={props.stroke}
              >
                {props.labelFormat === 'n' ? (
                  `n=${i + 1}`
                ) : (
                  <>
                    E
                    <tspan dy={props.fontSize * 0.25} fontSize={props.fontSize * 0.7}>
                      {i + 1}
                    </tspan>
                  </>
                )}
              </text>
            )}
          </g>
        ))}
        {props.spacing === 'hydrogen' && props.showIonization && (
          <g>
            <line
              x1={-hw}
              y1={-props.height / 2}
              x2={hw}
              y2={-props.height / 2}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
              strokeDasharray="4 3"
            />
            {props.labelFormat !== 'none' && (
              <text
                x={labelX}
                y={-props.height / 2}
                dominantBaseline="central"
                fontSize={props.fontSize}
                fontFamily='"Times New Roman", serif'
                fontStyle="italic"
                fill={props.stroke}
              >
                {props.labelFormat === 'n' ? 'n=∞' : 'E=0'}
              </text>
            )}
          </g>
        )}
        {showTransition && (
          <g>
            <line
              x1={tx}
              y1={ys[from - 1]}
              x2={tx}
              y2={ys[to - 1] - dir * hs * 0.8}
              stroke={props.stroke}
              strokeWidth={props.strokeWidth}
            />
            <polygon
              points={`${tx},${ys[to - 1]} ${tx - hs * 0.4},${ys[to - 1] - dir * hs} ${tx + hs * 0.4},${ys[to - 1] - dir * hs}`}
              fill={props.stroke}
            />
          </g>
        )}
      </g>
    );
  },
  getBounds: (props) => {
    const pad = props.fontSize / 2;
    return {
      x: -props.width / 2,
      y: -props.height / 2 - pad,
      width: props.width + 4 + labelWidth(props),
      height: props.height + pad * 2,
    };
  },
  getSnapPoints: (props) => {
    const hw = props.width / 2;
    const pts: Point[] = [];
    for (const y of energyLevelYs(props.count, props.height, props.spacing)) {
      pts.push({ x: -hw, y }, { x: 0, y }, { x: hw, y });
    }
    return pts;
  },
  getSegments: (props) => {
    const hw = props.width / 2;
    return energyLevelYs(props.count, props.height, props.spacing).map(
      (y): [Point, Point] => [
        { x: -hw, y },
        { x: hw, y },
      ],
    );
  },
  applyScale: (props, fx, fy) => ({
    ...props,
    width: props.width * fx,
    height: props.height * fy,
    fontSize: props.fontSize * fy,
  }),
  capabilities: { rotatable: false, scalable: 'both' },
  placement: 'click',
};
