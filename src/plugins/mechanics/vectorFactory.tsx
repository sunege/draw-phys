import type { ComponentType } from 'react';
import type { PhysicsObjectPlugin } from '../../core/plugin';
import {
  hitStrokeWidth,
  lineFromDrag,
  segmentEndpoints,
  segmentFromEndpoints,
} from '../basic/lineUtils';

export interface VectorProps {
  length: number;
  color: string;
  strokeWidth: number;
  headSize: number;
  label: string;
  fontSize: number;
  labelPos: 'tip' | 'middle';
  /** 作用点(始点)に点を打つ */
  showPoint: boolean;
}

/**
 * ベクトル系プラグインの共通実装。
 * 「ベクトル」「力ベクトル」は既定値と作用点表示の有無だけが異なる。
 */
export function makeVectorPlugin(config: {
  id: string;
  name: string;
  Icon: ComponentType;
  defaults: VectorProps;
  /** 作用点の表示切替をプロパティパネルに出すか */
  showPointOption: boolean;
}): PhysicsObjectPlugin<VectorProps> {
  return {
    id: config.id,
    version: 1,
    name: config.name,
    category: '力学',
    Icon: config.Icon,
    defaultProps: config.defaults,
    defaultSize: { width: config.defaults.length, height: config.defaults.headSize },
    propertySchema: [
      { key: 'length', label: '長さ', type: 'number', min: 1, step: 10 },
      { key: 'color', label: '色', type: 'color' },
      { key: 'strokeWidth', label: '線幅', type: 'number', min: 0.5, step: 0.5 },
      { key: 'headSize', label: '矢先サイズ', type: 'number', min: 2, step: 1 },
      { key: 'label', label: 'ラベル', type: 'text' },
      { key: 'fontSize', label: 'ラベルサイズ', type: 'number', min: 6, step: 2 },
      {
        key: 'labelPos',
        label: 'ラベル位置',
        type: 'select',
        options: [
          { value: 'tip', label: '先端' },
          { value: 'middle', label: '中央' },
        ],
      },
      ...(config.showPointOption
        ? [{ key: 'showPoint', label: '作用点', type: 'boolean' } as const]
        : []),
    ],
    Renderer: ({ props }) => {
      const half = props.length / 2;
      const lineEnd = half - props.headSize * 0.8;
      const halfW = props.headSize * 0.4;
      const labelX = props.labelPos === 'tip' ? half + props.fontSize * 0.8 : 0;
      const labelY = -(Math.max(halfW, props.strokeWidth) + props.fontSize * 0.7);
      return (
        <g>
          <line
            x1={-half}
            y1={0}
            x2={lineEnd}
            y2={0}
            stroke={props.color}
            strokeWidth={props.strokeWidth}
          />
          <polygon
            points={`${half},0 ${half - props.headSize},${-halfW} ${half - props.headSize},${halfW}`}
            fill={props.color}
          />
          {props.showPoint && <circle cx={-half} cy={0} r={props.strokeWidth * 1.6} fill={props.color} />}
          {props.label && (
            <text
              x={labelX}
              y={props.labelPos === 'tip' ? 0 : labelY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={props.fontSize}
              fontStyle="italic"
              fontFamily='"Times New Roman", serif'
              fill={props.color}
            >
              {props.label}
            </text>
          )}
          <line
            x1={-half}
            y1={0}
            x2={half}
            y2={0}
            stroke="transparent"
            strokeWidth={hitStrokeWidth(props.headSize)}
          />
        </g>
      );
    },
    getBounds: (props) => {
      const halfH = Math.max(props.headSize * 0.4, props.strokeWidth / 2, 4);
      // ラベル分は上側(と先端側)に広げる
      const top = props.label ? halfH + props.fontSize * 1.3 : halfH;
      const right = props.length / 2 + (props.label && props.labelPos === 'tip' ? props.fontSize * 1.5 : 0);
      return {
        x: -props.length / 2,
        y: -top,
        width: right + props.length / 2,
        height: top + halfH,
      };
    },
    getSnapPoints: (props) => [
      { x: -props.length / 2, y: 0 },
      { x: 0, y: 0 },
      { x: props.length / 2, y: 0 },
    ],
    getSegments: (props) => [segmentEndpoints(props.length)],
    getEndpoints: (props) => segmentEndpoints(props.length),
    setFromEndpoints(props, a, b) {
      const { length, transform } = segmentFromEndpoints(a, b);
      return { props: { ...props, length }, transform };
    },
    capabilities: { rotatable: false, scalable: 'none' },
    placement: 'drag-line',
    createFromDrag(start, end) {
      const { length, transform } = lineFromDrag(start, end, config.defaults.length);
      return { props: { ...config.defaults, length }, transform };
    },
  };
}
