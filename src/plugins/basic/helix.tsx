import { angleOfVector, reflectAngle, reflectPoint } from '../../core/geometry';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import { helixAxialBounds, helixEndpoints, helixPaths, type HelixShape } from './helixMath';
import { hitStrokeWidth, lineFromDrag } from './lineUtils';

/** 奥側(隠れ側)の線の描き方 */
type BackStyle = 'solid' | 'dashed' | 'none';

interface HelixProps extends HelixShape {
  stroke: string;
  strokeWidth: number;
  /** 奥側の線の描き方 */
  backStyle: BackStyle;
}

/** 螺旋を斜めから見た図。ローレンツ力の螺旋運動・ソレノイドコイル用 */
export const helixPlugin: PhysicsObjectPlugin<HelixProps> = {
  id: 'core.helix',
  version: 1,
  name: 'らせん',
  category: '基本図形',
  Icon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
      {/* 奥側(破線) */}
      <path
        d="M6 4 A3 8 0 0 0 6 20 M12 4 A3 8 0 0 0 12 20 M18 4 A3 8 0 0 0 18 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 2"
      />
      {/* 手前側(実線) */}
      <path
        d="M6 4 A3 8 0 0 1 6 20 M12 4 A3 8 0 0 1 12 20 M18 4 A3 8 0 0 1 18 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  ),
  defaultProps: {
    length: 140,
    radius: 26,
    radiusX: 12,
    turns: 6,
    flip: false,
    startAngle: 0,
    endAngle: 0,
    stroke: '#000000',
    strokeWidth: 1,
    backStyle: 'dashed',
  },
  defaultSize: { width: 140, height: 52 },
  propertySchema: [
    { key: 'length', label: '長さ', type: 'number', min: 10, step: 10 },
    { key: 'radius', label: '輪の半径', type: 'number', min: 2, step: 2 },
    { key: 'radiusX', label: '開き幅', type: 'number', min: 1, step: 1 },
    { key: 'turns', label: '巻き数', type: 'number', min: 1, max: 60, step: 1 },
    { key: 'startAngle', label: '始点の角度', type: 'number', min: -360, max: 360, step: 15 },
    { key: 'endAngle', label: '終点の角度', type: 'number', min: -360, max: 360, step: 15 },
    { key: 'stroke', label: '線色', type: 'color' },
    { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
    {
      key: 'backStyle',
      label: '奥側の線',
      type: 'select',
      options: [
        { value: 'dashed', label: '破線' },
        { value: 'solid', label: '実線' },
        { value: 'none', label: 'なし' },
      ],
    },
    { key: 'flip', label: '巻き方向を反転', type: 'boolean' },
  ],
  Renderer: ({ props }) => {
    const { front, back } = helixPaths(props);
    const axis = helixAxialBounds(props); // 角度で伸びた実際の軸方向の範囲
    return (
      <g>
        {props.backStyle !== 'none' && back && (
          <path
            d={back}
            fill="none"
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={
              props.backStyle === 'dashed'
                ? `${props.strokeWidth * 3} ${props.strokeWidth * 3}`
                : undefined
            }
          />
        )}
        <path
          d={front}
          fill="none"
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 選択しやすくするための当たり判定(軸沿いの透明な太線)。角度指定で伸びた範囲に合わせる */}
        <line
          x1={axis.min}
          y1={0}
          x2={axis.max}
          y2={0}
          stroke="transparent"
          strokeWidth={hitStrokeWidth(props.radius * 2)}
        />
      </g>
    );
  },
  getBounds: (props) => {
    const w = props.strokeWidth;
    const { min, max } = helixAxialBounds(props); // 角度指定で本体外へ非対称に伸びる
    return {
      x: min - props.radiusX - w,
      y: -props.radius - w,
      width: max - min + (props.radiusX + w) * 2,
      height: (props.radius + w) * 2,
    };
  },
  // 接続用: 実際に線が始まる/終わる点(角度指定で移動する)と軸中心
  getSnapPoints: (props) => {
    const { start, end } = helixEndpoints(props);
    const { min, max } = helixAxialBounds(props);
    return [start, { x: (min + max) / 2, y: 0 }, end];
  },
  // 箱型: 拡大縮小は props へ焼き込み(線幅は不変)。x=軸方向と開き幅、y=輪の半径
  applyScale: (props, fx, fy) => ({
    ...props,
    length: props.length * fx,
    radiusX: props.radiusX * fx,
    radius: props.radius * fy,
  }),
  // 鏡像: 手性(巻き方向)を反転させるため flip をトグルし、位置・回転を軸に対して反転する
  mirror: (props, t, a, b) => {
    const c = reflectPoint({ x: t.x, y: t.y }, a, b);
    const axisAngle = angleOfVector({ x: b.x - a.x, y: b.y - a.y });
    return {
      props: { ...props, flip: !props.flip },
      transform: { ...t, x: c.x, y: c.y, rotation: reflectAngle(t.rotation, axisAngle) },
    };
  },
  capabilities: { rotatable: true, scalable: 'both' },
  placement: 'drag-line',
  createFromDrag(start, end) {
    const { length, transform } = lineFromDrag(start, end, this.defaultProps.length);
    return { props: { ...this.defaultProps, length }, transform };
  },
};
