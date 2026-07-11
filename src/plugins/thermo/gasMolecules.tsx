import type { PhysicsObjectPlugin } from '../../core/plugin';
import { gasMoleculeLayout } from './thermoMath';

interface GasMoleculesProps {
  width: number;
  height: number;
  count: number;
  radius: number;
  /** 配置の乱数シード。変えると並びが変わる(同じ値なら常に同じ) */
  seed: number;
  showVelocity: boolean;
  arrowLength: number;
  headSize: number;
  stroke: string;
  strokeWidth: number;
}

/** 配置サンプリング時に矢印が領域からはみ出しにくくする内側マージン */
function layoutMargin(props: GasMoleculesProps): number {
  return props.radius + 2 + (props.showVelocity ? props.arrowLength * 0.5 : 0);
}

/** 気体分子。速度矢印付きの分子をシードから決定的に散布する */
export const gasMoleculesPlugin: PhysicsObjectPlugin<GasMoleculesProps> = {
  id: 'thermo.gasMolecules',
  version: 1,
  name: '気体分子',
  category: '熱力学',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      {[
        [7, 8, 45],
        [16, 6, 160],
        [11, 15, 280],
        [19, 17, 80],
      ].map(([x, y, deg]) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="1.8" fill="currentColor" />
            <line
              x1={x + 2.5 * Math.cos(rad)}
              y1={y + 2.5 * Math.sin(rad)}
              x2={x + 6 * Math.cos(rad)}
              y2={y + 6 * Math.sin(rad)}
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </g>
        );
      })}
    </svg>
  ),
  defaultProps: {
    width: 140,
    height: 100,
    count: 12,
    radius: 3,
    seed: 1,
    showVelocity: true,
    arrowLength: 14,
    headSize: 9,
    stroke: '#000000',
    strokeWidth: 1,
  },
  defaultSize: { width: 140, height: 100 },
  propertySchema: [
    { key: 'width', label: '領域の幅', type: 'number', min: 10, step: 10 },
    { key: 'height', label: '領域の高さ', type: 'number', min: 10, step: 10 },
    { key: 'count', label: '分子の数', type: 'number', min: 1, max: 100, step: 1 },
    { key: 'radius', label: '分子の半径', type: 'number', min: 0.5, step: 0.5 },
    { key: 'seed', label: '配置パターン', type: 'number', min: 1, step: 1 },
    { key: 'showVelocity', label: '速度矢印を表示', type: 'boolean' },
    { key: 'arrowLength', label: '矢印の長さ', type: 'number', min: 2, step: 1 },
    { key: 'headSize', label: '矢先サイズ', type: 'number', min: 1, step: 1 },
    { key: 'stroke', label: '色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
  ],
  Renderer: ({ props }) => {
    const molecules = gasMoleculeLayout(
      props.width,
      props.height,
      props.count,
      props.radius,
      props.seed,
      layoutMargin(props),
    );
    const hs = Math.min(props.headSize, props.arrowLength * 0.5);
    return (
      <g>
        <rect
          x={-props.width / 2}
          y={-props.height / 2}
          width={props.width}
          height={props.height}
          fill="transparent"
          stroke="none"
        />
        {molecules.map((m, i) => {
          const rad = (m.angle * Math.PI) / 180;
          const c = Math.cos(rad);
          const s = Math.sin(rad);
          const from = props.radius + 1;
          const to = from + props.arrowLength;
          return (
            <g key={i}>
              <circle cx={m.x} cy={m.y} r={props.radius} fill={props.stroke} />
              {props.showVelocity && (
                <>
                  <line
                    x1={m.x + from * c}
                    y1={m.y + from * s}
                    x2={m.x + (to - hs * 0.8) * c}
                    y2={m.y + (to - hs * 0.8) * s}
                    stroke={props.stroke}
                    strokeWidth={props.strokeWidth}
                  />
                  <polygon
                    points={`${m.x + to * c},${m.y + to * s} ${m.x + (to - hs) * c - hs * 0.4 * s},${m.y + (to - hs) * s + hs * 0.4 * c} ${m.x + (to - hs) * c + hs * 0.4 * s},${m.y + (to - hs) * s - hs * 0.4 * c}`}
                    fill={props.stroke}
                  />
                </>
              )}
            </g>
          );
        })}
      </g>
    );
  },
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
    ];
  },
  applyScale: (props, fx, fy) => {
    const f = Math.min(fx, fy);
    return {
      ...props,
      width: props.width * fx,
      height: props.height * fy,
      radius: props.radius * f,
      arrowLength: props.arrowLength * f,
    };
  },
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'click',
};
